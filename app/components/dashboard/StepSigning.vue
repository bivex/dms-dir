<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const isCollapsed = ref(false)

async function downloadSignerSig(signerIndex: number) {
  try {
    const apiBase = useRuntimeConfig().public.apiBase
    const res = await fetch(`${apiBase}/documents/${store.form.doc_id}/signers/${signerIndex}/download-signature`, {
      headers: store.token.value ? { Authorization: `Bearer ${store.token.value}` } : {}
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${store.form.doc_id}_signature_${signerIndex + 1}.p7s`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  } catch (e) {
    const toast = useToast()
    toast.add({ title: 'Помилка завантаження підпису', description: String(e), color: 'error' })
  }
}
</script>

<template>
  <UCard id="sec-signing">
    <template #header>
      <div class="flex items-center gap-2 font-semibold cursor-pointer select-none" @click="isCollapsed = !isCollapsed">
        <UIcon name="i-lucide-pen-tool" />
        <span>Підписання</span>
        <span v-if="store.signerList.value.length" class="ml-2 text-xs font-normal text-muted">
          {{ store.signerList.value.filter(s => s.status === 'signed').length }}/{{ store.signerList.value.length }} підписано
        </span>
        <UButton
          :icon="isCollapsed ? 'i-lucide-chevron-down' : 'i-lucide-chevron-up'"
          variant="ghost"
          color="neutral"
          size="xs"
          class="ml-auto"
        />
      </div>
    </template>

    <div v-show="!isCollapsed" class="space-y-5">
      <!-- Черга підписання → timeline -->
      <div>
        <div class="flex items-center justify-between gap-2 mb-3">
          <span class="text-sm font-medium">Черга підписання</span>
          <UButton
            v-if="store.docStatus.value === 'draft' || !store.signerList.value.length"
            icon="i-lucide-send"
            :loading="store.submitting.value"
            :disabled="!store.signerList.value.length"
            size="sm"
            @click="store.submitDoc()"
          >
            Подати у чергу
          </UButton>
        </div>

        <!-- Авто-перехід після погодження: документ уже в черзі, кнопка не потрібна -->
        <div
          v-if="store.docStatus.value === 'pending_signatures' && store.approverList.value.length"
          class="flex items-start gap-2 mb-3 p-3 rounded-lg bg-success/5 border border-success/30 text-xs text-muted leading-relaxed"
        >
          <UIcon name="i-lucide-info" class="text-success flex-shrink-0 mt-0.5" />
          <span>
            Документ погоджено й <span class="font-medium text-default">автоматично подано у чергу підписання</span>.
            Окремо подавати не потрібно — перший підписант уже активний. Підпишіть документ через КЕП нижче.
          </span>
        </div>

        <div v-if="store.signerList.value.length === 0" class="flex items-start gap-2 text-warning text-sm">
          <UIcon name="i-lucide-triangle-alert" class="flex-shrink-0 mt-0.5" />
          <span>Додайте хоча б одного підписанта у картці документа («Підписанти») і збережіть картку, перш ніж подавати у чергу.</span>
        </div>
        <UTimeline v-else :items="store.signerTimeline.value" />
      </div>

      <!-- Скачування результатів підписання (коли документ повністю підписано) -->
      <div v-if="store.docStatus.value === 'signed'" class="p-4 rounded-lg border border-success/30 bg-success/5 space-y-3">
        <div class="font-semibold text-sm text-success flex items-center gap-1.5">
          <UIcon name="i-lucide-circle-check" />
          <span>Документ успішно підписано</span>
        </div>
        <div class="text-xs text-muted leading-relaxed">
          Усі підписи накладено. Ви можете завантажити оригінал документа, об'єднаний PDF з візами або повний криптографічний контейнер ASiC-E.
        </div>
        <div class="flex flex-wrap gap-2 pt-1">
          <UButton
            icon="i-lucide-file-archive"
            color="success"
            size="sm"
            @click="store.downloadAsice()"
          >
            Завантажити ASiC-E (.asice)
          </UButton>
          <UButton
            icon="i-lucide-file-text"
            color="neutral"
            variant="outline"
            size="sm"
            @click="store.downloadDoc()"
          >
            Оригінал документа
          </UButton>
          <UButton
            icon="i-lucide-file-signature"
            color="neutral"
            variant="outline"
            size="sm"
            @click="store.downloadMergedPdf(true)"
          >
            PDF з візами
          </UButton>
        </div>
      </div>

      <!-- Список накладених підписів (.p7s) -->
      <div v-if="store.signerList.value.some(s => s.status === 'signed')" class="space-y-2">
        <div class="text-xs font-semibold text-muted uppercase">Накладені підписи (.p7s)</div>
        <div class="divide-y divide-border border rounded-md">
          <div
            v-for="(s, idx) in store.signerList.value"
            :key="s.name + idx"
            class="flex items-center justify-between p-2 text-xs"
          >
            <div class="flex items-center gap-1.5 truncate">
              <UIcon
                :name="s.status === 'signed' ? 'i-lucide-check-circle' : 'i-lucide-clock'"
                :class="s.status === 'signed' ? 'text-success' : 'text-muted'"
              />
              <span class="font-medium text-default">{{ s.name }}</span>
              <span class="text-muted truncate">({{ s.position || s.signer_type }})</span>
            </div>
            <UButton
              v-if="s.status === 'signed'"
              icon="i-lucide-download"
              size="xs"
              color="neutral"
              variant="ghost"
              title="Завантажити підпис .p7s"
              @click="downloadSignerSig(idx)"
            />
            <span v-else class="text-[10px] text-muted pr-2">очікує</span>
          </div>
        </div>
      </div>

      <USeparator />

      <!-- КЕП -->
      <DashboardKeypadPanel />
    </div>
  </UCard>
</template>
