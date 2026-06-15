<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const form = store.counterpartyForm

const subjectTypes = [
  { label: 'Юридична особа', value: 'legal' },
  { label: 'ФОП', value: 'fop' },
  { label: 'Фізична особа', value: 'person' }
]
</script>

<template>
  <UModal v-model:open="store.counterpartyModalOpen.value" :ui="{ content: 'max-w-md w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2 font-semibold">
          <UIcon :name="store.counterpartyModalMode.value === 'create' ? 'i-lucide-user-plus' : 'i-lucide-pencil'" class="text-primary text-lg" />
          {{ store.counterpartyModalMode.value === 'create' ? 'Додати контрагента' : 'Редагувати контрагента' }}
        </div>

        <div class="space-y-3">
          <UFormField label="Найменування контрагента" required>
            <UInput
              v-model="form.name"
              placeholder="напр. ТОВ «Дія Консалтинг»"
              class="w-full"
              autofocus
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Код ЄДРПОУ / ІПН" required>
              <UInput
                v-model="form.code"
                placeholder="напр. 12345678"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Тип суб'єкта" required>
              <USelect
                v-model="form.subject_type"
                :items="subjectTypes"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Електронна пошта">
              <UInput
                v-model="form.email"
                type="email"
                placeholder="info@domain.com"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Телефон">
              <UInput
                v-model="form.phone"
                placeholder="+380..."
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Адреса">
            <UTextarea
              v-model="form.address"
              placeholder="Вкажіть поштову або юридичну адресу"
              :rows="2"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="flex gap-2 justify-end pt-2">
          <UButton variant="ghost" color="neutral" @click="store.counterpartyModalOpen.value = false">
            Скасувати
          </UButton>
          <UButton
            icon="i-lucide-check"
            :loading="store.counterpartySaving.value"
            :disabled="!form.name.trim() || !form.code.trim()"
            @click="store.saveCounterparty()"
          >
            {{ store.counterpartyModalMode.value === 'create' ? 'Створити' : 'Зберегти' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
