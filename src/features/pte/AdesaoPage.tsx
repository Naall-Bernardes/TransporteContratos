// Termo de repasse do PTE a um município (no estilo da gestão contratual). O Estado registra o termo
// e os repasses; o município preenche contratos, frota, rotas e alunos, despesas e prestação de contas.

import { ArrowLeft, CheckCircle2, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Abas } from '@/components/comum/Abas'
import { ImportarCsv } from '@/components/comum/ImportarCsv'
import { SeloVigencia } from '@/components/comum/Selo'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { CONFIGS_CONTRATO, ENCERRAMENTO, SITUACOES_FINAIS } from '@/features/contratos/configuracoes'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { Modal } from '@/components/ui/Modal'
import { PrestacaoContas } from '@/features/contratos/PrestacaoContas'
import { SecaoRegistros } from '@/features/contratos/SecaoRegistros'
import { PainelDocumentos } from '@/features/documentos/PainelDocumentos'
import { ALOCACAO, CONTRATACAO_MUNICIPAL, DESPESA_PTE, ROTA_PTE } from '@/features/frota/configuracoes'
import { PainelConformidade } from '@/features/frota/PainelConformidade'
import { conformidadeDoContexto, totalPendencias } from '@/lib/conformidade'
import { calcularSituacao, ESTADOS_FINAIS_PRESTACAO } from '@/lib/contratos/calculos'
import { salvar } from '@/lib/dados/repositorio'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { numeroBr } from '@/lib/csvImport'
import { feriadosDe, importarAlunosTer, importarRotas } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso, somarDiasUteis } from '@/lib/diasUteis'
import { formatarData, formatarMoeda } from '@/lib/formatacao'
import { podeEditar as podeEditarRegistro } from '@/lib/permissoes'
import { PTE_ALUNO } from './configuracoes'

type IdAba = 'termo' | 'contratos' | 'frota' | 'rotas' | 'despesas' | 'ocorrencias' | 'prestacao' | 'encerramento' | 'documentos'

function Indicador({ rotulo, valor, detalhe, cor }: { rotulo: string; valor: string; detalhe?: string; cor?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className={`text-lg font-semibold tabular-nums ${cor ?? 'text-slate-900'}`}>{valor}</p>
      <p className="text-xs text-slate-600">{rotulo}</p>
      {detalhe && <p className="text-xs text-slate-500">{detalhe}</p>}
    </div>
  )
}

export function AdesaoPage() {
  const { id } = useParams()
  const usuario = useUsuario()
  const { dados, carregando, recarregar } = useTodos()
  const [aba, setAba] = useState<IdAba>('termo')
  const [encerrando, setEncerrando] = useState(false)
  const hoje = hojeIso()
  const adesao = dados.adesoes_pte?.find((a) => a.id === id)
  const lista = useMemo(() => (c: Colecao) => dados[c] ?? [], [dados])

  if (carregando) return null
  if (!adesao) return <p className="text-sm text-slate-600">Termo não encontrado ou sem permissão. <Link to="/pte" className="text-marca-700 underline">Voltar</Link></p>

  const achar = (c: Colecao, rid: unknown) => lista(c).find((r) => r.id === rid)
  const pode = (c: Colecao, r: Record<string, unknown>) => podeEditarRegistro(usuario, c, r as Registro, achar)
  const municipio = achar('municipios', adesao.municipio_id)
  const ano = String(achar('ciclos_pte', adesao.ciclo_id)?.ano ?? '')
  const processo = achar('processos', adesao.processo_id)
  const termo = lista('instrumentos').find((i) => i.processo_id === adesao.processo_id && i.tipo === 'termo_pte')
  const parcelas = termo ? lista('parcelas').filter((p) => p.instrumento_id === termo.id) : []
  const s = termo ? calcularSituacao(termo, lista('aditivos').filter((x) => x.instrumento_id === termo.id), parcelas, hoje) : undefined
  const contratos = lista('contratacoes_municipais').filter((c) => c.adesao_id === adesao.id)
  const conformidade = contratos.flatMap((c) => conformidadeDoContexto(lista, { contratacao_id: c.id }, hoje))
  const rotas = lista('rotas_pte').filter((r) => r.adesao_id === adesao.id)
  const alunos = lista('pte_alunos').filter((a) => a.adesao_id === adesao.id)
  const despesas = lista('despesas_pte').filter((x) => x.adesao_id === adesao.id)
  const prestacoes = termo ? lista('prestacoes_contas').filter((p) => p.instrumento_id === termo.id) : []
  const feriados = feriadosDe(lista)
  const semComprovacao = (x: Registro) => !x.data_comprovacao && somarDiasUteis(String(x.data_transacao), 30, feriados) < hoje
  const gasto = despesas.reduce((t, x) => t + Number(x.valor || 0), 0)
  const contratado = contratos.reduce((t, c) => t + Number(c.valor || 0), 0)
  const executadoContratos = contratos.reduce((t, c) => t + Number(c.valor_executado || 0), 0)
  const docs = processo ? lista('documentos').filter((d) => d.processo_id === processo.id) : []
  const ocorrencias = termo ? lista('ocorrencias').filter((o) => o.instrumento_id === termo.id) : []
  const encerrado = termo ? ['encerrado', 'rescindido'].includes(String(termo.status)) : false
  // Pendências verificadas antes do encerramento do termo
  const pendencias = termo && s ? ([
    s.dias_para_vencer > 0 && `A vigência só termina em ${formatarData(s.vigencia_fim_atual)} — encerramento antecipado (avalie se é rescisão).`,
    parcelas.some((p) => !p.valor_pago) && `${parcelas.filter((p) => !p.valor_pago).length} repasse(s) previsto(s) sem pagamento.`,
    s.valor_executado - gasto > 0 && `Saldo do repasse em conta de ${formatarMoeda(s.valor_executado - gasto)} (devolver ou reprogramar).`,
    despesas.some(semComprovacao) && `${despesas.filter(semComprovacao).length} despesa(s) sem comprovação.`,
    prestacoes.some((p) => !ESTADOS_FINAIS_PRESTACAO.includes(String(p.status))) && 'Há prestação de contas ainda não decidida.',
    prestacoes.length === 0 && 'Nenhuma prestação de contas registrada.',
    ocorrencias.some((o) => o.status !== 'resolvida') && 'Há ocorrências não resolvidas.',
  ].filter(Boolean) as string[]) : []

  function exportarAlunos() {
    const csv = gerarCsv(['matricula', 'nome', 'inep', 'rota', 'km_ida', 'zona', 'turno'], alunos.map((a) => [String(a.cod_simade), String(a.nome), String(a.escola_inep), String(a.rota_codigo ?? ''), String(a.km_ida ?? '').replace('.', ','), String(a.zona ?? ''), String(a.turno ?? '')]))
    baixarArquivo(`alunos_pte_${municipio?.cod_ibge}_${ano}.csv`, csv)
  }

  const ABAS = [
    { id: 'termo' as const, rotulo: 'Termo e repasses', qtd: parcelas.length },
    { id: 'contratos' as const, rotulo: 'Contratos do município', qtd: contratos.length },
    { id: 'frota' as const, rotulo: 'Frota e motoristas', alerta: totalPendencias(conformidade) > 0 },
    { id: 'rotas' as const, rotulo: 'Rotas e alunos', qtd: rotas.length },
    { id: 'despesas' as const, rotulo: 'Despesas', qtd: despesas.length, alerta: despesas.some(semComprovacao) },
    { id: 'ocorrencias' as const, rotulo: 'Ocorrências', qtd: ocorrencias.length, alerta: ocorrencias.some((o) => o.status !== 'resolvida' && o.gravidade === 'alta') },
    { id: 'prestacao' as const, rotulo: 'Prestação de contas', qtd: prestacoes.length },
    { id: 'encerramento' as const, rotulo: 'Encerramento' },
    { id: 'documentos' as const, rotulo: 'Documentos', qtd: docs.length },
  ]

  return (
    <div>
      <Link to="/pte" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700"><ArrowLeft size={16} /> PTE</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{String(municipio?.nome ?? '')} — PTE {ano}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {termo ? `Termo ${termo.numero}` : 'Sem termo cadastrado'} · {String(processo?.codigo ?? '')} · Processo SEI {String(termo?.numero_sei ?? processo?.numero_sei ?? '—')}
          </p>
          {termo && (
            <p className="mt-1 flex items-center gap-2 text-sm">
              Vigência {formatarData(termo.vigencia_inicio)} a {formatarData(s?.vigencia_fim_atual)} {s && <SeloVigencia faixa={s.faixa} />}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Indicador rotulo="Valor do repasse" valor={s ? formatarMoeda(s.valor_atual) : '—'} detalhe={`${parcelas.length} parcela(s)`} />
        <Indicador rotulo="Repassado pelo Estado" valor={s ? formatarMoeda(s.valor_executado) : '—'} detalhe={s ? `${s.pct_executado.toFixed(0)}% do repasse` : undefined} />
        <Indicador rotulo="Gasto informado pelo município" valor={formatarMoeda(gasto)} detalhe={`${despesas.filter(semComprovacao).length} despesa(s) sem comprovação`} cor={despesas.some(semComprovacao) ? 'text-red-600' : undefined} />
        <Indicador rotulo="Saldo do repasse em conta" valor={s ? formatarMoeda(s.valor_executado - gasto) : '—'} detalhe="repassado − gasto informado" />
        <Indicador rotulo="Contratos do município" valor={formatarMoeda(contratado)} detalhe={`executado ${formatarMoeda(executadoContratos)}`} />
      </div>

      <Abas abas={ABAS} ativa={aba} aoMudar={setAba} />

      <div className="mt-4">
        {aba === 'termo' && (
          termo ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
                <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div><dt className="text-xs text-slate-500">Objeto</dt><dd>{String(termo.objeto ?? '')}</dd></div>
                  <div><dt className="text-xs text-slate-500">Assinatura</dt><dd>{formatarData(termo.data_assinatura)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Dotação orçamentária</dt><dd>{String(termo.dotacao_orcamentaria ?? '—')}</dd></div>
                  <div><dt className="text-xs text-slate-500">Gestor / fiscal</dt><dd>{String(achar('usuarios', termo.gestor_id)?.nome ?? '—')} / {String(achar('usuarios', termo.fiscal_id)?.nome ?? '—')}</dd></div>
                </dl>
              </div>
              <SecaoRegistros
                config={{ ...CONFIGS_CONTRATO.parcelas, titulo: 'Repasses (parcelas)' }}
                valoresFixos={{ instrumento_id: termo.id }}
                registros={parcelas}
                referencias={dados}
                podeEditar={pode('parcelas', { instrumento_id: termo.id })}
                aoAlterar={recarregar}
                cabecalho="Cronograma de repasses do Estado ao município. Preencha o valor e a data do pagamento quando o repasse for efetivado."
                destacarLinha={(p) => (!p.valor_pago && String(p.data_prevista) < hoje ? 'bg-red-50' : undefined)}
              />
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Termo de repasse ainda não cadastrado para este município.</p>
          )
        )}

        {aba === 'contratos' && (
          <SecaoRegistros
            config={CONTRATACAO_MUNICIPAL}
            valoresFixos={{ adesao_id: adesao.id }}
            registros={contratos}
            referencias={dados}
            podeEditar={pode('contratacoes_municipais', { adesao_id: adesao.id })}
            aoAlterar={recarregar}
            padraoNovo={{ tipo: 'terceirizado', vigencia_inicio: termo?.vigencia_inicio, vigencia_fim: termo?.vigencia_fim, valor_executado: 0 }}
            cabecalho={<>Contratos do município com transportadores (Lei 14.133/2021) e frota própria, mantidos com o repasse. O contratado é escolhido do cadastro — <Link to="/cadastros/transportadores" className="text-marca-700 hover:underline">cadastrar transportador</Link>.</>}
          />
        )}

        {aba === 'frota' && (
          <div className="space-y-6">
            {contratos.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Cadastre primeiro os contratos do município (ou a frota própria) na aba anterior.</p>}
            {contratos.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <h3 className="text-sm font-semibold text-slate-900">
                  {c.tipo === 'frota_propria' ? 'Frota própria do município' : `Contrato ${c.numero_contrato} — ${String(achar('transportadores', c.transportador_id)?.razao_social ?? '')}`}
                </h3>
                <div className="mt-3">
                  <SecaoRegistros
                    config={ALOCACAO}
                    valoresFixos={{ contratacao_id: c.id }}
                    registros={lista('alocacoes').filter((a) => a.contratacao_id === c.id)}
                    referencias={dados}
                    podeEditar={pode('alocacoes', { contratacao_id: c.id })}
                    aoAlterar={recarregar}
                    padraoNovo={{ inicio: hoje }}
                    cabecalho={<>Veículos e condutores em serviço — CTB arts. 136 a 139 (Res. 5.267/2026, art. 8º). Cadastre-os em <Link to="/cadastros/veiculos" className="text-marca-700 hover:underline">Veículos</Link> e <Link to="/cadastros/condutores" className="text-marca-700 hover:underline">Condutores</Link>.</>}
                  />
                </div>
                <div className="mt-4">
                  <PainelConformidade entidades={conformidadeDoContexto(lista, { contratacao_id: c.id }, hoje)} dados={dados} podeEnviar={pode('documentos', { processo_id: null })} aoAlterar={recarregar} />
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === 'rotas' && (
          <div className="space-y-6">
            <SecaoRegistros
              config={ROTA_PTE}
              valoresFixos={{ adesao_id: adesao.id }}
              registros={rotas}
              referencias={{ ...dados, contratacoes_municipais: contratos }}
              podeEditar={pode('rotas_pte', { adesao_id: adesao.id })}
              aoAlterar={recarregar}
              padraoNovo={{ turno: 'manha' }}
              cabecalho="Rotas que o município opera com o repasse (km/dia, passageiros, veículo e contrato)."
              acoesCabecalho={pode('rotas_pte', { adesao_id: adesao.id }) ? <ImportarCsv titulo="Importar rotas" colunas="rota, descricao, turno, km_diario, custo_km, passageiros, capacidade, urbana" importar={(l) => importarRotas(usuario, adesao.id, l, numeroBr)} aoConcluir={recarregar} /> : undefined}
            />
            <SecaoRegistros
              config={{ ...PTE_ALUNO, titulo: 'Alunos atendidos' }}
              valoresFixos={{ adesao_id: adesao.id }}
              registros={alunos}
              referencias={dados}
              podeEditar={pode('pte_alunos', { adesao_id: adesao.id })}
              aoAlterar={recarregar}
              cabecalho="Estudantes da rede estadual transportados pelo município."
              acoesCabecalho={
                <>
                  <Botao variante="secundario" onClick={exportarAlunos} disabled={!alunos.length}><Download size={16} /> Exportar CSV</Botao>
                  {pode('pte_alunos', { adesao_id: adesao.id }) && <ImportarCsv titulo="Importar alunos" colunas="matricula, nome, inep, rota, km_ida, zona, turno" importar={(l) => importarAlunosTer(usuario, adesao.id, l, numeroBr)} aoConcluir={recarregar} />}
                </>
              }
            />
          </div>
        )}

        {aba === 'despesas' && (
          <SecaoRegistros
            config={DESPESA_PTE}
            valoresFixos={{ adesao_id: adesao.id }}
            registros={despesas}
            referencias={{ ...dados, contratacoes_municipais: contratos }}
            podeEditar={pode('despesas_pte', { adesao_id: adesao.id })}
            aoAlterar={recarregar}
            padraoNovo={{ data_transacao: hoje }}
            cabecalho={`Total pago: ${formatarMoeda(gasto)}. Comprovar cada despesa em até 30 dias úteis (art. 22, § 1º) — em vermelho as atrasadas. Prestação de contas anual até 28/02 do ano seguinte.`}
            destacarLinha={(x) => (semComprovacao(x) ? 'bg-red-50' : undefined)}
          />
        )}

        {aba === 'prestacao' && (
          termo ? (
            <PrestacaoContas instrumentoId={termo.id} prestacoes={prestacoes} referencias={dados} podeEditar={pode('prestacoes_contas', { instrumento_id: termo.id })} hoje={hoje} aoAlterar={recarregar} />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">A prestação de contas depende do termo de repasse.</p>
          )
        )}

        {aba === 'ocorrencias' && (
          termo ? (
            <SecaoRegistros
              config={CONFIGS_CONTRATO.ocorrencias}
              valoresFixos={{ instrumento_id: termo.id }}
              registros={ocorrencias}
              referencias={dados}
              podeEditar={pode('ocorrencias', { instrumento_id: termo.id })}
              aoAlterar={recarregar}
              padraoNovo={{ data: hoje, status: 'aberta', gravidade: 'media' }}
              cabecalho="Falhas na execução do transporte pelo município (veículo irregular, rota não cumprida, despesa indevida…) e as notificações enviadas, com prazo de resposta."
              destacarLinha={(o) => (o.status !== 'resolvida' && o.gravidade === 'alta' ? 'bg-red-50' : undefined)}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">As ocorrências são registradas no termo de repasse.</p>
          )
        )}

        {aba === 'encerramento' && termo && (
          encerrado ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-slate-900"><CheckCircle2 size={18} className="text-green-600" /> Termo encerrado em {formatarData(termo.encerrado_em)}</p>
              <p className="mt-2"><span className="text-slate-500">Situação final:</span> {SITUACOES_FINAIS.find((o) => o.valor === termo.situacao_final)?.rotulo}</p>
              <p><span className="text-slate-500">Termo de encerramento (SEI):</span> {String(termo.termo_encerramento_sei ?? '—')}</p>
              {Boolean(termo.pendencias_encerramento) && <p><span className="text-slate-500">Pendências:</span> {String(termo.pendencias_encerramento)}</p>}
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
              <h3 className="font-medium text-slate-900">Verificação antes do encerramento</h3>
              {pendencias.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-green-700"><CheckCircle2 size={16} /> Nenhuma pendência encontrada.</p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900">{pendencias.map((p) => <li key={p}>{p}</li>)}</ul>
              )}
              <p className="mt-3 text-slate-600">Após o encerramento o termo fica bloqueado para novos lançamentos. Se houver pendências, escolha “Concluído com pendências” e descreva-as.</p>
              {pode('instrumentos', termo) && <Botao className="mt-3" onClick={() => setEncerrando(true)}>Encerrar termo</Botao>}
            </div>
          )
        )}
        {aba === 'encerramento' && !termo && (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">Sem termo de repasse para encerrar.</p>
        )}

        {aba === 'documentos' && processo && (
          <PainelDocumentos processoId={String(processo.id)} codigoProcesso={String(processo.codigo)} dados={dados} podeEnviar={pode('documentos', { processo_id: processo.id })} aoAlterar={recarregar} />
        )}
      </div>

      <Modal titulo="Encerrar termo de repasse" aberto={encerrando} aoFechar={() => setEncerrando(false)}>
        {encerrando && termo && (
          <FormularioRegistro
            config={ENCERRAMENTO}
            registro={termo}
            referencias={dados}
            valoresPadrao={{ encerrado_em: hoje }}
            rotuloSalvar="Encerrar"
            aoCancelar={() => setEncerrando(false)}
            aoSalvar={async () => {
              setEncerrando(false)
              await salvar('adesoes_pte', { id: adesao.id, status: 'encerrado' }, usuario)
              await recarregar()
            }}
          />
        )}
      </Modal>
    </div>
  )
}
