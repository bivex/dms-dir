import { ref } from 'vue'

export interface TaskEntry {
  id: number
  document_id: string
  document_title: string
  description: string
  due_date: string
  status: string
  completed_at?: string | null
  created_at: string
}

export interface ResolutionTask {
  id?: number
  executor: string
  description: string
  due_date: string
  status?: string
}

export interface ResolutionEntry {
  id: number
  author: string
  text: string
  created_at: string
  tasks: ResolutionTask[]
}

export function useTasks(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const myTasks = ref<TaskEntry[]>([])
  const loading = ref(false)

  // Document resolutions
  const docResolutions = ref<ResolutionEntry[]>([])
  const loadingResolutions = ref(false)
  const savingResolution = ref(false)

  async function fetchMyTasks() {
    loading.value = true
    try {
      const res = await apiFetch<TaskEntry[]>('/tasks/my')
      if (res) {
        myTasks.value = res
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося завантажити завдання', description: String(e), color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function updateTaskStatus(taskId: number, status: string) {
    try {
      const res = await apiFetch<{ status: string }>(`/tasks/${taskId}/status`, {
        method: 'POST',
        body: { status }
      })
      if (res) {
        toast.add({ title: 'Статус завдання оновлено', color: 'success' })
        await fetchMyTasks()
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося оновити статус завдання', description: String(e), color: 'error' })
    }
  }

  async function fetchDocResolutions(docId: string) {
    loadingResolutions.value = true
    try {
      const res = await apiFetch<ResolutionEntry[]>(`/documents/${docId}/resolutions`)
      if (res) {
        docResolutions.value = res
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося завантажити резолюції', description: String(e), color: 'error' })
    } finally {
      loadingResolutions.value = false
    }
  }

  async function addDocResolution(docId: string, text: string, tasks: Array<{ executor: string, description: string, due_date: string }>) {
    savingResolution.value = true
    try {
      const res = await apiFetch<{ status: string }>(`/documents/${docId}/resolutions`, {
        method: 'POST',
        body: { text, tasks }
      })
      if (res) {
        toast.add({ title: 'Резолюцію додано успішно', color: 'success' })
        await fetchDocResolutions(docId)
        return true
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося додати резолюцію', description: String(e), color: 'error' })
    } finally {
      savingResolution.value = false
    }
    return false
  }

  return {
    myTasks,
    tasksLoading: loading,
    docResolutions,
    loadingResolutions,
    savingResolution,
    fetchMyTasks,
    updateTaskStatus,
    fetchDocResolutions,
    addDocResolution
  }
}
