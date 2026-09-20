<script setup lang="ts">
import { computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const attachmentsCount = computed(() => {
  return store.attachments.value?.length || 0
})
</script>

<template>
  <UFormField label="Додатки">
    <div class="space-y-3 w-full">
      <!-- Зона перетягування файлів -->
      <div v-if="!store.isLocked.value">
        <FileDropZone
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp,.docx,.xlsx,.doc,.xls"
          :loading="store.attachmentsUploading.value"
          hint="Перетягніть додаток або оберіть файл"
          @file="store.uploadAttachment"
        />
      </div>

      <!-- Таблиця списку додатків -->
      <div v-if="store.attachments.value.length > 0" class="divide-y divide-border border rounded-md">
        <div
          v-for="att in store.attachments.value"
          :key="att.id"
          class="flex items-center justify-between p-2 text-sm"
        >
          <div class="flex items-center gap-2 overflow-hidden flex-grow">
            <UIcon name="i-lucide-file-text" class="text-primary flex-shrink-0 w-4 h-4" />
            <span class="truncate font-medium max-w-[200px]" :title="att.original_filename">
              {{ att.original_filename }}
            </span>
            <span class="text-xs text-muted flex-shrink-0">
              ({{ formatBytes(att.size) }})
            </span>
            <UCheckbox
              v-if="att.mime === 'application/pdf'"
              v-model="att.use_incoming_stamp"
              label="Штамп вх."
              size="xs"
              class="ml-3"
              :disabled="store.isLocked.value"
              @update:model-value="store.toggleAttachmentStamp(form.doc_id, att)"
            />
            <UCheckbox
              v-if="att.mime === 'application/pdf'"
              v-model="att.use_copy_stamp"
              label="Копія"
              size="xs"
              class="ml-3"
              :disabled="store.isLocked.value"
              @update:model-value="store.toggleAttachmentCopyStamp(form.doc_id, att)"
            />
          </div>
          <div class="flex items-center gap-1">
            <UButton
              icon="i-lucide-eye"
              size="xs"
              color="neutral"
              variant="ghost"
              title="Переглянути"
              aria-label="Переглянути додаток"
              @click="store.openAttachmentViewer(form.doc_id, att)"
            />
            <UButton
              icon="i-lucide-download"
              size="xs"
              color="neutral"
              variant="ghost"
              title="Завантажити"
              aria-label="Завантажити додаток"
              @click="store.downloadAttachment(att)"
            />
            <UButton
              icon="i-lucide-pen-tool"
              size="xs"
              color="success"
              variant="ghost"
              title="Підписати (.p7s)"
              aria-label="Підписати (.p7s)"
              @click="store.signAttachmentFile(att)"
            />
            <UButton
              icon="i-lucide-file-archive"
              size="xs"
              color="success"
              variant="ghost"
              title="Підписати (.asice)"
              aria-label="Підписати (.asice)"
              @click="store.signAttachmentFile(att, 'asice')"
            />
            <UButton
              v-if="!store.isLocked.value && att.stored_filename !== 'опис_додатків.pdf'"
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              title="Видалити"
              aria-label="Видалити додаток"
              @click="store.removeAttachment(att.id)"
            />
          </div>
        </div>
      </div>
      <div v-else class="text-xs text-muted">Додатків не додано.</div>

      <!-- Застереження ДСТУ 4163:2020 §5.21 -->
      <div v-if="attachmentsCount > 10" class="text-xs text-warning flex items-start gap-1.5 mt-2 bg-warning/10 p-2 rounded-md">
        <UIcon name="i-lucide-triangle-alert" class="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span><strong>Увага (ДСТУ 4163:2020 §5.21):</strong> Якщо кількість додатків перевищує 10, обов'язково слід скласти опис додатків. Наразі додано {{ attachmentsCount }} додатків.</span>
      </div>
    </div>
  </UFormField>
</template>
