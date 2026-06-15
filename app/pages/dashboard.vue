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
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <DashboardSidebar />

    <DashboardDocListPanel />

    <!-- ГОЛОВНА ОБЛАСТЬ -->
    <div class="flex-1 overflow-y-auto">
      <!-- КАЛЕНДАР ДОКУМЕНТІВ -->
      <DashboardCalendarView v-if="store.activeCategory.value === 'calendar' && !store.selectedId.value" />

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
        <DashboardStepSigning />
        <DashboardStepDelivery />
      </div>
    </div>

    <!-- модалки -->
    <DashboardDocViewerModal />
    <DashboardScanUploadModal />
    <DashboardFolderModal />
  </div>
</template>
