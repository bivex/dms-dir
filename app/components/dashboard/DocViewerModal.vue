<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <UModal v-model:open="store.viewerOpen.value" :ui="{ content: 'max-w-5xl w-full' }">
    <template #content>
      <div class="flex flex-col h-[85vh]">
        <div class="flex items-center justify-between p-3 border-b border-default">
          <div class="flex items-center gap-2 font-medium text-sm min-w-0">
            <UIcon name="i-lucide-file-text" class="text-primary flex-shrink-0" />
            <span class="truncate">{{ store.viewerTitle.value }}</span>
            <UBadge :label="store.viewerMode.value.toUpperCase()" size="xs" variant="subtle" class="flex-shrink-0" />
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <UButton
              icon="i-lucide-download"
              variant="ghost"
              size="xs"
              title="Завантажити"
              @click="store.downloadDoc()"
            />
            <UButton
              v-if="store.viewerMode.value === 'pdf'"
              icon="i-lucide-external-link"
              variant="ghost"
              size="xs"
              title="Відкрити в новій вкладці"
              :disabled="!store.viewerUrl.value"
              @click="store.openViewerInNewTab()"
            />
            <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="store.closeViewer()" />
          </div>
        </div>
        <div class="flex-1 relative bg-elevated overflow-auto">
          <div v-if="store.viewerLoading.value" class="absolute inset-0 flex items-center justify-center">
            <UIcon name="i-lucide-loader-circle" class="animate-spin text-2xl text-muted" />
          </div>
          <!-- PDF: нативний iframe -->
          <iframe
            v-if="store.viewerMode.value === 'pdf' && store.viewerUrl.value"
            :src="store.viewerUrl.value"
            class="w-full h-full border-0"
            title="PDF перегляд"
          />
          <!-- DOCX: конвертований HTML (mammoth) -->
          <div
            v-else-if="store.viewerMode.value === 'docx' && store.viewerHtml.value"
            class="docx-preview mx-auto my-6 max-w-3xl bg-white text-black p-12 shadow-lg rounded"
            v-html="store.viewerHtml.value"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* стилі для DOCX-прев'ю (mammoth HTML): тип. документ на «папері» */
.docx-preview :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 0.8em 0 0.4em; }
.docx-preview :deep(h2) { font-size: 1.25rem; font-weight: 600; margin: 0.7em 0 0.35em; }
.docx-preview :deep(p) { margin: 0.5em 0; line-height: 1.6; text-align: justify; }
.docx-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
.docx-preview :deep(td), .docx-preview :deep(th) { border: 1px solid #ccc; padding: 6px 10px; }
.docx-preview :deep(strong) { font-weight: 700; }
.docx-preview :deep(ul), .docx-preview :deep(ol) { margin: 0.5em 0; padding-left: 1.5em; }
</style>
