<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <UCard id="sec-validation">
    <template #header>
      <div class="flex items-center gap-2 font-semibold">
        <UIcon name="i-lucide-clipboard-check" />
        Перевірка документа
      </div>
    </template>

    <div v-if="!store.report.value" class="flex items-center justify-between gap-3">
      <span class="text-muted text-sm">Документ ще не перевірено за ДСТУ 4163 + НПА.</span>
      <UButton variant="outline" icon="i-lucide-cog" :loading="store.generating.value" @click="store.generateDoc()">
        Згенерувати + перевірити
      </UButton>
    </div>
    <div v-else>
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <UIcon
            :name="store.report.value.compliant ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
            :class="store.report.value.compliant ? 'text-success' : 'text-warning'"
            class="text-lg"
          />
          <span class="font-medium">
            {{ store.report.value.compliant ? 'Помилок не знайдено' : `Знайдено зауважень: ${store.report.value.findings?.length ?? 0}` }}
          </span>
        </div>
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-lucide-refresh-cw"
          :loading="store.generating.value"
          @click="store.generateDoc()"
        >
          Перевірити знову
        </UButton>
      </div>

      <UButton
        v-if="store.report.value.findings?.length"
        :icon="store.showFindings.value ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
        variant="ghost"
        color="neutral"
        size="xs"
        class="mb-2"
        @click="store.showFindings.value = !store.showFindings.value"
      >
        {{ store.showFindings.value ? 'Сховати зауваження' : 'Переглянути зауваження' }}
      </UButton>
      <div v-if="store.showFindings.value && store.report.value.findings?.length" class="space-y-1 mb-2">
        <div
          v-for="f in store.report.value.findings"
          :key="f.rule"
          class="flex gap-2 text-sm p-2 rounded bg-error/10 text-error"
        >
          <UIcon name="i-lucide-circle-x" class="flex-shrink-0 mt-0.5" />
          <span><strong>{{ f.rule }}</strong>: {{ f.message }}</span>
        </div>
      </div>

      <div v-if="store.pdfaInfo.value" class="mt-2 p-3 rounded border border-default text-sm">
        <div class="flex items-center gap-2 font-medium mb-1">
          <UIcon
            :name="store.pdfaInfo.value.conforms ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
            :class="store.pdfaInfo.value.conforms ? 'text-success' : 'text-warning'"
          />
          PDF/A-3: {{ store.pdfaInfo.value.conforms ? 'відповідає (ISO 19005-3:2012)' : 'є зауваження' }}
        </div>
        <div v-for="f in store.pdfaInfo.value.findings" :key="f" class="text-warning text-xs ml-6">
          {{ f }}
        </div>
      </div>
    </div>
  </UCard>
</template>
