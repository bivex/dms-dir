<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'dashboard'
})

useSeoMeta({
  title: 'Діловод · Документи',
  description: 'Система електронного документообігу ДСТУ 4163'
})

const { apiFetch, logout, user } = useAuth()
const toast = useToast()

// --- стан списку ---
const docs = ref<DocEntry[]>([])
const selectedId = ref<string | null>(null)
const activeCategory = ref<string>('all')
const searchQuery = ref('')

// --- стан картки ---
const form = reactive({
  doc_id: `DOC-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`,
  org_name: 'ДЕРЖАВНЕ ПІДПРИЄМСТВО «УКРНДНЦ»',
  subject_type: 'legal',
  doc_type: 'Наказ',
  fmt: 'pdf',
  title: '',
  date_text: new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }),
  reg_index: '',
  body: '',
  signers: ''
})

const report = ref<ValidationReport | null>(null)
const pdfaInfo = ref<PdfaInfo | null>(null)
const docStatus = ref<string>('')
const signerList = ref<SignerEntry[]>([])
const generating = ref(false)
const submitting = ref(false)

// --- КЕП стан ---
const euReady = ref(false)
const euStatus = ref('Завантаження бібліотеки EUSign…')
const keySource = ref<'file' | 'token'>('file')
const keyPass = ref('')
const keyFile = ref<File | null>(null)
const caList = ref<string[]>([])
const signing = ref(false)

interface DocEntry {
  doc_id: string
  title: string
  doc_type: string
  status: string
  created_at: string
}

interface ValidationReport {
  compliant: boolean
  rules_passed: number
  findings: Array<{ rule: string; message: string }>
}

interface PdfaInfo {
  conforms: boolean
  findings: string[]
}

interface SignerEntry {
  name: string
  position: string
  status: 'pending' | 'signed' | 'rejected'
}

// --- вибраний документ ---
const selectedDoc = computed(() => docs.value.find(d => d.doc_id === selectedId.value) ?? null)

const filteredDocs = computed(() => {
  let list = docs.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(q) || d.doc_id.toLowerCase().includes(q)
    )
  }
  if (activeCategory.value === 'favorites') return list // TODO: favorites
  if (activeCategory.value === 'archive') return list.filter(d => d.status === 'archived')
  if (activeCategory.value === 'trash') return list.filter(d => d.status === 'deleted')
  return list
})

// --- завантаження списку ---
async function reloadDocs() {
  try {
    const res = await apiFetch<{ documents: DocEntry[] }>('/documents')
    docs.value = res.documents ?? []
  }
  catch {
    toast.add({ title: 'Не вдалося завантажити список', color: 'error' })
  }
}

// --- завантажити повні дані документа ---
async function selectDoc(doc: DocEntry) {
  selectedId.value = doc.doc_id
  report.value = null
  pdfaInfo.value = null
  try {
    const full = await apiFetch<{
      doc_id: string; title: string; doc_type: string; status: string; fmt: string
      signers: Array<{ full_name: string; position: string; status: string }>
      conformance: { compliant: boolean; rules_passed: number; findings: Array<{ rule: string; message: string }> } | null
    }>(`/documents/${doc.doc_id}`)
    form.doc_id = full.doc_id
    form.title = full.title
    form.doc_type = full.doc_type
    form.fmt = full.fmt ?? 'pdf'
    form.signers = full.signers.map(s => `${s.full_name} | ${s.position}`).join('\n')
    docStatus.value = full.status
    signerList.value = full.signers.map(s => ({
      name: s.full_name,
      position: s.position,
      status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending'
    }))
    if (full.conformance) {
      report.value = full.conformance
    }
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка завантаження документа', description: String(e), color: 'error' })
  }
}

// --- новий документ ---
function newDocument() {
  selectedId.value = null
  form.doc_id = `DOC-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
  form.title = ''
  form.reg_index = ''
  form.body = ''
  form.signers = ''
  report.value = null
  pdfaInfo.value = null
  docStatus.value = ''
  signerList.value = []
}

// --- зберегти картку ---
async function createDoc() {
  try {
    await apiFetch('/documents', {
      method: 'POST',
      body: buildPayload()
    })
    toast.add({ title: 'Картку збережено' })
    await reloadDocs()
    selectedId.value = form.doc_id
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка збереження', description: String(e), color: 'error' })
  }
}

// --- згенерувати + валідація ---
async function generateDoc() {
  generating.value = true
  report.value = null
  pdfaInfo.value = null
  try {
    // Спочатку зберігаємо/оновлюємо картку, потім генеруємо
    await apiFetch('/documents', {
      method: 'POST',
      body: buildPayload()
    }).catch(() => {
      // якщо 409 — документ вже є, продовжуємо до generate
    })
    const res = await apiFetch<{ report: ValidationReport; pdfa: PdfaInfo | null }>(
      `/documents/${form.doc_id}/generate`,
      { method: 'POST' }
    )
    report.value = res.report
    pdfaInfo.value = res.pdfa
    await reloadDocs()
    toast.add({ title: res.report.compliant ? 'Документ відповідає ДСТУ' : 'Є зауваження', color: res.report.compliant ? 'success' : 'warning' })
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка генерації', description: String(e), color: 'error' })
  }
  finally {
    generating.value = false
  }
}

// --- завантажити файл ---
async function downloadDoc() {
  try {
    const url = `${useRuntimeConfig().public.apiBase}/documents/${form.doc_id}/download`
    window.open(url, '_blank')
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка завантаження', description: String(e), color: 'error' })
  }
}

// --- видалити ---
async function deleteDoc() {
  if (!selectedId.value) return
  try {
    await apiFetch(`/documents/${selectedId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Видалено' })
    selectedId.value = null
    await reloadDocs()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка видалення', description: String(e), color: 'error' })
  }
}

// --- подати у чергу ---
async function submitDoc() {
  submitting.value = true
  try {
    const res = await apiFetch<{ status: string; signers: Array<{ full_name: string; position: string; status: string }> }>(
      `/documents/${form.doc_id}/submit`,
      { method: 'POST' }
    )
    docStatus.value = res.status
    signerList.value = res.signers.map(s => ({
      name: s.full_name,
      position: s.position,
      status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending'
    }))
    toast.add({ title: 'Подано у чергу підписання' })
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка подачі', description: String(e), color: 'error' })
  }
  finally {
    submitting.value = false
  }
}

// --- завантажити ASiC-E ---
async function downloadAsice() {
  const url = `${useRuntimeConfig().public.apiBase}/documents/${form.doc_id}/download/asice`
  window.open(url, '_blank')
}

// --- підписати КЕП ---
async function signCurrent() {
  signing.value = true
  try {
    // EUSign підписує на клієнті — надсилаємо p7s на сервер
    const p7s = await (window as unknown as { EUSign: { sign: (pass: string, file: File) => Promise<string> } })
      .EUSign.sign(keyPass.value, keyFile.value!)
    await apiFetch(`/documents/${form.doc_id}/sign`, {
      method: 'POST',
      body: { p7s, signer_index: signerList.value.findIndex(s => s.status === 'pending') }
    })
    toast.add({ title: 'Підписано' })
    await submitDoc()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка підписання', description: String(e), color: 'error' })
  }
  finally {
    signing.value = false
  }
}

function buildPayload() {
  const signerLines = form.signers.split('\n').filter(Boolean).map((line, i) => {
    const [full_name, position] = line.split('|').map(s => s.trim())
    return { full_name: full_name ?? line.trim(), position: position ?? '', order_index: i }
  })
  return {
    doc_id: form.doc_id,
    org_name: form.org_name,
    subject_type: form.subject_type,
    doc_type: form.doc_type,
    fmt: form.fmt,
    title: form.title,
    date_text: form.date_text,
    reg_index: form.reg_index,
    body: form.body.split('\n').filter(Boolean),
    signers: signerLines
  }
}

// ініціалізація
onMounted(async () => {
  await reloadDocs()
  // ініціалізація EUSign
  if (typeof window !== 'undefined' && (window as unknown as { EUSign?: unknown }).EUSign) {
    euReady.value = true
    euStatus.value = 'EUSign готовий. Оберіть спосіб ключа.'
    try {
      const cas = await (window as unknown as { EUSign: { getCAs: () => Promise<string[]> } }).EUSign.getCAs()
      caList.value = cas
    }
    catch { /* EUSign може не мати getCAs */ }
  }
  else {
    euStatus.value = 'Бібліотека EUSign не завантажена. Перевірте підключення.'
  }
})
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-background">
    <!-- САЙДБАР -->
    <aside class="w-64 flex-shrink-0 border-r border-default flex flex-col">
      <div class="p-4 border-b border-default flex items-center gap-2">
        <UIcon name="i-lucide-shield" class="text-primary text-xl" />
        <div>
          <div class="font-semibold text-sm">Діловод</div>
          <div class="text-xs text-muted">СЕД · ДСТУ 4163</div>
        </div>
      </div>

      <div class="p-3">
        <UButton block icon="i-lucide-plus" @click="newDocument">
          Додати документ
        </UButton>
      </div>

      <div class="px-3 pb-2">
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Пошук…"
          size="sm"
        />
      </div>

      <nav class="flex-1 overflow-y-auto px-2">
        <div class="text-xs font-medium text-muted uppercase px-2 py-1 mt-2">
          Розділи
        </div>
        <UButton
          v-for="cat in [
            { id: 'all', label: 'Всі документи', icon: 'i-lucide-files' },
            { id: 'favorites', label: 'Обрані', icon: 'i-lucide-star' },
            { id: 'archive', label: 'Архів', icon: 'i-lucide-archive' },
            { id: 'trash', label: 'Кошик', icon: 'i-lucide-trash-2' }
          ]"
          :key="cat.id"
          block
          variant="ghost"
          :color="activeCategory === cat.id ? 'primary' : 'neutral'"
          :icon="cat.icon"
          class="justify-start mb-0.5"
          @click="activeCategory = cat.id"
        >
          {{ cat.label }}
          <UBadge v-if="cat.id === 'all'" :label="String(docs.length)" variant="subtle" size="xs" class="ml-auto" />
        </UButton>
      </nav>

      <div class="p-3 border-t border-default">
        <div class="text-xs text-muted mb-1">
          {{ user?.name || user?.email }}
        </div>
        <UButton block variant="ghost" color="neutral" icon="i-lucide-log-out" size="sm" @click="logout(); navigateTo('/login')">
          Вийти
        </UButton>
      </div>
    </aside>

    <!-- СПИСОК -->
    <div class="w-72 flex-shrink-0 border-r border-default flex flex-col">
      <div class="p-3 border-b border-default flex items-center justify-between">
        <span class="font-medium text-sm">{{ filteredDocs.length }} документів</span>
        <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" @click="reloadDocs" />
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="doc in filteredDocs"
          :key="doc.doc_id"
          class="p-3 border-b border-default cursor-pointer hover:bg-elevated transition-colors"
          :class="{ 'bg-elevated': selectedId === doc.doc_id }"
          @click="selectDoc(doc)"
        >
          <div class="text-sm font-medium truncate">{{ doc.title || '(без заголовка)' }}</div>
          <div class="text-xs text-muted mt-0.5 flex items-center gap-2">
            <span>{{ doc.doc_id }}</span>
            <UBadge
              :label="doc.status"
              size="xs"
              :color="doc.status === 'signed' ? 'success' : doc.status === 'pending' ? 'warning' : 'neutral'"
              variant="subtle"
            />
          </div>
        </div>
        <div v-if="filteredDocs.length === 0" class="p-6 text-center text-muted text-sm">
          Немає документів
        </div>
      </div>
    </div>

    <!-- ГОЛОВНА ОБЛАСТЬ -->
    <div class="flex-1 overflow-y-auto">
      <div v-if="!selectedId && !form.title" class="flex items-center justify-center h-full">
        <div class="text-center text-muted">
          <UIcon name="i-lucide-file-text" class="text-5xl mb-3 opacity-30" />
          <div>Оберіть документ або створіть новий</div>
        </div>
      </div>

      <div v-else class="max-w-4xl mx-auto p-6 space-y-6">
        <!-- 1. КАРТКА -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-edit" />
              1. Картка документа
            </div>
          </template>

          <div class="space-y-4">
            <UFormField label="Ідентифікатор (doc_id)">
              <UInput v-model="form.doc_id" class="w-full" />
            </UFormField>

            <UFormField label="Найменування юридичної особи">
              <UInput v-model="form.org_name" class="w-full" />
            </UFormField>

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
                <UInput v-model="form.doc_type" class="w-full" />
              </UFormField>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Формат">
                <USelect
                  v-model="form.fmt"
                  :items="[{ label: 'PDF', value: 'pdf' }, { label: 'DOCX', value: 'docx' }]"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Реєстр. індекс">
                <UInput v-model="form.reg_index" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Заголовок">
              <UInput v-model="form.title" class="w-full" />
            </UFormField>

            <UFormField label="Дата">
              <UInput v-model="form.date_text" class="w-full" />
            </UFormField>

            <UFormField label="Текст (кожен абзац — з нового рядка)">
              <UTextarea v-model="form.body" :rows="5" class="w-full" />
            </UFormField>

            <UFormField label="Підписанти (ПІБ | посада, по рядку)">
              <UTextarea v-model="form.signers" :rows="3" placeholder="ПЕТРЕНКО Олександр | Директор" class="w-full" />
            </UFormField>

            <div class="flex gap-2 flex-wrap">
              <UButton icon="i-lucide-save" @click="createDoc">
                Зберегти картку
              </UButton>
              <UButton variant="outline" icon="i-lucide-cog" :loading="generating" @click="generateDoc">
                Згенерувати + валідація
              </UButton>
              <UButton variant="outline" icon="i-lucide-download" @click="downloadDoc">
                Завантажити
              </UButton>
              <UButton variant="outline" color="error" icon="i-lucide-trash-2" @click="deleteDoc">
                Видалити
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- 2. ВАЛІДАЦІЯ -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-clipboard-check" />
              2. Відповідність ДСТУ 4163 + НПА
            </div>
          </template>

          <div v-if="!report" class="text-muted text-sm">
            Згенеруйте документ для перевірки.
          </div>
          <div v-else>
            <div class="flex items-center gap-2 mb-3">
              <UIcon
                :name="report.compliant ? 'i-lucide-check-circle' : 'i-lucide-alert-circle'"
                :class="report.compliant ? 'text-success' : 'text-warning'"
              />
              <span class="font-medium">
                {{ report.compliant ? 'ВІДПОВІДАЄ' : 'Є зауваження' }} правил: {{ report.rules_passed }}
              </span>
            </div>
            <div v-if="report.findings.length" class="space-y-1">
              <div
                v-for="f in report.findings"
                :key="f.rule"
                class="flex gap-2 text-sm p-2 rounded bg-error/10 text-error"
              >
                <UIcon name="i-lucide-x-circle" class="flex-shrink-0 mt-0.5" />
                <span><strong>{{ f.rule }}</strong>: {{ f.message }}</span>
              </div>
            </div>
            <!-- PDF/A -->
            <div v-if="pdfaInfo" class="mt-3 p-3 rounded border border-default text-sm">
              <div class="flex items-center gap-2 font-medium mb-1">
                <UIcon
                  :name="pdfaInfo.conforms ? 'i-lucide-check-circle' : 'i-lucide-alert-triangle'"
                  :class="pdfaInfo.conforms ? 'text-success' : 'text-warning'"
                />
                PDF/A-3: {{ pdfaInfo.conforms ? 'відповідає (ISO 19005-3:2012)' : 'є зауваження' }}
              </div>
              <div v-for="f in pdfaInfo.findings" :key="f" class="text-warning text-xs ml-6">
                {{ f }}
              </div>
            </div>
          </div>
        </UCard>

        <!-- 3. ЧЕРГА -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-list-checks" />
              3. Черга підписання / погодження
            </div>
          </template>

          <div class="flex gap-2 mb-4">
            <UButton icon="i-lucide-send" :loading="submitting" @click="submitDoc">
              Подати у чергу
            </UButton>
            <UButton
              variant="outline"
              icon="i-lucide-archive"
              :disabled="signerList.length === 0"
              @click="downloadAsice"
            >
              Завантажити ASiC-E
            </UButton>
            <span v-if="docStatus" class="text-sm text-muted self-center">
              статус: {{ docStatus }}
            </span>
          </div>

          <div v-if="signerList.length === 0" class="text-muted text-sm">
            Збережіть картку.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="(s, i) in signerList"
              :key="i"
              class="flex items-center gap-3 p-3 rounded border border-default"
            >
              <UBadge
                :label="s.status === 'signed' ? 'підписано' : s.status === 'rejected' ? 'відхилено' : 'очікує'"
                :color="s.status === 'signed' ? 'success' : s.status === 'rejected' ? 'error' : 'neutral'"
                variant="subtle"
              />
              <div>
                <div class="text-sm font-medium">#{{ i + 1 }} {{ s.name }}</div>
                <div class="text-xs text-muted">{{ s.position }}</div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- 4. КЕП -->
        <UCard>
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-key" />
              4. Підпис КЕП (на клієнті)
            </div>
          </template>

          <div class="space-y-4">
            <div class="text-sm" :class="euReady ? 'text-success' : 'text-muted'">
              {{ euStatus }}
            </div>

            <UFormField label="Спосіб зчитування ключа">
              <USelect
                v-model="keySource"
                :items="[
                  { label: 'Файловий ключ (.dat / .pfx / .jks)', value: 'file' },
                  { label: 'Апаратний токен (е.Ключ, Алмаз, ID-картка…)', value: 'token' }
                ]"
                class="w-full"
              />
            </UFormField>

            <div v-if="keySource === 'token'" class="ui-info-message text-sm text-muted p-3 rounded border border-default">
              Підпис апаратним токеном через офіційний віджет ІІТ.
              <div id="sign-widget-parent" class="mt-2" />
            </div>

            <template v-else>
              <UFormField v-if="caList.length" label="Кваліфікований надавач (КНЕДП)">
                <USelect :items="caList" class="w-full" />
              </UFormField>

              <UFormField label="Файл особистого ключа (.dat / .pfx / .jks)">
                <input
                  type="file"
                  class="text-sm"
                  @change="(e) => keyFile = (e.target as HTMLInputElement).files?.[0] ?? null"
                >
              </UFormField>
            </template>

            <UFormField label="Пароль захисту ключа">
              <UInput v-model="keyPass" type="password" placeholder="••••••" class="w-full" />
            </UFormField>

            <div class="flex gap-2">
              <UButton
                icon="i-lucide-pen-tool"
                color="success"
                :loading="signing"
                :disabled="!euReady || signerList.every(s => s.status !== 'pending')"
                @click="signCurrent"
              >
                Підписати поточним у черзі
              </UButton>
            </div>

            <div class="text-xs text-muted p-3 rounded border border-default">
              Приватний ключ не покидає браузер (Закон 2155-VIII).
              Для апаратних токенів потрібне встановлене «ІІТ Користувач ЦСК».
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
