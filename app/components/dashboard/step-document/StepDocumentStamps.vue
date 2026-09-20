<script setup lang="ts">
import { computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

const AVAILABLE_EXTRA_STAMPS = [
  'ВИХІДНИЙ №', 'ЗАРЕЄСТРОВАНО', 'ОТРИМАНО', 'ЗАРЕЄСТРОВАНО В ЕДО', 'ПОВТОРНО',
  'ДО ВИКОНАННЯ', 'ВИКОНАНО', 'ОЗНАЙОМЛЕНО', 'ПОГОДЖЕНО', 'ЗАТВЕРДЖЕНО', 'ДОПОВІСТИ', 'НА ПІДПИС', 'НА РОЗГЛЯД', 'ДО ОПРАЦЮВАННЯ',
  'ПІДШИТО', 'ДО АРХІВУ', 'ТЕРМІН ЗБЕРІГАННЯ', 'СПРАВА №', 'ЗНИЩЕНО',
  'ОПЛАЧЕНО', 'НЕ ОПЛАЧЕНО', 'БЕЗ ОПЛАТИ', 'ПРОВЕДЕНО', 'АКЦЕПТОВАНО',
  'КОПІЯ ВІРНА', 'ОСОБОВА СПРАВА', 'КАДРОВА СЛУЖБА', 'ПІДПИС ПЕРЕВІРЕНО',
  'ОРИГІНАЛ', 'ДУБЛІКАТ', 'НЕДІЙСНО', 'НАБРАЛО ЧИННОСТІ', 'ПОВЕРНУТО БЕЗ РОЗГЛЯДУ',
  'ВИКОНАТИ ДО', 'НА КОНТРОЛІ', 'ТЕРМІН ПРОДОВЖЕНО', 'ВИКОНАННЯ ПЕРЕВІРЕНО',
  'РЕКОМЕНДОВАНИЙ ЛИСТ', 'КУР\'ЄРОМ', 'ЕЛЕКТРОННОЮ ПОШТОЮ', 'ВРУЧЕНО ОСОБИСТО',
  'ПІДПИСАНО КЕП', 'ПЕРЕВІРЕНО КЕП', 'ЕЛЕКТРОННИЙ ДОКУМЕНТ', 'QR VERIFIED'
]

const availableExtraStampsOptions = computed(() => {
  return AVAILABLE_EXTRA_STAMPS
    .filter(s => !(form.extra_stamps || []).includes(s))
    .map(s => ({ label: s, value: s }))
})

function addExtraStamp(stampVal: string | number) {
  const stamp = String(stampVal)
  if (!form.extra_stamps) form.extra_stamps = []
  if (stamp && !form.extra_stamps.includes(stamp)) {
    form.extra_stamps.push(stamp)
  }
}

function removeExtraStamp(stamp: string) {
  if (form.extra_stamps) {
    form.extra_stamps = form.extra_stamps.filter(s => s !== stamp)
  }
}
</script>

<template>
  <!-- Чекбокси реєстрації та штампів -->
  <div class="space-y-3 pt-2">
    <UCheckbox
      v-model="store.autoRegister.value"
      label="Авто-реєстрація"
      help="наскрізний індекс за типом документа + поточна дата при поданні у чергу"
    />

    <template v-if="form.fmt === 'pdf'">
      <UCheckbox
        v-model="form.pagination_barcode"
        label="Штрих-код пагінації (Code128)"
        help="службовий штрихкод на кожній сторінці PDF для потокового сканування й звірки комплектності пачки"
      />

      <UFormField
        label="Печатка установи"
        help="синій круглий відбиток печатки організації поверх підпису посадової особи відповідно до ДСТУ 4163"
      >
        <USelect
          v-model="form.stamp_type"
          :items="[
            { label: 'Без печатки', value: 'none' },
            { label: 'Печатка «Для документів»', value: 'documents' },
            { label: 'Печатка «Для договорів»', value: 'contracts' },
            { label: 'Печатка «Відділ кадрів»', value: 'hr' },
            { label: 'Печатка «Канцелярія»', value: 'chancellery' },
            { label: 'Печатка «Бухгалтерія»', value: 'buh' },
            { label: 'Печатка «Юридичний відділ»', value: 'law' },
            { label: 'Печатка «Служба безпеки»', value: 'sec' },
            { label: 'Печатка «Відділ закупівель»', value: 'pur' },
            { label: 'Печатка «Відділ документообігу»', value: 'doc' },
            { label: 'Печатка «Архів»', value: 'arc' },
            { label: 'Печатка «Фінансовий відділ»', value: 'fin' }
          ]"
          class="w-full"
        />
      </UFormField>

      <div class="grid grid-cols-2 gap-3 pt-1">
        <UCheckbox
          v-model="form.use_incoming_stamp"
          label="Вхідний реєстраційний штамп"
          help="синій прямокутний штамп у правому нижньому куті"
        />
        <UCheckbox
          v-model="form.use_copy_stamp"
          label="Штамп «Згідно з оригіналом»"
          help="синій штамп засвідчення копії під підписами"
        />
        <UCheckbox
          v-model="form.use_control_stamp"
          label="Штамп контролю («КОНТРОЛЬ»)"
          help="червоний штамп на лівому полі першої сторінки"
        />
        <UCheckbox
          v-model="form.use_handwritten_date_index"
          label="Рукописна дата та індекс"
          help="імітація синього чорнила ручки прописом секретаря"
        />
        <UCheckbox
          v-model="form.use_copy_mark"
          label="Штамп «КОПІЯ»"
          help="синій штамп у правому верхньому куті"
        />
        <UCheckbox
          v-model="form.use_archived_stamp"
          label="Штамп «ДО СПРАВИ»"
          help="синій архівний штамп у лівому нижньому куті"
        />
        <UCheckbox
          v-model="form.use_annulled_stamp"
          label="Штамп «АНУЛЬОВАНО»"
          help="червоний штамп скасування у верхній частині"
        />
        <UCheckbox
          v-model="form.use_urgent_stamp"
          label="Штамп «ТЕРМІНОВО»"
          help="червоний штамп терміновості у правому верхньому куті"
        />
      </div>

      <UFormField
        label="Штамп обмеження доступу"
        help="червоний прямокутний штамп у правому верхньому куті"
      >
        <USelect
          v-model="form.restriction_stamp"
          :items="[
            { label: 'Без обмежень', value: 'none' },
            { label: 'Для службового користування (ДСК)', value: 'dsk' },
            { label: 'Таємно', value: 'secret' },
            { label: 'Конфіденційно', value: 'confidential' }
          ]"
          class="w-full"
        />
      </UFormField>

      <UFormField
        label="Додаткові корпоративні штампи"
        help="оберіть додаткові штампи для проставлення на документі"
      >
        <div class="space-y-2 w-full">
          <USelect
            :model-value="undefined"
            :items="availableExtraStampsOptions"
            placeholder="Додати штамп зі списку..."
            class="w-full"
            @update:model-value="addExtraStamp"
          />
          <div v-if="form.extra_stamps && form.extra_stamps.length" class="flex flex-wrap gap-1.5 pt-1">
            <span
              v-for="stamp in form.extra_stamps"
              :key="stamp"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
            >
              {{ stamp }}
              <UButton
                icon="i-lucide-x"
                size="xs"
                color="primary"
                variant="ghost"
                class="h-4 w-4 p-0"
                @click="removeExtraStamp(stamp)"
              />
            </span>
          </div>
        </div>
      </UFormField>
    </template>
  </div>
</template>
