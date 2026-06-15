import { ref } from 'vue'

export interface JournalEntry {
  id: number
  name: string
  prefix: string
  number_template: string
  next_number: number
}

export function useJournals(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const journals = ref<JournalEntry[]>([])
  const loading = ref(false)

  async function fetchJournals() {
    loading.value = true
    try {
      const res = await apiFetch<JournalEntry[]>('/journals')
      if (res) {
        journals.value = res
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося завантажити журнали', description: String(e), color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function createJournal(payload: { name: string, prefix: string, number_template: string }) {
    loading.value = true
    try {
      const res = await apiFetch<JournalEntry>('/journals', {
        method: 'POST',
        body: payload
      })
      if (res) {
        journals.value.push(res)
        toast.add({ title: 'Журнал створено успішно', color: 'success' })
        return res
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося створити журнал', description: String(e), color: 'error' })
    } finally {
      loading.value = false
    }
  }

  return {
    journals,
    journalsLoading: loading,
    fetchJournals,
    createJournal
  }
}
