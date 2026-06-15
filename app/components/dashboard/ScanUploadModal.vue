<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <UModal v-model:open="store.scanModalOpen.value" :ui="{ content: 'max-w-lg w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-scan-line" class="text-primary" />
          Оцифрування паперового документа
        </div>
        <p class="text-sm text-muted">
          Завантажте скан (PDF або фото). Скан стане електронним оригіналом
          і його можна буде підписати КЕП — електронна копія набуде юридичної
          сили (Закон 851-IV).
        </p>

        <UFormField label="Файл скану (PDF / JPEG / PNG / TIFF)">
          <FileDropZone
            accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.bmp,.webp,application/pdf,image/*"
            hint="Перетягніть скан сюди"
            :file-name="store.scanFile.value?.name"
            @file="(f) => store.scanFile.value = f"
          />
        </UFormField>

        <UFormField label="Назва документа">
          <UInput v-model="store.scanTitle.value" placeholder="напр. Наказ №7 (паперовий оригінал)" class="w-full" />
        </UFormField>

        <UFormField label="Підписанти (ПІБ | посада, по рядку)">
          <UTextarea
            v-model="store.scanSigners.value"
            :rows="2"
            placeholder="ПЕТРЕНКО Олександр | Директор"
            class="w-full"
          />
        </UFormField>

        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="store.scanModalOpen.value = false">
            Скасувати
          </UButton>
          <UButton
            icon="i-lucide-upload"
            :loading="store.scanUploading.value"
            :disabled="!store.scanFile.value"
            @click="store.uploadScan()"
          >
            Оцифрувати
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
