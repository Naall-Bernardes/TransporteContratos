// Operações do repositório de documentos: envio, nova versão, abertura (com log) e ZIP.

import JSZip from 'jszip'
import { carregarBase } from '../dados/armazenamento'
import { ErroRegra, registrarAcesso, transacao } from '../dados/repositorio'
import { TAMANHO_MAXIMO_ARQUIVO, TIPOS_ARQUIVO_ACEITOS } from '../dados/regrasModulos'
import type { Registro, Usuario } from '../dados/tipos'
import { formatarData } from '../formatacao'
import { gravarArquivo, hashSha256, lerArquivo, pdfFicticio } from './arquivos'

export interface MetadadosDocumento {
  processo_id?: string | null
  veiculo_id?: string | null
  condutor_id?: string | null
  transportador_id?: string | null
  data_validade?: string | null
  tipo_documento_id: string
  numero_sei?: string | null
  data_documento: string
  observacao?: string | null
  etapa_codigo?: string | null
  aluno_id?: string | null
  instrumento_id?: string | null
  aditivo_id?: string | null
  prestacao_id?: string | null
  /** Resposta da regional a que o documento pertence (tramitação do ofício). */
  consulta_id?: string | null
}

function conferirArquivo(arquivo: File) {
  if (!TIPOS_ARQUIVO_ACEITOS.includes(arquivo.type)) throw new ErroRegra('Formato não aceito. Envie PDF ou imagem (JPG, PNG, WEBP).')
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) throw new ErroRegra(`Arquivo com ${(arquivo.size / 1048576).toFixed(1)} MB: o limite é 20 MB.`)
}

export async function enviarDocumento(usuario: Usuario, meta: MetadadosDocumento, arquivo: File) {
  conferirArquivo(arquivo)
  const hash = await hashSha256(arquivo)
  const { documento, versao } = await transacao(usuario, (tx) => {
    const documento = tx.salvar('documentos', { ...meta, versao_atual: 1 })
    const versao = tx.salvar('documento_versoes', {
      documento_id: documento.id,
      versao: 1,
      nome_arquivo: arquivo.name,
      mime: arquivo.type,
      tamanho_bytes: arquivo.size,
      hash_sha256: hash,
    })
    return { documento, versao }
  })
  await gravarArquivo(versao.id, arquivo)
  return documento
}

/** Nova versão: a anterior é preservada (nada é apagado). */
export async function enviarNovaVersao(usuario: Usuario, documentoId: string, arquivo: File, motivo: string) {
  conferirArquivo(arquivo)
  const hash = await hashSha256(arquivo)
  const versao = await transacao(usuario, (tx) => {
    const doc = tx.consulta('documentos', documentoId)!
    const numero = Number(doc.versao_atual) + 1
    const v = tx.salvar('documento_versoes', {
      documento_id: documentoId,
      versao: numero,
      nome_arquivo: arquivo.name,
      mime: arquivo.type,
      tamanho_bytes: arquivo.size,
      hash_sha256: hash,
      motivo,
    })
    tx.salvar('documentos', { id: documentoId, versao_atual: numero })
    return v
  })
  await gravarArquivo(versao.id, arquivo)
}

async function arquivoDaVersao(versao: Registro): Promise<Blob> {
  const salvo = await lerArquivo(versao.id)
  if (salvo) return salvo
  // Documentos fictícios da demonstração não têm arquivo real: gera um PDF ilustrativo.
  const base = carregarBase()
  const doc = base.colecoes.documentos.find((d) => d.id === versao.documento_id)
  const tipo = base.colecoes.tipos_documento.find((t) => t.id === doc?.tipo_documento_id)
  const processo = base.colecoes.processos.find((p) => p.id === doc?.processo_id)
  return pdfFicticio([
    String(tipo?.nome ?? 'Documento'),
    `Processo ${processo?.codigo ?? ''} - SEI ${doc?.numero_sei ?? '-'}`,
    `Data do documento: ${formatarData(doc?.data_documento)} - versao ${versao.versao}`,
    'DOCUMENTO FICTICIO GERADO PARA DEMONSTRACAO DO SISTEMA.',
  ])
}

/**
 * Abre (ou baixa) uma versão e registra o acesso (LGPD).
 * O link gerado é temporário: expira em 60 segundos (como a URL assinada do Supabase).
 */
export async function acessarVersao(usuario: Usuario, versao: Registro, acao: 'visualizar' | 'baixar') {
  const blob = await arquivoDaVersao(versao)
  const doc = carregarBase().colecoes.documentos.find((d) => d.id === versao.documento_id)
  await registrarAcesso(usuario, acao, `${acao === 'baixar' ? 'Download' : 'Visualização'} de ${versao.nome_arquivo} (v${versao.versao})`, (doc?.processo_id as string) ?? null, versao.id)
  const url = URL.createObjectURL(blob)
  if (acao === 'visualizar') window.open(url, '_blank', 'noopener')
  else {
    const a = document.createElement('a')
    a.href = url
    a.download = String(versao.nome_arquivo)
    a.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** ZIP com a versão atual de cada documento (pastas por tipo). */
export async function baixarZip(usuario: Usuario, documentos: Registro[], nomeZip: string, processoId: string | null) {
  const base = carregarBase()
  const zip = new JSZip()
  for (const doc of documentos) {
    const versao = base.colecoes.documento_versoes.find((v) => v.documento_id === doc.id && v.versao === doc.versao_atual)
    if (!versao) continue
    const tipo = String(base.colecoes.tipos_documento.find((t) => t.id === doc.tipo_documento_id)?.nome ?? 'Outros').replace(/[\\/:*?"<>|]/g, '-')
    zip.file(`${tipo}/${doc.data_documento}_v${versao.versao}_${versao.nome_arquivo}`, await arquivoDaVersao(versao))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  await registrarAcesso(usuario, 'zip', `Download em lote (${documentos.length} documentos): ${nomeZip}`, processoId)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeZip
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
