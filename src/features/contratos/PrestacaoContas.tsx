// Prestação de contas com fluxo controlado:
// pendente → em análise → (diligência → reapresentada, uma única vez) → aprovada / com ressalvas / reprovada

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PRAZO_PRESTACAO, Selo, SeloStatusPrestacao } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import type { Referencias } from '@/features/cadastros/exibicao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { situacaoPrazoPrestacao, TRANSICOES_PRESTACAO, ESTADOS_FINAIS_PRESTACAO } from '@/lib/contratos/calculos'
import { ROTULO_STATUS_PRESTACAO } from '@/lib/dados/regrasContratos'
import type { Registro } from '@/lib/dados/tipos'
import { formatarData } from '@/lib/formatacao'
import { ACOES_PRESTACAO, CONFIGS_CONTRATO } from './configuracoes'

interface Props {
  instrumentoId: string
  prestacoes: Registro[]
  referencias: Referencias
  podeEditar: boolean
  hoje: string
  aoAlterar: () => Promise<void>
}

/** Qual ação está disponível em cada situação. */
function acoesDisponiveis(status: string): string[] {
  const proximos = TRANSICOES_PRESTACAO[status] ?? []
  const acoes: string[] = []
  if (proximos.includes('em_analise')) acoes.push('entregar')
  if (proximos.includes('em_diligencia')) acoes.push('diligenciar')
  if (proximos.includes('reapresentada')) acoes.push('reapresentar')
  if (proximos.some((p) => ESTADOS_FINAIS_PRESTACAO.includes(p))) acoes.push('decidir')
  return acoes
}

const Linha = ({ rotulo, valor }: { rotulo: string; valor: unknown }) =>
  valor ? (
    <p>
      <span className="text-slate-500">{rotulo}:</span> {String(valor)}
    </p>
  ) : null

export function PrestacaoContas({ instrumentoId, prestacoes, referencias, podeEditar, hoje, aoAlterar }: Props) {
  const [acao, setAcao] = useState<{ nome: string; registro: Registro | null } | null>(null)
  const nomeAnalista = (id: unknown) => referencias.usuarios?.find((u) => u.id === id)?.nome
  const ordenadas = [...prestacoes].sort((a, b) => String(a.data_limite).localeCompare(String(b.data_limite)))

  const configAcao = acao?.nome === 'nova' ? CONFIGS_CONTRATO.prestacoes_contas : acao ? ACOES_PRESTACAO[acao.nome].config : null
  const destino = acao && acao.nome !== 'nova' ? ACOES_PRESTACAO[acao.nome].destino : undefined

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">
          Fluxo: pendente → em análise → aprovada / aprovada com ressalvas / reprovada. Se necessário, abre-se <strong>uma única</strong> diligência
          antes da decisão.
        </p>
        {podeEditar && (
          <Botao onClick={() => setAcao({ nome: 'nova', registro: null })}>
            <Plus size={16} /> Prever prestação de contas
          </Botao>
        )}
      </div>

      {ordenadas.length === 0 && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500">Nenhuma prestação de contas prevista.</p>
      )}

      <div className="space-y-3">
        {ordenadas.map((p) => {
          const prazo = PRAZO_PRESTACAO[situacaoPrazoPrestacao(p, hoje)]
          const status = String(p.status)
          return (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-slate-900">{String(p.periodo_referencia)}</h3>
                  <SeloStatusPrestacao status={status} rotulo={ROTULO_STATUS_PRESTACAO[status]} />
                  <Selo cor={prazo.cor}>{prazo.rotulo}</Selo>
                </div>
                {podeEditar && (
                  <div className="flex flex-wrap gap-2">
                    {acoesDisponiveis(status).map((a) => (
                      <Botao key={a} variante="secundario" onClick={() => setAcao({ nome: a, registro: p })}>
                        {ACOES_PRESTACAO[a].rotulo}
                      </Botao>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                <Linha rotulo="Prazo de entrega" valor={formatarData(p.data_limite)} />
                <Linha rotulo="Entregue em" valor={formatarData(p.data_entrega)} />
                <Linha rotulo="Diligência em" valor={formatarData(p.diligencia_data)} />
                <Linha rotulo="Prazo da diligência" valor={formatarData(p.diligencia_prazo)} />
                <Linha rotulo="Reapresentada em" valor={formatarData(p.reapresentada_em)} />
                <Linha rotulo="Decisão em" valor={formatarData(p.data_decisao)} />
                <Linha rotulo="Analista" valor={nomeAnalista(p.analista_id)} />
              </div>
              {Boolean(p.diligencia_descricao) && <p className="mt-2 text-sm"><span className="text-slate-500">Diligência:</span> {String(p.diligencia_descricao)}</p>}
              {Boolean(p.parecer) && <p className="mt-1 text-sm"><span className="text-slate-500">Parecer:</span> {String(p.parecer)}</p>}
            </div>
          )
        })}
      </div>

      <Modal
        titulo={acao?.nome === 'nova' ? 'Prever prestação de contas' : acao ? ACOES_PRESTACAO[acao.nome].rotulo : ''}
        aberto={acao !== null}
        aoFechar={() => setAcao(null)}
        largura="md"
      >
        {acao && configAcao && (
          <FormularioRegistro
            config={configAcao}
            registro={acao.registro}
            referencias={referencias}
            valoresFixos={{ instrumento_id: instrumentoId, ...(acao.nome === 'nova' ? { status: 'pendente' } : {}), ...(destino ? { status: destino } : {}) }}
            rotuloSalvar={acao.nome === 'nova' ? 'Salvar' : 'Confirmar'}
            aoCancelar={() => setAcao(null)}
            aoSalvar={async () => {
              setAcao(null)
              await aoAlterar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
