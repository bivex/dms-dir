<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

const isOrder = computed(() => !!store.isOrder?.value)

function injectTemplate(type: 'відпустка' | 'прийняття') {
  if (type === 'відпустка') {
    form.title = 'Про надання щорічної відпустки'
    form.body = 'НАКАЗУЮ:\n1. Надати [ПІБ] щорічну основну відпустку тривалістю 14 календарних днів з [Дата] по [Дата] за робочий період з [Дата] по [Дата].\n2. Головному бухгалтеру провести розрахунок та виплату відпускних.\n3. Контроль за виконанням наказу залишаю за собою.'
  } else if (type === 'прийняття') {
    form.title = 'Про прийняття на роботу'
    form.body = 'НАКАЗУЮ:\n1. Прийняти [ПІБ] на роботу з [Дата] на посаду [Посада].\n2. Встановити посадовий оклад згідно зі штатним розкладом.\n3. Контроль за виконанням наказу покласти на [ПІБ].'
  }
}

const addresseesCount = computed(() => {
  if (!form.addressees) return 0
  return form.addressees.split('\n\n').filter(Boolean).map(a => a.trim()).filter(Boolean).length
})

const addresseeMode = ref<'cards' | 'raw'>('cards')
const addresseeCards = ref<string[]>([''])

// Синхронізація карток із текстом form.addressees
watch(() => form.addressees, (val) => {
  if (!val) {
    if (addresseeCards.value.length === 0 || addresseeCards.value[0] !== '') {
      addresseeCards.value = ['']
    }
    return
  }
  const parts = val.split('\n\n').map(p => p.trim()).filter(Boolean)
  if (parts.join('\n\n') !== addresseeCards.value.map(p => p.trim()).filter(Boolean).join('\n\n')) {
    addresseeCards.value = parts.length > 0 ? parts : ['']
  }
}, { immediate: true })

function syncCardsToForm() {
  form.addressees = addresseeCards.value.map(p => p.trim()).filter(Boolean).join('\n\n')
}

function addAddresseeCard(text: string = '') {
  addresseeCards.value.push(text)
  syncCardsToForm()
}

function removeAddresseeCard(index: number) {
  addresseeCards.value.splice(index, 1)
  if (addresseeCards.value.length === 0) {
    addresseeCards.value = ['']
  }
  syncCardsToForm()
}

function moveAddresseeCard(index: number, direction: 'up' | 'down') {
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= addresseeCards.value.length) return
  const item = addresseeCards.value.splice(index, 1)[0]
  if (item !== undefined) {
    addresseeCards.value.splice(target, 0, item)
  }
  syncCardsToForm()
}

const counterpartySelectOptions = computed(() => {
  const list = (store.counterparties?.value || []) as Array<any>
  return list.map(c => ({ label: `${c.name} (${c.code || ''})`, value: String(c.id) }))
})

const counterpartyAddOptions = computed(() => {
  const list = (store.counterparties?.value || []) as Array<any>
  return list.map(c => ({ label: `+ ${c.name}`, value: String(c.id) }))
})

function populateAddresseeFromCp(cpId: string, index: number) {
  if (!cpId) return
  const list = store.counterparties?.value || []
  const cp = list.find((c: any) => String(c.id) === String(cpId))
  if (!cp) return
  const lines: string[] = []
  if (cp.name) lines.push(cp.name)
  if (cp.address) lines.push(cp.address)
  if (cp.phone) lines.push(`тел.: ${cp.phone}`)
  if (cp.email) lines.push(`email: ${cp.email}`)
  addresseeCards.value[index] = lines.join('\n')
  syncCardsToForm()
}

function appendAddresseeFromCp(cpId: string) {
  if (!cpId) return
  const list = store.counterparties?.value || []
  const cp = list.find((c: any) => String(c.id) === String(cpId))
  if (!cp) return
  const lines: string[] = []
  if (cp.name) lines.push(cp.name)
  if (cp.address) lines.push(cp.address)
  if (cp.phone) lines.push(`тел.: ${cp.phone}`)
  if (cp.email) lines.push(`email: ${cp.email}`)
  if (addresseeCards.value.length === 1 && !addresseeCards.value[0]?.trim()) {
    addresseeCards.value[0] = lines.join('\n')
    syncCardsToForm()
  } else {
    addAddresseeCard(lines.join('\n'))
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Повідомлення про скан-копію -->
    <div v-if="store.selectedIsScanned.value" class="flex items-center gap-2 p-3 rounded border border-default text-sm text-muted">
      <UIcon name="i-lucide-scan-line" class="text-primary flex-shrink-0" />
      Скан-копія: оригіналом є завантажений файл. Текст не редагується — документ лише підписують КЕП.
    </div>

    <!-- Текст документа -->
    <UFormField v-else>
      <template #label>
        <div class="flex items-center justify-between w-full">
          <span>Текст (кожен абзац — з нового рядка)</span>
          <div v-if="store.isOrder.value" class="flex gap-1.5">
            <UButton
              size="xs"
              variant="subtle"
              color="primary"
              icon="i-lucide-file-text"
              @click="injectTemplate('відпустка')"
            >
              Шаблон: Відпустка
            </UButton>
            <UButton
              size="xs"
              variant="subtle"
              color="primary"
              icon="i-lucide-file-text"
              @click="injectTemplate('прийняття')"
            >
              Шаблон: Прийняття
            </UButton>
          </div>
        </div>
      </template>
      <UTextarea v-model="form.body" :rows="8" class="w-full" />
    </UFormField>

    <!-- Адресат (кому) -->
    <UFormField v-if="!isOrder || Boolean(form.addressees)">
      <template #label>
        <div class="flex items-center justify-between w-full">
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">Адресат (кому)</span>
            <span
              v-if="addresseesCount > 0"
              class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              :class="addresseesCount <= 4 ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-warning/10 text-warning border border-warning/20'"
            >
              {{ addresseesCount }} / 4 за ДСТУ
            </span>
          </div>

          <!-- Перемикач режимів карток / тексту -->
          <div class="flex items-center gap-1 bg-elevated/40 p-0.5 rounded-md border border-default text-xs">
            <button
              type="button"
              class="px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
              :class="addresseeMode === 'cards' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted hover:text-default'"
              @click="addresseeMode = 'cards'"
            >
              <UIcon name="i-lucide-list" class="w-3.5 h-3.5" />
              Картки
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
              :class="addresseeMode === 'raw' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted hover:text-default'"
              @click="addresseeMode = 'raw'"
            >
              <UIcon name="i-lucide-file-text" class="w-3.5 h-3.5" />
              Текст
            </button>
          </div>
        </div>
      </template>

      <!-- Картковий режим мультиадресатів -->
      <div v-if="addresseeMode === 'cards'" class="space-y-3 mt-1.5">
        <div
          v-for="(item, idx) in addresseeCards"
          :key="idx"
          class="p-3 rounded-lg border border-default bg-elevated/20 space-y-2 relative transition-all"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 font-semibold text-xs text-default">
              <span class="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold">
                {{ idx + 1 }}
              </span>
              <span>Адресат №{{ idx + 1 }}</span>
              <span v-if="idx >= 4" class="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded font-normal">
                (список розсилання)
              </span>
            </div>

            <div class="flex items-center gap-1">
              <USelect
                placeholder="Вставити з контрагентів..."
                :items="counterpartySelectOptions"
                class="w-48 text-[11px]"
                size="xs"
                @update:model-value="(val) => populateAddresseeFromCp(val, idx)"
              />
              <UButton
                icon="i-lucide-arrow-up"
                variant="ghost"
                color="neutral"
                size="xs"
                :disabled="idx === 0"
                aria-label="Вгору"
                @click="moveAddresseeCard(idx, 'up')"
              />
              <UButton
                icon="i-lucide-arrow-down"
                variant="ghost"
                color="neutral"
                size="xs"
                :disabled="idx === addresseeCards.length - 1"
                aria-label="Вниз"
                @click="moveAddresseeCard(idx, 'down')"
              />
              <UButton
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                aria-label="Видалити адресата"
                @click="removeAddresseeCard(idx)"
              />
            </div>
          </div>

          <UTextarea
            v-model="addresseeCards[idx]"
            :rows="3"
            placeholder="Посада, найменування організації або ПІБ&#10;Поштова адреса&#10;Контакти / email"
            class="w-full text-xs"
            @input="syncCardsToForm"
          />
        </div>

        <div v-if="addresseeCards.length === 0" class="p-4 rounded-lg border border-dashed border-default text-center text-xs text-muted">
          Адресатів ще не додано. Натисніть кнопку нижче або виберіть контрагента.
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div class="flex items-center gap-2">
            <UButton
              size="xs"
              variant="subtle"
              color="primary"
              icon="i-lucide-user-plus"
              @click="addAddresseeCard('')"
            >
              Додати адресата (+1)
            </UButton>
            <USelect
              placeholder="+ Додати з контрагентів..."
              :items="counterpartyAddOptions"
              class="w-52 text-xs"
              size="xs"
              @update:model-value="appendAddresseeFromCp"
            />
          </div>

          <div class="text-[11px] text-muted">
            Усього адресатів: <strong>{{ addresseeCards.length }}</strong>
          </div>
        </div>
      </div>

      <!-- Текстовий режим швидкого введення -->
      <div v-else class="space-y-2 mt-1.5">
        <UTextarea
          v-model="form.addressees"
          :rows="5"
          placeholder="Наприклад:&#10;Генеральному прокурору&#10;м. Київ, 01011&#10;&#10;Директору ТОВ «Зоря»&#10;м. Львів, 79000"
          class="w-full font-mono text-xs"
        />
        <p class="text-[11px] text-muted">
          Для зазначення кількох адресатів розділяйте їх <strong>порожнім рядком</strong> (подвійним Enter).
        </p>
      </div>

      <!-- Нормативні підказки ДСТУ 4163:2020 §5.15 -->
      <div v-if="addresseesCount > 4" class="text-xs text-warning flex items-start gap-1.5 mt-2 bg-warning/10 p-2.5 rounded-md border border-warning/20">
        <UIcon name="i-lucide-triangle-alert" class="w-4 h-4 flex-shrink-0 mt-0.5 text-warning" />
        <span><strong>Нормативне обмеження (ДСТУ 4163:2020 §5.15):</strong> Документ не повинен містити більше ніж 4 адресати. Наразі зазначено {{ addresseesCount }} адресатів. На перших 4 примірниках буде надруковано позначку <em>«(за списком розсилання)»</em>.</span>
      </div>
      <div v-else-if="addresseesCount > 1" class="text-[11px] text-muted flex items-center gap-1.5 mt-2 bg-elevated/30 p-2 rounded-md border border-default">
        <UIcon name="i-lucide-info" class="w-3.5 h-3.5 flex-shrink-0 text-primary" />
        <span><strong>ДСТУ 4163:2020 §5.15:</strong> Слово «копія» перед найменуванням 2-го, 3-го, 4-го адресатів не зазначають. Адресат розміщується у правій частині (відступ 90 мм від лівого поля).</span>
      </div>
    </UFormField>

    <!-- Контактні дані заявника (для фізосіб) -->
    <UFormField
      v-if="form.subject_type === 'person'"
      label="Контактні дані заявника"
      help="Адреса, телефон, e-mail — кожна деталь з нового рядка. Виводяться праворуч під адресатом у блоці «від кого» (Закон №393/96-ВР, ст. 5)."
    >
      <UTextarea
        v-model="form.sender_contacts"
        :rows="3"
        placeholder="вул. Садова, 5, кв. 12&#10;м. Харків, 61000&#10;тел.: +38 050 123 45 67&#10;email: example@mail.com"
        class="w-full"
      />
    </UFormField>
  </div>
</template>
