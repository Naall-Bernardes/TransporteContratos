import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useUsuario } from '@/features/auth/Sessao'
import { ErroPermissao, excluir } from '@/lib/dados/repositorio'
import { COLECOES, type Colecao, type Registro } from '@/lib/dados/tipos'
import { useColecoes } from '@/lib/dados/useColecao'
import { baixarArquivo, gerarCsv } from '@/lib/csv'
import { hojeIso } from '@/lib/diasUteis'
import { podeEditarColecao } from '@/lib/permissoes'
import { CADASTROS } from './configuracoes'
import { valorExibido } from './exibicao'
import { FormularioRegistro } from './FormularioRegistro'

export function CadastroPage() {
  const { colecao } = useParams()
  if (!COLECOES.includes(colecao as Colecao)) return <Navigate to="/" replace />
  // key força recriar a tela (e limpar busca/modais) ao trocar de cadastro no menu
  return <Cadastro key={colecao} colecao={colecao as Colecao} />
}

function Cadastro({ colecao }: { colecao: Colecao }) {
  const usuario = useUsuario()
  const config = CADASTROS[colecao]
  const colecoesReferenciadas = [...new Set(config.campos.flatMap((c) => (c.referencia ? [c.referencia] : [])))]
  const { dados, carregando, recarregar } = useColecoes([colecao, ...colecoesReferenciadas.filter((c) => c !== colecao)])
  const referencias = dados
  const registros = useMemo(() => dados[colecao] ?? [], [dados, colecao])

  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<Registro | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Registro | null>(null)
  const [erroExclusao, setErroExclusao] = useState<string | null>(null)

  const podeEditar = podeEditarColecao(usuario, colecao)
  const colunas = useMemo(() => config.campos.filter((c) => c.naTabela), [config])

  const linhas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return [...registros]
      .sort((a, b) => config.ordenarPor(a).localeCompare(config.ordenarPor(b), 'pt-BR'))
      .map((r) => ({ registro: r, textos: colunas.map((c) => valorExibido(c, r, referencias)) }))
      .filter((l) => !termo || l.textos.some((t) => t.toLocaleLowerCase('pt-BR').includes(termo)))
  }, [registros, referencias, colunas, config, busca])

  function exportar() {
    const csv = gerarCsv(
      colunas.map((c) => c.rotulo),
      linhas.map((l) => l.textos),
    )
    baixarArquivo(`${colecao}_${hojeIso()}.csv`, csv)
  }

  async function confirmarExclusao() {
    if (!excluindo) return
    try {
      await excluir(colecao, excluindo.id, usuario)
      setExcluindo(null)
      await recarregar()
    } catch (e) {
      if (e instanceof ErroPermissao) setErroExclusao(e.message)
      else throw e
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{config.titulo}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">{config.descricao}</p>
        </div>
        <div className="flex gap-2">
          <Botao variante="secundario" onClick={exportar} disabled={linhas.length === 0}>
            <Download size={16} /> Exportar CSV
          </Botao>
          {podeEditar && (
            <Botao onClick={() => setEditando('novo')}>
              <Plus size={16} /> Novo
            </Botao>
          )}
        </div>
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search size={16} className="pointer-events-none absolute top-2.5 left-3 text-slate-400" />
        <input
          className="campo pl-9"
          placeholder="Buscar…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
            <tr>
              {colunas.map((c) => (
                <th key={c.nome} className="px-3 py-2 font-medium whitespace-nowrap">
                  {c.rotulo}
                </th>
              ))}
              {podeEditar && <th className="w-24 px-3 py-2" aria-label="Ações" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map(({ registro, textos }) => (
              <tr key={registro.id} className={registro.ativo === false ? 'text-slate-400' : 'hover:bg-slate-50'}>
                {textos.map((t, i) => (
                  <td key={colunas[i].nome} className="px-3 py-2">
                    {t}
                  </td>
                ))}
                {podeEditar && (
                  <td className="px-3 py-1 whitespace-nowrap text-right">
                    <button
                      onClick={() => setEditando(registro)}
                      className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-marca-700"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setErroExclusao(null)
                        setExcluindo(registro)
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
        </table>
        {!carregando && linhas.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</p>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {linhas.length} de {registros.length} registro(s)
        {!podeEditar && ' · somente leitura para o seu perfil'}
      </p>

      <Modal
        titulo={editando === 'novo' ? `Novo(a) ${config.singular}` : `Editar ${config.singular}`}
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
      >
        {editando !== null && (
          <FormularioRegistro
            config={config}
            registro={editando === 'novo' ? null : editando}
            referencias={referencias}
            aoCancelar={() => setEditando(null)}
            aoSalvar={async () => {
              setEditando(null)
              await recarregar()
            }}
          />
        )}
      </Modal>

      <Modal titulo={`Excluir ${config.singular}`} aberto={excluindo !== null} aoFechar={() => setExcluindo(null)} largura="md">
        <p className="text-sm text-slate-700">
          Confirma a exclusão deste registro? A operação fica registrada na auditoria.
        </p>
        {erroExclusao && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erroExclusao}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setExcluindo(null)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={confirmarExclusao} disabled={erroExclusao !== null}>
            Excluir
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
