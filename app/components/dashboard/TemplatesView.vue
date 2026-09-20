<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { TEMPLATE_CATEGORIES, type DocTemplate } from '~/composables/dashboard/useTemplates'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import TemplateCard from './templates/TemplateCard.vue'
import TemplatePreviewDrawer from './templates/TemplatePreviewDrawer.vue'
import TemplateEditModal from './templates/TemplateEditModal.vue'

const store = useDashboard()

// ── стан ──────────────────────────────────────────────────────────────
const activeCat   = ref('all')
const searchQuery = ref('')
const previewTpl  = ref<DocTemplate | null>(null)

// ── форма створення/редагування ───────────────────────────────────────
const editOpen  = ref(false)
const editIsNew = ref(false)
const editForm  = ref<Partial<DocTemplate>>({})

function openCreate() {
  editIsNew.value = true
  editForm.value  = {
    category: activeCat.value === 'all' ? 'lystuvannya' : activeCat.value,
    doc_type: '',
    subject_type: 'legal',
    title: '',
    description: '',
    icon: 'i-lucide-file-text',
    title_tpl: '',
    body: '',
    addressees: '',
    sender_contacts: '',
    sort_order: 0,
  }
  editOpen.value = true
}

function openEdit(tpl: DocTemplate) {
  editIsNew.value = false
  editForm.value  = { ...tpl }
  editOpen.value  = true
  previewTpl.value = null
}

async function submitEdit() {
  if (editIsNew.value) {
    await store.createTemplate(editForm.value)
  } else {
    await store.saveTemplate(editForm.value as DocTemplate)
  }
  editOpen.value = false
}

// ── фільтрація ────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list = activeCat.value === 'all'
    ? store.docTemplates.value
    : store.docTemplates.value.filter(t => t.category === activeCat.value)
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.doc_type.toLowerCase().includes(q)
    )
  }
  return list
})

function countByCategory(catId: string) {
  if (catId === 'all') return store.docTemplates.value.length
  return store.docTemplates.value.filter(t => t.category === catId).length
}

function applyTemplate(tpl: DocTemplate) {
  store.form.doc_type        = tpl.doc_type
  store.form.subject_type    = tpl.subject_type
  store.form.title           = tpl.title_tpl || tpl.title
  store.form.body            = tpl.body
  if (tpl.addressees) {
    store.form.addressees    = tpl.addressees
  }
  if (tpl.sender_contacts) {
    store.form.sender_contacts = tpl.sender_contacts
  }
  store.activeCategory.value = 'all'
  store.selectedId.value     = null
  store.creatingDoc.value    = true
}

onMounted(() => {
  store.reloadTemplates()
})
</script>

<template>
  <div class="flex h-full overflow-hidden bg-background">

    <!-- ── Ліва колонка: категорії ─────────────────────────────────── -->
    <aside class="w-56 border-r border-default flex flex-col bg-neutral-50 dark:bg-neutral-900/50 flex-shrink-0">
      <div class="p-3 border-b border-default">
        <div class="text-xs font-semibold text-muted uppercase tracking-wider px-2">Категорії</div>
      </div>

      <nav class="flex-1 overflow-y-auto p-2 space-y-0.5">
        <button
          v-for="cat in TEMPLATE_CATEGORIES"
          :key="cat.id"
          class="w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors text-left"
          :class="activeCat === cat.id
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-default'"
          @click="activeCat = cat.id; previewTpl = null"
        >
          <div class="flex items-center gap-2 min-w-0">
            <UIcon :name="cat.icon" class="text-sm flex-shrink-0" />
            <span class="truncate">{{ cat.label }}</span>
          </div>
          <UBadge
            :label="String(countByCategory(cat.id))"
            variant="subtle"
            size="xs"
            color="neutral"
            class="ml-1 flex-shrink-0 font-mono text-[10px]"
          />
        </button>
      </nav>

      <!-- Кнопка «Додати шаблон» -->
      <div class="p-3 border-t border-default">
        <UButton block icon="i-lucide-plus" size="sm" @click="openCreate()">
          Додати шаблон
        </UButton>
      </div>
    </aside>

    <!-- ── Права область ───────────────────────────────────────────── -->
    <div class="flex-1 flex flex-col overflow-hidden">

      <!-- Заголовок + пошук -->
      <div class="p-4 border-b border-default flex items-center gap-3">
        <div class="flex-1">
          <div class="font-semibold text-base">
            {{ TEMPLATE_CATEGORIES.find(c => c.id === activeCat)?.label ?? 'Всі шаблони' }}
          </div>
          <div class="text-xs text-muted mt-0.5">
            {{ filtered.length }} шаблонів
          </div>
        </div>
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Пошук шаблону…"
          size="sm"
          class="w-64"
        />
      </div>

      <!-- Сітка + панель перегляду -->
      <div class="flex flex-1 overflow-hidden">

        <!-- Картки шаблонів -->
        <div class="flex-1 overflow-y-auto p-4">

          <!-- Завантаження -->
          <div v-if="!store.templatesLoaded.value" class="flex items-center justify-center h-full text-muted">
            <UIcon name="i-lucide-loader-circle" class="text-3xl animate-spin" />
          </div>

          <!-- Порожньо -->
          <div
            v-else-if="filtered.length === 0"
            class="flex items-center justify-center h-full text-muted"
          >
            <div class="text-center">
              <UIcon name="i-lucide-search-x" class="text-4xl mb-2 opacity-30" />
              <div class="text-sm">Шаблонів не знайдено</div>
              <UButton class="mt-4" size="sm" icon="i-lucide-plus" @click="openCreate()">
                Створити шаблон
              </UButton>
            </div>
          </div>

          <!-- Сітка -->
          <div
            v-else
            class="grid gap-3"
            style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))"
          >
            <TemplateCard
              v-for="tpl in filtered"
              :key="tpl.id"
              :tpl="tpl"
              :is-selected="previewTpl?.id === tpl.id"
              @select="previewTpl = $event"
              @preview="previewTpl = $event"
              @apply="applyTemplate($event)"
              @edit="openEdit($event)"
              @delete="store.deleteTemplate($event); if (previewTpl?.id === $event.id) previewTpl = null"
            />
          </div>
        </div>

        <!-- Панель швидкого перегляду -->
        <transition name="drawer">
          <TemplatePreviewDrawer
            v-if="previewTpl"
            :tpl="previewTpl"
            @close="previewTpl = null"
            @apply="applyTemplate($event)"
            @duplicate="store.duplicateTemplate($event)"
            @edit="openEdit($event)"
            @delete="store.deleteTemplate($event); previewTpl = null"
          />
        </transition>
      </div>
    </div>

    <!-- Модальне вікно створення/редагування -->
    <TemplateEditModal
      v-model:open="editOpen"
      :edit-is-new="editIsNew"
      :edit-form="editForm"
      :loading="store.savingTemplate.value"
      @submit="submitEdit()"
    />

  </div>
</template>
