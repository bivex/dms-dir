<script setup lang="ts">
import { onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useKep } from '~/composables/useKep'
import { useReaderPrefs } from '~/composables/useReaderPrefs'
import KepCertificatesCard from './kep/KepCertificatesCard.vue'
import KepKeyReader from './kep/KepKeyReader.vue'

const store = useDashboard()
const kep = useKep()
const { handwritten } = useReaderPrefs()

onMounted(async () => {
  await kep.bootstrap()
})
</script>

<template>
  <UModal
    v-model:open="store.kepModalOpen.value"
    title="КЕП та сертифікати"
    :ui="{ content: 'sm:max-w-3xl' }"
  >
    <template #content>
      <div class="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
        <!-- Заголовок -->
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-key-round" class="text-primary text-lg" />
          <span>Сертифікати підписання</span>
        </div>

        <USeparator />

        <!-- 1. Поточні сертифікати (КЕП, печатка, факсиміле) -->
        <KepCertificatesCard />

        <USeparator />

        <!-- 2. Загальні налаштування системи -->
        <div class="space-y-3">
          <div class="font-semibold text-sm flex items-center gap-1.5">
            <UIcon name="i-lucide-settings" class="text-primary" />
            <span>Загальні налаштування</span>
          </div>
          <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-default">
            <UCheckbox
              v-model="handwritten"
              label="Ввімкнути рукописну дату та індекс за замовчуванням"
              help="Нові PDF документи будуть автоматично генеруватися з рукописними відмітками прописом"
            />
          </div>
        </div>

        <USeparator />

        <!-- 3. Зчитування та прив'язка нового сертифіката -->
        <KepKeyReader />

        <!-- Нижня панель закриття -->
        <div class="flex justify-end pt-4 border-t border-default">
          <UButton variant="ghost" color="neutral" @click="store.closeKepModal()">
            Закрити
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
