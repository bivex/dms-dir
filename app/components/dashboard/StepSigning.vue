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

        <!-- Авто-перехід після погодження: документ уже в черзі, кнопка не потрібна -->
        <div
          v-if="store.docStatus.value === 'pending_signatures' && store.approverList.value.length"
          class="flex items-start gap-2 mb-3 p-3 rounded-lg bg-success/5 border border-success/30 text-xs text-muted leading-relaxed"
        >
          <UIcon name="i-lucide-info" class="text-success flex-shrink-0 mt-0.5" />
          <span>
            Документ погоджено й <span class="font-medium text-default">автоматично подано у чергу підписання</span>.
            Окремо подавати не потрібно — перший підписант уже активний. Підпишіть документ через КЕП нижче.
          </span>
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
