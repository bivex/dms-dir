import { ref, reactive } from 'vue'
import type { Ref } from 'vue'
import type { DocEntry } from './types'

export interface DeliveryItem {
  name: string
  quantity: number
  declared_value: number
}

export interface BulkDeliveryEntry {
  doc_id: string
  title: string
  sender: {
    name: string
    address: string
    phone: string
    code: string
  }
  recipient: {
    name: string
    address: string
    phone: string
    code: string
    subject_type: string
  }
  items: DeliveryItem[]
}

export function useDelivery(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  docs: Ref<DocEntry[]>
}) {
  const toast = useToast()
  const { apiFetch, docs } = deps

  const loading = ref(false)
  const exporting = ref(false)

  // Single document mailing state
  const sender = reactive({
    name: '',
    address: '',
    phone: '',
    code: ''
  })

  const recipient = reactive({
    name: '',
    address: '',
    phone: '',
    code: '',
    subject_type: 'legal'
  })

  const items = ref<DeliveryItem[]>([])
  const generateF107 = ref(true)
  const generateLabel = ref(true)

  // Bulk documents mailing state
  const bulkModalOpen = ref(false)
  const bulkLoading = ref(false)
  const bulkExporting = ref(false)
  const bulkDeliveries = ref<BulkDeliveryEntry[]>([])

  async function fetchDeliveryDetails(docId: string) {
    loading.value = true
    try {
      const res = await apiFetch<{
        sender: typeof sender
        recipient: typeof recipient
        items: DeliveryItem[]
      }>(`/documents/${docId}/delivery`)

      if (res) {
        Object.assign(sender, res.sender)
        Object.assign(recipient, res.recipient)
        items.value = res.items || []
      }
    }
    catch (e: unknown) {
      toast.add({ title: 'Не вдалося завантажити деталі відправки', description: String(e), color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  function addItem() {
    items.value.push({
      name: '',
      quantity: 1,
      declared_value: 1.0
    })
  }

  function removeItem(index: number) {
    items.value.splice(index, 1)
  }

  async function triggerDeliveryExport(docId: string) {
    if (items.value.some(item => !item.name.trim())) {
      toast.add({ title: 'Заповніть найменування всіх предметів', color: 'warning' })
      return
    }

    exporting.value = true
    try {
      const token = useAuth().token.value
      const response = await fetch(`${useRuntimeConfig().public.apiBase}/documents/${docId}/delivery/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          sender,
          recipient,
          items: items.value,
          generate_f107: generateF107.value,
          generate_label: generateLabel.value
        })
      })

      if (!response.ok) throw new Error('Помилка генерації PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ukrposhta_delivery_${docId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.add({ title: 'Документи для відправки Укрпоштою сформовано', color: 'success' })
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка експорту PDF', description: String(e), color: 'error' })
    }
    finally {
      exporting.value = false
    }
  }

  // Bulk operations
  async function openBulkDelivery(docIds: string[]) {
    if (!docIds || docIds.length === 0) {
      toast.add({ title: 'Виберіть документи для відправлення', color: 'warning' })
      return
    }

    bulkDeliveries.value = []
    bulkLoading.value = true
    bulkModalOpen.value = true

    try {
      const promises = docIds.map(async (docId) => {
        const docInfo = docs.value.find(d => d.doc_id === docId)
        const docTitle = docInfo?.title || `Документ ${docId}`

        const res = await apiFetch<{
          sender: BulkDeliveryEntry['sender']
          recipient: BulkDeliveryEntry['recipient']
          items: DeliveryItem[]
        }>(`/documents/${docId}/delivery`)

        return {
          doc_id: docId,
          title: docTitle,
          sender: res.sender,
          recipient: res.recipient,
          items: res.items || []
        }
      })

      bulkDeliveries.value = await Promise.all(promises)
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження даних для відправки', description: String(e), color: 'error' })
      bulkModalOpen.value = false
    }
    finally {
      bulkLoading.value = false
    }
  }

  function addBulkItem(entryIdx: number) {
    const entry = bulkDeliveries.value[entryIdx]
    if (entry) {
      entry.items.push({
        name: '',
        quantity: 1,
        declared_value: 1.0
      })
    }
  }

  function removeBulkItem(entryIdx: number, itemIdx: number) {
    const entry = bulkDeliveries.value[entryIdx]
    if (entry) {
      entry.items.splice(itemIdx, 1)
    }
  }

  async function triggerBulkDeliveryExport() {
    // Validate items
    for (const entry of bulkDeliveries.value) {
      if (entry.items.some(item => !item.name.trim())) {
        toast.add({ title: `Заповніть найменування всіх предметів для документа ${entry.doc_id}`, color: 'warning' })
        return
      }
    }

    bulkExporting.value = true
    try {
      const token = useAuth().token.value
      const payload = {
        deliveries: bulkDeliveries.value.map(d => ({
          doc_id: d.doc_id,
          sender: d.sender,
          recipient: d.recipient,
          items: d.items,
          generate_f107: generateF107.value,
          generate_label: generateLabel.value
        }))
      }

      const response = await fetch(`${useRuntimeConfig().public.apiBase}/documents/delivery/export-bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error('Помилка сервера при генерації PDF')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ukrposhta_delivery_bulk.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      bulkModalOpen.value = false
      toast.add({ title: 'Спільний PDF для Укрпошти успішно згенеровано', color: 'success' })
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка генерації спільного PDF', description: String(e), color: 'error' })
    }
    finally {
      bulkExporting.value = false
    }
  }

  return {
    deliveryLoading: loading,
    deliveryExporting: exporting,
    deliverySender: sender,
    deliveryRecipient: recipient,
    deliveryItems: items,
    generateF107,
    generateLabel,
    fetchDeliveryDetails,
    addItem,
    removeItem,
    triggerDeliveryExport,

    // Bulk exports
    bulkModalOpen,
    bulkLoading,
    bulkExporting,
    bulkDeliveries,
    openBulkDelivery,
    addBulkItem,
    removeBulkItem,
    triggerBulkDeliveryExport
  }
}
