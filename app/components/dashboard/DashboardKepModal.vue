<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useKep } from '~/composables/useKep'
import { onMounted } from 'vue'

const store = useDashboard()
const auth = useAuth()
const kep = useKep()
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

    if (auth.user.value) {
      auth.user.value = res.user ?? auth.user.value
      // бекенд міг не повернути user (стара форма) — чистимо поле локально
      if (type === 'eseal') {
        auth.user.value.organization_cert_cn = null
      }
      else {
        auth.user.value.kep_serial_number = null
        auth.user.value.kep_certificate_serial = null
        auth.user.value.kep_subject_cn = null
      }
      localStorage.setItem('dilovod_user', JSON.stringify(auth.user.value))
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
</script>

<template>
  <UModal v-model:open="store.kepModalOpen.value" :ui="{ content: 'max-w-md w-full' }">
    <template #content>
      <div class="p-5 space-y-4">
        <!-- Заголовок -->
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-key-round" class="text-primary text-lg" />
          <span>Сертифікати підписання</span>
        </div>

        <USeparator />

        <!-- Поточна прив'язка: КЕП особи -->
        <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-default text-sm">
          <div class="font-medium text-xs text-muted uppercase flex items-center gap-1.5">
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
            <div class="text-xs text-muted">
              <span class="font-medium text-default">Сер. № сертифіката:</span>
              <span class="font-mono text-[10px]">{{ auth.user.value.kep_certificate_serial }}</span>
            </div>

            <div class="pt-2">
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="loading" @click="onUnlinkCert('esign')">
                Відв'язати КЕП
              </UButton>
            </div>
          </div>

          <div v-else class="text-muted flex items-center gap-2">
            <UIcon name="i-lucide-info" />
            <span>КЕП не прив'язаний. Вхід без пароля недоступний.</span>
          </div>
        </div>

        <!-- Поточна прив'язка: печатка юрособи -->
        <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-default text-sm">
          <div class="font-medium text-xs text-muted uppercase flex items-center gap-1.5">
            <UIcon name="i-lucide-stamp" /> Печатка юрособи
          </div>

          <div v-if="auth.user.value?.organization_cert_cn" class="space-y-1">
            <div class="flex items-center gap-1.5 text-success font-medium">
              <UIcon name="i-lucide-check-circle" />
              <span>Прив'язана</span>
            </div>
            <div class="text-xs text-muted">
              <span class="font-medium text-default">Юрособа (CN):</span> {{ auth.user.value.organization_cert_cn }}
            </div>

            <div class="pt-2">
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="loading" @click="onUnlinkCert('eseal')">
                Відв'язати печатку
              </UButton>
            </div>
          </div>

          <div v-else class="text-muted flex items-center gap-2">
            <UIcon name="i-lucide-info" />
            <span>Печатка не прив'язана. Накладання печатки юрособи недоступне.</span>
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

          <!-- Файловий ключ -->
          <template v-else>
            <UFormField v-if="kep.caList.value.length" label="Кваліфікований надавач (КНЕДП)">
              <USelect
                v-model="kep.caIndex.value"
                :items="kep.caList.value.map((c, i) => ({ label: c.title, value: i }))"
                class="w-full"
                size="sm"
              />
            </UFormField>

            <FileDropZone
              accept=".dat,.pfx,.jks,.p12,.zs2"
              hint="Файл ключа (.dat / .pfx / .jks)"
              :file-name="kep.keyFile.value?.name"
              @file="kep.onKeyFile"
            />
          </template>

          <UFormField label="Пароль захисту ключа">
            <UInput v-model="kep.keyPass.value" type="password" placeholder="••••••" class="w-full" size="sm" />
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
