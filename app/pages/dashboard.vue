<script setup lang="ts">
import type { DropdownMenuItem, StepperItem, TimelineItem } from '@nuxt/ui'

definePageMeta({
  middleware: 'auth',
  layout: 'dashboard'
})

useSeoMeta({
  title: 'Діловод · Документи',
  description: 'Система електронного документообігу ДСТУ 4163'
})

const { apiFetch, logout, user, token } = useAuth()
const toast = useToast()

// --- стан списку ---
const docs = ref<DocEntry[]>([])
const selectedId = ref<string | null>(null)
const activeCategory = ref<string>('all')
const searchQuery = ref('')

// --- папки-категорії ---
// activeFolderId має зміст лише коли activeCategory === 'folder':
//   null  → фільтр «Без папки» (документи поза папками)
//   <id>  → документи конкретної папки
const folders = ref<FolderEntry[]>([])
const activeFolderId = ref<number | null>(null)

// модалка створення/перейменування папки
const folderModalOpen = ref(false)
const folderModalMode = ref<'create' | 'rename'>('create')
const folderEditId = ref<number | null>(null)
const folderName = ref('')
const folderColor = ref<string>('primary')
const folderSaving = ref(false)

// --- оцифрування: заливка скану ---
const scanModalOpen = ref(false)
const scanFile = ref<File | null>(null)
const scanTitle = ref('')
const scanSigners = ref('')
const scanUploading = ref(false)

function openScanModal() {
  scanFile.value = null
  scanTitle.value = ''
  scanSigners.value = ''
  scanModalOpen.value = true
}

async function uploadScan() {
  if (!scanFile.value) {
    toast.add({ title: 'Оберіть файл скану', color: 'warning' })
    return
  }
  scanUploading.value = true
  try {
    const apiBase = useRuntimeConfig().public.apiBase
    const docId = `SCAN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`
    const fd = new FormData()
    fd.append('file', scanFile.value)
    fd.append('doc_id', docId)
    fd.append('title', scanTitle.value || scanFile.value.name)
    fd.append('signers', scanSigners.value)
    const res = await fetch(`${apiBase}/documents/scan`, {
      method: 'POST',
      headers: token.value ? { Authorization: `Bearer ${token.value}` } : {},
      body: fd
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
      throw new Error(err.detail || `HTTP ${res.status}`)
    }
    const doc = await res.json()
    toast.add({ title: 'Скан оцифровано', description: `${doc.doc_id} — готовий до підпису`, color: 'success' })
    scanModalOpen.value = false
    await refreshAll()
    await selectDoc({ doc_id: doc.doc_id } as DocEntry)
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка заливки скану', description: String(e), color: 'error' })
  }
  finally {
    scanUploading.value = false
  }
}

// --- вьювер документів (PDF + DOCX) ---
const viewerOpen = ref(false)
const viewerUrl = ref<string>('')        // object URL для PDF iframe
const viewerHtml = ref<string>('')       // конвертований HTML для DOCX
const viewerMode = ref<'pdf' | 'docx'>('pdf')
const viewerLoading = ref(false)
const viewerTitle = ref('')

async function openViewer(target?: { doc_id: string, title?: string, fmt?: string }) {
  const docId = target?.doc_id ?? form.doc_id
  const docTitle = target?.title ?? form.title ?? docId
  const docFmt = target?.fmt ?? form.fmt
  viewerLoading.value = true
  viewerOpen.value = true
  viewerTitle.value = docTitle || docId
  viewerMode.value = docFmt === 'docx' ? 'docx' : 'pdf'
  // прибрати попередній стан
  if (viewerUrl.value) { URL.revokeObjectURL(viewerUrl.value); viewerUrl.value = '' }
  viewerHtml.value = ''
  try {
    const apiBase = useRuntimeConfig().public.apiBase
    const res = await fetch(`${apiBase}/documents/${docId}/download`, {
      headers: token.value ? { Authorization: `Bearer ${token.value}` } : {}
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    if (viewerMode.value === 'docx') {
      // DOCX рендеримо у HTML через mammoth (браузер не показує docx нативно)
      const mammoth = await import('mammoth')
      const buf = await blob.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer: buf })
      viewerHtml.value = result.value || '<p class="text-muted">Порожній документ</p>'
    }
    else {
      viewerUrl.value = URL.createObjectURL(blob)
    }
  }
  catch (e: unknown) {
    viewerOpen.value = false
    toast.add({ title: 'Не вдалося відкрити документ', description: String(e), color: 'error' })
  }
  finally {
    viewerLoading.value = false
  }
}

// швидкий перегляд прямо зі списку — не змінює відкриту картку
function previewDoc(doc: DocEntry) {
  openViewer({ doc_id: doc.doc_id, title: doc.title, fmt: doc.fmt })
}

function openViewerInNewTab() {
  if (viewerUrl.value) window.open(viewerUrl.value, '_blank')
}

function closeViewer() {
  viewerOpen.value = false
  if (viewerUrl.value) {
    URL.revokeObjectURL(viewerUrl.value)
    viewerUrl.value = ''
  }
  viewerHtml.value = ''
}

// --- режим масового вибору на видалення ---
const selectMode = ref(false)
const selectedForDelete = ref<Set<string>>(new Set())
const deletingBulk = ref(false)

// --- обрані (favorites): персональна позначка у localStorage ---
const favorites = ref<Set<string>>(new Set())

function loadFavorites() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem('dilovod_favorites')
    favorites.value = new Set(raw ? JSON.parse(raw) : [])
  }
  catch { favorites.value = new Set() }
}

function persistFavorites() {
  if (typeof window === 'undefined') return
  localStorage.setItem('dilovod_favorites', JSON.stringify([...favorites.value]))
}

function toggleFavorite(docId: string) {
  const next = new Set(favorites.value)
  if (next.has(docId)) next.delete(docId)
  else next.add(docId)
  favorites.value = next
  persistFavorites()
}

function isFavorite(docId: string): boolean {
  return favorites.value.has(docId)
}

// --- стан картки ---
const form = reactive({
  doc_id: `DOC-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`,
  org_name: 'ДЕРЖАВНЕ ПІДПРИЄМСТВО «УКРНДНЦ»',
  subject_type: 'legal',
  doc_type: 'Наказ',
  fmt: 'pdf',
  title: '',
  date_text: '',
  reg_index: '',
  body: '',
  signers: ''
})

// авто-реєстрація: індекс і дата присвоюються бекендом при поданні у чергу.
// Якщо вимкнути — поля стають редагованими і використовуються як є.
const autoRegister = ref(true)

const report = ref<ValidationReport | null>(null)
const pdfaInfo = ref<PdfaInfo | null>(null)
const docStatus = ref<string>('')
const selectedIsScanned = ref(false)
const signerList = ref<SignerEntry[]>([])
const generating = ref(false)
const submitting = ref(false)

// --- КЕП стан ---
const euReady = ref(false)
const euStatus = ref('Завантаження бібліотеки EUSign…')
const keySource = ref<'file' | 'token'>('file')
const keyPass = ref('')
const keyFile = ref<File | null>(null)
const caList = ref<Array<{ title: string }>>([])
const caIndex = ref(0)
const signing = ref(false)
const signStep = ref('')

// UI-стан wizard'у: розкриття списку зауважень і юридичних деталей
const showFindings = ref(true)
const showLegalDetails = ref(false)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let euSignFactory: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let euWidget: any = null
let widgetInited = false

interface DocEntry {
  doc_id: string
  title: string
  doc_type: string
  status: string
  fmt?: string
  created_at: string
  registered_at?: string | null
  archived?: boolean
  folder_id?: number | null
}

interface FolderEntry {
  id: number
  name: string
  color?: string | null
  position: number
  doc_count?: number
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

// лічильники категорій
const archivedCount = computed(() => docs.value.filter(d => d.archived).length)
const activeCount = computed(() => docs.value.filter(d => !d.archived).length)
// документи поза папками (незаархівовані) — для пункту «Без папки»
const noFolderCount = computed(() =>
  docs.value.filter(d => !d.archived && (d.folder_id ?? null) === null).length
)

const filteredDocs = computed(() => {
  let list = docs.value
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(d =>
      d.title.toLowerCase().includes(q) || d.doc_id.toLowerCase().includes(q)
    )
  }
  if (activeCategory.value === 'favorites') return list.filter(d => favorites.value.has(d.doc_id) && !d.archived)
  if (activeCategory.value === 'archive') return list.filter(d => d.archived)
  if (activeCategory.value === 'trash') return list.filter(d => d.status === 'deleted')
  if (activeCategory.value === 'folder') {
    // папка — лише незаархівовані документи з відповідним folder_id
    return list.filter(d => !d.archived && (d.folder_id ?? null) === activeFolderId.value)
  }
  if (activeCategory.value === 'calendar') {
    list = list.filter(d => !d.archived)
    // якщо обрано день — лишаємо документи саме цього дня
    if (selectedDay.value) return list.filter(d => docDayKey(d) === selectedDay.value)
    return list
  }
  // звичайні категорії ховають архівовані документи
  return list.filter(d => !d.archived)
})

// заголовок списку залежно від активного фільтра
const activeFolder = computed(() => folders.value.find(f => f.id === activeFolderId.value) ?? null)
const listHeaderLabel = computed(() => {
  if (activeCategory.value === 'folder') {
    return activeFolder.value?.name ?? 'Без папки'
  }
  if (activeCategory.value === 'favorites') return 'Обрані'
  if (activeCategory.value === 'archive') return 'Архів'
  if (activeCategory.value === 'trash') return 'Кошик'
  if (activeCategory.value === 'calendar') return selectedDay.value ? selectedDayLabel.value : 'Календар'
  return 'Всі документи'
})

// ====================== WIZARD: степер + статус + timeline ======================
// Кроки wizard'у — відображають реальний стан документа (не навігаційну позицію).
// Етапи: 0 Документ · 1 Перевірка · 2 Підписання · 3 Відправлення.
const stepperItems = computed<StepperItem[]>(() => [
  { title: 'Документ', description: 'картка та реквізити', icon: 'i-lucide-file-text', value: 'document' },
  { title: 'Перевірка', description: 'ДСТУ 4163 + НПА', icon: 'i-lucide-clipboard-check', value: 'validation' },
  { title: 'Підписання', description: 'черга та КЕП', icon: 'i-lucide-pen-tool', value: 'signing' },
  { title: 'Відправлення', description: 'ASiC-E контейнер', icon: 'i-lucide-send', value: 'delivery' }
])

// «Найдаліший досягнутий» етап — для індикатора степера (станом документа).
const activeStepIndex = computed(() => {
  const st = docStatus.value
  if (st === 'signed') return 3
  if (signerList.value.length > 0 || st === 'pending_signatures' || st === 'pending') return 2
  if (report.value || st === 'generated') return 1
  return 0
})

// Заметний статус-бейдж документа (п.3).
type UiColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
const statusBadge = computed<{ label: string, color: UiColor, icon: string }>(() => {
  const st = docStatus.value
  if (st === 'signed') return { label: 'Підписано', color: 'success', icon: 'i-lucide-circle-check' }
  if (st === 'pending_signatures' || st === 'pending') return { label: 'Очікує підпису', color: 'warning', icon: 'i-lucide-clock' }
  if (st === 'rejected') return { label: 'Помилка підпису', color: 'error', icon: 'i-lucide-circle-alert' }
  if (selectedId.value && report.value && !report.value.compliant) {
    return { label: 'Є зауваження', color: 'warning', icon: 'i-lucide-triangle-alert' }
  }
  return { label: 'Чернетка', color: 'neutral', icon: 'i-lucide-circle-dashed' }
})

// Формат/тип картки — для іконки в шапці.
const docFormatLabel = computed(() => {
  if (selectedIsScanned.value) return 'Скан-копія PDF'
  return form.fmt === 'docx' ? 'DOCX-документ' : 'PDF-документ'
})

// Черга підписання → timeline (п.5).
const signerTimeline = computed<TimelineItem[]>(() =>
  signerList.value.map((s, i) => ({
    title: `#${i + 1} ${s.name}`,
    description: s.position,
    icon: s.status === 'signed'
      ? 'i-lucide-circle-check'
      : s.status === 'rejected'
        ? 'i-lucide-circle-x'
        : 'i-lucide-clock',
    value: String(i)
  }))
)

// скрол до секції wizard'у за кліком по кроку степера (без блокування).
const STEP_SECTION_IDS = ['sec-document', 'sec-validation', 'sec-signing', 'sec-delivery']
function scrollToStep(v: string | number | undefined) {
  const idx = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(idx)) return
  const id = STEP_SECTION_IDS[idx]
  if (id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

// ====================== КАЛЕНДАР ДОКУМЕНТІВ ======================
// ефективна дата документа: реєстрація → дата реєстр. → створення
const selectedDay = ref<string | null>(null)        // 'YYYY-MM-DD'
const calCursor = ref(new Date())                    // місяць, що відображається

function docDate(d: DocEntry): Date | null {
  const raw = d.registered_at || d.created_at
  if (!raw) return null
  const dt = new Date(raw)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function docDayKey(d: DocEntry): string | null {
  const dt = docDate(d)
  if (!dt) return null
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// мапа day-key → документи (без архівних), з урахуванням пошуку
const docsByDay = computed<Map<string, DocEntry[]>>(() => {
  const map = new Map<string, DocEntry[]>()
  let list = docs.value.filter(d => !d.archived)
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(d => d.title.toLowerCase().includes(q) || d.doc_id.toLowerCase().includes(q))
  }
  for (const d of list) {
    const k = docDayKey(d)
    if (!k) continue
    const arr = map.get(k)
    if (arr) arr.push(d)
    else map.set(k, [d])
  }
  return map
})

const UA_MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
]
const UA_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

const calMonthLabel = computed(() =>
  `${UA_MONTHS[calCursor.value.getMonth()]} ${calCursor.value.getFullYear()}`
)

interface CalCell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  count: number
}

// сітка 6×7 з понеділка
const calGrid = computed<CalCell[]>(() => {
  const year = calCursor.value.getFullYear()
  const month = calCursor.value.getMonth()
  const first = new Date(year, month, 1)
  // зсув: getDay() 0=Нд → робимо Пн=0
  const lead = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - lead)
  const todayKey = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  })()
  const cells: CalCell[] = []
  for (let i = 0; i < 42; i++) {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    cells.push({
      key,
      day: dt.getDate(),
      inMonth: dt.getMonth() === month,
      isToday: key === todayKey,
      count: docsByDay.value.get(key)?.length ?? 0
    })
  }
  return cells
})

function calPrevMonth() {
  calCursor.value = new Date(calCursor.value.getFullYear(), calCursor.value.getMonth() - 1, 1)
}

function calNextMonth() {
  calCursor.value = new Date(calCursor.value.getFullYear(), calCursor.value.getMonth() + 1, 1)
}

function calToday() {
  const t = new Date()
  calCursor.value = new Date(t.getFullYear(), t.getMonth(), 1)
  selectedDay.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function pickDay(cell: CalCell) {
  if (cell.count === 0 && !cell.inMonth) return
  // повторний клік по обраному дню — зняти фільтр
  selectedDay.value = selectedDay.value === cell.key ? null : cell.key
}

// людиночитна підказка обраного дня
const selectedDayLabel = computed(() => {
  if (!selectedDay.value) return ''
  const [y, m, d] = selectedDay.value.split('-').map(Number)
  return `${d} ${UA_MONTHS[(m ?? 1) - 1]?.toLowerCase()} ${y}`
})

function openCalendar() {
  activeCategory.value = 'calendar'
  // перейти на місяць найсвіжішого документа, якщо поточний порожній
  if (docsByDay.value.size && ![...docsByDay.value.keys()].some(k => k.startsWith(
    `${calCursor.value.getFullYear()}-${String(calCursor.value.getMonth() + 1).padStart(2, '0')}`
  ))) {
    const latest = [...docsByDay.value.keys()].sort().at(-1)
    if (latest) {
      const [y, m] = latest.split('-').map(Number)
      calCursor.value = new Date(y ?? 2026, (m ?? 1) - 1, 1)
    }
  }
}

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

// свіже і списки документів, і лічильники папок — після операцій, що їх змінюють
async function refreshAll() {
  await Promise.all([reloadDocs(), reloadFolders()])
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
    // відновлюємо body і решту полів з content_json
    const cj = (full as Record<string, unknown>).content_json as Record<string, unknown> | undefined
    if (cj) {
      form.org_name = String(cj.org_name ?? form.org_name)
      form.subject_type = String(cj.subject_type ?? form.subject_type)
      form.date_text = String(cj.date_text ?? '')
      form.reg_index = String(cj.reg_index ?? '')
      const b = cj.body
      form.body = Array.isArray(b) ? b.join('\n') : String(b ?? '')
    }
    // зареєстровані індекс/дата живуть у колонках БД — вони пріоритетні
    const fr = full as Record<string, unknown>
    if (fr.reg_index) form.reg_index = String(fr.reg_index)
    if (fr.reg_date) form.date_text = String(fr.reg_date)
    selectedIsScanned.value = Boolean(fr.is_scanned)
    docStatus.value = full.status
    signerList.value = full.signers.map(s => ({
      name: s.full_name,
      position: s.position,
      status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending'
    }))

    // для підписаних документів беремо СВІЖИЙ звіт через /validate
    // (інжектить реальні КЕП-відмітки з doc.signers — ст.7 851-IV),
    // бо збережений conformance міг бути порахований до підпису
    let conf = full.conformance
    if (full.status === 'signed' || full.status === 'pending_signatures') {
      try {
        conf = await apiFetch(`/documents/${full.doc_id}/validate`, { method: 'POST' })
      }
      catch { /* fallback на збережений conformance */ }
    }
    if (conf) {
      const c = conf as {
        conforms?: boolean; compliant?: boolean
        findings_count?: number; rules_passed?: number
        results?: Array<{ rule_id: string; conforms: boolean; findings: Array<{ message: string }> }>
        findings?: Array<{ rule: string; message: string }>
      }
      // підтримуємо обидва формати
      report.value = {
        compliant: c.compliant ?? c.conforms ?? false,
        rules_passed: c.rules_passed ?? (c.results?.filter(x => x.conforms).length ?? 0),
        findings: c.findings ?? (c.results
          ?.filter(x => !x.conforms)
          .flatMap(x => x.findings.map(f => ({ rule: x.rule_id, message: f.message }))) ?? [])
      }
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
  selectedIsScanned.value = false
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
    await refreshAll()
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
    const res = await apiFetch<{
      doc_id: string
      report: {
        conforms: boolean
        findings_count: number
        results: Array<{ rule_id: string; clause: string; conforms: boolean; findings: Array<{ message: string }> }>
      }
      pdfa: { conforms: boolean; issues: string[] } | null
    }>(
      `/documents/${form.doc_id}/generate`,
      { method: 'POST' }
    )
    // нормалізуємо до внутрішнього формату
    const r = res.report
    report.value = {
      compliant: r.conforms,
      rules_passed: r.results.filter(x => x.conforms).length,
      findings: r.results
        .filter(x => !x.conforms)
        .flatMap(x => x.findings.map(f => ({ rule: x.rule_id, message: f.message })))
    }
    pdfaInfo.value = res.pdfa ? { conforms: res.pdfa.conforms, findings: res.pdfa.issues } : null
    await refreshAll()
    toast.add({ title: r.conforms ? 'Документ відповідає ДСТУ' : 'Є зауваження', color: r.conforms ? 'success' : 'warning' })
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
    // прибрати з обраних, якщо було
    if (favorites.value.has(selectedId.value)) {
      const next = new Set(favorites.value)
      next.delete(selectedId.value)
      favorites.value = next
      persistFavorites()
    }
    selectedId.value = null
    await refreshAll()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка видалення', description: String(e), color: 'error' })
  }
}

// --- масовий вибір на видалення ---
function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedForDelete.value = new Set()
}

function toggleForDelete(docId: string) {
  const next = new Set(selectedForDelete.value)
  if (next.has(docId)) next.delete(docId)
  else next.add(docId)
  selectedForDelete.value = next
}

function toggleSelectAll() {
  if (selectedForDelete.value.size === filteredDocs.value.length) {
    selectedForDelete.value = new Set()
  }
  else {
    selectedForDelete.value = new Set(filteredDocs.value.map(d => d.doc_id))
  }
}

async function deleteSelected() {
  const ids = [...selectedForDelete.value]
  if (ids.length === 0) return
  // eslint-disable-next-line no-alert
  if (!confirm(`Видалити ${ids.length} документ(ів) разом із підписами та аудитом?`)) return
  deletingBulk.value = true
  const results = await Promise.allSettled(
    ids.map(id => apiFetch(`/documents/${id}`, { method: 'DELETE' }))
  )
  deletingBulk.value = false
  const ok = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - ok
  if (failed === 0) {
    toast.add({ title: `Видалено ${ok} документ(ів)`, color: 'success' })
  }
  else {
    toast.add({
      title: `Видалено ${ok}, помилок ${failed}`,
      color: failed === results.length ? 'error' : 'warning'
    })
  }
  // якщо відкритий документ потрапив у видалені — закриваємо картку
  if (selectedId.value && selectedForDelete.value.has(selectedId.value)) {
    selectedId.value = null
  }
  // прибрати видалені з обраних
  if ([...selectedForDelete.value].some(id => favorites.value.has(id))) {
    const next = new Set(favorites.value)
    for (const id of selectedForDelete.value) next.delete(id)
    favorites.value = next
    persistFavorites()
  }
  selectMode.value = false
  selectedForDelete.value = new Set()
  await reloadDocs()
}

// --- архівування ---
async function archiveDoc(docId: string) {
  try {
    await apiFetch(`/documents/${docId}/archive`, { method: 'POST' })
    toast.add({ title: 'Переміщено в архів' })
    if (selectedId.value === docId) selectedId.value = null
    await refreshAll()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка архівування', description: String(e), color: 'error' })
  }
}

async function unarchiveDoc(docId: string) {
  try {
    await apiFetch(`/documents/${docId}/unarchive`, { method: 'POST' })
    toast.add({ title: 'Відновлено з архіву' })
    await refreshAll()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка відновлення', description: String(e), color: 'error' })
  }
}

// ====================== ПАПКИ-КАТЕГОРІЇ ======================
// Палітра кольорів папок: назва Nuxt UI → hex для крапки-індикатора.
const FOLDER_COLORS = [
  { id: 'primary', hex: '#6366f1' },
  { id: 'success', hex: '#22c55e' },
  { id: 'warning', hex: '#f59e0b' },
  { id: 'error', hex: '#ef4444' },
  { id: 'info', hex: '#3b82f6' },
  { id: 'neutral', hex: '#71717a' }
]
const FOLDER_COLOR_HEX: Record<string, string> = Object.fromEntries(
  FOLDER_COLORS.map(c => [c.id, c.hex])
)

function folderDotColor(c?: string | null): string {
  if (!c) return '#71717a'
  if (c.startsWith('#')) return c
  return FOLDER_COLOR_HEX[c] ?? '#6366f1'
}

async function reloadFolders() {
  try {
    const res = await apiFetch<{ folders: FolderEntry[] }>('/folders')
    folders.value = res.folders ?? []
    // якщо активну папку видалили з іншого місця — скидаємо фільтр
    if (activeCategory.value === 'folder'
      && activeFolderId.value !== null
      && !folders.value.some(f => f.id === activeFolderId.value)) {
      activeCategory.value = 'all'
    }
  }
  catch {
    // не блокуємо роботу — папки не критичні для списку
  }
}

function openCreateFolder() {
  folderModalMode.value = 'create'
  folderEditId.value = null
  folderName.value = ''
  folderColor.value = 'primary'
  folderModalOpen.value = true
}

function openRenameFolder(folder: FolderEntry) {
  folderModalMode.value = 'rename'
  folderEditId.value = folder.id
  folderName.value = folder.name
  folderColor.value = folder.color || 'primary'
  folderModalOpen.value = true
}

async function saveFolder() {
  const name = folderName.value.trim()
  if (!name) {
    toast.add({ title: 'Введіть назву папки', color: 'warning' })
    return
  }
  folderSaving.value = true
  try {
    if (folderModalMode.value === 'create') {
      await apiFetch('/folders', { method: 'POST', body: { name, color: folderColor.value } })
      toast.add({ title: 'Папку створено' })
    }
    else if (folderEditId.value !== null) {
      await apiFetch(`/folders/${folderEditId.value}`, {
        method: 'PUT',
        body: { name, color: folderColor.value }
      })
      toast.add({ title: 'Папку оновлено' })
    }
    folderModalOpen.value = false
    await reloadFolders()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка збереження папки', description: String(e), color: 'error' })
  }
  finally {
    folderSaving.value = false
  }
}

async function deleteFolder(folder: FolderEntry) {
  // eslint-disable-next-line no-alert
  if (!confirm(`Видалити папку «${folder.name}»? Документи залишаться — вони перейдуть у «Без папки».`)) return
  try {
    await apiFetch(`/folders/${folder.id}`, { method: 'DELETE' })
    toast.add({ title: 'Папку видалено' })
    // локально прибираємо folder_id у документах цієї папки
    for (const d of docs.value) {
      if (d.folder_id === folder.id) d.folder_id = null
    }
    if (activeCategory.value === 'folder' && activeFolderId.value === folder.id) {
      activeCategory.value = 'all'
    }
    await reloadFolders()
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка видалення папки', description: String(e), color: 'error' })
  }
}

async function moveDocToFolder(docId: string, folderId: number | null) {
  try {
    await apiFetch(`/documents/${docId}/folder`, {
      method: 'POST',
      body: { folder_id: folderId }
    })
    // оптимістично оновлюємо локальний стан
    const d = docs.value.find(x => x.doc_id === docId)
    if (d) d.folder_id = folderId
    await reloadFolders()
    toast.add({
      title: folderId === null ? 'Документ прибрано з папки' : 'Документ переміщено у папку',
      color: 'success'
    })
  }
  catch (e: unknown) {
    toast.add({ title: 'Помилка переміщення', description: String(e), color: 'error' })
  }
}

// вибір папки у сайдбарі — папки й «розділи» взаємовиключні
function selectFolder(folderId: number | null) {
  activeCategory.value = 'folder'
  activeFolderId.value = folderId
  selectedId.value = null
}

// меню дій над конкретною папкою (rename / delete)
function folderMenuItems(folder: FolderEntry): DropdownMenuItem[][] {
  return [[
    { label: 'Перейменувати', icon: 'i-lucide-pencil', onSelect: () => openRenameFolder(folder) }
  ], [
    { label: 'Видалити', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteFolder(folder) }
  ]]
}

// поточна папка відкритого документа (для мітки в заголовку картки)
const selectedFolderId = computed<number | null>(() => {
  if (!selectedId.value) return null
  return docs.value.find(d => d.doc_id === selectedId.value)?.folder_id ?? null
})

// меню «перемістити у папку» для поточного документа
const moveToFolderItems = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: 'Без папки',
      icon: 'i-lucide-folder-x',
      onSelect: () => moveDocToFolder(form.doc_id, null)
    }
  ],
  folders.value.map(f => ({
    label: f.name,
    icon: 'i-lucide-folder',
    color: (f.color && !f.color.startsWith('#'))
      ? (f.color as DropdownMenuItem['color'])
      : undefined,
    onSelect: () => moveDocToFolder(form.doc_id, f.id)
  }))
])

// --- подати у чергу ---
async function submitDoc() {
  submitting.value = true
  try {
    const res = await apiFetch<{
      status: string
      reg_index?: string
      reg_date?: string
      signers: Array<{ full_name: string; position: string; status: string }>
    }>(
      `/documents/${form.doc_id}/submit`,
      { method: 'POST', body: { auto_register: autoRegister.value } }
    )
    docStatus.value = res.status
    // підхопити присвоєні автоматично реєстраційний індекс і дату
    if (res.reg_index) form.reg_index = res.reg_index
    if (res.reg_date) form.date_text = res.reg_date
    signerList.value = res.signers.map(s => ({
      name: s.full_name,
      position: s.position,
      status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending'
    }))
    toast.add({
      title: 'Зареєстровано та подано у чергу',
      description: res.reg_index ? `Індекс №${res.reg_index} від ${res.reg_date}` : undefined
    })
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
  if (!euReady.value && keySource.value === 'file') {
    toast.add({ title: 'EUSign не готовий', color: 'error' })
    return
  }
  signing.value = true
  signStep.value = 'manifest'
  try {
    const apiBase = useRuntimeConfig().public.apiBase
    // 1. отримуємо manifest
    const mRes = await fetch(`${apiBase}/documents/${form.doc_id}/manifest`, {
      headers: { Authorization: `Bearer ${useAuth().token.value}` }
    })
    if (!mRes.ok) throw new Error('маніфест: ' + await mRes.text())
    const manifest = await mRes.text()

    let cmsB64: string
    if (keySource.value === 'token') {
      // iframe widget ІІТ
      if (!euWidget) throw new Error('віджет ІІТ не ініціалізовано')
      signStep.value = 'key'
      await euWidget.ReadPrivateKey()
      signStep.value = 'sign'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const EU = (window as any).EndUser
      cmsB64 = await euWidget.SignData(
        manifest, true, true,
        EU.SignAlgo.DSTU4145WithGOST34311, null,
        EU.SignType.CAdES_X_Long
      )
    } else {
      // файловий ключ через euscpfactory
      if (!euSignFactory) throw new Error('EUSign factory не готовий')
      signStep.value = 'key'
      euSignFactory.setCASettings(caIndex.value >= 0 ? caIndex.value : -1)
      euSignFactory.pkFilePassword = keyPass.value
      euSignFactory.pkFileItemIndex = -1
      euSignFactory.readPrivateKeyButtonClick()
      if (!euSignFactory.pkReaded) throw new Error('не вдалося прочитати ключ — перевірте пароль і файл')
      signStep.value = 'sign'
      const manifestBytes = new TextEncoder().encode(manifest)
      cmsB64 = euSignFactory.signData(manifestBytes, false, true, 'def')
    }

    if (!cmsB64) throw new Error('підпис не сформовано')

    // 2. знаходимо активного підписанта
    signStep.value = 'send'
    const next = signerList.value.find(s => s.status === 'pending')
    if (!next) throw new Error('немає активного підписанта (подайте у чергу)')

    await apiFetch(`/documents/${form.doc_id}/sign`, {
      method: 'POST',
      body: {
        signer_order_index: signerList.value.indexOf(next),
        signature_b64: cmsB64,
        signer: next.name,
        signer_position: next.position
      }
    })
    signStep.value = ''
    toast.add({ title: `Підписано: ${next.name}`, color: 'success' })
    await selectDoc({ doc_id: form.doc_id } as DocEntry)
    await refreshAll()
  }
  catch (e: unknown) {
    signStep.value = ''
    toast.add({ title: 'Помилка підписання', description: String(e), color: 'error' })
  }
  finally {
    signing.value = false
  }
}

async function initWidget() {
  if (widgetInited) return
  // чекаємо поки v-if відрендерить #sign-widget-parent у DOM
  await nextTick()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const EU = (window as any).EndUser
  if (typeof EU === 'undefined') {
    euStatus.value = 'eusign.js не завантажено — перезавантажте сторінку'
    return
  }
  const parent = document.getElementById('sign-widget-parent')
  if (!parent) {
    euStatus.value = 'Контейнер віджета не знайдено'
    return
  }
  try {
    euWidget = new EU(
      'sign-widget-parent', 'sign-widget',
      'https://eu.iit.com.ua/sign-widget/v20200922/',
      EU.FormType.ReadPKey
    )
    widgetInited = true
  } catch (e) {
    euStatus.value = `Помилка ініціалізації віджета: ${e}`
  }
}

// обробник файлу ключа з FileDropZone (замість колишнього <input type=file>)
function onKeyFile(file: File) {
  if (euSignFactory) euSignFactory.setPrivateKeyFile(file)
  keyFile.value = file
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
  loadFavorites()
  await refreshAll()
  // завантажуємо eusign.js (EndUser widget helper) динамічно
  await new Promise<void>((resolve) => {
    if ((window as unknown as { EndUser?: unknown }).EndUser) { resolve(); return }
    const s = document.createElement('script')
    s.src = '/eusign.js'
    s.onload = () => resolve()
    s.onerror = () => resolve() // не блокуємо якщо недоступний
    document.head.appendChild(s)
  })

  // завантажуємо euscpfactory.js (WASM crypto) з порталу через Nitro proxy
  // new Function обходить статичний аналіз Vite — файл не існує локально
  try {
    const dynamicImport = new Function('path', 'return import(path)')
    const mod = await dynamicImport('/api/eusign/modules/euscpfactory.js')
    euSignFactory = mod.euSignFactory
    euSignFactory.onerror = (m: string) => toast.add({ title: 'EUSign: ' + m, color: 'error' })
    euSignFactory.onChangeCAs = () => {
      if (euSignFactory?.CAsServers) caList.value = euSignFactory.CAsServers
    }
    const poll = setInterval(() => {
      if (euSignFactory?.isReady?.()) {
        clearInterval(poll)
        euReady.value = true
        if (euSignFactory.CAsServers) caList.value = euSignFactory.CAsServers
        euStatus.value = 'EUSign готовий. Оберіть спосіб ключа.'
      }
    }, 400)
    // файл ключа
    // буде прив'язано через @change в шаблоні
  }
  catch (err) {
    euStatus.value = `Не вдалося завантажити EUSign: ${err} — підпис недоступний, решта порталу працює.`
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

      <div class="p-3 space-y-2">
        <UButton block icon="i-lucide-plus" @click="newDocument">
          Додати документ
        </UButton>
        <UButton block variant="soft" icon="i-lucide-scan-line" @click="openScanModal">
          Залити скан
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
            { id: 'calendar', label: 'Календар', icon: 'i-lucide-calendar-days' },
            { id: 'favorites', label: 'Обрані', icon: 'i-lucide-star' },
            { id: 'archive', label: 'Архів', icon: 'i-lucide-archive' }
          ]"
          :key="cat.id"
          block
          variant="ghost"
          :color="activeCategory === cat.id ? 'primary' : 'neutral'"
          :icon="cat.icon"
          class="justify-start mb-0.5"
          @click="cat.id === 'calendar' ? openCalendar() : (activeCategory = cat.id)"
        >
          {{ cat.label }}
          <UBadge v-if="cat.id === 'all'" :label="String(activeCount)" variant="subtle" size="xs" class="ml-auto" />
          <UBadge v-else-if="cat.id === 'favorites' && favorites.size" :label="String(favorites.size)" color="warning" variant="subtle" size="xs" class="ml-auto" />
          <UBadge v-else-if="cat.id === 'archive' && archivedCount" :label="String(archivedCount)" variant="subtle" size="xs" class="ml-auto" />
        </UButton>

        <!-- ПАПКИ-КАТЕГОРІЇ -->
        <div class="flex items-center justify-between px-2 py-1 mt-3">
          <span class="text-xs font-medium text-muted uppercase">Папки</span>
          <UButton
            icon="i-lucide-plus"
            variant="ghost"
            color="neutral"
            size="xs"
            title="Створити папку"
            @click="openCreateFolder"
          />
        </div>

        <!-- Без папки (документи поза папками) -->
        <UButton
          block
          variant="ghost"
          :color="activeCategory === 'folder' && activeFolderId === null ? 'primary' : 'neutral'"
          icon="i-lucide-folder-x"
          class="justify-start mb-0.5"
          @click="selectFolder(null)"
        >
          Без папки
          <UBadge v-if="noFolderCount" :label="String(noFolderCount)" variant="subtle" size="xs" class="ml-auto" />
        </UButton>

        <!-- Користувацькі папки -->
        <div
          v-for="f in folders"
          :key="f.id"
          class="group flex items-center mb-0.5"
        >
          <UButton
            variant="ghost"
            :color="activeCategory === 'folder' && activeFolderId === f.id ? 'primary' : 'neutral'"
            class="justify-start flex-1 min-w-0"
            :title="f.name"
            @click="selectFolder(f.id)"
          >
            <span
              class="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
              :style="{ backgroundColor: folderDotColor(f.color) }"
            />
            <span class="truncate flex-1 text-left">{{ f.name }}</span>
            <UBadge
              v-if="f.doc_count"
              :label="String(f.doc_count)"
              variant="subtle"
              size="xs"
              class="ml-auto"
            />
          </UButton>
          <UDropdownMenu :items="folderMenuItems(f)" :ui="{ content: 'w-44' }">
            <UButton
              icon="i-lucide-ellipsis-vertical"
              variant="ghost"
              color="neutral"
              size="xs"
              class="flex-shrink-0 opacity-0 group-hover:opacity-100"
              title="Дії з папкою"
              @click.stop
            />
          </UDropdownMenu>
        </div>

        <div v-if="folders.length === 0" class="px-2 py-1 text-xs text-muted">
          Папок ще немає
        </div>
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
        <div class="min-w-0">
          <div class="font-medium text-sm truncate">{{ listHeaderLabel }}</div>
          <div class="text-xs text-muted">{{ filteredDocs.length }} документів</div>
        </div>
        <div class="flex items-center gap-1">
          <UButton
            :icon="selectMode ? 'i-lucide-x' : 'i-lucide-list-checks'"
            :variant="selectMode ? 'soft' : 'ghost'"
            :color="selectMode ? 'primary' : 'neutral'"
            size="xs"
            :title="selectMode ? 'Вийти з режиму вибору' : 'Вибрати для видалення'"
            @click="toggleSelectMode"
          />
          <UButton icon="i-lucide-refresh-cw" variant="ghost" size="xs" @click="refreshAll" />
        </div>
      </div>

      <!-- панель масового вибору -->
      <div v-if="selectMode" class="p-2 border-b border-default flex items-center gap-2 bg-elevated/50">
        <UCheckbox
          :model-value="selectedForDelete.size === filteredDocs.length && filteredDocs.length > 0"
          :indeterminate="selectedForDelete.size > 0 && selectedForDelete.size < filteredDocs.length"
          @update:model-value="toggleSelectAll"
        />
        <span class="text-xs text-muted flex-1">обрано: {{ selectedForDelete.size }}</span>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="soft"
          size="xs"
          :loading="deletingBulk"
          :disabled="selectedForDelete.size === 0"
          @click="deleteSelected"
        >
          Видалити
        </UButton>
      </div>

      <div class="flex-1 overflow-y-auto">
        <div
          v-for="doc in filteredDocs"
          :key="doc.doc_id"
          class="p-3 border-b border-default cursor-pointer hover:bg-elevated transition-colors flex items-center gap-2"
          :class="{ 'bg-elevated': selectMode ? selectedForDelete.has(doc.doc_id) : selectedId === doc.doc_id }"
          @click="selectMode ? toggleForDelete(doc.doc_id) : selectDoc(doc)"
        >
          <UCheckbox
            v-if="selectMode"
            :model-value="selectedForDelete.has(doc.doc_id)"
            @update:model-value="toggleForDelete(doc.doc_id)"
            @click.stop
          />
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium truncate flex items-center gap-1.5">
              <span
                v-if="doc.folder_id"
                class="inline-block w-2 h-2 rounded-sm flex-shrink-0"
                :style="{ backgroundColor: folderDotColor(folders.find(x => x.id === doc.folder_id)?.color) }"
                :title="folders.find(x => x.id === doc.folder_id)?.name"
              />
              <span class="truncate">{{ doc.title || '(без заголовка)' }}</span>
            </div>
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
          <UButton
            v-if="!selectMode"
            icon="i-lucide-eye"
            color="primary"
            variant="ghost"
            size="xs"
            class="opacity-40 hover:opacity-100"
            title="Швидкий перегляд"
            @click.stop="previewDoc(doc)"
          />
          <UButton
            v-if="!selectMode"
            icon="i-lucide-star"
            :color="isFavorite(doc.doc_id) ? 'warning' : 'neutral'"
            :variant="isFavorite(doc.doc_id) ? 'soft' : 'ghost'"
            size="xs"
            :class="isFavorite(doc.doc_id) ? '' : 'opacity-40 hover:opacity-100'"
            :title="isFavorite(doc.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
            @click.stop="toggleFavorite(doc.doc_id)"
          />
          <UButton
            v-if="!selectMode && doc.archived"
            icon="i-lucide-archive-restore"
            color="primary"
            variant="ghost"
            size="xs"
            class="opacity-60 hover:opacity-100"
            title="Відновити з архіву"
            @click.stop="unarchiveDoc(doc.doc_id)"
          />
          <UButton
            v-else-if="!selectMode"
            icon="i-lucide-archive"
            color="neutral"
            variant="ghost"
            size="xs"
            class="opacity-40 hover:opacity-100"
            title="В архів"
            @click.stop="archiveDoc(doc.doc_id)"
          />
        </div>
        <div v-if="filteredDocs.length === 0" class="p-6 text-center text-muted text-sm">
          Немає документів
        </div>
      </div>
    </div>

    <!-- ГОЛОВНА ОБЛАСТЬ -->
    <div class="flex-1 overflow-y-auto">
      <!-- КАЛЕНДАР ДОКУМЕНТІВ -->
      <div v-if="activeCategory === 'calendar' && !selectedId" class="max-w-3xl mx-auto p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-calendar-days" class="text-primary text-xl" />
            <div>
              <div class="font-semibold">Календар документів</div>
              <div class="text-xs text-muted">за датою реєстрації</div>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" size="sm" @click="calPrevMonth" />
            <span class="text-sm font-medium w-36 text-center select-none">{{ calMonthLabel }}</span>
            <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" size="sm" @click="calNextMonth" />
            <UButton variant="soft" size="xs" class="ml-2" @click="calToday">
              Сьогодні
            </UButton>
          </div>
        </div>

        <UCard :ui="{ body: 'p-3 sm:p-4' }">
          <!-- заголовки днів тижня -->
          <div class="grid grid-cols-7 gap-1 mb-1">
            <div
              v-for="wd in UA_WEEKDAYS"
              :key="wd"
              class="text-center text-xs font-medium text-muted py-1"
            >
              {{ wd }}
            </div>
          </div>
          <!-- сітка днів -->
          <div class="grid grid-cols-7 gap-1">
            <button
              v-for="cell in calGrid"
              :key="cell.key"
              type="button"
              class="relative aspect-square rounded-md flex flex-col items-center justify-center text-sm transition-colors border border-transparent"
              :class="[
                cell.inMonth ? 'text-default' : 'text-muted/40',
                cell.count > 0 ? 'cursor-pointer hover:bg-elevated hover:border-default' : 'cursor-default',
                selectedDay === cell.key ? 'bg-primary/15 border-primary text-primary font-semibold' : '',
                cell.isToday && selectedDay !== cell.key ? 'ring-1 ring-inset ring-primary/40' : ''
              ]"
              @click="pickDay(cell)"
            >
              <span>{{ cell.day }}</span>
              <span
                v-if="cell.count > 0"
                class="mt-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-medium"
                :class="selectedDay === cell.key ? 'bg-primary text-inverted' : 'bg-primary/20 text-primary'"
              >
                {{ cell.count }}
              </span>
            </button>
          </div>
        </UCard>

        <div class="mt-4 flex items-center gap-2 text-sm">
          <template v-if="selectedDay">
            <UIcon name="i-lucide-filter" class="text-primary" />
            <span class="text-muted">Показано документи за <strong class="text-default">{{ selectedDayLabel }}</strong> ({{ filteredDocs.length }})</span>
            <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-x" @click="selectedDay = null">
              Скинути
            </UButton>
          </template>
          <template v-else>
            <UIcon name="i-lucide-info" class="text-muted" />
            <span class="text-muted">Оберіть день з документами — список зліва відфільтрується.</span>
          </template>
        </div>
      </div>

      <div v-else-if="!selectedId && !form.title" class="flex items-center justify-center h-full">
        <div class="text-center text-muted">
          <UIcon name="i-lucide-file-text" class="text-5xl mb-3 opacity-30" />
          <div>Оберіть документ або створіть новий</div>
        </div>
      </div>

      <div v-else class="max-w-4xl mx-auto p-6 space-y-5">
        <!-- ШАПКА-СТЕПЕР: стан документа (клік → скрол до секції, без gate'ів) -->
        <UStepper
          :items="stepperItems"
          :model-value="activeStepIndex"
          class="px-2"
          @update:model-value="scrollToStep"
        />

        <!-- КРОК 1 · Документ -->
        <UCard id="sec-document">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                <UIcon name="i-lucide-file-text" class="text-xl" />
              </div>
              <div class="min-w-0 flex-1">
                <div class="font-semibold truncate">{{ form.title || '(без заголовка)' }}</div>
                <div class="text-xs text-muted flex items-center gap-2 truncate">
                  <span>{{ docFormatLabel }}</span>
                  <span>·</span>
                  <span class="truncate">{{ form.doc_id }}</span>
                </div>
              </div>
              <UBadge
                :label="statusBadge.label"
                :color="statusBadge.color"
                variant="subtle"
                size="md"
                class="flex-shrink-0"
              />
            </div>
          </template>

          <!-- secondary-тулбар: демотед дії -->
          <div class="flex items-center gap-1 mb-4 pb-3 border-b border-default flex-wrap">
            <UButton icon="i-lucide-eye" variant="ghost" color="neutral" size="xs" @click="() => openViewer()">
              Переглянути
            </UButton>
            <UButton icon="i-lucide-download" variant="ghost" color="neutral" size="xs" @click="downloadDoc">
              Завантажити
            </UButton>
            <UDropdownMenu v-if="selectedId" :items="moveToFolderItems" :ui="{ content: 'w-52' }">
              <UButton icon="i-lucide-folder" variant="ghost" color="neutral" size="xs">
                <span
                  v-if="selectedFolderId !== null"
                  class="inline-block w-2 h-2 rounded-sm"
                  :style="{ backgroundColor: folderDotColor(activeFolder?.color) }"
                />
                {{ selectedFolderId !== null ? (activeFolder?.name ?? 'Папка') : 'Без папки' }}
              </UButton>
            </UDropdownMenu>
            <UButton
              v-if="selectedId"
              icon="i-lucide-star"
              :color="isFavorite(form.doc_id) ? 'warning' : 'neutral'"
              :variant="isFavorite(form.doc_id) ? 'soft' : 'ghost'"
              size="xs"
              :title="isFavorite(form.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
              @click="toggleFavorite(form.doc_id)"
            />
            <div class="ml-auto">
              <UButton
                v-if="selectedId"
                icon="i-lucide-trash-2"
                variant="ghost"
                color="error"
                size="xs"
                title="Видалити"
                @click="deleteDoc"
              />
            </div>
          </div>

          <div class="space-y-4">
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
              <UFormField label="Формат">
                <USelect
                  v-model="form.fmt"
                  :items="[{ label: 'PDF', value: 'pdf' }, { label: 'DOCX', value: 'docx' }]"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Реєстр. індекс" :help="autoRegister ? 'авто при поданні' : 'введіть вручну'">
                <UInput
                  v-model="form.reg_index"
                  :disabled="autoRegister"
                  :placeholder="autoRegister ? 'авто' : '№'"
                  class="w-full"
                />
              </UFormField>
            </div>

            <UFormField label="Найменування організації">
              <UInput v-model="form.org_name" class="w-full" />
            </UFormField>
            <UFormField label="Заголовок">
              <UInput v-model="form.title" class="w-full" />
            </UFormField>
            <UFormField label="Дата реєстрації" :help="autoRegister ? 'авто при поданні' : 'введіть вручну'">
              <UInput
                v-model="form.date_text"
                :disabled="autoRegister"
                :placeholder="autoRegister ? 'авто' : '14 червня 2026 р.'"
                class="w-full"
              />
            </UFormField>

            <UCheckbox
              v-model="autoRegister"
              label="Авто-реєстрація"
              help="наскрізний індекс за типом документа + поточна дата при поданні у чергу"
            />

            <div v-if="selectedIsScanned" class="flex items-center gap-2 p-3 rounded border border-default text-sm text-muted">
              <UIcon name="i-lucide-scan-line" class="text-primary flex-shrink-0" />
              Скан-копія: оригіналом є завантажений файл. Текст не редагується — документ лише підписують КЕП.
            </div>
            <UFormField v-else label="Текст (кожен абзац — з нового рядка)">
              <UTextarea v-model="form.body" :rows="5" class="w-full" />
            </UFormField>

            <UFormField label="Підписанти (ПІБ | посада, по рядку)">
              <UTextarea v-model="form.signers" :rows="3" placeholder="ПЕТРЕНКО Олександр | Директор" class="w-full" />
            </UFormField>

            <div v-if="!selectedIsScanned" class="flex gap-2">
              <UButton icon="i-lucide-save" @click="createDoc">
                Зберегти картку
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- КРОК 2 · Перевірка -->
        <UCard id="sec-validation">
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-clipboard-check" />
              Перевірка документа
            </div>
          </template>

          <div v-if="!report" class="flex items-center justify-between gap-3">
            <span class="text-muted text-sm">Документ ще не перевірено за ДСТУ 4163 + НПА.</span>
            <UButton variant="outline" icon="i-lucide-cog" :loading="generating" @click="generateDoc">
              Згенерувати + перевірити
            </UButton>
          </div>
          <div v-else>
            <div class="flex items-center justify-between gap-3 mb-3">
              <div class="flex items-center gap-2">
                <UIcon
                  :name="report.compliant ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
                  :class="report.compliant ? 'text-success' : 'text-warning'"
                  class="text-lg"
                />
                <span class="font-medium">
                  {{ report.compliant ? 'Помилок не знайдено' : `Знайдено зауважень: ${report.findings?.length ?? 0}` }}
                </span>
              </div>
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-lucide-refresh-cw"
                :loading="generating"
                @click="generateDoc"
              >
                Перевірити знову
              </UButton>
            </div>

            <UButton
              v-if="report.findings?.length"
              :icon="showFindings ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              variant="ghost"
              color="neutral"
              size="xs"
              class="mb-2"
              @click="showFindings = !showFindings"
            >
              {{ showFindings ? 'Сховати зауваження' : 'Переглянути зауваження' }}
            </UButton>
            <div v-if="showFindings && report.findings?.length" class="space-y-1 mb-2">
              <div
                v-for="f in report.findings"
                :key="f.rule"
                class="flex gap-2 text-sm p-2 rounded bg-error/10 text-error"
              >
                <UIcon name="i-lucide-circle-x" class="flex-shrink-0 mt-0.5" />
                <span><strong>{{ f.rule }}</strong>: {{ f.message }}</span>
              </div>
            </div>

            <div v-if="pdfaInfo" class="mt-2 p-3 rounded border border-default text-sm">
              <div class="flex items-center gap-2 font-medium mb-1">
                <UIcon
                  :name="pdfaInfo.conforms ? 'i-lucide-circle-check' : 'i-lucide-triangle-alert'"
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

        <!-- КРОК 3 · Підписання (черга + КЕП) -->
        <UCard id="sec-signing">
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-pen-tool" />
              Підписання
              <span v-if="signerList.length" class="ml-auto text-xs font-normal text-muted">
                {{ signerList.filter(s => s.status === 'signed').length }}/{{ signerList.length }} підписано
              </span>
            </div>
          </template>

          <div class="space-y-5">
            <!-- Черга підписання → timeline -->
            <div>
              <div class="flex items-center justify-between gap-2 mb-3">
                <span class="text-sm font-medium">Черга підписання</span>
                <UButton
                  v-if="docStatus === 'draft' || !signerList.length"
                  icon="i-lucide-send"
                  :loading="submitting"
                  size="sm"
                  @click="submitDoc"
                >
                  Подати у чергу
                </UButton>
              </div>
              <div v-if="signerList.length === 0" class="text-muted text-sm">
                Збережіть картку й подайте у чергу.
              </div>
              <UTimeline v-else :items="signerTimeline" />
            </div>

            <USeparator />

            <!-- КЕП — кроки підпису -->
            <div class="space-y-4">
              <div class="text-sm" :class="euReady ? 'text-success' : 'text-muted'">
                {{ euStatus }}
              </div>

              <!-- (a) Спосіб підпису — сегмент-контрол -->
              <div>
                <div class="text-xs text-muted mb-1.5">Спосіб підпису</div>
                <div class="flex gap-2">
                  <UButton
                    :variant="keySource === 'file' ? 'soft' : 'outline'"
                    :color="keySource === 'file' ? 'primary' : 'neutral'"
                    icon="i-lucide-file-key"
                    size="sm"
                    class="flex-1 justify-center"
                    @click="keySource = 'file'"
                  >
                    Файловий ключ
                  </UButton>
                  <UButton
                    :variant="keySource === 'token' ? 'soft' : 'outline'"
                    :color="keySource === 'token' ? 'primary' : 'neutral'"
                    icon="i-lucide-usb"
                    size="sm"
                    class="flex-1 justify-center"
                    @click="() => { keySource = 'token'; initWidget() }"
                  >
                    Апаратний токен
                  </UButton>
                </div>
              </div>

              <!-- (b) токен-виджет ІІТ -->
              <div v-if="keySource === 'token'" class="p-3 rounded border border-default">
                <div class="text-sm text-muted mb-2">Підпис апаратним токеном через офіційний віджет ІІТ.</div>
                <div id="sign-widget-parent" class="w-full h-[620px] border border-default rounded overflow-hidden" />
              </div>

              <!-- (b') файловий ключ: дропзона + КНЕДП -->
              <template v-else>
                <UFormField v-if="caList.length" label="Кваліфікований надавач (КНЕДП)">
                  <USelect
                    v-model="caIndex"
                    :items="caList.map((c, i) => ({ label: c.title, value: i }))"
                    class="w-full"
                  />
                </UFormField>
                <FileDropZone
                  accept=".dat,.pfx,.jks,.p12,.zs2"
                  hint="Файл ключа (.dat / .pfx / .jks)"
                  :file-name="keyFile?.name"
                  @file="onKeyFile"
                />
              </template>

              <UFormField label="Пароль захисту ключа">
                <UInput v-model="keyPass" type="password" placeholder="••••••" class="w-full" />
              </UFormField>

              <div v-if="signStep" class="text-xs text-muted flex items-center gap-2">
                <UIcon name="i-lucide-loader-circle" class="animate-spin" />
                {{
                  signStep === 'manifest' ? 'Формування даних для підпису…' :
                  signStep === 'key' ? 'Зчитування ключа…' :
                  signStep === 'sign' ? 'Накладання КЕП (ДСТУ 4145)…' :
                  signStep === 'send' ? 'Передавання підпису на сервер…' : signStep
                }}
              </div>

              <!-- (c) SINGLE PRIMARY -->
              <UButton
                icon="i-lucide-pen-tool"
                color="success"
                size="lg"
                block
                :loading="signing"
                :disabled="(!euReady && keySource === 'file') || signerList.every(s => s.status !== 'pending')"
                @click="signCurrent"
              >
                Підписати документ
              </UButton>

              <!-- спрощений текст + «Детальніше» -->
              <div class="text-xs text-muted flex items-start gap-2">
                <UIcon name="i-lucide-lock" class="flex-shrink-0 mt-0.5 text-success" />
                <div>
                  Ваш ключ використовується лише для підпису та не передається на сервер.
                  <UButton
                    variant="ghost"
                    color="neutral"
                    size="xs"
                    class="ml-1 px-1"
                    @click="showLegalDetails = !showLegalDetails"
                  >
                    Детальніше
                  </UButton>
                  <div v-if="showLegalDetails" class="mt-1 text-muted/80">
                    Приватний ключ не покидає браузер (Закон 2155-VIII). Для апаратних токенів потрібне встановлене «ІІТ Користувач ЦСК».
                  </div>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <!-- КРОК 4 · Відправлення (ASiC-E) -->
        <UCard id="sec-delivery">
          <template #header>
            <div class="flex items-center gap-2 font-semibold">
              <UIcon name="i-lucide-send" />
              Відправлення
            </div>
          </template>

          <div v-if="docStatus === 'signed'" class="flex flex-col items-center text-center py-4 gap-3">
            <UIcon name="i-lucide-circle-check" class="text-success text-4xl" />
            <div>
              <div class="font-medium">Документ підписано</div>
              <div class="text-xs text-muted">Підписаний ASiC-E контейнер готовий до доставки / архівування.</div>
            </div>
            <div class="flex gap-2">
              <UButton icon="i-lucide-archive" @click="downloadAsice">
                Завантажити ASiC-E
              </UButton>
              <UButton variant="outline" icon="i-lucide-eye" @click="() => openViewer()">
                Переглянути
              </UButton>
            </div>
          </div>
          <div v-else class="flex items-center gap-2 text-muted text-sm">
            <UIcon name="i-lucide-lock" />
            Стане доступним після підписання документа.
          </div>
        </UCard>
      </div>
    </div>

    <!-- ВЬЮВЕР ДОКУМЕНТІВ (PDF + DOCX) -->
    <UModal v-model:open="viewerOpen" :ui="{ content: 'max-w-5xl w-full' }">
      <template #content>
        <div class="flex flex-col h-[85vh]">
          <div class="flex items-center justify-between p-3 border-b border-default">
            <div class="flex items-center gap-2 font-medium text-sm min-w-0">
              <UIcon name="i-lucide-file-text" class="text-primary flex-shrink-0" />
              <span class="truncate">{{ viewerTitle }}</span>
              <UBadge :label="viewerMode.toUpperCase()" size="xs" variant="subtle" class="flex-shrink-0" />
            </div>
            <div class="flex items-center gap-1 flex-shrink-0">
              <UButton
                icon="i-lucide-download"
                variant="ghost"
                size="xs"
                title="Завантажити"
                @click="downloadDoc"
              />
              <UButton
                v-if="viewerMode === 'pdf'"
                icon="i-lucide-external-link"
                variant="ghost"
                size="xs"
                title="Відкрити в новій вкладці"
                :disabled="!viewerUrl"
                @click="openViewerInNewTab"
              />
              <UButton icon="i-lucide-x" variant="ghost" size="xs" @click="closeViewer" />
            </div>
          </div>
          <div class="flex-1 relative bg-elevated overflow-auto">
            <div v-if="viewerLoading" class="absolute inset-0 flex items-center justify-center">
              <UIcon name="i-lucide-loader-circle" class="animate-spin text-2xl text-muted" />
            </div>
            <!-- PDF: нативний iframe -->
            <iframe
              v-if="viewerMode === 'pdf' && viewerUrl"
              :src="viewerUrl"
              class="w-full h-full border-0"
              title="PDF перегляд"
            />
            <!-- DOCX: конвертований HTML (mammoth) -->
            <div
              v-else-if="viewerMode === 'docx' && viewerHtml"
              class="docx-preview mx-auto my-6 max-w-3xl bg-white text-black p-12 shadow-lg rounded"
              v-html="viewerHtml"
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- ЗАЛИВКА СКАНУ (оцифрування паперового документа) -->
    <UModal v-model:open="scanModalOpen" :ui="{ content: 'max-w-lg w-full' }">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-center gap-2 font-semibold">
            <UIcon name="i-lucide-scan-line" class="text-primary" />
            Оцифрування паперового документа
          </div>
          <p class="text-sm text-muted">
            Завантажте скан (PDF або фото). Скан стане електронним оригіналом
            і його можна буде підписати КЕП — електронна копія набуде юридичної
            сили (Закон 851-IV).
          </p>

          <UFormField label="Файл скану (PDF / JPEG / PNG / TIFF)">
            <FileDropZone
              accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff,.bmp,.webp,application/pdf,image/*"
              hint="Перетягніть скан сюди"
              :file-name="scanFile?.name"
              @file="(f) => scanFile = f"
            />
          </UFormField>

          <UFormField label="Назва документа">
            <UInput v-model="scanTitle" placeholder="напр. Наказ №7 (паперовий оригінал)" class="w-full" />
          </UFormField>

          <UFormField label="Підписанти (ПІБ | посада, по рядку)">
            <UTextarea
              v-model="scanSigners"
              :rows="2"
              placeholder="ПЕТРЕНКО Олександр | Директор"
              class="w-full"
            />
          </UFormField>

          <div class="flex gap-2 justify-end">
            <UButton variant="ghost" color="neutral" @click="scanModalOpen = false">
              Скасувати
            </UButton>
            <UButton
              icon="i-lucide-upload"
              :loading="scanUploading"
              :disabled="!scanFile"
              @click="uploadScan"
            >
              Оцифрувати
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- СТВОРЕННЯ / ПЕРЕЙМЕНУВАННЯ ПАПКИ -->
    <UModal v-model:open="folderModalOpen" :ui="{ content: 'max-w-sm w-full' }">
      <template #content>
        <div class="p-5 space-y-4">
          <div class="flex items-center gap-2 font-semibold">
            <UIcon name="i-lucide-folder-plus" class="text-primary" />
            {{ folderModalMode === 'create' ? 'Нова папка' : 'Перейменувати папку' }}
          </div>

          <UFormField label="Назва папки">
            <UInput
              v-model="folderName"
              placeholder="напр. Фінанси"
              class="w-full"
              autofocus
              @keydown.enter="saveFolder"
            />
          </UFormField>

          <UFormField label="Колір">
            <div class="flex items-center gap-2">
              <button
                v-for="c in FOLDER_COLORS"
                :key="c.id"
                type="button"
                class="w-6 h-6 rounded-full border-2 transition-transform"
                :class="folderColor === c.id ? 'border-default scale-110 ring-2 ring-primary/40' : 'border-transparent'"
                :style="{ backgroundColor: c.hex }"
                :title="c.id"
                @click="folderColor = c.id"
              />
            </div>
          </UFormField>

          <div class="flex gap-2 justify-end">
            <UButton variant="ghost" color="neutral" @click="folderModalOpen = false">
              Скасувати
            </UButton>
            <UButton
              icon="i-lucide-check"
              :loading="folderSaving"
              :disabled="!folderName.trim()"
              @click="saveFolder"
            >
              {{ folderModalMode === 'create' ? 'Створити' : 'Зберегти' }}
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
/* стилі для DOCX-прев'ю (mammoth HTML): тип. документ на «папері» */
.docx-preview :deep(h1) { font-size: 1.5rem; font-weight: 700; margin: 0.8em 0 0.4em; }
.docx-preview :deep(h2) { font-size: 1.25rem; font-weight: 600; margin: 0.7em 0 0.35em; }
.docx-preview :deep(p) { margin: 0.5em 0; line-height: 1.6; text-align: justify; }
.docx-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
.docx-preview :deep(td), .docx-preview :deep(th) { border: 1px solid #ccc; padding: 6px 10px; }
.docx-preview :deep(strong) { font-weight: 700; }
.docx-preview :deep(ul), .docx-preview :deep(ol) { margin: 0.5em 0; padding-left: 1.5em; }
</style>
