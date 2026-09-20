<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import StepDocumentHeader from './step-document/StepDocumentHeader.vue'
import StepDocumentRequisites from './step-document/StepDocumentRequisites.vue'
import StepDocumentBody from './step-document/StepDocumentBody.vue'
import StepDocumentWorkflow from './step-document/StepDocumentWorkflow.vue'
import StepDocumentAttachments from './step-document/StepDocumentAttachments.vue'

const store = useDashboard()
const { form } = store
const toast = useToast()

const isCollapsed = ref(false)
const withVisa = ref(false)

onMounted(() => {
  store.reloadCounterparties()
  store.reloadUsers()
})

async function handleGenerateStatusRequest() {
  toast.add({
    title: 'Формування запиту',
    description: 'Функція генерації запиту про хід розгляду буде доступна після збереження поточного документа.',
    color: 'info'
  })
}
</script>

<template>
  <UCard id="sec-document" class="overflow-hidden">
    <template #header>
      <StepDocumentHeader
        v-model:is-collapsed="isCollapsed"
        v-model:with-visa="withVisa"
      />
    </template>

    <div v-show="!isCollapsed" class="p-5 space-y-6">
      <fieldset :disabled="store.isLocked.value" class="space-y-6 border-0 p-0 m-0">
        <!-- 1. Основні реквізити та штампи -->
        <StepDocumentRequisites />

        <USeparator />

        <!-- 2. Текст та адресати -->
        <StepDocumentBody />

        <USeparator />

        <!-- 3. Маршрут погодження та підписання -->
        <StepDocumentWorkflow />

        <USeparator />

        <!-- 4. Додатки -->
        <StepDocumentAttachments />

        <!-- Кнопка збереження -->
        <div v-if="!store.selectedIsScanned.value && !store.isLocked.value" class="pt-2 flex gap-2">
          <UButton icon="i-lucide-save" @click="store.createDoc()">
            Зберегти картку
          </UButton>
        </div>
      </fieldset>

      <!-- Панель контролю розгляду (поза fieldset, щоб не блокувалась при read-only) -->
      <DashboardReviewTrackingPanel
        v-if="form.doc_id && ((store.docStatus.value === 'signed' && form.reg_index) || form.use_control_stamp || (store.selectedDoc.value && store.getControlBadge(store.selectedDoc.value)))"
        :doc-id="form.doc_id"
        class="mt-6"
        @generate-status-request="handleGenerateStatusRequest"
      />
    </div>
  </UCard>
</template>
