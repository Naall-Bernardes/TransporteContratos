// Formulário que cria a contratação a partir de um ofício de intimação
// (usado na tela "Cadastro a partir de ofício" e dentro do próprio ofício).

import { useUsuario } from '@/features/auth/Sessao'
import { FormularioRegistro } from '@/features/cadastros/FormularioRegistro'
import { feriadosDe, iniciarCumprimento } from '@/lib/dados/servicos'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { hojeIso } from '@/lib/diasUteis'
import { prazoDaEtapa } from '@/lib/fluxo/sla'
import { INICIO_CUMPRIMENTO } from './configuracoes'

interface Props {
  oficio: Registro
  dados: Partial<Record<Colecao, Registro[]>>
  aoCancelar: () => void
  aoCriar: (demanda: Registro) => Promise<void> | void
}

export function IniciarContratacao({ oficio, dados, aoCancelar, aoCriar }: Props) {
  const usuario = useUsuario()
  const lista = (c: Colecao) => dados[c] ?? []
  return (
    <FormularioRegistro
      config={INICIO_CUMPRIMENTO}
      registro={null}
      referencias={dados}
      valoresPadrao={{
        escola_id: oficio.escola_id,
        caixa_escolar_id: lista('caixas_escolares').find((c) => c.escola_id === oficio.escola_id)?.id,
        prazo_judicial: oficio.prazo_resposta,
        prazo_devolucao_formulario: prazoDaEtapa(hojeIso(), 10, feriadosDe(lista)),
        decisao_resumo: oficio.assunto,
      }}
      acao={(v) => iniciarCumprimento(usuario, String(oficio.id), v)}
      rotuloSalvar="Cadastrar contratação"
      aoCancelar={aoCancelar}
      aoSalvar={aoCriar}
    />
  )
}
