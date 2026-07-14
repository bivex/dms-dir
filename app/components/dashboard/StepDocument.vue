<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

// Топ-25 найуживаніших видів документів (організаційно-розпорядча документація,
// ДСТУ 4163). Користувач може обрати зі списку або вписати власний вид.
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

const isFocused = ref(false)
const withVisa = ref(false)

const filteredJournals = computed(() => {
  if (!store.journals.value) return []
  if (store.isOrder.value) {
    // Накази: тільки з префіксом ОД або назвою "наказ"
    return store.journals.value.filter(j => 
      j.prefix === 'ОД' || j.name.toLowerCase().includes('наказ')
    )
  }
  if (form.doc_type === 'Лист') {
    // Листи: тільки з префіксом ВИХ або назвою "вихідн"
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

function onBlur() {
  setTimeout(() => {
    isFocused.value = false
  }, 200)
}

const filteredOptions = computed(() => {
  if (!store.counterparties.value) return []
  const q = form.org_name?.toLowerCase().trim() || ''
  if (!q) return store.counterparties.value
  return store.counterparties.value.filter(c =>
    c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  )
})

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

function selectCounterparty(c: any) {
  form.org_name = c.name
  form.subject_type = c.subject_type
  isFocused.value = false

  // Auto-fill addressees for letters or other non-order documents
  if (!store.isOrder.value) {
    const lines = [c.name]
    if (c.address) {
      lines.push(c.address)
    }
    if (c.email) {
      lines.push(`email: ${c.email}`)
    }
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

onMounted(() => {
  store.reloadCounterparties()
  store.reloadUsers()
})

const availableUsers = computed(() =>
  store.users.value
    .filter((u: any) => !form.approverUsers.some(a => a.user_id === u.id))
    .map((u: any) => ({
      label: `${u.name}${u.position ? ' — ' + u.position : ''} · ${u.email}`,
      value: u.id
    }))
)

function addApprover(userId: number | string) {
  const id = Number(userId)
  const u = store.users.value.find((x: any) => x.id === id)
  if (!u || form.approverUsers.some(a => a.user_id === id)) return
  form.approverUsers.push({ user_id: id, full_name: u.name, position: u.position })
}

function removeApprover(index: number) {
  form.approverUsers.splice(index, 1)
}

// Підписанти: вибір із користувачів системи (підставляємо ПІБ+посаду).
// Один користувач може бути і погоджувачем, і підписантом — окремий список.
const availableSignerUsers = computed(() =>
  store.users.value
    .filter((u: any) => !form.signerUsers.some(s => s.user_id === u.id))
    .map((u: any) => ({
      label: `${u.name}${u.position ? ' — ' + u.position : ''} · ${u.email}`,
      value: u.id
    }))
)

function addSigner(userId: number | string) {
  const id = Number(userId)
  const u = store.users.value.find((x: any) => x.id === id)
  if (!u || form.signerUsers.some(s => s.user_id === id)) return
  form.signerUsers.push({ user_id: id, full_name: u.name, position: u.position, signer_type: 'person' })
}

function removeSigner(index: number) {
  form.signerUsers.splice(index, 1)
}

/** Перемкнути тип підписанта person ↔ seal. Для seal підставляємо назву юрособи
 *  з org_name (якщо ПІБ порожнє) — печатка підписується сертифікатом юрособи. */
function toggleSignerType(index: number) {
  const s = form.signerUsers[index]
  if (!s) return
  if (s.signer_type === 'seal') {
    s.signer_type = 'person'
    return
  }
  s.signer_type = 'seal'
  if (!s.full_name.trim() && form.org_name.trim()) {
    s.full_name = form.org_name.trim()
  }
}

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

const availableAcknowledgeUsers = computed(() =>
  store.users.value
    .filter((u: any) => !(form.acknowledge_user_ids || []).includes(u.id))
    .map((u: any) => ({
      label: `${u.name}${u.position ? ' — ' + u.position : ''} · ${u.email}`,
      value: u.id
    }))
)

function addAcknowledgeUser(userId: number | string) {
  const id = Number(userId)
  if (!form.acknowledge_user_ids) {
    form.acknowledge_user_ids = []
  }
  if (!form.acknowledge_user_ids.includes(id)) {
    form.acknowledge_user_ids.push(id)
  }
}

function removeAcknowledgeUser(id: number) {
  if (form.acknowledge_user_ids) {
    form.acknowledge_user_ids = form.acknowledge_user_ids.filter(x => x !== id)
  }
}

function getUserInfo(id: number) {
  return store.users.value.find((x: any) => x.id === id) || { name: 'Невідомий', position: '' }
}

function injectTemplate(type: 'відпустка' | 'прийняття') {
  if (type === 'відпустка') {
    form.title = 'Про надання щорічної відпустки'
    form.body = 'НАКАЗУЮ:\n1. Надати [ПІБ] щорічну основну відпустку тривалістю 14 календарних днів з [Дата] по [Дата] за робочий період з [Дата] по [Дата].\n2. Головному бухгалтеру провести розрахунок та виплату відпускних.\n3. Контроль за виконанням наказу залишаю за собою.'
  } else if (type === 'прийняття') {
    form.title = 'Про прийняття на роботу'
    form.body = 'НАКАЗУЮ:\n1. Прийняти [ПІБ] на роботу з [Дата] на посаду [Посада].\n2. Встановити посадовий оклад згідно зі штатним розкладом.\n3. Контроль за виконанням наказу покласти на [ПІБ].'
  }
}

function applyStandardRoute(type: 'basic' | 'hr') {
  form.approverUsers = []
  if (type === 'basic') {
    const lawyer = store.users.value.find((u: any) => u.name.includes('Бойко') || u.position?.toLowerCase().includes('юрист'))
    if (lawyer) {
      form.approverUsers.push({ user_id: lawyer.id, full_name: lawyer.name, position: lawyer.position })
    }
    const accountant = store.users.value.find((u: any) => u.name.includes('Бондаренко') || u.position?.toLowerCase().includes('бухгалтер'))
    if (accountant) {
      form.approverUsers.push({ user_id: accountant.id, full_name: accountant.name, position: accountant.position })
    }
  } else if (type === 'hr') {
    const hr = store.users.value.find((u: any) => u.name.includes('Кузьменко') || u.position?.toLowerCase().includes('кадр'))
    if (hr) {
      form.approverUsers.push({ user_id: hr.id, full_name: hr.name, position: hr.position })
    }
    const lawyer = store.users.value.find((u: any) => u.name.includes('Бойко'))
    if (lawyer) {
      form.approverUsers.push({ user_id: lawyer.id, full_name: lawyer.name, position: lawyer.position })
    }
  }
}

function formatBytes(bytes: number, decimals = 2) {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

const isCollapsed = ref(false)
</script>

<template>
  <UCard id="sec-document">
    <template #header>
      <div class="flex items-center gap-3 cursor-pointer select-none" @click="isCollapsed = !isCollapsed">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          <UIcon name="i-lucide-file-text" class="text-xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold truncate">{{ form.title || '(без заголовка)' }}</div>
          <div class="text-xs text-muted flex items-center gap-2 truncate">
            <span>{{ store.docFormatLabel.value }}</span>
            <span>·</span>
            <span class="truncate">{{ form.doc_id }}</span>
          </div>
        </div>
        <UBadge
          :label="store.statusBadge.value.label"
          :color="store.statusBadge.value.color"
          variant="subtle"
          size="md"
          class="flex-shrink-0"
        />
        <UButton
          :icon="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          variant="ghost"
          color="neutral"
          size="xs"
          class="ml-2 flex-shrink-0"
        />
      </div>
    </template>

    <div v-show="!isCollapsed">

    <!-- secondary-тулбар -->
    <div class="flex items-center gap-1 mb-4 pb-3 border-b border-default flex-wrap">
      <UButton icon="i-lucide-eye" variant="ghost" color="neutral" size="xs" @click="store.openViewer()">
        Переглянути
      </UButton>
      <UButton
        v-if="store.attachments.value.length > 0"
        icon="i-lucide-eye"
        variant="ghost"
        color="neutral"
        size="xs"
        title="Переглянути обʼєднаний PDF (документ + додатки з маркуванням)"
        @click="store.openViewer({ merged: true, visa: withVisa })"
      >
        Переглянути з додатками
      </UButton>
      <UButton icon="i-lucide-download" variant="ghost" color="neutral" size="xs" @click="store.downloadDoc()">
        Завантажити
      </UButton>
      <UButton
        v-if="store.attachments.value.length > 0"
        icon="i-lucide-file-stack"
        variant="ghost"
        color="neutral"
        size="xs"
        title="Завантажити обʼєднаний PDF (документ + додатки з маркуванням)"
        @click="store.downloadMergedPdf(withVisa)"
      >
        Завантажити з додатками
      </UButton>
      <UButton
        v-if="store.attachments.value.length > 0"
        :icon="withVisa ? 'i-lucide-stamp' : 'i-lucide-stamp'"
        :variant="withVisa ? 'soft' : 'ghost'"
        :color="withVisa ? 'primary' : 'neutral'"
        size="xs"
        :title="withVisa ? 'Вимкнути штамп-візу' : 'Увімкнути штамп-візу у PDF'"
        @click="withVisa = !withVisa"
      >
        {{ withVisa ? 'Із візою' : 'Без візи' }}
      </UButton>
      <UDropdownMenu v-if="store.selectedId.value" :items="store.moveToFolderItems.value" :ui="{ content: 'w-52' }">
        <UButton icon="i-lucide-folder" variant="ghost" color="neutral" size="xs">
          <span
            v-if="store.selectedFolderId.value !== null"
            class="inline-block w-2 h-2 rounded-sm"
            :style="{ backgroundColor: store.folderDotColor(store.activeFolder.value?.color) }"
          />
          {{ store.selectedFolderId.value !== null ? (store.activeFolder.value?.name ?? 'Папка') : 'Без папки' }}
        </UButton>
      </UDropdownMenu>
      <UButton
        v-if="store.selectedId.value"
        icon="i-lucide-star"
        :color="store.isFavorite(form.doc_id) ? 'warning' : 'neutral'"
        :variant="store.isFavorite(form.doc_id) ? 'soft' : 'ghost'"
        size="xs"
        :title="store.isFavorite(form.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
        @click="store.toggleFavorite(form.doc_id)"
      />
      <div class="ml-auto">
        <UButton
          v-if="store.selectedId.value"
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="xs"
          title="Видалити"
          @click="store.deleteDoc()"
        />
      </div>
    </div>

    <div v-if="store.isLocked.value" class="flex items-center gap-2 p-3 rounded border border-warning/40 bg-warning/10 text-sm text-warning">
      <UIcon name="i-lucide-lock" class="flex-shrink-0" />
      Документ підписаний / у роботі — редагування заборонене. Щоб змінити — відхильте підпис/погодження (документ повернеться у чернетку).
    </div>

    <fieldset :disabled="store.isLocked.value" class="space-y-4 border-0 p-0 m-0">
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

      <!-- Пов'язаний документ (у відповідь на / на виконання) -->
      <UFormField label="У відповідь на / На виконання (пов'язаний документ)">
        <USelect
          v-model="selectedRelatedDocId"
          :items="relatedDocOptions"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Дата реєстрації" :help="store.autoRegister.value ? 'авто при поданні' : 'введіть вручну'">
        <UInput
          v-model="form.date_text"
          :disabled="store.autoRegister.value"
          :placeholder="store.autoRegister.value ? 'авто' : '14 червня 2026 р.'"
          class="w-full"
        />
      </UFormField>

      <UCheckbox
        v-model="store.autoRegister.value"
        label="Авто-реєстрація"
        help="наскрізний індекс за типом документа + поточна дата при поданні у чергу"
      />

      <UCheckbox
        v-if="form.fmt === 'pdf'"
        v-model="form.pagination_barcode"
        label="Штрих-код пагінації (Code128)"
        help="службовий штрихкод на кожній сторінці PDF для потокового сканування й звірки комплектності пачки"
      />

      <UCheckbox
        v-if="form.fmt === 'pdf'"
        v-model="form.use_stamp"
        label="Графічна печатка установи"
        help="синій круглий відбиток печатки організації поверх підпису посадової особи відповідно до ДСТУ 4163"
      />

      <div v-if="store.selectedIsScanned.value" class="flex items-center gap-2 p-3 rounded border border-default text-sm text-muted">
        <UIcon name="i-lucide-scan-line" class="text-primary flex-shrink-0" />
        Скан-копія: оригіналом є завантажений файл. Текст не редагується — документ лише підписують КЕП.
      </div>
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

      <UFormField
        v-if="!store.isOrder.value"
        label="Адресат (кому)"
        help="Посада, ПІБ та адреса одержувача — кожна деталь з нового рядка. Виводиться у правому верхньому куті бланка."
      >
        <UTextarea v-model="form.addressees" :rows="3" placeholder="Наприклад:
Генеральному прокурору
вул. Різницька, 13/15
м. Київ, 01011" class="w-full" />
      </UFormField>

      <UFormField
        v-if="form.subject_type === 'person'"
        label="Контактні дані заявника"
        help="Адреса, телефон, e-mail — кожна деталь з нового рядка. Виводяться праворуч під адресатом у блоці «від кого» (Закон №393/96-ВР, ст. 5). Підставляються з вашого профілю автоматично."
      >
        <UTextarea v-model="form.sender_contacts" :rows="3" placeholder="вул. Садова, 5, кв. 12
м. Харків, 61000
тел.: +38 050 123 45 67
email: example@mail.com" class="w-full" />
      </UFormField>

      <UFormField>
        <template #label>
          <div class="flex items-center justify-between w-full">
            <span>Погоджувачі (із користувачів системи)</span>
            <div v-if="store.isOrder.value" class="flex gap-1.5">
              <UButton
                size="xs"
                variant="subtle"
                color="neutral"
                icon="i-lucide-route"
                @click="applyStandardRoute('basic')"
              >
                Типовий: Юрист + Бухгалтер
              </UButton>
              <UButton
                size="xs"
                variant="subtle"
                color="neutral"
                icon="i-lucide-route"
                @click="applyStandardRoute('hr')"
              >
                Типовий: Кадри + Юрист
              </UButton>
            </div>
          </div>
        </template>
        <div class="space-y-2 w-full">
          <USelect
            :model-value="undefined"
            :items="availableUsers"
            placeholder="Оберіть користувача для додавання…"
            class="w-full"
            @update:model-value="addApprover"
          />
          <div v-if="form.approverUsers.length" class="space-y-1">
            <div
              v-for="(a, i) in form.approverUsers"
              :key="a.user_id"
              class="flex items-center gap-2 p-2 rounded border border-default bg-default/5 text-sm"
            >
              <span class="text-muted font-mono text-xs w-5 flex-shrink-0">{{ i + 1 }}.</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{{ a.full_name }}</div>
                <div class="text-xs text-muted truncate">{{ a.position || 'Посада не вказана' }}</div>
              </div>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="error"
                variant="ghost"
                title="Прибрати"
                @click="removeApprover(i)"
              />
            </div>
          </div>
          <div v-else class="text-xs text-muted">Погоджувачів не додано.</div>
        </div>
      </UFormField>

      <UFormField label="Підписанти (із користувачів системи)">
        <div class="space-y-2 w-full">
          <USelect
            :model-value="undefined"
            :items="availableSignerUsers"
            placeholder="Оберіть користувача для додавання…"
            class="w-full"
            @update:model-value="addSigner"
          />
          <div v-if="form.signerUsers.length" class="space-y-1">
            <div
              v-for="(s, i) in form.signerUsers"
              :key="s.user_id ?? i"
              class="flex items-center gap-2 p-2 rounded border border-default bg-default/5 text-sm"
            >
              <span class="text-muted font-mono text-xs w-5 flex-shrink-0">{{ i + 1 }}.</span>
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate flex items-center gap-1.5">
                  {{ s.full_name }}
                  <UBadge
                    v-if="s.signer_type === 'seal'"
                    label="Печатка"
                    color="primary"
                    variant="subtle"
                    size="xs"
                    icon="i-lucide-stamp"
                  />
                </div>
                <div class="text-xs text-muted truncate">{{ s.position || 'Посада не вказана' }}</div>
              </div>
              <!-- перемикач типу підписанта: КЕП особи ↔ печатка юрособи -->
              <UButton
                :icon="s.signer_type === 'seal' ? 'i-lucide-building-2' : 'i-lucide-user'"
                :color="s.signer_type === 'seal' ? 'primary' : 'neutral'"
                :variant="s.signer_type === 'seal' ? 'soft' : 'ghost'"
                size="xs"
                :title="s.signer_type === 'seal' ? 'Печатка юрособи (натисніть → КЕП особи)' : 'КЕП особи (натисніть → печатка юрособи)'"
                @click="toggleSignerType(i)"
              />
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="error"
                variant="ghost"
                title="Прибрати"
                @click="removeSigner(i)"
              />
            </div>
          </div>
          <div v-else class="text-xs text-muted">Підписантів не додано.</div>
        </div>
      </UFormField>

      <!-- Аркуш ознайомлення (для наказів) -->
      <UFormField v-if="store.isOrder.value" label="Аркуш ознайомлення (Розсилка)">
        <div class="space-y-2 w-full">
          <USelect
            :model-value="undefined"
            :items="availableAcknowledgeUsers"
            placeholder="Оберіть користувача для ознайомлення…"
            class="w-full"
            @update:model-value="addAcknowledgeUser"
          />
          <div v-if="form.acknowledge_user_ids && form.acknowledge_user_ids.length" class="space-y-1">
            <div
              v-for="id in form.acknowledge_user_ids"
              :key="id"
              class="flex items-center gap-2 p-2 rounded border border-default bg-default/5 text-sm"
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{{ getUserInfo(id).name }}</div>
                <div class="text-xs text-muted truncate">{{ getUserInfo(id).position || 'Посада не вказана' }}</div>
              </div>
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="error"
                variant="ghost"
                title="Прибрати"
                @click="removeAcknowledgeUser(id)"
              />
            </div>
          </div>
          <div v-else class="text-xs text-muted">Список ознайомлення порожній.</div>
        </div>
      </UFormField>

      <!-- Додатки до документа -->
      <UFormField label="Додатки">
        <div class="space-y-3 w-full">
          <!-- File Drop Zone for uploading attachments -->
          <div v-if="!store.isLocked.value">
          <FileDropZone
              accept=".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp,.docx,.xlsx,.doc,.xls"
              :loading="store.attachmentsUploading.value"
              hint="Перетягніть додаток або оберіть файл"
              @file="store.uploadAttachment"
            />
          </div>

          <!-- Attachments list -->
          <div v-if="store.attachments.value.length > 0" class="divide-y divide-border border rounded-md">
            <div
              v-for="att in store.attachments.value"
              :key="att.id"
              class="flex items-center justify-between p-2 text-sm"
            >
              <div class="flex items-center gap-2 overflow-hidden">
                <UIcon name="i-lucide-file-text" class="text-primary flex-shrink-0 w-4 h-4" />
                <span class="truncate font-medium" :title="att.original_filename">
                  {{ att.original_filename }}
                </span>
                <span class="text-xs text-muted flex-shrink-0">
                  ({{ formatBytes(att.size) }})
                </span>
              </div>
              <div class="flex items-center gap-1">
                <UButton
                  icon="i-lucide-eye"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  title="Переглянути"
                  @click="store.openAttachmentViewer(form.doc_id, att)"
                />
                <UButton
                  icon="i-lucide-download"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  title="Завантажити"
                  @click="store.downloadAttachment(att)"
                />
                <UButton
                  v-if="!store.isLocked.value"
                  icon="i-lucide-trash-2"
                  size="xs"
                  color="error"
                  variant="ghost"
                  title="Видалити"
                  @click="store.removeAttachment(att.id)"
                />
              </div>
            </div>
          </div>
          <div v-else class="text-xs text-muted">Додатків не додано.</div>
        </div>
      </UFormField>

      <div v-if="!store.selectedIsScanned.value && !store.isLocked.value" class="flex gap-2">
        <UButton icon="i-lucide-save" @click="store.createDoc()">
          Зберегти картку
        </UButton>
      </div>
    </fieldset>
    </div>
  </UCard>
</template>
