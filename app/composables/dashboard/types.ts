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
  /** Тип підписанта: 'person' (КЕП особи) чи 'seal' (електронна печатка юрособи).
   *  Дефолт 'person' — зворотна сумісність (старі документи без печаток). */
  signer_type?: 'person' | 'seal'
  /** Дані печатки (тільки для signer_type='seal', після підпису). */
  organization?: string | null
  identifier?: string | null
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

/** Обраний у формі підписант — ПІБ+посада (із користувачів системи або вручну). */
export interface SignerUser {
  user_id?: number | null
  full_name: string
  position: string
  /** Тип підписанта: 'person' (КЕП особи, дефолт) чи 'seal' (електронна печатка
   *  юрособи/ФОП). Для seal повне_ім'я = назва юрособи. */
  signer_type?: 'person' | 'seal'
}

/** Користувач системи (для вибору погоджувачів/підписантів). */
export interface UserEntry {
  id: number
  name: string
  email: string
  position: string
  role?: string | null
  kep_subject_cn?: string | null
  kep_serial_number?: string | null
  kep_certificate_serial?: string | null
  /** CN сертифіката електронної печатки юрособи (окремо від КЕП особи). */
  organization_cert_cn?: string | null
  /** Контактні дані заявника: телефон і адреса проживання. */
  phone?: string | null
  address?: string | null
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
  addressees: string
  sender_contacts: string
  signers: string
  signerUsers: SignerUser[]
  journal_id?: number | null
  approval_type?: 'sequential' | 'parallel'
  approverUsers: ApproverUser[]
  pagination_barcode?: boolean
  control_executor_id?: number | null
  acknowledge_user_ids?: number[]
  related_doc_id?: string | null
  use_stamp?: boolean
  use_incoming_stamp?: boolean
  use_copy_stamp?: boolean
  use_control_stamp?: boolean
  restriction_stamp?: string
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

export interface AttachmentMeta {
  id: number
  order_index: number
  original_filename: string
  stored_filename: string
  mime: string
  size: number
  created_at: string
}
