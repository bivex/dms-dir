<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

const expandedIndices = ref<Set<number>>(new Set([0]))

function toggleExpand(idx: number) {
  if (expandedIndices.value.has(idx)) {
    expandedIndices.value.delete(idx)
  } else {
    expandedIndices.value.add(idx)
  }
}

function onSelectCounterparty(cpId: string, idx: number) {
  if (!cpId) return
  const cp = store.counterparties.value.find(c => String(c.id) === String(cpId))
  if (cp) {
    const entry = store.bulkDeliveries.value[idx]
    if (entry) {
      entry.recipient.name = cp.name
      entry.recipient.address = cp.address || ''
      entry.recipient.phone = cp.phone || ''
      entry.recipient.code = cp.code
      entry.recipient.subject_type = cp.subject_type
    }
  }
}

const subjectTypes = [
  { label: 'Юридична особа', value: 'legal' },
  { label: 'ФОП', value: 'fop' },
  { label: 'Фізична особа', value: 'person' }
]

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
          Налаштуйте параметри відправки для кожного вибраного документа. Буде згенеровано спільний PDF-файл з усіма бланками Ф.107 та адресними ярликами.
        </p>

        <!-- Стан завантаження -->
        <div v-if="store.bulkLoading.value" class="flex flex-col items-center justify-center py-12 text-center text-muted">
          <UIcon name="i-lucide-loader-2" class="text-4xl animate-spin mb-3 text-primary" />
          <div class="text-sm">Завантаження даних для відправки...</div>
        </div>

        <div v-else class="space-y-4">
          <!-- Список документів -->
          <div class="max-h-[55vh] overflow-y-auto pr-1 space-y-4">
            <div
              v-for="(entry, entryIdx) in store.bulkDeliveries.value"
              :key="entry.doc_id"
              class="border border-default rounded-lg overflow-hidden bg-elevated/5"
            >
              <!-- Заголовок картки документа -->
              <div
                class="flex items-center justify-between p-3 bg-elevated/20 cursor-pointer select-none hover:bg-elevated/40 transition-colors"
                @click="toggleExpand(entryIdx)"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <UIcon :name="expandedIndices.has(entryIdx) ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="text-muted" />
                  <UIcon name="i-lucide-file-text" class="text-primary flex-shrink-0" />
                  <span class="font-medium text-sm truncate">{{ entry.title }}</span>
                  <span class="text-xs text-muted">({{ entry.doc_id }})</span>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge label="Укрпошта" size="xs" variant="subtle" color="primary" />
                </div>
              </div>

              <!-- Вміст налаштувань документа -->
              <div v-if="expandedIndices.has(entryIdx)" class="p-4 border-t border-default space-y-4 bg-default/40">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Відправник -->
                  <div class="p-3 rounded-lg border border-default bg-elevated/10 space-y-3">
                    <div class="font-semibold text-xs text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <UIcon name="i-lucide-building" />
                      Відправник
                    </div>
                    <UFormField label="Найменування / ПІБ">
                      <UInput v-model="entry.sender.name" class="w-full" size="sm" />
                    </UFormField>
                    <UFormField label="Адреса">
                      <UInput v-model="entry.sender.address" class="w-full" size="sm" />
                    </UFormField>
                    <div class="grid grid-cols-2 gap-2">
                      <UFormField label="Код ЄДРПОУ / ІПН">
                        <UInput v-model="entry.sender.code" class="w-full" size="sm" />
                      </UFormField>
                      <UFormField label="Телефон">
                        <UInput v-model="entry.sender.phone" class="w-full" size="sm" />
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
                        @update:model-value="(val) => onSelectCounterparty(val, entryIdx)"
                      />
                    </div>
                    <UFormField label="Найменування / ПІБ">
                      <UInput v-model="entry.recipient.name" class="w-full" size="sm" />
                    </UFormField>
                    <UFormField label="Адреса">
                      <UInput v-model="entry.recipient.address" class="w-full" size="sm" />
                    </UFormField>
                    <div class="grid grid-cols-2 gap-2">
                      <UFormField label="Код ЄДРПОУ / ІПН">
                        <UInput v-model="entry.recipient.code" class="w-full" size="sm" />
                      </UFormField>
                      <UFormField label="Телефон">
                        <UInput v-model="entry.recipient.phone" class="w-full" size="sm" />
                      </UFormField>
                    </div>
                    <UFormField label="Тип суб'єкта">
                      <USelect v-model="entry.recipient.subject_type" :items="subjectTypes" class="w-full" size="sm" />
                    </UFormField>
                  </div>
                </div>

                <!-- Таблиця предметів опису вкладення -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="font-semibold text-xs text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
                      <UIcon name="i-lucide-list" class="text-primary" />
                      Предмети вкладення (для опису Ф.107)
                    </div>
                    <UButton
                      icon="i-lucide-plus"
                      variant="ghost"
                      size="xs"
                      @click="store.addBulkItem(entryIdx)"
                    >
                      Додати предмет
                    </UButton>
                  </div>

                  <div class="border border-default rounded-lg overflow-hidden bg-elevated/5">
                    <div class="grid grid-cols-12 gap-2 p-2 bg-elevated/15 border-b border-default text-[10px] font-semibold text-muted select-none">
                      <div class="col-span-7">Найменування предмета</div>
                      <div class="col-span-2 text-center">Кіл-ть</div>
                      <div class="col-span-2 text-right">Цінність (грн)</div>
                      <div class="col-span-1"></div>
                    </div>
                    <div class="divide-y divide-default">
                      <div
                        v-for="(item, itemIdx) in entry.items"
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
                            @click="store.removeBulkItem(entryIdx, itemIdx)"
                          />
                        </div>
                      </div>
                      <div v-if="entry.items.length === 0" class="p-3 text-center text-xs text-muted italic">
                        Список порожній. Буде сформовано пустий опис або адресний ярлик.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Загальні параметри та кнопки дій -->
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
                :disabled="store.bulkDeliveries.value.length === 0"
                @click="store.triggerBulkDeliveryExport()"
              >
                Сформувати спільний PDF
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
