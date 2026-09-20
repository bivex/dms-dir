<script setup lang="ts">
import type { DocTemplate } from '~/composables/dashboard/useTemplates'
import { TEMPLATE_CATEGORIES } from '~/composables/dashboard/useTemplates'

const props = defineProps<{
  open: boolean
  editIsNew: boolean
  editForm: Partial<DocTemplate>
  loading: boolean
}>()

const emit = defineEmits<{
  'update:open': [val: boolean]
  submit: []
}>()
</script>

<template>
  <UModal
    :open="props.open"
    :title="props.editIsNew ? 'Новий шаблон' : 'Редагувати шаблон'"
    :ui="{ content: 'max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4 p-1">
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Категорія" class="col-span-1">
            <USelect
              v-model="props.editForm.category"
              :options="TEMPLATE_CATEGORIES.filter(c => c.id !== 'all').map(c => ({ label: c.label, value: c.id }))"
              class="w-full"
              size="sm"
            />
          </UFormField>
          <UFormField label="Суб'єкт" class="col-span-1">
            <USelect
              v-model="props.editForm.subject_type"
              :options="[
                { label: 'Юридична особа', value: 'legal' },
                { label: 'ФОП', value: 'fop' },
                { label: 'Фізична особа', value: 'person' },
              ]"
              class="w-full"
              size="sm"
            />
          </UFormField>
        </div>

        <UFormField label="Вид документа" required>
          <UInput v-model="props.editForm.doc_type" placeholder="Наказ, Лист, Заява…" size="sm" class="w-full" />
        </UFormField>

        <UFormField label="Назва шаблону" required>
          <UInput v-model="props.editForm.title" placeholder="Назва шаблону для картки" size="sm" class="w-full" />
        </UFormField>

        <UFormField label="Короткий опис">
          <UInput v-model="props.editForm.description" placeholder="Для чого цей шаблон" size="sm" class="w-full" />
        </UFormField>

        <UFormField label="Типовий заголовок документа">
          <UInput v-model="props.editForm.title_tpl" placeholder="Про надання відпустки" size="sm" class="w-full" />
        </UFormField>

        <UFormField label="Текст документа" required>
          <UTextarea
            v-model="props.editForm.body"
            placeholder="Текст з плейсхолдерами [ПІБ], [Дата]…"
            :rows="8"
            class="w-full font-mono text-xs"
            size="sm"
          />
        </UFormField>

        <UFormField label="Адресат (необов'язково)">
          <UTextarea v-model="props.editForm.addressees" :rows="3" size="sm" class="w-full" placeholder="Директору…" />
        </UFormField>

        <UFormField label="Контакти відправника (необов'язково)">
          <UTextarea v-model="props.editForm.sender_contacts" :rows="3" size="sm" class="w-full" placeholder="Вулиця, місто, тел…" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2 px-1">
        <UButton color="neutral" variant="ghost" @click="emit('update:open', false)">
          Скасувати
        </UButton>
        <UButton
          icon="i-lucide-save"
          :loading="props.loading"
          :disabled="!props.editForm.title || !props.editForm.doc_type"
          @click="emit('submit')"
        >
          {{ props.editIsNew ? 'Створити' : 'Зберегти' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
