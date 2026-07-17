import type { Ref } from 'vue'
import type { DocForm, SignerEntry, DocEntry } from './types'

/**
 * Підпис КЕП (EUSign WASM / віджет ІІТ).
 *
 * Module-scope стан (euSignFactory/euWidget/widgetInited) піднято нагору:
 * сторінка /dashboard має ssr:false, тож синглтон безпечний; у тілі composable
 * він не скидався б на кожен виклик.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let euSignFactory: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let euWidget: any = null
let widgetInited = false

export function useEuSign(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
  token: Ref<string | null>
  form: DocForm
  signerList: Ref<SignerEntry[]>
  selectDoc: (doc: DocEntry) => Promise<void>
  refreshAll: () => Promise<void>
}) {
  const toast = useToast()
  const { apiFetch, token, form, signerList, selectDoc, refreshAll } = deps

  const euReady = ref(false)
  const euStatus = ref('Завантаження бібліотеки EUSign…')
  const keySource = ref<'file' | 'token'>('file')
  const keyPass = ref('')
  const keyFile = ref<File | null>(null)
  const caList = ref<Array<{ title: string }>>([])
  const caIndex = ref(0)
  const signing = ref(false)
  const signStep = ref('')

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
        headers: { Authorization: `Bearer ${token.value ?? ''}` }
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
      }
      else {
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
    }
    catch (e) {
      euStatus.value = `Помилка ініціалізації віджета: ${e}`
    }
  }

  function onKeyFile(file: File) {
    if (euSignFactory) euSignFactory.setPrivateKeyFile(file)
    keyFile.value = file
  }

  /** Bootstrap EUSign: інжект /eusign.js + dynamic import euscpfactory.js. Перенесено з onMounted. */
  async function bootstrap() {
    // завантажуємо eusign.js (EndUser widget helper) динамічно
    await new Promise<void>((resolve) => {
      if ((window as unknown as { EndUser?: unknown }).EndUser) { resolve(); return }
      const s = document.createElement('script')
      s.src = '/eusign.js'
      s.onload = () => resolve()
      s.onerror = () => resolve()
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
    }
    catch (err) {
      euStatus.value = `Не вдалося завантажити EUSign: ${err} — підпис недоступний, решта порталу працює.`
    }
  }

  async function signAttachmentFile(att: any, packAsic?: 'asice' | 'asics') {
    if (!euReady.value && keySource.value === 'file') {
      toast.add({ title: 'EUSign не готовий', description: 'Будь ласка, завантажте файл ключа та введіть пароль.', color: 'warning' })
      return
    }
    signing.value = true
    signStep.value = 'key'
    try {
      const apiBase = useRuntimeConfig().public.apiBase
      // 1. Завантажуємо байти додатка
      const attRes = await fetch(`${apiBase}/documents/${form.doc_id}/attachments/${att.id}`, {
        headers: { Authorization: `Bearer ${token.value ?? ''}` }
      })
      if (!attRes.ok) throw new Error('Не вдалося завантажити файл додатка: ' + await attRes.text())
      const fileBlob = await attRes.blob()
      const fileBytes = new Uint8Array(await fileBlob.arrayBuffer())

      let cmsB64: string
      if (keySource.value === 'token') {
        if (!euWidget) throw new Error('Віджет апаратного токена не ініціалізовано')
        await euWidget.ReadPrivateKey()
        signStep.value = 'sign'
        const EU = (window as any).EndUser
        cmsB64 = await euWidget.SignData(
          fileBytes,
          true, // external/detached = true
          true, // asBase64String = true
          EU.SignAlgo.DSTU4145WithGOST34311,
          null,
          EU.SignType.CAdES_BES
        )
      } else {
        if (!euSignFactory) throw new Error('Модуль EUSign не завантажено')
        euSignFactory.setCASettings(caIndex.value >= 0 ? caIndex.value : -1)
        euSignFactory.pkFilePassword = keyPass.value
        euSignFactory.pkFileItemIndex = -1
        euSignFactory.readPrivateKeyButtonClick()
        if (!euSignFactory.pkReaded) throw new Error('Не вдалося зчитати ключ. Перевірте пароль та обраний файл.')

        signStep.value = 'sign'
        // Другий параметр false — detached-підпис (.p7s)
        cmsB64 = euSignFactory.signData(fileBytes, false, true, 'def')
      }

      if (!cmsB64) throw new Error('Підпис порожній')

      if (packAsic) {
        // 2a. Надсилаємо на бекенд для пакування в ASiC-S / ASiC-E
        signStep.value = 'send'
        const packRes = await fetch(`${apiBase}/documents/${form.doc_id}/attachments/${att.id}/pack-asic`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token.value ?? ''}`
          },
          body: JSON.stringify({ signature_b64: cmsB64, type: packAsic })
        })
        if (!packRes.ok) throw new Error('Помилка формування ASiC: ' + await packRes.text())
        const asicBlob = await packRes.blob()
        const url = window.URL.createObjectURL(asicBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${att.original_filename || att.stored_filename}.${packAsic}`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        toast.add({ title: `Контейнер ${packAsic.toUpperCase()} успішно завантажено`, color: 'success' })
      } else {
        // 2b. Створюємо файл підпису та ініціюємо завантаження
        const rawCms = Uint8Array.from(atob(cmsB64), c => c.charCodeAt(0))
        const sigBlob = new Blob([rawCms], { type: 'application/pkcs7-signature' })
        const url = window.URL.createObjectURL(sigBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${att.original_filename || att.stored_filename}.p7s`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)

        toast.add({ title: 'Підпис успішно створено', description: 'Файл .p7s завантажено на ваш пристрій', color: 'success' })
      }
    } catch (e: any) {
      toast.add({ title: 'Помилка підписання файлу', description: e.message || String(e), color: 'error' })
    } finally {
      signStep.value = ''
      signing.value = false
    }
  }

  return {
    euReady,
    euStatus,
    keySource,
    keyPass,
    keyFile,
    caList,
    caIndex,
    signing,
    signStep,
    signCurrent,
    signAttachmentFile,
    initWidget,
    onKeyFile,
    bootstrap
  }
}
