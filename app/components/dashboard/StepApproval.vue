<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store
const { user } = useAuth()

const commentText = ref('')

const hasApprovers = computed(() => {
  return store.approverList.value.length > 0
})

const isActiveApprover = computed(() => {
  if (store.docStatus.value !== 'pending_approval' || !user.value) return false
  return store.approverList.value.some((a: any) => {
    if (a.status !== 'invited') return false
    
    // 1. Спершу за user_id
    if (a.user_id !== null && a.user_id !== undefined && user.value!.id !== undefined) {
      if (Number(a.user_id) === Number(user.value!.id)) return true
    }
    
    // 2. Фолбек на ПІБ
    const approverName = a.full_name.trim().toLowerCase()
    if (approverName === user.value!.name.trim().toLowerCase()) return true
    if (user.value!.kep_subject_cn && approverName === user.value!.kep_subject_cn.trim().toLowerCase()) return true
    
    return false
  })
})

function getStatusLabel(status: string) {
  if (status === 'approved') return 'Погоджено'
  if (status === 'rejected') return 'Відхилено'
  if (status === 'invited') return 'На розгляді'
  return 'Очікує черги'
}

function getStatusColor(status: string) {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'error'
  if (status === 'invited') return 'warning'
  return 'neutral'
}

function getStatusIcon(status: string) {
  if (status === 'approved') return 'i-lucide-circle-check'
  if (status === 'rejected') return 'i-lucide-circle-x'
  if (status === 'invited') return 'i-lucide-user-check'
  return 'i-lucide-circle-dashed'
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

async function handleAction(action: 'approve' | 'reject') {
  await store.performApprovalAction(form.doc_id, action, commentText.value)
  commentText.value = ''
}
</script>

<template>
  <UCard id="sec-approval">
    <template #header>
      <div class="flex items-center justify-between gap-2 font-semibold">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-users" />
          <span>Погодження та візування</span>
        </div>
        <UButton
          v-if="hasApprovers && store.docStatus.value !== 'draft'"
          icon="i-lucide-file-text"
          variant="outline"
          color="neutral"
          size="xs"
          @click="store.downloadApprovalSheet(form.doc_id)"
        >
          Лист погодження (PDF)
        </UButton>
      </div>
    </template>

    <div class="space-y-5">
      <!-- Submit to approval -->
      <div v-if="store.docStatus.value === 'draft'">
        <div class="flex flex-col gap-3 p-4 rounded-lg bg-default/10 border border-default">
          <div class="text-sm font-medium">Подача на погодження</div>
          <p class="text-xs text-muted leading-relaxed">
            Перед тим як документ потрапить на підпис, він повинен пройти візування (погодження) у відповідальних осіб (юрист, бухгалтер, керівник відділу тощо).
          </p>
          <div class="flex items-center justify-between gap-4 mt-2">
            <span v-if="!hasApprovers" class="text-xs text-warning flex items-center gap-1">
              <UIcon name="i-lucide-triangle-alert" class="flex-shrink-0" />
              Призначте хоча б одного погоджувача у формі документа.
            </span>
            <span v-else class="text-xs text-muted">
              У черзі: {{ store.approverList.value.length }} погоджувач(ів) ({{ form.approval_type === 'parallel' ? 'паралельно' : 'послідовно' }}).
            </span>
            <UButton
              icon="i-lucide-send-to-back"
              size="sm"
              :disabled="!hasApprovers || !form.doc_id"
              :loading="store.approvalSubmitting.value"
              @click="store.submitForApproval(form.doc_id)"
            >
              Подати на погодження
            </UButton>
          </div>
        </div>
      </div>

      <!-- Timeline and active action panel -->
      <div v-else-if="hasApprovers" class="space-y-6">
        <!-- Timeline -->
        <div>
          <h4 class="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Хід погодження</h4>
          <div class="space-y-4">
            <div
              v-for="(approver, index) in store.approverList.value"
              :key="index"
              class="flex gap-3 relative pb-4 last:pb-0"
            >
              <!-- vertical line connecting timeline nodes -->
              <div
                v-if="index < store.approverList.value.length - 1"
                class="absolute left-4 top-8 bottom-0 w-0.5 bg-default/40"
              />

              <div
                class="flex items-center justify-center w-8 h-8 rounded-full border flex-shrink-0 z-10"
                :class="[
                  approver.status === 'approved' ? 'bg-success/10 border-success text-success' :
                  approver.status === 'rejected' ? 'bg-error/10 border-error text-error' :
                  approver.status === 'invited' ? 'bg-warning/10 border-warning text-warning animate-pulse' :
                  'bg-default/10 border-default text-muted'
                ]"
              >
                <UIcon :name="getStatusIcon(approver.status)" class="text-base" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium text-sm text-default truncate">{{ approver.full_name }}</div>
                  <UBadge
                    :label="getStatusLabel(approver.status)"
                    :color="getStatusColor(approver.status)"
                    variant="subtle"
                    size="xs"
                  />
                </div>
                <div class="text-xs text-muted mt-0.5">{{ approver.position || 'Посада не вказана' }}</div>
                
                <div v-if="approver.approved_at" class="text-[10px] text-muted mt-1">
                  {{ formatDate(approver.approved_at) }}
                </div>

                <!-- Comment block -->
                <div
                  v-if="approver.comment"
                  class="mt-2 p-2 rounded text-xs bg-default/5 border-l-2 border-primary/40 italic text-muted"
                >
                  "{{ approver.comment }}"
                </div>
              </div>
            </div>
          </div>
        </div>

        <USeparator />

        <!-- User action panel -->
        <div v-if="isActiveApprover" class="p-4 rounded-lg bg-warning/5 border border-warning/30 space-y-4">
          <div class="flex items-center gap-2 font-medium text-sm text-warning">
            <UIcon name="i-lucide-user-check" />
            <span>Ваше рішення щодо погодження</span>
          </div>
          <p class="text-xs text-muted leading-relaxed">
            Ви вказані як активний погоджувач цього документа. Перегляньте вміст документа та прийміть рішення. Ви можете додати зауваження/коментар перед підтвердженням.
          </p>
          <UFormField label="Коментар / Зауваження (необов'язково)">
            <UTextarea
              v-model="commentText"
              placeholder="Додайте зауваження до документа або залиште порожнім..."
              :rows="2"
              class="w-full bg-background"
            />
          </UFormField>
          <div class="flex items-center justify-end gap-2">
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="outline"
              size="sm"
              :loading="store.approvalActing.value"
              @click="handleAction('reject')"
            >
              Відхилити
            </UButton>
            <UButton
              icon="i-lucide-check"
              color="success"
              size="sm"
              :loading="store.approvalActing.value"
              @click="handleAction('approve')"
            >
              Погодити
            </UButton>
          </div>
        </div>
      </div>

      <div v-else class="text-sm text-muted text-center py-4">
        Погоджувачі для цього документа не налаштовані.
      </div>
    </div>
  </UCard>
</template>
