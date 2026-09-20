import type { Ref } from 'vue'
import type { DocEntry } from './types'
import type { ControlBadge } from './useDocumentControl'

/**
 * Логіка фільтрації реєстру документів: швидкі фільтри статусів, категорій, папок, дат,
 * повнотекстовий пошук та лічильники.
 */
export function useDocumentFilters(deps: {
  docs: Ref<DocEntry[]>
  folders: Ref<{ id: number; name: string; color?: string | null; doc_count?: number }[]>
  activeCategory: Ref<string>
  searchQuery: Ref<string>
  activeFolderId: Ref<number | null>
  selectedDay: Ref<string | null>
  docDayKey: (d: DocEntry) => string | null
  selectedDayLabel: Ref<string>
  favoritesSet: Ref<Set<string>>
  getControlBadge: (d: DocEntry) => ControlBadge | null
  isOverdue: (d: DocEntry) => boolean
  isControlled: (d: DocEntry) => boolean
}) {
  const {
    docs, folders, activeCategory, searchQuery,
    activeFolderId, selectedDay, docDayKey, selectedDayLabel,
    favoritesSet, getControlBadge, isOverdue, isControlled
  } = deps

  // швидкий фільтр за статусом: all | draft | pending_approval | pending_signatures | signed | rejected | overdue
  const statusFilter = ref<string>('all')

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

  function matchesStatus(d: DocEntry): boolean {
    const f = statusFilter.value
    if (f === 'all') return true
    if (f === 'overdue') return isControlled(d) || isOverdue(d)
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
    if (activeCategory.value === 'favorites') list = list.filter(d => favoritesSet.value.has(d.doc_id) && !d.archived).filter(matchesStatus)
    else if (activeCategory.value === 'archive') list = list.filter(d => d.archived).filter(matchesStatus)
    else if (activeCategory.value === 'trash') list = list.filter(d => d.status === 'deleted')
    else if (activeCategory.value === 'folder') {
      list = list.filter(d => !d.archived && (d.folder_id ?? null) === activeFolderId.value).filter(matchesStatus)
    }
    else if (activeCategory.value === 'calendar') {
      list = list.filter(d => !d.archived)
      if (selectedDay.value) list = list.filter(d => docDayKey(d) === selectedDay.value).filter(matchesStatus)
      else list = list.filter(matchesStatus)
    }
    else {
      list = list.filter(d => !d.archived).filter(matchesStatus)
    }

    // Якщо ми у розділі «На контролі» — сортуємо за терміновістю (найбільш прострочені та термінові зверху)
    if (statusFilter.value === 'overdue') {
      list = [...list].sort((a, b) => {
        const bA = getControlBadge(a)
        const bB = getControlBadge(b)
        const dA = bA?.daysDiff ?? 9999
        const dB = bB?.daysDiff ?? 9999
        return dA - dB
      })
    }

    return list
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
      overdue: active.filter(isOverdue).length,
      controlled: active.filter(isControlled).length,
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

  return {
    statusFilter,
    archivedCount,
    activeCount,
    favoritesCount,
    noFolderCount,
    filteredDocs,
    statusCounts,
    activeFolder,
    listHeaderLabel
  }
}
