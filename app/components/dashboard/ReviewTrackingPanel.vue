<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useReviewTracking } from '~/composables/dashboard/useReviewTracking'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import ReviewResponseModal from './ReviewResponseModal.vue'

const props = defineProps<{
  docId: string
}>()

const emit = defineEmits<{
  (e: 'generate-status-request'): void
}>()

const store = useDashboard()

const generatingRequest = ref(false)

const {
  review,
  loading,
  fetchReview,
  activateTracking,
  markResponded,
  markNotApplicable,
  updateReview,
} = useReviewTracking(props.docId)

const statusColor = computed(() => {
  if (!review.value) return 'neutral'
  if (review.value.review_status === 'responded') return 'success'
  if (review.value.is_overdue) return 'error'
  if (review.value.review_status === 'pending') return 'warning'
  return 'neutral'
})

const statusLabel = computed(() => {
  if (!review.value) return ''
  switch (review.value.review_status) {
    case 'pending':
      return review.value.is_overdue ? 'Прострочено' : 'Очікує відповіді'
    case 'overdue':
      return 'Прострочено'
    case 'responded':
      return 'Знято з контролю'
    case 'not_applicable':
      return 'Не застосовується'
    default:
      return 'Не встановлено'
  }
})

const statusIcon = computed(() => {
  if (!review.value) return 'i-lucide-help-circle'
  if (review.value.review_status === 'responded') return 'i-lucide-check-circle'
  if (review.value.is_overdue) return 'i-lucide-alert-triangle'
  if (review.value.review_status === 'pending') return 'i-lucide-clock'
  return 'i-lucide-minus-circle'
})

onMounted(() => {
  fetchReview()
})

const showResponseForm = ref(false)
const responseDate = ref('')
const responseNote = ref('')

function handleDecontrol() {
  const current = store.selectedDoc.value || { doc_id: props.docId } as any
  store.openDecontrolModal(current)
}

function handleReopen() {
  const current = store.selectedDoc.value || { doc_id: props.docId } as any
  store.reopenControl(current)
}

watch(() => props.docId, () => {
  showResponseForm.value = false
  responseDate.value = ''
  responseNote.value = ''
  fetchReview()
})

async function submitResponseForm() {
  if (!responseDate.value) return
  const isoDateTime = new Date(responseDate.value).toISOString()
  await updateReview({
    review_status: 'responded',
    response_received_at: isoDateTime,
    review_note: responseNote.value || null
  })
  showResponseForm.value = false
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

// Прогрес 30-денного вікна розгляду
const progressPct = computed(() => {
  if (!review.value?.expected_response_date || !review.value?.review_status) return 0
  const now = Date.now()
  const end = new Date(review.value.expected_response_date).getTime()
  const start = end - 30 * 24 * 60 * 60 * 1000
  return Math.max(0, ((now - start) / (end - start)) * 100)
})

const fillClass = computed(() => {
  if (review.value?.review_status === 'responded') return 'bg-success'
  if (review.value?.is_overdue) return 'bg-error'
  const pct = progressPct.value
  if (pct > 75) return 'bg-warning'
  return 'bg-primary'
})

async function handleActivate() {
  await activateTracking(30)
}

async function handleMarkNotApplicable() {
  await markNotApplicable()
}
</script>

<template>
  <div class="border border-default rounded-xl overflow-hidden bg-neutral-50 dark:bg-neutral-900">
    <!-- Шапка панелі -->
    <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-radar" class="text-lg text-sky-400" />
        <span class="text-sm font-semibold tracking-wide">Трекінг розгляду</span>
      </div>
      <div v-if="review">
        <UBadge
          :color="statusColor as any"
          variant="subtle"
          size="md"
          :icon="statusIcon"
        >
          {{ statusLabel }}
        </UBadge>
      </div>
    </div>

    <!-- Стан завантаження -->
    <div v-if="loading" class="flex items-center gap-2 px-4 py-5 text-muted text-xs">
      <UIcon name="i-lucide-loader-2" class="animate-spin" />
      <span>Завантаження...</span>
    </div>

    <!-- Не активовано -->
    <div v-else-if="!review || review.review_status === 'not_set'" class="p-4 flex flex-col gap-3">
      <p class="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed m-0">
        Увімкніть трекінг, щоб отримати нагадування якщо орган влади не відповість у законний строк
        <strong>(30 днів — ЗУ «Про звернення громадян»)</strong>.
      </p>
      <UButton
        icon="i-lucide-bell-plus"
        color="primary"
        variant="soft"
        :loading="loading"
        @click="handleActivate"
      >
        Активувати трекінг
      </UButton>
    </div>

    <!-- Активний трекінг -->
    <div v-else class="p-4 flex flex-col gap-3.5">
      <!-- Таймлайн прогресу -->
      <div v-if="review.expected_response_date" class="flex flex-col gap-1">
        <div class="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="fillClass"
            :style="{ width: `${Math.min(progressPct, 100)}%` }"
          />
        </div>
        <div class="flex justify-between text-[11px] text-muted">
          <span>📤 Надіслано</span>
          <span :class="{ 'text-error font-medium': review.is_overdue }">
            {{ review.is_overdue ? '⚠️ Прострочено' : '⏳ Кінець строку' }}
          </span>
        </div>
      </div>

      <!-- Сітка параметрів -->
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-0.5">
          <span class="text-[11px] text-muted uppercase tracking-wider">Очікувана дата відповіді</span>
          <span class="text-sm font-semibold text-default">
            {{ review.expected_response_date ? formatDate(review.expected_response_date) : '—' }}
          </span>
        </div>

        <div v-if="review.review_status === 'responded'" class="flex flex-col gap-0.5">
          <span class="text-[11px] text-muted uppercase tracking-wider">Відповідь отримана</span>
          <span class="text-sm font-semibold text-success">
            {{ review.response_received_at ? formatDate(review.response_received_at) : '—' }}
          </span>
        </div>

        <div v-if="review.days_left !== null" class="flex flex-col gap-0.5">
          <span class="text-[11px] text-muted uppercase tracking-wider">Залишилося днів</span>
          <span class="text-sm font-semibold" :class="review.days_left <= 5 ? 'text-warning font-bold' : 'text-success'">
            {{ review.days_left }} дн.
          </span>
        </div>

        <div v-if="review.days_overdue !== null && review.review_status !== 'responded'" class="flex flex-col gap-0.5">
          <span class="text-[11px] text-muted uppercase tracking-wider">Прострочено на</span>
          <span class="text-sm font-bold text-error">
            {{ review.days_overdue }} дн.
          </span>
        </div>
      </div>

      <!-- Попередження про прострочення + запит -->
      <div v-if="review.can_request_status" class="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-3 flex flex-col gap-2">
        <div class="flex items-center gap-1.5 text-sm text-warning font-semibold">
          <UIcon name="i-lucide-alert-triangle" />
          <span>Строк розгляду минув!</span>
        </div>
        <p class="text-xs text-amber-900 dark:text-amber-200 leading-relaxed m-0">
          Орган влади зобов'язаний відповісти протягом 30 днів згідно зі ст.20 ЗУ «Про звернення громадян».
          Ви можете сформувати запит про хід розгляду.
        </p>
        <UButton
          icon="i-lucide-file-plus-2"
          color="warning"
          variant="soft"
          size="xs"
          :loading="generatingRequest"
          @click="emit('generate-status-request')"
        >
          Сформувати запит про хід розгляду
        </UButton>
      </div>

      <!-- Примітка -->
      <div v-if="review.review_note" class="flex items-start gap-1.5 text-xs text-muted italic">
        <UIcon name="i-lucide-sticky-note" class="flex-shrink-0 mt-0.5" />
        <span>{{ review.review_note }}</span>
      </div>

      <!-- Кнопки дій -->
      <div v-if="review.review_status !== 'not_applicable'" class="flex flex-col gap-3">
        <div v-if="review.review_status !== 'responded'" class="flex items-center gap-2 flex-wrap">
          <UButton
            icon="i-lucide-check-check"
            color="success"
            variant="solid"
            size="sm"
            class="font-semibold"
            @click="handleDecontrol"
          >
            Зняти з контролю
          </UButton>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="loading"
            @click="handleMarkNotApplicable"
          >
            Трекінг не потрібен
          </UButton>
        </div>

        <!-- Відображення зняття з контролю -->
        <div v-if="review.review_status === 'responded'" class="flex items-center justify-between bg-success/10 p-3.5 rounded-lg border border-success/30">
          <div class="flex items-start gap-2.5">
            <UIcon name="i-lucide-check-circle-2" class="text-success text-xl mt-0.5" />
            <div class="flex flex-col gap-1">
              <span class="text-success font-bold text-sm">Документ знято з контролю</span>
              <span class="text-xs text-success/80">
                Дата виконання: {{ review.response_received_at ? formatDate(review.response_received_at) : '—' }}
              </span>
              <span v-if="review.review_note" class="text-xs font-medium text-default bg-background/80 px-2.5 py-1.5 rounded border border-default mt-1">
                📌 {{ review.review_note }}
              </span>
            </div>
          </div>
          <UButton
            icon="i-lucide-rotate-ccw"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Повернути на контроль"
            aria-label="Повернути на контроль"
            @click="handleReopen"
          />
        </div>
      </div>
    </div>

    <!-- Модалка внесення виконання (ручний fallback) -->
    <ReviewResponseModal
      v-model:open="showResponseForm"
      v-model:response-date="responseDate"
      v-model:response-note="responseNote"
      :loading="loading"
      @submit="submitResponseForm"
    />
  </div>
</template>
