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
  const scanDate = ref('')
  const scanUploading = ref(false)

  function openScanModal() {
    scanFile.value = null
    scanTitle.value = ''
    scanSigners.value = ''
    scanDate.value = ''
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
      // doc_id для скану: SCAN-<YYMMDD>-<4 Base36>. Компактніший за таймстемп
      // (14 цифр), але зберігає дату оцифрування + унікальний суфікс.
      const now = new Date()
      const ymd = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const suffix = Math.floor(Math.random() * 0xFFFFFF)
        .toString(36).toUpperCase().padStart(4, '0').slice(-4)
      const docId = `SCAN-${ymd}-${suffix}`
      const fd = new FormData()
      fd.append('file', scanFile.value)
      fd.append('doc_id', docId)
      fd.append('title', scanTitle.value || scanFile.value.name)
      fd.append('signers', scanSigners.value)
      if (scanDate.value) fd.append('scan_date', scanDate.value)
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

  return { scanModalOpen, scanFile, scanTitle, scanSigners, scanDate, scanUploading, openScanModal, uploadScan }
}
