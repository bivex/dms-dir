<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const form = store.userForm
</script>

<template>
  <UModal v-model:open="store.userModalOpen.value" :ui="{ content: 'max-w-md w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2 font-semibold">
          <UIcon :name="store.userModalMode.value === 'create' ? 'i-lucide-user-plus' : 'i-lucide-pencil'" class="text-primary text-lg" />
          {{ store.userModalMode.value === 'create' ? 'Додати користувача' : 'Редагувати користувача' }}
        </div>

        <div class="space-y-3">
          <UFormField label="Імʼя (ПІБ)" required>
            <UInput
              v-model="form.name"
              placeholder="напр. КОВАЛЬЧУК Ірина"
              class="w-full"
              autofocus
            />
          </UFormField>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Email" required>
              <UInput
                v-model="form.email"
                type="email"
                placeholder="user@dilovod.local"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Посада">
              <UInput
                v-model="form.position"
                placeholder="напр. Юрист"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField
            :label="store.userModalMode.value === 'create' ? 'Пароль' : 'Новий пароль (залиште порожнім, щоб не міняти)'"
            :required="store.userModalMode.value === 'create'"
          >
            <UInput
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>
        </div>

        <div class="flex gap-2 justify-end pt-2">
          <UButton variant="ghost" color="neutral" @click="store.userModalOpen.value = false">
            Скасувати
          </UButton>
          <UButton
            icon="i-lucide-check"
            :loading="store.userSaving.value"
            :disabled="!form.name.trim() || !form.email.trim() || (store.userModalMode.value === 'create' && !form.password.trim())"
            @click="store.saveUser()"
          >
            {{ store.userModalMode.value === 'create' ? 'Створити' : 'Зберегти' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
