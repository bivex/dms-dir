/**
 * Шаблони процесуальних документів — завантажуються з API /templates.
 * Підтримує CRUD: список, створення власних, редагування, видалення.
 * Вбудовані шаблони (is_builtin=true) доступні лише для читання.
 */

export interface DocTemplate {
  id: number
  category: string
  doc_type: string
  subject_type: 'legal' | 'fop' | 'person'
  title: string
  description: string
  icon: string
  title_tpl: string
  body: string
  addressees: string
  sender_contacts: string
  is_builtin: boolean
  sort_order: number
  created_at?: string | null
  updated_at?: string | null
}

export interface TemplateCategory {
  id: string
  label: string
  icon: string
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'all',          label: 'Всі шаблони',             icon: 'i-lucide-layout-grid' },
  { id: 'rozporyadchi', label: 'Розпорядчі',              icon: 'i-lucide-gavel' },
  { id: 'dovidkovi',    label: 'Довідково-інформаційні',  icon: 'i-lucide-file-search' },
  { id: 'lystuvannya',  label: 'Листування',              icon: 'i-lucide-mail' },
  { id: 'zvernennya',   label: 'Звернення громадян',       icon: 'i-lucide-message-square-text' },
  { id: 'dohovirni',    label: 'Договірні',               icon: 'i-lucide-handshake' },
  { id: 'normatyvni',   label: 'Нормативні',              icon: 'i-lucide-book-open' },
]

export function useTemplates(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const templates = ref<DocTemplate[]>([])
  const templatesLoaded = ref(false)
  const savingTemplate = ref(false)

  async function reloadTemplates(category?: string) {
    try {
      const params = category && category !== 'all' ? `?category=${category}` : ''
      const res = await apiFetch<{ templates: DocTemplate[] }>(`/templates${params}`)
      templates.value = res.templates ?? []
      templatesLoaded.value = true
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження шаблонів', description: String(e), color: 'error' })
    }
  }

  async function createTemplate(data: Partial<DocTemplate>): Promise<DocTemplate | null> {
    savingTemplate.value = true
    try {
      const res = await apiFetch<DocTemplate>('/templates', { method: 'POST', body: data })
      toast.add({ title: 'Шаблон створено', color: 'success' })
      await reloadTemplates()
      return res
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка створення шаблону', description: String(e), color: 'error' })
      return null
    }
    finally {
      savingTemplate.value = false
    }
  }

  async function saveTemplate(tpl: DocTemplate): Promise<boolean> {
    savingTemplate.value = true
    try {
      await apiFetch(`/templates/${tpl.id}`, { method: 'PUT', body: tpl })
      toast.add({ title: 'Шаблон збережено', color: 'success' })
      await reloadTemplates()
      return true
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка збереження шаблону', description: String(e), color: 'error' })
      return false
    }
    finally {
      savingTemplate.value = false
    }
  }

  async function duplicateTemplate(src: DocTemplate): Promise<DocTemplate | null> {
    return createTemplate({
      ...src,
      id: undefined as any,
      title: `${src.title} (копія)`,
      is_builtin: false,
    })
  }

  async function deleteTemplate(tpl: DocTemplate): Promise<boolean> {
    if (tpl.is_builtin) {
      toast.add({ title: 'Вбудований шаблон не можна видалити', color: 'warning' })
      return false
    }
    if (!confirm(`Видалити шаблон «${tpl.title}»?`)) return false
    try {
      await apiFetch(`/templates/${tpl.id}`, { method: 'DELETE' })
      toast.add({ title: 'Шаблон видалено', color: 'success' })
      await reloadTemplates()
      return true
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення шаблону', description: String(e), color: 'error' })
      return false
    }
  }

  return {
    templates,
    templatesLoaded,
    savingTemplate,
    reloadTemplates,
    createTemplate,
    saveTemplate,
    duplicateTemplate,
    deleteTemplate,
  }
}
