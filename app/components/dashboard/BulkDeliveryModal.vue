<script setup lang="ts">
import { onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

function onSelectCounterparty(cpId: string) {
  if (!cpId) return
  const cp = store.counterparties.value.find(c => String(c.id) === String(cpId))
  if (cp) {
    store.bulkRecipient.name = cp.name
    store.bulkRecipient.address = cp.address || ''
    store.bulkRecipient.phone = cp.phone || ''
    store.bulkRecipient.code = cp.code
    store.bulkRecipient.subject_type = cp.subject_type
  }
}

const subjectTypes = [
  { label: 'Юридична особа', value: 'legal' },
  { label: 'ФОП', value: 'fop' },
  { label: 'Фізична особа', value: 'person' }
]

function getDocTitle(docId: string) {
  return store.docs.value.find(d => d.doc_id === docId)?.title || docId
}

onMounted(() => {
  store.reloadCounterparties()
})
</script>

<template>
  <UModal v-model:open="store.bulkModalOpen.value" :ui="{ content: 'max-w-4xl w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-send" class="text-primary text-lg" />
          Групове відправлення (Укрпошта)
        </div>

        <p class="text-xs text-muted">
          Всі вибрані документи будуть об'єднані в **один поштовий опис (Ф.107)** та **один адресний ярлик** для відправлення однією посилкою/листом.
        </p>

        <!-- Обрані документи -->
        <div class="p-3 bg-elevated/10 border border-default rounded-lg space-y-1.5">
          <div class="text-[10px] font-semibold text-muted uppercase tracking-wider select-none">
            Пакет документів для відправки ({{ store.bulkDocIds.value.length }} шт.):
          </div>
          <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            <span
              v-for="docId in store.bulkDocIds.value"
              :key="docId"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs border border-primary/20"
              :title="getDocTitle(docId)"
            >
              <UIcon name="i-lucide-file-text" class="text-[10px]" />
              <span class="font-medium max-w-[180px] truncate">{{ getDocTitle(docId) }}</span>
              <span class="text-[10px] text-muted">({{ docId }})</span>
            </span>
          </div>
        </div>

        <!-- Стан завантаження -->
        <div v-if="store.bulkLoading.value" class="flex flex-col items-center justify-center py-12 text-center text-muted">
          <UIcon name="i-lucide-loader-2" class="text-4xl animate-spin mb-3 text-primary" />
          <div class="text-sm">Підготовка списку та завантаження даних...</div>
        </div>

        <div v-else class="space-y-4">
          <!-- Блоки Відправника та Отримувача -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Відправник -->
            <div class="p-3 rounded-lg border border-default bg-elevated/10 space-y-3">
              <div class="font-semibold text-xs text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
                <UIcon name="i-lucide-building" />
                Відправник
              </div>
              <UFormField label="Найменування / ПІБ">
                <UInput v-model="store.bulkSender.name" class="w-full" size="sm" />
              </UFormField>
              <UFormField label="Адреса">
                <UInput v-model="store.bulkSender.address" class="w-full" size="sm" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Код ЄДРПОУ / ІПН">
                  <UInput v-model="store.bulkSender.code" class="w-full" size="sm" />
                </UFormField>
                <UFormField label="Телефон">
                  <UInput v-model="store.bulkSender.phone" class="w-full" size="sm" />
                </UFormField>
              </div>
            </div>

            <!-- Отримувач -->
            <div class="p-3 rounded-lg border border-default bg-elevated/10 space-y-3">
              <div class="font-semibold text-xs text-muted uppercase tracking-wider flex items-center justify-between select-none">
                <span class="flex items-center gap-1.5">
                  <UIcon name="i-lucide-user" />
                  Отримувач
                </span>
                <USelect
                  placeholder="Обрати з контрагентів..."
                  :items="store.counterparties.value.map(c => ({ label: `${c.name} (${c.code})`, value: String(c.id) }))"
                  class="w-48 text-xs"
                  @update:model-value="onSelectCounterparty"
                />
              </div>
              <UFormField label="Найменування / ПІБ">
                <UInput v-model="store.bulkRecipient.name" class="w-full" size="sm" />
              </UFormField>
              <UFormField label="Адреса">
                <UInput v-model="store.bulkRecipient.address" class="w-full" size="sm" />
              </UFormField>
              <div class="grid grid-cols-2 gap-2">
                <UFormField label="Код ЄДРПОУ / ІПН">
                  <UInput v-model="store.bulkRecipient.code" class="w-full" size="sm" />
                </UFormField>
                <UFormField label="Телефон">
                  <UInput v-model="store.bulkRecipient.phone" class="w-full" size="sm" />
                </UFormField>
              </div>
              <UFormField label="Тип суб'єкта">
                <USelect v-model="store.bulkRecipient.subject_type" :items="subjectTypes" class="w-full" size="sm" />
              </UFormField>
            </div>
          </div>

          <!-- Таблиця предметів спільного опису вкладення -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <div class="font-semibold text-xs text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
                <UIcon name="i-lucide-list" class="text-primary" />
                Предмети спільного опису вкладення (Ф.107)
              </div>
              <UButton
                icon="i-lucide-plus"
                variant="ghost"
                size="xs"
                @click="store.addBulkItem()"
              >
                Додати предмет
              </UButton>
            </div>

            <div class="border border-default rounded-lg overflow-hidden bg-elevated/5">
              <div class="grid grid-cols-12 gap-2 p-2 bg-elevated/15 border-b border-default text-[10px] font-semibold text-muted select-none">
                <div class="col-span-7">Найменування предмета (документа)</div>
                <div class="col-span-2 text-center">Кіл-ть</div>
                <div class="col-span-2 text-right">Цінність (грн)</div>
                <div class="col-span-1"></div>
              </div>
              <div class="divide-y divide-default max-h-[20vh] overflow-y-auto">
                <div
                  v-for="(item, itemIdx) in store.bulkItems.value"
                  :key="itemIdx"
                  class="grid grid-cols-12 gap-2 p-2 items-center"
                >
                  <div class="col-span-7">
                    <UInput v-model="item.name" placeholder="напр. Наказ про затвердження..." class="w-full" size="sm" />
                  </div>
                  <div class="col-span-2 text-center">
                    <UInput v-model.number="item.quantity" type="number" min="1" class="w-full text-center" size="sm" />
                  </div>
                  <div class="col-span-2 text-right">
                    <UInput v-model.number="item.declared_value" type="number" min="0" step="0.1" class="w-full text-right" size="sm" />
                  </div>
                  <div class="col-span-1 text-center">
                    <UButton
                      icon="i-lucide-trash-2"
                      variant="ghost"
                      color="error"
                      size="xs"
                      @click="store.removeBulkItem(itemIdx)"
                    />
                  </div>
                </div>
                <div v-if="store.bulkItems.value.length === 0" class="p-3 text-center text-xs text-muted italic">
                  Список порожній. Додайте принаймні один документ або предмет.
                </div>
              </div>
            </div>
          </div>

          <!-- Параметри та кнопки дій -->
          <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-default bg-elevated/5 p-3 rounded-lg">
            <div class="flex items-center gap-4">
              <UCheckbox
                v-model="store.generateF107.value"
                label="Опис вкладення (Ф.107)"
              />
              <UCheckbox
                v-model="store.generateLabel.value"
                label="Адресний ярлик"
              />
            </div>

            <div class="flex gap-2">
              <UButton variant="ghost" color="neutral" @click="store.bulkModalOpen.value = false">
                Скасувати
              </UButton>
              <UButton
                icon="i-lucide-printer"
                :loading="store.bulkExporting.value"
                :disabled="store.bulkItems.value.length === 0"
                @click="store.triggerBulkDeliveryExport()"
              >
                Сформувати спільний опис/ярлик
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
