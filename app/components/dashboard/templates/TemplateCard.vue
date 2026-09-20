<script setup lang="ts">
import type { DocTemplate } from '~/composables/dashboard/useTemplates'
import { TEMPLATE_CATEGORIES } from '~/composables/dashboard/useTemplates'

const props = defineProps<{
  tpl: DocTemplate
  isSelected: boolean
}>()

const emit = defineEmits<{
  select: [tpl: DocTemplate]
  preview: [tpl: DocTemplate]
  edit: [tpl: DocTemplate]
  delete: [tpl: DocTemplate]
  apply: [tpl: DocTemplate]
}>()

function categoryLabel(catId: string) {
  return TEMPLATE_CATEGORIES.find(c => c.id === catId)?.label ?? catId
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
  <div
    class="group border border-default rounded-lg p-4 bg-background hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer flex flex-col gap-2"
    :class="{ 'border-primary ring-1 ring-primary/20 bg-primary/5': props.isSelected }"
    @click="emit('select', props.tpl)"
  >
    <!-- Іконка + бейдж -->
    <div class="flex items-start gap-3">
      <div
        class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        :class="`bg-${catColor(props.tpl.category)}/10`"
      >
        <UIcon :name="props.tpl.icon" :class="`text-${catColor(props.tpl.category)} text-lg`" />
      </div>
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm leading-snug">{{ props.tpl.title }}</div>
        <div class="flex items-center gap-1 mt-1 flex-wrap">
          <UBadge
            :label="categoryLabel(props.tpl.category)"
            :color="catColor(props.tpl.category) as any"
            variant="subtle"
            size="xs"
          />
          <UBadge
            v-if="props.tpl.is_builtin"
            label="вбуд."
            color="neutral"
            variant="subtle"
            size="xs"
          />
        </div>
      </div>
    </div>

    <!-- Опис -->
    <div class="text-xs text-muted leading-snug line-clamp-2">
      {{ props.tpl.description || '—' }}
    </div>

    <!-- Вид -->
    <div class="text-[11px] text-muted/70 font-mono truncate">
      {{ props.tpl.doc_type }}
    </div>

    <!-- Дії при наведенні (hover) -->
    <div class="flex gap-1.5 mt-auto pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <UButton size="xs" variant="soft" icon="i-lucide-eye" class="flex-1 justify-center" @click.stop="emit('preview', props.tpl)">
        Переглянути
      </UButton>
      <UButton size="xs" color="primary" icon="i-lucide-file-plus" class="flex-1 justify-center" @click.stop="emit('apply', props.tpl)">
        Використати
      </UButton>
      <UButton
        v-if="!props.tpl.is_builtin"
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-pen"
        title="Редагувати"
        aria-label="Редагувати шаблон"
        @click.stop="emit('edit', props.tpl)"
      />
      <UButton
        v-if="!props.tpl.is_builtin"
        size="xs"
        variant="ghost"
        color="error"
        icon="i-lucide-trash-2"
        title="Видалити"
        aria-label="Видалити шаблон"
        @click.stop="emit('delete', props.tpl)"
      />
    </div>
  </div>
</template>
