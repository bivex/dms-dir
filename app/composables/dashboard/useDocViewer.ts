import type { Ref } from 'vue'
import type { DocForm, DocEntry } from './types'

/**
 * Вьювер документів (PDF iframe + DOCX→HTML через mammoth).
 * Залежності: auth-токен + форма (fallback doc_id/title/fmt).
 */
export function useDocViewer(deps: {
  token: Ref<string | null>
  form: DocForm
}) {
  const toast = useToast()
  const { token, form } = deps

  const viewerOpen = ref(false)
  const viewerUrl = ref<string>('')
  const viewerHtml = ref<string>('')
  const viewerMode = ref<'pdf' | 'docx' | 'image' | 'unsupported'>('pdf')
  const viewerLoading = ref(false)
  const viewerTitle = ref('')
  const viewerDownloadAction = ref<(() => void) | null>(null)

  async function openViewer(target?: { doc_id: string, title?: string, fmt?: string, merged?: boolean, visa?: boolean }) {
    const docId = target?.doc_id ?? form.doc_id
    const docTitle = target?.title ?? form.title ?? docId
    const docFmt = target?.fmt ?? form.fmt
    const isMerged = target?.merged ?? false
    const withVisa = target?.visa ?? false

    viewerLoading.value = true
    viewerOpen.value = true
    viewerTitle.value = isMerged ? `${docTitle || docId} (з додатками)` : (docTitle || docId)
    viewerMode.value = isMerged ? 'pdf' : (docFmt === 'docx' ? 'docx' : 'pdf')
    
    if (viewerUrl.value) { URL.revokeObjectURL(viewerUrl.value); viewerUrl.value = '' }
    viewerHtml.value = ''

    if (isMerged) {
      viewerDownloadAction.value = async () => {
        try {
          const apiBase = useRuntimeConfig().public.apiBase
          const base = `${apiBase}/documents/${docId}/merged-pdf`
          window.open(withVisa ? `${base}?visa=true` : base, '_blank')
        } catch (e) {
          toast.add({ title: 'Помилка завантаження', description: String(e), color: 'error' })
        }
      }
    } else {
      viewerDownloadAction.value = null
    }

    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const mergedBase = `/documents/${docId}/merged-pdf`
      const mergedUrl = withVisa ? `${mergedBase}?visa=true` : mergedBase
      const endpoint = isMerged ? mergedUrl : `/documents/${docId}/download`
      const res = await fetch(`${apiBase}${endpoint}`, {
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (viewerMode.value === 'docx') {
        const mammoth = await import('mammoth')
        const buf = await blob.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        viewerHtml.value = result.value || '<p class="text-muted">Порожній документ</p>'
      }
      else {
        viewerUrl.value = URL.createObjectURL(blob)
      }
    }
    catch (e: unknown) {
      viewerOpen.value = false
      toast.add({ title: 'Не вдалося відкрити документ', description: String(e), color: 'error' })
    }
    finally {
      viewerLoading.value = false
    }
  }

  async function openAttachmentViewer(docId: string, att: { id: number, original_filename: string, stored_filename: string, mime: string }) {
    viewerLoading.value = true
    viewerOpen.value = true
    viewerTitle.value = att.original_filename
    
    const ext = att.stored_filename.split('.').pop()?.toLowerCase() || ''
    if (['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext)) {
      viewerMode.value = 'image'
    } else if (ext === 'docx') {
      viewerMode.value = 'docx'
    } else if (ext === 'pdf') {
      viewerMode.value = 'pdf'
    } else {
      viewerMode.value = 'unsupported'
    }

    if (viewerUrl.value) { URL.revokeObjectURL(viewerUrl.value); viewerUrl.value = '' }
    viewerHtml.value = ''

    // Set the custom download action
    viewerDownloadAction.value = async () => {
      try {
        const apiBase = useRuntimeConfig().public.apiBase
        const res = await fetch(`${apiBase}/documents/${docId}/attachments/${att.id}`, {
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

    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const res = await fetch(`${apiBase}/documents/${docId}/attachments/${att.id}`, {
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      
      if (viewerMode.value === 'docx') {
        const mammoth = await import('mammoth')
        const buf = await blob.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer: buf })
        viewerHtml.value = result.value || '<p class="text-muted">Порожній документ</p>'
      }
      else if (viewerMode.value === 'pdf' || viewerMode.value === 'image') {
        viewerUrl.value = URL.createObjectURL(blob)
      }
    }
    catch (e: unknown) {
      viewerOpen.value = false
      toast.add({ title: 'Не вдалося відкрити додаток', description: String(e), color: 'error' })
    }
    finally {
      viewerLoading.value = false
    }
  }

  function previewDoc(doc: DocEntry) {
    openViewer({ doc_id: doc.doc_id, title: doc.title, fmt: doc.fmt })
  }

  function openViewerInNewTab() {
    if (viewerUrl.value) window.open(viewerUrl.value, '_blank')
  }

  function closeViewer() {
    viewerOpen.value = false
    if (viewerUrl.value) {
      URL.revokeObjectURL(viewerUrl.value)
      viewerUrl.value = ''
    }
    viewerHtml.value = ''
  }

  return {
    viewerOpen,
    viewerUrl,
    viewerHtml,
    viewerMode,
    viewerLoading,
    viewerTitle,
    viewerDownloadAction,
    openViewer,
    openAttachmentViewer,
    previewDoc,
    openViewerInNewTab,
    closeViewer
  }
}
