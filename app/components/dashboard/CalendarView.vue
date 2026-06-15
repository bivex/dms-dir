<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
</script>

<template>
  <div class="max-w-3xl mx-auto p-6">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-calendar-days" class="text-primary text-xl" />
        <div>
          <div class="font-semibold">Календар документів</div>
          <div class="text-xs text-muted">за датою реєстрації</div>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <UButton icon="i-lucide-chevron-left" variant="ghost" color="neutral" size="sm" @click="store.calPrevMonth()" />
        <span class="text-sm font-medium w-36 text-center select-none">{{ store.calMonthLabel.value }}</span>
        <UButton icon="i-lucide-chevron-right" variant="ghost" color="neutral" size="sm" @click="store.calNextMonth()" />
        <UButton variant="soft" size="xs" class="ml-2" @click="store.calToday()">
          Сьогодні
        </UButton>
      </div>
    </div>

    <UCard :ui="{ body: 'p-3 sm:p-4' }">
      <div class="grid grid-cols-7 gap-1 mb-1">
        <div
          v-for="wd in store.UA_WEEKDAYS"
          :key="wd"
          class="text-center text-xs font-medium text-muted py-1"
        >
          {{ wd }}
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="cell in store.calGrid.value"
          :key="cell.key"
          type="button"
          class="relative aspect-square rounded-md flex flex-col items-center justify-center text-sm transition-colors border border-transparent"
          :class="[
            cell.inMonth ? 'text-default' : 'text-muted/40',
            cell.count > 0 ? 'cursor-pointer hover:bg-elevated hover:border-default' : 'cursor-default',
            store.selectedDay.value === cell.key ? 'bg-primary/15 border-primary text-primary font-semibold' : '',
            cell.isToday && store.selectedDay.value !== cell.key ? 'ring-1 ring-inset ring-primary/40' : ''
          ]"
          @click="store.pickDay(cell)"
        >
          <span>{{ cell.day }}</span>
          <span
            v-if="cell.count > 0"
            class="mt-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] leading-4 font-medium"
            :class="store.selectedDay.value === cell.key ? 'bg-primary text-inverted' : 'bg-primary/20 text-primary'"
          >
            {{ cell.count }}
          </span>
        </button>
      </div>
    </UCard>

    <div class="mt-4 flex items-center gap-2 text-sm">
      <template v-if="store.selectedDay.value">
        <UIcon name="i-lucide-filter" class="text-primary" />
        <span class="text-muted">Показано документи за <strong class="text-default">{{ store.selectedDayLabel.value }}</strong> ({{ store.filteredDocs.value.length }})</span>
        <UButton variant="ghost" color="neutral" size="xs" icon="i-lucide-x" @click="store.selectedDay.value = null">
          Скинути
        </UButton>
      </template>
      <template v-else>
        <UIcon name="i-lucide-info" class="text-muted" />
        <span class="text-muted">Оберіть день з документами — список зліва відфільтрується.</span>
      </template>
    </div>
  </div>
</template>
