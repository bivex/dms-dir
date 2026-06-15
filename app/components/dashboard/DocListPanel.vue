<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
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
        <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" @click="store.refreshAll()" />
        <UButton
          icon="i-lucide-folder-archive"
          variant="ghost"
          color="neutral"
          size="xs"
          title="Вивантажити архів"
          @click="store.openExportModal()"
        />
      </div>
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
        v-for="doc in store.filteredDocs.value"
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
              :label="doc.status"
              size="xs"
              :color="doc.status === 'signed' ? 'success' : doc.status === 'pending' ? 'warning' : 'neutral'"
              variant="subtle"
            />
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
  </div>
</template>
