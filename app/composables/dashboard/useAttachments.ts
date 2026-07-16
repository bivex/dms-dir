import type { Ref } from 'vue'
import type { AttachmentMeta } from './types'

export function useAttachments(deps: {
  token: Ref<string | null>
  docId: Ref<string | null>
  isLocked: Ref<boolean>
}) {
  const toast = useToast()
  const { token, docId, isLocked } = deps

  const attachments = ref<AttachmentMeta[]>([])
  const uploading = ref(false)

  async function fetchAttachments() {
    if (!docId.value) {
      attachments.value = []
      return
    }
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const res = await fetch(`${apiBase}/documents/${docId.value}/attachments`, {
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      attachments.value = await res.json()
    } catch (e) {
      toast.add({ title: 'Помилка завантаження додатків', description: String(e), color: 'error' })
    }
  }

  async function uploadAttachment(file: File) {
    if (isLocked.value) {
      toast.add({ title: 'Документ заблоковано', description: 'Редагування додатків неможливе', color: 'warning' })
      return
    }
    if (!docId.value) return
    uploading.value = true
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${apiBase}/documents/${docId.value}/attachments`, {
        method: 'POST',
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
        body: fd
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const newAtt = await res.json()
      toast.add({ title: 'Додаток додано', description: newAtt.original_filename, color: 'success' })
      await fetchAttachments()
    } catch (e) {
      toast.add({ title: 'Помилка завантаження файлу', description: String(e), color: 'error' })
    } finally {
      uploading.value = false
    }
  }

  async function downloadAttachment(att: AttachmentMeta) {
    if (!docId.value) return
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const res = await fetch(`${apiBase}/documents/${docId.value}/attachments/${att.id}`, {
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = att.original_filename || att.stored_filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      toast.add({ title: 'Помилка завантаження файлу', description: String(e), color: 'error' })
    }
  }

  async function removeAttachment(attId: number) {
    if (isLocked.value) {
      toast.add({ title: 'Документ заблоковано', description: 'Редагування додатків неможливе', color: 'warning' })
      return
    }
    if (!docId.value) return
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const res = await fetch(`${apiBase}/documents/${docId.value}/attachments/${attId}`, {
        method: 'DELETE',
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      toast.add({ title: 'Додаток видалено', color: 'success' })
      await fetchAttachments()
    } catch (e) {
      toast.add({ title: 'Помилка видалення додатка', description: String(e), color: 'error' })
    }
  }

  async function toggleAttachmentStamp(docIdVal: string, att: AttachmentMeta) {
    if (isLocked.value) {
      toast.add({ title: 'Документ заблоковано', description: 'Редагування додатків неможливе', color: 'warning' })
      att.use_incoming_stamp = !att.use_incoming_stamp
      return
    }
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const res = await fetch(`${apiBase}/documents/${docIdVal}/attachments/${att.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token.value ? { Authorization: `Bearer ${token.value}` } : {})
        },
        body: JSON.stringify({
          use_incoming_stamp: att.use_incoming_stamp
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const updated = await res.json()
      toast.add({
        title: updated.use_incoming_stamp ? 'Вхідний штамп увімкнено' : 'Вхідний штамп вимкнено',
        color: 'success'
      })
      await fetchAttachments()
    } catch (e) {
      att.use_incoming_stamp = !att.use_incoming_stamp
      toast.add({ title: 'Помилка оновлення штампа', description: String(e), color: 'error' })
    }
  }

  return {
    attachments,
    uploading,
    fetchAttachments,
    uploadAttachment,
    downloadAttachment,
    removeAttachment,
    toggleAttachmentStamp
  }
}
