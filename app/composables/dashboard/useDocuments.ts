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

  // швидкий фільтр за статусом: all | draft | pending_approval | pending_signatures | signed | rejected | overdue
  const statusFilter = ref<string>('all')

  // масовий вибір на видалення
  const selectMode = ref(false)
  const selectedForDelete = ref<Set<string>>(new Set())
  const deletingBulk = ref(false)

  const selectedDoc = computed(() => docs.value.find(d => d.doc_id === selectedId.value) ?? null)
  const archivedCount = computed(() => docs.value.filter(d => d.archived).length)
  const activeCount = computed(() => docs.value.filter(d => !d.archived).length)
  // лічильник обраних — лише ті, що реально існують і не в архіві (без «привидів»
  // від видалених/архівованих документів, які лишились у localStorage)
  const favoritesCount = computed(() =>
    docs.value.filter(d => !d.archived && favoritesSet.value.has(d.doc_id)).length
  )
  const noFolderCount = computed(() =>
    docs.value.filter(d => !d.archived && (d.folder_id ?? null) === null).length
  )

  const _isOverdue = (d: DocEntry): boolean => {
    // прострочений: не підписаний/не опублікований і дата реєстрації + умовний термін минула.
    // У моделі немає явного дедлайну документа, тож вважаємо простроченими ті,
    // що зависли в pending_* понад 7 днів від created_at.
    if (d.status === 'signed' || d.status === 'published' || d.status === 'rejected') return false
    if (!d.status.startsWith('pending')) return false
    const created = d.created_at ? new Date(d.created_at).getTime() : 0
    if (!created) return false
    const days = (Date.now() - created) / 86400000
    return days > 7
  }

  function _matchesStatus(d: DocEntry): boolean {
    const f = statusFilter.value
    if (f === 'all') return true
    if (f === 'overdue') return _isOverdue(d)
    return d.status === f
  }

  const filteredDocs = computed(() => {
    let list = docs.value
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase().trim()
      // розширений пошук: за номером, заголовком, типом, контрагентом, реєстр. індексом
      list = list.filter(d =>
        d.title.toLowerCase().includes(q)
        || d.doc_id.toLowerCase().includes(q)
        || (d.doc_type || '').toLowerCase().includes(q)
        || (d.org_name || '').toLowerCase().includes(q)
        || (d.reg_index || '').toLowerCase().includes(q)
      )
    }
    if (activeCategory.value === 'favorites') return list.filter(d => favoritesSet.value.has(d.doc_id) && !d.archived).filter(_matchesStatus)
    if (activeCategory.value === 'archive') return list.filter(d => d.archived).filter(_matchesStatus)
    if (activeCategory.value === 'trash') return list.filter(d => d.status === 'deleted')
    if (activeCategory.value === 'folder') {
      return list.filter(d => !d.archived && (d.folder_id ?? null) === activeFolderId.value).filter(_matchesStatus)
    }
    if (activeCategory.value === 'calendar') {
      list = list.filter(d => !d.archived)
      if (selectedDay.value) return list.filter(d => docDayKey(d) === selectedDay.value).filter(_matchesStatus)
      return list.filter(_matchesStatus)
    }
    return list.filter(d => !d.archived).filter(_matchesStatus)
  })

  // лічильники для бейджів швидких фільтрів (по активних, не архівних)
  const statusCounts = computed(() => {
    const active = docs.value.filter(d => !d.archived)
    return {
      all: active.length,
      draft: active.filter(d => d.status === 'draft').length,
      pending_approval: active.filter(d => d.status === 'pending_approval').length,
      pending_signatures: active.filter(d => d.status === 'pending_signatures').length,
      signed: active.filter(d => d.status === 'signed' || d.status === 'published').length,
      rejected: active.filter(d => d.status === 'rejected').length,
      overdue: active.filter(_isOverdue).length,
    }
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

  async function downloadMergedPdf() {
    try {
      const url = `${useRuntimeConfig().public.apiBase}/documents/${form.doc_id}/merged-pdf`
      window.open(url, '_blank')
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження обʼєднаного PDF', description: String(e), color: 'error' })
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

  async function deleteAllDocs() {
    try {
      const res = await apiFetch<{ deleted: number }>('/documents/all', { method: 'DELETE' })
      toast.add({ title: `Видалено ${res.deleted} документ(ів)`, color: 'success' })
      selectedId.value = null
      selectMode.value = false
      selectedForDelete.value = new Set()
      await reloadDocs()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення', description: String(e), color: 'error' })
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
    favoritesCount,
    noFolderCount,
    filteredDocs,
    statusFilter,
    statusCounts,
    activeFolder,
    listHeaderLabel,
    reloadDocs,
    refreshAll,
    selectDoc,
    newDocument,
    createDoc,
    generateDoc,
    downloadDoc,
    downloadMergedPdf,
    deleteDoc,
    toggleSelectMode,
    toggleForDelete,
    toggleSelectAll,
    deleteSelected,
    archiveDoc,
    unarchiveDoc,
    deleteAllDocs
  }
}
