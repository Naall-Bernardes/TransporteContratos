import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { OBRIGATORIOS } from '@/lib/dados/regras'
import { ErroPermissao, ErroValidacao, salvar } from '@/lib/dados/repositorio'
import type { Registro } from '@/lib/dados/tipos'
import { formatarCpfCnpj } from '@/lib/formatacao'
import { ROTULO_REGISTRO, type CadastroConfig, type CampoConfig } from './configuracoes'
import type { Referencias } from './exibicao'

type Valores = Record<string, unknown>

interface Props {
  config: CadastroConfig
  registro: Registro | null
  referencias: Referencias
  aoSalvar: () => void
  aoCancelar: () => void
}

function valoresIniciais(config: CadastroConfig, registro: Registro | null): Valores {
  const v: Valores = {}
  for (const c of config.campos) {
    const atual = registro ? registro[c.nome] : c.padrao
    // cpf/cnpj aparecem formatados no formulário; a normalização tira a pontuação ao salvar
    v[c.nome] = c.tipo === 'cpf_cnpj' ? formatarCpfCnpj(atual) : (atual ?? (c.tipo === 'booleano' ? false : ''))
  }
  return v
}

export function FormularioRegistro({ config, registro, referencias, aoSalvar, aoCancelar }: Props) {
  const usuario = useUsuario()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({ defaultValues: valoresIniciais(config, registro) })

  const valores = watch()
  const obrigatorios = OBRIGATORIOS[config.colecao]
  const camposVisiveis = config.campos.filter((c) => c.emFormulario !== false && (!c.visivel || c.visivel(valores)))

  async function enviar(dados: Valores) {
    setErroGeral(null)
    const limpos: Valores = registro ? { id: registro.id } : {}
    for (const c of config.campos) {
      if (c.emFormulario === false) continue
      const v = dados[c.nome]
      limpos[c.nome] = (c.tipo === 'numero' || c.tipo === 'moeda') && v !== '' && v !== null ? Number(v) : v
    }
    try {
      await salvar(config.colecao, limpos, usuario)
      aoSalvar()
    } catch (e) {
      if (e instanceof ErroValidacao) {
        for (const [campo, msg] of Object.entries(e.erros)) setError(campo, { message: msg })
        const semCampo = Object.keys(e.erros).filter((k) => !camposVisiveis.some((c) => c.nome === k))
        setErroGeral(semCampo.length ? semCampo.map((k) => e.erros[k]).join(' ') : e.message)
      } else if (e instanceof ErroPermissao) {
        setErroGeral(e.message)
      } else {
        throw e
      }
    }
  }

  function renderizarCampo(c: CampoConfig) {
    const obrigatorio = obrigatorios.includes(c.nome) || c.obrigatorioSe?.(valores)
    const regras = { required: obrigatorio ? 'Campo obrigatório.' : false }
    const erro = errors[c.nome]?.message as string | undefined
    const comum = { id: c.nome, 'aria-invalid': erro ? true : undefined, className: 'campo' }

    let entrada
    switch (c.tipo) {
      case 'booleano':
        return (
          <label key={c.nome} className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register(c.nome)} className="size-4 accent-marca-600" />
            {c.rotulo}
          </label>
        )
      case 'selecao':
        entrada = (
          <select {...comum} {...register(c.nome, regras)}>
            <option value="">Selecione…</option>
            {c.opcoes!.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.rotulo}
              </option>
            ))}
          </select>
        )
        break
      case 'referencia': {
        const atual = registro?.[c.nome]
        const opcoes = (referencias[c.referencia!] ?? [])
          .filter((r) => r.ativo !== false || r.id === atual)
          .sort((a, b) => ROTULO_REGISTRO[c.referencia!](a).localeCompare(ROTULO_REGISTRO[c.referencia!](b), 'pt-BR'))
        entrada = (
          <select {...comum} {...register(c.nome, regras)}>
            <option value="">Selecione…</option>
            {opcoes.map((r) => (
              <option key={r.id} value={r.id}>
                {ROTULO_REGISTRO[c.referencia!](r)}
              </option>
            ))}
          </select>
        )
        break
      }
      case 'texto_longo':
        entrada = <textarea rows={3} {...comum} {...register(c.nome, regras)} />
        break
      default: {
        const tipoHtml = { data: 'date', email: 'email', numero: 'number', moeda: 'number' }[c.tipo as string] ?? 'text'
        entrada = (
          <input
            type={tipoHtml}
            step={c.tipo === 'moeda' ? '0.01' : c.tipo === 'numero' ? 'any' : undefined}
            maxLength={c.maxLength}
            {...comum}
            {...register(c.nome, regras)}
          />
        )
      }
    }

    return (
      <div key={c.nome} className={c.tipo === 'texto_longo' ? 'sm:col-span-2' : ''}>
        <label htmlFor={c.nome} className="mb-1 block text-sm font-medium text-slate-700">
          {c.rotulo}
          {obrigatorio && <span className="text-red-600"> *</span>}
        </label>
        {entrada}
        {erro ? (
          <p className="mt-1 text-xs text-red-600">{erro}</p>
        ) : (
          c.ajuda && <p className="mt-1 text-xs text-slate-500">{c.ajuda}</p>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">{camposVisiveis.map(renderizarCampo)}</div>
      {erroGeral && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroGeral}</p>}
      <div className="mt-6 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={isSubmitting}>
          Salvar
        </Botao>
      </div>
    </form>
  )
}
