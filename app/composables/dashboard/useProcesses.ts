import type { Ref } from 'vue'

export type ProcNodeType = 'start' | 'task' | 'gateway' | 'end'

export interface ProcNode {
  id: string
  type: ProcNodeType
  label: string
  x: number
  y: number
}

export interface ProcEdge {
  from: string
  to: string
  label?: string
}

export interface ProcGraph {
  nodes: ProcNode[]
  edges: ProcEdge[]
}

export interface ProcessEntry {
  id: number
  name: string
  description: string
  graph: ProcGraph
  is_builtin: boolean
  created_at?: string | null
  updated_at?: string | null
}

/**
 * Бізнес-процеси документообігу: список + CRUD + редагований BPMN-lite граф.
 */
export function useProcesses(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const processes = ref<ProcessEntry[]>([])
  const processesLoaded = ref(false)
  const selectedProcessId = ref<number | null>(null)
  const savingProcess = ref(false)

  const selectedProcess = computed(() =>
    processes.value.find(p => p.id === selectedProcessId.value) ?? null
  )

  async function reloadProcesses() {
    try {
      const res = await apiFetch<{ processes: ProcessEntry[] }>('/processes')
      processes.value = res.processes ?? []
      processesLoaded.value = true
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження процесів', description: String(e), color: 'error' })
    }
  }

  function selectProcess(id: number) {
    selectedProcessId.value = id
  }

  async function createProcess(name: string): Promise<number | null> {
    try {
      const res = await apiFetch<ProcessEntry>('/processes', {
        method: 'POST',
        body: {
          name,
          description: '',
          graph: {
            nodes: [
              { id: 'n1', type: 'start', label: 'Початок', x: 40, y: 120 },
              { id: 'n2', type: 'end', label: 'Кінець', x: 280, y: 120 }
            ],
            edges: [{ from: 'n1', to: 'n2', label: '' }]
          }
        }
      })
      toast.add({ title: 'Процес створено', color: 'success' })
      await reloadProcesses()
      selectedProcessId.value = res.id
      return res.id
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка створення процесу', description: String(e), color: 'error' })
      return null
    }
  }

  async function duplicateProcess(src: ProcessEntry): Promise<number | null> {
    try {
      const res = await apiFetch<ProcessEntry>('/processes', {
        method: 'POST',
        body: {
          name: `${src.name} (копія)`,
          description: src.description,
          graph: src.graph
        }
      })
      toast.add({ title: 'Створено копію процесу', color: 'success' })
      await reloadProcesses()
      selectedProcessId.value = res.id
      return res.id
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка дублювання', description: String(e), color: 'error' })
      return null
    }
  }

  async function saveProcess(proc: ProcessEntry) {
    savingProcess.value = true
    try {
      await apiFetch(`/processes/${proc.id}`, {
        method: 'PUT',
        body: { name: proc.name, description: proc.description, graph: proc.graph }
      })
      toast.add({ title: 'Процес збережено', color: 'success' })
      await reloadProcesses()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка збереження процесу', description: String(e), color: 'error' })
    }
    finally {
      savingProcess.value = false
    }
  }

  async function deleteProcess(proc: ProcessEntry) {
    if (!confirm(`Видалити процес «${proc.name}»?`)) return
    try {
      await apiFetch(`/processes/${proc.id}`, { method: 'DELETE' })
      toast.add({ title: 'Процес видалено', color: 'success' })
      if (selectedProcessId.value === proc.id) selectedProcessId.value = null
      await reloadProcesses()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення процесу', description: String(e), color: 'error' })
    }
  }

  return {
    processes: processes as Ref<ProcessEntry[]>,
    processesLoaded,
    selectedProcessId,
    selectedProcess,
    savingProcess,
    reloadProcesses,
    selectProcess,
    createProcess,
    duplicateProcess,
    saveProcess,
    deleteProcess
  }
}
