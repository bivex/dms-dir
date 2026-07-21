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

// швидкі фільтри за статусом з іконками
const quickFilters = [
  { id: 'all', label: 'Усі', icon: 'i-lucide-files' },
  { id: 'draft', label: 'Чернетки', icon: 'i-lucide-file-text' },
  { id: 'pending_approval', label: 'Погодження', icon: 'i-lucide-users-2' },
  { id: 'pending_signatures', label: 'Підпис', icon: 'i-lucide-pen-tool' },
  { id: 'signed', label: 'Підписані', icon: 'i-lucide-check-circle-2' },
  { id: 'rejected', label: 'Відхилені', icon: 'i-lucide-x-circle' },
  { id: 'overdue', label: 'Прострочені', icon: 'i-lucide-alert-triangle' }
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

// Визначення іконки за назвою або типом документа
function getDocIcon(title: string, docType?: string | null): string {
  const t = (title || '').toLowerCase()
  const dt = (docType || '').toLowerCase()
  if (t.includes('скарг') || dt.includes('скарг')) return 'i-lucide-shield-alert text-orange-500'
  if (t.includes('заяв') || dt.includes('заяв')) return 'i-lucide-file-edit text-blue-500'
  if (t.includes('запит') || dt.includes('запит')) return 'i-lucide-help-circle text-teal-500'
  return 'i-lucide-file-text text-neutral-500'
}

function formatDocDate(isoStr?: string | null): string {
  if (!isoStr) return ''
  try {
    const date = new Date(isoStr)
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  } catch (e) {
    return ''
  }
}
</script>

<template>
  <div class="w-80 flex-shrink-0 border-r border-default flex flex-col bg-neutral-50/30 dark:bg-neutral-900/10">
    <!-- Шапка панелі -->
    <div class="p-4 border-b border-default flex items-center justify-between bg-neutral-50/80 dark:bg-neutral-900/40 backdrop-blur-md sticky top-0 z-10">
      <div class="min-w-0">
        <div class="font-bold text-sm tracking-wide text-neutral-800 dark:text-neutral-200 truncate">{{ store.listHeaderLabel.value }}</div>
        <div class="text-[11px] font-semibold text-muted/80 mt-0.5">{{ store.filteredDocs.value.length }} документів</div>
      </div>
      <div class="flex items-center gap-1.5">
        <UButton
          :icon="store.selectMode.value ? 'i-lucide-x' : 'i-lucide-list-checks'"
          :variant="store.selectMode.value ? 'soft' : 'ghost'"
          :color="store.selectMode.value ? 'primary' : 'neutral'"
          size="xs"
          class="rounded-lg"
          :title="store.selectMode.value ? 'Вийти з режиму вибору' : 'Вибрати для видалення'"
          @click="store.toggleSelectMode()"
        />
        <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" color="neutral" class="rounded-lg" @click="store.refreshAll()" />
        <UDropdownMenu :items="moreItems" :_content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" variant="ghost" color="neutral" size="xs" class="rounded-lg" title="Додаткові дії" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- швидкі фільтри за статусом (горизонтальний преміум слайдер) -->
    <div class="py-2 border-b border-default overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1.5 px-3 bg-neutral-50/50 dark:bg-neutral-900/20">
      <button
        v-for="f in quickFilters"
        :key="f.id"
        class="px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 border"
        :class="store.statusFilter.value === f.id
          ? 'bg-primary text-inverted border-primary shadow-sm shadow-primary/20 scale-[1.03]'
          : 'bg-elevated/40 text-muted border-default/30 hover:bg-elevated hover:text-default'"
        @click="store.statusFilter.value = f.id"
      >
        <UIcon :name="f.icon" class="w-3.5 h-3.5" />
        <span>{{ f.label }}</span>
        <span
          v-if="store.statusCounts.value[f.id]"
          class="text-[9px] px-1.5 py-0.5 rounded-full font-bold flex items-center justify-center min-w-[16px] h-4"
          :class="store.statusFilter.value === f.id ? 'bg-white/20 text-white' : 'bg-neutral-200 dark:bg-neutral-800 text-muted'"
        >
          {{ store.statusCounts.value[f.id] }}
        </span>
      </button>
    </div>

    <!-- панель масового вибору -->
    <div v-if="store.selectMode.value" class="p-3 border-b border-default flex items-center gap-2 bg-primary/5 border-l-4 border-l-primary animate-fade-in">
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
        class="rounded-md font-semibold"
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
        class="rounded-md font-semibold"
        :loading="store.deletingBulk.value"
        :disabled="store.selectedForDelete.value.size === 0"
        @click="store.deleteSelected()"
      >
        Видалити
      </UButton>
    </div>

    <!-- Список документів у вигляді карток -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
      <div
        v-for="doc in paged"
        :key="doc.doc_id"
        class="group p-3 border rounded-xl cursor-pointer transition-all duration-200 flex items-start gap-3 relative overflow-hidden"
        :class="store.selectMode.value && store.selectedForDelete.value.has(doc.doc_id)
          ? 'border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-sm'
          : store.selectedId.value === doc.doc_id && !store.selectMode.value
            ? 'border-primary bg-elevated shadow-md ring-1 ring-primary/20 translate-x-0.5'
            : 'border-default/50 hover:border-primary/30 hover:bg-elevated/40 hover:translate-x-0.5 hover:shadow-sm'"
        @click="store.selectMode.value ? store.toggleForDelete(doc.doc_id) : store.selectDoc(doc)"
      >
        <!-- Вертикальний індикатор папки збоку карти -->
        <div
          v-if="doc.folder_id"
          class="absolute left-0 top-0 bottom-0 w-1.5 transition-all"
          :style="{ backgroundColor: store.folderDotColor(store.folders.value.find(x => x.id === doc.folder_id)?.color) }"
          :title="store.folders.value.find(x => x.id === doc.folder_id)?.name"
        />

        <UCheckbox
          v-if="store.selectMode.value"
          :model-value="store.selectedForDelete.value.has(doc.doc_id)"
          class="mt-0.5"
          @update:model-value="store.toggleForDelete(doc.doc_id)"
          @click.stop
        />

        <!-- Іконка типу документа -->
        <div class="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200 mt-0.5">
          <UIcon :name="getDocIcon(doc.title, doc.doc_type)" class="w-4.5 h-4.5" />
        </div>

        <!-- Контент картки -->
        <div class="min-w-0 flex-1 space-y-1">
          <div class="text-xs text-neutral-400 dark:text-neutral-500 font-semibold flex items-center justify-between">
            <span class="font-mono tracking-wider">{{ doc.doc_id }}</span>
            <span v-if="doc.created_at" class="text-[10px] font-medium">{{ formatDocDate(doc.created_at) }}</span>
          </div>

          <div 
            class="text-sm font-semibold truncate leading-snug text-neutral-800 dark:text-neutral-200"
            :class="{ 'text-primary dark:text-primary-400': store.selectedId.value === doc.doc_id && !store.selectMode.value }"
          >
            {{ doc.title || '(без заголовка)' }}
          </div>

          <div class="flex items-center justify-between gap-1.5 pt-0.5">
            <UBadge
              :color="statusMeta(doc.status).color as any"
              variant="subtle"
              size="xs"
              class="rounded-md font-bold px-1.5 py-0 text-[10px]"
            >
              {{ statusMeta(doc.status).label }}
            </UBadge>
          </div>
        </div>

        <!-- Кнопки дій з'являються при наведенні (hover) -->
        <div 
          v-if="!store.selectMode.value" 
          class="flex flex-col gap-1 items-center self-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-l from-neutral-50 dark:from-neutral-900 pl-2 py-1 sticky right-0"
        >
          <UButton
            icon="i-lucide-eye"
            color="primary"
            variant="ghost"
            size="xs"
            class="rounded-md hover:bg-primary/10"
            title="Швидкий перегляд"
            @click.stop="store.previewDoc(doc)"
          />
          <UButton
            icon="i-lucide-star"
            :color="store.isFavorite(doc.doc_id) ? 'warning' : 'neutral'"
            :variant="store.isFavorite(doc.doc_id) ? 'soft' : 'ghost'"
            size="xs"
            class="rounded-md"
            :title="store.isFavorite(doc.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
            @click.stop="store.toggleFavorite(doc.doc_id)"
          />
          <UButton
            v-if="doc.archived"
            icon="i-lucide-archive-restore"
            color="primary"
            variant="ghost"
            size="xs"
            class="rounded-md"
            title="Відновити з архіву"
            @click.stop="store.unarchiveDoc(doc.doc_id)"
          />
          <UButton
            v-else
            icon="i-lucide-archive"
            color="neutral"
            variant="ghost"
            size="xs"
            class="rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="В архів"
            @click.stop="store.archiveDoc(doc.doc_id)"
          />
        </div>
      </div>
      <div v-if="store.filteredDocs.value.length === 0" class="p-8 text-center text-muted text-sm">
        <UIcon name="i-lucide-folder-open" class="text-3xl opacity-20 mb-2" />
        <div>Немає документів</div>
      </div>
    </div>

    <!-- Пагінація списку документів -->
    <div v-if="total > 0" class="border-t border-default px-3 py-2 flex items-center justify-between gap-2 flex-shrink-0 bg-neutral-50/40 dark:bg-neutral-900/10">
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
