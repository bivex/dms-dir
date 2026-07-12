<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const isCollapsed = ref(false)

function onSelectCounterparty(cpId: string) {
  if (!cpId) return
  const cp = store.counterparties.value.find(c => String(c.id) === String(cpId))
  if (cp) {
    store.deliveryRecipient.name = cp.name
    store.deliveryRecipient.address = cp.address || ''
    store.deliveryRecipient.phone = cp.phone || ''
    store.deliveryRecipient.code = cp.code
    store.deliveryRecipient.subject_type = cp.subject_type
  }
}

onMounted(() => {
  store.reloadCounterparties()
  if (store.form.doc_id) {
    store.fetchDeliveryDetails(store.form.doc_id)
  }
})

watch(() => store.form.doc_id, (newId) => {
  if (newId) {
    store.fetchDeliveryDetails(newId)
  }
})
</script>

<template>
  <UCard id="sec-delivery">
    <template #header>
      <div class="flex items-center gap-2 font-semibold cursor-pointer select-none" @click="isCollapsed = !isCollapsed">
        <UIcon name="i-lucide-send" class="text-primary text-lg" />
        <span>Доставка та відправлення (Укрпошта)</span>
        <UButton
          :icon="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          variant="ghost"
          color="neutral"
          size="xs"
          class="ml-auto"
        />
      </div>
    </template>

    <div v-show="!isCollapsed" class="space-y-6">
      <!-- Статус-банер підписання -->
      <div v-if="store.docStatus.value === 'signed'" class="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-default">
        <UIcon name="i-lucide-circle-check" class="text-success text-lg flex-shrink-0" />
        <div>
          <strong>Документ повністю підписано!</strong>
          <span class="text-xs text-muted block mt-0.5">Ви можете завантажити оригінал ASiC-E контейнера або сформувати поштові бланки Укрпошти для відправлення паперового примірника.</span>
        </div>
      </div>
      <div v-else class="flex items-center gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-default">
        <UIcon name="i-lucide-clock" class="text-warning text-lg flex-shrink-0" />
        <div>
          <strong>Попереднє налаштування відправки</strong>
          <span class="text-xs text-muted block mt-0.5">Документ ще не підписано. Ви можете заповнити адресні дані, але друк бланків Укрпошти буде розблоковано після накладання КЕП.</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Блок Відправника -->
        <div class="p-4 rounded-lg bg-elevated/20 border border-default space-y-3">
          <div class="font-medium text-xs text-muted uppercase tracking-wider flex items-center gap-1.5 select-none">
            <UIcon name="i-lucide-building" />
            Відправник
          </div>
          <UFormField label="Найменування / ПІБ">
            <UInput v-model="store.deliverySender.name" class="w-full" />
          </UFormField>
          <UFormField label="Адреса">
            <UInput v-model="store.deliverySender.address" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Код ЄДРПОУ / ІПН">
              <UInput v-model="store.deliverySender.code" class="w-full" />
            </UFormField>
            <UFormField label="Телефон">
              <UInput v-model="store.deliverySender.phone" class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- Блок Отримувача -->
        <div class="p-4 rounded-lg bg-elevated/20 border border-default space-y-3">
          <div class="font-medium text-xs text-muted uppercase tracking-wider flex items-center justify-between select-none">
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
            <UInput v-model="store.deliveryRecipient.name" class="w-full" />
          </UFormField>
          <UFormField label="Адреса">
            <UInput v-model="store.deliveryRecipient.address" class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-2">
            <UFormField label="Код ЄДРПОУ / ІПН">
              <UInput v-model="store.deliveryRecipient.code" class="w-full" />
            </UFormField>
            <UFormField label="Телефон">
              <UInput v-model="store.deliveryRecipient.phone" class="w-full" />
            </UFormField>
          </div>
        </div>
      </div>

      <!-- Таблиця предметів опису вкладення -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="font-medium text-sm flex items-center gap-1.5">
            <UIcon name="i-lucide-list" class="text-primary" />
            Предмети вкладення (для опису Ф.107)
          </div>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            size="xs"
            @click="store.addDeliveryItem()"
          >
            Додати предмет
          </UButton>
        </div>

        <div class="border border-default rounded-lg overflow-hidden bg-elevated/10">
          <div class="grid grid-cols-12 gap-2 p-2 bg-elevated/30 border-b border-default text-xs font-semibold text-muted select-none">
            <div class="col-span-7">Найменування предмета</div>
            <div class="col-span-2 text-center">Кіл-ть</div>
            <div class="col-span-2 text-right">Цінність (грн)</div>
            <div class="col-span-1"></div>
          </div>
          <div class="divide-y divide-default">
            <div
              v-for="(item, idx) in store.deliveryItems.value"
              :key="idx"
              class="grid grid-cols-12 gap-2 p-2 items-center text-sm"
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
                  @click="store.removeDeliveryItem(idx)"
                />
              </div>
            </div>
            <div v-if="store.deliveryItems.value.length === 0" class="p-4 text-center text-xs text-muted italic">
              Список порожній. Буде сформовано пустий опис або адресний ярлик.
            </div>
          </div>
        </div>
      </div>

      <!-- Параметри та кнопки дій -->
      <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-default">
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
          <UButton
            variant="outline"
            icon="i-lucide-archive"
            :disabled="store.docStatus.value !== 'signed'"
            @click="store.downloadAsice()"
          >
            Завантажити ASiC-E
          </UButton>
          <UButton
            icon="i-lucide-printer"
            :loading="store.deliveryExporting.value"
            :disabled="store.docStatus.value !== 'signed'"
            title="Формування бланків доступне лише після підписання КЕП"
            @click="store.triggerDeliveryExport(store.form.doc_id)"
          >
            Сформувати бланки Укрпошти
          </UButton>
        </div>
      </div>
    </div>
  </UCard>
</template>
