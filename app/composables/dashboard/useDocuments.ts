import type { Ref } from 'vue'
import type { DocEntry } from './types'
import type { DocFormStore } from './useDocForm'

/**
 * Список документів + вибір + CRUD + масове видалення + архівування.
 * Сцеплене ядро: selectDoc bridging'ує список (тут) і картку (formStore).
 */
export function useDocuments(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  favoritesSet: Ref<Set<string>>
  removeFromFavorites: (docId: string) => void
  folders: Ref<{ id: number; name: string; color?: string | null; doc_count?: number }[]>
  docs: Ref<DocEntry[]>
  activeCategory: Ref<string>
  searchQuery: Ref<string>
  activeFolderId: Ref<number | null>
  selectedDay: Ref<string | null>
  docDayKey: (d: DocEntry) => string | null
  selectedDayLabel: Ref<string>
  formStore: DocFormStore
  reloadFolders: () => Promise<void>
}) {
  const toast = useToast()
  const {
    apiFetch, favoritesSet, removeFromFavorites, folders,
    docs, activeCategory, searchQuery,
    activeFolderId, selectedDay, docDayKey, selectedDayLabel,
    formStore, reloadFolders
  } = deps
  const { form, report, pdfaInfo, generating, buildPayload, applyDocToForm, resetFormForNew, setReport } = formStore

  const selectedId = ref<string | null>(null)

  // масовий вибір на видалення
  const selectMode = ref(false)
  const selectedForDelete = ref<Set<string>>(new Set())
  const deletingBulk = ref(false)

  const selectedDoc = computed(() => docs.value.find(d => d.doc_id === selectedId.value) ?? null)
  const archivedCount = computed(() => docs.value.filter(d => d.archived).length)
  const activeCount = computed(() => docs.value.filter(d => !d.archived).length)
  const noFolderCount = computed(() =>
    docs.value.filter(d => !d.archived && (d.folder_id ?? null) === null).length
  )

  const filteredDocs = computed(() => {
    let list = docs.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(d =>
        d.title.toLowerCase().includes(q) || d.doc_id.toLowerCase().includes(q)
      )
    }
    if (activeCategory.value === 'favorites') return list.filter(d => favoritesSet.value.has(d.doc_id) && !d.archived)
    if (activeCategory.value === 'archive') return list.filter(d => d.archived)
    if (activeCategory.value === 'trash') return list.filter(d => d.status === 'deleted')
    if (activeCategory.value === 'folder') {
      return list.filter(d => !d.archived && (d.folder_id ?? null) === activeFolderId.value)
    }
    if (activeCategory.value === 'calendar') {
      list = list.filter(d => !d.archived)
      if (selectedDay.value) return list.filter(d => docDayKey(d) === selectedDay.value)
      return list
    }
    return list.filter(d => !d.archived)
  })

  const activeFolder = computed(() => folders.value.find(f => f.id === activeFolderId.value) ?? null)
  const listHeaderLabel = computed(() => {
    if (activeCategory.value === 'folder') return activeFolder.value?.name ?? 'Без папки'
    if (activeCategory.value === 'favorites') return 'Обрані'
    if (activeCategory.value === 'archive') return 'Архів'
    if (activeCategory.value === 'trash') return 'Кошик'
    if (activeCategory.value === 'calendar') return selectedDay.value ? selectedDayLabel.value : 'Календар'
    return 'Всі документи'
  })

  async function reloadDocs() {
    try {
      const res = await apiFetch<{ documents: DocEntry[] }>('/documents')
      docs.value = res.documents ?? []
    }
    catch {
      toast.add({ title: 'Не вдалося завантажити список', color: 'error' })
    }
  }

  async function refreshAll() {
    await Promise.all([reloadDocs(), reloadFolders()])
  }

  async function selectDoc(doc: DocEntry | string) {
    const docId = typeof doc === 'string' ? doc : doc.doc_id
    selectedId.value = docId
    formStore.creatingDoc.value = false
    report.value = null
    pdfaInfo.value = null
    try {
      const full = await apiFetch<{
        doc_id: string; title: string; doc_type: string; status: string; fmt: string
        signers: Array<{ full_name: string; position: string; status: string }>
        conformance: {
          conforms?: boolean; compliant?: boolean
          findings_count?: number; rules_passed?: number
          results?: Array<{ rule_id: string; conforms: boolean; findings: Array<{ message: string }> }>
          findings?: Array<{ rule: string; message: string }>
        } | null
      }>(`/documents/${docId}`)
      applyDocToForm(full)

      // для підписаних документів беремо СВІЖИЙ звіт через /validate
      let conf = full.conformance
      if (full.status === 'signed' || full.status === 'pending_signatures') {
        try {
          conf = await apiFetch(`/documents/${full.doc_id}/validate`, { method: 'POST' })
        }
        catch { /* fallback на збережений conformance */ }
      }
      setReport(conf)
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження документа', description: String(e), color: 'error' })
    }
  }

  function newDocument() {
    selectedId.value = null
    formStore.creatingDoc.value = true
    resetFormForNew()
  }

  async function createDoc() {
    try {
      await apiFetch('/documents', { method: 'POST', body: buildPayload() })
      toast.add({ title: 'Картку збережено' })
      await refreshAll()
      await selectDoc(form.doc_id)
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка збереження', description: String(e), color: 'error' })
    }
  }

  async function generateDoc() {
    generating.value = true
    report.value = null
    pdfaInfo.value = null
    try {
      await apiFetch('/documents', { method: 'POST', body: buildPayload() }).catch(() => {
        // якщо 409 — документ вже є, продовжуємо до generate
      })
      const res = await apiFetch<{
        doc_id: string
        report: {
          conforms: boolean
          findings_count: number
          results: Array<{ rule_id: string; clause: string; conforms: boolean; findings: Array<{ message: string }> }>
        }
        pdfa: { conforms: boolean; issues: string[] } | null
      }>(`/documents/${form.doc_id}/generate`, { method: 'POST' })
      const r = res.report
      report.value = {
        compliant: r.conforms,
        rules_passed: r.results.filter(x => x.conforms).length,
        findings: r.results
          .filter(x => !x.conforms)
          .flatMap(x => x.findings.map(f => ({ rule: x.rule_id, message: f.message })))
      }
      pdfaInfo.value = res.pdfa ? { conforms: res.pdfa.conforms, findings: res.pdfa.issues } : null
      await refreshAll()
      toast.add({ title: r.conforms ? 'Документ відповідає ДСТУ' : 'Є зауваження', color: r.conforms ? 'success' : 'warning' })
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка генерації', description: String(e), color: 'error' })
    }
    finally {
      generating.value = false
    }
  }

  async function downloadDoc() {
    try {
      const url = `${useRuntimeConfig().public.apiBase}/documents/${form.doc_id}/download`
      window.open(url, '_blank')
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження', description: String(e), color: 'error' })
    }
  }

  async function deleteDoc() {
    if (!selectedId.value) return
    try {
      await apiFetch(`/documents/${selectedId.value}`, { method: 'DELETE' })
      toast.add({ title: 'Видалено' })
      removeFromFavorites(selectedId.value)
      selectedId.value = null
      formStore.creatingDoc.value = false
      await refreshAll()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення', description: String(e), color: 'error' })
    }
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value
    selectedForDelete.value = new Set()
  }
  function toggleForDelete(docId: string) {
    const next = new Set(selectedForDelete.value)
    if (next.has(docId)) next.delete(docId)
    else next.add(docId)
    selectedForDelete.value = next
  }
  function toggleSelectAll() {
    if (selectedForDelete.value.size === filteredDocs.value.length) {
      selectedForDelete.value = new Set()
    }
    else {
      selectedForDelete.value = new Set(filteredDocs.value.map(d => d.doc_id))
    }
  }

  async function deleteSelected() {
    const ids = [...selectedForDelete.value]
    if (ids.length === 0) return
    // eslint-disable-next-line no-alert
    if (!confirm(`Видалити ${ids.length} документ(ів) разом із підписами та аудитом?`)) return
    deletingBulk.value = true
    const results = await Promise.allSettled(
      ids.map(id => apiFetch(`/documents/${id}`, { method: 'DELETE' }))
    )
    deletingBulk.value = false
    const ok = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - ok
    if (failed === 0) {
      toast.add({ title: `Видалено ${ok} документ(ів)`, color: 'success' })
    }
    else {
      toast.add({
        title: `Видалено ${ok}, помилок ${failed}`,
        color: failed === results.length ? 'error' : 'warning'
      })
    }
    if (selectedId.value && selectedForDelete.value.has(selectedId.value)) {
      selectedId.value = null
    }
    for (const id of selectedForDelete.value) removeFromFavorites(id)
    selectMode.value = false
    selectedForDelete.value = new Set()
    await reloadDocs()
  }

  async function archiveDoc(docId: string) {
    try {
      await apiFetch(`/documents/${docId}/archive`, { method: 'POST' })
      toast.add({ title: 'Переміщено в архів' })
      if (selectedId.value === docId) selectedId.value = null
      await refreshAll()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка архівування', description: String(e), color: 'error' })
    }
  }

  async function unarchiveDoc(docId: string) {
    try {
      await apiFetch(`/documents/${docId}/unarchive`, { method: 'POST' })
      toast.add({ title: 'Відновлено з архіву' })
      await refreshAll()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка відновлення', description: String(e), color: 'error' })
    }
  }

  return {
    docs,
    selectedId,
    activeCategory,
    searchQuery,
    selectMode,
    selectedForDelete,
    deletingBulk,
    selectedDoc,
    archivedCount,
    activeCount,
    noFolderCount,
    filteredDocs,
    activeFolder,
    listHeaderLabel,
    reloadDocs,
    refreshAll,
    selectDoc,
    newDocument,
    createDoc,
    generateDoc,
    downloadDoc,
    deleteDoc,
    toggleSelectMode,
    toggleForDelete,
    toggleSelectAll,
    deleteSelected,
    archiveDoc,
    unarchiveDoc
  }
}
