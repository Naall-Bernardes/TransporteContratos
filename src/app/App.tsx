import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuditoriaPage } from '@/features/auditoria/AuditoriaPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProvedorSessao, useSessao } from '@/features/auth/Sessao'
import { CadastroPage } from '@/features/cadastros/CadastroPage'
import { InicioPage } from '@/features/inicio/InicioPage'
import { Layout } from './Layout'

function RotaProtegida({ children }: { children: ReactNode }) {
  const { usuario } = useSessao()
  return usuario ? children : <Navigate to="/login" replace />
}

export function App() {
  return (
    <ProvedorSessao>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RotaProtegida>
                <Layout />
              </RotaProtegida>
            }
          >
            <Route index element={<InicioPage />} />
            <Route path="cadastros/:colecao" element={<CadastroPage />} />
            <Route path="auditoria" element={<AuditoriaPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProvedorSessao>
  )
}
