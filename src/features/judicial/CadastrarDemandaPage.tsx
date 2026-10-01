// "Cadastrar demanda de transporte": primeira tela de Contratações. Responde quem deve ser
// atendido, por quê, onde, como e até quando — a partir de um ofício de intimação.

import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { ErroPermissao, ErroRegra, ErroValidacao } from '@/lib/dados/repositorio'
import { abrirDemandaTransporte, feriadosDe } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { prazoDaEtapa } from '@/lib/fluxo/sla'
import { formatarCpfCnpj, formatarData } from '@/lib/formatacao'
import { calcularPrioridade, ROTULO_PRIORIDADE, TIPOS_DETERMINACAO, type AlunoAbertura } from '@/lib/judicial/abertura'
import { origemDoOrgao } from '@/lib/judicial/oficios'
import { ehCentral } from '@/lib/permissoes'
import { ORGAOS_OFICIO } from './configuracoes'

type Dados = Partial<Record<Colecao, Registro[]>>

const COR_PRIORIDADE = { urgente: 'bg-red-100 text-red-800', alta: 'bg-amber-100 text-amber-800', normal: 'bg-slate-100 text-slate-700' }

interface AlunoForm {
  modo: 'cadastro' | 'novo'
  aluno_id: string
  nome: string
  cod_simade: string
  cpf: string
  data_nascimento: string
}

const alunoVazio = (): AlunoForm => ({ modo: 'cadastro', aluno_id: '', nome: '', cod_simade: '', cpf: '', data_nascimento: '' })

function Bloco({ numero, titulo, pergunta, children }: { numero: number; titulo: string; pergunta: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
      <h2 className="font-semibold text-slate-900">{numero}. {titulo}</h2>
      <p className="mb-3 text-xs text-slate-500">{pergunta}</p>
      {children}
    </section>
  )
}

function Campo({ rotulo, obrig, erro, children, largo, auto }: { rotulo: string; obrig?: boolean; erro?: string; children: ReactNode; largo?: boolean; auto?: boolean }) {
  return (
    <label className={`block ${largo ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
      <span className="text-xs text-slate-600">
        {rotulo}
        {obrig && <span className="text-red-600"> *</span>}
        {auto && <span className="ml-1 rounded bg-slate-100 px-1 text-[10px] text-slate-500 uppercase">automático</span>}
      </span>
      <div className="mt-1">{children}</div>
      {erro && <span className="mt-0.5 block text-xs text-red-600">{erro}</span>}
    </label>
  )
}

const Auto = ({ valor }: { valor: ReactNode }) => <div className="campo bg-slate-50 text-slate-700">{valor || '—'}</div>

export function CadastrarDemandaPage() {
  const { dados, carregando, recarregar } = useTodos()
  const usuario = useUsuario()
  const [params, setParams] = useSearchParams()
  const oficioId = params.get('oficio') ?? ''
  if (carregando) return null
  const lista = (c: Colecao) => dados[c] ?? []
  const pendentes = lista('oficios').filter((o) => o.tipo === 'intimacao_cumprimento' && !o.demanda_id).sort((a, b) => String(a.prazo_resposta).localeCompare(String(b.prazo_resposta)))
  const oficio = pendentes.find((o) => o.id === oficioId)
  const codigo = (o: Registro) => String(lista('processos').find((p) => p.id === o.processo_id)?.codigo ?? '')

  return (
    <div className="space-y-4">
      <div>
        <Link to="/judicial/novo" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700">
          <ArrowLeft size={16} /> Demandas de transporte
        </Link>
        <h1 className="text-xl font-semibold text-slate-900">Cadastrar demanda de transporte</h1>
        <p className="mt-1 text-sm text-slate-600">
          Com o que vem no ofício: <strong>por quê</strong>, <strong>onde</strong>, <strong>quem</strong> e <strong>até quando</strong>. O <strong>como</strong> (necessidade de transporte de cada aluno) é completado pela SRE/escola no Detalhamento da demanda.
        </p>
      </div>

      {!ehCentral(usuario) ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">O cadastro da demanda é feito pelo órgão central.</p>
      ) : pendentes.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Nenhum ofício de intimação aguardando cadastro. Cadastre o ofício primeiro em <Link to="/oficios" className="text-marca-700 hover:underline">Ofícios</Link>.
        </p>
      ) : (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
            <Campo rotulo="Ofício de intimação" obrig>
              <select className="campo" value={oficioId} onChange={(e) => setParams(e.target.value ? { oficio: e.target.value } : {})}>
                <option value="">Escolha o ofício…</option>
                {pendentes.map((o) => (
                  <option key={o.id} value={o.id}>
                    {codigo(o)} · nº {String(o.numero)} · {String(o.numero_processo_judicial ?? '')} · prazo {formatarData(o.prazo_resposta)}
                  </option>
                ))}
              </select>
            </Campo>
          </section>
          {oficio && <FormularioDemanda key={String(oficio.id)} oficio={oficio} dados={dados} aoCriar={recarregar} />}
        </>
      )}
    </div>
  )
}

function FormularioDemanda({ oficio, dados, aoCriar }: { oficio: Registro; dados: Dados; aoCriar: () => Promise<void> }) {
  const usuario = useUsuario()
  const navegar = useNavigate()
  const hoje = hojeIso()
  const lista = (c: Colecao) => dados[c] ?? []
  const achar = (c: Colecao, id: unknown) => lista(c).find((r) => r.id === id)
  const feriados = feriadosDe(lista)
  const origem = origemDoOrgao(oficio.orgao_tipo)
  const escolaInicial = String(oficio.escola_id ?? '')

  const [f, setF] = useState({
    tipo_determinacao: origem === 'ministerio_publico' ? 'requisicao_mp' : '',
    data_ciencia: String(oficio.data_recebimento ?? ''),
    prazo_judicial: String(oficio.prazo_resposta ?? ''),
    multa_diaria: '',
    multa_valor_maximo: '',
    escola_id: escolaInicial,
    data_inicio_prevista: String(oficio.prazo_resposta ?? ''),
    data_termino_prevista: '',
    prazo_indeterminado: false,
    caixa_escolar_id: String(lista('caixas_escolares').find((c) => c.escola_id === escolaInicial)?.id ?? ''),
    responsavel_sre_id: '',
    responsavel_central_id: String(oficio.responsavel_id ?? usuario.id),
    prazo_devolucao_formulario: String(prazoDaEtapa(hoje, 10, feriados) ?? ''),
    decisao_resumo: String(oficio.assunto ?? ''),
    observacoes_internas: '',
  })
  const [alunos, setAlunos] = useState<AlunoForm[]>([alunoVazio()])
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const mudar = (campo: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [campo]: e.target.value })
  const escola = achar('escolas', f.escola_id)
  const municipio = achar('municipios', escola?.municipio_id)
  const sre = achar('sres', escola?.sre_id)
  const usuariosSre = lista('usuarios').filter((u) => u.ativo !== false && u.sre_id === escola?.sre_id).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  const usuariosCentral = lista('usuarios').filter((u) => u.ativo !== false && (u.papel === 'analista_central' || u.papel === 'admin'))
  const prioridade = calcularPrioridade({ tipo_determinacao: f.tipo_determinacao, prazo_judicial: f.prazo_judicial, multa_diaria: f.multa_diaria, origem }, hoje, feriados)
  const alunosCadastro = lista('alunos').filter((a) => a.ativo !== false).sort((a, b) => Number(b.escola_atual_id === f.escola_id) - Number(a.escola_atual_id === f.escola_id) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))

  function mudarEscola(id: string) {
    const novoSre = achar('escolas', id)?.sre_id
    setF({
      ...f,
      escola_id: id,
      caixa_escolar_id: String(lista('caixas_escolares').find((c) => c.escola_id === id)?.id ?? ''),
      responsavel_sre_id: achar('usuarios', f.responsavel_sre_id)?.sre_id === novoSre ? f.responsavel_sre_id : '',
    })
  }
  const mudarAluno = (i: number, campos: Partial<AlunoForm>) => setAlunos(alunos.map((a, j) => (j === i ? { ...a, ...campos } : a)))

  async function cadastrar() {
    setErros({})
    setSalvando(true)
    const num = (v: string) => (v === '' ? null : Number(v))
    const alunosAbertura: AlunoAbertura[] = alunos.map((a) =>
      a.modo === 'cadastro' ? { aluno_id: a.aluno_id || undefined } : { novo: { nome: a.nome.trim(), cod_simade: a.cod_simade.trim(), cpf: a.cpf.trim() || undefined, data_nascimento: a.data_nascimento } },
    )
    try {
      const dem = await abrirDemandaTransporte(usuario, String(oficio.id), {
        ...f,
        multa_diaria: num(f.multa_diaria),
        multa_valor_maximo: num(f.multa_valor_maximo),
        data_termino_prevista: f.prazo_indeterminado ? null : f.data_termino_prevista || null,
        responsavel_central_id: f.responsavel_central_id || null,
        alunos: alunosAbertura,
      })
      await aoCriar()
      navegar(`/judicial/${dem.id}`)
    } catch (e) {
      if (e instanceof ErroValidacao) setErros(e.erros)
      else if (e instanceof ErroRegra || e instanceof ErroPermissao) setErros({ _geral: e.message })
      else throw e
    } finally {
      setSalvando(false)
    }
  }

  const grade = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="space-y-4">
      <Bloco numero={1} titulo="Origem da demanda" pergunta="Por que deve ser atendido?">
        <div className={grade}>
          <Campo rotulo="Nº do processo judicial" auto><Auto valor={String(oficio.numero_processo_judicial ?? '')} /></Campo>
          <Campo rotulo="Comarca / vara" auto><Auto valor={`${String(oficio.comarca ?? '')}${oficio.orgao_nome ? ` · ${oficio.orgao_nome}` : ''}`} /></Campo>
          <Campo rotulo="Órgão demandante" auto><Auto valor={ORGAOS_OFICIO.find((o) => o.valor === oficio.orgao_tipo)?.rotulo} /></Campo>
          <Campo rotulo="Data de recebimento" auto><Auto valor={formatarData(oficio.data_recebimento)} /></Campo>
          <Campo rotulo="Tipo de determinação" obrig erro={erros.tipo_determinacao}>
            <select className="campo" value={f.tipo_determinacao} onChange={mudar('tipo_determinacao')}>
              <option value="">Escolha…</option>
              {Object.entries(TIPOS_DETERMINACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data da ciência / intimação" obrig erro={erros.data_ciencia}>
            <input className="campo" type="date" max={String(oficio.data_recebimento ?? '')} value={f.data_ciencia} onChange={mudar('data_ciencia')} />
          </Campo>
          <Campo rotulo="Prazo para cumprimento" obrig erro={erros.prazo_judicial}>
            <input className="campo" type="date" value={f.prazo_judicial} onChange={mudar('prazo_judicial')} />
          </Campo>
          <Campo rotulo="Multa diária (R$)" erro={erros.multa_diaria}>
            <input className="campo" type="number" min="0" step="0.01" value={f.multa_diaria} onChange={mudar('multa_diaria')} placeholder="Se houver" />
          </Campo>
          <Campo rotulo="Valor máximo da multa (R$)" erro={erros.multa_valor_maximo}>
            <input className="campo" type="number" min="0" step="0.01" value={f.multa_valor_maximo} onChange={mudar('multa_valor_maximo')} placeholder="Se previsto" disabled={!f.multa_diaria} />
          </Campo>
        </div>
      </Bloco>

      <Bloco numero={2} titulo="Escola" pergunta="Onde o aluno estuda?">
        <div className={grade}>
          <Campo rotulo="Escola estadual" obrig erro={erros.escola_id}>
            <select className="campo" value={f.escola_id} onChange={(e) => mudarEscola(e.target.value)}>
              <option value="">Escolha…</option>
              {lista('escolas').filter((e) => e.ativo !== false).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR')).map((e) => <option key={e.id} value={e.id}>{String(e.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="SRE" auto><Auto valor={sre ? `${sre.sigla} — ${sre.nome}` : ''} /></Campo>
          <Campo rotulo="Município" auto><Auto valor={String(municipio?.nome ?? '')} /></Campo>
          <Campo rotulo="Endereço da escola" auto largo><Auto valor={String(escola?.endereco ?? '')} /></Campo>
        </div>
      </Bloco>

      <Bloco numero={3} titulo="Alunos" pergunta="Quem deve ser atendido?">
        <p className="mb-3 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-900">Turno, horários, endereço de origem, frequência e condições do transporte são informados pela SRE/escola na etapa <strong>Detalhamento da demanda</strong>.</p>
        {erros.alunos && <p className="mb-2 text-xs text-red-600">{erros.alunos}</p>}
        <div className="space-y-4">
          {alunos.map((a, i) => {
            const e = (c: string) => erros[`alunos.${i}.${c}`]
            const doCadastro = achar('alunos', a.aluno_id)
            return (
              <div key={i} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-medium text-slate-800">Aluno {i + 1}</p>
                  {alunos.length > 1 && (
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600" onClick={() => setAlunos(alunos.filter((_, j) => j !== i))}>
                      <Trash2 size={14} /> Retirar
                    </button>
                  )}
                </div>

                <div className={grade}>
                  <Campo rotulo="Aluno" obrig erro={e('nome')}>
                    <select
                      className="campo"
                      value={a.modo === 'novo' ? '__novo__' : a.aluno_id}
                      onChange={(ev) => {
                        const v = ev.target.value
                        if (v === '__novo__') mudarAluno(i, { modo: 'novo', aluno_id: '' })
                        else mudarAluno(i, { modo: 'cadastro', aluno_id: v })
                      }}
                    >
                      <option value="">Buscar no cadastro…</option>
                      <option value="__novo__">+ Aluno ainda não cadastrado</option>
                      {alunosCadastro.map((al) => (
                        <option key={al.id} value={al.id}>
                          {String(al.nome)} — SIMADE {String(al.cod_simade)}{al.escola_atual_id === f.escola_id ? '' : ` (${String(achar('escolas', al.escola_atual_id)?.nome ?? 'outra escola')})`}
                        </option>
                      ))}
                    </select>
                  </Campo>
                  {a.modo === 'novo' ? (
                    <>
                      <Campo rotulo="Nome completo" obrig erro={e('nome')}><input className="campo" value={a.nome} onChange={(ev) => mudarAluno(i, { nome: ev.target.value })} /></Campo>
                      <Campo rotulo="Código / matrícula SIMADE" obrig erro={e('cod_simade')}><input className="campo" value={a.cod_simade} onChange={(ev) => mudarAluno(i, { cod_simade: ev.target.value })} /></Campo>
                      <Campo rotulo="Data de nascimento" obrig erro={e('data_nascimento')}><input className="campo" type="date" max={hoje} value={a.data_nascimento} onChange={(ev) => mudarAluno(i, { data_nascimento: ev.target.value })} /></Campo>
                      <Campo rotulo="CPF (se disponível)" erro={e('cpf')}><input className="campo" value={a.cpf} onChange={(ev) => mudarAluno(i, { cpf: ev.target.value })} /></Campo>
                    </>
                  ) : doCadastro ? (
                    <>
                      <Campo rotulo="Código SIMADE" auto><Auto valor={String(doCadastro.cod_simade)} /></Campo>
                      <Campo rotulo="Data de nascimento" auto><Auto valor={formatarData(doCadastro.data_nascimento)} /></Campo>
                      <Campo rotulo="CPF" auto><Auto valor={doCadastro.cpf ? formatarCpfCnpj(doCadastro.cpf) : 'virá com a documentação'} /></Campo>
                    </>
                  ) : null}
                </div>

              </div>
            )
          })}
        </div>
        <Botao variante="secundario" className="mt-3" onClick={() => setAlunos([...alunos, alunoVazio()])}><Plus size={16} /> Adicionar aluno</Botao>
      </Bloco>

      <Bloco numero={4} titulo="Período do atendimento" pergunta="Até quando?">
        <div className={grade}>
          <Campo rotulo="Data prevista de início" obrig erro={erros.data_inicio_prevista}>
            <input className="campo" type="date" value={f.data_inicio_prevista} onChange={mudar('data_inicio_prevista')} />
          </Campo>
          <Campo rotulo="Data prevista de término" obrig={!f.prazo_indeterminado} erro={erros.data_termino_prevista}>
            <input className="campo" type="date" value={f.data_termino_prevista} disabled={f.prazo_indeterminado} onChange={mudar('data_termino_prevista')} />
          </Campo>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={f.prazo_indeterminado} onChange={(e) => setF({ ...f, prazo_indeterminado: e.target.checked, data_termino_prevista: e.target.checked ? '' : f.data_termino_prevista })} />
            Por prazo indeterminado
          </label>
        </div>
      </Bloco>

      <Bloco numero={5} titulo="Gestão interna" pergunta="Quem acompanha e com que prioridade?">
        <div className={grade}>
          <Campo rotulo="Caixa Escolar / unidade executora" obrig erro={erros.caixa_escolar_id}>
            <select className="campo" value={f.caixa_escolar_id} onChange={mudar('caixa_escolar_id')}>
              <option value="">Escolha…</option>
              {lista('caixas_escolares').filter((c) => !f.escola_id || c.escola_id === f.escola_id).map((c) => <option key={c.id} value={c.id}>{String(c.razao_social)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Responsável pelo acompanhamento na SRE" obrig erro={erros.responsavel_sre_id}>
            <select className="campo" value={f.responsavel_sre_id} onChange={mudar('responsavel_sre_id')} disabled={!escola}>
              <option value="">{escola ? 'Escolha…' : 'Escolha a escola primeiro'}</option>
              {usuariosSre.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Responsável no órgão central" erro={erros.responsavel_central_id}>
            <select className="campo" value={f.responsavel_central_id} onChange={mudar('responsavel_central_id')}>
              <option value="">—</option>
              {usuariosCentral.map((u) => <option key={u.id} value={u.id}>{String(u.nome)}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Data limite para devolver o formulário" obrig erro={erros.prazo_devolucao_formulario}>
            <input className="campo" type="date" value={f.prazo_devolucao_formulario} onChange={mudar('prazo_devolucao_formulario')} />
          </Campo>
          <Campo rotulo="Prioridade" auto>
            <div className="flex items-center gap-2 py-1.5">
              <span className={`rounded px-2 py-0.5 text-xs font-semibold ${COR_PRIORIDADE[prioridade]}`}>{ROTULO_PRIORIDADE[prioridade]}</span>
              <span className="text-xs text-slate-500">liminar/tutela, prazo ≤ 5 dias úteis ou multa = urgente; judicial = alta</span>
            </div>
          </Campo>
          <Campo rotulo="Resumo da determinação" obrig erro={erros.decisao_resumo} largo>
            <textarea className="campo" rows={2} value={f.decisao_resumo} onChange={mudar('decisao_resumo')} />
          </Campo>
          <Campo rotulo="Observações internas" largo>
            <textarea className="campo" rows={2} value={f.observacoes_internas} onChange={mudar('observacoes_internas')} placeholder="Não fazem parte do resumo judicial" />
          </Campo>
        </div>
      </Bloco>

      {erros._geral && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erros._geral}</p>}
      <div className="flex justify-end gap-2">
        <Link to="/judicial/novo" className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</Link>
        <Botao disabled={salvando} onClick={cadastrar}>Cadastrar demanda de transporte</Botao>
      </div>
    </div>
  )
}
