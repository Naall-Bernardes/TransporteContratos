import { Fragment, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { OBRIGATORIOS } from '@/lib/dados/regras'
import { ErroPermissao, ErroRegra, ErroValidacao, salvar } from '@/lib/dados/repositorio'
import type { Registro } from '@/lib/dados/tipos'
import { formatarCpfCnpj } from '@/lib/formatacao'
import { ROTULO_REGISTRO, type CadastroConfig, type CampoConfig } from './configuracoes'
import type { Referencias } from './exibicao'

type Valores = Record<string, unknown>

export const NAO_SE_APLICA = 'Não se aplica'

interface Props {
  config: CadastroConfig
  registro: Registro | null
  referencias: Referencias
  aoSalvar: (registro: Registro) => void
  aoCancelar: () => void
  /** Gravados junto com o formulário, sem aparecer na tela (ex.: instrumento_id, nova situação). */
  valoresFixos?: Valores
  /** Sugestões iniciais para um registro novo (ex.: próximo número de parcela). */
  valoresPadrao?: Valores
  rotuloSalvar?: string
  /** Substitui a gravação padrão (ex.: criar demanda = processo + demanda + 1ª etapa). */
  acao?: (dados: Valores) => Promise<Registro>
  /** Botões extras ao lado do Salvar; `enviarCom` grava somando valores extras (ex.: status). */
  acoesExtras?: (valores: Valores, enviarCom: (extras: Valores) => void) => ReactNode
  somenteLeitura?: boolean
}

function valoresIniciais(config: CadastroConfig, registro: Registro | null, padrao: Valores): Valores {
  const v: Valores = {}
  for (const c of config.campos) {
    const atual = registro ? registro[c.nome] : (padrao[c.nome] ?? c.padrao)
    if (c.tipo === 'cpf_cnpj') v[c.nome] = formatarCpfCnpj(atual)
    else if (c.tipo === 'multipla') v[c.nome] = Array.isArray(atual) ? atual : []
    else v[c.nome] = atual ?? (c.tipo === 'booleano' ? false : '')
  }
  return v
}

export function FormularioRegistro({
  config,
  registro,
  referencias,
  aoSalvar,
  aoCancelar,
  valoresFixos = {},
  valoresPadrao = {},
  rotuloSalvar = 'Salvar',
  acao,
  acoesExtras,
  somenteLeitura,
}: Props) {
  const usuario = useUsuario()
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({ defaultValues: valoresIniciais(config, registro, valoresPadrao) })

  const valores = watch()
  const obrigatorios = OBRIGATORIOS[config.colecao]
  const camposVisiveis = config.campos.filter((c) => c.emFormulario !== false && (!c.visivel || c.visivel(valores)))

  const enviar = (extras: Valores) => async (dados: Valores) => {
    setErroGeral(null)
    const limpos: Valores = registro ? { id: registro.id } : {}
    for (const c of config.campos) {
      if (c.emFormulario === false) continue
      const v = dados[c.nome]
      limpos[c.nome] = (c.tipo === 'numero' || c.tipo === 'moeda') && v !== '' && v !== null ? Number(v) : v
    }
    const completos = { ...limpos, ...valoresFixos, ...extras }
    try {
      aoSalvar(acao ? await acao(completos) : await salvar(config.colecao, completos, usuario))
    } catch (e) {
      if (e instanceof ErroValidacao) {
        for (const [campo, msg] of Object.entries(e.erros)) setError(campo, { message: msg })
        const semCampo = Object.keys(e.erros).filter((k) => !camposVisiveis.some((c) => c.nome === k))
        setErroGeral(semCampo.length ? semCampo.map((k) => e.erros[k]).join(' ') : e.message)
      } else if (e instanceof ErroPermissao || e instanceof ErroRegra) {
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
    const comum = { id: c.nome, 'aria-invalid': erro ? true : undefined, className: 'campo', disabled: somenteLeitura }
    const largo = c.tipo === 'texto_longo' || c.tipo === 'multipla'

    let entrada
    switch (c.tipo) {
      case 'booleano':
        return (
          <label key={c.nome} className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" {...register(c.nome)} disabled={somenteLeitura} className="size-4 accent-marca-600" />
            {c.rotulo}
          </label>
        )
      case 'multipla':
        entrada = (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border border-slate-200 px-3 py-2">
            {c.opcoes!.map((o) => (
              <label key={o.valor} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" value={o.valor} {...register(c.nome, regras)} disabled={somenteLeitura} className="size-4 accent-marca-600" />
                {o.rotulo}
              </label>
            ))}
          </div>
        )
        break
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
        const rotulo = ROTULO_REGISTRO[c.referencia!]
        const opcoes = (referencias[c.referencia!] ?? [])
          .filter((r) => (r.ativo !== false && (!c.filtroReferencia || c.filtroReferencia(r, valores))) || r.id === atual)
          .sort((a, b) => rotulo(a).localeCompare(rotulo(b), 'pt-BR'))
        entrada = (
          <select {...comum} {...register(c.nome, regras)}>
            <option value="">Selecione…</option>
            {opcoes.map((r) => (
              <option key={r.id} value={r.id}>
                {rotulo(r)}
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
        const tipoHtml = { data: 'date', mes: 'month', hora: 'time', email: 'email', numero: 'number', moeda: 'number' }[c.tipo as string] ?? 'text'
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
      <div key={c.nome} className={largo ? 'sm:col-span-2' : ''}>
        <div className="mb-1 flex items-end justify-between gap-2">
          <label htmlFor={c.nome} className="block text-sm font-medium text-slate-700">
            {c.rotulo}
            {obrigatorio && <span className="text-red-600"> *</span>}
          </label>
          {c.naoSeAplica && !somenteLeitura && (
            <button type="button" onClick={() => setValue(c.nome, NAO_SE_APLICA, { shouldDirty: true })} className="shrink-0 text-xs text-marca-700 hover:underline">
              Não se aplica
            </button>
          )}
        </div>
        {entrada}
        {erro ? <p className="mt-1 text-xs text-red-600">{erro}</p> : c.ajuda && <p className="mt-1 text-xs text-slate-500">{c.ajuda}</p>}
      </div>
    )
  }

  let secaoAnterior: string | undefined
  return (
    <form onSubmit={handleSubmit(enviar({}))} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {camposVisiveis.map((c) => {
          const cabecalho = c.secao && c.secao !== secaoAnterior
          secaoAnterior = c.secao ?? secaoAnterior
          return (
            <Fragment key={c.nome}>
              {cabecalho && <h3 className="mt-2 border-b border-slate-200 pb-1 text-sm font-semibold text-marca-800 sm:col-span-2">{c.secao}</h3>}
              {renderizarCampo(c)}
            </Fragment>
          )
        })}
      </div>
      {erroGeral && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroGeral}</p>}
      {!somenteLeitura && (
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Botao>
          {acoesExtras?.(valores, (extras) => void handleSubmit(enviar(extras))())}
          <Botao type="submit" disabled={isSubmitting}>
            {rotuloSalvar}
          </Botao>
        </div>
      )}
    </form>
  )
}
