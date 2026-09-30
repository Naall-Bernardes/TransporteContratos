import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import type { CadastroConfig } from '@/features/cadastros/configuracoes'
import { valorExibido, type Referencias } from '@/features/cadastros/exibicao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { ErroPermissao, excluir } from '@/lib/dados/repositorio'
import type { Registro } from '@/lib/dados/tipos'

interface Props {
  config: CadastroConfig
  /** Gravados em todo registro novo/alterado (ex.: { instrumento_id } ou { demanda_id }). */
  valoresFixos: Record<string, unknown>
  registros: Registro[]
  referencias: Referencias
  podeEditar: boolean
  aoAlterar: () => Promise<void>
  /** Sugestões para um registro novo (ex.: próximo número). */
  padraoNovo?: Record<string, unknown>
  /** Conteúdo acima da tabela (totais, explicações). */
  cabecalho?: ReactNode
  /** Rodapé da tabela (ex.: linha de totais), recebe o nº de colunas. */
  rodape?: (colunas: number) => ReactNode
  destacarLinha?: (r: Registro) => string | undefined
  /** Botões extras ao lado de "Incluir". */
  acoesCabecalho?: ReactNode
}

export function SecaoRegistros({ config, valoresFixos, registros, referencias, podeEditar, aoAlterar, padraoNovo, cabecalho, rodape, destacarLinha, acoesCabecalho }: Props) {
  const usuario = useUsuario()
  const [editando, setEditando] = useState<Registro | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Registro | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const colunas = config.campos.filter((c) => c.naTabela)
  const ordenados = [...registros].sort((a, b) => config.ordenarPor(a).localeCompare(config.ordenarPor(b), 'pt-BR'))

  async function confirmarExclusao() {
    if (!excluindo) return
    try {
      await excluir(config.colecao, excluindo.id, usuario)
      setExcluindo(null)
      await aoAlterar()
    } catch (e) {
      if (e instanceof ErroPermissao) setErro(e.message)
      else throw e
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm text-slate-600">{cabecalho ?? config.descricao}</div>
        <div className="flex flex-wrap gap-2">
          {acoesCabecalho}
          {podeEditar && (
            <Botao onClick={() => setEditando('novo')}>
              <Plus size={16} /> Incluir {config.singular}
            </Botao>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              {colunas.map((c) => (
                <th key={c.nome} className={`px-3 py-2 font-medium whitespace-nowrap ${c.tipo === 'moeda' ? 'text-right' : ''}`}>
                  {c.rotulo}
                </th>
              ))}
              {podeEditar && <th className="w-20" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenados.map((r) => (
              <tr key={r.id} className={destacarLinha?.(r) ?? 'hover:bg-slate-50'}>
                {colunas.map((c) => (
                  <td key={c.nome} className={`px-3 py-2 ${c.tipo === 'moeda' ? 'text-right whitespace-nowrap tabular-nums' : ''}`}>
                    {valorExibido(c, r, referencias)}
                  </td>
                ))}
                {podeEditar && (
                  <td className="px-2 py-1 text-right whitespace-nowrap">
                    <button onClick={() => setEditando(r)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700" aria-label="Editar" title="Editar">
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setErro(null)
                        setExcluindo(r)
                      }}
                      className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                      aria-label="Excluir"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {rodape && ordenados.length > 0 && <tfoot className="border-t border-slate-200 bg-slate-50 font-medium">{rodape(colunas.length + (podeEditar ? 1 : 0))}</tfoot>}
        </table>
        {ordenados.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">Nenhum registro.</p>}
      </div>

      <Modal titulo={editando === 'novo' ? `Incluir ${config.singular}` : `Editar ${config.singular}`} aberto={editando !== null} aoFechar={() => setEditando(null)}>
        {editando !== null && (
          <FormularioRegistro
            config={config}
            registro={editando === 'novo' ? null : editando}
            referencias={referencias}
            valoresFixos={valoresFixos}
            valoresPadrao={padraoNovo}
            aoCancelar={() => setEditando(null)}
            aoSalvar={async () => {
              setEditando(null)
              await aoAlterar()
            }}
          />
        )}
      </Modal>

      <Modal titulo={`Excluir ${config.singular}`} aberto={excluindo !== null} aoFechar={() => setExcluindo(null)} largura="md">
        <p className="text-sm text-slate-700">Confirma a exclusão? A operação fica registrada na auditoria.</p>
        {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setExcluindo(null)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={confirmarExclusao} disabled={erro !== null}>Excluir</Botao>
        </div>
      </Modal>
    </div>
  )
}
