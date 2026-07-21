<template>
  <div class="review-tracking-panel">
    <!-- Header -->
    <div class="rtp-header">
      <div class="rtp-header-left">
        <UIcon name="i-lucide-radar" class="rtp-icon" />
        <span class="rtp-title">Трекінг розгляду</span>
      </div>
      <div v-if="review" class="rtp-badge">
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

    <!-- Loading -->
    <div v-if="loading" class="rtp-loading">
      <UIcon name="i-lucide-loader-2" class="animate-spin" />
      <span>Завантаження...</span>
    </div>

    <!-- Not activated -->
    <div v-else-if="!review || review.review_status === 'not_set'" class="rtp-empty">
      <p class="rtp-empty-text">
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

    <!-- Active tracking -->
    <div v-else class="rtp-content">
      <!-- Timeline progress -->
      <div v-if="review.expected_response_date" class="rtp-timeline">
        <div class="rtp-timeline-bar">
          <div
            class="rtp-timeline-fill"
            :class="fillClass"
            :style="{ width: `${Math.min(progressPct, 100)}%` }"
          />
        </div>
        <div class="rtp-timeline-labels">
          <span class="rtp-timeline-start">📤 Надіслано</span>
          <span class="rtp-timeline-end" :class="{ 'text-red-500': review.is_overdue }">
            {{ review.is_overdue ? '⚠️ Прострочено' : '⏳ Кінець строку' }}
          </span>
        </div>
      </div>

      <!-- Info grid -->
      <div class="rtp-info-grid">
        <div class="rtp-info-item">
          <span class="rtp-info-label">Очікувана дата відповіді</span>
          <span class="rtp-info-value">
            {{ review.expected_response_date ? formatDate(review.expected_response_date) : '—' }}
          </span>
        </div>

        <div v-if="review.review_status === 'responded'" class="rtp-info-item">
          <span class="rtp-info-label">Відповідь отримана</span>
          <span class="rtp-info-value text-green-600">
            {{ review.response_received_at ? formatDate(review.response_received_at) : '—' }}
          </span>
        </div>

        <div v-if="review.days_left !== null" class="rtp-info-item">
          <span class="rtp-info-label">Залишилося днів</span>
          <span class="rtp-info-value" :class="review.days_left <= 5 ? 'text-orange-500 font-bold' : 'text-green-600'">
            {{ review.days_left }} дн.
          </span>
        </div>

        <div v-if="review.days_overdue !== null && review.review_status !== 'responded'" class="rtp-info-item">
          <span class="rtp-info-label">Прострочено на</span>
          <span class="rtp-info-value text-red-500 font-bold">
            {{ review.days_overdue }} дн.
          </span>
        </div>
      </div>

      <!-- Overdue alert + generate request button -->
      <div v-if="review.can_request_status" class="rtp-overdue-alert">
        <div class="rtp-overdue-alert-header">
          <UIcon name="i-lucide-alert-triangle" class="text-orange-500" />
          <strong>Строк розгляду минув!</strong>
        </div>
        <p class="rtp-overdue-alert-text">
          Орган влади зобов'язаний відповісти протягом 30 днів згідно зі ст.20 ЗУ «Про звернення громадян».
          Ви можете сформувати запит про хід розгляду.
        </p>
        <UButton
          icon="i-lucide-file-plus-2"
          color="warning"
          variant="soft"
          :loading="generatingRequest"
          @click="$emit('generate-status-request')"
        >
          Сформувати запит про хід розгляду
        </UButton>
      </div>

      <!-- Note -->
      <div v-if="review.review_note" class="rtp-note">
        <UIcon name="i-lucide-sticky-note" />
        <span>{{ review.review_note }}</span>
      </div>

      <!-- Actions -->
      <div v-if="review.review_status !== 'responded' && review.review_status !== 'not_applicable'" class="rtp-actions">
        <UButton
          icon="i-lucide-check"
          color="success"
          variant="soft"
          size="sm"
          :loading="loading"
          @click="handleMarkResponded"
        >
          Відповідь отримана
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

      <!-- Responded state -->
      <div v-if="review.review_status === 'responded'" class="rtp-responded">
        <UIcon name="i-lucide-check-circle-2" class="text-green-500 text-xl" />
        <span class="text-green-700 font-medium">Відповідь отримана та зафіксована</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useReviewTracking } from '~/composables/dashboard/useReviewTracking'

const props = defineProps<{ docId: string }>()
const emit = defineEmits<{ 'generate-status-request': [] }>()

const generatingRequest = ref(false)

const {
  review,
  loading,
  fetchReview,
  activateTracking,
  markResponded,
  markNotApplicable,
  statusLabel,
  statusColor,
  statusIcon,
} = useReviewTracking(props.docId)

onMounted(fetchReview)

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('uk-UA', {
    day: 'numeric', month: 'long', year: 'numeric'
  })
}

// Progress bar: how much of the 30-day window has passed
const progressPct = computed(() => {
  if (!review.value?.expected_response_date || !review.value?.review_status) return 0
  const now = Date.now()
  const end = new Date(review.value.expected_response_date).getTime()
  const start = end - 30 * 24 * 60 * 60 * 1000 // 30 days before
  return Math.max(0, ((now - start) / (end - start)) * 100)
})

const fillClass = computed(() => {
  if (review.value?.review_status === 'responded') return 'fill-success'
  if (review.value?.is_overdue) return 'fill-error'
  const pct = progressPct.value
  if (pct > 75) return 'fill-warning'
  return 'fill-info'
})

async function handleActivate() {
  await activateTracking(30)
}

async function handleMarkResponded() {
  await markResponded()
}

async function handleMarkNotApplicable() {
  await markNotApplicable()
}
</script>

<style scoped>
.review-tracking-panel {
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-gray-50);
}

.dark .review-tracking-panel {
  border-color: var(--color-gray-700);
  background: var(--color-gray-900);
}

.rtp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  color: white;
}

.rtp-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rtp-icon { font-size: 18px; color: #60a5fa; }
.rtp-title { font-size: 14px; font-weight: 600; letter-spacing: 0.02em; }

.rtp-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px;
  color: var(--color-gray-500);
  font-size: 13px;
}

.rtp-empty {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rtp-empty-text {
  font-size: 13px;
  color: var(--color-gray-600);
  line-height: 1.5;
  margin: 0;
}

.dark .rtp-empty-text { color: var(--color-gray-400); }

.rtp-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rtp-timeline {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rtp-timeline-bar {
  height: 8px;
  background: var(--color-gray-200);
  border-radius: 4px;
  overflow: hidden;
}

.dark .rtp-timeline-bar { background: var(--color-gray-700); }

.rtp-timeline-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.6s ease;
}

.fill-info { background: linear-gradient(90deg, #3b82f6, #60a5fa); }
.fill-warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.fill-error { background: linear-gradient(90deg, #ef4444, #f87171); }
.fill-success { background: linear-gradient(90deg, #22c55e, #4ade80); }

.rtp-timeline-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-gray-500);
}

.rtp-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.rtp-info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rtp-info-label {
  font-size: 11px;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.rtp-info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-gray-800);
}

.dark .rtp-info-value { color: var(--color-gray-200); }

.rtp-overdue-alert {
  background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
  border: 1px solid #fed7aa;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dark .rtp-overdue-alert {
  background: linear-gradient(135deg, #431407 0%, #7c2d12 100%);
  border-color: #9a3412;
}

.rtp-overdue-alert-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #92400e;
}

.dark .rtp-overdue-alert-header { color: #fed7aa; }

.rtp-overdue-alert-text {
  font-size: 12px;
  color: #78350f;
  line-height: 1.5;
  margin: 0;
}

.dark .rtp-overdue-alert-text { color: #fde68a; }

.rtp-note {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: var(--color-gray-500);
  font-style: italic;
}

.rtp-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rtp-responded {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
</style>
