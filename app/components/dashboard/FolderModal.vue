<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <UModal v-model:open="store.folderModalOpen.value" :ui="{ content: 'max-w-sm w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-folder-plus" class="text-primary" />
          {{ store.folderModalMode.value === 'create' ? 'Нова папка' : 'Перейменувати папку' }}
        </div>

        <UFormField label="Назва папки">
          <UInput
            v-model="store.folderName.value"
            placeholder="напр. Фінанси"
            class="w-full"
            autofocus
            @keydown.enter="store.saveFolder()"
          />
        </UFormField>

        <UFormField label="Колір">
          <div class="flex items-center gap-2">
            <button
              v-for="c in store.FOLDER_COLORS"
              :key="c.id"
              type="button"
              class="w-6 h-6 rounded-full border-2 transition-transform"
              :class="store.folderColor.value === c.id ? 'border-default scale-110 ring-2 ring-primary/40' : 'border-transparent'"
              :style="{ backgroundColor: c.hex }"
              :title="c.id"
              @click="store.folderColor.value = c.id"
            />
          </div>
        </UFormField>

        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="store.folderModalOpen.value = false">
            Скасувати
          </UButton>
          <UButton
            icon="i-lucide-check"
            :loading="store.folderSaving.value"
            :disabled="!store.folderName.value.trim()"
            @click="store.saveFolder()"
          >
            {{ store.folderModalMode.value === 'create' ? 'Створити' : 'Зберегти' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
