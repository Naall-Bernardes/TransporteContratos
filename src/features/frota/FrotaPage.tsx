// Frota e conformidade: situação documental de toda a frota, condutores e contratados.

import { Link } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Cartao } from '@/components/comum/Cartao'
import { avaliarEntidade, rotuloCondutor, rotuloVeiculo, type ConformidadeEntidade } from '@/lib/conformidade'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { useUsuario } from '@/features/auth/Sessao'
import { podeEditarColecao } from '@/lib/permissoes'
import { PainelConformidade } from './PainelConformidade'

type Filtro = 'pendentes' | 'a_vencer' | 'todos'

export function FrotaPage() {
  const usuario = useUsuario()
  const { dados, recarregar } = useTodos()
  const hoje = hojeIso()
  const [filtro, setFiltro] = useState<Filtro>('pendentes')
  const [tipo, setTipo] = useState<'' | 'veiculo' | 'condutor' | 'contratado'>('')
  const [busca, setBusca] = useState('')

  const entidades = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    const ex = lista('exigencias_documentais')
    const docs = lista('documentos')
    const emContrato = new Set(lista('instrumentos').filter((i) => i.tipo === 'contrato_caixa').map((i) => String(i.transportador_id)))
    const todas: ConformidadeEntidade[] = [
      ...lista('transportadores').filter((t) => t.ativo !== false && emContrato.has(t.id)).map((t) => avaliarEntidade('contratado', t, ex, docs, hoje, String(t.razao_social))),
      ...lista('veiculos').filter((v) => v.ativo !== false).map((v) => avaliarEntidade('veiculo', v, ex, docs, hoje, rotuloVeiculo(v))),
      ...lista('condutores').filter((c) => c.ativo !== false).map((c) => avaliarEntidade('condutor', c, ex, docs, hoje, rotuloCondutor(c))),
    ]
    return todas
  }, [dados, hoje])

  const filtradas = entidades
    .filter((e) => !tipo || e.entidade === tipo)
    .filter((e) => (filtro === 'pendentes' ? e.pendentes.length > 0 : filtro === 'a_vencer' ? e.itens.some((i) => i.obrigatoria && i.status === 'a_vencer') : true))
    .filter((e) => !busca || e.rotulo.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR')))
    .sort((a, b) => b.pendentes.length - a.pendentes.length || a.rotulo.localeCompare(b.rotulo, 'pt-BR'))

  const comPendencia = entidades.filter((e) => e.pendentes.length > 0).length
  const vencidos = entidades.reduce((t, e) => t + e.itens.filter((i) => i.obrigatoria && i.status === 'vencido').length, 0)
  const ausentes = entidades.reduce((t, e) => t + e.itens.filter((i) => i.obrigatoria && i.status === 'ausente').length, 0)
  const aVencer = entidades.reduce((t, e) => t + e.itens.filter((i) => i.obrigatoria && i.status === 'a_vencer').length, 0)

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Frota e conformidade legal</h1>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Documentos obrigatórios de veículos (CTB art. 136; DETRAN-MG), condutores (CTB arts. 138, 148-A e 329; CONTRAN 789/2020) e contratados (Res. SEE 3.670/2017).
        Cadastre veículos e condutores em <Link to="/cadastros/veiculos" className="text-marca-700 underline">Cadastros</Link>; o catálogo de exigências fica em Administração.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Cartao titulo="Com pendência obrigatória" valor={comPendencia} cor={comPendencia ? 'text-red-600' : undefined} ativo={filtro === 'pendentes'} onClick={() => setFiltro('pendentes')} />
        <Cartao titulo="Documentos vencidos" valor={vencidos} cor={vencidos ? 'text-red-600' : undefined} />
        <Cartao titulo="Documentos não enviados" valor={ausentes} cor={ausentes ? 'text-red-600' : undefined} />
        <Cartao titulo="A vencer em 30 dias" valor={aVencer} cor={aVencer ? 'text-amber-600' : undefined} ativo={filtro === 'a_vencer'} onClick={() => setFiltro('a_vencer')} />
      </div>

      <div className="mt-5 mb-3 flex flex-wrap gap-2">
        <input className="campo w-full max-w-xs" placeholder="Placa, nome, empresa…" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar" />
        <select className="campo w-auto" value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
          <option value="">Veículos, condutores e contratados</option>
          <option value="veiculo">Só veículos</option>
          <option value="condutor">Só condutores e monitores</option>
          <option value="contratado">Só contratados</option>
        </select>
        <select className="campo w-auto" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Situação">
          <option value="pendentes">Com pendência obrigatória</option>
          <option value="a_vencer">Com documento a vencer</option>
          <option value="todos">Todos</option>
        </select>
      </div>

      <PainelConformidade entidades={filtradas} dados={dados} podeEnviar={podeEditarColecao(usuario, 'documentos')} aoAlterar={recarregar} />
      <p className="mt-2 text-xs text-slate-500">{filtradas.length} de {entidades.length} registro(s).</p>
    </div>
  )
}
