<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import { useAuth } from '~/composables/useAuth'

const store = useDashboard()
const { user } = useAuth()

const reasonType = ref<'reply_letter' | 'resolution'>('reply_letter')
const replyNumber = ref('')
const resolutionText = ref('')
const resolutionAuthor = ref('')
const decontrolDate = ref(new Date().toISOString().slice(0, 10))
const note = ref('')

const doc = computed(() => store.decontrolTargetDoc.value)
const badge = computed(() => doc.value ? store.getControlBadge(doc.value) : null)

// Вихідні документи з системи для швидкого вибору
const registeredOutboundDocs = computed(() => {
  return store.docs.value
    .filter(d => d.reg_index && (d.status === 'signed' || d.status === 'published'))
    .map(d => ({
      label: `№ ${d.reg_index} — ${d.title.slice(0, 45)}...`,
      value: `Вих. № ${d.reg_index} від ${d.reg_date || new Date(d.created_at).toLocaleDateString('uk-UA')}`
    }))
})

watch(() => store.decontrolModalOpen.value, (isOpen) => {
  if (isOpen) {
    reasonType.value = 'reply_letter'
    replyNumber.value = ''
    resolutionText.value = 'До справи. Питання вирішено в повному обсязі.'
    resolutionAuthor.value = user.value?.name || 'Керівник'
    decontrolDate.value = new Date().toISOString().slice(0, 10)
    note.value = ''
  }
})

function setResolutionTemplate(text: string) {
  resolutionText.value = text
}

function onSelectExistingDoc(val: string) {
  if (val) {
    replyNumber.value = val
  }
}

async function handleSubmit() {
  if (reasonType.value === 'reply_letter' && !replyNumber.value.trim()) {
    return
  }
  if (reasonType.value === 'resolution' && !resolutionText.value.trim()) {
    return
  }

  await store.submitDecontrol({
    reason_type: reasonType.value,
    reply_number: replyNumber.value.trim(),
    resolution_text: resolutionText.value.trim(),
    resolution_author: resolutionAuthor.value.trim(),
    decontrol_date: decontrolDate.value,
    note: note.value.trim() || undefined
  })
}
</script>

<template>
  <UModal
    v-model:open="store.decontrolModalOpen.value"
    title="Зняття документа з контролю"
    :ui="{ content: 'sm:max-w-xl' }"
  >
    <template #content>
      <div v-if="doc" class="p-5 space-y-4">
        <!-- Шапка документа та поточний дедлайн -->
        <div class="p-3 rounded-lg bg-elevated/40 border border-default space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-xs font-mono font-bold text-primary-700 dark:text-primary-300">
              {{ doc.reg_index || doc.doc_id }}
            </span>
            <UBadge
              v-if="badge"
              :color="badge.color as any"
              variant="subtle"
              size="xs"
              class="font-semibold gap-1"
            >
              <UIcon :name="badge.icon" class="w-3 h-3" />
              <span>{{ badge.label }}</span>
            </UBadge>
          </div>
          <div class="text-sm font-semibold text-default leading-tight">
            {{ doc.title }}
          </div>
          <div v-if="doc.org_name" class="text-xs text-muted truncate">
            Кореспондент: <span class="font-medium text-default">{{ doc.org_name }}</span>
          </div>
        </div>

        <!-- Вибір підстави зняття з контролю -->
        <div class="space-y-3">
          <div class="text-xs font-bold uppercase tracking-wider text-muted">
            Оберіть підставу виконання / зняття з контролю:
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="flex items-center gap-2 p-3 rounded-lg border text-left transition-all"
              :class="reasonType === 'reply_letter'
                ? 'border-primary bg-primary/10 text-primary-900 dark:text-primary-200 font-bold shadow-sm'
                : 'border-default bg-elevated/20 text-muted hover:text-default hover:bg-elevated/40'"
              @click="reasonType = 'reply_letter'"
            >
              <UIcon name="i-lucide-send" class="w-4 h-4 flex-shrink-0 text-primary" />
              <div class="text-xs">
                <div>Лист-відповідь</div>
                <div class="text-[10px] opacity-70 font-normal">Вихідний лист адресату</div>
              </div>
            </button>

            <button
              type="button"
              class="flex items-center gap-2 p-3 rounded-lg border text-left transition-all"
              :class="reasonType === 'resolution'
                ? 'border-primary bg-primary/10 text-primary-900 dark:text-primary-200 font-bold shadow-sm'
                : 'border-default bg-elevated/20 text-muted hover:text-default hover:bg-elevated/40'"
              @click="reasonType = 'resolution'"
            >
              <UIcon name="i-lucide-user-check" class="w-4 h-4 flex-shrink-0 text-primary" />
              <div class="text-xs">
                <div>Резолюція керівника</div>
                <div class="text-[10px] opacity-70 font-normal">Вирішено без вихідного</div>
              </div>
            </button>
          </div>

          <!-- Блок: Вихідний лист-відповідь -->
          <div v-if="reasonType === 'reply_letter'" class="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-default space-y-3">
            <UFormField label="Номер та дата вихідного листа-відповіді" required>
              <UInput
                v-model="replyNumber"
                placeholder="напр. Вих. № 02-14/158 від 20.09.2026"
                class="w-full font-mono text-sm"
                autofocus
              />
            </UFormField>

            <div v-if="registeredOutboundDocs.length > 0" class="space-y-1">
              <div class="text-[11px] text-muted flex items-center gap-1">
                <UIcon name="i-lucide-corner-down-right" class="w-3 h-3" />
                <span>Або оберіть із зареєстрованих вихідних документів системи:</span>
              </div>
              <USelect
                :items="registeredOutboundDocs"
                placeholder="Обрати документ..."
                size="xs"
                class="w-full"
                @update:model-value="onSelectExistingDoc"
              />
            </div>
          </div>

          <!-- Блок: Резолюція керівника про виконання -->
          <div v-else class="p-3.5 rounded-lg bg-neutral-50 dark:bg-neutral-900 border border-default space-y-3">
            <UFormField label="Керівник / Автор резолюції" required>
              <UInput
                v-model="resolutionAuthor"
                placeholder="ПІБ керівника"
                class="w-full text-sm"
              />
            </UFormField>

            <UFormField label="Текст резолюції про виконання" required>
              <UTextarea
                v-model="resolutionText"
                :rows="2"
                placeholder="напр. До справи. Питання вирішено..."
                class="w-full text-sm"
              />
            </UFormField>

            <div class="flex flex-wrap gap-1 pt-1">
              <span class="text-[10px] text-muted self-center mr-1">Шаблони:</span>
              <button
                type="button"
                class="text-[10px] px-2 py-0.5 rounded border border-default bg-elevated/40 hover:bg-primary/10 hover:text-primary transition-colors"
                @click="setResolutionTemplate('До справи. Питання вирішено в повному обсязі.')"
              >
                До справи
              </button>
              <button
                type="button"
                class="text-[10px] px-2 py-0.5 rounded border border-default bg-elevated/40 hover:bg-primary/10 hover:text-primary transition-colors"
                @click="setResolutionTemplate('Взято до відома. Виконано без письмової відповіді.')"
              >
                До відома
              </button>
              <button
                type="button"
                class="text-[10px] px-2 py-0.5 rounded border border-default bg-elevated/40 hover:bg-primary/10 hover:text-primary transition-colors"
                @click="setResolutionTemplate('Надіслано роз\'яснення засобами телефонного/електронного зв\'язку.')"
              >
                Роз'яснено телефоном
              </button>
            </div>
          </div>

          <!-- Дата зняття та додаткова примітка -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <UFormField label="Дата зняття з контролю">
              <UInput
                v-model="decontrolDate"
                type="date"
                size="sm"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Додаткова примітка (необов'язково)">
              <UInput
                v-model="note"
                placeholder="Короткий коментар"
                size="sm"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <!-- Кнопки дій -->
        <div class="flex justify-end gap-2 pt-3 border-t border-default">
          <UButton
            variant="ghost"
            color="neutral"
            @click="store.closeDecontrolModal()"
          >
            Скасувати
          </UButton>
          <UButton
            icon="i-lucide-check-check"
            color="success"
            :loading="store.decontrolling?.value"
            :disabled="reasonType === 'reply_letter' ? !replyNumber.trim() : !resolutionText.trim()"
            @click="handleSubmit"
          >
            Підтвердити зняття з контролю
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
