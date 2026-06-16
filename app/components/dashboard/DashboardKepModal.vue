<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useKep } from '~/composables/useKep'
import { onMounted } from 'vue'

const store = useDashboard()
const auth = useAuth()
const kep = useKep()
const toast = useToast()
const loading = ref(false)

// Готовимо КЕП при відкритті модалки
onMounted(async () => {
  await kep.bootstrap()
})

// Прив'язати КЕП
async function onLinkKep() {
  loading.value = true
  try {
    // 1. Отримуємо челендж
    const apiBase = useRuntimeConfig().public.apiBase
    const { challenge } = await $fetch<{ challenge: string }>(`${apiBase}/auth/challenge`)
    
    // 2. Підписуємо його через КЕП
    const sigB64 = await kep.signData(challenge)
    
    // 3. Відправляємо на привязку
    const res = await auth.apiFetch<{ status: string; user: any }>('/auth/link-kep', {
      method: 'POST',
      body: { challenge, signature_b64: sigB64 }
    })
    
    // 4. Оновлюємо користувача в сесії
    auth.user.value = res.user
    localStorage.setItem('dilovod_user', JSON.stringify(res.user))
    
    toast.add({ title: 'КЕП успішно привʼязано', color: 'success' })
  } catch (err: any) {
    const msg = err.data?.detail || err.message || 'Помилка привʼязки КЕП'
    toast.add({ title: 'Помилка КЕП', description: msg, color: 'error' })
  } finally {
    loading.value = false
  }
}

// Відв'язати КЕП
async function onUnlinkKep() {
  loading.value = true
  try {
    await auth.apiFetch('/auth/unlink-kep', { method: 'POST' })
    
    // Оновлюємо користувача локально
    if (auth.user.value) {
      auth.user.value.kep_serial_number = null
      auth.user.value.kep_certificate_serial = null
      auth.user.value.kep_subject_cn = null
      localStorage.setItem('dilovod_user', JSON.stringify(auth.user.value))
    }
    
    toast.add({ title: 'КЕП успішно відвʼязано', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Помилка відвʼязування', description: err.message, color: 'error' })
  } finally {
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
          <span>Налаштування КЕП користувача</span>
        </div>

        <USeparator />

        <!-- Статус КЕП -->
        <div class="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-800 space-y-2 border border-default text-sm">
          <div class="font-medium text-xs text-muted uppercase">Поточна прив'язка КЕП</div>
          
          <div v-if="auth.user.value?.kep_serial_number" class="space-y-1">
            <div class="flex items-center gap-1.5 text-success font-medium">
              <UIcon name="i-lucide-check-circle" />
              <span>КЕП Прив'язаний</span>
            </div>
            <div class="text-xs text-muted mt-2">
              <span class="font-medium text-default">Суб'єкт (CN):</span> {{ auth.user.value.kep_subject_cn }}
            </div>
            <div class="text-xs text-muted">
              <span class="font-medium text-default">РНОКПП (ІПН):</span> {{ auth.user.value.kep_serial_number }}
            </div>
            <div class="text-xs text-muted">
              <span class="font-medium text-default">Серійний номер сертифіката:</span> 
              <span class="font-mono text-[10px]">{{ auth.user.value.kep_certificate_serial }}</span>
            </div>
            
            <div class="pt-2">
              <UButton size="xs" color="error" variant="soft" icon="i-lucide-trash-2" :loading="loading" @click="onUnlinkKep">
                Відв'язати КЕП від кабінету
              </UButton>
            </div>
          </div>
          
          <div v-else class="text-muted flex items-center gap-2">
            <UIcon name="i-lucide-info" />
            <span>Ключ КЕП не прив'язаний до цього кабінету. Ви не можете входити без пароля.</span>
          </div>
        </div>

        <!-- Секція прив'язки КЕП -->
        <div class="space-y-4 pt-1">
          <div class="font-semibold text-sm">Прив'язати новий КЕП</div>
          
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
                kep.signStep.value === 'key' ? 'Зчитування КЕП…' :
                kep.signStep.value === 'sign' ? 'Створення підпису челенджу…' : kep.signStep.value
              }}
            </span>
          </div>

          <UButton
            icon="i-lucide-link"
            color="primary"
            block
            :loading="loading"
            :disabled="!kep.euReady.value && kep.keySource.value === 'file'"
            @click="onLinkKep"
          >
            Зчитати та прив'язати КЕП
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
