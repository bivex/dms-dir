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
  const viewerMode = ref<'pdf' | 'docx'>('pdf')
  const viewerLoading = ref(false)
  const viewerTitle = ref('')

  async function openViewer(target?: { doc_id: string, title?: string, fmt?: string }) {
    const docId = target?.doc_id ?? form.doc_id
    const docTitle = target?.title ?? form.title ?? docId
    const docFmt = target?.fmt ?? form.fmt
    viewerLoading.value = true
    viewerOpen.value = true
    viewerTitle.value = docTitle || docId
    viewerMode.value = docFmt === 'docx' ? 'docx' : 'pdf'
    if (viewerUrl.value) { URL.revokeObjectURL(viewerUrl.value); viewerUrl.value = '' }
    viewerHtml.value = ''
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const res = await fetch(`${apiBase}/documents/${docId}/download`, {
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

  return { viewerOpen, viewerUrl, viewerHtml, viewerMode, viewerLoading, viewerTitle, openViewer, previewDoc, openViewerInNewTab, closeViewer }
}
