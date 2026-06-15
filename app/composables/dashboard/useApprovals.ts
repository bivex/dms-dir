import { ref } from 'vue'

export interface MyApprovalEntry {
  doc_id: string
  title: string
  status: string
  approver_status: string
  full_name: string
  position: string
  order_index: number
  approval_type: string
}

export function useApprovals(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  refreshAll: () => Promise<void>
  selectDoc: (docId: string) => Promise<void>
}) {
  const toast = useToast()
  const { apiFetch, refreshAll, selectDoc } = deps

  const submitting = ref(false)
  const acting = ref(false)
  const myApprovals = ref<MyApprovalEntry[]>([])
  const approvalsLoading = ref(false)

  async function fetchMyApprovals() {
    approvalsLoading.value = true
    try {
      const res = await apiFetch<MyApprovalEntry[]>('/approvals/my')
      if (res) {
        myApprovals.value = Array.isArray(res) ? res : []
      }
    } catch (e: unknown) {
      toast.add({ title: 'Не вдалося завантажити погодження', description: String(e), color: 'error' })
    } finally {
      approvalsLoading.value = false
    }
  }

  async function submitForApproval(docId: string) {
    submitting.value = true
    try {
      const res = await apiFetch<{ status: string }>(`/documents/${docId}/approval/submit`, {
        method: 'POST'
      })
      if (res) {
        toast.add({ title: 'Документ успішно подано на погодження', color: 'success' })
        await refreshAll()
        await selectDoc(docId)
      }
    } catch (e: unknown) {
      toast.add({ title: 'Помилка подачі на погодження', description: String(e), color: 'error' })
    } finally {
      submitting.value = false
    }
  }

  async function performApprovalAction(docId: string, action: 'approve' | 'reject', comment?: string) {
    acting.value = true
    try {
      const res = await apiFetch<{ status: string }>(`/documents/${docId}/approval/action`, {
        method: 'POST',
        body: { action, comment }
      })
      if (res) {
        const actionText = action === 'approve' ? 'погоджено' : 'відхилено'
        toast.add({ title: `Документ ${actionText} успішно`, color: 'success' })
        await refreshAll()
        await selectDoc(docId)
      }
    } catch (e: unknown) {
      toast.add({ title: 'Помилка виконання дії погодження', description: String(e), color: 'error' })
    } finally {
      acting.value = false
    }
  }

  async function downloadApprovalSheet(docId: string) {
    try {
      const token = useAuth().token.value
      const response = await fetch(`${useRuntimeConfig().public.apiBase}/documents/${docId}/approval/sheet`, {
        method: 'GET',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      })

      if (!response.ok) throw new Error('Помилка завантаження аркуша погодження')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `approval_sheet_${docId}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.add({ title: 'Аркуш погодження завантажено', color: 'success' })
    } catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження аркуша погодження', description: String(e), color: 'error' })
    }
  }

  return {
    approvalSubmitting: submitting,
    approvalActing: acting,
    myApprovals,
    approvalsLoading,
    fetchMyApprovals,
    submitForApproval,
    performApprovalAction,
    downloadApprovalSheet
  }
}
