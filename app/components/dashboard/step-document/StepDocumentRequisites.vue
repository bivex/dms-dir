<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

const docTypeOptions = [
  'Наказ',
  'Розпорядження',
  'Постанова',
  'Рішення',
  'Протокол',
  'Витяг з протоколу',
  'Лист',
  'Службова записка',
  'Доповідна записка',
  'Пояснювальна записка',
  'Заява',
  'Заява про надання матеріальної допомоги',
  'Скарга на дії правоохоронців',
  'Акт',
  'Довідка',
  'Положення',
  'Інструкція',
  'Посадова інструкція',
  'Договір',
  'Угода',
  'Додаткова угода',
  'Наказ про відпустку',
  'Наказ про прийняття на роботу',
  'Наказ про звільнення',
  'Звіт',
  'Доручення',
  'Розпорядчий лист'
]

import StepDocumentStamps from './StepDocumentStamps.vue'

const isFocused = ref(false)

function onBlur() {
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}

const filteredJournals = computed(() => {
  if (!store.journals.value) return []
  if (store.isOrder.value) {
    return store.journals.value.filter(j =>
      j.prefix === 'ОД' || j.name.toLowerCase().includes('наказ')
    )
  }
  if (form.doc_type === 'Лист') {
    return store.journals.value.filter(j =>
      j.prefix === 'ВИХ' || j.name.toLowerCase().includes('вихідн')
    )
  }
  return store.journals.value
})

const selectedJournalId = computed({
  get: () => {
    if (form.journal_id) return String(form.journal_id)
    if ((store.isOrder.value || form.doc_type === 'Лист') && filteredJournals.value.length > 0) {
      const firstId = filteredJournals.value[0]?.id
      if (firstId !== undefined) {
        form.journal_id = firstId
        return String(firstId)
      }
    }
    return '0'
  },
  set: (val: string) => {
    form.journal_id = val && val !== '0' ? Number(val) : null
  }
})

const filteredOptions = computed(() => {
  if (!store.counterparties.value) return []
  const q = form.org_name?.toLowerCase().trim() || ''
  if (!q) return store.counterparties.value
  return store.counterparties.value.filter(c =>
    c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  )
})

function selectCounterparty(c: any) {
  form.org_name = c.name
  form.subject_type = c.subject_type
  isFocused.value = false

  if (!store.isOrder.value) {
    const lines = [c.name]
    if (c.address) lines.push(c.address)
    if (c.email) lines.push(`email: ${c.email}`)
    form.addressees = lines.join('\n')
  }
}

function getSubjectTypeLabel(type: string) {
  if (type === 'legal') return 'Юр. особа'
  if (type === 'fop') return 'ФОП'
  if (type === 'person') return 'Фіз. особа'
  return type
}

function getSubjectTypeColor(type: string) {
  if (type === 'legal') return 'primary'
  if (type === 'fop') return 'warning'
  if (type === 'person') return 'success'
  return 'neutral'
}

const relatedDocOptions = computed(() => {
  if (!store.docs.value) return []
  return [
    { label: 'Немає зв\'язку', value: '0' },
    ...store.docs.value
      .filter((d: any) => d.doc_id !== form.doc_id)
      .map((d: any) => ({
        label: `${d.reg_index ? '№' + d.reg_index + ' ' : ''}${d.title} (${d.doc_id})`,
        value: d.doc_id
      }))
  ]
})

const selectedRelatedDocId = computed({
  get: () => form.related_doc_id ? form.related_doc_id : '0',
  set: (val: string) => {
    form.related_doc_id = val && val !== '0' ? val : null
  }
})

const allUsersSelectItems = computed(() => [
  { label: 'Не встановлено / за собою', value: '0' },
  ...store.users.value.map((u: any) => ({
    label: `${u.name}${u.position ? ' — ' + u.position : ''}`,
    value: String(u.id)
  }))
])

const selectedControlExecutorId = computed({
  get: () => form.control_executor_id ? String(form.control_executor_id) : '0',
  set: (val: string) => {
    form.control_executor_id = val && val !== '0' ? Number(val) : null
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Рядок 1: Тип суб'єкта, Вид документа, Формат, Реєстр. індекс -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField label="Тип суб'єкта">
        <USelect
          v-model="form.subject_type"
          :items="[
            { label: 'Юридична особа', value: 'legal' },
            { label: 'ФОП', value: 'fop' },
            { label: 'Фізична особа', value: 'person' }
          ]"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Вид документа">
        <UInputMenu
          v-model="form.doc_type"
          :items="docTypeOptions"
          create-item
          placeholder="Оберіть або введіть вид…"
          class="w-full"
          @create="(v: string) => form.doc_type = v"
        />
      </UFormField>
      <UFormField label="Формат">
        <USelect
          v-model="form.fmt"
          :items="[{ label: 'PDF', value: 'pdf' }, { label: 'DOCX', value: 'docx' }]"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Реєстр. індекс" :help="store.autoRegister.value ? (store.docStatus.value === 'signed' ? 'автоматично присвоєно' : 'буде присвоєно після підписання') : 'введіть вручну'">
        <UInput
          :model-value="store.autoRegister.value && store.docStatus.value !== 'signed' ? 'Буде присвоєно після підписання' : form.reg_index"
          :disabled="store.autoRegister.value"
          :placeholder="store.autoRegister.value ? 'авто' : '№'"
          class="w-full"
          @update:model-value="val => { if (!store.autoRegister.value) form.reg_index = val }"
        />
      </UFormField>
    </div>

    <!-- Рядок 2: Журнал та Тип погодження -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField label="Реєстраційний журнал">
        <USelect
          v-model="selectedJournalId"
          :items="store.isOrder.value
            ? store.journals.value.map(j => ({ label: `${j.name} (${j.prefix})`, value: String(j.id) }))
            : [
                { label: 'Без журналу', value: '0' },
                ...store.journals.value.map(j => ({ label: `${j.name} (${j.prefix})`, value: String(j.id) }))
              ]"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Тип погодження">
        <USelect
          v-model="form.approval_type"
          :items="[
            { label: 'Послідовне погодження', value: 'sequential' },
            { label: 'Паралельне погодження', value: 'parallel' }
          ]"
          class="w-full"
        />
      </UFormField>
    </div>

    <!-- Організація з автокомплітом -->
    <UFormField label="Найменування організації">
      <div class="relative w-full">
        <UInput
          v-model="form.org_name"
          placeholder="Введіть або оберіть контрагента..."
          class="w-full"
          @focus="isFocused = true"
          @blur="onBlur"
        />
        <div
          v-if="isFocused && filteredOptions.length > 0"
          class="absolute z-50 w-full mt-1 bg-background border border-default rounded-md shadow-lg max-h-60 overflow-y-auto"
        >
          <div
            v-for="c in filteredOptions"
            :key="c.id"
            class="p-2.5 hover:bg-elevated cursor-pointer transition-colors flex items-center justify-between text-xs border-b border-default/30 last:border-0"
            @mousedown="selectCounterparty(c)"
          >
            <div>
              <div class="font-medium text-default">{{ c.name }}</div>
              <div class="text-[10px] text-muted font-mono mt-0.5">Код: {{ c.code }}</div>
            </div>
            <UBadge
              :label="getSubjectTypeLabel(c.subject_type)"
              :color="getSubjectTypeColor(c.subject_type)"
              variant="subtle"
              size="xs"
              class="ml-2 flex-shrink-0"
            />
          </div>
        </div>
      </div>
    </UFormField>

    <UFormField label="Заголовок до тексту" help="Про що документ (напр. «Про надання відпустки»). Не дублюйте вид документа.">
      <UInput v-model="form.title" placeholder="Про що цей документ…" class="w-full" />
    </UFormField>

    <!-- Контроль за виконанням (для наказів) -->
    <UFormField v-if="store.isOrder.value" label="Контроль за виконанням наказу покласти на:">
      <USelect
        v-model="selectedControlExecutorId"
        :items="allUsersSelectItems"
        class="w-full"
      />
    </UFormField>

    <!-- Пов'язаний документ -->
    <UFormField label="У відповідь на / На виконання (пов'язаний документ)">
      <USelect
        v-model="selectedRelatedDocId"
        :items="relatedDocOptions"
        class="w-full"
      />
    </UFormField>

    <!-- Дата та місце -->
    <div class="grid grid-cols-2 gap-4">
      <UFormField label="Дата реєстрації" :help="store.autoRegister.value ? 'авто при поданні' : 'введіть вручну'">
        <UInput
          v-model="form.date_text"
          :disabled="store.autoRegister.value"
          :placeholder="store.autoRegister.value ? 'авто' : '14 червня 2026 р.'"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Місце складання" help="населений пункт, де складено документ (реквізит 8)">
        <UInput
          v-model="form.place"
          placeholder="м. Харків"
          class="w-full"
        />
      </UFormField>
    </div>

    <StepDocumentStamps />
  </div>
</template>
