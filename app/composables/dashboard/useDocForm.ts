import type { StepperItem, TimelineItem } from '@nuxt/ui'
import type { DocForm, PdfaInfo, SignerEntry, ApproverEntry, ApproverUser, SignerUser, ValidationReport, UiColor } from './types'
import { genDocId, buildContactsFromUser, DOC_TYPE_PREFIX, DOC_DEFAULT_TEMPLATES } from './docTemplates'
import { buildDocPayload, resetFormState, applyDocResponseToForm } from './docFormTransformers'

/**
 * Стан картки документа + валідація + черга підписання.
 */
export function useDocForm(apiFetch: ReturnType<typeof useAuth>['apiFetch']) {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const { handwritten } = useReaderPrefs()

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
    use_handwritten_date_index: handwritten.value,
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
  const approverList = ref<ApproverEntry[]>([])
  const generating = ref(false)
  const submitting = ref(false)

  // UI-стан wizard'у
  const showFindings = ref(true)
  const showLegalDetails = ref(false)

  // Автоматичне підставлення шаблону при виборі виду документа для нової картки
  watch(() => form.doc_type, (newType) => {
    if (docStatus.value === '') {
      if (DOC_TYPE_PREFIX[newType]) {
        form.doc_id = genDocId(newType)
      }
      
      const tpl = DOC_DEFAULT_TEMPLATES[newType]
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

  function applyPersonContacts(templateFallback?: string) {
    if (docStatus.value !== '' || form.subject_type !== 'person') return
    const u = currentUser.value
    const profile = buildContactsFromUser(u)
    const current = form.sender_contacts
    const isPlaceholder = !current || current.includes('[')
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

  watch(currentUser, () => applyPersonContacts(), { deep: true })

  const isOrder = computed(() => !!form.doc_type?.startsWith('Наказ'))

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
      const icon = s.status === 'signed'
        ? (isSeal ? 'i-lucide-stamp' : 'i-lucide-circle-check')
        : s.status === 'rejected'
          ? 'i-lucide-circle-x'
          : (isSeal ? 'i-lucide-stamp' : 'i-lucide-clock')
      return {
        title: `#${i + 1} ${s.name}`,
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

  function buildPayload() {
    return buildDocPayload(form)
  }

  function resetFormForNew() {
    selectedIsScanned.value = false
    resetFormState(form, handwritten.value, genDocId(form.doc_type || 'Наказ'))
    report.value = null
    pdfaInfo.value = null
    docStatus.value = ''
    signerList.value = []
    approverList.value = []
  }

  function applyDocToForm(full: any) {
    const res = applyDocResponseToForm(form, full)
    selectedIsScanned.value = res.isScanned
    docStatus.value = res.status
    signerList.value = res.signerList
    approverList.value = res.approverList
  }

  async function downloadAsice() {
    const { token } = useAuth()
    const url = `${useRuntimeConfig().public.apiBase}/documents/${form.doc_id}/download/asice?token=${token.value ?? ''}`
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
