<script setup lang="ts">
import type { DocTemplate } from '~/composables/dashboard/useTemplates'
import { TEMPLATE_CATEGORIES } from '~/composables/dashboard/useTemplates'

const props = defineProps<{
  tpl: DocTemplate
}>()

const emit = defineEmits<{
  close: []
  apply: [tpl: DocTemplate]
  duplicate: [tpl: DocTemplate]
  edit: [tpl: DocTemplate]
  delete: [tpl: DocTemplate]
}>()

function categoryLabel(catId: string) {
  return TEMPLATE_CATEGORIES.find(c => c.id === catId)?.label ?? catId
}

function categoryIcon(catId: string) {
  return TEMPLATE_CATEGORIES.find(c => c.id === catId)?.icon ?? 'i-lucide-file-text'
}

function catColor(catId: string) {
  switch (catId) {
    case 'kadry': return 'info'
    case 'nakazy': return 'warning'
    case 'lystuvannya': return 'primary'
    case 'akty': return 'success'
    case 'dohovory': return 'neutral'
    default: return 'neutral'
  }
}
</script>

<template>
  <aside class="w-80 border-l border-default flex flex-col bg-background overflow-hidden flex-shrink-0">
    <!-- Шапка -->
    <div class="p-4 border-b border-default flex items-start gap-2">
      <div
        class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        :class="`bg-${catColor(props.tpl.category)}/10`"
      >
        <UIcon :name="props.tpl.icon" :class="`text-${catColor(props.tpl.category)} text-lg`" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm leading-snug">{{ props.tpl.title }}</div>
        <div class="text-xs text-muted mt-0.5 line-clamp-2">{{ props.tpl.description }}</div>
      </div>
      <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" class="flex-shrink-0" @click="emit('close')" />
    </div>

    <!-- Метадані -->
    <div class="overflow-y-auto flex-1 p-4 space-y-3 text-sm">
      <div>
        <div class="text-xs text-muted font-medium uppercase mb-1">Вид документа</div>
        <div class="font-mono text-xs bg-elevated px-2 py-1 rounded">{{ props.tpl.doc_type }}</div>
      </div>

      <div>
        <div class="text-xs text-muted font-medium uppercase mb-1">Суб'єкт</div>
        <UBadge
          :label="props.tpl.subject_type === 'legal' ? 'Юридична особа' : props.tpl.subject_type === 'fop' ? 'ФОП' : 'Фізична особа'"
          :color="props.tpl.subject_type === 'legal' ? 'primary' : props.tpl.subject_type === 'fop' ? 'warning' : 'info'"
          variant="subtle"
          size="xs"
        />
      </div>

      <div>
        <div class="text-xs text-muted font-medium uppercase mb-1">Типовий заголовок</div>
        <div class="text-xs bg-elevated px-2 py-1.5 rounded italic text-muted">{{ props.tpl.title_tpl || '—' }}</div>
      </div>

      <div v-if="props.tpl.addressees">
        <div class="text-xs text-muted font-medium uppercase mb-1">Адресат</div>
        <div class="text-xs bg-elevated px-2 py-1.5 rounded whitespace-pre-line text-muted">{{ props.tpl.addressees }}</div>
      </div>

      <div>
        <div class="text-xs text-muted font-medium uppercase mb-1">Текст документа</div>
        <div class="text-xs bg-elevated px-2 py-2 rounded whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">{{ props.tpl.body }}</div>
      </div>

      <div>
        <div class="text-xs text-muted font-medium uppercase mb-1">Категорія</div>
        <div class="flex items-center gap-1.5 text-xs text-muted">
          <UIcon :name="categoryIcon(props.tpl.category)" class="text-sm" />
          {{ categoryLabel(props.tpl.category) }}
        </div>
      </div>

      <div v-if="props.tpl.is_builtin" class="text-xs text-muted/60 flex items-center gap-1">
        <UIcon name="i-lucide-lock" class="text-xs" />
        Вбудований шаблон — дублюйте, щоб змінити
      </div>
    </div>

    <!-- Дії -->
    <div class="p-3 border-t border-default space-y-1.5">
      <UButton block icon="i-lucide-file-plus" @click="emit('apply', props.tpl)">
        Створити документ
      </UButton>
      <div class="flex gap-1.5">
        <UButton
          icon="i-lucide-copy"
          variant="soft"
          color="neutral"
          size="xs"
          class="flex-1 justify-center"
          @click="emit('duplicate', props.tpl)"
        >
          Дублювати
        </UButton>
        <UButton
          v-if="!props.tpl.is_builtin"
          icon="i-lucide-pen"
          variant="soft"
          size="xs"
          class="flex-1 justify-center"
          @click="emit('edit', props.tpl)"
        >
          Редагувати
        </UButton>
        <UButton
          v-if="!props.tpl.is_builtin"
          icon="i-lucide-trash-2"
          variant="soft"
          color="error"
          size="xs"
          @click="emit('delete', props.tpl)"
        />
      </div>
    </div>
  </aside>
</template>
