import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuditoriaPage } from '@/features/auditoria/AuditoriaPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ProvedorSessao, useSessao } from '@/features/auth/Sessao'
import { CadastroPage } from '@/features/cadastros/CadastroPage'
import { ContratoDetalhePage } from '@/features/contratos/ContratoDetalhePage'
import { ContratosPage } from '@/features/contratos/ContratosPage'
import { InicioPage } from '@/features/inicio/InicioPage'
import { CaracterizacaoPage } from '@/features/judicial/CaracterizacaoPage'
import { DemandaDetalhePage } from '@/features/judicial/DemandaDetalhePage'
import { JudicialPage } from '@/features/judicial/JudicialPage'
import { RelatorioCumprimentoPage } from '@/features/judicial/RelatorioCumprimentoPage'
import { PainelPage } from '@/features/painel/PainelPage'
import { AdesaoPage } from '@/features/pte/AdesaoPage'
import { PtePage } from '@/features/pte/PtePage'
import { CadastrosInicioPage } from '@/features/cadastros/CadastrosInicioPage'
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
            <Route path="cadastros" element={<CadastrosInicioPage />} />
            <Route path="cadastros/:colecao" element={<CadastroPage />} />
            <Route path="contratos" element={<ContratosPage />} />
            <Route path="contratos/:id" element={<ContratoDetalhePage />} />
            <Route path="auditoria" element={<AuditoriaPage />} />
            <Route path="painel" element={<PainelPage />} />
            <Route path="judicial" element={<JudicialPage />} />
            <Route path="judicial/:id" element={<DemandaDetalhePage />} />
            <Route path="judicial/:id/caracterizacao/:daId" element={<CaracterizacaoPage />} />
            <Route path="pte" element={<PtePage />} />
            <Route path="pte/adesoes/:id" element={<AdesaoPage />} />
          </Route>
          <Route
            path="judicial/:id/relatorio"
            element={
              <RotaProtegida>
                <RelatorioCumprimentoPage />
              </RotaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ProvedorSessao>
  )
}
