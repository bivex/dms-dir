<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useKep } from '~/composables/useKep'
import { useReaderPrefs } from '~/composables/useReaderPrefs'
import { onMounted, onBeforeUnmount, ref, computed } from 'vue'

const store = useDashboard()
const auth = useAuth()
const kep = useKep()
const { handwritten, toggleHandwritten } = useReaderPrefs()
const toast = useToast()
const loading = ref(false)

// Тип сертифіката, що прив'язується/відв'язується: КЕП особи чи печатка юрособи.
// Технічно обидва — той самий ReadPrivateKey + signData(challenge); різниця лише
// у сертифікаті (QC eSign / eSeal), бекенд розрізняє по cert_type.
const certType = ref<'esign' | 'eseal'>('esign')

// Готовимо КЕП при відкритті модалки
onMounted(async () => {
  await kep.bootstrap()
})

// Прив'язати сертифікат (КЕП особи або печатку юрособи)
async function onLinkCert() {
  loading.value = true
  try {
    // 1. Отримуємо челендж
    const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8000'
    const { challenge } = await $fetch<{ challenge: string }>(`${apiBase}/auth/challenge`)

    // 2. Підписуємо його через КЕП (той самий потік для КЕП і печатки)
    const sigB64 = await kep.signData(challenge)

    // 3. Відправляємо на привязку з cert_type
    const res = await auth.apiFetch<{ status: string; cert_type?: string; user: any }>('/auth/link-kep', {
      method: 'POST',
      body: { challenge, signature_b64: sigB64 }
    })

    // 4. Оновлюємо користувача в сесії
    auth.user.value = res.user
    localStorage.setItem('dilovod_user', JSON.stringify(res.user))

    const label = certType.value === 'eseal' ? 'Печатку юрособи' : 'КЕП'
    toast.add({ title: `${label} успішно привʼязано`, color: 'success' })
  }
  catch (err: any) {
    const msg = err.data?.detail || err.message || 'Помилка привʼязки'
    toast.add({ title: 'Помилка привʼязки', description: msg, color: 'error' })
  }
  finally {
    loading.value = false
  }
}

// Відв'язати сертифікат вказаного типу
async function onUnlinkCert(type: 'esign' | 'eseal') {
  loading.value = true
  try {
    const res = await auth.apiFetch<{ status: string; user: any }>('/auth/unlink-kep', {
      method: 'POST',
      body: { cert_type: type }
    })

    const updatedUser = res.user ?? auth.user.value
    if (updatedUser) {
      if (type === 'eseal') {
        updatedUser.organization_cert_cn = null
      }
      else {
        updatedUser.kep_serial_number = null
        updatedUser.kep_certificate_serial = null
        updatedUser.kep_subject_cn = null
      }
      auth.user.value = updatedUser
      localStorage.setItem('dilovod_user', JSON.stringify(updatedUser))
    }

    const label = type === 'eseal' ? 'Печатку' : 'КЕП'
    toast.add({ title: `${label} успішно відвʼязано`, color: 'success' })
  }
  catch (err: any) {
    toast.add({ title: 'Помилка відвʼязування', description: err.message, color: 'error' })
  }
  finally {
    loading.value = false
  }
}

const fileInput = ref<HTMLInputElement | null>(null)
const facsimileVersion = ref(0)

const facsimileUrl = computed(() => {
  const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8000'
  const token = auth.token.value ? encodeURIComponent(auth.token.value) : ''
  return `${apiBase}/users/me/facsimile?token=${token}&v=${facsimileVersion.value}`
})

function triggerFileInput() {
  fileInput.value?.click()
}

const selectedFile = ref<File | null>(null)
const localPreviewUrl = ref<string | null>(null)

onBeforeUnmount(() => {
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
})

function onFacsimileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  selectedFile.value = file
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
  localPreviewUrl.value = URL.createObjectURL(file)
  if (fileInput.value) fileInput.value.value = ''
}

function cancelLocalSelection() {
  selectedFile.value = null
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
    localPreviewUrl.value = null
  }
}

async function uploadLocalFacsimile() {
  if (!selectedFile.value) return
  loading.value = true
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8000'
    const res = await $fetch<any>(`${apiBase}/users/me/facsimile`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(auth.token.value ? { Authorization: `Bearer ${auth.token.value}` } : {})
      }
    })

    // Оновлюємо користувача в сесії
    if (auth.user.value) {
      auth.user.value.has_facsimile = true
      localStorage.setItem('dilovod_user', JSON.stringify(auth.user.value))
    }
    facsimileVersion.value++
    toast.add({ title: 'Факсиміле успішно завантажено', color: 'success' })
    cancelLocalSelection()
  }
  catch (err: any) {
    const msg = err.data?.detail || err.message || 'Помилка завантаження'
    toast.add({ title: 'Помилка завантаження', description: msg, color: 'error' })
  }
  finally {
    loading.value = false
  }
}

async function onDeleteFacsimile() {
  loading.value = true
  try {
    const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8000'
    await $fetch<any>(`${apiBase}/users/me/facsimile`, {
      method: 'DELETE',
      headers: {
        ...(auth.token.value ? { Authorization: `Bearer ${auth.token.value}` } : {})
      }
    })

    // Оновлюємо користувача в сесії
    if (auth.user.value) {
      auth.user.value.has_facsimile = false
      localStorage.setItem('dilovod_user', JSON.stringify(auth.user.value))
    }
    toast.add({ title: 'Факсиміле успішно видалено', color: 'success' })
  }
  catch (err: any) {
    const msg = err.data?.detail || err.message || 'Помилка видалення'
    toast.add({ title: 'Помилка видалення', description: msg, color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal v-model:open="store.kepModalOpen.value" :ui="{ content: 'max-w-3xl w-full' }">
    <template #content>
      <div class="p-6 space-y-5">
        <!-- Заголовок -->
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-key-round" class="text-primary text-lg" />
          <span>Сертифікати підписання</span>
        </div>

        <USeparator />

        <!-- Поточна прив'язка: КЕП особи + печатка юрособи + факсимиле — поруч горизонтально -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- КЕП особи -->
          <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-default text-sm flex flex-col justify-between">
            <div>
              <div class="font-medium text-xs text-muted uppercase flex items-center gap-1.5 mb-2">
                <UIcon name="i-lucide-user" /> КЕП особи
              </div>

              <div v-if="auth.user.value?.kep_serial_number" class="space-y-1">
                <div class="flex items-center gap-1.5 text-success font-medium">
                  <UIcon name="i-lucide-check-circle" />
                  <span>Прив'язаний</span>
                </div>
                <div class="text-xs text-muted">
                  <span class="font-medium text-default">Суб'єкт (CN):</span> {{ auth.user.value.kep_subject_cn }}
                </div>
                <div class="text-xs text-muted">
                  <span class="font-medium text-default">РНОКПП (ІПН):</span> {{ auth.user.value.kep_serial_number }}
                </div>
                <div class="text-xs text-muted break-all">
                  <span class="font-medium text-default">Сер. №:</span>
                  <span class="font-mono text-[10px]">{{ auth.user.value.kep_certificate_serial }}</span>
                </div>
              </div>

              <div v-else class="text-muted flex items-start gap-2 text-xs leading-relaxed">
                <UIcon name="i-lucide-info" class="flex-shrink-0 mt-0.5" />
                <span>КЕП не прив'язаний. Вхід без пароля недоступний.</span>
              </div>
            </div>

            <div v-if="auth.user.value?.kep_serial_number" class="pt-2">
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="loading" @click="onUnlinkCert('esign')">
                Відв'язати КЕП
              </UButton>
            </div>
          </div>

          <!-- Печатка юрособи -->
          <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-default text-sm flex flex-col justify-between">
            <div>
              <div class="font-medium text-xs text-muted uppercase flex items-center gap-1.5 mb-2">
                <UIcon name="i-lucide-stamp" /> Печатка юрособи
              </div>

              <div v-if="auth.user.value?.organization_cert_cn" class="space-y-1">
                <div class="flex items-center gap-1.5 text-success font-medium">
                  <UIcon name="i-lucide-check-circle" />
                  <span>Прив'язана</span>
                </div>
                <div class="text-xs text-muted break-all">
                  <span class="font-medium text-default">Юрособа (CN):</span> {{ auth.user.value.organization_cert_cn }}
                </div>
              </div>

              <div v-else class="text-muted flex items-start gap-2 text-xs leading-relaxed">
                <UIcon name="i-lucide-info" class="flex-shrink-0 mt-0.5" />
                <span>Печатка не прив'язана. Накладання печатки юрособи недоступне.</span>
              </div>
            </div>

            <div v-if="auth.user.value?.organization_cert_cn" class="pt-2">
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="loading" @click="onUnlinkCert('eseal')">
                Відв'язати печатку
              </UButton>
            </div>
          </div>

          <!-- Факсиміле підпису -->
          <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-default text-sm flex flex-col justify-between">
            <div>
              <div class="font-medium text-xs text-muted uppercase flex items-center gap-1.5 mb-2">
                <UIcon name="i-lucide-signature" /> Факсиміле підпису
              </div>

              <div v-if="auth.user.value?.has_facsimile" class="space-y-2">
                <div class="flex items-center gap-1.5 text-success font-medium">
                  <UIcon name="i-lucide-check-circle" />
                  <span>Завантажено</span>
                </div>
                <!-- Зображення-прев'ю факсиміле -->
                <div class="border border-default rounded bg-white p-2 flex justify-center items-center h-20 overflow-hidden">
                  <img
                    :src="facsimileUrl"
                    alt="Факсиміле"
                    class="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>

               <div v-else class="text-muted flex flex-col gap-2 text-xs leading-relaxed">
                <div class="flex items-start gap-2">
                  <UIcon name="i-lucide-info" class="flex-shrink-0 mt-0.5" />
                  <span>Зображення власноручного підпису (PNG з прозорістю). Накладається при погодженні (?visa=true).</span>
                </div>

                <!-- Local selection preview -->
                <div v-if="localPreviewUrl" class="space-y-3">
                  <div class="border border-default rounded bg-white p-2 flex justify-center items-center h-20 overflow-hidden">
                    <img :src="localPreviewUrl" alt="Прев'ю підпису" class="max-h-full max-w-full object-contain" />
                  </div>
                  <div class="text-[11px] text-center text-muted font-medium truncate">
                    Обрано: {{ selectedFile?.name }}
                  </div>
                  <div class="flex gap-2">
                    <UButton size="xs" color="primary" block class="flex-1 justify-center" :loading="loading" @click="uploadLocalFacsimile">
                      Завантажити
                    </UButton>
                    <UButton size="xs" color="neutral" variant="outline" class="flex-shrink-0" :disabled="loading" @click="cancelLocalSelection">
                      Скасувати
                    </UButton>
                  </div>
                </div>

                <!-- Drop zone or file input -->
                <div
                  v-else
                  class="border border-dashed border-default rounded-lg p-3 text-center cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                  @click="triggerFileInput"
                >
                  <UIcon name="i-lucide-upload-cloud" class="text-muted text-lg mb-1" />
                  <div class="text-[11px] text-muted">Натисніть для вибору PNG/JPG (max 200x80)</div>
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/png, image/jpeg"
                    class="hidden"
                    @change="onFacsimileSelected"
                  />
                </div>
              </div>
            </div>

            <div v-if="auth.user.value?.has_facsimile" class="pt-2">
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="loading" @click="onDeleteFacsimile">
                Видалити факсиміле
              </UButton>
            </div>
          </div>
        </div>

        <USeparator />

        <!-- Загальні налаштування системи -->
        <div class="space-y-3">
          <div class="font-semibold text-sm flex items-center gap-1.5">
            <UIcon name="i-lucide-settings" class="text-primary" />
            <span>Загальні налаштування</span>
          </div>
          <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-default">
            <UCheckbox
              v-model="handwritten"
              label="Ввімкнути рукописну дату та індекс за замовчуванням"
              help="Нові PDF документи будуть автоматично генеруватися з рукописними відмітками прописом"
            />
          </div>
        </div>

        <USeparator />

        <!-- Секція прив'язки нового сертифіката -->
        <div class="space-y-4 pt-1">
          <div class="font-semibold text-sm">Прив'язати новий сертифікат</div>

          <!-- Тип сертифіката -->
          <div>
            <div class="text-xs text-muted mb-1.5 font-medium">Тип сертифіката</div>
            <div class="flex gap-2">
              <UButton
                :variant="certType === 'esign' ? 'soft' : 'outline'"
                :color="certType === 'esign' ? 'primary' : 'neutral'"
                icon="i-lucide-user"
                size="xs"
                class="flex-1 justify-center"
                @click="certType = 'esign'"
              >
                КЕП особи
              </UButton>
              <UButton
                :variant="certType === 'eseal' ? 'soft' : 'outline'"
                :color="certType === 'eseal' ? 'primary' : 'neutral'"
                icon="i-lucide-stamp"
                size="xs"
                class="flex-1 justify-center"
                @click="certType = 'eseal'"
              >
                Печатка юрособи
              </UButton>
            </div>
            <div class="text-[11px] text-muted mt-1.5 leading-relaxed">
              <span v-if="certType === 'esign'">
                Кваліфікований сертифікат фізичної особи (КЕП). Прив'язується за РНОКПП.
              </span>
              <span v-else>
                Сертифікат електронної печатки юрособи/ФОП. Прив'язується за назвою юрособи (CN). Накладання печатки = той самий ДСТУ 4145 / CAdES-X-Long.
              </span>
            </div>
          </div>

          <div class="text-xs text-muted" :class="kep.euReady.value ? 'text-success font-medium' : ''">
            {{ kep.euStatus.value }}
          </div>

          <!-- Спосіб ключа -->
          <div>
            <div class="text-xs text-muted mb-1.5 font-medium">Спосіб зчитування ключа</div>
            <div class="flex gap-2">
              <UButton
                :variant="kep.keySource.value === 'file' ? 'soft' : 'outline'"
                :color="kep.keySource.value === 'file' ? 'primary' : 'neutral'"
                icon="i-lucide-file-key"
                size="xs"
                class="flex-1 justify-center"
                @click="kep.keySource.value = 'file'"
              >
                Файловий ключ
              </UButton>
              <UButton
                :variant="kep.keySource.value === 'token' ? 'soft' : 'outline'"
                :color="kep.keySource.value === 'token' ? 'primary' : 'neutral'"
                icon="i-lucide-usb"
                size="xs"
                class="flex-1 justify-center"
                @click="() => { kep.keySource.value = 'token'; kep.initWidget() }"
              >
                Апаратний токен
              </UButton>
            </div>
          </div>

          <!-- Віджет токена -->
          <div v-if="kep.keySource.value === 'token'" class="p-2 rounded border border-default">
            <div id="kep-widget-parent" class="w-full h-[320px] border border-default rounded overflow-hidden" />
          </div>

          <!-- Файловий ключ: КНЕДП + файл поруч, пароль окремим повним рядком -->
          <template v-else>
            <div class="grid grid-cols-2 gap-3 items-start">
              <UFormField v-if="kep.caList.value.length" label="Кваліфікований надавач (КНЕДП)">
                <USelect
                  v-model="kep.caIndex.value"
                  :items="kep.caList.value.map((c, i) => ({ label: c.title, value: i }))"
                  class="w-full"
                  size="sm"
                />
                <div class="text-[10px] text-muted mt-1 leading-snug">
                  Виберіть КНЕДП, що видав сертифікат. Невідповідність → «Сертифікат не знайдено».
                </div>
              </UFormField>
              <FileDropZone
                accept=".dat,.pfx,.jks,.p12,.zs2"
                hint="Файл ключа (.dat / .pfx / .jks)"
                :file-name="kep.keyFile.value?.name"
                class="min-w-0"
                @file="kep.onKeyFile"
              />
            </div>

            <!-- Контейнер з кількома ключами (jks/keystore): обрати сертифікат підпису -->
            <UFormField v-if="kep.keyItemList.value.length > 1" label="Ключ у контейнері">
              <USelect
                v-model="kep.keyItemIndex.value"
                :items="kep.keyItemList.value.map((k, i) => ({ label: k.title, value: i }))"
                class="w-full"
                size="sm"
              />
              <div class="text-[10px] text-muted mt-1 leading-snug">
                Контейнер містить кілька ключів — оберіть сертифікат для підпису.
              </div>
            </UFormField>
          </template>

          <UFormField label="Пароль захисту ключа">
            <UInput v-model="kep.keyPass.value" type="password" placeholder="••••••" class="w-full" size="sm" />
          </UFormField>

          <!-- Сертифікат окремим файлом (.cer) — для тестових/офлайн ключів,
               коли сертифікат не дотягується з КНЕДП (помилка «Сертифікат не знайдено»).
               Для тестового ключа ДІЯ: client_diia.cer поруч з .p12 -->
          <UFormField label="Сертифікат ключа (.cer) — якщо є окремо">
            <FileDropZone
              accept=".cer,.crt,.p7b"
              hint="Сертифікат відкритого ключа (.cer)"
              :file-name="kep.certFiles.value[0]?.name"
              class="min-w-0"
              @file="kep.onCertFile"
            />
            <div class="text-[10px] text-muted mt-1 leading-snug">
              Додайте, якщо EUSign повідомляє «Сертифікат не знайдено (51)» —
              сертифікат візьметься з файлу замість онлайн-запиту до КНЕДП.
            </div>
          </UFormField>

          <div v-if="kep.signStep.value" class="text-xs text-muted flex items-center gap-2">
            <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary" />
            <span>
              {{
                kep.signStep.value === 'key' ? 'Зчитування ключа…' :
                kep.signStep.value === 'sign' ? 'Створення підпису челенджу…' : kep.signStep.value
              }}
            </span>
          </div>

          <UButton
            :icon="certType === 'eseal' ? 'i-lucide-stamp' : 'i-lucide-link'"
            color="primary"
            block
            :loading="loading"
            :disabled="!kep.euReady.value && kep.keySource.value === 'file'"
            @click="onLinkCert"
          >
            {{ certType === 'eseal' ? 'Привʼязати печатку юрособи' : 'Привʼязати КЕП' }}
          </UButton>
        </div>

        <USeparator />

        <!-- Дії кнопки -->
        <div class="flex gap-2 justify-end">
          <UButton variant="ghost" color="neutral" @click="store.kepModalOpen.value = false">
            Закрити
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
