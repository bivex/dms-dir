<script setup lang="ts">
// Внутрішня СЕД «Діловод» — публічного лендингу немає.
// Кореневий маршрут одразу переадресовує на вхід у систему.
definePageMeta({ layout: false })
await navigateTo('/login', { replace: true })
</script>

<template>
  <div />
</template>
