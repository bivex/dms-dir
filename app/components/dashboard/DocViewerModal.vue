<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useReaderPrefs } from '~/composables/useReaderPrefs'

const store = useDashboard()
const { scale, serif, inverted, stepScale, toggleSerif, toggleInvert } = useReaderPrefs()

const SERIF_STACK = "Georgia, 'Times New Roman', 'PT Serif', 'Liberation Serif', serif"

const readerStyle = computed(() => ({
  fontSize: `${scale.value}rem`,
  fontFamily: serif.value ? SERIF_STACK : 'var(--font-sans), sans-serif'
}))

// Інверсія документа: для PDF/зображень — CSS-фільтр, для DOCX — клас-перевертання паперу/чорнила
const invertFilter = computed(() =>
  inverted.value ? { filter: 'invert(1) hue-rotate(180deg)' } : {}
)

const isMergedActive = computed(() => store.viewerTitle.value.includes('(з додатками)'))
const isAttachmentActive = computed(() => {
  return store.attachments.value?.some(a => a.original_filename === store.viewerTitle.value)
})

const attachmentDropdownItems = computed(() => {
  if (!store.attachments.value?.length) return []
  return [
    store.attachments.value.map(att => ({
      label: att.original_filename,
      icon: 'i-lucide-paperclip',
      onSelect: () => store.openAttachmentViewer(store.form.doc_id, att)
    }))
  ]
})
</script>

<template>
  <UModal v-model:open="store.viewerOpen.value" :ui="{ content: 'max-w-5xl w-full' }">
    <template #content>
      <div class="flex flex-col h-[85vh]">
        <div class="flex items-center justify-between p-3 border-b border-default gap-2 flex-wrap">
          <div class="flex items-center gap-2 font-medium text-sm min-w-0">
            <UIcon name="i-lucide-file-text" class="text-primary flex-shrink-0" />
            <span class="truncate">{{ store.viewerTitle.value }}</span>
            <UBadge :label="store.viewerMode.value.toUpperCase()" size="xs" variant="subtle" class="flex-shrink-0" />
          </div>

          <!-- Перемикання: Документ / З додатками / Додатки -->
          <div v-if="store.attachments.value?.length > 0" class="flex items-center gap-1">
            <UButton
              size="xs"
              :variant="!isMergedActive && !isAttachmentActive ? 'subtle' : 'ghost'"
              :color="!isMergedActive && !isAttachmentActive ? 'primary' : 'neutral'"
              title="Основний документ"
              aria-label="Основний документ"
              @click="store.openViewer({ doc_id: store.form.doc_id, title: store.form.title, fmt: store.form.fmt })"
            >
              Документ
            </UButton>
            <UButton
              size="xs"
              :variant="isMergedActive ? 'subtle' : 'ghost'"
              :color="isMergedActive ? 'primary' : 'neutral'"
              title="Обʼєднаний PDF (документ + додатки з маркуванням)"
              aria-label="Переглянути з додатками"
              @click="store.openViewer({ doc_id: store.form.doc_id, title: store.form.title, fmt: store.form.fmt, merged: true })"
            >
              З додатками ({{ store.attachments.value.length }})
            </UButton>
            <UDropdownMenu :items="attachmentDropdownItems">
              <UButton
                size="xs"
                :variant="isAttachmentActive ? 'subtle' : 'ghost'"
                :color="isAttachmentActive ? 'primary' : 'neutral'"
                icon="i-lucide-paperclip"
                title="Окремі додатки"
                aria-label="Окремі додатки"
              >
                Файли
              </UButton>
            </UDropdownMenu>
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
            <UButton
              :icon="inverted ? 'i-lucide-moon' : 'i-lucide-sun'"
              :variant="inverted ? 'soft' : 'ghost'"
              :color="inverted ? 'primary' : 'neutral'"
              size="xs"
              title="Інверсія документа (світлий текст на темному тлі)"
              :disabled="store.viewerMode.value === 'unsupported'"
              @click="toggleInvert()"
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
            :style="invertFilter"
            title="PDF перегляд"
          />
          <!-- DOCX: конвертований HTML (mammoth) -->
          <div
            v-else-if="store.viewerMode.value === 'docx' && store.viewerHtml.value"
            class="docx-preview mx-auto my-6 max-w-3xl shadow-lg rounded"
            :class="{ inverted }"
            :style="readerStyle"
            v-html="store.viewerHtml.value"
          />
          <!-- Зображення -->
          <div
            v-else-if="store.viewerMode.value === 'image' && store.viewerUrl.value"
            class="w-full h-full flex items-center justify-center p-4 bg-zinc-900"
          >
            <img :src="store.viewerUrl.value" class="max-w-full max-h-full object-contain" :style="invertFilter" alt="Зображення" />
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
.docx-preview.inverted {
  --reader-paper: #1c1a17;
  --reader-ink: #e9e3d5;
  --reader-border: #4a4339;
}
</style>
