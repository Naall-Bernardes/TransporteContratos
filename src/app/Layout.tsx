// Layout com dois módulos:
//  - Transporte Escolar: atendimento (Judicial/MP, PTE, contratos) — documentos e frota ficam dentro de cada processo;
//  - Cadastros: dados de base (rede, alunos, frota, preços, calendário) e administração.

import {
  BarChart3, Bus, CalendarDays, CarFront, ClipboardCheck, Database, FileSignature, Files, Gavel, History,
  Home, LayoutGrid, ListChecks, LogOut, Menu, Route, School, Tag, Timer, Truck, UserRound, Users, X,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useSessao, useUsuario } from '@/features/auth/Sessao'
import { carregarBase } from '@/lib/dados/armazenamento'
import { consultaDe } from '@/lib/dados/repositorio'
import { feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import { contarDemandasPorEtapa } from '@/lib/monitoramento'
import { podeVer } from '@/lib/permissoes'
import { ehCentral, podeVerAuditoria, ROTULO_PAPEL } from '@/lib/permissoes'

const estiloLink = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${isActive ? 'bg-marca-600 text-white' : 'text-marca-100 hover:bg-marca-800'}`

function Grupo({ titulo }: { titulo: string }) {
  return <p className="mt-5 mb-1 px-3 text-xs font-semibold tracking-wide text-marca-100/70 uppercase">{titulo}</p>
}

function ItemMenu({ para, icone, children, fim, aoClicar }: { para: string; icone: ReactNode; children: ReactNode; fim?: boolean; aoClicar: () => void }) {
  return (
    <NavLink to={para} end={fim} className={estiloLink} onClick={aoClicar}>
      {icone} {children}
    </NavLink>
  )
}

function SubItem({ para, children, qtd, fim, aoClicar }: { para: string; children: ReactNode; qtd: number; fim?: boolean; aoClicar: () => void }) {
  return (
    <NavLink
      to={para}
      end={fim}
      onClick={aoClicar}
      className={({ isActive }) => `flex items-start justify-between gap-2 rounded px-2 py-1 text-xs leading-tight ${isActive ? 'bg-marca-600 text-white' : 'text-marca-100 hover:bg-marca-800'}`}
    >
      <span>{children}</span>
      <span className={`shrink-0 rounded-full px-1.5 tabular-nums ${qtd ? 'bg-marca-700 text-white' : 'text-marca-100/50'}`}>{qtd}</span>
    </NavLink>
  )
}

export type Modulo = 'transporte' | 'cadastros'

/** Em qual módulo está a página atual. */
export const moduloDaRota = (caminho: string): Modulo => (caminho.startsWith('/cadastros') || caminho.startsWith('/auditoria') ? 'cadastros' : 'transporte')

export function Layout() {
  const usuario = useUsuario()
  const { sair } = useSessao()
  const { pathname } = useLocation()
  const modulo = moduloDaRota(pathname)
  const [menuAberto, setMenuAberto] = useState(false)
  const sre = carregarBase().colecoes.sres.find((s) => s.id === usuario.sre_id)
  const fechar = () => setMenuAberto(false)
  const emJudicial = pathname.startsWith('/judicial')

  // Submenu do Judicial/MP: as etapas do fluxo com a quantidade de demandas em cada uma
  const etapasJudicial = carregarBase().colecoes.etapas_modelo.filter((m) => m.modulo === 'JUDICIAL').sort((a, b) => Number(a.ordem) - Number(b.ordem))
  const contagem = useMemo(() => {
    if (!emJudicial) return { total: 0, porEtapa: {} as Record<string, number> }
    const b = carregarBase()
    const consulta = consultaDe(b)
    const lista = (c: Colecao) => b.colecoes[c].filter((r) => podeVer(usuario, c, r, consulta))
    return contarDemandasPorEtapa(lista, hojeIso(), feriadosDe(lista))
  }, [pathname, usuario, emJudicial]) // pathname: recalcula a cada navegação, refletindo etapas concluídas
  const Item = (p: { para: string; icone: ReactNode; children: ReactNode; fim?: boolean }) => <ItemMenu {...p} aoClicar={fechar} />

  const menuTransporte = (
    <>
      <Item para="/" fim icone={<Home size={16} />}>Início</Item>
      <Item para="/painel" icone={<BarChart3 size={16} />}>Painel</Item>
      <Grupo titulo="Atendimento" />
      <Item para="/judicial" icone={<Gavel size={16} />} fim>Judicial / MP</Item>
      {emJudicial && (
        <div className="mt-0.5 mb-1 ml-5 border-l border-marca-700 pl-2">
          <SubItem para="/judicial" fim aoClicar={fechar} qtd={contagem.total}>Todas as demandas</SubItem>
          {etapasJudicial.map((m) => (
            <SubItem key={m.id} para={`/judicial/etapa/${m.codigo}`} aoClicar={fechar} qtd={contagem.porEtapa[String(m.codigo)] ?? 0}>
              {String(m.ordem)}. {String(m.nome)}
            </SubItem>
          ))}
        </div>
      )}
      <Item para="/pte" icone={<Route size={16} />}>PTE</Item>
      <Item para="/contratos" icone={<FileSignature size={16} />}>Contratos e termos</Item>
    </>
  )

  const menuCadastros = (
    <>
      <Item para="/cadastros" fim icone={<LayoutGrid size={16} />}>Visão geral</Item>
      <Grupo titulo="Rede e território" />
      <Item para="/cadastros/sres" icone={<Database size={16} />}>SREs</Item>
      <Item para="/cadastros/municipios" icone={<Database size={16} />}>Municípios</Item>
      <Item para="/cadastros/escolas" icone={<School size={16} />}>Escolas estaduais</Item>
      <Item para="/cadastros/caixas_escolares" icone={<School size={16} />}>Caixas Escolares</Item>
      <Grupo titulo="Estudantes" />
      <Item para="/cadastros/alunos" icone={<UserRound size={16} />}>Alunos</Item>
      <Grupo titulo="Transporte" />
      <Item para="/cadastros/transportadores" icone={<Truck size={16} />}>Transportadores</Item>
      <Item para="/cadastros/veiculos" icone={<CarFront size={16} />}>Veículos e embarcações</Item>
      <Item para="/cadastros/condutores" icone={<UserRound size={16} />}>Condutores e monitores</Item>
      <Item para="/cadastros/tipos_veiculo" icone={<Bus size={16} />}>Tipos de veículo</Item>
      <Item para="/cadastros/precos_referencia" icone={<Tag size={16} />}>Preços de referência</Item>
      <Grupo titulo="Calendário" />
      <Item para="/cadastros/feriados" icone={<CalendarDays size={16} />}>Feriados</Item>
      {ehCentral(usuario) && (
        <>
          <Grupo titulo="Administração" />
          <Item para="/cadastros/usuarios" icone={<Users size={16} />}>Usuários</Item>
          <Item para="/cadastros/etapas_modelo" icone={<Timer size={16} />}>Etapas e SLA</Item>
          <Item para="/cadastros/checklist_modelo" icone={<ListChecks size={16} />}>Checklist por etapa</Item>
          <Item para="/cadastros/tipos_documento" icone={<Files size={16} />}>Tipos de documento</Item>
          <Item para="/cadastros/exigencias_documentais" icone={<ClipboardCheck size={16} />}>Exigências documentais</Item>
          {podeVerAuditoria(usuario) && <Item para="/auditoria" icone={<History size={16} />}>Auditoria</Item>}
        </>
      )}
    </>
  )

  const menu = (
    <nav className="flex h-full flex-col overflow-y-auto bg-marca-900 p-3">
      <div className="mb-3 flex items-center gap-2 px-3 py-2 text-white">
        <Bus size={20} />
        <span className="text-sm font-semibold">SEE/MG · Transporte Escolar</span>
      </div>
      {/* Seletor de módulo */}
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-md bg-marca-800 p-1 text-xs font-medium">
        {(
          [
            ['transporte', '/', 'Transporte Escolar'],
            ['cadastros', '/cadastros', 'Cadastros'],
          ] as const
        ).map(([id, para, rotulo]) => (
          <Link key={id} to={para} onClick={fechar} className={`rounded px-2 py-1.5 text-center ${modulo === id ? 'bg-white text-marca-900' : 'text-marca-100 hover:bg-marca-700'}`}>
            {rotulo}
          </Link>
        ))}
      </div>
      {modulo === 'transporte' ? menuTransporte : menuCadastros}
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
          <span className="text-sm font-semibold text-marca-800">{modulo === 'transporte' ? 'Transporte Escolar' : 'Cadastros'}</span>
          <span className="hidden rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 sm:inline">Modo demonstração</span>
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
