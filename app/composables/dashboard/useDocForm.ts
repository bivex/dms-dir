import type { StepperItem, TimelineItem } from '@nuxt/ui'
import type { DocForm, PdfaInfo, SignerEntry, ApproverEntry, ApproverUser, SignerUser, ValidationReport, UiColor } from './types'

/**
 * Стан картки документа + валідація + черга підписання (без самої логіки
 * завантаження списку — те в useDocuments). Тут: form-реактив, report/pdfa,
 * docStatus/signerList, wizard-computed'и, buildPayload/submitDoc.
 */
/** Префікс doc_id за видом документа (укр. назва → компактна 3-4 літерна
 *  абревіатура латиницею для URL). doc_id потрапляє в URL (/documents/...),
 *  кирилиця ламала б читабельність і сумісність, тому беремо абревіатуру.
 *  Невідомий/власний вид → DOC (внутрішній ID).
 *
 *  Схема (приклад): NKZ-5E0QFX, LST-7K2M9A, PRT-X9Y2K4.
 *  Реєстраційний номер (reg_index, присвоюється бекендом при поданні) окремий:
 *  NKZ-2026-001 — наскрізна нумерація за роком. */
const DOC_TYPE_PREFIX: Record<string, string> = {
  'Наказ': 'NKZ',
  'Наказ про відпустку': 'NKZ-V',
  'Наказ про прийняття на роботу': 'NKZ-P',
  'Розпорядження': 'RZD',
  'Постанова': 'PST',
  'Рішення': 'RSH',
  'Протокол': 'PRT',
  'Витяг з протоколу': 'VPR',
  'Лист': 'LST',
  'Службова записка': 'SZP',
  'Доповідна записка': 'DZP',
  'Пояснювальна записка': 'PZP',
  'Заява': 'ZVA',
  'Заява про надання матеріальної допомоги': 'ZVA-M',
  'Скарга на дії правоохоронців': 'SKG-P',
  'Акт': 'AKT',
  'Довідка': 'DVK',
  'Положення': 'PLH',
  'Інструкція': 'INS',
  'Посадова інструкція': 'PIN',
  'Договір': 'DGV',
  'Угода': 'UHD',
  'Додаткова угода': 'DUH'
}

/** Генерує унікальний doc_id з компактною укр. абревіатурою виду документа.
 *  Формат: <ПРЕФІКС>-<6 Base36>, напр. NKZ-5E0QFX, LST-7K2M9A, PRT-X9Y2K4.
 *  docType невідомий/порожній → DOC-XXXXXX (fallback, внутрішній ID). */
function genDocId(docType?: string): string {
  const rand = Math.floor(Math.random() * 0xFFFFFFFFFFFF)
    .toString(36).toUpperCase().padStart(6, '0').slice(-6)
  const prefix = docType && DOC_TYPE_PREFIX[docType]
    ? DOC_TYPE_PREFIX[docType]
    : 'DOC'
  return `${prefix}-${rand}`
}

/** Будує рядок контактів заявника з профілю користувача (для блоку «від кого»).
 *  Адреса (багаторядкова) → телефон → email. Повертає null, якщо профіль
 *  порожній — тоді використовується шаблон з плейсхолдерами [. */
function buildContactsFromUser(u: { phone?: string | null, address?: string | null, email?: string | null } | null): string | null {
  if (!u) return null
  if (!u.address && !u.phone && !u.email) return null
  const lines: string[] = []
  if (u.address) lines.push(...u.address.split('\n').map(l => l.trim()).filter(Boolean))
  if (u.phone) lines.push(`тел.: ${u.phone}`)
  if (u.email) lines.push(`email: ${u.email}`)
  return lines.length ? lines.join('\n') : null
}

export function useDocForm(apiFetch: ReturnType<typeof useAuth>['apiFetch']) {
  const toast = useToast()
  const { user: currentUser } = useAuth()

  const creatingDoc = ref(false)
  const form = reactive<DocForm>({
    doc_id: genDocId('Наказ'),
    org_name: 'ДЕРЖАВНЕ ПІДПРИЄМСТВО «ДІЛОВОД»',
    subject_type: 'legal',
    doc_type: 'Наказ',
    fmt: 'pdf',
    title: '',
    date_text: '',
    reg_index: '',
    place: '',
    body: '',
    addressees: '',
    sender_contacts: '',
    signers: '',
    signerUsers: [] as SignerUser[],
    journal_id: null,
    approval_type: 'sequential',
    approverUsers: [] as ApproverUser[],
    pagination_barcode: false,
    use_stamp: false,
    stamp_type: 'none',
    use_incoming_stamp: false,
    use_copy_stamp: false,
    use_control_stamp: false,
    restriction_stamp: 'none',
    use_copy_mark: false,
    use_archived_stamp: false,
    use_annulled_stamp: false,
    use_urgent_stamp: false,
    extra_stamps: [] as string[],
    control_executor_id: null,
    acknowledge_user_ids: [],
    related_doc_id: null
  })

  // авто-реєстрація: індекс і дата присвоюються бекендом при поданні у чергу.
  const autoRegister = ref(true)

  const report = ref<ValidationReport | null>(null)
  const pdfaInfo = ref<PdfaInfo | null>(null)
  const docStatus = ref<string>('')
  const selectedIsScanned = ref(false)
  const signerList = ref<SignerEntry[]>([])

  // Коли користувач змінює вид документа у НОВІЙ картці (docStatus порожній) —
  // оновлюємо doc_id з відповідним укр. префіксом (NAKAZ-…, LYST-…). На вже
  // збереженому документі doc_id не чіпаємо (це його сталий ідентифікатор).
  watch(() => form.doc_type, (newType) => {
    if (docStatus.value === '') {
      if (DOC_TYPE_PREFIX[newType]) {
        form.doc_id = genDocId(newType)
      }
      
      const templates: Record<string, { title: string, body: string, subject_type?: 'legal' | 'fop' | 'person', addressees?: string, sender_contacts?: string }> = {
        'Наказ про відпустку': {
          title: 'Про надання щорічної відпустки',
          body: 'НАКАЗУЮ:\n1. Надати [ПІБ] щорічну основну відпустку тривалістю 14 календарних днів з [Дата] по [Дата] за робочий період з [Дата] по [Дата].\n2. Головному бухгалтеру провести розрахунок та виплату відпускних.',
          subject_type: 'legal'
        },
        'Наказ про прийняття на роботу': {
          title: 'Про прийняття на роботу',
          body: 'НАКАЗУЮ:\n1. Прийняти [ПІБ] на роботу з [Дата] на посаду [Посада].\n2. Встановити посадовий оклад згідно зі штатним розкладом.',
          subject_type: 'legal'
        },
        'Заява': {
          title: 'Заява про [предмет звернення]',
          body: 'Звертаюся до Вас із заявою з приводу [коротко опишіть обставини справи та підставу звернення].\n\nВідповідно до [норма закону, що підтверджує ваше право],\n\nПРОШУ:\n1. [суть прохання або вимоги];\n2. повідомити мене про результати розгляду цієї заяви у встановлений законом строк.',
          subject_type: 'person',
          addressees: '[Посада, ПІБ посадової особи]\n[Найменування органу]\n[Адреса органу]',
          sender_contacts: '[Вулиця, будинок, квартира]\n[Місто, індекс]\nтел.: [+38 0XX XXX XX XX]\nemail: [your@email.com]'
        },
        'Заява про надання матеріальної допомоги': {
          title: 'Заява про надання матеріальної допомоги',
          body: 'Прошу надати мені матеріальну допомогу у зв\'язку зі скрутним матеріальним становищем (на лікування / за сімейними обставинами).',
          subject_type: 'person',
          addressees: 'Директору ДП «ДІЛОВОД»',
          sender_contacts: '[Вулиця, будинок, квартира]\n[Місто, індекс]\nтел.: [+38 0XX XXX XX XX]\nemail: [your@email.com]'
        },
        'Скарга на дії правоохоронців': {
          title: 'Скарга на неправомірні дії (бездіяльність) службових осіб правоохоронних органів',
          body: 'Звертаюся до Вас із скаргою на неправомірні дії та бездіяльність працівників правоохоронних органів.\nПід час проведення процесуальних дій [Дата/Місце] було допущено істотні порушення моїх законних прав, що виявилося у [Опис неправомірних дій або бездіяльності].\nПрошу провести службове розслідування за вказаними фактами, вжити заходів дисциплінарного реагування та повідомити мене про результати розгляду.',
          subject_type: 'person',
          addressees: 'Генеральному прокурору\nвул. Різницька, 13/15\nм. Київ, 01011',
          sender_contacts: '[Вулиця, будинок, квартира]\n[Місто, індекс]\nтел.: [+38 0XX XXX XX XX]\nemail: [your@email.com]'
        },
        'Лист': {
          title: 'Щодо співпраці та надання інформації',
          body: 'Шановні колеги!\n\nЗвертаємося до вас із запитом про надання інформації щодо...\nБудемо вдячні за оперативну відповідь.',
          subject_type: 'legal'
        }
      }

      const tpl = templates[newType]
      if (tpl) {
        if (!form.title) form.title = tpl.title
        if (!form.body) form.body = tpl.body
        if (tpl.subject_type) form.subject_type = tpl.subject_type
        if (tpl.addressees && !form.addressees) form.addressees = tpl.addressees
        if (tpl.subject_type === 'person') {
          if (form.org_name === 'ДЕРЖАВНЕ ПІДПРИЄМСТВО «ДІЛОВОД»' || !form.org_name) {
            form.org_name = currentUser.value ? `Гр. ${currentUser.value.name}` : ''
          }
          applyPersonContacts(tpl.sender_contacts)
        }
      }
    }
  })

  /** Підставляє контакти заявника з профілю у form.sender_contacts.
   *  Викликається як при зміні виду документа, так і коли профіль дістався
   *  зі /auth/me (bootstrap-кеш localStorage міг бути без phone/address).
   *  Не затирає свідомі правки користувача — перезаписує лише порожнє поле,
   *  шаблон з [плейсхолдерами] або stale-рядок, якому бракує даних з профілю. */
  function applyPersonContacts(templateFallback?: string) {
    if (docStatus.value !== '' || form.subject_type !== 'person') return
    const u = currentUser.value
    const profile = buildContactsFromUser(u)
    const current = form.sender_contacts
    // поле порожнє або ще шаблонне (містить маркери [...])
    const isPlaceholder = !current || current.includes('[')
    // stale-стан: у полі немає телефону/адреси, які тепер є у профілі
    const staleVsProfile = !!profile && !!current && (
      (!!u?.phone && !current.includes(u.phone))
      || (!!u?.address && !current.includes((u.address!.split('\n')[0] || '').trim()))
    )
    if (profile && (isPlaceholder || staleVsProfile)) {
      form.sender_contacts = profile
    }
    else if (!current && templateFallback) {
      form.sender_contacts = templateFallback
    }
  }

  // Коли профіль користувача дочитується з /auth/me (після гідратації з кешу) —
  // оновлюємо контакти, якщо вони ще не заповнені реальними даними.
  watch(currentUser, () => applyPersonContacts(), { deep: true })
  const approverList = ref<ApproverEntry[]>([])
  const generating = ref(false)
  const submitting = ref(false)

  // UI-стан wizard'у
  const showFindings = ref(true)
  const showLegalDetails = ref(false)

  const isOrder = computed(() => !!form.doc_type?.startsWith('Наказ'))

  // --- wizard computed ---
  const stepperItems = computed<StepperItem[]>(() => {
    const steps: StepperItem[] = [
      { title: 'Документ', description: 'картка та реквізити', icon: 'i-lucide-file-text', value: 'document' },
      { title: 'Перевірка', description: 'ДСТУ 4163 + НПА', icon: 'i-lucide-clipboard-check', value: 'validation' },
      { title: 'Погодження', description: 'візування та лист', icon: 'i-lucide-users', value: 'approval' },
      { title: 'Підписання', description: 'черга та КЕП', icon: 'i-lucide-pen-tool', value: 'signing' }
    ]
    if (!isOrder.value) {
      steps.push({ title: 'Відправлення', description: 'ASiC-E контейнер', icon: 'i-lucide-send', value: 'delivery' })
    }
    return steps
  })

  const activeStepIndex = computed(() => {
    const st = docStatus.value
    if (st === 'signed') return isOrder.value ? 3 : 4
    if (signerList.value.length > 0 || st === 'pending_signatures' || st === 'rejected') return 3
    if (st === 'pending_approval') return 2
    if (report.value || st === 'generated') return 1
    return 0
  })

  const statusBadge = computed<{ label: string, color: UiColor, icon: string }>(() => {
    const st = docStatus.value
    if (st === 'signed') return { label: 'Підписано', color: 'success', icon: 'i-lucide-circle-check' }
    if (st === 'pending_signatures' || st === 'pending') return { label: 'Очікує підпису', color: 'warning', icon: 'i-lucide-clock' }
    if (st === 'pending_approval') return { label: 'На погодженні', color: 'warning', icon: 'i-lucide-users' }
    if (st === 'rejected') return { label: 'Помилка підпису', color: 'error', icon: 'i-lucide-circle-alert' }
    if (creatingDoc.value === false && report.value && !report.value.compliant) {
      return { label: 'Є зауваження', color: 'warning', icon: 'i-lucide-triangle-alert' }
    }
    return { label: 'Чернетка', color: 'neutral', icon: 'i-lucide-circle-dashed' }
  })

  /** Чи заблокована форма для редагування поточним користувачем.
   *  Лочимо все крім draft (pending_approval/pending_signatures/signed/published).
   *  admin — обхід (службова дія). Задається через useRoles — не дублюємо тут логіку ролей. */
  const isLocked = computed(() => {
    const { isDocLocked } = useRoles()
    return isDocLocked(docStatus.value)
  })

  const docFormatLabel = computed(() => {
    if (selectedIsScanned.value) return 'Скан-копія PDF'
    return form.fmt === 'docx' ? 'DOCX-документ' : 'PDF-документ'
  })

  const signerTimeline = computed<TimelineItem[]>(() =>
    signerList.value.map((s, i) => {
      const isSeal = s.signer_type === 'seal'
      // печатка юрособи — окремий набір іконок (штамп), щоб відрізнити від КЕП особи
      const icon = s.status === 'signed'
        ? (isSeal ? 'i-lucide-stamp' : 'i-lucide-circle-check')
        : s.status === 'rejected'
          ? 'i-lucide-circle-x'
          : (isSeal ? 'i-lucide-stamp' : 'i-lucide-clock')
      return {
        title: `#${i + 1} ${s.name}`,
        // печатка: підкреслюємо, що це юрособа, а не ПІБ особи
        description: isSeal
          ? `Електронна печатка юрособи${s.organization ? ` · ${s.organization}` : ''}${s.position ? ` · ${s.position}` : ''}`
          : s.position,
        icon,
        value: String(i)
      }
    })
  )

  const STEP_SECTION_IDS = ['sec-document', 'sec-validation', 'sec-approval', 'sec-signing', 'sec-delivery']
  function scrollToStep(v: string | number | undefined) {
    const idx = typeof v === 'number' ? v : Number(v)
    if (Number.isNaN(idx)) return
    const id = STEP_SECTION_IDS[idx]
    if (id) {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // --- дії над формою ---
  function buildPayload() {
    const signerLines = form.signerUsers.map((u, i) => ({
      full_name: u.full_name,
      position: u.position,
      order_index: i,
      // тип підписанта: person (КЕП особи) | seal (електронна печатка юрособи).
      // Дефолт 'person' — зворотна сумісність (старі підписанти без типу).
      signer_type: u.signer_type ?? 'person'
    }))
    const approvers = form.approverUsers.map((u, i) => ({
      order_index: i,
      user_id: u.user_id,
      full_name: u.full_name,
      position: u.position
    }))
    return {
      doc_id: form.doc_id,
      org_name: form.org_name,
      subject_type: form.subject_type,
      doc_type: form.doc_type,
      fmt: form.fmt,
      title: form.title,
      date_text: form.date_text,
      reg_index: form.reg_index,
      place: form.place,
      body: form.body.split('\n').filter(Boolean),
      addressees: form.addressees ? form.addressees.split('\n').filter(Boolean) : [],
      sender_contacts: form.sender_contacts || '',
      signers: signerLines,
      journal_id: form.journal_id ? Number(form.journal_id) : null,
      approval_type: form.approval_type,
      approvers: approvers,
      pagination_barcode: !!form.pagination_barcode,
      use_stamp: form.stamp_type !== 'none',
      stamp_type: form.stamp_type === 'none' ? '' : (form.stamp_type || ''),
      use_incoming_stamp: !!form.use_incoming_stamp,
      use_copy_stamp: !!form.use_copy_stamp,
      use_control_stamp: !!form.use_control_stamp,
      restriction_stamp: form.restriction_stamp === 'none' ? '' : (form.restriction_stamp || ''),
      use_copy_mark: !!form.use_copy_mark,
      use_archived_stamp: !!form.use_archived_stamp,
      use_annulled_stamp: !!form.use_annulled_stamp,
      use_urgent_stamp: !!form.use_urgent_stamp,
      extra_stamps: form.extra_stamps || []
    }
  }

  function resetFormForNew() {
    selectedIsScanned.value = false
    form.doc_id = genDocId(form.doc_type || 'Наказ')
    form.title = ''
    form.reg_index = ''
    form.body = ''
    form.addressees = ''
    form.sender_contacts = ''
    form.signers = ''
    form.signerUsers = []
    form.journal_id = null
    form.approval_type = 'sequential'
    form.approverUsers = []
    form.pagination_barcode = false
    form.use_stamp = false
    form.stamp_type = 'none'
    form.use_incoming_stamp = false
    form.use_copy_stamp = false
    form.use_control_stamp = false
    form.restriction_stamp = 'none'
    form.use_copy_mark = false
    form.use_archived_stamp = false
    form.use_annulled_stamp = false
    form.use_urgent_stamp = false
    form.extra_stamps = []
    report.value = null
    pdfaInfo.value = null
    docStatus.value = ''
    signerList.value = []
    approverList.value = []
  }

  /** Заповнити форму повними даними документа (з GET /documents/{id}). */
  function applyDocToForm(full: {
    doc_id: string; title: string; doc_type: string; status: string; fmt: string
    signers: Array<{ full_name: string; position: string; status: string; signer_type?: string | null; organization?: string | null; identifier?: string | null }>
    content_json?: unknown
    reg_index?: string
    reg_date?: string
    is_scanned?: boolean
    journal_id?: number | null
    approval_type?: string | null
    approvers?: Array<{ order_index: number; user_id?: number | null; full_name: string; position: string; status: string; comment?: string | null; approved_at?: string | null }>
  }) {
    form.doc_id = full.doc_id
    form.title = full.title
    form.doc_type = full.doc_type || ''
    form.fmt = full.fmt ?? 'pdf'
    form.signers = full.signers.map(s => `${s.full_name} | ${s.position}`).join('\n')
    form.signerUsers = full.signers.map(s => ({
      user_id: (s as any).user_id ?? null,
      full_name: s.full_name,
      position: s.position,
      // дефолт 'person' — зворотна сумісність (старі документи без signer_type)
      signer_type: (s.signer_type === 'seal' ? 'seal' : 'person')
    }))
    form.journal_id = full.journal_id ?? null
    form.approval_type = (full.approval_type as any) ?? 'sequential'
    form.approverUsers = full.approvers
      ? full.approvers
          .filter(a => (a as any).user_id)
          .map(a => ({ user_id: (a as any).user_id as number, full_name: a.full_name, position: a.position }))
      : []
    
    const cj = (full as Record<string, unknown>).content_json as Record<string, unknown> | undefined
    if (cj) {
      form.org_name = String(cj.org_name ?? form.org_name)
      form.subject_type = String(cj.subject_type ?? form.subject_type)
      form.date_text = String(cj.date_text ?? '')
      form.reg_index = String(cj.reg_index ?? '')
      form.place = String(cj.place ?? '')
      // doc_type до реєстрації живе лише в content_json (колонка doc_type — null),
      // тож читаємо звідти з фолбеком на колонку.
      if (cj.doc_type) form.doc_type = String(cj.doc_type)
      form.pagination_barcode = !!cj.pagination_barcode
      form.use_stamp = !!cj.use_stamp
      form.stamp_type = String(cj.stamp_type ?? '') || (cj.use_stamp ? 'documents' : 'none')
      form.use_incoming_stamp = !!cj.use_incoming_stamp
      form.use_copy_stamp = !!cj.use_copy_stamp
      form.use_control_stamp = !!cj.use_control_stamp
      form.restriction_stamp = String(cj.restriction_stamp ?? '') || 'none'
      form.use_copy_mark = !!cj.use_copy_mark
      form.use_archived_stamp = !!cj.use_archived_stamp
      form.use_annulled_stamp = !!cj.use_annulled_stamp
      form.use_urgent_stamp = !!cj.use_urgent_stamp
      form.extra_stamps = Array.isArray(cj.extra_stamps) ? cj.extra_stamps.map(String) : []
      const b = cj.body
      form.body = Array.isArray(b) ? b.join('\n') : String(b ?? '')
      const addrs = cj.addressees
      form.addressees = Array.isArray(addrs) ? addrs.join('\n') : String(addrs ?? '')
      form.sender_contacts = String(cj.sender_contacts ?? '')
    }
    const fr = full as Record<string, unknown>
    if (fr.reg_index) form.reg_index = String(fr.reg_index)
    if (fr.reg_date) form.date_text = String(fr.reg_date)
    selectedIsScanned.value = Boolean(fr.is_scanned)
    docStatus.value = full.status
    signerList.value = full.signers.map(s => ({
      name: s.full_name,
      position: s.position,
      status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending',
      signer_type: (s.signer_type === 'seal' ? 'seal' : 'person') as 'person' | 'seal',
      organization: s.organization ?? null,
      identifier: s.identifier ?? null
    }))
    approverList.value = full.approvers ? full.approvers.map(a => ({
      order_index: a.order_index,
      user_id: (a as any).user_id ?? null,
      full_name: a.full_name,
      position: a.position,
      status: a.status as any,
      comment: (a as any).comment,
      approved_at: (a as any).approved_at
    })) : []
  }

  async function downloadAsice() {
    const url = `${useRuntimeConfig().public.apiBase}/documents/${form.doc_id}/download/asice`
    window.open(url, '_blank')
  }

  async function submitDoc() {
    submitting.value = true
    try {
      const res = await apiFetch<{
        status: string
        reg_index?: string
        reg_date?: string
        signers: Array<{ full_name: string; position: string; status: string; signer_type?: string | null }>
      }>(
        `/documents/${form.doc_id}/submit`,
        { method: 'POST', body: { auto_register: autoRegister.value } }
      )
      docStatus.value = res.status
      if (res.reg_index) form.reg_index = res.reg_index
      if (res.reg_date) form.date_text = res.reg_date
      // зберігаємо signer_type (беремо з поточного signerList — бекенд submit не
      // повертає організацію, лише статус черги; тип не змінюється при подачі)
      signerList.value = res.signers.map((s, i) => ({
        name: s.full_name,
        position: s.position,
        status: s.status === 'signed' ? 'signed' : s.status === 'rejected' ? 'rejected' : 'pending',
        signer_type: (s.signer_type === 'seal'
          ? 'seal'
          : signerList.value[i]?.signer_type ?? 'person') as 'person' | 'seal',
        organization: signerList.value[i]?.organization ?? null,
        identifier: signerList.value[i]?.identifier ?? null
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

  function setReport(conf: {
    conforms?: boolean; compliant?: boolean
    findings_count?: number; rules_passed?: number
    results?: Array<{ rule_id: string; conforms: boolean; findings: Array<{ message: string }> }>
    findings?: Array<{ rule: string; message: string }>
  } | null) {
    if (!conf) {
      report.value = null
      return
    }
    report.value = {
      compliant: conf.compliant ?? conf.conforms ?? false,
      rules_passed: conf.rules_passed ?? (conf.results?.filter(x => x.conforms).length ?? 0),
      findings: conf.findings ?? (conf.results
        ?.filter(x => !x.conforms)
        .flatMap(x => x.findings.map(f => ({ rule: x.rule_id, message: f.message }))) ?? [])
    }
  }

  return {
    creatingDoc,
    form,
    autoRegister,
    report,
    pdfaInfo,
    docStatus,
    selectedIsScanned,
    signerList,
    approverList,
    generating,
    submitting,
    showFindings,
    showLegalDetails,
    isOrder,
    stepperItems,
    activeStepIndex,
    statusBadge,
    isLocked,
    docFormatLabel,
    signerTimeline,
    scrollToStep,
    buildPayload,
    resetFormForNew,
    applyDocToForm,
    submitDoc,
    downloadAsice,
    setReport
  }
}

export type DocFormStore = ReturnType<typeof useDocForm>
