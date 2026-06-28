<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

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

// швидкі фільтри за статусом
const quickFilters = [
  { id: 'all', label: 'Усі' },
  { id: 'draft', label: 'Чернетки' },
  { id: 'pending_approval', label: 'На погодженні' },
  { id: 'pending_signatures', label: 'На підписі' },
  { id: 'signed', label: 'Підписані' },
  { id: 'rejected', label: 'Відхилені' },
  { id: 'overdue', label: 'Прострочені' }
] as const

// колір/мітка статусу документа для візуального розділення
function statusMeta(status: string): { color: string; label: string; dot: string } {
  switch (status) {
    case 'signed':
    case 'published':
      return { color: 'success', label: status === 'published' ? 'Опубліковано' : 'Підписано', dot: 'bg-success' }
    case 'pending_signatures':
      return { color: 'warning', label: 'На підписі', dot: 'bg-warning' }
    case 'pending_approval':
      return { color: 'warning', label: 'На погодженні', dot: 'bg-amber-400' }
    case 'draft':
      return { color: 'info', label: 'Чернетка', dot: 'bg-info' }
    case 'rejected':
      return { color: 'error', label: 'Відхилено', dot: 'bg-error' }
    default:
      return { color: 'neutral', label: status, dot: 'bg-muted' }
  }
}
</script>

<template>
  <div class="w-72 flex-shrink-0 border-r border-default flex flex-col">
    <div class="p-3 border-b border-default flex items-center justify-between">
      <div class="min-w-0">
        <div class="font-medium text-sm truncate">{{ store.listHeaderLabel.value }}</div>
        <div class="text-xs text-muted">{{ store.filteredDocs.value.length }} документів</div>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          :icon="store.selectMode.value ? 'i-lucide-x' : 'i-lucide-list-checks'"
          :variant="store.selectMode.value ? 'soft' : 'ghost'"
          :color="store.selectMode.value ? 'primary' : 'neutral'"
          size="xs"
          :title="store.selectMode.value ? 'Вийти з режиму вибору' : 'Вибрати для видалення'"
          @click="store.toggleSelectMode()"
        />
        <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" color="neutral" @click="store.refreshAll()" />
        <UDropdownMenu :items="moreItems" :_content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" variant="ghost" color="neutral" size="xs" title="Додаткові дії" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- швидкі фільтри за статусом -->
    <div class="px-2 py-2 border-b border-default flex flex-wrap gap-1">
      <button
        v-for="f in quickFilters"
        :key="f.id"
        class="px-2 py-0.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1"
        :class="store.statusFilter.value === f.id
          ? 'bg-primary text-inverted'
          : 'bg-elevated/60 text-muted hover:bg-elevated'"
        @click="store.statusFilter.value = f.id"
      >
        {{ f.label }}
        <span
          v-if="store.statusCounts.value[f.id]"
          class="opacity-70"
        >{{ store.statusCounts.value[f.id] }}</span>
      </button>
    </div>

    <!-- панель масового вибору -->
    <div v-if="store.selectMode.value" class="p-2 border-b border-default flex items-center gap-2 bg-elevated/50">
      <UCheckbox
        :model-value="store.selectedForDelete.value.size === store.filteredDocs.value.length && store.filteredDocs.value.length > 0"
        :indeterminate="store.selectedForDelete.value.size > 0 && store.selectedForDelete.value.size < store.filteredDocs.value.length"
        @update:model-value="store.toggleSelectAll()"
      />
      <span class="text-xs text-muted flex-1">обрано: {{ store.selectedForDelete.value.size }}</span>
      <UButton
        icon="i-lucide-send"
        color="primary"
        variant="soft"
        size="xs"
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
        :loading="store.deletingBulk.value"
        :disabled="store.selectedForDelete.value.size === 0"
        @click="store.deleteSelected()"
      >
        Видалити
      </UButton>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div
        v-for="doc in paged"
        :key="doc.doc_id"
        class="p-3 border-b border-default cursor-pointer hover:bg-elevated transition-colors flex items-center gap-2"
        :class="{ 'bg-elevated': store.selectMode.value ? store.selectedForDelete.value.has(doc.doc_id) : store.selectedId.value === doc.doc_id }"
        @click="store.selectMode.value ? store.toggleForDelete(doc.doc_id) : store.selectDoc(doc)"
      >
        <UCheckbox
          v-if="store.selectMode.value"
          :model-value="store.selectedForDelete.value.has(doc.doc_id)"
          @update:model-value="store.toggleForDelete(doc.doc_id)"
          @click.stop
        />
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium truncate flex items-center gap-1.5">
            <span
              v-if="doc.folder_id"
              class="inline-block w-2 h-2 rounded-sm flex-shrink-0"
              :style="{ backgroundColor: store.folderDotColor(store.folders.value.find(x => x.id === doc.folder_id)?.color) }"
              :title="store.folders.value.find(x => x.id === doc.folder_id)?.name"
            />
            <span class="truncate">{{ doc.title || '(без заголовка)' }}</span>
          </div>
          <div class="text-xs text-muted mt-0.5 flex items-center gap-2">
            <span>{{ doc.doc_id }}</span>
            <UBadge
              :label="statusMeta(doc.status).label"
              size="xs"
              :color="statusMeta(doc.status).color as any"
              variant="subtle"
              class="flex items-center gap-1"
            >
              <span class="inline-block w-1.5 h-1.5 rounded-full" :class="statusMeta(doc.status).dot" />
              {{ statusMeta(doc.status).label }}
            </UBadge>
          </div>
        </div>
        <UButton
          v-if="!store.selectMode.value"
          icon="i-lucide-eye"
          color="primary"
          variant="ghost"
          size="xs"
          class="opacity-40 hover:opacity-100"
          title="Швидкий перегляд"
          @click.stop="store.previewDoc(doc)"
        />
        <UButton
          v-if="!store.selectMode.value"
          icon="i-lucide-star"
          :color="store.isFavorite(doc.doc_id) ? 'warning' : 'neutral'"
          :variant="store.isFavorite(doc.doc_id) ? 'soft' : 'ghost'"
          size="xs"
          :class="store.isFavorite(doc.doc_id) ? '' : 'opacity-40 hover:opacity-100'"
          :title="store.isFavorite(doc.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
          @click.stop="store.toggleFavorite(doc.doc_id)"
        />
        <UButton
          v-if="!store.selectMode.value && doc.archived"
          icon="i-lucide-archive-restore"
          color="primary"
          variant="ghost"
          size="xs"
          class="opacity-60 hover:opacity-100"
          title="Відновити з архіву"
          @click.stop="store.unarchiveDoc(doc.doc_id)"
        />
        <UButton
          v-else-if="!store.selectMode.value"
          icon="i-lucide-archive"
          color="neutral"
          variant="ghost"
          size="xs"
          class="opacity-40 hover:opacity-100"
          title="В архів"
          @click.stop="store.archiveDoc(doc.doc_id)"
        />
      </div>
      <div v-if="store.filteredDocs.value.length === 0" class="p-6 text-center text-muted text-sm">
        Немає документів
      </div>
    </div>

    <!-- Пагінація списку документів -->
    <div v-if="total > 0" class="border-t border-default px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0">
      <div class="text-xs text-muted whitespace-nowrap">
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
