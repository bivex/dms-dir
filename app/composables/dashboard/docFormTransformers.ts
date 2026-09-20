import type { DocForm, SignerEntry, ApproverEntry } from './types'

/**
 * Будує JSON payload форми документа для відправки на бекенд (POST /documents).
 */
export function buildDocPayload(form: DocForm) {
  const signerLines = form.signerUsers.map((u, i) => ({
    full_name: u.full_name,
    position: u.position,
    order_index: i,
    signer_type: u.signer_type ?? 'person'
  }))
  const approvers = form.approverUsers.map((u, i) => ({
    order_index: i,
    user_id: u.user_id,
    full_name: u.full_name,
    position: u.position
  }))
  return {
    doc_id: form.doc_id,
    org_name: form.org_name,
    subject_type: form.subject_type,
    doc_type: form.doc_type,
    fmt: form.fmt,
    title: form.title,
    date_text: form.date_text,
    reg_index: form.reg_index,
    place: form.place,
    body: form.body.split('\n').filter(Boolean),
    addressees: form.addressees ? form.addressees.split('\n\n').filter(Boolean).map(a => a.trim()).filter(Boolean) : [],
    sender_contacts: form.sender_contacts || '',
    signers: signerLines,
    journal_id: form.journal_id ? Number(form.journal_id) : null,
    approval_type: form.approval_type,
    approvers: approvers,
    pagination_barcode: !!form.pagination_barcode,
    use_stamp: form.stamp_type !== 'none',
    stamp_type: form.stamp_type === 'none' ? '' : (form.stamp_type || ''),
    use_incoming_stamp: !!form.use_incoming_stamp,
    use_copy_stamp: !!form.use_copy_stamp,
    use_control_stamp: !!form.use_control_stamp,
    use_handwritten_date_index: !!form.use_handwritten_date_index,
    restriction_stamp: form.restriction_stamp === 'none' ? '' : (form.restriction_stamp || ''),
    use_copy_mark: !!form.use_copy_mark,
    use_archived_stamp: !!form.use_archived_stamp,
    use_annulled_stamp: !!form.use_annulled_stamp,
    use_urgent_stamp: !!form.use_urgent_stamp,
    extra_stamps: form.extra_stamps || []
  }
}

/**
 * Скидає реактивні поля форми документа до початкових значень для нового документа.
 */
export function resetFormState(form: DocForm, handwrittenDefault: boolean, newDocId: string) {
  form.doc_id = newDocId
  form.title = ''
  form.reg_index = ''
  form.body = ''
  form.addressees = ''
  form.sender_contacts = ''
  form.signers = ''
  form.signerUsers = []
  form.journal_id = null
  form.approval_type = 'sequential'
  form.approverUsers = []
  form.pagination_barcode = false
  form.use_stamp = false
  form.stamp_type = 'none'
  form.use_incoming_stamp = false
  form.use_copy_stamp = false
  form.use_control_stamp = false
  form.use_handwritten_date_index = handwrittenDefault
  form.restriction_stamp = 'none'
  form.use_copy_mark = false
  form.use_archived_stamp = false
  form.use_annulled_stamp = false
  form.use_urgent_stamp = false
  form.extra_stamps = []
}

/**
 * Заповнює поля форми даними з відповіді API (GET /documents/{id}).
 */
export function applyDocResponseToForm(form: DocForm, full: any): {
  signerList: SignerEntry[]
  approverList: ApproverEntry[]
  isScanned: boolean
  status: string
} {
  form.doc_id = full.doc_id
  form.title = full.title
  form.doc_type = full.doc_type || ''
  form.fmt = full.fmt ?? 'pdf'
  form.signers = full.signers.map((s: any) => `${s.full_name} | ${s.position}`).join('\n')
  form.signerUsers = full.signers.map((s: any) => ({
    user_id: s.user_id ?? null,
    full_name: s.full_name,
    position: s.position,
    signer_type: (s.signer_type === 'seal' ? 'seal' : 'person')
  }))
  form.journal_id = full.journal_id ?? null
  form.approval_type = full.approval_type ?? 'sequential'
  form.approverUsers = full.approvers
    ? full.approvers
        .filter((a: any) => a.user_id)
        .map((a: any) => ({ user_id: a.user_id as number, full_name: a.full_name, position: a.position }))
    : []

  const rawCj = full.content_json
  let cj: Record<string, unknown> | undefined
  if (typeof rawCj === 'string') {
    try {
      cj = JSON.parse(rawCj)
    } catch {}
  } else if (rawCj && typeof rawCj === 'object') {
    cj = rawCj as Record<string, unknown>
  }
  if (cj) {
    form.org_name = String(cj.org_name ?? form.org_name)
    form.subject_type = String(cj.subject_type ?? form.subject_type)
    form.date_text = String(cj.date_text ?? '')
    form.reg_index = String(cj.reg_index ?? '')
    form.place = String(cj.place ?? '')
    if (cj.doc_type) form.doc_type = String(cj.doc_type)
    form.pagination_barcode = !!cj.pagination_barcode
    form.use_stamp = !!cj.use_stamp
    form.stamp_type = String(cj.stamp_type ?? '') || (cj.use_stamp ? 'documents' : 'none')
    form.use_incoming_stamp = !!cj.use_incoming_stamp
    form.use_copy_stamp = !!cj.use_copy_stamp
    form.use_control_stamp = !!cj.use_control_stamp
    form.use_handwritten_date_index = cj.use_handwritten_date_index !== undefined ? !!cj.use_handwritten_date_index : true
    form.restriction_stamp = String(cj.restriction_stamp ?? '') || 'none'
    form.use_copy_mark = !!cj.use_copy_mark
    form.use_archived_stamp = !!cj.use_archived_stamp
    form.use_annulled_stamp = !!cj.use_annulled_stamp
    form.use_urgent_stamp = !!cj.use_urgent_stamp
    form.extra_stamps = Array.isArray(cj.extra_stamps) ? cj.extra_stamps.map(String) : []
    const b = cj.body
    form.body = Array.isArray(b) ? b.join('\n') : String(b ?? '')
    const addrs = cj.addressees !== undefined && cj.addressees !== null ? cj.addressees : cj.addressee
    form.addressees = Array.isArray(addrs) ? addrs.join('\n\n') : String(addrs ?? '')
    form.sender_contacts = String(cj.sender_contacts ?? '')
  }
  if (full.reg_index) form.reg_index = String(full.reg_index)
  if (full.reg_date) form.date_text = String(full.reg_date)

  const isScanned = Boolean(full.is_scanned)
  const status = full.status

  const signerList: SignerEntry[] = full.signers.map((s: any) => ({
    name: s.full_name,
    position: s.position,
    status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending',
    signer_type: (s.signer_type === 'seal' ? 'seal' : 'person') as 'person' | 'seal',
    organization: s.organization ?? null,
    identifier: s.identifier ?? null
  }))

  const approverList: ApproverEntry[] = full.approvers ? full.approvers.map((a: any) => ({
    order_index: a.order_index,
    user_id: a.user_id ?? null,
    full_name: a.full_name,
    position: a.position,
    status: a.status,
    comment: a.comment,
    approved_at: a.approved_at
  })) : []

  return {
    signerList,
    approverList,
    isScanned,
    status
  }
}
