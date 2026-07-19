<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { TEMPLATE_CATEGORIES, type DocTemplate } from '~/composables/dashboard/useTemplates'
import { useDashboard } from '~/composables/dashboard/useDashboard'

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

// підрахунок шаблонів по категорії
function catCount(catId: string): number {
  if (catId === 'all') return store.docTemplates.value.length
  return store.docTemplates.value.filter(t => t.category === catId).length
}

// ── колірна схема категорій ───────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  rozporyadchi: 'primary',
  dovidkovi:    'info',
  lystuvannya:  'success',
  zvernennya:   'warning',
  dohovirni:    'secondary',
  normatyvni:   'neutral',
  stylevi:      'amber',
}

function catColor(catId: string) { return CAT_COLOR[catId] ?? 'neutral' }

function categoryLabel(catId: string) {
  return TEMPLATE_CATEGORIES.find(c => c.id === catId)?.label ?? catId
}
function categoryIcon(catId: string) {
  return TEMPLATE_CATEGORIES.find(c => c.id === catId)?.icon ?? 'i-lucide-file'
}

// ── застосувати шаблон → відкрити нову картку документа ──────────────
function applyTemplate(tpl: DocTemplate) {
  store.newDocument()
  store.form.doc_type        = tpl.doc_type
  store.form.subject_type    = tpl.subject_type
  store.form.title           = tpl.title_tpl || tpl.title
  store.form.body            = tpl.body
  store.form.addressees      = tpl.addressees      ?? ''
  store.form.sender_contacts = tpl.sender_contacts ?? ''
  if (tpl.subject_type === 'person') {
    const user = useAuth().user?.value
    if (user?.name) store.form.org_name = `Гр. ${user.name}`
  }
  store.activeCategory.value = 'all'
  previewTpl.value = null
}

onMounted(() => store.reloadTemplates())
</script>

<template>
  <div class="flex h-full overflow-hidden">

    <!-- ── Ліва панель: категорії ──────────────────────────────────── -->
    <aside class="w-56 flex-shrink-0 border-r border-default flex flex-col bg-default/30">
      <div class="p-4 border-b border-default">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-layout-template" class="text-primary text-lg" />
          <span class="font-semibold text-sm">Шаблони документів</span>
        </div>
        <div class="text-xs text-muted mt-0.5">
          {{ store.docTemplates.value.length }} шаблонів у БД
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto p-2 space-y-px">
        <UButton
          v-for="cat in TEMPLATE_CATEGORIES"
          :key="cat.id"
          block
          variant="ghost"
          :color="activeCat === cat.id ? 'primary' : 'neutral'"
          :icon="cat.icon"
          class="justify-start"
          @click="activeCat = cat.id; store.reloadTemplates(cat.id)"
        >
          <span class="flex-1 text-left truncate">{{ cat.label }}</span>
          <UBadge
            :label="String(catCount(cat.id))"
            variant="subtle"
            size="xs"
            class="ml-auto flex-shrink-0"
          />
        </UButton>
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
            <div
              v-for="tpl in filtered"
              :key="tpl.id"
              class="group border border-default rounded-lg p-4 bg-background hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer flex flex-col gap-2"
              :class="{ 'border-primary ring-1 ring-primary/20 bg-primary/5': previewTpl?.id === tpl.id }"
              @click="previewTpl = tpl"
            >
              <!-- Іконка + бейдж -->
              <div class="flex items-start gap-3">
                <div
                  class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  :class="`bg-${catColor(tpl.category)}/10`"
                >
                  <UIcon :name="tpl.icon" :class="`text-${catColor(tpl.category)} text-lg`" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm leading-snug">{{ tpl.title }}</div>
                  <div class="flex items-center gap-1 mt-1 flex-wrap">
                    <UBadge
                      :label="categoryLabel(tpl.category)"
                      :color="catColor(tpl.category) as any"
                      variant="subtle"
                      size="xs"
                    />
                    <UBadge
                      v-if="tpl.is_builtin"
                      label="вбуд."
                      color="neutral"
                      variant="subtle"
                      size="xs"
                    />
                  </div>
                </div>
              </div>

              <!-- Опис -->
              <div class="text-xs text-muted leading-snug line-clamp-2">
                {{ tpl.description || '—' }}
              </div>

              <!-- Вид -->
              <div class="text-[11px] text-muted/70 font-mono truncate">
                {{ tpl.doc_type }}
              </div>

              <!-- Дії (hover) -->
              <div class="flex gap-1.5 mt-auto pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <UButton size="xs" variant="soft" icon="i-lucide-eye" class="flex-1 justify-center" @click.stop="previewTpl = tpl">
                  Переглянути
                </UButton>
                <UButton size="xs" icon="i-lucide-file-plus" class="flex-1 justify-center" @click.stop="applyTemplate(tpl)">
                  Створити
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Панель попереднього перегляду ─────────────────────── -->
        <transition
          enter-active-class="transition-all duration-200"
          enter-from-class="opacity-0 translate-x-4"
          leave-active-class="transition-all duration-150"
          leave-to-class="opacity-0 translate-x-4"
        >
          <aside
            v-if="previewTpl"
            class="w-80 flex-shrink-0 border-l border-default flex flex-col overflow-hidden"
          >
            <!-- Шапка -->
            <div class="p-4 border-b border-default flex items-start gap-2">
              <div
                class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                :class="`bg-${catColor(previewTpl.category)}/10`"
              >
                <UIcon :name="previewTpl.icon" :class="`text-${catColor(previewTpl.category)} text-lg`" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm leading-snug">{{ previewTpl.title }}</div>
                <div class="text-xs text-muted mt-0.5 line-clamp-2">{{ previewTpl.description }}</div>
              </div>
              <UButton icon="i-lucide-x" variant="ghost" color="neutral" size="xs" class="flex-shrink-0" @click="previewTpl = null" />
            </div>

            <!-- Мета -->
            <div class="overflow-y-auto flex-1 p-4 space-y-3 text-sm">
              <div>
                <div class="text-xs text-muted font-medium uppercase mb-1">Вид документа</div>
                <div class="font-mono text-xs bg-elevated px-2 py-1 rounded">{{ previewTpl.doc_type }}</div>
              </div>

              <div>
                <div class="text-xs text-muted font-medium uppercase mb-1">Суб'єкт</div>
                <UBadge
                  :label="previewTpl.subject_type === 'legal' ? 'Юридична особа' : previewTpl.subject_type === 'fop' ? 'ФОП' : 'Фізична особа'"
                  :color="previewTpl.subject_type === 'legal' ? 'primary' : previewTpl.subject_type === 'fop' ? 'warning' : 'info'"
                  variant="subtle"
                  size="xs"
                />
              </div>

              <div>
                <div class="text-xs text-muted font-medium uppercase mb-1">Типовий заголовок</div>
                <div class="text-xs bg-elevated px-2 py-1.5 rounded italic text-muted">{{ previewTpl.title_tpl || '—' }}</div>
              </div>

              <div v-if="previewTpl.addressees">
                <div class="text-xs text-muted font-medium uppercase mb-1">Адресат</div>
                <div class="text-xs bg-elevated px-2 py-1.5 rounded whitespace-pre-line text-muted">{{ previewTpl.addressees }}</div>
              </div>

              <div>
                <div class="text-xs text-muted font-medium uppercase mb-1">Текст документа</div>
                <div class="text-xs bg-elevated px-2 py-2 rounded whitespace-pre-line leading-relaxed max-h-56 overflow-y-auto">{{ previewTpl.body }}</div>
              </div>

              <div>
                <div class="text-xs text-muted font-medium uppercase mb-1">Категорія</div>
                <div class="flex items-center gap-1.5 text-xs text-muted">
                  <UIcon :name="categoryIcon(previewTpl.category)" class="text-sm" />
                  {{ categoryLabel(previewTpl.category) }}
                </div>
              </div>

              <div v-if="previewTpl.is_builtin" class="text-xs text-muted/60 flex items-center gap-1">
                <UIcon name="i-lucide-lock" class="text-xs" />
                Вбудований шаблон — дублюйте, щоб змінити
              </div>
            </div>

            <!-- Дії -->
            <div class="p-3 border-t border-default space-y-1.5">
              <UButton block icon="i-lucide-file-plus" @click="applyTemplate(previewTpl)">
                Створити документ
              </UButton>
              <div class="flex gap-1.5">
                <UButton
                  icon="i-lucide-copy"
                  variant="soft"
                  color="neutral"
                  size="xs"
                  class="flex-1 justify-center"
                  @click="store.duplicateTemplate(previewTpl)"
                >
                  Дублювати
                </UButton>
                <UButton
                  v-if="!previewTpl.is_builtin"
                  icon="i-lucide-pen"
                  variant="soft"
                  size="xs"
                  class="flex-1 justify-center"
                  @click="openEdit(previewTpl)"
                >
                  Редагувати
                </UButton>
                <UButton
                  v-if="!previewTpl.is_builtin"
                  icon="i-lucide-trash-2"
                  variant="soft"
                  color="error"
                  size="xs"
                  @click="store.deleteTemplate(previewTpl); previewTpl = null"
                />
              </div>
            </div>
          </aside>
        </transition>
      </div>
    </div>

    <!-- ── Модальне вікно створення/редагування ───────────────────── -->
    <UModal v-model:open="editOpen" :title="editIsNew ? 'Новий шаблон' : 'Редагувати шаблон'" :ui="{ content: 'max-w-2xl' }">
      <template #body>
        <div class="space-y-4 p-1">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Категорія" class="col-span-1">
              <USelect
                v-model="editForm.category"
                :options="TEMPLATE_CATEGORIES.filter(c => c.id !== 'all').map(c => ({ label: c.label, value: c.id }))"
                class="w-full"
                size="sm"
              />
            </UFormField>
            <UFormField label="Суб'єкт" class="col-span-1">
              <USelect
                v-model="editForm.subject_type"
                :options="[
                  { label: 'Юридична особа', value: 'legal' },
                  { label: 'ФОП', value: 'fop' },
                  { label: 'Фізична особа', value: 'person' },
                ]"
                class="w-full"
                size="sm"
              />
            </UFormField>
          </div>

          <UFormField label="Вид документа" required>
            <UInput v-model="editForm.doc_type" placeholder="Наказ, Лист, Заява…" size="sm" class="w-full" />
          </UFormField>

          <UFormField label="Назва шаблону" required>
            <UInput v-model="editForm.title" placeholder="Назва шаблону для картки" size="sm" class="w-full" />
          </UFormField>

          <UFormField label="Короткий опис">
            <UInput v-model="editForm.description" placeholder="Для чого цей шаблон" size="sm" class="w-full" />
          </UFormField>

          <UFormField label="Типовий заголовок документа">
            <UInput v-model="editForm.title_tpl" placeholder="Про надання відпустки" size="sm" class="w-full" />
          </UFormField>

          <UFormField label="Текст документа" required>
            <UTextarea
              v-model="editForm.body"
              placeholder="Текст з плейсхолдерами [ПІБ], [Дата]…"
              :rows="8"
              class="w-full font-mono text-xs"
              size="sm"
            />
          </UFormField>

          <UFormField label="Адресат (необов'язково)">
            <UTextarea v-model="editForm.addressees" :rows="3" size="sm" class="w-full" placeholder="Директору…" />
          </UFormField>

          <UFormField label="Контакти відправника (необов'язково)">
            <UTextarea v-model="editForm.sender_contacts" :rows="3" size="sm" class="w-full" placeholder="Вулиця, місто, тел…" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2 px-1">
          <UButton color="neutral" variant="ghost" @click="editOpen = false">Скасувати</UButton>
          <UButton
            icon="i-lucide-save"
            :loading="store.savingTemplate.value"
            :disabled="!editForm.title || !editForm.doc_type"
            @click="submitEdit()"
          >
            {{ editIsNew ? 'Створити' : 'Зберегти' }}
          </UButton>
        </div>
      </template>
    </UModal>

  </div>
</template>
