<script setup lang="ts">
const colorMode = useColorMode()

const isDark = computed({
  get() {
    return colorMode.value === 'dark'
  },
  set(value) {
    colorMode.preference = value ? 'dark' : 'light'
  }
})
</script>

<template>
  <UButton
    block
    variant="ghost"
    color="neutral"
    size="sm"
    class="justify-start"
    :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
    :title="isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'"
    @click="isDark = !isDark"
  >
    {{ isDark ? 'Темна тема' : 'Світла тема' }}
  </UButton>
</template>
