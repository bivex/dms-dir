import type { Ref } from 'vue'
import type { CounterpartyEntry } from './types'

export function useCounterparties(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const counterparties = ref<CounterpartyEntry[]>([])
  const counterpartiesLoaded = ref(false)

  // modal state
  const counterpartyModalOpen = ref(false)
  const counterpartyModalMode = ref<'create' | 'edit'>('create')
  const counterpartyEditId = ref<number | null>(null)
  const counterpartySaving = ref(false)

  // form state
  const counterpartyForm = reactive({
    name: '',
    code: '',
    subject_type: 'legal' as 'legal' | 'fop' | 'person',
    email: '',
    phone: '',
    address: ''
  })

  async function reloadCounterparties() {
    try {
      const res = await apiFetch<{ counterparties: CounterpartyEntry[] }>('/counterparties')
      counterparties.value = res.counterparties ?? []
      counterpartiesLoaded.value = true
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження контрагентів', description: String(e), color: 'error' })
    }
  }

  function openCreateCounterparty() {
    counterpartyModalMode.value = 'create'
    counterpartyEditId.value = null
    counterpartyForm.name = ''
    counterpartyForm.code = ''
    counterpartyForm.subject_type = 'legal'
    counterpartyForm.email = ''
    counterpartyForm.phone = ''
    counterpartyForm.address = ''
    counterpartyModalOpen.value = true
  }

  function openEditCounterparty(c: CounterpartyEntry) {
    counterpartyModalMode.value = 'edit'
    counterpartyEditId.value = c.id
    counterpartyForm.name = c.name
    counterpartyForm.code = c.code
    counterpartyForm.subject_type = c.subject_type
    counterpartyForm.email = c.email || ''
    counterpartyForm.phone = c.phone || ''
    counterpartyForm.address = c.address || ''
    counterpartyModalOpen.value = true
  }

  async function saveCounterparty() {
    const name = counterpartyForm.name.trim()
    const code = counterpartyForm.code.trim()
    const subjectType = counterpartyForm.subject_type

    if (!name) {
      toast.add({ title: 'Введіть найменування контрагента', color: 'warning' })
      return
    }
    if (!code) {
      toast.add({ title: 'Введіть код ЄДРПОУ / ІПН', color: 'warning' })
      return
    }

    counterpartySaving.value = true
    try {
      const payload = {
        name,
        code,
        subject_type: subjectType,
        email: counterpartyForm.email.trim() || null,
        phone: counterpartyForm.phone.trim() || null,
        address: counterpartyForm.address.trim() || null
      }

      if (counterpartyModalMode.value === 'create') {
        await apiFetch('/counterparties', {
          method: 'POST',
          body: payload
        })
        toast.add({ title: 'Контрагента додано успішно', color: 'success' })
      }
      else if (counterpartyEditId.value !== null) {
        await apiFetch(`/counterparties/${counterpartyEditId.value}`, {
          method: 'PUT',
          body: payload
        })
        toast.add({ title: 'Контрагента оновлено успішно', color: 'success' })
      }
      counterpartyModalOpen.value = false
      await reloadCounterparties()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка збереження контрагента', description: String(e), color: 'error' })
    }
    finally {
      counterpartySaving.value = false
    }
  }

  async function deleteCounterparty(c: CounterpartyEntry) {
    if (!confirm(`Видалити контрагента «${c.name}»?`)) return
    try {
      await apiFetch(`/counterparties/${c.id}`, { method: 'DELETE' })
      toast.add({ title: 'Контрагента видалено', color: 'success' })
      await reloadCounterparties()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення контрагента', description: String(e), color: 'error' })
    }
  }

  return {
    counterparties: counterparties as Ref<CounterpartyEntry[]>,
    counterpartiesLoaded,
    counterpartyModalOpen,
    counterpartyModalMode,
    counterpartyEditId,
    counterpartySaving,
    counterpartyForm,
    reloadCounterparties,
    openCreateCounterparty,
    openEditCounterparty,
    saveCounterparty,
    deleteCounterparty
  }
}
