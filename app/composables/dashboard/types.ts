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
  reg_index?: string | null
  reg_date?: string | null
  org_name?: string | null
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

export interface ApproverEntry {
  order_index: number
  user_id?: number | null
  full_name: string
  position: string
  status: 'waiting' | 'invited' | 'approved' | 'rejected'
  comment?: string | null
  approved_at?: string | null
}

/** Обраний у формі погоджувач — посилання на реального користувача системи. */
export interface ApproverUser {
  user_id: number
  full_name: string
  position: string
}

/** Користувач системи (для вибору погоджувачів/підписантів). */
export interface UserEntry {
  id: number
  name: string
  email: string
  position: string
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
  journal_id?: number | null
  approval_type?: 'sequential' | 'parallel'
  approverUsers: ApproverUser[]
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
