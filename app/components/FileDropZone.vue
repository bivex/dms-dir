<script setup lang="ts">
/**
 * Переиспользуемая drag&drop-зона для выбора файла.
 * Кидает выбранный File через emit `file`; показывает имя, если файл уже выбран.
 *
 * Используется: файл ключа КЕП, заливка скану.
 */
const props = withDefaults(defineProps<{
  accept?: string
  hint?: string
  fileName?: string | null
}>(), {
  accept: '',
  hint: 'Перетягніть файл сюди',
  fileName: null,
})

const emit = defineEmits<{ file: [File] }>()

const dragOver = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)

function pick() {
  inputEl.value?.click()
}

function onInputChange(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) emit('file', f)
  // сбрасываем, чтобы можна було выбрать тот же файл повторно
  if (inputEl.value) inputEl.value.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) emit('file', f)
}
</script>

<template>
  <div
    class="rounded-lg border-2 border-dashed transition-colors cursor-pointer text-center px-4 py-5"
    :class="dragOver
      ? 'border-primary bg-primary/10'
      : 'border-default hover:border-primary/60 hover:bg-elevated/50'"
    @dragenter.prevent="dragOver = true"
    @dragover.prevent="dragOver = true"
    @dragleave.prevent="dragOver = false"
    @drop.prevent="onDrop"
    @click="pick"
  >
    <input
      ref="inputEl"
      type="file"
      class="hidden"
      :accept="props.accept"
      @change="onInputChange"
    >
    <template v-if="props.fileName">
      <div class="flex items-center justify-center gap-2 text-sm">
        <UIcon name="i-lucide-file-check" class="text-success" />
        <span class="font-medium truncate">{{ props.fileName }}</span>
      </div>
      <div class="text-xs text-muted mt-1">натисніть, щоб змінити</div>
    </template>
    <template v-else>
      <UIcon
        :name="dragOver ? 'i-lucide-file-up' : 'i-lucide-upload-cloud'"
        class="text-2xl"
        :class="dragOver ? 'text-primary' : 'text-muted'"
      />
      <div class="text-sm mt-1.5">
        <span class="font-medium text-default">{{ props.hint }}</span>
      </div>
      <div class="text-xs text-muted">або</div>
      <UButton size="xs" variant="outline" class="mt-1.5" @click.stop="pick">
        Обрати файл
      </UButton>
    </template>
  </div>
</template>
