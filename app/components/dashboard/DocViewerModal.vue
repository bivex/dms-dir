<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useReaderPrefs } from '~/composables/useReaderPrefs'

const store = useDashboard()
const { scale, serif, stepScale, toggleSerif } = useReaderPrefs()

const SERIF_STACK = "Georgia, 'Times New Roman', 'PT Serif', 'Liberation Serif', serif"

const readerStyle = computed(() => ({
  fontSize: `${scale.value}rem`,
  fontFamily: serif.value ? SERIF_STACK : 'var(--font-sans), sans-serif'
}))
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
            <!-- Елементи керування типографікою читання -->
            <UButton
              :icon="serif ? 'i-lucide-book-a' : 'i-lucide-type'"
              variant="ghost"
              size="xs"
              :title="serif ? 'Шрифт: серифний (читання)' : 'Шрифт: без засічок (інтерфейсний)'"
              @click="toggleSerif()"
            />
            <div class="flex items-center rounded-md border border-default overflow-hidden">
              <UButton
                icon="i-lucide-a-arrow-down"
                variant="ghost"
                size="xs"
                title="Зменшити шрифт"
                :disabled="scale <= 0.85"
                @click="stepScale(-0.15)"
              />
              <span class="px-1 text-xs tabular-nums text-muted select-none">{{ Math.round(scale * 100) }}%</span>
              <UButton
                icon="i-lucide-a-arrow-up"
                variant="ghost"
                size="xs"
                title="Збільшити шрифт"
                :disabled="scale >= 1.6"
                @click="stepScale(0.15)"
              />
            </div>
            <UButton
              icon="i-lucide-download"
              variant="ghost"
              size="xs"
              title="Завантажити"
              @click="store.viewerDownloadAction.value ? store.viewerDownloadAction.value() : store.downloadDoc()"
            />
            <UButton
              v-if="store.viewerMode.value === 'pdf' || store.viewerMode.value === 'image'"
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
            class="docx-preview mx-auto my-6 max-w-3xl shadow-lg rounded"
            :style="readerStyle"
            v-html="store.viewerHtml.value"
          />
          <!-- Зображення -->
          <div
            v-else-if="store.viewerMode.value === 'image' && store.viewerUrl.value"
            class="w-full h-full flex items-center justify-center p-4 bg-zinc-900"
          >
            <img :src="store.viewerUrl.value" class="max-w-full max-h-full object-contain" alt="Зображення" />
          </div>
          <!-- Формат без прев'ю -->
          <div
            v-else-if="store.viewerMode.value === 'unsupported'"
            class="w-full h-full flex flex-col items-center justify-center p-6 text-center text-muted"
          >
            <UIcon name="i-lucide-alert-triangle" class="text-3xl text-warning mb-2" />
            <p class="font-medium text-sm text-foreground">Попередній перегляд цього формату не підтримується</p>
            <p class="text-xs text-muted-foreground mt-1">Ви можете завантажити цей додаток за допомогою кнопки завантаження зверху.</p>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
/* стилі для DOCX-прев'ю (mammoth HTML): тип. документ на «папері» */
.docx-preview {
  max-width: min(68ch, 100%);
  padding: 3rem;
  background: var(--reader-paper, #ffffff);
  color: var(--reader-ink, #111111);
  line-height: 1.7;
  text-rendering: optimizeLegibility;
  hyphens: auto;
}
.docx-preview :deep(h1) { font-size: 1.6em; font-weight: 700; line-height: 1.25; margin: 0.8em 0 0.4em; }
.docx-preview :deep(h2) { font-size: 1.3em; font-weight: 600; line-height: 1.3; margin: 0.7em 0 0.35em; }
.docx-preview :deep(h3) { font-size: 1.1em; font-weight: 600; margin: 0.6em 0 0.3em; }
.docx-preview :deep(p) { margin: 0 0 0.9em; line-height: 1.7; text-align: left; text-wrap: pretty; }
.docx-preview :deep(ul),
.docx-preview :deep(ol) { margin: 0 0 0.9em; padding-left: 1.6em; }
.docx-preview :deep(li) { margin: 0.25em 0; }
.docx-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.95em; }
.docx-preview :deep(td),
.docx-preview :deep(th) { border: 1px solid var(--reader-border, #d4cdb8); padding: 6px 10px; }
.docx-preview :deep(strong) { font-weight: 700; }
.docx-preview :deep(a) { color: var(--ui-primary, #2563eb); }
</style>
