<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()

const searchQuery = ref('')

const filteredUsers = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.users.value
  return store.users.value.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    (u.position && u.position.toLowerCase().includes(q))
  )
})

onMounted(() => {
  store.reloadUsers()
})
</script>

<template>
  <div class="max-w-6xl mx-auto p-6 space-y-6">
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary flex-shrink-0">
          <UIcon name="i-lucide-user-cog" class="text-2xl" />
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight">Користувачі</h1>
          <p class="text-xs text-muted">Діючі облікові записи системи — погоджувачі, підписанти та виконавці доручень</p>
        </div>
      </div>
      <UButton
        icon="i-lucide-user-plus"
        @click="store.openCreateUser()"
      >
        Додати користувача
      </UButton>
    </div>

    <!-- Тулбар пошуку -->
    <div class="flex items-center gap-3">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Пошук за іменем, email або посадою..."
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

    <!-- Таблиця -->
    <UCard :ui="{ body: 'p-0 overflow-x-auto' }">
      <div v-if="filteredUsers.length === 0" class="flex flex-col items-center justify-center py-12 text-center text-muted">
        <UIcon name="i-lucide-users" class="text-5xl mb-3 opacity-20" />
        <div class="font-medium text-sm">Нічого не знайдено</div>
        <p class="text-xs text-muted max-w-xs mt-1">
          {{ searchQuery ? 'Спробуйте змінити пошуковий запит' : 'Додайте першого користувача, скориставшись кнопкою зверху' }}
        </p>
      </div>

      <table v-else class="w-full text-left border-collapse text-sm min-w-[700px]">
        <thead>
          <tr class="border-b border-default bg-elevated/30 text-xs font-semibold text-muted uppercase tracking-wider select-none">
            <th class="py-3 px-4 w-1/3">Користувач</th>
            <th class="py-3 px-4 w-1/3">Email</th>
            <th class="py-3 px-4 w-1/4">Посада</th>
            <th class="py-3 px-4 w-24 text-right">Дії</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="u in filteredUsers"
            :key="u.id"
            class="border-b border-default hover:bg-elevated/40 transition-colors"
          >
            <td class="py-4 px-4">
              <div class="flex items-center gap-3">
                <div class="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary text-sm font-semibold flex-shrink-0">
                  {{ u.name.charAt(0).toUpperCase() }}
                </div>
                <div class="font-semibold text-default">{{ u.name }}</div>
              </div>
            </td>
            <td class="py-4 px-4">
              <a :href="`mailto:${u.email}`" class="text-xs text-default hover:underline flex items-center gap-1.5">
                <UIcon name="i-lucide-mail" class="text-muted flex-shrink-0" />
                {{ u.email }}
              </a>
            </td>
            <td class="py-4 px-4">
              <span v-if="u.position" class="text-xs text-default">{{ u.position }}</span>
              <span v-else class="text-xs text-muted italic">Не вказано</span>
            </td>
            <td class="py-4 px-4 text-right">
              <div class="flex items-center justify-end gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  variant="ghost"
                  color="neutral"
                  size="xs"
                  title="Редагувати"
                  @click="store.openEditUser(u)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  variant="ghost"
                  color="error"
                  size="xs"
                  title="Видалити"
                  @click="store.deleteUser(u)"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
