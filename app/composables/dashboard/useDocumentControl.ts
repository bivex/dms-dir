import type { Ref } from 'vue'
import type { DocEntry } from './types'

export type ControlBadge = {
  status: 'closed' | 'overdue' | 'today' | 'urgent' | 'pending'
  label: string
  color: 'success' | 'error' | 'warning' | 'info' | 'neutral'
  icon: string
  daysDiff: number | null
  tooltip?: string
  isControlled: boolean
}

/**
 * Логіка дедлайнів, бейджів виконання та зняття/повернення контролю для документів.
 */
export function useDocumentControl(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  docs: Ref<DocEntry[]>
}) {
  const { apiFetch, docs } = deps
  const toast = useToast()

  const decontrolModalOpen = ref(false)
  const decontrolTargetDoc = ref<DocEntry | null>(null)
  const decontrolling = ref(false)

  const getControlBadge = (d: DocEntry): ControlBadge | null => {
    // 1. Документ знято з контролю
    if (d.review_status === 'responded') {
      return {
        status: 'closed',
        label: 'Знято з контролю',
        color: 'success',
        icon: 'i-lucide-check-check',
        daysDiff: null,
        tooltip: d.review_note ? `Підстава: ${d.review_note}` : 'Документ успішно виконано / знято з контролю',
        isControlled: false
      }
    }

    // 2. Трекінг вимкнено явно
    if (d.review_status === 'not_applicable') {
      return null
    }

    // 3. Обчислюємо дедлайн:
    let targetTime: number | null = null

    if (d.expected_response_date) {
      targetTime = new Date(d.expected_response_date).getTime()
    } else if (d.review_status === 'pending' || d.review_status === 'overdue') {
      const base = d.registered_at ? new Date(d.registered_at).getTime() : (d.created_at ? new Date(d.created_at).getTime() : 0)
      if (base) targetTime = base + (30 * 86400000)
    } else if (d.status && d.status.startsWith('pending')) {
      const base = d.created_at ? new Date(d.created_at).getTime() : 0
      if (base) targetTime = base + (7 * 86400000)
    }

    if (!targetTime) return null

    const now = Date.now()
    const diffDays = Math.ceil((targetTime - now) / 86400000)

    if (diffDays < 0 || d.review_status === 'overdue') {
      const overdueDays = Math.abs(diffDays)
      let daysText = `${overdueDays} дн.`
      if (overdueDays === 1) daysText = '1 день'
      else if (overdueDays >= 2 && overdueDays <= 4) daysText = `${overdueDays} дні`
      return {
        status: 'overdue',
        label: overdueDays > 0 ? `Прострочено (${daysText})` : 'Прострочено',
        color: 'error',
        icon: 'i-lucide-alert-circle',
        daysDiff: diffDays,
        tooltip: `Термін виконання минув (${daysText} тому)`,
        isControlled: true
      }
    }

    if (diffDays === 0) {
      return {
        status: 'today',
        label: 'Сьогодні термін',
        color: 'warning',
        icon: 'i-lucide-clock-alert',
        daysDiff: 0,
        tooltip: 'Сьогодні останній день виконання документа',
        isControlled: true
      }
    }

    if (diffDays === 1) {
      return {
        status: 'urgent',
        label: 'Залишився 1 день',
        color: 'warning',
        icon: 'i-lucide-hourglass',
        daysDiff: 1,
        tooltip: 'Залишився 1 день до завершення терміну',
        isControlled: true
      }
    }

    if (diffDays >= 2 && diffDays <= 4) {
      return {
        status: 'urgent',
        label: `Залишилось ${diffDays} дні`,
        color: 'warning',
        icon: 'i-lucide-hourglass',
        daysDiff: diffDays,
        tooltip: `Залишилось ${diffDays} дні до дедлайну`,
        isControlled: true
      }
    }

    return {
      status: 'pending',
      label: `Залишилось ${diffDays} дн.`,
      color: 'info',
      icon: 'i-lucide-clock',
      daysDiff: diffDays,
      tooltip: `Термін виконання: до ${new Date(targetTime).toLocaleDateString('uk-UA')}`,
      isControlled: true
    }
  }

  const isOverdue = (d: DocEntry): boolean => {
    const badge = getControlBadge(d)
    return badge?.status === 'overdue'
  }

  const isControlled = (d: DocEntry): boolean => {
    const badge = getControlBadge(d)
    return !!badge?.isControlled
  }

  function openDecontrolModal(doc: DocEntry) {
    decontrolTargetDoc.value = doc
    decontrolModalOpen.value = true
  }

  function closeDecontrolModal() {
    decontrolModalOpen.value = false
    decontrolTargetDoc.value = null
  }

  async function submitDecontrol(payload: {
    reason_type: string
    reply_number?: string
    resolution_text?: string
    resolution_author?: string
    decontrol_date?: string
    note?: string
  }) {
    if (!decontrolTargetDoc.value) return
    const docId = decontrolTargetDoc.value.doc_id
    decontrolling.value = true
    try {
      const res = await apiFetch<{
        review_status: string
        response_received_at: string | null
        review_note: string | null
      }>(`/documents/${docId}/decontrol`, {
        method: 'POST',
        body: payload
      })

      const target = docs.value.find(d => d.doc_id === docId)
      if (target) {
        target.review_status = res.review_status
        target.response_received_at = res.response_received_at
        target.review_note = res.review_note
      }

      toast.add({
        title: 'Документ знято з контролю',
        description: res.review_note || undefined,
        color: 'success'
      })
      closeDecontrolModal()
    }
    catch (err: any) {
      toast.add({
        title: 'Помилка зняття з контролю',
        description: err?.data?.detail || String(err),
        color: 'error'
      })
    }
    finally {
      decontrolling.value = false
    }
  }

  async function reopenControl(doc: DocEntry) {
    try {
      const res = await apiFetch<{
        review_status: string
        response_received_at: string | null
        review_note: string | null
      }>(`/documents/${doc.doc_id}/reopen-control`, {
        method: 'POST',
        body: {}
      })

      const target = docs.value.find(d => d.doc_id === doc.doc_id)
      if (target) {
        target.review_status = res.review_status
        target.response_received_at = null
      }

      toast.add({
        title: 'Документ повернуто на контроль',
        color: 'info'
      })
    }
    catch (err: any) {
      toast.add({
        title: 'Помилка повернення на контроль',
        description: err?.data?.detail || String(err),
        color: 'error'
      })
    }
  }

  return {
    getControlBadge,
    isOverdue,
    isControlled,
    decontrolModalOpen,
    decontrolTargetDoc,
    decontrolling,
    openDecontrolModal,
    closeDecontrolModal,
    submitDecontrol,
    reopenControl
  }
}
