<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <UCard id="sec-delivery">
    <template #header>
      <div class="flex items-center gap-2 font-semibold">
        <UIcon name="i-lucide-send" />
        Відправлення
      </div>
    </template>

    <div v-if="store.docStatus.value === 'signed'" class="flex flex-col items-center text-center py-4 gap-3">
      <UIcon name="i-lucide-circle-check" class="text-success text-4xl" />
      <div>
        <div class="font-medium">Документ підписано</div>
        <div class="text-xs text-muted">Підписаний ASiC-E контейнер готовий до доставки / архівування.</div>
      </div>
      <div class="flex gap-2">
        <UButton icon="i-lucide-archive" @click="store.downloadAsice()">
          Завантажити ASiC-E
        </UButton>
        <UButton variant="outline" icon="i-lucide-eye" @click="store.openViewer()">
          Переглянути
        </UButton>
      </div>
    </div>
    <div v-else class="flex items-center gap-2 text-muted text-sm">
      <UIcon name="i-lucide-lock" />
      Стане доступним після підписання документа.
    </div>
  </UCard>
</template>
