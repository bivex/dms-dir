import type { Ref } from 'vue'
import type { DocEntry } from './types'

/**
 * Оцифрування: заливка скану (FormData → /documents/scan).
 * Після успіху — refreshAll + selectDoc готового документа (через колбеки).
 */
export function useScanUpload(deps: {
  token: Ref<string | null>
  refreshAll: () => Promise<void>
  selectDoc: (doc: DocEntry) => Promise<void>
}) {
  const toast = useToast()
  const { token, refreshAll, selectDoc } = deps

  const scanModalOpen = ref(false)
  const scanFile = ref<File | null>(null)
  const scanTitle = ref('')
  const scanSigners = ref('')
  const scanUploading = ref(false)

  function openScanModal() {
    scanFile.value = null
    scanTitle.value = ''
    scanSigners.value = ''
    scanModalOpen.value = true
  }

  async function uploadScan() {
    if (!scanFile.value) {
      toast.add({ title: 'Оберіть файл скану', color: 'warning' })
      return
    }
    scanUploading.value = true
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      const docId = `SCAN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
      const fd = new FormData()
      fd.append('file', scanFile.value)
      fd.append('doc_id', docId)
      fd.append('title', scanTitle.value || scanFile.value.name)
      fd.append('signers', scanSigners.value)
      const res = await fetch(`${apiBase}/documents/scan`, {
        method: 'POST',
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
        body: fd
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      const doc = await res.json()
      toast.add({ title: 'Скан оцифровано', description: `${doc.doc_id} — готовий до підпису`, color: 'success' })
      scanModalOpen.value = false
      await refreshAll()
      await selectDoc({ doc_id: doc.doc_id } as DocEntry)
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка заливки скану', description: String(e), color: 'error' })
    }
    finally {
      scanUploading.value = false
    }
  }

  return { scanModalOpen, scanFile, scanTitle, scanSigners, scanUploading, openScanModal, uploadScan }
}
