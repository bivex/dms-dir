<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store
</script>

<template>
  <UCard id="sec-document">
    <template #header>
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary flex-shrink-0">
          <UIcon name="i-lucide-file-text" class="text-xl" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-semibold truncate">{{ form.title || '(без заголовка)' }}</div>
          <div class="text-xs text-muted flex items-center gap-2 truncate">
            <span>{{ store.docFormatLabel.value }}</span>
            <span>·</span>
            <span class="truncate">{{ form.doc_id }}</span>
          </div>
        </div>
        <UBadge
          :label="store.statusBadge.value.label"
          :color="store.statusBadge.value.color"
          variant="subtle"
          size="md"
          class="flex-shrink-0"
        />
      </div>
    </template>

    <!-- secondary-тулбар -->
    <div class="flex items-center gap-1 mb-4 pb-3 border-b border-default flex-wrap">
      <UButton icon="i-lucide-eye" variant="ghost" color="neutral" size="xs" @click="store.openViewer()">
        Переглянути
      </UButton>
      <UButton icon="i-lucide-download" variant="ghost" color="neutral" size="xs" @click="store.downloadDoc()">
        Завантажити
      </UButton>
      <UDropdownMenu v-if="store.selectedId.value" :items="store.moveToFolderItems.value" :ui="{ content: 'w-52' }">
        <UButton icon="i-lucide-folder" variant="ghost" color="neutral" size="xs">
          <span
            v-if="store.selectedFolderId.value !== null"
            class="inline-block w-2 h-2 rounded-sm"
            :style="{ backgroundColor: store.folderDotColor(store.activeFolder.value?.color) }"
          />
          {{ store.selectedFolderId.value !== null ? (store.activeFolder.value?.name ?? 'Папка') : 'Без папки' }}
        </UButton>
      </UDropdownMenu>
      <UButton
        v-if="store.selectedId.value"
        icon="i-lucide-star"
        :color="store.isFavorite(form.doc_id) ? 'warning' : 'neutral'"
        :variant="store.isFavorite(form.doc_id) ? 'soft' : 'ghost'"
        size="xs"
        :title="store.isFavorite(form.doc_id) ? 'Прибрати з обраних' : 'Додати в обрані'"
        @click="store.toggleFavorite(form.doc_id)"
      />
      <div class="ml-auto">
        <UButton
          v-if="store.selectedId.value"
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          size="xs"
          title="Видалити"
          @click="store.deleteDoc()"
        />
      </div>
    </div>

    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <UFormField label="Тип суб'єкта">
          <USelect
            v-model="form.subject_type"
            :items="[
              { label: 'Юридична особа', value: 'legal' },
              { label: 'ФОП', value: 'fop' },
              { label: 'Фізична особа', value: 'person' }
            ]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Вид документа">
          <UInput v-model="form.doc_type" class="w-full" />
        </UFormField>
        <UFormField label="Формат">
          <USelect
            v-model="form.fmt"
            :items="[{ label: 'PDF', value: 'pdf' }, { label: 'DOCX', value: 'docx' }]"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Реєстр. індекс" :help="store.autoRegister.value ? 'авто при поданні' : 'введіть вручну'">
          <UInput
            v-model="form.reg_index"
            :disabled="store.autoRegister.value"
            :placeholder="store.autoRegister.value ? 'авто' : '№'"
            class="w-full"
          />
        </UFormField>
      </div>

      <UFormField label="Найменування організації">
        <UInput v-model="form.org_name" class="w-full" />
      </UFormField>
      <UFormField label="Заголовок">
        <UInput v-model="form.title" class="w-full" />
      </UFormField>
      <UFormField label="Дата реєстрації" :help="store.autoRegister.value ? 'авто при поданні' : 'введіть вручну'">
        <UInput
          v-model="form.date_text"
          :disabled="store.autoRegister.value"
          :placeholder="store.autoRegister.value ? 'авто' : '14 червня 2026 р.'"
          class="w-full"
        />
      </UFormField>

      <UCheckbox
        v-model="store.autoRegister.value"
        label="Авто-реєстрація"
        help="наскрізний індекс за типом документа + поточна дата при поданні у чергу"
      />

      <div v-if="store.selectedIsScanned.value" class="flex items-center gap-2 p-3 rounded border border-default text-sm text-muted">
        <UIcon name="i-lucide-scan-line" class="text-primary flex-shrink-0" />
        Скан-копія: оригіналом є завантажений файл. Текст не редагується — документ лише підписують КЕП.
      </div>
      <UFormField v-else label="Текст (кожен абзац — з нового рядка)">
        <UTextarea v-model="form.body" :rows="5" class="w-full" />
      </UFormField>

      <UFormField label="Підписанти (ПІБ | посада, по рядку)">
        <UTextarea v-model="form.signers" :rows="3" placeholder="ПЕТРЕНКО Олександр | Директор" class="w-full" />
      </UFormField>

      <div v-if="!store.selectedIsScanned.value" class="flex gap-2">
        <UButton icon="i-lucide-save" @click="store.createDoc()">
          Зберегти картку
        </UButton>
      </div>
    </div>
  </UCard>
</template>
