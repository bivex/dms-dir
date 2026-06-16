<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

const dropzone = ref<HTMLElement | null>(null)
const isDragging = ref(false)

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) store.onFileSelected(file)
}

function onFileInput(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) store.onFileSelected(file)
}

function getStatusColor(status: string) {
  if (status === 'signed') return 'success'
  if (status === 'pending_approval' || status === 'pending_signatures') return 'warning'
  return 'neutral'
}

function getStatusLabel(status: string) {
  if (status === 'draft') return 'Чернетка'
  if (status === 'signed') return 'Підписано'
  if (status === 'pending_approval') return 'На погодженні'
  if (status === 'pending_signatures') return 'На підписі'
  return status
}
</script>

<template>
  <UModal v-model:open="store.importModalOpen.value" :ui="{ content: 'max-w-2xl w-full' }">
    <template #content>
      <div class="p-6 space-y-5">
        <!-- Header -->
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
            <UIcon name="i-lucide-upload" class="text-xl" />
          </div>
          <div>
            <div class="font-semibold text-base">Відновлення з бекапу</div>
            <p class="text-xs text-muted">Завантажте JSON-файл бекапу для відновлення документів</p>
          </div>
        </div>

        <!-- Drop zone -->
        <div
          ref="dropzone"
          class="relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer"
          :class="isDragging ? 'border-primary bg-primary/5' : 'border-default hover:border-primary/50 hover:bg-primary/3'"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
          @click="($refs.fileInput as HTMLInputElement)?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".json"
            class="hidden"
            @change="onFileInput"
          />
          <UIcon
            name="i-lucide-file-json"
            class="text-4xl mb-3 mx-auto"
            :class="isDragging ? 'text-primary' : 'text-muted'"
          />
          <div v-if="!store.importFile.value" class="space-y-1">
            <p class="text-sm font-medium">Перетягніть JSON-файл або натисніть для вибору</p>
            <p class="text-xs text-muted">Підтримується формат бекапу ДМС (dms_backup_YYYY-MM-DD.json)</p>
          </div>
          <div v-else class="space-y-1">
            <p class="text-sm font-medium text-primary">{{ store.importFile.value.name }}</p>
            <p class="text-xs text-muted">{{ (store.importFile.value.size / 1024).toFixed(1) }} KB · {{ store.importPreview.value.length }} документ(ів)</p>
          </div>
        </div>

        <!-- Preview table -->
        <div v-if="store.importPreview.value.length > 0" class="space-y-2">
          <div class="flex items-center justify-between">
            <h4 class="text-xs font-semibold text-muted uppercase tracking-wider">Документи у файлі</h4>
            <UBadge :label="`${store.importPreview.value.length} шт.`" variant="subtle" size="xs" />
          </div>
          <UCard :ui="{ body: 'p-0' }">
            <div class="max-h-64 overflow-y-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-default bg-elevated/30">
                    <th class="py-2 px-3 text-left text-xs font-semibold text-muted">ID</th>
                    <th class="py-2 px-3 text-left text-xs font-semibold text-muted">Назва</th>
                    <th class="py-2 px-3 text-left text-xs font-semibold text-muted">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="doc in store.importPreview.value"
                    :key="doc.doc_id"
                    class="border-b border-default last:border-0 hover:bg-elevated/20"
                  >
                    <td class="py-2 px-3 font-mono text-xs text-muted">{{ doc.doc_id }}</td>
                    <td class="py-2 px-3 text-xs truncate max-w-xs">{{ doc.title }}</td>
                    <td class="py-2 px-3">
                      <UBadge
                        :label="getStatusLabel(doc.status)"
                        :color="getStatusColor(doc.status)"
                        variant="subtle"
                        size="xs"
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </UCard>
          <p class="text-xs text-muted flex items-center gap-1">
            <UIcon name="i-lucide-info" />
            Документи зі збігом ID будуть пропущені. Всі відновляться як чернетки.
          </p>
        </div>

        <!-- Result -->
        <div
          v-if="store.importResult.value"
          class="flex items-start gap-3 p-3 rounded-lg"
          :class="store.importResult.value.imported > 0 ? 'bg-success/5 border border-success/20' : 'bg-warning/5 border border-warning/20'"
        >
          <UIcon
            :name="store.importResult.value.imported > 0 ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
            :class="store.importResult.value.imported > 0 ? 'text-success' : 'text-warning'"
            class="flex-shrink-0 mt-0.5"
          />
          <div class="text-sm space-y-0.5">
            <div class="font-medium">
              Імпортовано: {{ store.importResult.value.imported }},
              пропущено: {{ store.importResult.value.skipped }}
            </div>
            <div v-if="store.importResult.value.errors?.length" class="text-xs text-error">
              Помилки: {{ store.importResult.value.errors.join('; ') }}
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 justify-end pt-1">
          <UButton variant="ghost" color="neutral" @click="store.importModalOpen.value = false">
            Закрити
          </UButton>
          <UButton
            icon="i-lucide-upload"
            :loading="store.importing.value"
            :disabled="!store.importFile.value || store.importPreview.value.length === 0 || !!store.importResult.value"
            @click="store.doImport()"
          >
            Імпортувати {{ store.importPreview.value.length > 0 ? `(${store.importPreview.value.length})` : '' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
