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

// колір/мітка статусу документа для реєстру
function statusMeta(status: string): { color: string; label: string; dot: string } {
  switch (status) {
    case 'signed':
    case 'published':
      return { color: 'success', label: status === 'published' ? 'ЗАРЕЄСТРОВАНО' : 'ЗАРЕЄСТРОВАНО', dot: 'bg-success' }
    case 'pending_signatures':
      return { color: 'warning', label: 'НА ПІДПИСІ', dot: 'bg-warning' }
    case 'pending_approval':
      return { color: 'warning', label: 'ПОГОДЖЕННЯ', dot: 'bg-amber-400' }
    case 'draft':
      return { color: 'info', label: 'ПРОЕКТ', dot: 'bg-info' }
    case 'rejected':
      return { color: 'error', label: 'ВІДХИЛЕНО', dot: 'bg-error' }
    default:
      return { color: 'neutral', label: status.toUpperCase(), dot: 'bg-muted' }
  }
}

function formatDocDate(isoStr?: string | null): string {
  if (!isoStr) return ''
  try {
    const date = new Date(isoStr)
    return date.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch (e) {
    return ''
  }
}
</script>

<template>
  <div class="w-[390px] flex-shrink-0 border-r border-default flex flex-col bg-neutral-100/40 dark:bg-neutral-900/10">
    <!-- Шапка реєстру -->
    <div class="p-3 border-b border-default flex items-center justify-between bg-neutral-100/80 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
      <div class="min-w-0">
        <div class="font-bold text-xs uppercase tracking-wider text-neutral-700 dark:text-neutral-350">{{ store.listHeaderLabel.value }}</div>
        <div class="text-[10px] font-bold text-muted/70 mt-0.5">{{ store.filteredDocs.value.length }} записів у реєстрі</div>
      </div>
      <div class="flex items-center gap-1">
        <UButton
          :icon="store.selectMode.value ? 'i-lucide-x' : 'i-lucide-list-checks'"
          :variant="store.selectMode.value ? 'soft' : 'ghost'"
          :color="store.selectMode.value ? 'primary' : 'neutral'"
          size="xs"
          class="rounded"
          :title="store.selectMode.value ? 'Вийти з режиму вибору' : 'Вибрати для дії'"
          @click="store.toggleSelectMode()"
        />
        <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" color="neutral" class="rounded" @click="store.refreshAll()" />
        <UDropdownMenu :items="moreItems" :_content="{ align: 'end' }">
          <UButton icon="i-lucide-ellipsis" variant="ghost" color="neutral" size="xs" class="rounded" title="Додаткові дії" />
        </UDropdownMenu>
      </div>
    </div>

    <!-- Реєстрові фільтри (реєстровий стиль) -->
    <div class="py-1 border-b border-default overflow-x-auto whitespace-nowrap scrollbar-none flex gap-1 px-2 bg-neutral-100/30 dark:bg-neutral-900/5">
      <button
        v-for="f in quickFilters"
        :key="f.id"
        class="px-2 py-0.5 rounded text-[11px] font-semibold transition-all duration-100 flex items-center gap-1 border"
        :class="store.statusFilter.value === f.id
          ? 'bg-primary/10 text-primary border-primary/30 dark:bg-primary/20 dark:text-primary-400 font-bold'
          : 'bg-transparent text-muted border-transparent hover:bg-elevated hover:text-default'"
        @click="store.statusFilter.value = f.id"
      >
        <UIcon :name="f.icon" class="w-3.5 h-3.5" />
        <span>{{ f.label }}</span>
        <span
          v-if="store.statusCounts.value[f.id]"
          class="text-[9px] px-1 py-0 rounded font-bold bg-neutral-200 dark:bg-neutral-800 text-muted ml-0.5"
        >
          {{ store.statusCounts.value[f.id] }}
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
      <div
        v-for="doc in paged"
        :key="doc.doc_id"
        class="group px-3 py-2 cursor-pointer transition-colors flex items-start gap-2 relative border-l-4"
        :class="[
          store.selectMode.value && store.selectedForDelete.value.has(doc.doc_id)
            ? 'bg-primary/5 dark:bg-primary/10 border-l-primary/30'
            : store.selectedId.value === doc.doc_id && !store.selectMode.value
              ? 'bg-neutral-100/90 dark:bg-neutral-800/80 border-l-primary'
              : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50 border-l-transparent',
          doc.folder_id ? 'folder-active' : ''
        ]"
        @click="store.selectMode.value ? store.toggleForDelete(doc.doc_id) : store.selectDoc(doc)"
      >
        <!-- Тонка позначка папки збоку -->
        <div
          v-if="doc.folder_id"
          class="absolute left-0 top-0 bottom-0 w-1 transition-all"
          :style="{ backgroundColor: store.folderDotColor(store.folders.value.find(x => x.id === doc.folder_id)?.color) }"
          :title="store.folders.value.find(x => x.id === doc.folder_id)?.name"
        />

        <UCheckbox
          v-if="store.selectMode.value"
          :model-value="store.selectedForDelete.value.has(doc.doc_id)"
          class="mt-1"
          @update:model-value="store.toggleForDelete(doc.doc_id)"
          @click.stop
        />

        <!-- Реєстраційна картка (РК) -->
        <div class="min-w-0 flex-1 space-y-1">
          <!-- Номер РК та Дата реєстрації (строгий реєстровий вигляд) -->
          <div class="flex items-center justify-between text-[11px] font-mono">
            <span 
              class="font-bold uppercase tracking-tight"
              :class="doc.reg_index ? 'text-primary dark:text-primary-400 text-xs' : 'text-neutral-400 dark:text-neutral-500'"
            >
              {{ doc.reg_index || 'ПРОЕКТ' }}
            </span>
            <span class="text-neutral-450 dark:text-neutral-500 font-bold">
              {{ doc.reg_date || formatDocDate(doc.created_at) }}
            </span>
          </div>

          <!-- Кореспондент / Автор (org_name) — Ключове поле для реєстру -->
          <div class="text-[11px] text-neutral-800 dark:text-neutral-200 truncate leading-tight">
            <span class="text-neutral-400 dark:text-neutral-500 font-medium">Кореспондент:</span>
            <span class="font-bold ml-1">{{ doc.org_name || '—' }}</span>
          </div>

          <!-- Короткий зміст документа -->
          <div class="text-[11px] text-neutral-600 dark:text-neutral-400 line-clamp-2 leading-relaxed">
            <span class="text-neutral-400 dark:text-neutral-500 font-medium">Короткий зміст:</span>
            <span class="ml-1 font-semibold text-neutral-700 dark:text-neutral-350">{{ doc.title || '(без короткого змісту)' }}</span>
          </div>

          <!-- Рядок метаданих: статус розгляду та ID -->
          <div class="flex items-center justify-between pt-0.5">
            <UBadge
              :color="statusMeta(doc.status).color as any"
              variant="subtle"
              size="xs"
              class="rounded font-bold px-1.5 py-0 text-[9px] tracking-wider"
            >
              {{ statusMeta(doc.status).label }}
            </UBadge>
            <span class="text-[10px] text-neutral-400 font-mono">{{ doc.doc_id }}</span>
          </div>
        </div>

        <!-- Кнопки швидких дій з'являються при наведенні (hover) -->
        <div 
          v-if="!store.selectMode.value" 
          class="flex flex-col gap-1 items-center self-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gradient-to-l from-white dark:from-neutral-950 pl-2 sticky right-0"
        >
          <UButton
            icon="i-lucide-eye"
            color="primary"
            variant="ghost"
            size="xs"
            class="rounded hover:bg-primary/10"
            title="Швидкий перегляд"
            @click.stop="store.previewDoc(doc)"
          />
          <UButton
            icon="i-lucide-star"
            :color="store.isFavorite(doc.doc_id) ? 'warning' : 'neutral'"
            :variant="store.isFavorite(doc.doc_id) ? 'soft' : 'ghost'"
            size="xs"
            class="rounded"
            :title="store.isFavorite(doc.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
            @click.stop="store.toggleFavorite(doc.doc_id)"
          />
          <UButton
            v-if="doc.archived"
            icon="i-lucide-archive-restore"
            color="primary"
            variant="ghost"
            size="xs"
            class="rounded"
            title="Відновити з архіву"
            @click.stop="store.unarchiveDoc(doc.doc_id)"
          />
          <UButton
            v-else
            icon="i-lucide-archive"
            color="neutral"
            variant="ghost"
            size="xs"
            class="rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="В архів"
            @click.stop="store.archiveDoc(doc.doc_id)"
          />
        </div>
      </div>
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
