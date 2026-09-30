// Auditoria (Fase 7): log de alterações (quem, quando, antes/depois) e log de acessos
// a documentos e dados pessoais sensíveis (LGPD). O registro acontece desde a Fase 1.

import { ChevronDown, ChevronRight, Download } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Abas } from '@/components/comum/Abas'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { valorExibido } from '@/features/cadastros/exibicao'
import { CONFIGURACOES } from '@/features/configuracoes'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { listarAcessos, listarAuditoria } from '@/lib/dados/repositorio'
import type { Colecao, EntradaAcesso, EntradaAuditoria, Registro } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { formatarDataHora } from '@/lib/formatacao'
import { podeVerAuditoria } from '@/lib/permissoes'

const OPERACAO = { INSERT: 'Inclusão', UPDATE: 'Alteração', DELETE: 'Exclusão' }
const ACAO: Record<EntradaAcesso['acao'], string> = { visualizar: 'Visualização', baixar: 'Download', zip: 'Download em lote', dados_sensiveis: 'Dados sensíveis' }
const META = ['id', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']

const rotuloCampo = (colecao: Colecao, campo: string) => CONFIGURACOES[colecao].campos.find((c) => c.nome === campo)?.rotulo ?? campo

function diferencas(e: EntradaAuditoria) {
  const campos = new Set([...Object.keys(e.antes ?? {}), ...Object.keys(e.depois ?? {})])
  return [...campos]
    .filter((c) => !META.includes(c))
    .map((c) => ({ campo: c, antes: e.antes?.[c] ?? null, depois: e.depois?.[c] ?? null }))
    .filter((d) => JSON.stringify(d.antes) !== JSON.stringify(d.depois))
}

export function AuditoriaPage() {
  const usuario = useUsuario()
  const { dados } = useTodos()
  const [aba, setAba] = useState<'alteracoes' | 'acessos'>('alteracoes')
  const [entradas, setEntradas] = useState<EntradaAuditoria[]>([])
  const [acessos, setAcessos] = useState<EntradaAcesso[]>([])
  const [aberta, setAberta] = useState<string | null>(null)
  const [f, setF] = useState({ colecao: '', usuario: '', operacao: '', de: '', ate: '', registro: '' })

  useEffect(() => {
    if (!podeVerAuditoria(usuario)) return
    void listarAuditoria(usuario).then(setEntradas)
    void listarAcessos(usuario).then(setAcessos)
  }, [usuario])

  const exibir = (colecao: Colecao, campo: string, valor: unknown) => {
    const config = CONFIGURACOES[colecao].campos.find((c) => c.nome === campo)
    const t = config ? valorExibido(config, { [campo]: valor } as unknown as Registro, dados) : Array.isArray(valor) ? valor.join(', ') : valor === null || valor === undefined ? '' : String(valor)
    return t || '—'
  }

  const noPeriodo = (em: string) => (!f.de || em.slice(0, 10) >= f.de) && (!f.ate || em.slice(0, 10) <= f.ate)
  const filtradas = useMemo(() => {
    const periodo = (em: string) => (!f.de || em.slice(0, 10) >= f.de) && (!f.ate || em.slice(0, 10) <= f.ate)
    return entradas.filter(
      (e) => (!f.colecao || e.colecao === f.colecao) && (!f.usuario || e.usuario_id === f.usuario) && (!f.operacao || e.operacao === f.operacao) && periodo(e.em) && (!f.registro || e.registro_id.includes(f.registro)),
    )
  }, [entradas, f])
  const acessosFiltrados = acessos.filter((a) => (!f.usuario || a.usuario_id === f.usuario) && noPeriodo(a.em))
  const usuarios = [...new Map([...entradas, ...acessos].map((e) => [e.usuario_id, e.usuario_nome])).entries()]
  const codigo = (processoId: string | null) => String(dados.processos?.find((p) => p.id === processoId)?.codigo ?? '')

  if (!podeVerAuditoria(usuario)) return <Navigate to="/" replace />

  function exportar() {
    if (aba === 'alteracoes')
      baixarArquivo(
        `auditoria_${hojeIso()}.csv`,
        gerarCsv(
          ['Data/hora', 'Usuário', 'Operação', 'Tabela', 'Registro', 'Campo', 'Antes', 'Depois'],
          filtradas.flatMap((e) => diferencas(e).map((d) => [e.em, e.usuario_nome, OPERACAO[e.operacao], CONFIGURACOES[e.colecao].titulo, e.registro_id, rotuloCampo(e.colecao, d.campo), exibir(e.colecao, d.campo, d.antes), exibir(e.colecao, d.campo, d.depois)])),
        ),
      )
    else baixarArquivo(`acessos_${hojeIso()}.csv`, gerarCsv(['Data/hora', 'Usuário', 'Ação', 'Processo', 'Descrição'], acessosFiltrados.map((a) => [a.em, a.usuario_nome, ACAO[a.acao], codigo(a.processo_id), a.descricao])))
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Auditoria</h1>
          <p className="mt-1 text-sm text-slate-600">Alterações com usuário, data/hora e valores antes/depois; e quem visualizou ou baixou documentos e dados sensíveis (LGPD). Os registros não podem ser editados.</p>
        </div>
        <Botao variante="secundario" onClick={exportar}><Download size={16} /> Exportar CSV</Botao>
      </div>

      <Abas abas={[{ id: 'alteracoes', rotulo: 'Alterações', qtd: filtradas.length }, { id: 'acessos', rotulo: 'Acessos (LGPD)', qtd: acessosFiltrados.length }]} ativa={aba} aoMudar={setAba} />

      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {aba === 'alteracoes' && (
          <select className="campo" value={f.colecao} onChange={(e) => setF({ ...f, colecao: e.target.value })} aria-label="Tabela">
            <option value="">Todas as tabelas</option>
            {Object.values(CONFIGURACOES).sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR')).map((c) => <option key={c.colecao} value={c.colecao}>{c.titulo}</option>)}
          </select>
        )}
        <select className="campo" value={f.usuario} onChange={(e) => setF({ ...f, usuario: e.target.value })} aria-label="Usuário">
          <option value="">Todos os usuários</option>
          {usuarios.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
        </select>
        {aba === 'alteracoes' && (
          <select className="campo" value={f.operacao} onChange={(e) => setF({ ...f, operacao: e.target.value })} aria-label="Operação">
            <option value="">Todas as operações</option>
            {Object.entries(OPERACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <input type="date" className="campo" value={f.de} onChange={(e) => setF({ ...f, de: e.target.value })} aria-label="De" title="De" />
        <input type="date" className="campo" value={f.ate} onChange={(e) => setF({ ...f, ate: e.target.value })} aria-label="Até" title="Até" />
        {aba === 'alteracoes' && <input className="campo" placeholder="ID do registro" value={f.registro} onChange={(e) => setF({ ...f, registro: e.target.value })} aria-label="ID do registro" />}
      </div>

      {aba === 'alteracoes' ? (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
              <tr>
                <th className="w-8" />
                <th className="px-3 py-2 font-medium">Data/hora</th>
                <th className="px-3 py-2 font-medium">Usuário</th>
                <th className="px-3 py-2 font-medium">Operação</th>
                <th className="px-3 py-2 font-medium">Tabela</th>
                <th className="px-3 py-2 font-medium">Campos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.slice(0, 500).map((e) => {
                const difs = diferencas(e)
                const expandida = aberta === e.id
                return (
                  <Fragment key={e.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setAberta(expandida ? null : e.id)}>
                      <td className="pl-3 text-slate-400">{expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatarDataHora(e.em)}</td>
                      <td className="px-3 py-2">{e.usuario_nome}</td>
                      <td className="px-3 py-2">{OPERACAO[e.operacao]}</td>
                      <td className="px-3 py-2">{CONFIGURACOES[e.colecao].titulo}</td>
                      <td className="max-w-md truncate px-3 py-2 text-slate-600">{difs.map((d) => rotuloCampo(e.colecao, d.campo)).join(', ')}</td>
                    </tr>
                    {expandida && (
                      <tr className="bg-slate-50">
                        <td />
                        <td colSpan={5} className="px-3 py-3">
                          <p className="mb-1 font-mono text-xs text-slate-500">registro {e.registro_id}</p>
                          <table className="text-xs">
                            <thead className="text-slate-500"><tr><th className="pr-6 text-left font-medium">Campo</th><th className="pr-6 text-left font-medium">Antes</th><th className="text-left font-medium">Depois</th></tr></thead>
                            <tbody>
                              {difs.map((d) => (
                                <tr key={d.campo}>
                                  <td className="py-0.5 pr-6 font-medium">{rotuloCampo(e.colecao, d.campo)}</td>
                                  <td className="py-0.5 pr-6 text-red-700">{exibir(e.colecao, d.campo, d.antes)}</td>
                                  <td className="py-0.5 text-green-700">{exibir(e.colecao, d.campo, d.depois)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma alteração encontrada.</p>}
          {filtradas.length > 500 && <p className="px-3 py-2 text-xs text-slate-500">Mostrando as 500 mais recentes — use os filtros ou exporte o CSV.</p>}
        </div>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
              <tr><th className="px-3 py-2 font-medium">Data/hora</th><th className="px-3 py-2 font-medium">Usuário</th><th className="px-3 py-2 font-medium">Ação</th><th className="px-3 py-2 font-medium">Processo</th><th className="px-3 py-2 font-medium">Descrição</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {acessosFiltrados.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 whitespace-nowrap">{formatarDataHora(a.em)}</td>
                  <td className="px-3 py-2">{a.usuario_nome}</td>
                  <td className={`px-3 py-2 ${a.acao === 'dados_sensiveis' ? 'font-medium text-amber-700' : ''}`}>{ACAO[a.acao]}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{codigo(a.processo_id)}</td>
                  <td className="px-3 py-2">{a.descricao}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {acessosFiltrados.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum acesso registrado.</p>}
        </div>
      )}
    </div>
  )
}
