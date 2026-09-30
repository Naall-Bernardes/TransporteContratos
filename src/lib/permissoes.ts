// Quem vê e quem edita cada cadastro.
// No modo demonstração estas regras rodam no navegador; ao conectar o Supabase
// elas viram políticas de Row Level Security (RLS) no banco.

import type { Colecao, Consulta, Papel, Registro, Usuario } from './dados/tipos'

export const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  analista_central: 'Analista do órgão central',
  diretor_sre: 'Diretor DAFI (SRE)',
  analista_sre: 'Analista SRE',
}

export const ehCentral = (u: Usuario) => u.papel === 'admin' || u.papel === 'analista_central'

/** Cadastros que a SRE pode incluir/alterar (sempre dentro da própria regional). */
const EDITAVEIS_PELA_SRE: Colecao[] = ['caixas_escolares', 'alunos', 'transportadores']
/** Configurações de sistema: só o administrador altera. */
const SOMENTE_ADMIN: Colecao[] = ['usuarios']

export function podeEditarColecao(u: Usuario, colecao: Colecao): boolean {
  if (u.papel === 'admin') return true
  if (u.papel === 'analista_central') return !SOMENTE_ADMIN.includes(colecao)
  return EDITAVEIS_PELA_SRE.includes(colecao)
}

/**
 * SRE "dona" do registro. `null` = registro global (visível a todos),
 * como SREs, municípios, tipos de veículo, feriados e transportadores.
 */
export function sreDoRegistro(colecao: Colecao, r: Registro, consulta: Consulta): string | null {
  switch (colecao) {
    case 'escolas':
    case 'precos_referencia':
    case 'usuarios':
      return (r.sre_id as string | null) ?? null
    case 'caixas_escolares':
      return (consulta('escolas', r.escola_id)?.sre_id as string | undefined) ?? '__sem_sre__'
    case 'alunos':
      return (consulta('escolas', r.escola_atual_id)?.sre_id as string | undefined) ?? '__sem_sre__'
    default:
      return null
  }
}

export function podeVer(u: Usuario, colecao: Colecao, r: Registro, consulta: Consulta): boolean {
  if (ehCentral(u)) return true
  const sre = sreDoRegistro(colecao, r, consulta)
  return sre === null || sre === u.sre_id
}

export function podeEditar(u: Usuario, colecao: Colecao, r: Registro, consulta: Consulta): boolean {
  if (!podeEditarColecao(u, colecao)) return false
  if (ehCentral(u)) return true
  const sre = sreDoRegistro(colecao, r, consulta)
  return sre === null || sre === u.sre_id
}

export const podeVerAuditoria = ehCentral
