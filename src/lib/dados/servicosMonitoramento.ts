// Processamento diário (simulado por botão no modo demonstração):
// gera os e-mails de alerta pendentes e as ocorrências automáticas de risco, sem duplicar.

import { hojeIso } from '../diasUteis'
import { detectarRiscos, gerarAlertas } from '../monitoramento'
import { ehCentral } from '../permissoes'
import { ErroPermissao, transacao } from './repositorio'
import { feriadosDe } from './servicos'
import type { Usuario } from './tipos'

export function processarAlertas(usuario: Usuario) {
  if (!ehCentral(usuario)) throw new ErroPermissao('Só o órgão central processa os alertas.')
  return transacao(usuario, (tx) => {
    const hoje = hojeIso()
    const existentes = new Set(tx.lista('alertas').map((a) => String(a.chave)))
    let novos = 0
    for (const a of gerarAlertas(tx.lista, hoje, feriadosDe(tx.lista))) {
      if (existentes.has(a.chave)) continue
      existentes.add(a.chave) // o mesmo contratado/veículo pode aparecer em mais de um contrato
      const usuarios = a.destinatario_ids.map((id) => tx.consulta('usuarios', id)).filter(Boolean)
      tx.salvar('alertas', {
        chave: a.chave,
        tipo: a.tipo,
        nivel: a.nivel,
        titulo: a.titulo,
        mensagem: a.mensagem,
        processo_id: a.processo_id,
        instrumento_id: a.instrumento_id,
        sre_id: a.sre_id,
        destinatarios: usuarios.map((u) => `${u!.nome} <${u!.email}>`),
        gerado_em: hoje,
        enviado_em: new Date().toISOString(),
      })
      novos++
    }
    return novos
  })
}

export function verificarGatilhosDeRisco(usuario: Usuario) {
  if (!ehCentral(usuario)) throw new ErroPermissao('Só o órgão central executa a verificação automática de riscos.')
  return transacao(usuario, (tx) => {
    const hoje = hojeIso()
    const existentes = new Set(tx.lista('risco_ocorrencias').map((o) => String(o.chave_automatica ?? '')))
    let novas = 0
    for (const g of detectarRiscos(tx.lista, hoje, feriadosDe(tx.lista))) {
      if (existentes.has(g.chave_automatica)) continue
      existentes.add(g.chave_automatica)
      const risco = tx.lista('riscos').find((r) => r.gatilho === g.gatilho && r.status !== 'encerrado')
      if (!risco) continue
      tx.salvar('risco_ocorrencias', {
        risco_id: risco.id,
        processo_id: g.processo_id,
        instrumento_id: g.instrumento_id,
        data: hoje,
        descricao: g.descricao,
        origem: 'automatica',
        chave_automatica: g.chave_automatica,
        status: 'aberta',
      })
      novas++
    }
    return novas
  })
}
