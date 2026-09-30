// Camada de acesso a dados. As telas só conversam com estas funções.
// Hoje gravam no navegador (modo demonstração); ao conectar o Supabase,
// só este arquivo e `armazenamento.ts` mudam — as telas continuam iguais.

import { podeEditar, podeEditarColecao, podeVer, podeVerAuditoria } from '../permissoes'
import { carregarBase, gravarBase } from './armazenamento'
import { normalizar, REFERENCIAS, validar } from './regras'
import type { Base, Colecao, Consulta, EntradaAuditoria, Operacao, Registro, Usuario } from './tipos'

export class ErroValidacao extends Error {
  erros: Record<string, string>
  constructor(erros: Record<string, string>) {
    super('Há campos com erro. Revise o formulário.')
    this.erros = erros
  }
}

export class ErroPermissao extends Error {}

const META = ['id', 'criado_em', 'criado_por', 'atualizado_em', 'atualizado_por']

function consultaDe(base: Base): Consulta {
  return (colecao, id) => (id ? base.colecoes[colecao].find((r) => r.id === id) : undefined)
}

function registrarAuditoria(
  base: Base,
  colecao: Colecao,
  registroId: string,
  operacao: Operacao,
  antes: Registro | null,
  depois: Registro | null,
  usuario: Usuario,
) {
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

const semMudanca = (a: Registro, b: Registro) =>
  Object.keys({ ...a, ...b })
    .filter((k) => !META.includes(k))
    .every((k) => (a[k] ?? null) === (b[k] ?? null))

export async function listar(colecao: Colecao, usuario: Usuario): Promise<Registro[]> {
  const base = carregarBase()
  const consulta = consultaDe(base)
  return base.colecoes[colecao].filter((r) => podeVer(usuario, colecao, r, consulta))
}

/** Lista sem filtro de permissão — usada apenas na tela de login do modo demonstração. */
export async function listarUsuariosParaLogin(): Promise<Usuario[]> {
  return carregarBase().colecoes.usuarios.filter((u) => u.ativo) as Usuario[]
}

export async function salvar(colecao: Colecao, dados: Record<string, unknown>, usuario: Usuario): Promise<Registro> {
  const base = carregarBase()
  const consulta = consultaDe(base)
  const lista = base.colecoes[colecao]
  const existente = dados.id ? lista.find((r) => r.id === dados.id) : undefined

  if (!podeEditarColecao(usuario, colecao)) throw new ErroPermissao('Seu perfil não pode alterar este cadastro.')
  if (existente && !podeEditar(usuario, colecao, existente, consulta))
    throw new ErroPermissao('Este registro pertence a outra SRE.')

  const campos = normalizar(colecao, dados, consulta)
  for (const m of META) delete campos[m]

  const agora = new Date().toISOString()
  const registro: Registro = existente
    ? { ...existente, ...campos, atualizado_em: agora, atualizado_por: usuario.id }
    : {
        ...campos,
        id: crypto.randomUUID(),
        criado_em: agora,
        criado_por: usuario.id,
        atualizado_em: agora,
        atualizado_por: usuario.id,
      }

  const erros = validar(colecao, registro, lista, consulta)
  if (Object.keys(erros).length > 0) throw new ErroValidacao(erros)
  if (!podeEditar(usuario, colecao, registro, consulta))
    throw new ErroPermissao('Você só pode cadastrar registros da sua SRE.')
  if (existente && semMudanca(existente, registro)) return existente

  base.colecoes[colecao] = existente ? lista.map((r) => (r.id === registro.id ? registro : r)) : [...lista, registro]
  registrarAuditoria(base, colecao, registro.id, existente ? 'UPDATE' : 'INSERT', existente ?? null, registro, usuario)
  gravarBase(base)
  return registro
}

export async function excluir(colecao: Colecao, id: string, usuario: Usuario): Promise<void> {
  const base = carregarBase()
  const consulta = consultaDe(base)
  const registro = base.colecoes[colecao].find((r) => r.id === id)
  if (!registro) return
  if (!podeEditar(usuario, colecao, registro, consulta)) throw new ErroPermissao('Seu perfil não pode excluir este registro.')
  if (colecao === 'usuarios' && id === usuario.id) throw new ErroPermissao('Você não pode excluir o próprio usuário.')

  const emUso = REFERENCIAS.filter((ref) => ref.alvo === colecao).find((ref) =>
    base.colecoes[ref.origem].some((r) => r[ref.campo] === id),
  )
  if (emUso)
    throw new ErroPermissao(
      'Este registro é usado em outros cadastros e não pode ser excluído. Se não for mais usado, marque-o como inativo.',
    )

  base.colecoes[colecao] = base.colecoes[colecao].filter((r) => r.id !== id)
  registrarAuditoria(base, colecao, id, 'DELETE', registro, null, usuario)
  gravarBase(base)
}

export async function listarAuditoria(usuario: Usuario): Promise<EntradaAuditoria[]> {
  if (!podeVerAuditoria(usuario)) throw new ErroPermissao('Seu perfil não pode consultar a auditoria.')
  return [...carregarBase().auditoria].reverse()
}
