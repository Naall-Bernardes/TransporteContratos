import { Bus, LogIn } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { carregarBase } from '@/lib/dados/armazenamento'
import { listarUsuariosParaLogin } from '@/lib/dados/repositorio'
import type { Usuario } from '@/lib/dados/tipos'
import { ROTULO_PAPEL } from '@/lib/permissoes'
import { useSessao } from './Sessao'

export function LoginPage() {
  const { usuario, entrar } = useSessao()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])

  useEffect(() => {
    void listarUsuariosParaLogin().then(setUsuarios)
  }, [])

  if (usuario) return <Navigate to="/" replace />

  const sres = carregarBase().colecoes.sres
  const siglaSre = (id: string | null) => sres.find((s) => s.id === id)?.sigla as string | undefined

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg bg-marca-600 p-2 text-white">
            <Bus size={24} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Transporte Escolar – SEE/MG</h1>
            <p className="text-sm text-slate-600">Ofícios e cumprimento de sentença (Judicial/MP), PTE e gestão contratual</p>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>Modo demonstração.</strong> Não há senha: escolha um usuário fictício para testar o que cada perfil
          pode ver e fazer. Os dados ficam apenas neste navegador.
        </div>

        <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {usuarios.map((u) => (
            <li key={u.id}>
              <button
                onClick={() => entrar(u)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-marca-50"
              >
                <span>
                  <span className="block text-sm font-medium text-slate-900">{u.nome}</span>
                  <span className="block text-xs text-slate-600">
                    {ROTULO_PAPEL[u.papel]}
                    {u.sre_id && ` · SRE ${siglaSre(u.sre_id)}`}
                  </span>
                </span>
                <LogIn size={18} className="shrink-0 text-marca-600" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
