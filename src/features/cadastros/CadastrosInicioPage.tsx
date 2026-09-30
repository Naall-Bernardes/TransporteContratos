// Visão geral do módulo Cadastros: quantos registros há em cada cadastro de base.

import { Link } from 'react-router-dom'
import { CONFIGURACOES } from '@/features/configuracoes'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { ehCentral } from '@/lib/permissoes'
import { useUsuario } from '@/features/auth/Sessao'

const GRUPOS: { titulo: string; colecoes: Colecao[] }[] = [
  { titulo: 'Rede e território', colecoes: ['sres', 'municipios', 'escolas', 'caixas_escolares'] },
  { titulo: 'Estudantes', colecoes: ['alunos'] },
  { titulo: 'Transporte', colecoes: ['transportadores', 'veiculos', 'condutores', 'tipos_veiculo', 'precos_referencia'] },
  { titulo: 'Calendário', colecoes: ['feriados'] },
]
const ADMIN: Colecao[] = ['usuarios', 'etapas_modelo', 'checklist_modelo', 'tipos_documento', 'exigencias_documentais']

export function CadastrosInicioPage() {
  const usuario = useUsuario()
  const { dados } = useTodos()
  const grupos = ehCentral(usuario) ? [...GRUPOS, { titulo: 'Administração', colecoes: ADMIN }] : GRUPOS
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">Cadastros</h1>
      <p className="mt-1 text-sm text-slate-600">Dados de base usados pelo módulo Transporte Escolar. {ehCentral(usuario) ? 'Você vê todas as regionais.' : 'Você vê os dados da sua regional e os cadastros gerais.'}</p>
      {grupos.map((g) => (
        <section key={g.titulo} className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 uppercase">{g.titulo}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {g.colecoes.map((c) => (
              <Link key={c} to={`/cadastros/${c}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-marca-600 hover:shadow-sm">
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">{dados[c]?.length ?? '–'}</p>
                <p className="mt-1 text-sm text-slate-600">{CONFIGURACOES[c].titulo}</p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
