<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

onMounted(() => {
  store.fetchMyApprovals()
})

function openApproval(docId: string) {
  store.activeCategory.value = 'all'
  store.selectDoc(docId)
}

function getStatusBadge(status: string) {
  if (status === 'invited') return { label: 'На розгляді', color: 'warning' as const }
  if (status === 'approved') return { label: 'Погоджено', color: 'success' as const }
  if (status === 'rejected') return { label: 'Відхилено', color: 'error' as const }
  return { label: status, color: 'neutral' as const }
}
</script>

<template>
  <div class="p-6 space-y-6 max-w-5xl mx-auto">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Погодження на розгляд</h1>
        <p class="text-sm text-muted">Документи, що очікують вашого візування</p>
      </div>
      <UButton
        icon="i-lucide-refresh-cw"
        variant="ghost"
        color="neutral"
        :loading="Boolean(store.approvalsLoading.value)"
        @click="store.fetchMyApprovals()"
      />
    </div>

    <div v-if="store.approvalsLoading.value" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="animate-spin text-2xl text-muted" />
    </div>

    <div v-else-if="!store.myApprovals.value.length" class="text-center py-16 text-muted">
      <UIcon name="i-lucide-check-circle" class="text-5xl mb-3 opacity-30" />
      <div>Немає документів, що очікують вашого погодження</div>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="item in store.myApprovals.value"
        :key="item.doc_id"
        class="flex items-center justify-between gap-4 p-4 rounded-lg border border-default bg-default/5 hover:bg-default/10 transition-colors"
      >
        <div class="flex-1 min-w-0 cursor-pointer" @click="openApproval(item.doc_id)">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-medium text-sm truncate">{{ item.title }}</span>
            <UBadge
              :label="getStatusBadge(item.approver_status).label"
              :color="getStatusBadge(item.approver_status).color"
              variant="subtle"
              size="xs"
            />
          </div>
          <div class="text-xs text-muted">
            {{ item.doc_id }} · {{ item.position || 'Посада не вказана' }}
          </div>
        </div>
        <UButton
          icon="i-lucide-arrow-right"
          variant="ghost"
          color="neutral"
          size="sm"
          @click="openApproval(item.doc_id)"
        />
      </div>
    </div>
  </div>
</template>
