// Sessão do usuário. No modo demonstração o "login" é só escolher um usuário fictício;
// com o Supabase, virá do Supabase Auth (e-mail + senha ou link mágico).

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { carregarBase } from '@/lib/dados/armazenamento'
import type { Usuario } from '@/lib/dados/tipos'

const CHAVE_SESSAO = 'transporte-escolar:sessao'

interface ValorSessao {
  usuario: Usuario | null
  entrar: (u: Usuario) => void
  sair: () => void
}

const ContextoSessao = createContext<ValorSessao | null>(null)

function usuarioSalvo(): Usuario | null {
  try {
    const id = localStorage.getItem(CHAVE_SESSAO)
    const u = carregarBase().colecoes.usuarios.find((x) => x.id === id) as Usuario | undefined
    return u?.ativo ? u : null
  } catch {
    return null
  }
}

export function ProvedorSessao({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(usuarioSalvo)

  const entrar = useCallback((u: Usuario) => {
    try {
      localStorage.setItem(CHAVE_SESSAO, u.id)
    } catch {
      // segue só em memória
    }
    setUsuario(u)
  }, [])

  const sair = useCallback(() => {
    try {
      localStorage.removeItem(CHAVE_SESSAO)
    } catch {
      // nada a fazer
    }
    setUsuario(null)
  }, [])

  const valor = useMemo(() => ({ usuario, entrar, sair }), [usuario, entrar, sair])
  return <ContextoSessao.Provider value={valor}>{children}</ContextoSessao.Provider>
}

export function useSessao(): ValorSessao {
  const ctx = useContext(ContextoSessao)
  if (!ctx) throw new Error('useSessao precisa estar dentro de <ProvedorSessao>')
  return ctx
}

/** Usuário logado — só usar em telas protegidas (dentro de RotaProtegida). */
export function useUsuario(): Usuario {
  const { usuario } = useSessao()
  if (!usuario) throw new Error('Nenhum usuário logado')
  return usuario
}
