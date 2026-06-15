import { ref, reactive } from 'vue'

export interface DeliveryItem {
  name: string
  quantity: number
  declared_value: number
}

export function useDelivery(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const loading = ref(false)
  const exporting = ref(false)

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
    triggerDeliveryExport
  }
}
