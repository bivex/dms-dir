<script setup lang="ts">
import { DASHBOARD_KEY, createDashboardStore } from '~/composables/dashboard/useDashboard'

definePageMeta({
  middleware: 'auth',
  layout: 'dashboard'
})

useSeoMeta({
  title: 'Діловод · Документи',
  description: 'Система електронного документообігу ДСТУ 4163'
})

// єдиний store дашборду; дочірні компоненти отримують його через inject (useDashboard)
const store = createDashboardStore()
provide(DASHBOARD_KEY, store)

onMounted(async () => {
  store.loadFavorites()
  await store.refreshAll()
  await store.bootstrapEuSign()
  await store.fetchMyTasks()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <DashboardSidebar />

    <DashboardDocListPanel v-if="store.activeCategory.value !== 'counterparties' && store.activeCategory.value !== 'tasks'" />

    <!-- ГОЛОВНА ОБЛАСТЬ -->
    <div class="flex-1 overflow-y-auto">
      <!-- КОНТРАГЕНТИ -->
      <DashboardCounterpartiesView v-if="store.activeCategory.value === 'counterparties'" />

      <!-- ЗАВДАННЯ -->
      <DashboardTasksView v-else-if="store.activeCategory.value === 'tasks'" />

      <!-- КАЛЕНДАР ДОКУМЕНТІВ -->
      <DashboardCalendarView v-else-if="store.activeCategory.value === 'calendar' && !store.selectedId.value" />

      <!-- ПОГОДЖЕННЯ (вхідна черга для поточного користувача) -->
      <DashboardApprovalsView v-else-if="store.activeCategory.value === 'approvals'" />

      <div v-else-if="!store.selectedId.value && !store.creatingDoc.value" class="flex items-center justify-center h-full">
        <div class="text-center text-muted">
          <UIcon name="i-lucide-file-text" class="text-5xl mb-3 opacity-30" />
          <div>Оберіть документ або створіть новий</div>
        </div>
      </div>

      <div v-else class="max-w-4xl mx-auto p-6 space-y-5">
        <!-- ШАПКА-СТЕПЕР -->
        <UStepper
          :items="store.stepperItems.value"
          :model-value="store.activeStepIndex.value"
          class="px-2"
          @update:model-value="store.scrollToStep"
        />

        <DashboardStepDocument />
        <DashboardStepValidation />
        <DashboardStepApproval />
        <DashboardStepSigning />
        <DashboardStepResolutions v-if="store.docStatus.value === 'signed'" />
        <DashboardStepDelivery />
      </div>
    </div>

    <!-- модалки -->
    <DashboardDocViewerModal />
    <DashboardScanUploadModal />
    <DashboardFolderModal />
    <DashboardArchiveExportModal />
    <DashboardCounterpartyModal />
    <DashboardBulkDeliveryModal />
  </div>
</template>
