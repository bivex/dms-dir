/**
 * Спільні типи для дашборду документообігу.
 */

export interface DocEntry {
  doc_id: string
  title: string
  doc_type: string
  status: string
  fmt?: string
  created_at: string
  registered_at?: string | null
  archived?: boolean
  folder_id?: number | null
}

export interface FolderEntry {
  id: number
  name: string
  color?: string | null
  position: number
  doc_count?: number
}

export interface ValidationReport {
  compliant: boolean
  rules_passed: number
  findings: Array<{ rule: string; message: string }>
}

export interface PdfaInfo {
  conforms: boolean
  findings: string[]
}

export interface SignerEntry {
  name: string
  position: string
  status: 'pending' | 'signed' | 'rejected'
}

/** Реактивна форма картки документа. */
export type DocForm = {
  doc_id: string
  org_name: string
  subject_type: string
  doc_type: string
  fmt: string
  title: string
  date_text: string
  reg_index: string
  body: string
  signers: string
}

export interface CounterpartyEntry {
  id: number
  name: string
  code: string
  subject_type: 'legal' | 'fop' | 'person'
  email?: string | null
  phone?: string | null
  address?: string | null
  created_at?: string | null
}

export type UiColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
