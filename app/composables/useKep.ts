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
  // Сертифікати/ключі всередині контейнера (.jks з кількома ключами; .p12 — один).
  // Для контейнерів ДІЯ/тестових, де є підпис + TLS — даємо обрати потрібний.
  const keyItemList = ref<Array<{ title: string }>>([])
  const keyItemIndex = ref(0)
  // Сертифікати відкритого ключа окремими файлами (.cer) — для офлайн-режиму,
  // коли EUSign не може дотягнути сертифікат з КНЕДП (CMP недоступний). Це
  // типовий випадок для тестових ключів: ключ .p12 + сертифікат .cer поруч.
  const certFiles = ref<File[]>([])
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
        // Якщо користувач додав сертифікати окремими файлами (.cer) — це офлайн-
        // режим: сертифікат не дотягується з КНЕДП (помилка 51), а береться з
        // файлу. EUSign у getPrivateKeyCertificates перевіряє useCMP РАНІШЕ за
        // loadPKCertsFromFile, тож вимикаємо обидва прапорці CMP і вмикаємо читання
        // сертифіката з privateKeyCerts.
        if (certFiles.value.length > 0) {
          euSignFactory.privateKeyCerts = certFiles.value
          euSignFactory.loadPKCertsFromFile = true
          euSignFactory.useCMP = false
        } else {
          euSignFactory.privateKeyCerts = null
          euSignFactory.loadPKCertsFromFile = false
        }
        // .p12/.jks-контейнер може містити кілька ключів (напр. тестовий ДІЯ —
        // підпис + TLS). pkFileItemIndex вказує індекс: -1 = перший, але для
        // контейнерів з кількома ключами обираємо сертифікат підпису ( index 0 ).
        // Якщо pkFileDataArray присутній (jks) — беремо перший сертифікат підпису.
        if (Array.isArray(euSignFactory.pkFileDataArray) && euSignFactory.pkFileDataArray.length > 0) {
          euSignFactory.pkFileItemIndex = keyItemIndex.value >= 0
            ? keyItemIndex.value
            : 0
        } else {
          euSignFactory.pkFileItemIndex = -1
        }
        euSignFactory.readPrivateKeyButtonClick()

        if (!euSignFactory.pkReaded) {
          throw new Error('не вдалося прочитати ключ — перевірте пароль та КНЕДП')
        }

        signStep.value = 'sign'
        const dataBytes = new TextEncoder().encode(data)
        // Другий параметр false — detached-підпис (для перевірки челенджу)
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
    // setPrivateKeyFile асинхронно парсить контейнер і викликає
    // onChangePrivateKeyFile → keyItemList оновиться (для jks з кількома ключами)
    if (euSignFactory) euSignFactory.setPrivateKeyFile(file)
    else keyItemList.value = []
    keyFile.value = file
  }

  function onCertFile(file: File) {
    certFiles.value = [...certFiles.value.filter((f) => f.name !== file.name), file]
  }

  function removeCertFile(name: string) {
    certFiles.value = certFiles.value.filter((f) => f.name !== name)
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
      // Коли EUSign зчитує файл контейнера — він заповнює pkFileDataArray (для
      // jks/keystore з кількома ключами). Оновлюємо список для вибору користувачем.
      euSignFactory.onChangePrivateKeyFile = () => {
        const arr = euSignFactory?.pkFileDataArray
        if (Array.isArray(arr) && arr.length) {
          keyItemList.value = arr.map((k: any) => ({ title: k.alias || k.title || `Ключ ${arr.indexOf(k) + 1}` }))
          keyItemIndex.value = 0
        } else {
          keyItemList.value = []
        }
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
    keyItemList,
    keyItemIndex,
    certFiles,
    signing,
    signStep,
    signData,
    initWidget,
    onKeyFile,
    onCertFile,
    removeCertFile,
    bootstrap
  }
}
