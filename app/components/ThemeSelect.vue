<script setup lang="ts">
const colorMode = useColorMode()

const themes = [
  { label: 'Системна (авто)', value: 'system', icon: 'i-lucide-monitor' },
  { label: 'Світла', value: 'light', icon: 'i-lucide-sun' },
  { label: 'Темна', value: 'dark', icon: 'i-lucide-moon' },
  { label: 'Тепла', value: 'sepia', icon: 'i-lucide-book-open' },
  { label: 'Контрастна', value: 'contrast', icon: 'i-lucide-contrast' },
  { label: 'Офісна', value: 'office', icon: 'i-lucide-building-2' },
  { label: 'Монохромна', value: 'mono', icon: 'i-lucide-circle-dashed' },
  { label: 'Паперова', value: 'paper', icon: 'i-lucide-newspaper' },
  { label: 'Лісова', value: 'sage', icon: 'i-lucide-leaf' },
  { label: 'Архітектурна сіра', value: 'cool-slate', icon: 'i-lucide-landmark' },
  { label: 'Нічна оливкова', value: 'olive', icon: 'i-lucide-coffee' }
]

const selected = computed({
  get: () => colorMode.preference,
  set: (value: string) => { colorMode.preference = value }
})
</script>

<template>
  <USelect
    v-model="selected"
    :items="themes"
    icon="i-lucide-palette"
    size="sm"
    class="w-full"
  />
</template>
