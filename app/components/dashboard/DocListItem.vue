<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const props = defineProps<{
  doc: any
}>()

const store = useDashboard()

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
  <div
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
      :style="{ backgroundColor: store.folderDotColor(store.folders.value.find((x: any) => x.id === doc.folder_id)?.color) }"
      :title="store.folders.value.find((x: any) => x.id === doc.folder_id)?.name"
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
          :class="doc.reg_index ? 'text-primary-700 dark:text-primary-400 text-xs' : 'text-neutral-600 dark:text-neutral-400'"
        >
          {{ doc.reg_index || 'ПРОЕКТ' }}
        </span>
        <span class="text-neutral-600 dark:text-neutral-400 font-bold">
          {{ doc.reg_date || formatDocDate(doc.created_at) }}
        </span>
      </div>

      <!-- Кореспондент / Автор (org_name) — Ключове поле для реєстру -->
      <div class="text-[11px] text-neutral-800 dark:text-neutral-200 truncate leading-tight">
        <span class="text-neutral-600 dark:text-neutral-400 font-medium">Кореспондент:</span>
        <span class="font-bold ml-1">{{ doc.org_name || '—' }}</span>
      </div>

      <!-- Короткий зміст документа -->
      <div class="text-[11px] text-neutral-700 dark:text-neutral-300 line-clamp-2 leading-relaxed">
        <span class="text-neutral-600 dark:text-neutral-400 font-medium">Короткий зміст:</span>
        <span class="ml-1 font-semibold text-neutral-800 dark:text-neutral-200">{{ doc.title || '(без короткого змісту)' }}</span>
      </div>

      <!-- Рядок метаданих: статус розгляду, таймер дедлайну та ID -->
      <div class="flex items-center justify-between gap-1 pt-1 flex-wrap">
        <div class="flex items-center gap-1.5 flex-wrap">
          <UBadge
            :color="statusMeta(doc.status).color as any"
            variant="subtle"
            size="xs"
            class="rounded font-bold px-1.5 py-0 text-[9px] tracking-wider"
          >
            {{ statusMeta(doc.status).label }}
          </UBadge>

          <!-- Візуальний таймер дедлайну (На контролі) -->
          <UBadge
            v-if="store.getControlBadge(doc)"
            :color="store.getControlBadge(doc)?.color as any"
            variant="subtle"
            size="xs"
            class="rounded font-bold px-1.5 py-0 text-[9px] gap-1 shadow-2xs"
            :title="store.getControlBadge(doc)?.tooltip"
          >
            <UIcon :name="store.getControlBadge(doc)?.icon" class="w-3 h-3" />
            <span>{{ store.getControlBadge(doc)?.label }}</span>
          </UBadge>
        </div>

        <span class="text-[10px] text-neutral-600 dark:text-neutral-400 font-mono">{{ doc.doc_id }}</span>
      </div>
    </div>

    <!-- Кнопки швидких дій з'являються при наведенні (hover) -->
    <div 
      v-if="!store.selectMode.value" 
      class="flex flex-col gap-1 items-center self-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-gradient-to-l from-white dark:from-neutral-950 pl-2 sticky right-0"
    >
      <!-- Зняття з контролю (якщо документ на контролі) -->
      <UButton
        v-if="store.getControlBadge(doc)?.isControlled"
        icon="i-lucide-check-check"
        color="success"
        variant="ghost"
        size="xs"
        class="rounded hover:bg-success/15"
        title="Зняти з контролю"
        aria-label="Зняти з контролю"
        @click.stop="store.openDecontrolModal(doc)"
      />

      <!-- Повернути на контроль (якщо вже знято) -->
      <UButton
        v-else-if="store.getControlBadge(doc)?.status === 'closed'"
        icon="i-lucide-rotate-ccw"
        color="neutral"
        variant="ghost"
        size="xs"
        class="rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
        title="Повернути на контроль"
        aria-label="Повернути на контроль"
        @click.stop="store.reopenControl(doc)"
      />

      <UButton
        icon="i-lucide-eye"
        color="primary"
        variant="ghost"
        size="xs"
        class="rounded hover:bg-primary/10"
        title="Швидкий перегляд"
        aria-label="Швидкий перегляд"
        @click.stop="store.previewDoc(doc)"
      />
      <UButton
        icon="i-lucide-star"
        :color="store.isFavorite(doc.doc_id) ? 'warning' : 'neutral'"
        :variant="store.isFavorite(doc.doc_id) ? 'soft' : 'ghost'"
        size="xs"
        class="rounded"
        :title="store.isFavorite(doc.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
        :aria-label="store.isFavorite(doc.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
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
        aria-label="Відновити з архіву"
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
        aria-label="В архів"
        @click.stop="store.archiveDoc(doc.doc_id)"
      />
    </div>
  </div>
</template>
