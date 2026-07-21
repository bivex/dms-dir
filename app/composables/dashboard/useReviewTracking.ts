/**
 * Трекінг розгляду вихідних документів — статус відповіді адресата.
 */
import { ref, computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useAuth } from '~/composables/useAuth'

export interface ReviewStatus {
  doc_id: string
  title: string
  review_status: 'pending' | 'responded' | 'overdue' | 'not_applicable' | 'not_set'
  expected_response_date: string | null
  response_received_at: string | null
  review_note: string | null
  days_left: number | null
  days_overdue: number | null
  is_overdue: boolean
  can_request_status: boolean
}

export function useReviewTracking(docIdSource: MaybeRefOrGetter<string>) {
  const { apiFetch } = useAuth()

  const review = ref<ReviewStatus | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const activeDocId = computed(() => toValue(docIdSource))

  async function fetchReview() {
    const id = activeDocId.value
    if (!id) return
    loading.value = true
    error.value = null
    try {
      review.value = await apiFetch(`/documents/${id}/review`)
    } catch (e: any) {
      error.value = e?.data?.detail || 'Помилка завантаження'
    } finally {
      loading.value = false
    }
  }

  async function activateTracking(days = 30, note?: string) {
    const id = activeDocId.value
    if (!id) return
    loading.value = true
    try {
      review.value = await apiFetch(`/documents/${id}/review/activate`, {
        method: 'POST',
        body: { days, review_note: note },
      })
    } finally {
      loading.value = false
    }
  }

  async function updateReview(patch: Partial<ReviewStatus & { response_received_at: string | null }>) {
    const id = activeDocId.value
    if (!id) return
    loading.value = true
    try {
      review.value = await apiFetch(`/documents/${id}/review`, {
        method: 'PATCH',
        body: patch,
      })
    } finally {
      loading.value = false
    }
  }

  async function markResponded(note?: string) {
    await updateReview({
      review_status: 'responded',
      response_received_at: new Date().toISOString(),
      review_note: note,
    })
  }

  async function markNotApplicable() {
    await updateReview({ review_status: 'not_applicable' })
  }

  // Status helpers
  const statusLabel = computed(() => {
    const s = review.value?.review_status
    const map: Record<string, string> = {
      pending: 'Очікується відповідь',
      responded: 'Відповідь отримана',
      overdue: 'Строк минув',
      not_applicable: 'Трекінг не потрібен',
      not_set: 'Трекінг не активовано',
    }
    return map[s || 'not_set'] ?? s
  })

  const statusColor = computed(() => {
    const s = review.value?.review_status
    const map: Record<string, string> = {
      pending: 'info',
      responded: 'success',
      overdue: 'error',
      not_applicable: 'neutral',
      not_set: 'neutral',
    }
    return map[s || 'not_set'] ?? 'neutral'
  })

  const statusIcon = computed(() => {
    const s = review.value?.review_status
    const map: Record<string, string> = {
      pending: 'i-lucide-clock',
      responded: 'i-lucide-check-circle-2',
      overdue: 'i-lucide-alert-triangle',
      not_applicable: 'i-lucide-minus-circle',
      not_set: 'i-lucide-circle-dashed',
    }
    return map[s || 'not_set'] ?? 'i-lucide-circle-dashed'
  })

  return {
    review,
    loading,
    error,
    fetchReview,
    activateTracking,
    updateReview,
    markResponded,
    markNotApplicable,
    statusLabel,
    statusColor,
    statusIcon,
  }
}
