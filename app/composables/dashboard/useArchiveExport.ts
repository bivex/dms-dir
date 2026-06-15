import { ref } from 'vue'

export function useArchiveExport() {
  const exportModalOpen = ref(false)
  const exporting = ref(false)

  const periodType = ref<'all' | '7d' | '30d' | 'custom'>('all')
  const startDate = ref('')
  const endDate = ref('')

  function openExportModal() {
    exportModalOpen.value = true
    periodType.value = 'all'
    startDate.value = ''
    endDate.value = ''
  }

  function triggerDownload() {
    const config = useRuntimeConfig()
    let url = `${config.public.apiBase}/documents/archive/export`
    const params = new URLSearchParams()

    if (periodType.value === '7d') {
      params.append('days', '7')
    } else if (periodType.value === '30d') {
      params.append('days', '30')
    } else if (periodType.value === 'custom') {
      if (startDate.value) params.append('start_date', startDate.value)
      if (endDate.value) params.append('end_date', endDate.value)
    }

    const qs = params.toString()
    if (qs) {
      url += `?${qs}`
    }

    window.open(url, '_blank')
    exportModalOpen.value = false
  }

  return {
    exportModalOpen,
    exporting,
    periodType,
    startDate,
    endDate,
    openExportModal,
    triggerDownload
  }
}

export type ArchiveExportStore = ReturnType<typeof useArchiveExport>
