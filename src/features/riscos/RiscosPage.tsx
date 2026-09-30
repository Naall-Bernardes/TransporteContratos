import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Abas } from '@/components/comum/Abas'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { OCORRENCIA_RISCO, RISCO } from '@/features/administracao/configuracoes'
import { SecaoRegistros } from '@/features/contratos/SecaoRegistros'
import { ErroPermissao } from '@/lib/dados/repositorio'
import { verificarGatilhosDeRisco } from '@/lib/dados/servicosMonitoramento'
import type { Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { ehCentral, podeEditarColecao } from '@/lib/permissoes'

type IdAba = 'matriz' | 'registro' | 'ocorrencias'

/** Faixas do nível P×I, com rótulo (a cor nunca aparece sozinha). */
export function faixaNivel(n: number) {
  if (n >= 16) return { rotulo: 'Crítico', classe: 'bg-red-600 text-white' }
  if (n >= 10) return { rotulo: 'Alto', classe: 'bg-orange-400 text-slate-900' }
  if (n >= 5) return { rotulo: 'Médio', classe: 'bg-yellow-200 text-slate-900' }
  return { rotulo: 'Baixo', classe: 'bg-green-100 text-slate-900' }
}

export function RiscosPage() {
  const usuario = useUsuario()
  const { dados, recarregar } = useTodos()
  const [aba, setAba] = useState<IdAba>('matriz')
  const [msg, setMsg] = useState<string | null>(null)
  const riscos = dados.riscos ?? []
  const ocorrencias = dados.risco_ocorrencias ?? []
  const abertas = (r: Registro) => ocorrencias.filter((o) => o.risco_id === r.id && o.status === 'aberta').length

  async function verificar() {
    try {
      const n = await verificarGatilhosDeRisco(usuario)
      setMsg(n ? `${n} nova(s) ocorrência(s) automática(s) registrada(s).` : 'Nenhuma ocorrência nova.')
      await recarregar()
    } catch (e) {
      if (e instanceof ErroPermissao) setMsg(e.message)
      else throw e
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Gestão de riscos</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">Registro de riscos do transporte escolar (probabilidade × impacto), ligado às etapas dos fluxos. Riscos com gatilho geram ocorrências automaticamente a partir dos dados.</p>
        </div>
        {ehCentral(usuario) && <Botao onClick={verificar}><ShieldCheck size={16} /> Verificar gatilhos agora</Botao>}
      </div>
      {msg && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{msg}</p>}

      <Abas
        abas={[
          { id: 'matriz', rotulo: 'Matriz de riscos' },
          { id: 'registro', rotulo: 'Registro', qtd: riscos.length },
          { id: 'ocorrencias', rotulo: 'Ocorrências', qtd: ocorrencias.filter((o) => o.status === 'aberta').length, alerta: ocorrencias.some((o) => o.status === 'aberta') },
        ]}
        ativa={aba}
        aoMudar={setAba}
      />

      <div className="mt-4">
        {aba === 'matriz' && (
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <div>
              <div className="flex">
                <div className="flex w-6 items-center justify-center"><span className="-rotate-90 text-xs whitespace-nowrap text-slate-500">Probabilidade</span></div>
                <table className="border-separate border-spacing-0.5 text-center text-xs">
                  <tbody>
                    {[5, 4, 3, 2, 1].map((p) => (
                      <tr key={p}>
                        <th className="w-6 font-medium text-slate-500">{p}</th>
                        {[1, 2, 3, 4, 5].map((i) => {
                          const aqui = riscos.filter((r) => Number(r.probabilidade) === p && Number(r.impacto) === i && r.status !== 'encerrado')
                          const f = faixaNivel(p * i)
                          return (
                            <td key={i} className={`size-16 rounded align-middle ${f.classe}`} title={`P${p} × I${i} = ${p * i} (${f.rotulo})${aqui.length ? ': ' + aqui.map((r) => r.codigo).join(', ') : ''}`}>
                              <span className="block text-[10px] opacity-70">{p * i}</span>
                              <span className="font-semibold">{aqui.map((r) => String(r.codigo).replace('R-', '')).join(' ')}</span>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    <tr>
                      <th />
                      {[1, 2, 3, 4, 5].map((i) => <th key={i} className="font-medium text-slate-500">{i}</th>)}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-center text-xs text-slate-500">Impacto</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {[2, 6, 12, 20].map((n) => <span key={n} className={`rounded px-2 py-0.5 ${faixaNivel(n).classe}`}>{faixaNivel(n).rotulo}</span>)}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
                  <tr><th className="px-3 py-2">Risco</th><th className="px-3 py-2">Nível</th><th className="px-3 py-2 text-right">Ocorrências abertas</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...riscos].sort((a, b) => Number(b.nivel) - Number(a.nivel)).map((r) => {
                    const f = faixaNivel(Number(r.nivel))
                    return (
                      <tr key={r.id}>
                        <td className="px-3 py-2"><span className="font-mono text-xs text-slate-500">{String(r.codigo)}</span> {String(r.titulo)}</td>
                        <td className="px-3 py-2"><span className={`rounded px-2 py-0.5 text-xs ${f.classe}`}>{String(r.nivel)} · {f.rotulo}</span></td>
                        <td className={`px-3 py-2 text-right tabular-nums ${abertas(r) ? 'font-semibold text-red-600' : ''}`}>{abertas(r)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aba === 'registro' && (
          <SecaoRegistros config={RISCO} valoresFixos={{}} registros={riscos} referencias={dados} podeEditar={podeEditarColecao(usuario, 'riscos')} aoAlterar={recarregar} cabecalho="Nível = probabilidade × impacto: baixo (1–4), médio (5–9), alto (10–15), crítico (16–25)." />
        )}

        {aba === 'ocorrencias' && (
          <SecaoRegistros
            config={OCORRENCIA_RISCO}
            valoresFixos={{}}
            registros={ocorrencias}
            referencias={dados}
            podeEditar={podeEditarColecao(usuario, 'risco_ocorrencias')}
            aoAlterar={recarregar}
            padraoNovo={{ data: hojeIso(), origem: 'manual', status: 'aberta' }}
            cabecalho="Ocorrências automáticas vêm dos gatilhos; as manuais podem ser registradas aqui (ex.: acesso indevido a dados)."
            destacarLinha={(o) => (o.status === 'aberta' ? 'bg-red-50' : undefined)}
          />
        )}
      </div>
    </div>
  )
}
