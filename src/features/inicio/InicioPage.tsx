import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useSessao, useUsuario } from '@/features/auth/Sessao'
import { CADASTROS, MENU_CADASTROS } from '@/features/cadastros/configuracoes'
import { restaurarDemonstracao } from '@/lib/dados/armazenamento'
import { useColecoes } from '@/lib/dados/useColecao'
import { ehCentral } from '@/lib/permissoes'

export function InicioPage() {
  const usuario = useUsuario()
  const { sair } = useSessao()
  const { dados } = useColecoes(MENU_CADASTROS)
  const [confirmandoReset, setConfirmandoReset] = useState(false)

  function restaurar() {
    restaurarDemonstracao()
    sair() // os ids dos usuários mudam; volta ao login
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Início</h1>
      <p className="mt-1 text-sm text-slate-600">
        {ehCentral(usuario)
          ? 'Você vê os dados de todas as regionais.'
          : 'Você vê apenas os dados da sua regional e os cadastros gerais.'}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {MENU_CADASTROS.map((c) => (
          <Link
            key={c}
            to={`/cadastros/${c}`}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-marca-600 hover:shadow-sm"
          >
            <p className="text-2xl font-semibold text-slate-900 tabular-nums">{dados[c]?.length ?? '–'}</p>
            <p className="mt-1 text-sm text-slate-600">{CADASTROS[c].titulo}</p>
          </Link>
        ))}
      </div>

      {usuario.papel === 'admin' && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Dados de demonstração</h2>
          <p className="mt-1 text-sm text-slate-600">
            Apaga tudo o que foi cadastrado neste navegador (inclusive a auditoria) e recarrega os dados fictícios iniciais.
          </p>
          <Botao variante="secundario" className="mt-3" onClick={() => setConfirmandoReset(true)}>
            <RotateCcw size={16} /> Restaurar dados de demonstração
          </Botao>
        </div>
      )}

      <Modal titulo="Restaurar dados de demonstração" aberto={confirmandoReset} aoFechar={() => setConfirmandoReset(false)} largura="md">
        <p className="text-sm text-slate-700">Todos os dados deste navegador serão substituídos. Você voltará à tela de login.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmandoReset(false)}>
            Cancelar
          </Botao>
          <Botao variante="perigo" onClick={restaurar}>
            Restaurar
          </Botao>
        </div>
      </Modal>
    </div>
  )
}
