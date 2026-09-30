// Consulta simples do log de auditoria. A tela completa (filtros por período,
// usuário, registro) fica para a Fase 7; o registro já acontece desde a Fase 1.

import { ChevronDown, ChevronRight } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useUsuario } from '@/features/auth/Sessao'
import { CADASTROS } from '@/features/cadastros/configuracoes'
import { valorExibido } from '@/features/cadastros/exibicao'
import { listarAuditoria } from '@/lib/dados/repositorio'
import { COLECOES, type Colecao, type EntradaAuditoria, type Registro } from '@/lib/dados/tipos'
import { useColecoes } from '@/lib/dados/useColecao'
import { formatarDataHora } from '@/lib/formatacao'
import { podeVerAuditoria } from '@/lib/permissoes'

const OPERACAO = { INSERT: 'Inclusão', UPDATE: 'Alteração', DELETE: 'Exclusão' }
const META = ['id', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']

function rotuloCampo(colecao: Colecao, campo: string) {
  return CADASTROS[colecao].campos.find((c) => c.nome === campo)?.rotulo ?? campo
}

function diferencas(e: EntradaAuditoria) {
  const campos = new Set([...Object.keys(e.antes ?? {}), ...Object.keys(e.depois ?? {})])
  return [...campos]
    .filter((c) => !META.includes(c))
    .map((c) => ({ campo: c, antes: e.antes?.[c] ?? null, depois: e.depois?.[c] ?? null }))
    .filter((d) => d.antes !== d.depois)
}

const texto = (v: string) => v || '—'

export function AuditoriaPage() {
  const usuario = useUsuario()
  const [entradas, setEntradas] = useState<EntradaAuditoria[]>([])
  const [aberta, setAberta] = useState<string | null>(null)
  const [filtroColecao, setFiltroColecao] = useState('')
  const { dados: referencias } = useColecoes(COLECOES)

  /** Mostra o valor como na tela de cadastro (nome da escola em vez do id, "Sim" em vez de true…). */
  function exibir(colecao: Colecao, campo: string, valor: unknown) {
    const config = CADASTROS[colecao].campos.find((c) => c.nome === campo)
    if (!config) return texto(valor === null || valor === undefined ? '' : String(valor))
    return texto(valorExibido(config, { [campo]: valor } as unknown as Registro, referencias))
  }

  useEffect(() => {
    if (podeVerAuditoria(usuario)) void listarAuditoria(usuario).then(setEntradas)
  }, [usuario])

  const filtradas = useMemo(
    () => entradas.filter((e) => !filtroColecao || e.colecao === filtroColecao),
    [entradas, filtroColecao],
  )

  if (!podeVerAuditoria(usuario)) return <Navigate to="/" replace />

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Auditoria</h1>
      <p className="mt-1 text-sm text-slate-600">
        Toda inclusão, alteração e exclusão fica registrada com usuário, data/hora e valores antes/depois.
      </p>

      <select className="campo mt-4 max-w-xs" value={filtroColecao} onChange={(e) => setFiltroColecao(e.target.value)} aria-label="Filtrar por cadastro">
        <option value="">Todos os cadastros</option>
        {Object.values(CADASTROS).map((c) => (
          <option key={c.colecao} value={c.colecao}>
            {c.titulo}
          </option>
        ))}
      </select>

      <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              <th className="w-8" />
              <th className="px-3 py-2 font-medium">Data/hora</th>
              <th className="px-3 py-2 font-medium">Usuário</th>
              <th className="px-3 py-2 font-medium">Operação</th>
              <th className="px-3 py-2 font-medium">Cadastro</th>
              <th className="px-3 py-2 font-medium">Campos alterados</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtradas.map((e) => {
              const difs = diferencas(e)
              const expandida = aberta === e.id
              return (
                <Fragment key={e.id}>
                  <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setAberta(expandida ? null : e.id)}>
                    <td className="pl-3 text-slate-400">{expandida ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatarDataHora(e.em)}</td>
                    <td className="px-3 py-2">{e.usuario_nome}</td>
                    <td className="px-3 py-2">{OPERACAO[e.operacao]}</td>
                    <td className="px-3 py-2">{CADASTROS[e.colecao].titulo}</td>
                    <td className="px-3 py-2 text-slate-600">{difs.map((d) => rotuloCampo(e.colecao, d.campo)).join(', ')}</td>
                  </tr>
                  {expandida && (
                    <tr className="bg-slate-50">
                      <td />
                      <td colSpan={5} className="px-3 py-3">
                        <table className="text-xs">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="pr-6 text-left font-medium">Campo</th>
                              <th className="pr-6 text-left font-medium">Antes</th>
                              <th className="text-left font-medium">Depois</th>
                            </tr>
                          </thead>
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
        {filtradas.length === 0 && <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhuma alteração registrada ainda.</p>}
      </div>
    </div>
  )
}
