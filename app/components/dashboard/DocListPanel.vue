<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { usePagination } from '~/composables/usePagination'

const store = useDashboard()
const confirmDeleteAll = ref(false)

// Клієнтська пагінація списку документів (розбиває filteredDocs на сторінки).
// Розмір сторінки 25 — баланс щільності й продуктивності для панелі списку.
const { page, paged, total, totalPages, from, to } = usePagination(() => store.filteredDocs.value, 25)

const moreItems = computed(() => [
  [{
    label: 'Вивантажити архів (ZIP)',
    icon: 'i-lucide-folder-archive',
    onSelect: () => store.openExportModal()
  }, {
    label: 'Експорт JSON-бекапу',
    icon: 'i-lucide-download',
    onSelect: () => store.doExport()
  }, {
    label: 'Відновити з бекапу',
    icon: 'i-lucide-upload',
    onSelect: () => store.openImportModal()
  }],
  [{
    label: confirmDeleteAll.value ? 'Підтвердити видалення (клікніть ще раз)' : 'Видалити всі документи…',
    icon: confirmDeleteAll.value ? 'i-lucide-alert-triangle' : 'i-lucide-trash-2',
    color: 'error' as const,
    onSelect: () => {
      if (confirmDeleteAll.value) {
        confirmDeleteAll.value = false
        store.deleteAllDocs()
      } else {
        confirmDeleteAll.value = true
        setTimeout(() => { confirmDeleteAll.value = false }, 4000)
      }
    }
  }]
])

// Швидкі фільтри за статусом (реєстровий стиль)
const quickFilters = [
  { id: 'all', label: 'Усі', icon: 'i-lucide-folder-open' },
  { id: 'draft', label: 'Проекти', icon: 'i-lucide-file-code' },
  { id: 'pending_approval', label: 'Погодження', icon: 'i-lucide-users-2' },
  { id: 'pending_signatures', label: 'На підпис', icon: 'i-lucide-pen-tool' },
  { id: 'signed', label: 'Зареєстровані', icon: 'i-lucide-check-circle-2' },
  { id: 'rejected', label: 'Відхилені', icon: 'i-lucide-x-circle' },
  { id: 'overdue', label: 'Контроль', icon: 'i-lucide-clock-alert' }
] as const

import DocListItem from './DocListItem.vue'
</script>

<template>
  <div class="w-[390px] flex-shrink-0 border-r border-default flex flex-col bg-neutral-100/40 dark:bg-neutral-900/10">
    <!-- Шапка реєстру -->
    <div class="p-3 border-b border-default flex items-center justify-between bg-neutral-100/80 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
      <div class="min-w-0">
        <div class="font-bold text-xs uppercase tracking-wider text-neutral-800 dark:text-neutral-200">{{ store.listHeaderLabel.value }}</div>
        <div class="text-[10px] font-bold text-neutral-600 dark:text-neutral-400 mt-0.5">{{ store.filteredDocs.value.length }} записів у реєстрі</div>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          :icon="store.selectMode.value ? 'i-lucide-x' : 'i-lucide-list-checks'"
          :variant="store.selectMode.value ? 'soft' : 'ghost'"
          :color="store.selectMode.value ? 'primary' : 'neutral'"
          size="xs"
          class="rounded"
          :title="store.selectMode.value ? 'Вийти з режиму вибору' : 'Вибрати для дії'"
          :aria-label="store.selectMode.value ? 'Вийти з режиму вибору' : 'Вибрати для дії'"
          @click="store.toggleSelectMode()"
        />
        <UButton
          icon="i-lucide-refresh-cw"
          variant="ghost"
          size="xs"
          color="neutral"
          class="rounded"
          title="Оновити список документів"
          aria-label="Оновити список документів"
          @click="store.refreshAll()"
        />
        <UDropdownMenu :items="moreItems" :_content="{ align: 'end' }">
          <UButton
            icon="i-lucide-ellipsis"
            variant="ghost"
            color="neutral"
            size="xs"
            class="rounded"
            title="Додаткові дії"
            aria-label="Додаткові дії"
          />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Реєстрові фільтри (реєстровий стиль) -->
    <div class="py-1 border-b border-default overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1 px-2 bg-neutral-100/30 dark:bg-neutral-900/5">
      <button
        v-for="f in quickFilters"
        :key="f.id"
        type="button"
        class="px-2 py-0.5 rounded text-[11px] font-semibold transition-all duration-100 flex items-center gap-1 border"
        :class="store.statusFilter.value === f.id
          ? 'bg-primary/15 text-primary-800 dark:text-primary-300 border-primary/40 font-bold'
          : 'bg-transparent text-neutral-600 dark:text-neutral-400 border-transparent hover:bg-elevated hover:text-default'"
        @click="store.statusFilter.value = f.id"
      >
        <UIcon :name="f.icon" class="w-3.5 h-3.5" />
        <span>{{ f.label }}</span>
        <span
          v-if="f.id === 'overdue' ? (store.statusCounts.value.controlled || store.statusCounts.value.overdue) : store.statusCounts.value[f.id]"
          class="text-[9px] px-1 py-0 rounded font-bold ml-0.5"
          :class="f.id === 'overdue' && store.statusCounts.value.overdue
            ? 'bg-red-100 text-red-700 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-900'
            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'"
        >
          {{ f.id === 'overdue' ? (store.statusCounts.value.controlled || store.statusCounts.value.overdue) : store.statusCounts.value[f.id] }}
        </span>
      </button>
    </div>

    <!-- панель масового вибору -->
    <div v-if="store.selectMode.value" class="p-2 border-b border-default flex items-center gap-2 bg-primary/5 border-l-4 border-l-primary">
      <UCheckbox
        :model-value="store.selectedForDelete.value.size === store.filteredDocs.value.length && store.filteredDocs.value.length > 0"
        :indeterminate="store.selectedForDelete.value.size > 0 && store.selectedForDelete.value.size < store.filteredDocs.value.length"
        @update:model-value="store.toggleSelectAll()"
      />
      <span class="text-xs font-semibold text-neutral-600 dark:text-neutral-300 flex-1">Обрано: {{ store.selectedForDelete.value.size }}</span>
      <UButton
        icon="i-lucide-send"
        color="primary"
        variant="soft"
        size="xs"
        class="rounded font-semibold"
        :disabled="store.selectedForDelete.value.size === 0"
        @click="store.openBulkDelivery(Array.from(store.selectedForDelete.value))"
      >
        Пошта
      </UButton>
      <UButton
        icon="i-lucide-trash-2"
        color="error"
        variant="soft"
        size="xs"
        class="rounded font-semibold"
        :loading="store.deletingBulk.value"
        :disabled="store.selectedForDelete.value.size === 0"
        @click="store.deleteSelected()"
      >
        Видалити
      </UButton>
    </div>

    <!-- Реєстраційна таблиця (реєстровий стиль) -->
    <div class="flex-1 overflow-y-auto divide-y divide-default border-b border-default bg-white dark:bg-neutral-950">
      <DocListItem
        v-for="doc in paged"
        :key="doc.doc_id"
        :doc="doc"
      />
      <div v-if="store.filteredDocs.value.length === 0" class="p-8 text-center text-muted text-sm bg-neutral-50/20 dark:bg-neutral-950/20">
        <UIcon name="i-lucide-folder-open" class="text-3xl opacity-20 mb-2" />
        <div>Немає записів у реєстрі</div>
      </div>
    </div>

    <!-- Пагінація реєстру -->
    <div v-if="total > 0" class="border-t border-default px-3 py-1.5 flex items-center justify-between gap-2 flex-shrink-0 bg-neutral-100/40 dark:bg-neutral-950/10">
      <div class="text-xs font-semibold text-muted whitespace-nowrap">
        {{ from }}–{{ to }} з {{ total }}
      </div>
      <UPagination
        :page="page"
        :total="total"
        :items-per-page="25"
        :sibling-count="1"
        size="sm"
        @update:page="page = $event"
      />
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
