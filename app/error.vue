<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps({
  error: {
    type: Object as PropType<NuxtError>,
    required: true
  }
})

useHead({
  htmlAttrs: {
    lang: 'uk'
  }
})

useSeoMeta({
  title: 'Помилка',
  description: 'Сталася помилка під час обробки сторінки.'
})
</script>

<template>
  <div>
    <UMain>
      <UContainer>
        <UPage>
          <UError :error="error" />
        </UPage>
      </UContainer>
    </UMain>

    <UToaster />
  </div>
</template>
