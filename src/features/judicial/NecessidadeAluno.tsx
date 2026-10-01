// Detalhamento da demanda: necessidade de transporte de cada aluno (informação que a SRE/escola tem).
// Grava no formulário de caracterização, na saúde e no responsável legal.

import { Pencil, Save } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { ErroPermissao, ErroRegra, ErroValidacao } from '@/lib/dados/repositorio'
import { salvarNecessidadeTransporte } from '@/lib/dados/servicos'
import type { Registro } from '@/lib/dados/tipos'
import { SENTIDOS_VIAGEM, type NecessidadeTransporte } from '@/lib/judicial/abertura'

const TURNOS: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', integral: 'Integral' }
const DIAS: Record<string, string> = { seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb' }

interface Props {
  caracterizacao: Registro
  saude?: Registro
  responsavel?: Registro
  destino: string
  podeEditar: boolean
  aoSalvar: () => Promise<void> | void
}

function Campo({ rotulo, obrig, erro, children, largo }: { rotulo: string; obrig?: boolean; erro?: string; children: ReactNode; largo?: boolean }) {
  return (
    <label className={`block ${largo ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <span className="text-xs text-slate-600">{rotulo}{obrig && <span className="text-red-600"> *</span>}</span>
      <div className="mt-1">{children}</div>
      {erro && <span className="mt-0.5 block text-xs text-red-600">{erro}</span>}
    </label>
  )
}

function SimNao({ valor, aoMudar }: { valor: boolean | null; aoMudar: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((v) => (
        <button key={String(v)} type="button" onClick={() => aoMudar(v)}
          className={`rounded-md border px-3 py-1.5 text-sm ${valor === v ? 'border-marca-600 bg-marca-50 font-medium text-marca-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {v ? 'Sim' : 'Não'}
        </button>
      ))}
    </div>
  )
}

/** Valores atuais (a partir do que já está gravado no formulário de caracterização). */
function valoresIniciais(car: Registro, saude?: Registro, resp?: Registro): NecessidadeTransporte {
  const requisitos = (Array.isArray(car.requisitos) ? car.requisitos : []) as string[]
  const preenchido = Boolean(car.turno || car.endereco_residencia)
  return {
    responsavel_nome: String(resp?.nome ?? ''),
    turno: String(car.turno ?? ''),
    endereco_origem: String(car.endereco_residencia ?? ''),
    dias_semana: Array.isArray(car.dias_semana) ? (car.dias_semana as string[]) : ['seg', 'ter', 'qua', 'qui', 'sex'],
    viagem: String(car.sentido_viagem ?? 'ida_volta'),
    horario_entrada: String(car.horario_entrada ?? ''),
    horario_saida: String(car.horario_saida ?? ''),
    veiculo_acessivel: saude ? Boolean(saude.pcd_mobilidade_reduzida || requisitos.includes('veiculo_acessivel')) : preenchido ? false : null,
    cadeira_rodas: Boolean(saude?.dispositivo_mobilidade && saude.dispositivo_mobilidade !== 'nenhum'),
    acompanhante: saude ? Boolean(saude.necessita_acompanhante) : preenchido ? false : null,
    outras_condicoes: String(car.condicoes_transporte ?? ''),
  }
}

/** A necessidade já foi informada? (para o resumo e para saber se abre em modo edição) */
export const necessidadePreenchida = (car: Registro, resp?: Registro) => Boolean(car.turno && car.endereco_residencia && car.horario_entrada && resp?.nome)

export function NecessidadeAluno({ caracterizacao, saude, responsavel, destino, podeEditar, aoSalvar }: Props) {
  const usuario = useUsuario()
  const preenchida = necessidadePreenchida(caracterizacao, responsavel)
  const travada = caracterizacao.status === 'aprovada'
  const [editando, setEditando] = useState(!preenchida && podeEditar && !travada)
  const [n, setN] = useState<NecessidadeTransporte>(() => valoresIniciais(caracterizacao, saude, responsavel))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const mudar = (campos: Partial<NecessidadeTransporte>) => setN({ ...n, ...campos })

  async function salvar() {
    setErros({})
    setSalvando(true)
    try {
      await salvarNecessidadeTransporte(usuario, String(caracterizacao.id), { ...n, cadeira_rodas: n.veiculo_acessivel ? n.cadeira_rodas : false })
      setEditando(false)
      await aoSalvar()
    } catch (e) {
      if (e instanceof ErroValidacao) setErros(e.erros)
      else if (e instanceof ErroRegra || e instanceof ErroPermissao) setErros({ _geral: e.message })
      else throw e
    } finally {
      setSalvando(false)
    }
  }

  if (!editando) {
    const v = valoresIniciais(caracterizacao, saude, responsavel)
    return (
      <div className="text-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-500 uppercase">Necessidade de transporte</p>
          {podeEditar && !travada && (
            <button type="button" className="inline-flex items-center gap-1 text-xs text-marca-700 hover:underline" onClick={() => setEditando(true)}>
              <Pencil size={12} /> {preenchida ? 'Alterar' : 'Preencher'}
            </button>
          )}
        </div>
        {preenchida ? (
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-xs text-slate-500">Responsável legal</dt><dd>{v.responsavel_nome}</dd></div>
            <div><dt className="text-xs text-slate-500">Turno / horários</dt><dd>{TURNOS[v.turno] ?? v.turno} · {v.horario_entrada}–{v.horario_saida}</dd></div>
            <div><dt className="text-xs text-slate-500">Frequência / viagem</dt><dd>{v.dias_semana.map((x) => DIAS[x] ?? x).join(', ')} · {SENTIDOS_VIAGEM[v.viagem] ?? v.viagem}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-slate-500">Origem → destino</dt><dd>{v.endereco_origem} → {destino}</dd></div>
            <div><dt className="text-xs text-slate-500">Condições</dt><dd>{[v.veiculo_acessivel && 'veículo acessível', v.cadeira_rodas && 'cadeira de rodas', v.acompanhante && 'acompanhante/monitor'].filter(Boolean).join(', ') || 'sem condição especial'}</dd></div>
            {v.outras_condicoes && <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-slate-500">Outras condições</dt><dd>{v.outras_condicoes}</dd></div>}
          </dl>
        ) : (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Ainda não informada pela SRE/escola.</p>
        )}
      </div>
    )
  }

  const grade = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase">Necessidade de transporte</p>
      <div className={grade}>
        <Campo rotulo="Responsável legal" obrig erro={erros.responsavel_nome}>
          <input className="campo" value={n.responsavel_nome} onChange={(e) => mudar({ responsavel_nome: e.target.value })} placeholder="Nome (contato na etapa documental)" />
        </Campo>
        <Campo rotulo="Turno" obrig erro={erros.turno}>
          <select className="campo" value={n.turno} onChange={(e) => mudar({ turno: e.target.value })}>
            <option value="">Escolha…</option>
            {Object.entries(TURNOS).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Entrada" obrig erro={erros.horario_entrada}><input className="campo" type="time" value={n.horario_entrada} onChange={(e) => mudar({ horario_entrada: e.target.value })} /></Campo>
          <Campo rotulo="Saída" obrig erro={erros.horario_saida}><input className="campo" type="time" value={n.horario_saida} onChange={(e) => mudar({ horario_saida: e.target.value })} /></Campo>
        </div>
        <Campo rotulo="Endereço de origem do aluno" obrig erro={erros.endereco_origem} largo>
          <input className="campo" value={n.endereco_origem} onChange={(e) => mudar({ endereco_origem: e.target.value })} placeholder="Rua, nº, comunidade, distrito, CEP" />
        </Campo>
        <Campo rotulo="Destino">
          <div className="campo bg-slate-50 text-slate-700">{destino || '—'}</div>
        </Campo>
        <Campo rotulo="Frequência" obrig erro={erros.dias_semana}>
          <div className="flex flex-wrap gap-1">
            {Object.entries(DIAS).map(([k, r]) => {
              const marcado = n.dias_semana.includes(k)
              return (
                <button key={k} type="button" onClick={() => mudar({ dias_semana: marcado ? n.dias_semana.filter((x) => x !== k) : [...n.dias_semana, k] })}
                  className={`rounded border px-2 py-1 text-xs ${marcado ? 'border-marca-600 bg-marca-50 text-marca-800' : 'border-slate-300 text-slate-600'}`}>
                  {r}
                </button>
              )
            })}
          </div>
        </Campo>
        <Campo rotulo="Viagem" obrig erro={erros.viagem}>
          <select className="campo" value={n.viagem} onChange={(e) => mudar({ viagem: e.target.value })}>
            {Object.entries(SENTIDOS_VIAGEM).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Necessita veículo acessível?" obrig erro={erros.veiculo_acessivel}>
          <SimNao valor={n.veiculo_acessivel} aoMudar={(v) => mudar({ veiculo_acessivel: v, cadeira_rodas: v ? n.cadeira_rodas : false })} />
        </Campo>
        {n.veiculo_acessivel && (
          <Campo rotulo="Utiliza cadeira de rodas?">
            <SimNao valor={Boolean(n.cadeira_rodas)} aoMudar={(v) => mudar({ cadeira_rodas: v })} />
          </Campo>
        )}
        <Campo rotulo="Necessita acompanhante / monitor?" obrig erro={erros.acompanhante}>
          <SimNao valor={n.acompanhante} aoMudar={(v) => mudar({ acompanhante: v })} />
        </Campo>
        <Campo rotulo="Outras condições do transporte" largo>
          <input className="campo" maxLength={200} value={n.outras_condicoes} onChange={(e) => mudar({ outras_condicoes: e.target.value })} placeholder="Ex.: estrada de terra, travessia de rio" />
        </Campo>
      </div>
      {erros._geral && <p className="rounded-md bg-red-50 px-3 py-2 text-red-700">{erros._geral}</p>}
      <div className="flex justify-end gap-2">
        {preenchida && <Botao variante="secundario" onClick={() => { setN(valoresIniciais(caracterizacao, saude, responsavel)); setErros({}); setEditando(false) }}>Cancelar</Botao>}
        <Botao disabled={salvando} onClick={salvar}><Save size={16} /> Salvar necessidade</Botao>
      </div>
    </div>
  )
}
