<script setup lang="ts">
import { ref } from 'vue'
import { useKep } from '~/composables/useKep'

const auth = useAuth()
const kep = useKep()
const toast = useToast()

const loading = ref(false)
const certType = ref<'esign' | 'eseal'>('esign')

async function onLinkCert() {
  loading.value = true
  try {
    const apiBase = useRuntimeConfig().public.apiBase || 'http://localhost:8000'
    const { challenge } = await $fetch<{ challenge: string }>(`${apiBase}/auth/challenge`)

    const sigB64 = await kep.signData(challenge)

    const res = await auth.apiFetch<{ status: string; cert_type?: string; user: any }>('/auth/link-kep', {
      method: 'POST',
      body: { challenge, signature_b64: sigB64 }
    })

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
</script>

<template>
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
      <div class="grid grid-cols-2 gap-3 items-start">
        <UFormField v-if="kep.caList.value.length" label="Кваліфікований надавач (КНЕДП)">
          <USelect
            v-model="kep.caIndex.value"
            :items="kep.caList.value.map((c, i) => ({ label: c.title, value: i }))"
            class="w-full"
            size="sm"
          />
        </UFormField>

        <UFormField label="Файл ключа (.dat, .pfx, .pk8, .jks, .zs2)">
          <div class="flex gap-2 items-center">
            <UInput
              type="file"
              accept=".dat,.pfx,.pk8,.zs2,.jks"
              class="w-full"
              size="sm"
              @change="(e: Event) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) kep.onKeyFile(f) }"
            />
          </div>
        </UFormField>
      </div>

      <UFormField label="Пароль до ключа">
        <UInput
          v-model="kep.keyPass.value"
          type="password"
          placeholder="Введіть пароль"
          size="sm"
          class="w-full"
          @keydown.enter="onLinkCert"
        />
      </UFormField>

      <div class="flex gap-2 pt-2">
        <UButton
          color="primary"
          icon="i-lucide-link"
          :loading="loading || kep.signing.value"
          :disabled="!kep.euReady.value || (!kep.keyFile.value && kep.keySource.value === 'file') || !kep.keyPass.value"
          @click="onLinkCert"
        >
          Зчитати та прив'язати сертифікат
        </UButton>
      </div>
    </template>
  </div>
</template>
