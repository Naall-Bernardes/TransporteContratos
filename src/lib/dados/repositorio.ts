// Camada de acesso a dados. As telas só conversam com estas funções.
// Hoje gravam no navegador (modo demonstração); ao conectar o Supabase,
// só esta pasta muda — as telas continuam iguais.
//
// Toda gravação passa por `transacao`: trabalha numa cópia dos dados e só grava
// se tudo der certo (equivale a BEGIN/COMMIT no banco). Assim, operações que mexem
// em várias tabelas (ex.: criar demanda + processo + 1ª etapa) nunca ficam pela metade.

import { gerarCodigoUnico } from '../codigoUnico'
import { podeEditar, podeEditarColecao, podeVer, podeVerAuditoria } from '../permissoes'
import { carregarBase, gravarBase } from './armazenamento'
import { normalizar, REFERENCIAS, validar } from './regras'
import type { ContextoValidacao } from './regrasContratos'
import type { Base, Colecao, Consulta, EntradaAcesso, EntradaAuditoria, Operacao, Registro, Usuario } from './tipos'

export class ErroValidacao extends Error {
  erros: Record<string, string>
  constructor(erros: Record<string, string>) {
    super(erros._geral ?? 'Há campos com erro. Revise o formulário.')
    this.erros = erros
  }
}

export class ErroPermissao extends Error {}

/** Erro de regra de negócio sem campo específico (ex.: etapa com pendências). */
export class ErroRegra extends Error {}

const META = ['id', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']

export function consultaDe(base: Base): Consulta {
  return (colecao, id) => (id ? base.colecoes[colecao].find((r) => r.id === id) : undefined)
}

function registrarAuditoria(base: Base, colecao: Colecao, registroId: string, operacao: Operacao, antes: Registro | null, depois: Registro | null, usuario: Usuario) {
  const entrada: EntradaAuditoria = {
    id: crypto.randomUUID(),
    colecao,
    registro_id: registroId,
    operacao,
    antes,
    depois,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
    em: new Date().toISOString(),
  }
  base.auditoria.push(entrada)
}

const igual = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const semMudanca = (a: Registro, b: Registro) =>
  Object.keys({ ...a, ...b })
    .filter((k) => !META.includes(k))
    .every((k) => igual(a[k], b[k]))

/** Operações disponíveis dentro de uma transação. */
export interface Tx {
  base: Base
  usuario: Usuario
  consulta: Consulta
  lista: (colecao: Colecao) => Registro[]
  salvar: (colecao: Colecao, dados: Record<string, unknown>) => Registro
  excluir: (colecao: Colecao, id: string) => void
}

function criarTx(base: Base, usuario: Usuario): Tx {
  const consulta = consultaDe(base)
  const tx: Tx = {
    base,
    usuario,
    consulta,
    lista: (c) => base.colecoes[c],
    salvar: (colecao, dados) => {
      const lista = base.colecoes[colecao]
      const existente = dados.id ? lista.find((r) => r.id === dados.id) : undefined

      if (!podeEditarColecao(usuario, colecao)) throw new ErroPermissao('Seu perfil não pode alterar este cadastro.')
      if (existente && !podeEditar(usuario, colecao, existente, consulta)) throw new ErroPermissao('Este registro pertence a outra SRE.')

      const campos = normalizar(colecao, dados, consulta)
      for (const m of META) delete campos[m]

      const agora = new Date().toISOString()
      const registro: Registro = existente
        ? { ...existente, ...campos, atualizado_em: agora, atualizado_por: usuario.id }
        : { ...campos, id: crypto.randomUUID(), criado_em: agora, criado_por: usuario.id, atualizado_em: agora, atualizado_por: usuario.id }

      const ctx: ContextoValidacao = {
        consulta,
        irmaos: (c, instrumentoId) => base.colecoes[c].filter((x) => x.instrumento_id === instrumentoId && x.id !== registro.id),
        lista: (c) => base.colecoes[c].filter((x) => x.id !== registro.id),
        anterior: existente,
        usuario,
        usuarioEhAdmin: usuario.papel === 'admin',
      }
      const erros = validar(colecao, registro, lista, ctx)
      if (Object.keys(erros).length > 0) throw new ErroValidacao(erros)
      if (!podeEditar(usuario, colecao, registro, consulta)) throw new ErroPermissao('Você só pode cadastrar registros da sua SRE.')
      if (existente && semMudanca(existente, registro)) return existente

      if (colecao === 'instrumentos' && !registro.processo_id) criarProcessoDoInstrumento(tx, registro)

      base.colecoes[colecao] = existente ? lista.map((r) => (r.id === registro.id ? registro : r)) : [...lista, registro]
      registrarAuditoria(base, colecao, registro.id, existente ? 'UPDATE' : 'INSERT', existente ?? null, registro, usuario)
      return registro
    },
    excluir: (colecao, id) => {
      const registro = base.colecoes[colecao].find((r) => r.id === id)
      if (!registro) return
      if (!podeEditar(usuario, colecao, registro, consulta)) throw new ErroPermissao('Seu perfil não pode excluir este registro.')
      if (colecao === 'usuarios' && id === usuario.id) throw new ErroPermissao('Você não pode excluir o próprio usuário.')
      if (colecao === 'documentos' || colecao === 'documento_versoes')
        throw new ErroPermissao('Documentos não são excluídos: envie uma nova versão (a anterior é preservada).')

      const emUso = REFERENCIAS.filter((ref) => ref.alvo === colecao).find((ref) => base.colecoes[ref.origem].some((r) => r[ref.campo] === id))
      if (emUso)
        throw new ErroPermissao('Este registro é usado em outros cadastros e não pode ser excluído. Se não for mais usado, marque-o como inativo.')

      base.colecoes[colecao] = base.colecoes[colecao].filter((r) => r.id !== id)
      registrarAuditoria(base, colecao, id, 'DELETE', registro, null, usuario)

      // O processo criado junto com o instrumento avulso sai junto, se nada mais o usa.
      if (colecao === 'instrumentos' && registro.processo_id) {
        const processo = consulta('processos', registro.processo_id)
        const aindaUsado = REFERENCIAS.filter((ref) => ref.alvo === 'processos').some((ref) =>
          base.colecoes[ref.origem].some((r) => r[ref.campo] === registro.processo_id),
        )
        if (processo && !aindaUsado) {
          base.colecoes.processos = base.colecoes.processos.filter((p) => p.id !== processo.id)
          registrarAuditoria(base, 'processos', processo.id, 'DELETE', processo, null, usuario)
        }
      }
    },
  }
  return tx
}

/** Executa várias gravações de forma atômica: ou todas valem, ou nenhuma. */
export async function transacao<T>(usuario: Usuario, operacoes: (tx: Tx) => T): Promise<T> {
  const copia = structuredClone(carregarBase())
  const resultado = operacoes(criarTx(copia, usuario))
  gravarBase(copia)
  return resultado
}

export async function listar(colecao: Colecao, usuario: Usuario): Promise<Registro[]> {
  const base = carregarBase()
  const consulta = consultaDe(base)
  return base.colecoes[colecao].filter((r) => podeVer(usuario, colecao, r, consulta))
}

/** Lista sem filtro de permissão — usada apenas na tela de login do modo demonstração. */
export async function listarUsuariosParaLogin(): Promise<Usuario[]> {
  return carregarBase().colecoes.usuarios.filter((u) => u.ativo) as Usuario[]
}

export const salvar = (colecao: Colecao, dados: Record<string, unknown>, usuario: Usuario) =>
  transacao(usuario, (tx) => tx.salvar(colecao, dados))

export const excluir = (colecao: Colecao, id: string, usuario: Usuario) => transacao(usuario, (tx) => tx.excluir(colecao, id))

/** Gera um processo (código único) para um registro-eixo: demanda, adesão PTE ou instrumento avulso. */
export function criarProcesso(tx: Tx, modulo: 'JUDICIAL' | 'PTE', dados: { ano: number; sre_id: unknown; municipio_id?: unknown; numero_sei: unknown }): Registro {
  const chave =
    modulo === 'JUDICIAL'
      ? String(tx.consulta('sres', dados.sre_id)?.sigla ?? 'XXX')
      : String(tx.consulta('municipios', dados.municipio_id)?.cod_ibge ?? '0000000')
  const codigo = gerarCodigoUnico(modulo, dados.ano, chave, tx.lista('processos').map((p) => String(p.codigo)))
  return tx.salvar('processos', {
    codigo,
    modulo,
    ano: dados.ano,
    numero_sei: dados.numero_sei,
    sre_id: dados.sre_id,
    municipio_id: modulo === 'PTE' ? dados.municipio_id : null,
  })
}

/** Instrumento cadastrado avulso (sem demanda/adesão) ganha processo próprio. */
function criarProcessoDoInstrumento(tx: Tx, instrumento: Registro) {
  const judicial = instrumento.tipo === 'contrato_caixa'
  const processo = criarProcesso(tx, judicial ? 'JUDICIAL' : 'PTE', {
    ano: Number(String(instrumento.data_assinatura).slice(0, 4)),
    sre_id: instrumento.sre_id,
    municipio_id: instrumento.municipio_id,
    numero_sei: instrumento.numero_sei,
  })
  instrumento.processo_id = processo.id
}

export async function listarAuditoria(usuario: Usuario): Promise<EntradaAuditoria[]> {
  if (!podeVerAuditoria(usuario)) throw new ErroPermissao('Seu perfil não pode consultar a auditoria.')
  return [...carregarBase().auditoria].reverse()
}

// ---------- Log de acesso (LGPD) ----------

export async function registrarAcesso(
  usuario: Usuario,
  acao: EntradaAcesso['acao'],
  descricao: string,
  processoId: string | null = null,
  versaoId: string | null = null,
) {
  const base = carregarBase()
  base.acessos.push({
    id: crypto.randomUUID(),
    acao,
    descricao,
    processo_id: processoId,
    documento_versao_id: versaoId,
    usuario_id: usuario.id,
    usuario_nome: usuario.nome,
    em: new Date().toISOString(),
  })
  gravarBase(base)
}

export async function listarAcessos(usuario: Usuario): Promise<EntradaAcesso[]> {
  if (!podeVerAuditoria(usuario)) throw new ErroPermissao('Seu perfil não pode consultar o log de acessos.')
  return [...carregarBase().acessos].reverse()
}
