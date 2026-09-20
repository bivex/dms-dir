<script setup lang="ts">
const props = defineProps<{
  open: boolean
  responseDate: string
  responseNote: string
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  'update:responseDate': [val: string]
  'update:responseNote': [val: string]
  submit: []
}>()
</script>

<template>
  <UModal
    :open="props.open"
    title="Внести дані про виконання"
    :ui="{ content: 'sm:max-w-md' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="p-4 space-y-4">
        <UFormField label="Дата отримання відповіді / виконання" required>
          <UInput
            :model-value="props.responseDate"
            type="date"
            class="w-full"
            @update:model-value="emit('update:responseDate', $event)"
          />
        </UFormField>
        <UFormField label="Номер листа-відповіді або зміст резолюції">
          <UInput
            :model-value="props.responseNote"
            placeholder="напр. № 123/01 від 15.08.2026 або До справи"
            class="w-full"
            @update:model-value="emit('update:responseNote', $event)"
          />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2 border-t border-default">
          <UButton variant="ghost" color="neutral" @click="emit('update:open', false)">
            Скасувати
          </UButton>
          <UButton
            color="success"
            :disabled="!props.responseDate"
            :loading="props.loading"
            @click="emit('submit')"
          >
            Зберегти
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
