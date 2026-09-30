// Ícone de cada etapa do fluxo Judicial/MP (usado no submenu).

import { ClipboardList, FileCheck2, FileSignature, Inbox, ListTree, type LucideIcon, Receipt, Send, ShieldCheck, Stamp, Truck } from 'lucide-react'

export const ICONE_ETAPA: Record<string, LucideIcon> = {
  J01: Inbox, // Recebimento
  J02: Send, // Encaminhamento
  J03: ClipboardList, // Caracterização
  J04: ShieldCheck, // Autorização do subsecretário
  J05: Stamp, // Registro do PAF
  J06: FileSignature, // Contratação pela Caixa Escolar
  J07: Truck, // Execução e fiscalização
  J08: Receipt, // Prestação de contas
  J09: FileCheck2, // Comprovação do cumprimento
}

export const iconeEtapa = (codigo: unknown): LucideIcon => ICONE_ETAPA[String(codigo)] ?? ListTree
