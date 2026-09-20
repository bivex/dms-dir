<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'

const auth = useAuth()
const toast = useToast()

const loading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const facsimileVersion = ref(0)
const selectedFile = ref<File | null>(null)
const localPreviewUrl = ref<string | null>(null)

const facsimileUrl = computed(() => {
  const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8000'
  const token = auth.token.value ? encodeURIComponent(auth.token.value) : ''
  return `${apiBase}/users/me/facsimile?token=${token}&v=${facsimileVersion.value}`
})

onBeforeUnmount(() => {
  if (localPreviewUrl.value) {
    URL.revokeObjectURL(localPreviewUrl.value)
  }
})

function triggerFileInput() {
  fileInput.value?.click()
}

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
    await $fetch<any>(`${apiBase}/users/me/facsimile`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(auth.token.value ? { Authorization: `Bearer ${auth.token.value}` } : {})
      }
    })

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
      } else {
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
</script>

<template>
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
</template>
