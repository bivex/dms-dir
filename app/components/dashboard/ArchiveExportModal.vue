<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

const options = [
  { value: 'all', label: 'За весь час' },
  { value: '7d', label: 'За останні 7 днів' },
  { value: '30d', label: 'За останні 30 днів' },
  { value: 'custom', label: 'Власний діапазон' }
]
</script>

<template>
  <UModal v-model:open="store.exportModalOpen.value" :ui="{ content: 'max-w-md w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-folder-archive" class="text-primary text-lg" />
          Вивантаження архіву документів
        </div>

        <p class="text-xs text-muted">
          Виберіть період для вивантаження документів. Буде згенеровано ZIP-архів з оригіналами документів (.asice або .pdf/.docx) та файлом опису metadata.json.
        </p>

        <UFormField label="Період вивантаження">
          <div class="space-y-2 w-full mt-1">
            <label
              v-for="opt in options"
              :key="opt.value"
              class="flex items-center gap-2 p-2 rounded-md border border-default cursor-pointer hover:bg-elevated/50 transition-colors"
              :class="{ 'border-primary bg-primary/5': store.periodType.value === opt.value }"
            >
              <input
                type="radio"
                name="periodType"
                :value="opt.value"
                :checked="store.periodType.value === opt.value"
                class="text-primary focus:ring-primary h-4 w-4 border-default rounded-full"
                @change="store.periodType.value = opt.value as any"
              />
              <span class="text-sm font-medium">{{ opt.label }}</span>
            </label>
          </div>
        </UFormField>

        <!-- Дати для custom періоду -->
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          leave-active-class="transition-all duration-150 ease-in"
          enter-from-class="opacity-0 -translate-y-2"
          enter-to-class="opacity-100 translate-y-0"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 -translate-y-2"
        >
          <div v-if="store.periodType.value === 'custom'" class="grid grid-cols-2 gap-3 p-3 rounded-md bg-elevated/50 border border-default">
            <UFormField label="З дати">
              <UInput
                v-model="store.startDate.value"
                type="date"
                class="w-full"
              />
            </UFormField>
            <UFormField label="По дату">
              <UInput
                v-model="store.endDate.value"
                type="date"
                class="w-full"
              />
            </UFormField>
          </div>
        </Transition>

        <div class="flex gap-2 justify-end pt-2">
          <UButton variant="ghost" color="neutral" @click="store.exportModalOpen.value = false">
            Скасувати
          </UButton>
          <UButton
            icon="i-lucide-download"
            :loading="store.exporting.value"
            @click="store.triggerDownload()"
          >
            Скачати ZIP
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
