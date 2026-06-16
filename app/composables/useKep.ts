import { ref, nextTick } from 'vue'

let euSignFactory: any = null
let euWidget: any = null
let widgetInited = false

export function useKep() {
  const toast = useToast()
  const euReady = ref(false)
  const euStatus = ref('Завантаження бібліотеки EUSign…')
  const keySource = ref<'file' | 'token'>('file')
  const keyPass = ref('')
  const keyFile = ref<File | null>(null)
  const caList = ref<Array<{ title: string }>>([])
  const caIndex = ref(0)
  const signing = ref(false)
  const signStep = ref('')

  // Считывание ключа и подпись переданной строки
  async function signData(data: string): Promise<string> {
    signing.value = true
    signStep.value = 'key'
    try {
      let cmsB64: string

      if (keySource.value === 'token') {
        if (!euWidget) throw new Error('апаратний віджет не ініціалізовано')
        await euWidget.ReadPrivateKey()
        signStep.value = 'sign'
        const EU = (window as any).EndUser
        cmsB64 = await euWidget.SignData(
          data, true, true,
          EU.SignAlgo.DSTU4145WithGOST34311, null,
          EU.SignType.CAdES_X_Long
        )
      } else {
        if (!euSignFactory) throw new Error('модуль EUSign не завантажено')
        if (!keyFile.value) throw new Error('оберіть файл ключа')
        if (!keyPass.value) throw new Error('введіть пароль захисту ключа')

        euSignFactory.setPrivateKeyFile(keyFile.value)
        euSignFactory.setCASettings(caIndex.value >= 0 ? caIndex.value : -1)
        euSignFactory.pkFilePassword = keyPass.value
        euSignFactory.pkFileItemIndex = -1
        euSignFactory.readPrivateKeyButtonClick()
        
        if (!euSignFactory.pkReaded) {
          throw new Error('не вдалося прочитати ключ — перевірте пароль')
        }
        
        signStep.value = 'sign'
        const dataBytes = new TextEncoder().encode(data)
        // Второй параметр false — означает detached-подпись (как требуется для проверки челенджа)
        cmsB64 = euSignFactory.signData(dataBytes, false, true, 'def')
      }

      if (!cmsB64) throw new Error('підпис порожній')
      return cmsB64
    } finally {
      signing.value = false
      signStep.value = ''
    }
  }

  async function initWidget() {
    if (widgetInited) return
    await nextTick()
    const EU = (window as any).EndUser
    if (typeof EU === 'undefined') {
      euStatus.value = 'eusign.js не завантажено — оновіть сторінку'
      return
    }
    const parent = document.getElementById('kep-widget-parent')
    if (!parent) {
      euStatus.value = 'Контейнер віджета не знайдено'
      return
    }
    try {
      euWidget = new EU(
        'kep-widget-parent', 'kep-widget',
        'https://eu.iit.com.ua/sign-widget/v20200922/',
        EU.FormType.ReadPKey
      )
      widgetInited = true
    } catch (e) {
      euStatus.value = `Помилка ініціалізації віджета: ${e}`
    }
  }

  function onKeyFile(file: File) {
    if (euSignFactory) euSignFactory.setPrivateKeyFile(file)
    keyFile.value = file
  }

  async function bootstrap() {
    // 1. Завантажуємо eusign.js
    await new Promise<void>((resolve) => {
      if ((window as any).EndUser) { resolve(); return }
      const s = document.createElement('script')
      s.src = '/eusign.js'
      s.onload = () => resolve()
      s.onerror = () => resolve()
      document.head.appendChild(s)
    })

    // 2. Завантажуємо euscpfactory.js
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
          euStatus.value = 'EUSign готовий. Оберіть файл ключа або токен.'
        }
      }, 400)
    } catch (err) {
      euStatus.value = `Помилка завантаження WASM КЕП: ${err}`
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
    signData,
    initWidget,
    onKeyFile,
    bootstrap
  }
}
