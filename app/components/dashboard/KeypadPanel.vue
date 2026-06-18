<script setup lang="ts">
import { computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { user } = useAuth()
const { isAdmin } = useRoles()

/** Чи є поточний користувач активним підписантом цього документа.
 *  Дзеркально до бекендового _is_active_signer (signing.py):
 *  співпадання по ПІБ / kep_subject_cn, або admin для службової заміни. */
const isActiveSigner = computed(() => {
  if (isAdmin.value) return true
  const pending = store.signerList.value.find(s => s.status === 'pending')
  if (!pending || !user.value) return false
  const name = (user.value.name || '').trim().toLowerCase()
  const cn = (user.value.kep_subject_cn || '').trim().toLowerCase()
  const signerName = (pending.name || '').trim().toLowerCase()
  return signerName in { [name]: 1, [cn]: 1 }
})
</script>

<template>
  <div class="space-y-4">
    <div class="text-sm" :class="store.euReady.value ? 'text-success' : 'text-muted'">
      {{ store.euStatus.value }}
    </div>

    <!-- (a) Спосіб підпису — сегмент-контрол -->
    <div>
      <div class="text-xs text-muted mb-1.5">Спосіб підпису</div>
      <div class="flex gap-2">
        <UButton
          :variant="store.keySource.value === 'file' ? 'soft' : 'outline'"
          :color="store.keySource.value === 'file' ? 'primary' : 'neutral'"
          icon="i-lucide-file-key"
          size="sm"
          class="flex-1 justify-center"
          @click="store.keySource.value = 'file'"
        >
          Файловий ключ
        </UButton>
        <UButton
          :variant="store.keySource.value === 'token' ? 'soft' : 'outline'"
          :color="store.keySource.value === 'token' ? 'primary' : 'neutral'"
          icon="i-lucide-usb"
          size="sm"
          class="flex-1 justify-center"
          @click="() => { store.keySource.value = 'token'; store.initWidget() }"
        >
          Апаратний токен
        </UButton>
      </div>
    </div>

    <!-- (b) токен-виджет ІІТ -->
    <div v-if="store.keySource.value === 'token'" class="p-3 rounded border border-default">
      <div class="text-sm text-muted mb-2">Підпис апаратним токеном через офіційний віджет ІІТ.</div>
      <div id="sign-widget-parent" class="w-full h-[620px] border border-default rounded overflow-hidden" />
    </div>

    <!-- (b') файловий ключ: дропзона + КНЕДП -->
    <template v-else>
      <UFormField v-if="store.caList.value.length" label="Кваліфікований надавач (КНЕДП)">
        <USelect
          v-model="store.caIndex.value"
          :items="store.caList.value.map((c, i) => ({ label: c.title, value: i }))"
          class="w-full"
        />
      </UFormField>
      <FileDropZone
        accept=".dat,.pfx,.jks,.p12,.zs2"
        hint="Файл ключа (.dat / .pfx / .jks)"
        :file-name="store.keyFile.value?.name"
        @file="store.onKeyFile"
      />
    </template>

    <UFormField label="Пароль захисту ключа">
      <UInput v-model="store.keyPass.value" type="password" placeholder="••••••" class="w-full" />
    </UFormField>

    <div v-if="store.signStep.value" class="text-xs text-muted flex items-center gap-2">
      <UIcon name="i-lucide-loader-circle" class="animate-spin" />
      {{
        store.signStep.value === 'manifest' ? 'Формування даних для підпису…' :
        store.signStep.value === 'key' ? 'Зчитування ключа…' :
        store.signStep.value === 'sign' ? 'Накладання КЕП (ДСТУ 4145)…' :
        store.signStep.value === 'send' ? 'Передавання підпису на сервер…' : store.signStep.value
      }}
    </div>

    <!-- не активний підписант — повідомлення замість кнопки -->
    <div v-if="!isActiveSigner" class="flex items-center gap-2 p-3 rounded border border-info/40 bg-info/10 text-sm text-info">
      <UIcon name="i-lucide-info" class="flex-shrink-0" />
      Ви не є активним підписувачем цього документа. Підпис доступний лише призначеному підписанту (або адміністратору).
    </div>

    <!-- (c) SINGLE PRIMARY -->
    <UButton
      v-else
      icon="i-lucide-pen-tool"
      color="success"
      size="lg"
      block
      :loading="store.signing.value"
      :disabled="(!store.euReady.value && store.keySource.value === 'file') || store.signerList.value.every(s => s.status !== 'pending')"
      @click="store.signCurrent()"
    >
      Підписати документ
    </UButton>

    <!-- спрощений текст + «Детальніше» -->
    <div class="text-xs text-muted flex items-start gap-2">
      <UIcon name="i-lucide-lock" class="flex-shrink-0 mt-0.5 text-success" />
      <div>
        Ваш ключ використовується лише для підпису та не передається на сервер.
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          class="ml-1 px-1"
          @click="store.showLegalDetails.value = !store.showLegalDetails.value"
        >
          Детальніше
        </UButton>
        <div v-if="store.showLegalDetails.value" class="mt-1 text-muted/80">
          Приватний ключ не покидає браузер (Закон 2155-VIII). Для апаратних токенів потрібне встановлене «ІІТ Користувач ЦСК».
        </div>
      </div>
    </div>
  </div>
</template>
