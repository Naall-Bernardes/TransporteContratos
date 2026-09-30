// Frota FICTÍCIA (veículos, motoristas, monitores) com documentos em situações variadas
// — em dia, a vencer, vencido, ausente — para demonstrar os controles de conformidade.

import { avaliarEntidade, condicoesDe, type Entidade } from '../conformidade'
import { somarDias, somarMeses } from '../datas'
import { cpfComDigitos } from '../validacao'
import type { Registro } from './tipos'

type Novo = (campos: Record<string, unknown>) => Registro
type Situacao = 'vencido' | 'a_vencer' | 'ausente'

export function criarFabricaFrota(novo: Novo, hoje: string, exigencias: Registro[]) {
  const veiculos: Registro[] = []
  const condutores: Registro[] = []
  const alocacoes: Registro[] = []
  const documentos: Registro[] = []
  const versoes: Registro[] = []
  let seqCpf = 300000001

  const campoDe: Record<Entidade, string> = { veiculo: 'veiculo_id', condutor: 'condutor_id', contratado: 'transportador_id' }

  /** Cria os documentos exigidos para a entidade; `excecoes` define os que ficam vencidos/a vencer/ausentes. */
  function documentar(entidade: Entidade, registro: Registro, excecoes: Record<string, Situacao> = {}) {
    const condicoes = condicoesDe(entidade, registro)
    for (const e of exigencias.filter((x) => x.aplica_a === entidade && condicoes.has(String(x.condicao)))) {
      const situacao = excecoes[String(e.codigo)]
      if (situacao === 'ausente') continue
      const meses = e.validade_meses === null || e.validade_meses === undefined ? null : Number(e.validade_meses)
      let data_documento = somarDias(hoje, -40)
      let data_validade: string | null = null
      if (meses === null) {
        data_validade = situacao === 'vencido' ? somarDias(hoje, -12) : situacao === 'a_vencer' ? somarDias(hoje, 18) : somarDias(hoje, 280)
        data_documento = [somarDias(data_validade, -365), somarDias(hoje, -40)].sort()[0]
      } else if (meses > 0) {
        if (situacao === 'vencido') data_documento = somarDias(somarMeses(hoje, -meses), -12)
        if (situacao === 'a_vencer') data_documento = somarDias(somarMeses(hoje, -meses), 18)
      }
      const doc = novo({
        processo_id: null,
        [campoDe[entidade]]: registro.id,
        tipo_documento_id: e.tipo_documento_id,
        numero_sei: null,
        data_documento,
        data_validade,
        versao_atual: 1,
        observacao: 'Documento fictício de demonstração.',
      })
      documentos.push(doc)
      versoes.push(novo({ documento_id: doc.id, versao: 1, nome_arquivo: `${e.codigo}.pdf`, mime: 'application/pdf', tamanho_bytes: 38000 + (documentos.length * 911) % 60000, arquivo_demo: true }))
    }
    return avaliarEntidade(entidade, registro, exigencias, documentos, hoje)
  }

  function veiculo(campos: Record<string, unknown>, excecoes: Record<string, Situacao> = {}) {
    const v = novo({ tipo_transporte: 'rodoviario', adaptado_pcd: false, ativo: true, ...campos })
    veiculos.push(v)
    documentar('veiculo', v, excecoes)
    return v
  }

  function condutor(campos: Record<string, unknown>, excecoes: Record<string, Situacao> = {}) {
    const motorista = (campos.funcao ?? 'motorista') === 'motorista'
    const c = novo({
      funcao: 'motorista',
      cpf: cpfComDigitos(String(seqCpf++)),
      data_nascimento: '1980-05-10',
      cnh_numero: motorista ? String(40000000000 + seqCpf) : null,
      cnh_categoria: motorista ? 'D' : null,
      // coerente com o documento da CNH gerado abaixo
      cnh_validade: motorista ? somarDias(hoje, excecoes.c_cnh === 'vencido' ? -12 : excecoes.c_cnh === 'a_vencer' ? 18 : 280) : null,
      telefone: '(00) 90000-0000',
      ativo: true,
      ...campos,
    })
    condutores.push(c)
    documentar('condutor', c, excecoes)
    return c
  }

  function alocar(campos: Record<string, unknown>) {
    alocacoes.push(novo({ inicio: somarDias(hoje, -200), fim: null, ...campos }))
  }

  return { veiculos, condutores, alocacoes, documentos, versoes, documentar, veiculo, condutor, alocar }
}
