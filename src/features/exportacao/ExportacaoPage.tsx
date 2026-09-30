// Central de exportação para Excel / Power BI: tabelas brutas + visões calculadas.
// Em produção, o Power BI pode ler direto as views do banco (sem exportar arquivo).

import JSZip from 'jszip'
import { Download, FileArchive } from 'lucide-react'
import { Botao } from '@/components/ui/Botao'
import { CONFIGURACOES } from '@/features/configuracoes'
import { calcularSituacao } from '@/lib/contratos/calculos'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { feriadosDe } from '@/lib/dados/servicos'
import { COLECOES, type Colecao, type Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { duracaoDiasUteis } from '@/lib/fluxo/sla'
import { situacaoDosProcessos } from '@/lib/monitoramento'

/** Tabelas com dados pessoais sensíveis: não saem na exportação (LGPD). */
const FORA_DA_EXPORTACAO: Colecao[] = ['caracterizacoes_saude', 'responsaveis_legais']

interface Conjunto {
  nome: string
  descricao: string
  linhas: () => { cabecalho: string[]; linhas: string[][] }
}

const valorCsv = (v: unknown) => (v === null || v === undefined ? '' : Array.isArray(v) ? v.join('|') : typeof v === 'number' ? String(v).replace('.', ',') : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : String(v))

function tabela(registros: Registro[]) {
  const colunas = [...new Set(registros.flatMap((r) => Object.keys(r)))].filter((c) => !c.startsWith('_'))
  return { cabecalho: colunas, linhas: registros.map((r) => colunas.map((c) => valorCsv(r[c]))) }
}

export function ExportacaoPage() {
  const { dados } = useTodos()
  const hoje = hojeIso()
  const lista = (c: Colecao) => dados[c] ?? []
  const nome = (c: Colecao, id: unknown, campo = 'nome') => String(lista(c).find((r) => r.id === id)?.[campo] ?? '')

  const visoes: Conjunto[] = [
    {
      nome: 'vw_demandas',
      descricao: 'Uma linha por demanda judicial: etapa atual, semáforo, prazo que manda, dias úteis e escalonamento.',
      linhas: () => {
        const s = situacaoDosProcessos(lista, hoje, feriadosDe(lista)).filter((x) => x.demanda)
        return {
          cabecalho: ['codigo', 'numero_sei', 'sre', 'escola', 'origem', 'prazo_judicial', 'inicio_transporte', 'situacao', 'etapa_codigo', 'etapa_nome', 'semaforo', 'prazo_efetivo', 'origem_prazo', 'dias_uteis_restantes', 'nivel_escalonamento', 'valor_total'],
          linhas: s.map((x) => [
            String(x.processo.codigo), valorCsv(x.processo.numero_sei), nome('sres', x.sre_id, 'sigla'), nome('escolas', x.demanda!.escola_id), valorCsv(x.demanda!.origem), valorCsv(x.demanda!.prazo_judicial),
            valorCsv(x.demanda!.data_inicio_transporte), valorCsv(x.demanda!.situacao), valorCsv(x.modelo?.codigo), valorCsv(x.modelo?.nome), x.semaforo.cor, valorCsv(x.semaforo.prazo), valorCsv(x.semaforo.origem),
            valorCsv(x.semaforo.dias_uteis), String(x.semaforo.nivel), valorCsv(x.demanda!.valor_total),
          ]),
        }
      },
    },
    {
      nome: 'vw_etapas',
      descricao: 'Uma linha por etapa de cada processo, com duração em dias úteis e SLA — base do "tempo médio por etapa".',
      linhas: () => {
        const feriados = feriadosDe(lista)
        return {
          cabecalho: ['codigo_processo', 'modulo', 'etapa_codigo', 'etapa_nome', 'status', 'iniciada_em', 'concluida_em', 'dias_uteis', 'sla_dias_uteis', 'acima_sla', 'responsavel', 'avancou_com_justificativa'],
          linhas: lista('processo_etapas').map((e) => {
            const m = lista('etapas_modelo').find((x) => x.id === e.etapa_modelo_id)
            const dur = duracaoDiasUteis(String(e.iniciada_em), (e.concluida_em as string) ?? null, hoje, feriados)
            const sla = m?.sla_dias_uteis as number | null
            return [nome('processos', e.processo_id, 'codigo'), valorCsv(m?.modulo), valorCsv(m?.codigo), valorCsv(m?.nome), valorCsv(e.status), valorCsv(e.iniciada_em), valorCsv(e.concluida_em), String(dur), valorCsv(sla), sla && dur > sla ? 'Sim' : 'Não', nome('usuarios', e.responsavel_id), e.justificativa_avanco ? 'Sim' : 'Não']
          }),
        }
      },
    },
    {
      nome: 'vw_instrumentos',
      descricao: 'Contratos e termos com vigência atual, valor atual, executado, saldo e faixa de alerta.',
      linhas: () => ({
        cabecalho: ['codigo_processo', 'tipo', 'numero', 'numero_sei', 'sre', 'vigencia_inicio', 'vigencia_fim_atual', 'dias_para_vencer', 'faixa', 'valor_original', 'valor_atual', 'valor_executado', 'saldo', 'pct_executado', 'pct_acrescimos', 'qtd_aditivos', 'status'],
        linhas: lista('instrumentos').map((i) => {
          const s = calcularSituacao(i, lista('aditivos').filter((a) => a.instrumento_id === i.id), lista('parcelas').filter((p) => p.instrumento_id === i.id), hoje)
          return [nome('processos', i.processo_id, 'codigo'), valorCsv(i.tipo), valorCsv(i.numero), valorCsv(i.numero_sei), nome('sres', i.sre_id, 'sigla'), valorCsv(i.vigencia_inicio), s.vigencia_fim_atual, String(s.dias_para_vencer), s.faixa, valorCsv(s.valor_original), valorCsv(s.valor_atual), valorCsv(s.valor_executado), valorCsv(s.saldo), valorCsv(Math.round(s.pct_executado * 10) / 10), valorCsv(Math.round(s.pct_acrescimos * 10) / 10), String(s.qtd_aditivos), valorCsv(i.status)]
        }),
      }),
    },
  ]

  const tabelas: Conjunto[] = COLECOES.filter((c) => !FORA_DA_EXPORTACAO.includes(c)).map((c) => ({
    nome: c,
    descricao: CONFIGURACOES[c].titulo,
    linhas: () => tabela(lista(c)),
  }))

  const baixar = (c: Conjunto) => {
    const t = c.linhas()
    baixarArquivo(`${c.nome}_${hoje}.csv`, gerarCsv(t.cabecalho, t.linhas))
  }

  async function baixarTudo() {
    const zip = new JSZip()
    for (const c of [...visoes, ...tabelas]) {
      const t = c.linhas()
      zip.file(`${c.nome}.csv`, gerarCsv(t.cabecalho, t.linhas))
    }
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transporte_escolar_${hoje}.zip`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const Lista = ({ itens }: { itens: Conjunto[] }) => (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {itens.map((c) => (
        <li key={c.nome} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span>
            <span className="font-mono text-xs text-marca-700">{c.nome}</span>
            <span className="block text-slate-600">{c.descricao}</span>
          </span>
          <Botao variante="fantasma" onClick={() => baixar(c)}><Download size={16} /> CSV</Botao>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Exportação (Excel / Power BI)</h1>
          <p className="mt-1 text-sm text-slate-600">
            CSV com separador “;” e acentos corretos no Excel. Você exporta só o que seu perfil pode ver. Dados de saúde e do responsável legal não são exportados (LGPD).
          </p>
        </div>
        <Botao onClick={baixarTudo}><FileArchive size={16} /> Baixar tudo (ZIP)</Botao>
      </div>
      <div className="rounded-md bg-marca-50 px-3 py-2 text-xs text-marca-900">
        Para o Power BI: use as <strong>visões</strong> (já calculadas) como tabelas-fato e as <strong>tabelas</strong> como dimensões, relacionando pelos campos <span className="font-mono">id</span> / <span className="font-mono">*_id</span>. Com o banco conectado, o Power BI lerá as mesmas visões direto do PostgreSQL.
      </div>
      <h2 className="text-base font-semibold text-slate-900">Visões calculadas</h2>
      <Lista itens={visoes} />
      <h2 className="text-base font-semibold text-slate-900">Tabelas</h2>
      <Lista itens={tabelas} />
    </div>
  )
}
