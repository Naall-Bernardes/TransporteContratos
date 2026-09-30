import { ArrowLeft, Eye, ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Botao } from '@/components/ui/Botao'
import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { registrarAcesso } from '@/lib/dados/repositorio'
import type { Colecao } from '@/lib/dados/tipos'
import { useTodos } from '@/lib/dados/useColecao'
import { formatarData } from '@/lib/formatacao'
import { ehDiretorOuCentral, podeEditar } from '@/lib/permissoes'
import { CARACTERIZACAO, RESPONSAVEL, SAUDE, STATUS_CARACTERIZACAO } from './configuracoes'

export function CaracterizacaoPage() {
  const { id, daId } = useParams()
  const usuario = useUsuario()
  const { dados, carregando, recarregar } = useTodos()
  const [sensiveis, setSensiveis] = useState(false)
  const [salvo, setSalvo] = useState<string | null>(null)

  if (carregando) return null
  const achar = (c: Colecao, rid: unknown) => dados[c]?.find((r) => r.id === rid)
  const demanda = achar('demandas', id)
  const da = achar('demanda_alunos', daId)
  const car = dados.caracterizacoes?.find((c) => c.demanda_aluno_id === daId)
  if (!demanda || !da || !car) return <p className="text-sm text-slate-600">Formulário não encontrado ou sem permissão.</p>

  const aluno = achar('alunos', da.aluno_id)
  const escola = achar('escolas', aluno?.escola_atual_id)
  const processo = achar('processos', demanda.processo_id)
  const responsavel = dados.responsaveis_legais?.find((r) => r.caracterizacao_id === car.id) ?? null
  const saude = dados.caracterizacoes_saude?.find((r) => r.caracterizacao_id === car.id) ?? null
  const pode = podeEditar(usuario, 'caracterizacoes', car, achar)
  const analista = ehDiretorOuCentral(usuario) || usuario.papel === 'analista_sre'
  const status = String(car.status)
  const travado = status === 'aprovada' && !ehDiretorOuCentral(usuario)
  const salvou = (msg: string) => async () => {
    setSalvo(msg)
    await recarregar()
    setTimeout(() => setSalvo(null), 4000)
  }

  async function mostrarSensiveis() {
    await registrarAcesso(usuario, 'dados_sensiveis', `Dados de saúde/condições de ${aluno?.nome} (${processo?.codigo})`, String(demanda!.processo_id))
    setSensiveis(true)
  }

  return (
    <div className="max-w-4xl">
      <Link to={`/judicial/${demanda.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-marca-700">
        <ArrowLeft size={16} /> {String(processo?.codigo)}
      </Link>
      <h1 className="text-xl font-semibold text-slate-900">Caracterização da demanda de transporte escolar</h1>
      <p className="mt-1 text-sm text-slate-600">
        {String(aluno?.nome)} · SIMADE {String(aluno?.cod_simade)} · nasc. {formatarData(aluno?.data_nascimento)} · {String(escola?.nome ?? '')}
      </p>
      <p className="mt-1 text-sm">
        Situação: <strong>{STATUS_CARACTERIZACAO.find((s) => s.valor === status)?.rotulo}</strong>
        {Boolean(demanda.prazo_devolucao_formulario) && <span className="text-slate-500"> · devolver até {formatarData(demanda.prazo_devolucao_formulario)} (item 1.6)</span>}
      </p>
      <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Preencha todos os campos; os não aplicáveis devem ser marcados “não se aplica”. Os anexos da seção 8 são enviados na aba Documentos/Fluxo da demanda.
        Dados pessoais e de saúde: uso exclusivo para definir as condições de transporte (LGPD).
      </div>
      {salvo && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{salvo}</p>}

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">3. Responsável legal</h2>
        <FormularioRegistro
          key={`resp-${responsavel?.id ?? 'novo'}`}
          config={RESPONSAVEL}
          registro={responsavel}
          referencias={dados}
          valoresFixos={{ caracterizacao_id: car.id }}
          somenteLeitura={!pode || travado}
          aoCancelar={() => history.back()}
          aoSalvar={salvou('Responsável legal salvo.')}
        />
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-1 flex items-center gap-2 text-base font-semibold text-slate-900">
          <ShieldAlert size={18} className="text-amber-600" /> 5. Condições do estudante que influenciam o veículo
        </h2>
        <p className="mb-3 text-xs text-slate-500">Dados sensíveis de saúde (LGPD, art. 11). A exibição fica registrada no log de acessos.</p>
        {sensiveis ? (
          <FormularioRegistro
            key={`saude-${saude?.id ?? 'novo'}`}
            config={SAUDE}
            registro={saude}
            referencias={dados}
            valoresFixos={{ caracterizacao_id: car.id }}
            somenteLeitura={!pode || travado}
            aoCancelar={() => setSensiveis(false)}
            aoSalvar={salvou('Condições do estudante salvas.')}
          />
        ) : (
          <Botao variante="secundario" onClick={mostrarSensiveis}><Eye size={16} /> Exibir dados sensíveis</Botao>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Seções 2, 4, 6, 7, 8.12, 9 e 10</h2>
        <FormularioRegistro
          key={`car-${car.atualizado_em}`}
          config={CARACTERIZACAO}
          registro={car}
          referencias={dados}
          somenteLeitura={!pode || travado}
          rotuloSalvar="Salvar rascunho"
          aoCancelar={() => history.back()}
          aoSalvar={salvou('Formulário salvo.')}
          acoesExtras={(_, enviarCom) => (
            <>
              {(status === 'rascunho' || status === 'em_diligencia') && <Botao variante="secundario" onClick={() => enviarCom({ status: 'enviada' })}>Enviar formulário</Botao>}
              {status === 'enviada' && analista && (
                <>
                  <Botao variante="secundario" onClick={() => enviarCom({ status: 'em_diligencia' })}>Devolver (diligência)</Botao>
                  <Botao variante="secundario" onClick={() => enviarCom({ status: 'aprovada', analista_id: usuario.id })}>Aprovar</Botao>
                </>
              )}
            </>
          )}
        />
      </section>
    </div>
  )
}
