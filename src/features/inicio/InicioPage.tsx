import { RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { PontoSemaforo } from '@/components/comum/Semaforo'
import { Botao } from '@/components/ui/Botao'
import { Modal } from '@/components/ui/Modal'
import { useSessao, useUsuario } from '@/features/auth/Sessao'
import { alertasInstrumento } from '@/lib/contratos/alertas'
import { restaurarDemonstracao } from '@/lib/dados/armazenamento'
import { feriadosDe } from '@/lib/dados/servicos'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { hojeIso } from '@/lib/diasUteis'
import { limparArquivos } from '@/lib/documentos/arquivos'
import { ROTULO_NIVEL } from '@/lib/fluxo/sla'
import { situacaoDosInstrumentos, situacaoDosProcessos } from '@/lib/monitoramento'
import { ehCentral, ehMunicipio } from '@/lib/permissoes'

const ORDEM = { vermelho: 0, amarelo: 1, verde: 2, cinza: 3 }

export function InicioPage() {
  const usuario = useUsuario()
  const { sair } = useSessao()
  const { dados } = useTodos()
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const [so, setSo] = useState<'minhas' | 'todas'>('minhas')
  const hoje = hojeIso()

  const { etapas, contratos } = useMemo(() => {
    const lista = (c: Colecao) => dados[c] ?? []
    const etapas = situacaoDosProcessos(lista, hoje, feriadosDe(lista))
      .filter((s) => s.instancia && s.semaforo.cor !== 'cinza')
      .map((s) => ({
        ...s,
        minha: s.instancia!.responsavel_id === usuario.id || s.demanda?.responsavel_sre_id === usuario.id,
        titulo: s.demanda
          ? String(lista('escolas').find((e) => e.id === s.demanda!.escola_id)?.nome ?? '')
          : `PTE ${lista('ciclos_pte').find((c) => c.id === s.adesao?.ciclo_id)?.ano ?? ''} — ${lista('municipios').find((m) => m.id === s.adesao?.municipio_id)?.nome ?? ''}`,
        link: s.demanda ? `/judicial/${s.demanda.id}` : `/pte/adesoes/${s.adesao!.id}`,
      }))
      .sort((a, b) => ORDEM[a.semaforo.cor] - ORDEM[b.semaforo.cor] || String(a.semaforo.prazo).localeCompare(String(b.semaforo.prazo)))
    const contratos = situacaoDosInstrumentos(lista, hoje)
      .map((x) => ({
        ...x,
        alertas: alertasInstrumento(x.situacao, lista('prestacoes_contas').filter((p) => p.instrumento_id === x.instrumento.id), lista('ocorrencias').filter((o) => o.instrumento_id === x.instrumento.id), hoje).filter((a) => a.nivel === 'critico'),
        minha: x.instrumento.gestor_id === usuario.id || x.instrumento.fiscal_id === usuario.id,
        codigo: String(lista('processos').find((p) => p.id === x.instrumento.processo_id)?.codigo ?? ''),
      }))
      .filter((x) => x.alertas.length > 0)
    return { etapas, contratos }
  }, [dados, hoje, usuario.id])

  const minhasEtapas = so === 'minhas' ? etapas.filter((e) => e.minha) : etapas
  const meusContratos = so === 'minhas' ? contratos.filter((c) => c.minha) : contratos

  async function restaurar() {
    restaurarDemonstracao()
    await limparArquivos().catch(() => undefined)
    sair() // os ids dos usuários mudam; volta ao login
  }

  // a prefeitura trabalha só no PTE do seu município
  if (ehMunicipio(usuario)) return <Navigate to="/pte" replace />

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Olá, {usuario.nome.split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-slate-600">{ehCentral(usuario) ? 'Você vê os dados de todas as regionais.' : 'Você vê os dados da sua regional e os cadastros gerais.'}</p>
        </div>
        <div className="flex rounded-md border border-slate-300 bg-white p-0.5 text-sm">
          {(['minhas', 'todas'] as const).map((o) => (
            <button key={o} onClick={() => setSo(o)} className={`rounded px-3 py-1 ${so === o ? 'bg-marca-600 text-white' : 'text-slate-600'}`}>
              {o === 'minhas' ? 'Sob minha responsabilidade' : 'Tudo que vejo'}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Etapas em andamento ({minhasEtapas.length})</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {minhasEtapas.map((e) => (
            <li key={e.processo.id}>
              <Link to={e.link} className="flex flex-wrap items-start gap-3 py-2 hover:bg-slate-50">
                <PontoSemaforo cor={e.semaforo.cor} />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-marca-700">{String(e.processo.codigo)}</span> · {e.titulo}
                  <span className="block text-slate-600">{String(e.modelo?.ordem)}. {String(e.modelo?.nome)} — {e.semaforo.texto}</span>
                </span>
                {e.semaforo.nivel > 1 && <span className="text-xs font-medium text-orange-700">{ROTULO_NIVEL[e.semaforo.nivel]}</span>}
              </Link>
            </li>
          ))}
        </ul>
        {minhasEtapas.length === 0 && <p className="mt-2 text-sm text-slate-500">Nada pendente {so === 'minhas' ? 'sob sua responsabilidade' : ''}.</p>}
      </section>

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Contratos e termos com alerta crítico ({meusContratos.length})</h2>
        <ul className="mt-2 divide-y divide-slate-100">
          {meusContratos.map((c) => (
            <li key={c.instrumento.id}>
              <Link to={`/contratos/${c.instrumento.id}`} className="block py-2 text-sm hover:bg-slate-50">
                <span className="font-medium text-marca-700">{c.codigo}</span> · {c.instrumento.tipo === 'termo_pte' ? 'Termo' : 'Contrato'} {String(c.instrumento.numero)}
                {c.alertas.map((a) => <span key={a.texto} className="block text-red-700">{a.texto}</span>)}
              </Link>
            </li>
          ))}
        </ul>
        {meusContratos.length === 0 && <p className="mt-2 text-sm text-slate-500">Nenhum alerta crítico {so === 'minhas' ? '(como gestor ou fiscal)' : ''}.</p>}
      </section>

      {usuario.papel === 'admin' && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Dados de demonstração</h2>
          <p className="mt-1 text-sm text-slate-600">Apaga tudo o que foi cadastrado neste navegador (inclusive auditoria e arquivos enviados) e recarrega os dados fictícios iniciais.</p>
          <Botao variante="secundario" className="mt-3" onClick={() => setConfirmandoReset(true)}><RotateCcw size={16} /> Restaurar dados de demonstração</Botao>
        </div>
      )}

      <Modal titulo="Restaurar dados de demonstração" aberto={confirmandoReset} aoFechar={() => setConfirmandoReset(false)} largura="md">
        <p className="text-sm text-slate-700">Todos os dados deste navegador serão substituídos. Você voltará à tela de login.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="secundario" onClick={() => setConfirmandoReset(false)}>Cancelar</Botao>
          <Botao variante="perigo" onClick={restaurar}>Restaurar</Botao>
        </div>
      </Modal>
    </div>
  )
}
