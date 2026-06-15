<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

onMounted(() => {
  store.fetchMyTasks()
})

const activeTab = ref<'active' | 'completed'>('active')

const filteredTasks = computed(() => {
  if (activeTab.value === 'active') {
    return store.myTasks.value.filter(t => t.status !== 'completed')
  } else {
    return store.myTasks.value.filter(t => t.status === 'completed')
  }
})

function isOverdue(task: any) {
  if (task.status === 'completed') return false
  const today = new Date().toISOString().split('T')[0] ?? ''
  return task.due_date && task.due_date < today
}

function getStatusBadgeColor(task: any) {
  if (task.status === 'completed') return 'success'
  if (isOverdue(task)) return 'error'
  return 'primary'
}

function getStatusBadgeLabel(task: any) {
  if (task.status === 'completed') return 'Виконано'
  if (isOverdue(task)) return 'Прострочено'
  return 'В роботі'
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return 'Без терміну'
  const parts = dateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`
  }
  return dateStr
}

async function selectTaskDoc(docId: string) {
  store.activeCategory.value = 'all'
  await store.selectDoc(docId)
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Завдання та резолюції</h1>
        <p class="text-sm text-muted">Контроль виконання доручень, де ви є виконавцем</p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        size="sm"
        :loading="store.tasksLoading.value"
        @click="store.fetchMyTasks()"
      >
        Оновити
      </UButton>
    </div>

    <!-- Tabs header -->
    <div class="flex border-b border-default">
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2"
        :class="[
          activeTab === 'active'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        ]"
        @click="activeTab = 'active'"
      >
        <UIcon name="i-lucide-clock" />
        В роботі
        <UBadge
          v-if="store.myTasks.value.filter(t => t.status !== 'completed').length"
          :label="String(store.myTasks.value.filter(t => t.status !== 'completed').length)"
          size="xs"
          color="error"
          variant="subtle"
        />
      </button>
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[2px] flex items-center gap-2"
        :class="[
          activeTab === 'completed'
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        ]"
        @click="activeTab = 'completed'"
      >
        <UIcon name="i-lucide-check-circle" />
        Виконані
      </button>
    </div>

    <!-- Task list -->
    <div v-if="store.tasksLoading.value" class="flex flex-col items-center justify-center py-12 gap-2 text-muted">
      <UIcon name="i-lucide-loader-2" class="text-3xl animate-spin text-primary" />
      <span class="text-sm">Завантаження завдань...</span>
    </div>

    <div v-else-if="filteredTasks.length === 0" class="flex flex-col items-center justify-center py-16 text-muted border border-dashed border-default rounded-xl bg-default/5">
      <UIcon
        :name="activeTab === 'active' ? 'i-lucide-clipboard-check' : 'i-lucide-check-check'"
        class="text-5xl opacity-20 mb-3"
      />
      <div class="font-medium text-sm">Немає завдань у цьому розділі</div>
      <p class="text-xs text-muted/80 mt-1">
        {{ activeTab === 'active' ? 'Усі завдання успішно виконано' : 'Тут зʼявляться виконані завдання' }}
      </p>
    </div>

    <div v-else class="grid gap-4">
      <UCard
        v-for="task in filteredTasks"
        :key="task.id"
        class="group transition-all hover:shadow-md border border-default"
      >
        <div class="flex items-start gap-4">
          <!-- Action Button/Checkbox -->
          <div class="pt-1">
            <UButton
              v-if="task.status !== 'completed'"
              icon="i-lucide-square"
              variant="ghost"
              color="neutral"
              size="md"
              class="hover:text-success text-muted p-0 h-6 w-6"
              title="Позначити як виконане"
              @click="store.updateTaskStatus(task.id, 'completed')"
            />
            <UButton
              v-else
              icon="i-lucide-check-square"
              variant="ghost"
              color="success"
              size="md"
              class="p-0 h-6 w-6"
              title="Повернути в роботу"
              @click="store.updateTaskStatus(task.id, 'in_progress')"
            />
          </div>

          <!-- Task content -->
          <div class="flex-1 min-w-0 space-y-2">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <div class="text-sm font-medium text-default leading-snug">
                  {{ task.description }}
                </div>
                <div class="flex items-center gap-2 text-xs text-muted flex-wrap">
                  <span class="font-mono">Резолюція до документа:</span>
                  <a
                    href="#"
                    class="text-primary hover:underline font-semibold flex items-center gap-0.5 truncate"
                    @click.prevent="selectTaskDoc(task.document_id)"
                  >
                    <UIcon name="i-lucide-file-text" class="text-xs flex-shrink-0" />
                    {{ task.document_title }} ({{ task.document_id }})
                  </a>
                </div>
              </div>
              
              <UBadge
                :label="getStatusBadgeLabel(task)"
                :color="getStatusBadgeColor(task)"
                variant="subtle"
                size="xs"
                class="flex-shrink-0"
              />
            </div>

            <!-- Task meta details -->
            <div class="flex items-center gap-4 text-xs text-muted border-t border-default/50 pt-2 flex-wrap">
              <div class="flex items-center gap-1">
                <UIcon name="i-lucide-calendar" />
                <span>Термін виконання:</span>
                <span :class="{ 'text-error font-bold': isOverdue(task) }">
                  {{ formatDate(task.due_date) }}
                </span>
              </div>

              <div v-if="task.completed_at" class="flex items-center gap-1 text-success">
                <UIcon name="i-lucide-check-circle-2" />
                <span>Виконано:</span>
                <span>{{ new Date(task.completed_at).toLocaleDateString('uk-UA') }}</span>
              </div>
              
              <div class="ml-auto text-[10px] text-muted/60">
                Створено: {{ new Date(task.created_at).toLocaleDateString('uk-UA') }}
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
