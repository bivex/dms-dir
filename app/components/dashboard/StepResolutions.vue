<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

const resolutionText = ref('')
const tasks = ref<Array<{ executor: string; executor_user_id: number | null; description: string; due_date: string }>>([])

// Draft task inputs
const nextExecutorId = ref<number | string | undefined>(undefined)
const nextDescription = ref('')
const nextDueDate = ref('')

onMounted(() => {
  store.reloadUsers()
})

const userOptions = computed(() =>
  store.users.value.map((u: any) => ({
    label: `${u.name}${u.position ? ' — ' + u.position : ''}`,
    value: u.id
  }))
)

watch(() => form.doc_id, (newId) => {
  if (newId && (store.docStatus.value === 'signed' || store.docStatus.value === 'published')) {
    store.fetchDocResolutions(newId)
  }
}, { immediate: true })

function addTask() {
  const uid = Number(nextExecutorId.value)
  const user = store.users.value.find((u: any) => u.id === uid)
  if (!user || !nextDescription.value.trim() || !nextDueDate.value.trim()) {
    return
  }
  tasks.value.push({
    executor: user.name,
    executor_user_id: user.id,
    description: nextDescription.value.trim(),
    due_date: nextDueDate.value.trim()
  })
  nextExecutorId.value = undefined
  nextDescription.value = ''
  nextDueDate.value = ''
}

function removeTask(index: number) {
  tasks.value.splice(index, 1)
}

async function submitResolution() {
  if (!resolutionText.value.trim()) return
  const success = await store.addDocResolution(form.doc_id, resolutionText.value.trim(), tasks.value)
  if (success) {
    resolutionText.value = ''
    tasks.value = []
    // Also reload the global tasks so sidebar badges update
    await store.fetchMyTasks()
  }
}

function getTaskStatusColor(status?: string) {
  if (status === 'completed') return 'success'
  if (status === 'overdue') return 'error'
  return 'primary'
}

function getTaskStatusLabel(status?: string) {
  if (status === 'completed') return 'Виконано'
  if (status === 'overdue') return 'Прострочено'
  return 'В роботі'
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}
</script>

<template>
  <UCard id="sec-resolutions" class="border border-primary/20">
    <template #header>
      <div class="flex items-center gap-2 font-semibold text-primary">
        <UIcon name="i-lucide-check-square" />
        <span>Резолюції та контроль виконання</span>
      </div>
    </template>

    <div class="space-y-6">
      <!-- Add new resolution (if signed) -->
      <div class="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-4">
        <div class="text-sm font-semibold text-primary">Накласти резолюцію</div>
        
        <UFormField label="Текст резолюції / доручення">
          <UTextarea
            v-model="resolutionText"
            placeholder="Введіть текст резолюції (наприклад: 'Коваленку І. О. — підготувати відповідь до 20.06.2026')"
            :rows="2"
            class="w-full bg-background"
          />
        </UFormField>

        <!-- Sub-tasks list manager -->
        <div class="space-y-3">
          <div class="text-xs font-semibold text-muted uppercase tracking-wider">Завдання виконавцям</div>
          
          <!-- Existing draft tasks -->
          <div v-if="tasks.length > 0" class="space-y-2 mb-3">
            <div
              v-for="(t, idx) in tasks"
              :key="idx"
              class="flex items-center justify-between gap-3 p-2 rounded bg-default/10 text-xs border border-default"
            >
              <div class="min-w-0 flex-1">
                <span class="font-bold text-primary mr-1">[{{ t.executor }}]:</span>
                <span class="text-default">{{ t.description }}</span>
                <span class="text-muted ml-2">(до {{ formatDate(t.due_date) }})</span>
              </div>
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                @click="removeTask(idx)"
              />
            </div>
          </div>

          <!-- Add draft task form -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-2 items-end bg-default/5 p-3 rounded border border-default/50">
            <UFormField label="Виконавець (користувач системи)" class="text-xs">
              <USelect
                v-model="nextExecutorId"
                :items="userOptions"
                placeholder="Оберіть виконавця…"
                size="sm"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Опис завдання" class="text-xs">
              <UInput v-model="nextDescription" placeholder="Підготувати відповідь..." size="sm" class="w-full" />
            </UFormField>
            <div class="flex gap-2 items-center">
              <UFormField label="Термін (Дедлайн)" class="text-xs flex-1">
                <UInput type="date" v-model="nextDueDate" size="sm" class="w-full" />
              </UFormField>
              <UButton
                icon="i-lucide-plus"
                color="neutral"
                size="sm"
                class="flex-shrink-0 mb-0.5"
                title="Додати завдання"
                @click="addTask"
              />
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <UButton
            icon="i-lucide-save"
            :disabled="!resolutionText.trim()"
            :loading="store.savingResolution.value"
            @click="submitResolution"
          >
            Зберегти резолюцію
          </UButton>
        </div>
      </div>

      <!-- Display existing resolutions -->
      <div class="space-y-4">
        <h3 class="text-xs font-semibold text-muted uppercase tracking-wider">Накладені резолюції (історія)</h3>
        
        <div v-if="store.loadingResolutions.value" class="text-center text-xs text-muted py-4">
          Завантаження резолюцій...
        </div>

        <div v-else-if="store.docResolutions.value.length === 0" class="text-center text-xs text-muted py-4 border border-dashed border-default rounded">
          Немає накладених резолюцій для цього документа.
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="res in store.docResolutions.value"
            :key="res.id"
            class="p-4 rounded-lg border border-default bg-elevated/40 space-y-3"
          >
            <div class="flex items-center justify-between text-xs text-muted">
              <span class="font-medium text-default flex items-center gap-1">
                <UIcon name="i-lucide-user" />
                {{ res.author }}
              </span>
              <span>{{ new Date(res.created_at).toLocaleString('uk-UA') }}</span>
            </div>
            
            <p class="text-sm font-medium leading-relaxed bg-default/5 p-2.5 rounded border-l-4 border-primary/50 text-default">
              {{ res.text }}
            </p>

            <!-- Tasks under this resolution -->
            <div v-if="res.tasks && res.tasks.length > 0" class="space-y-2 pl-4 border-l border-default/80">
              <div class="text-[10px] font-semibold text-muted uppercase tracking-wider">Контроль завдань:</div>
              <div
                v-for="t in res.tasks"
                :key="t.id"
                class="flex items-center justify-between gap-3 text-xs p-2 rounded bg-background border border-default/50"
              >
                <div class="min-w-0 flex-1">
                  <span class="font-bold text-primary mr-1">[{{ t.executor }}]:</span>
                  <span class="text-default">{{ t.description }}</span>
                  <span class="text-muted ml-2">(до {{ formatDate(t.due_date) }})</span>
                </div>
                <UBadge
                  :label="getTaskStatusLabel(t.status)"
                  :color="getTaskStatusColor(t.status)"
                  variant="subtle"
                  size="xs"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
