<script setup lang="ts">
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { logout } = useAuth()
</script>

<template>
  <aside class="w-64 flex-shrink-0 border-r border-default flex flex-col">
    <div class="p-4 border-b border-default flex items-center gap-2">
      <UIcon name="i-lucide-shield" class="text-primary text-xl" />
      <div>
        <div class="font-semibold text-sm">Діловод</div>
        <div class="text-xs text-muted">СЕД · ДСТУ 4163</div>
      </div>
    </div>

    <div class="p-3 space-y-2">
      <UButton block icon="i-lucide-plus" @click="store.newDocument()">
        Додати документ
      </UButton>
      <UButton block variant="soft" icon="i-lucide-scan-line" @click="store.openScanModal()">
        Залити скан
      </UButton>
    </div>

    <div class="px-3 pb-2">
      <UInput
        v-model="store.searchQuery.value"
        icon="i-lucide-search"
        placeholder="Пошук…"
        size="sm"
      />
    </div>

    <nav class="flex-1 overflow-y-auto px-2">
      <div class="text-xs font-medium text-muted uppercase px-2 py-1 mt-2">
        Розділи
      </div>
      <UButton
        v-for="cat in [
          { id: 'all', label: 'Всі документи', icon: 'i-lucide-files' },
          { id: 'calendar', label: 'Календар', icon: 'i-lucide-calendar-days' },
          { id: 'favorites', label: 'Обрані', icon: 'i-lucide-star' },
          { id: 'archive', label: 'Архів', icon: 'i-lucide-archive' }
        ]"
        :key="cat.id"
        block
        variant="ghost"
        :color="store.activeCategory.value === cat.id ? 'primary' : 'neutral'"
        :icon="cat.icon"
        class="justify-start mb-0.5"
        @click="cat.id === 'calendar' ? store.openCalendar() : (store.activeCategory.value = cat.id)"
      >
        {{ cat.label }}
        <UBadge v-if="cat.id === 'all'" :label="String(store.activeCount.value)" variant="subtle" size="xs" class="ml-auto" />
        <UBadge v-else-if="cat.id === 'favorites' && store.favorites.value.size" :label="String(store.favorites.value.size)" color="warning" variant="subtle" size="xs" class="ml-auto" />
        <UBadge v-else-if="cat.id === 'archive' && store.archivedCount.value" :label="String(store.archivedCount.value)" variant="subtle" size="xs" class="ml-auto" />
      </UButton>

      <!-- ПАПКИ-КАТЕГОРІЇ -->
      <div class="flex items-center justify-between px-2 py-1 mt-3">
        <span class="text-xs font-medium text-muted uppercase">Папки</span>
        <UButton
          icon="i-lucide-plus"
          variant="ghost"
          color="neutral"
          size="xs"
          title="Створити папку"
          @click="store.openCreateFolder()"
        />
      </div>

      <UButton
        block
        variant="ghost"
        :color="store.activeCategory.value === 'folder' && store.activeFolderId.value === null ? 'primary' : 'neutral'"
        icon="i-lucide-folder-x"
        class="justify-start mb-0.5"
        @click="store.selectFolder(null)"
      >
        Без папки
        <UBadge v-if="store.noFolderCount.value" :label="String(store.noFolderCount.value)" variant="subtle" size="xs" class="ml-auto" />
      </UButton>

      <div
        v-for="f in store.folders.value"
        :key="f.id"
        class="group flex items-center mb-0.5"
      >
        <UButton
          variant="ghost"
          :color="store.activeCategory.value === 'folder' && store.activeFolderId.value === f.id ? 'primary' : 'neutral'"
          class="justify-start flex-1 min-w-0"
          :title="f.name"
          @click="store.selectFolder(f.id)"
        >
          <span
            class="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
            :style="{ backgroundColor: store.folderDotColor(f.color) }"
          />
          <span class="truncate flex-1 text-left">{{ f.name }}</span>
          <UBadge
            v-if="f.doc_count"
            :label="String(f.doc_count)"
            variant="subtle"
            size="xs"
            class="ml-auto"
          />
        </UButton>
        <UDropdownMenu :items="store.folderMenuItems(f)" :ui="{ content: 'w-44' }">
          <UButton
            icon="i-lucide-ellipsis-vertical"
            variant="ghost"
            color="neutral"
            size="xs"
            class="flex-shrink-0 opacity-0 group-hover:opacity-100"
            title="Дії з папкою"
            @click.stop
          />
        </UDropdownMenu>
      </div>

      <div v-if="store.folders.value.length === 0" class="px-2 py-1 text-xs text-muted">
        Папок ще немає
      </div>
    </nav>

    <div class="p-3 border-t border-default">
      <div class="text-xs text-muted mb-1">
        {{ useAuth().user?.value?.name || useAuth().user?.value?.email }}
      </div>
      <UButton block variant="ghost" color="neutral" icon="i-lucide-log-out" size="sm" @click="logout(); navigateTo('/login')">
        Вийти
      </UButton>
    </div>
  </aside>
</template>
