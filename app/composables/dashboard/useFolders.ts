import type { DropdownMenuItem } from '@nuxt/ui'
import type { Ref } from 'vue'
import type { DocEntry, FolderEntry, DocForm } from './types'

/**
 * Папки-категорії: CRUD, переміщення документів, фільтрація.
 * deleteFolder/moveDocToFolder оптимістично мутируют docs (передається сюди).
 */
export function useFolders(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  docs: Ref<DocEntry[]>
  form: DocForm
  activeCategory: Ref<string>
  setActiveCategory: (c: string) => void
}) {
  const toast = useToast()
  const { apiFetch, docs, form, activeCategory, setActiveCategory } = deps

  const folders = ref<FolderEntry[]>([])
  const activeFolderId = ref<number | null>(null)

  // модалка створення/перейменування
  const folderModalOpen = ref(false)
  const folderModalMode = ref<'create' | 'rename'>('create')
  const folderEditId = ref<number | null>(null)
  const folderName = ref('')
  const folderColor = ref<string>('primary')
  const folderSaving = ref(false)

  const FOLDER_COLORS = [
    { id: 'primary', hex: '#6366f1' },
    { id: 'success', hex: '#22c55e' },
    { id: 'warning', hex: '#f59e0b' },
    { id: 'error', hex: '#ef4444' },
    { id: 'info', hex: '#3b82f6' },
    { id: 'neutral', hex: '#71717a' }
  ]
  const FOLDER_COLOR_HEX: Record<string, string> = Object.fromEntries(
    FOLDER_COLORS.map(c => [c.id, c.hex])
  )

  function folderDotColor(c?: string | null): string {
    if (!c) return '#71717a'
    if (c.startsWith('#')) return c
    return FOLDER_COLOR_HEX[c] ?? '#6366f1'
  }

  async function reloadFolders() {
    try {
      const res = await apiFetch<{ folders: FolderEntry[] }>('/folders')
      folders.value = res.folders ?? []
      if (activeCategory.value === 'folder'
        && activeFolderId.value !== null
        && !folders.value.some(f => f.id === activeFolderId.value)) {
        setActiveCategory('all')
      }
    }
    catch {
      // папки не критичні для списку
    }
  }

  function openCreateFolder() {
    folderModalMode.value = 'create'
    folderEditId.value = null
    folderName.value = ''
    folderColor.value = 'primary'
    folderModalOpen.value = true
  }

  function openRenameFolder(folder: FolderEntry) {
    folderModalMode.value = 'rename'
    folderEditId.value = folder.id
    folderName.value = folder.name
    folderColor.value = folder.color || 'primary'
    folderModalOpen.value = true
  }

  async function saveFolder() {
    const name = folderName.value.trim()
    if (!name) {
      toast.add({ title: 'Введіть назву папки', color: 'warning' })
      return
    }
    folderSaving.value = true
    try {
      if (folderModalMode.value === 'create') {
        await apiFetch('/folders', { method: 'POST', body: { name, color: folderColor.value } })
        toast.add({ title: 'Папку створено' })
      }
      else if (folderEditId.value !== null) {
        await apiFetch(`/folders/${folderEditId.value}`, {
          method: 'PUT',
          body: { name, color: folderColor.value }
        })
        toast.add({ title: 'Папку оновлено' })
      }
      folderModalOpen.value = false
      await reloadFolders()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка збереження папки', description: String(e), color: 'error' })
    }
    finally {
      folderSaving.value = false
    }
  }

  async function deleteFolder(folder: FolderEntry) {
    // eslint-disable-next-line no-alert
    if (!confirm(`Видалити папку «${folder.name}»? Документи залишаться — вони перейдуть у «Без папки».`)) return
    try {
      await apiFetch(`/folders/${folder.id}`, { method: 'DELETE' })
      toast.add({ title: 'Папку видалено' })
      for (const d of docs.value) {
        if (d.folder_id === folder.id) d.folder_id = null
      }
      if (activeCategory.value === 'folder' && activeFolderId.value === folder.id) {
        setActiveCategory('all')
      }
      await reloadFolders()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення папки', description: String(e), color: 'error' })
    }
  }

  async function moveDocToFolder(docId: string, folderId: number | null) {
    try {
      await apiFetch(`/documents/${docId}/folder`, {
        method: 'POST',
        body: { folder_id: folderId }
      })
      const d = docs.value.find(x => x.doc_id === docId)
      if (d) d.folder_id = folderId
      await reloadFolders()
      toast.add({
        title: folderId === null ? 'Документ прибрано з папки' : 'Документ переміщено у папку',
        color: 'success'
      })
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка переміщення', description: String(e), color: 'error' })
    }
  }

  function selectFolder(folderId: number | null) {
    setActiveCategory('folder')
    activeFolderId.value = folderId
  }

  function folderMenuItems(folder: FolderEntry): DropdownMenuItem[][] {
    return [[
      { label: 'Перейменувати', icon: 'i-lucide-pencil', onSelect: () => openRenameFolder(folder) }
    ], [
      { label: 'Видалити', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteFolder(folder) }
    ]]
  }

  return {
    folders,
    activeFolderId,
    folderModalOpen,
    folderModalMode,
    folderEditId,
    folderName,
    folderColor,
    folderSaving,
    FOLDER_COLORS,
    folderDotColor,
    reloadFolders,
    openCreateFolder,
    openRenameFolder,
    saveFolder,
    deleteFolder,
    moveDocToFolder,
    selectFolder,
    folderMenuItems
  }
}
