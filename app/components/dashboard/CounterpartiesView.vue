<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

const searchQuery = ref('')

const filteredCounterparties = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.counterparties.value
  return store.counterparties.value.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.code.toLowerCase().includes(q) ||
    (c.email && c.email.toLowerCase().includes(q)) ||
    (c.phone && c.phone.toLowerCase().includes(q)) ||
    (c.address && c.address.toLowerCase().includes(q))
  )
})

function getSubjectTypeLabel(type: string) {
  if (type === 'legal') return 'Юридична особа'
  if (type === 'fop') return 'ФОП'
  if (type === 'person') return 'Фізична особа'
  return type
}

function getSubjectTypeColor(type: string) {
  if (type === 'legal') return 'primary'
  if (type === 'fop') return 'warning'
  if (type === 'person') return 'success'
  return 'neutral'
}

onMounted(() => {
  store.reloadCounterparties()
})
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary flex-shrink-0">
          <UIcon name="i-lucide-users" class="text-2xl" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight">Контрагенти</h1>
          <p class="text-xs text-muted">Керування зовнішніми організаціями та фізособами для швидкого автозаповнення в документах</p>
        </div>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        @click="store.openCreateCounterparty()"
      >
        Додати контрагента
      </UButton>
    </div>

    <!-- Тулбар пошуку -->
    <div class="flex items-center gap-3">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Пошук контрагентів за назвою, кодом, контактами..."
        class="flex-1"
        size="md"
      />
      <UButton
        v-if="searchQuery"
        variant="ghost"
        color="neutral"
        icon="i-lucide-x"
        size="md"
        @click="searchQuery = ''"
      />
    </div>

    <!-- Таблиця / Список -->
    <UCard :ui="{ body: 'p-0 overflow-x-auto' }">
      <div v-if="filteredCounterparties.length === 0" class="flex flex-col items-center justify-center py-12 text-center text-muted">
        <UIcon name="i-lucide-users" class="text-5xl mb-3 opacity-20" />
        <div class="font-medium text-sm">Нічого не знайдено</div>
        <p class="text-xs text-muted max-w-xs mt-1">
          {{ searchQuery ? 'Спробуйте змінити пошуковий запит' : 'Додайте свого першого контрагента, скориставшись кнопкою зверху' }}
        </p>
      </div>

      <table v-else class="w-full text-left border-collapse text-sm min-w-[800px]">
        <thead>
          <tr class="border-b border-default bg-elevated/30 text-xs font-semibold text-muted uppercase tracking-wider select-none">
            <th class="py-3 px-4 w-1/3">Найменування / Код</th>
            <th class="py-3 px-4 w-1/6">Тип суб'єкта</th>
            <th class="py-3 px-4 w-1/4">Контакти</th>
            <th class="py-3 px-4 w-1/4">Адреса</th>
            <th class="py-3 px-4 w-24 text-right">Дії</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in filteredCounterparties"
            :key="c.id"
            class="border-b border-default hover:bg-elevated/40 transition-colors"
          >
            <td class="py-4 px-4">
              <div class="font-semibold text-default">{{ c.name }}</div>
              <div class="text-xs text-muted font-mono mt-0.5">Код: {{ c.code }}</div>
            </td>
            <td class="py-4 px-4">
              <UBadge
                :label="getSubjectTypeLabel(c.subject_type)"
                :color="getSubjectTypeColor(c.subject_type)"
                variant="subtle"
                size="xs"
              />
            </td>
            <td class="py-4 px-4 space-y-0.5">
              <div v-if="c.email" class="flex items-center gap-1.5 text-xs text-default">
                <UIcon name="i-lucide-mail" class="text-muted flex-shrink-0" />
                <a :href="`mailto:${c.email}`" class="hover:underline">{{ c.email }}</a>
              </div>
              <div v-if="c.phone" class="flex items-center gap-1.5 text-xs text-default">
                <UIcon name="i-lucide-phone" class="text-muted flex-shrink-0" />
                <span>{{ c.phone }}</span>
              </div>
              <div v-if="!c.email && !c.phone" class="text-xs text-muted italic">
                Не вказано
              </div>
            </td>
            <td class="py-4 px-4">
              <div class="text-xs text-default max-w-[250px] truncate" :title="c.address || ''">
                {{ c.address || '—' }}
              </div>
            </td>
            <td class="py-4 px-4 text-right">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  title="Редагувати"
                  @click="store.openEditCounterparty(c)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  size="xs"
                  title="Видалити"
                  @click="store.deleteCounterparty(c)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
