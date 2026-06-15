<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <UCard id="sec-signing">
    <template #header>
      <div class="flex items-center gap-2 font-semibold">
        <UIcon name="i-lucide-pen-tool" />
        Підписання
        <span v-if="store.signerList.value.length" class="ml-auto text-xs font-normal text-muted">
          {{ store.signerList.value.filter(s => s.status === 'signed').length }}/{{ store.signerList.value.length }} підписано
        </span>
      </div>
    </template>

    <div class="space-y-5">
      <!-- Черга підписання → timeline -->
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="text-sm font-medium">Черга підписання</span>
          <UButton
            v-if="store.docStatus.value === 'draft' || !store.signerList.value.length"
            icon="i-lucide-send"
            :loading="store.submitting.value"
            size="sm"
            @click="store.submitDoc()"
          >
            Подати у чергу
          </UButton>
        </div>
        <div v-if="store.signerList.value.length === 0" class="text-muted text-sm">
          Збережіть картку й подайте у чергу.
        </div>
        <UTimeline v-else :items="store.signerTimeline.value" />
      </div>

      <USeparator />

      <!-- КЕП -->
      <DashboardKeypadPanel />
    </div>
  </UCard>
</template>
