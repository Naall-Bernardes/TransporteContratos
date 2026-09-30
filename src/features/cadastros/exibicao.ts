import { formatarCpfCnpj, formatarData, formatarMoeda, formatarNumero } from '@/lib/formatacao'
import type { Colecao, Registro } from '@/lib/dados/tipos'
import { ROTULO_REGISTRO, type CampoConfig } from './configuracoes'

export type Referencias = Partial<Record<Colecao, Registro[]>>

/** Texto exibido na tabela e no CSV para um campo de um registro. */
export function valorExibido(campo: CampoConfig, r: Registro, refs: Referencias): string {
  const v = r[campo.nome]
  if (v === null || v === undefined || v === '') return ''
  switch (campo.tipo) {
    case 'referencia': {
      const alvo = refs[campo.referencia!]?.find((x) => x.id === v)
      return alvo ? ROTULO_REGISTRO[campo.referencia!](alvo) : '(sem acesso)'
    }
    case 'selecao':
      return campo.opcoes?.find((o) => o.valor === v)?.rotulo ?? String(v)
    case 'booleano':
      return v ? 'Sim' : 'Não'
    case 'moeda':
      return formatarMoeda(v)
    case 'numero':
      return formatarNumero(v)
    case 'data':
      return formatarData(v)
    case 'mes':
      return String(v).split('-').reverse().join('/')
    case 'cpf_cnpj':
      return formatarCpfCnpj(v)
    default:
      return String(v)
  }
}
