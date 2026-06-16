import type { Ref } from 'vue'

/**
 * Composable для імпорту/експорту документів із JSON-бекапу.
 */
export function useImport(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  token: Ref<string | null>
  reloadDocs: () => Promise<void>
}) {
  const toast = useToast()
  const { apiFetch, token, reloadDocs } = deps

  const importModalOpen = ref(false)
  const importFile = ref<File | null>(null)
  const importPreview = ref<{ doc_id: string; title: string; status: string }[]>([])
  const importing = ref(false)
  const exporting = ref(false)
  const importResult = ref<{ imported: number; skipped: number; errors: string[] } | null>(null)

  function openImportModal() {
    importFile.value = null
    importPreview.value = []
    importResult.value = null
    importModalOpen.value = true
  }

  async function onFileSelected(file: File | null) {
    importFile.value = file
    importPreview.value = []
    importResult.value = null
    if (!file) return
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]
      importPreview.value = arr.map((d: any) => ({
        doc_id: d.doc_id ?? '—',
        title: d.title ?? '(без назви)',
        status: d.status ?? '—'
      }))
    }
    catch {
      toast.add({ title: 'Помилка читання файлу', description: 'Перевірте що файл є валідним JSON', color: 'error' })
    }
  }

  async function doImport() {
    if (!importFile.value || importPreview.value.length === 0) return
    importing.value = true
    try {
      const text = await importFile.value.text()
      const payload = JSON.parse(text)
      const arr = Array.isArray(payload) ? payload : [payload]

      const res = await apiFetch<{ imported: number; skipped: number; errors: string[] }>(
        '/documents/import-json',
        { method: 'POST', body: arr }
      )
      importResult.value = res
      if (res.imported > 0) {
        toast.add({
          title: `Імпортовано ${res.imported} документ(ів)`,
          description: res.skipped ? `Пропущено: ${res.skipped} (вже існують)` : undefined,
          color: 'success'
        })
        await reloadDocs()
      }
      else {
        toast.add({
          title: 'Нічого не імпортовано',
          description: res.skipped ? `${res.skipped} документ(ів) вже існують у системі` : 'Файл порожній',
          color: 'warning'
        })
      }
      if (res.errors?.length) {
        toast.add({ title: `${res.errors.length} помилок при імпорті`, description: res.errors.join('; '), color: 'error' })
      }
    }
    catch (e) {
      toast.add({ title: 'Помилка імпорту', description: String(e), color: 'error' })
    }
    finally {
      importing.value = false
    }
  }

  async function doExport(ids?: string[]) {
    exporting.value = true
    try {
      const config = useRuntimeConfig()
      const apiBase = (config.public.apiBase as string) || 'http://localhost:8000'
      const qs = ids?.length ? `?ids=${ids.join(',')}` : ''
      const url = `${apiBase}/documents/export-json${qs}`

      const res = await fetch(url, {
        headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      const now = new Date().toISOString().slice(0, 10)
      a.download = `dms_backup_${now}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.add({ title: 'Бекап завантажено', color: 'success' })
    }
    catch (e) {
      toast.add({ title: 'Помилка експорту', description: String(e), color: 'error' })
    }
    finally {
      exporting.value = false
    }
  }

  return {
    importModalOpen,
    importFile,
    importPreview,
    importing,
    exporting,
    importResult,
    openImportModal,
    onFileSelected,
    doImport,
    doExport
  }
}
