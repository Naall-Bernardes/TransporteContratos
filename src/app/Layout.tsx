import { BarChart3, Bell, Bus, Download, FileSignature, Files, Gavel, History, Home, ListChecks, LogOut, Menu, Route, ShieldAlert, Timer, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { CADASTROS, MENU_CADASTROS } from '@/features/cadastros/configuracoes'
import { useSessao, useUsuario } from '@/features/auth/Sessao'
import { carregarBase } from '@/lib/dados/armazenamento'
import { ehCentral, podeVerAuditoria, ROTULO_PAPEL } from '@/lib/permissoes'

const estiloLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
    isActive ? 'bg-marca-600 text-white' : 'text-marca-100 hover:bg-marca-800'
  }`

function Grupo({ titulo }: { titulo: string }) {
  return <p className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-marca-100/70 uppercase">{titulo}</p>
}

export function Layout() {
  const usuario = useUsuario()
  const { sair } = useSessao()
  const [menuAberto, setMenuAberto] = useState(false)
  const sre = carregarBase().colecoes.sres.find((s) => s.id === usuario.sre_id)
  const fechar = () => setMenuAberto(false)

  const menu = (
    <nav className="flex h-full flex-col overflow-y-auto bg-marca-900 p-3">
      <div className="mb-4 flex items-center gap-2 px-3 py-2 text-white">
        <Bus size={20} />
        <span className="text-sm font-semibold">Transporte Escolar</span>
      </div>
      <NavLink to="/" end className={estiloLink} onClick={fechar}>
        <Home size={16} /> Início
      </NavLink>
      <NavLink to="/painel" className={estiloLink} onClick={fechar}>
        <BarChart3 size={16} /> Painel
      </NavLink>

      <Grupo titulo="Atendimento" />
      <NavLink to="/judicial" className={estiloLink} onClick={fechar}>
        <Gavel size={16} /> Judicial / MP
      </NavLink>
      <NavLink to="/pte" className={estiloLink} onClick={fechar}>
        <Route size={16} /> PTE
      </NavLink>
      <NavLink to="/contratos" className={estiloLink} onClick={fechar}>
        <FileSignature size={16} /> Contratos e termos
      </NavLink>
      <NavLink to="/documentos" className={estiloLink} onClick={fechar}>
        <Files size={16} /> Documentos
      </NavLink>

      <Grupo titulo="Monitoramento" />
      <NavLink to="/alertas" className={estiloLink} onClick={fechar}>
        <Bell size={16} /> Alertas por e-mail
      </NavLink>
      <NavLink to="/riscos" className={estiloLink} onClick={fechar}>
        <ShieldAlert size={16} /> Riscos
      </NavLink>
      <NavLink to="/exportar" className={estiloLink} onClick={fechar}>
        <Download size={16} /> Exportação / Power BI
      </NavLink>

      <Grupo titulo="Cadastros" />
      {MENU_CADASTROS.map((c) => (
        <NavLink key={c} to={`/cadastros/${c}`} className={estiloLink} onClick={fechar}>
          {CADASTROS[c].titulo}
        </NavLink>
      ))}

      {ehCentral(usuario) && (
        <>
          <Grupo titulo="Administração" />
          <NavLink to="/cadastros/usuarios" className={estiloLink} onClick={fechar}>
            <Users size={16} /> Usuários
          </NavLink>
          <NavLink to="/cadastros/etapas_modelo" className={estiloLink} onClick={fechar}>
            <Timer size={16} /> Etapas e SLA
          </NavLink>
          <NavLink to="/cadastros/checklist_modelo" className={estiloLink} onClick={fechar}>
            <ListChecks size={16} /> Checklist por etapa
          </NavLink>
          <NavLink to="/cadastros/tipos_documento" className={estiloLink} onClick={fechar}>
            <Files size={16} /> Tipos de documento
          </NavLink>
          {podeVerAuditoria(usuario) && (
            <NavLink to="/auditoria" className={estiloLink} onClick={fechar}>
              <History size={16} /> Auditoria
            </NavLink>
          )}
        </>
      )}

      <p className="mt-auto px-3 pt-6 text-xs text-marca-100/60">Modo demonstração · dados fictícios</p>
    </nav>
  )

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-0 h-screen">{menu}</div>
      </aside>

      {menuAberto && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-64">{menu}</div>
          <button className="flex-1 bg-slate-900/40" onClick={fechar} aria-label="Fechar menu" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            {menuAberto ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="hidden rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 sm:inline">
            Modo demonstração
          </span>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{usuario.nome}</p>
              <p className="text-xs text-slate-500">
                {ROTULO_PAPEL[usuario.papel]}
                {sre && ` · SRE ${sre.sigla}`}
              </p>
            </div>
            <button onClick={sair} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Sair" aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
