<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth'
})

useSeoMeta({
  title: 'Вхід — Діловод',
  description: 'Увійдіть до системи електронного документообігу'
})

const { login, isLoggedIn } = useAuth()
const toast = useToast()
const router = useRouter()

// Якщо вже авторизований — одразу на дашборд
if (isLoggedIn.value) {
  await navigateTo('/dashboard')
}

const loading = ref(false)

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
</script>

<template>
  <UAuthForm
    :fields="fields"
    :schema="schema"
    title="Діловод · СЕД"
    description="ДСТУ 4163 + КЕП"
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
</template>
