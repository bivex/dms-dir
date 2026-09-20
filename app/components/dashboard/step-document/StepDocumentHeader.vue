<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const props = defineProps<{
  isCollapsed: boolean
  withVisa: boolean
}>()

const emit = defineEmits<{
  'update:isCollapsed': [val: boolean]
  'update:withVisa': [val: boolean]
}>()

const store = useDashboard()
const { form } = store
</script>

<template>
  <div>
    <!-- Заголовок картки -->
    <div
      class="p-4 flex items-center gap-3 cursor-pointer select-none border-b border-default bg-elevated/20"
      @click="emit('update:isCollapsed', !props.isCollapsed)"
    >
      <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
        <UIcon name="i-lucide-file-text" class="text-xl" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-semibold truncate">{{ form.title || '(без заголовка)' }}</div>
        <div class="text-xs text-muted flex items-center gap-2 truncate">
          <span>{{ store.docFormatLabel.value }}</span>
          <span>·</span>
          <span class="truncate">{{ form.doc_id }}</span>
        </div>
      </div>
      <UBadge
        :label="store.statusBadge.value.label"
        :color="store.statusBadge.value.color"
        variant="subtle"
        size="sm"
        class="flex-shrink-0"
      />
      <UButton
        :icon="props.isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
        variant="ghost"
        color="neutral"
        size="xs"
        class="flex-shrink-0"
        :title="props.isCollapsed ? 'Розгорнути картку' : 'Згорнути картку'"
        :aria-label="props.isCollapsed ? 'Розгорнути картку' : 'Згорнути картку'"
      />
    </div>

    <!-- Тулбар дій над документом -->
    <div v-show="!props.isCollapsed" class="px-5 pt-4 pb-2 flex items-center gap-2 flex-wrap border-b border-default mb-1">
      <UButton
        icon="i-lucide-eye"
        variant="ghost"
        color="neutral"
        size="xs"
        title="Переглянути документ"
        aria-label="Переглянути документ"
        @click="store.openViewer()"
      >
        Переглянути
      </UButton>
      <UButton
        v-if="store.attachments.value.length > 0"
        icon="i-lucide-eye"
        variant="ghost"
        color="neutral"
        size="xs"
        title="Переглянути обʼєднаний PDF (документ + додатки з маркуванням)"
        aria-label="Переглянути з додатками"
        @click="store.openViewer({ merged: true, visa: props.withVisa })"
      >
        Переглянути з додатками
      </UButton>
      <UButton
        icon="i-lucide-download"
        variant="ghost"
        color="neutral"
        size="xs"
        title="Завантажити документ"
        aria-label="Завантажити документ"
        @click="store.downloadDoc()"
      >
        Завантажити
      </UButton>
      <UButton
        v-if="store.attachments.value.length > 0"
        icon="i-lucide-file-stack"
        variant="ghost"
        color="neutral"
        size="xs"
        title="Завантажити обʼєднаний PDF (документ + додатки з маркуванням)"
        aria-label="Завантажити з додатками"
        @click="store.downloadMergedPdf(props.withVisa)"
      >
        Завантажити з додатками
      </UButton>
      <UButton
        v-if="form.fmt === 'pdf'"
        icon="i-lucide-stamp"
        :variant="props.withVisa ? 'soft' : 'ghost'"
        :color="props.withVisa ? 'primary' : 'neutral'"
        size="xs"
        :title="props.withVisa ? 'Вимкнути штамп-візу' : 'Увімкнути штамп-візу у PDF'"
        aria-label="Штамп-віза"
        @click="emit('update:withVisa', !props.withVisa)"
      >
        {{ props.withVisa ? 'Із візою' : 'Без візи' }}
      </UButton>

      <UDropdownMenu v-if="store.selectedId.value" :items="store.moveToFolderItems.value" :ui="{ content: 'w-52' }">
        <UButton icon="i-lucide-folder" variant="ghost" color="neutral" size="xs">
          <span
            v-if="store.selectedFolderId.value !== null"
            class="inline-block w-2 h-2 rounded-sm"
            :style="{ backgroundColor: store.folderDotColor(store.activeFolder.value?.color) }"
          />
          {{ store.selectedFolderId.value !== null ? (store.activeFolder.value?.name ?? 'Папка') : 'Без папки' }}
        </UButton>
      </UDropdownMenu>

      <UButton
        v-if="store.selectedId.value"
        icon="i-lucide-star"
        :color="store.isFavorite(form.doc_id) ? 'warning' : 'neutral'"
        :variant="store.isFavorite(form.doc_id) ? 'soft' : 'ghost'"
        size="xs"
        :title="store.isFavorite(form.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
        @click="store.toggleFavorite(form.doc_id)"
      />

      <div class="ml-auto">
        <UButton
          v-if="store.selectedId.value"
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="xs"
          title="Видалити"
          @click="store.deleteDoc()"
        />
      </div>
    </div>

    <!-- Банер контролю та дедлайну -->
    <div
      v-if="!props.isCollapsed && store.selectedDoc.value && store.getControlBadge(store.selectedDoc.value)"
      class="mx-5 my-2 flex items-center justify-between gap-3 p-3 rounded-lg border text-sm"
      :class="{
        'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200': store.getControlBadge(store.selectedDoc.value)?.status === 'overdue',
        'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200': store.getControlBadge(store.selectedDoc.value)?.status === 'today' || store.getControlBadge(store.selectedDoc.value)?.status === 'urgent',
        'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900 text-sky-900 dark:text-sky-200': store.getControlBadge(store.selectedDoc.value)?.status === 'pending',
        'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200': store.getControlBadge(store.selectedDoc.value)?.status === 'closed'
      }"
    >
      <div class="flex items-center gap-2.5">
        <UIcon :name="store.getControlBadge(store.selectedDoc.value)?.icon || 'i-lucide-clock'" class="text-xl flex-shrink-0" />
        <div>
          <div class="font-bold flex items-center gap-2">
            <span>{{ store.getControlBadge(store.selectedDoc.value)?.label }}</span>
            <span v-if="store.selectedDoc.value.expected_response_date" class="text-xs font-normal opacity-80">
              (термін до {{ new Date(store.selectedDoc.value.expected_response_date).toLocaleDateString('uk-UA') }})
            </span>
          </div>
          <div v-if="store.selectedDoc.value.review_note" class="text-xs opacity-90 mt-0.5">
            {{ store.selectedDoc.value.review_note }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          v-if="store.getControlBadge(store.selectedDoc.value)?.isControlled"
          icon="i-lucide-check-check"
          color="success"
          size="xs"
          class="font-semibold"
          @click="store.openDecontrolModal(store.selectedDoc.value)"
        >
          Зняти з контролю
        </UButton>
        <UButton
          v-else-if="store.getControlBadge(store.selectedDoc.value)?.status === 'closed'"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="soft"
          size="xs"
          @click="store.reopenControl(store.selectedDoc.value)"
        >
          Повернути на контроль
        </UButton>
      </div>
    </div>

    <!-- Повідомлення про заблокований документ -->
    <div v-if="!props.isCollapsed && store.isLocked.value" class="mx-5 mb-2 flex items-center gap-2 p-3 rounded border border-warning/40 bg-warning/10 text-sm text-warning">
      <UIcon name="i-lucide-lock" class="flex-shrink-0" />
      Документ підписаний / у роботі — редагування заборонене. Щоб змінити — відхильте підпис/погодження (документ повернеться у чернетку).
    </div>
  </div>
</template>
