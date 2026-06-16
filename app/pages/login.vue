<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useKep } from '~/composables/useKep'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Вхід — Діловод',
  description: 'Увійдіть до системи електронного документообігу'
})

const { login, loginWithKep, isLoggedIn } = useAuth()
const toast = useToast()
const router = useRouter()

// Якщо вже авторизований — одразу на дашборд
if (isLoggedIn.value) {
  await navigateTo('/dashboard')
}

// Режим входу: 'password' або 'kep'
const mode = ref<'password' | 'kep'>('password')
const loading = ref(false)

// Схема валідації для пароля
const schema = z.object({
  email: z.string().email('Невірний формат email'),
  password: z.string().min(1, 'Введіть пароль')
})

type Schema = z.output<typeof schema>

const fields = [{
  name: 'email',
  type: 'text' as const,
  label: 'Email',
  placeholder: 'user@example.com',
  required: true
}, {
  name: 'password',
  label: 'Пароль',
  type: 'password' as const,
  placeholder: '••••••••'
}]

// Ініціалізація КЕП
const kep = useKep()

async function onSubmit(payload: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await login(payload.data.email, payload.data.password)
    await router.push('/dashboard')
  }
  catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Помилка авторизації'
    toast.add({ title: 'Помилка входу', description: msg, color: 'error' })
  }
  finally {
    loading.value = false
  }
}

// Перемикання вкладок
async function setMode(newMode: 'password' | 'kep') {
  mode.value = newMode
  if (newMode === 'kep') {
    await kep.bootstrap()
  }
}

// Вхід за КЕП
async function onKepLogin() {
  loading.value = true
  try {
    // 1. Отримуємо одноразовий челендж з бекенду
    const apiBase = useRuntimeConfig().public.apiBase
    const { challenge } = await $fetch<{ challenge: string }>(`${apiBase}/auth/challenge`)
    
    // 2. Підписуємо його за допомогою КЕП
    const sigB64 = await kep.signData(challenge)
    
    // 3. Відправляємо підпис для логіну
    await loginWithKep(sigB64, challenge)
    toast.add({ title: 'Успішний вхід за КЕП', color: 'success' })
    await router.push('/dashboard')
  }
  catch (err: any) {
    const msg = err.data?.detail || err.message || 'Не вдалося авторизуватися за КЕП'
    toast.add({ title: 'Помилка КЕП', description: msg, color: 'error' })
  }
  finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="w-full max-w-sm mx-auto space-y-6">
    <!-- Вкладки вибору режиму -->
    <div class="flex border-b border-default mb-4">
      <button 
        type="button"
        class="flex-1 py-2.5 text-center text-sm font-semibold transition-all border-b-2" 
        :class="mode === 'password' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-default'"
        @click="setMode('password')"
      >
        Вхід за паролем
      </button>
      <button 
        type="button"
        class="flex-1 py-2.5 text-center text-sm font-semibold transition-all border-b-2" 
        :class="mode === 'kep' ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-default'"
        @click="setMode('kep')"
      >
        Вхід за КЕП
      </button>
    </div>

    <!-- Режим за паролем -->
    <UAuthForm
      v-if="mode === 'password'"
      :fields="fields"
      :schema="schema"
      title="Діловод · СЕД"
      description="Вхід за паролем"
      icon="i-lucide-shield"
      :loading="loading"
      @submit="onSubmit"
    >
      <template #description>
        Система електронного документообігу
      </template>

      <template #footer>
        Приватний ключ не покидає браузер (Закон 2155-VIII).
      </template>
    </UAuthForm>

    <!-- Режим за КЕП -->
    <UCard v-else class="shadow-md">
      <template #header>
        <div class="flex items-center gap-2 font-semibold">
          <UIcon name="i-lucide-pen-tool" class="text-primary text-lg" />
          <span>Вхід за допомогою КЕП</span>
        </div>
      </template>

      <div class="space-y-4">
        <div class="text-xs text-center p-2 rounded bg-neutral-100 dark:bg-neutral-800" :class="kep.euReady.value ? 'text-success font-medium' : 'text-muted'">
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
              size="sm"
              class="flex-1 justify-center"
              @click="kep.keySource.value = 'file'"
            >
              Файловий ключ
            </UButton>
            <UButton
              :variant="kep.keySource.value === 'token' ? 'soft' : 'outline'"
              :color="kep.keySource.value === 'token' ? 'primary' : 'neutral'"
              icon="i-lucide-usb"
              size="sm"
              class="flex-1 justify-center"
              @click="() => { kep.keySource.value = 'token'; kep.initWidget() }"
            >
              Апаратний токен
            </UButton>
          </div>
        </div>

        <!-- Апаратний токен віджет -->
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
          <UInput v-model="kep.keyPass.value" type="password" placeholder="••••••" class="w-full" />
        </UFormField>

        <div v-if="kep.signStep.value" class="text-xs text-muted flex items-center gap-2">
          <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary" />
          <span>
            {{
              kep.signStep.value === 'key' ? 'Зчитування та розшифрування ключа…' :
              kep.signStep.value === 'sign' ? 'Накладання цифрового підпису…' : kep.signStep.value
            }}
          </span>
        </div>

        <UButton
          icon="i-lucide-log-in"
          color="success"
          size="lg"
          block
          :loading="loading"
          :disabled="!kep.euReady.value && kep.keySource.value === 'file'"
          @click="onKepLogin"
        >
          Зчитати ключ та увійти
        </UButton>
      </div>

      <template #footer>
        <div class="text-xs text-muted text-center flex items-center justify-center gap-1">
          <UIcon name="i-lucide-lock" class="text-success" />
          <span>Ключ використовується локально й не передається на сервер.</span>
        </div>
      </template>
    </UCard>
  </div>
</template>
