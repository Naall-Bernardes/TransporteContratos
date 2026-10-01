// Ícone de cada etapa do fluxo Judicial/MP (usado no submenu).

import { ClipboardList, FileSignature, ListTree, type LucideIcon, ShieldCheck, Stamp } from 'lucide-react'

export const ICONE_ETAPA: Record<string, LucideIcon> = {
  C01: ClipboardList, // Caracterização
  C02: ShieldCheck, // Autorização
  C03: Stamp, // Registro do PAF
  C04: FileSignature, // Contratos (com a aba Execução e fiscalização)
}

export const iconeEtapa = (codigo: unknown): LucideIcon => ICONE_ETAPA[String(codigo)] ?? ListTree
