import type { Ref } from 'vue'
import type { UserEntry } from './types'

/**
 * Користувачі системи — список діючих юзерів з БД + CRUD.
 * Використовується і для вибору погоджувачів/виконавців, і для розділу «Користувачі».
 */
export function useUsers(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const users = ref<UserEntry[]>([])
  const usersLoaded = ref(false)

  // modal state
  const userModalOpen = ref(false)
  const userModalMode = ref<'create' | 'edit'>('create')
  const userEditId = ref<number | null>(null)
  const userSaving = ref(false)
  const currentEditingUser = ref<UserEntry | null>(null)

  const userForm = reactive({
    name: '',
    email: '',
    position: '',
    role: 'clerk',
    password: ''
  })

  async function reloadUsers() {
    try {
      const res = await apiFetch<UserEntry[]>('/users')
      users.value = Array.isArray(res) ? res : []
      usersLoaded.value = true
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка завантаження користувачів', description: String(e), color: 'error' })
    }
  }

  function openCreateUser() {
    userModalMode.value = 'create'
    userEditId.value = null
    currentEditingUser.value = null
    userForm.name = ''
    userForm.email = ''
    userForm.position = ''
    userForm.role = 'clerk'
    userForm.password = ''
    userModalOpen.value = true
  }

  function openEditUser(u: UserEntry) {
    userModalMode.value = 'edit'
    userEditId.value = u.id
    currentEditingUser.value = u
    userForm.name = u.name
    userForm.email = u.email
    userForm.position = u.position || ''
    userForm.role = u.role || 'clerk'
    userForm.password = ''
    userModalOpen.value = true
  }

  async function saveUser() {
    const name = userForm.name.trim()
    const email = userForm.email.trim()

    if (!name) {
      toast.add({ title: 'Введіть імʼя користувача', color: 'warning' })
      return
    }
    if (!email) {
      toast.add({ title: 'Введіть email', color: 'warning' })
      return
    }
    if (userModalMode.value === 'create' && !userForm.password.trim()) {
      toast.add({ title: 'Введіть пароль для нового користувача', color: 'warning' })
      return
    }

    userSaving.value = true
    try {
      if (userModalMode.value === 'create') {
        await apiFetch('/users', {
          method: 'POST',
          body: {
            name,
            email,
            position: userForm.position.trim(),
            role: userForm.role,
            password: userForm.password.trim()
          }
        })
        toast.add({ title: 'Користувача додано успішно', color: 'success' })
      }
      else if (userEditId.value !== null) {
        const body: Record<string, string> = {
          name,
          email,
          position: userForm.position.trim(),
          role: userForm.role
        }
        // пароль шлемо лише якщо введений (зміна паролю)
        if (userForm.password.trim()) body.password = userForm.password.trim()
        await apiFetch(`/users/${userEditId.value}`, {
          method: 'PUT',
          body
        })
        toast.add({ title: 'Користувача оновлено успішно', color: 'success' })
      }
      userModalOpen.value = false
      await reloadUsers()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка збереження користувача', description: String(e), color: 'error' })
    }
    finally {
      userSaving.value = false
    }
  }

  async function deleteUser(u: UserEntry) {
    if (!confirm(`Видалити користувача «${u.name}» (${u.email})?`)) return
    try {
      await apiFetch(`/users/${u.id}`, { method: 'DELETE' })
      toast.add({ title: 'Користувача видалено', color: 'success' })
      await reloadUsers()
    }
    catch (e: unknown) {
      toast.add({ title: 'Помилка видалення користувача', description: String(e), color: 'error' })
    }
  }

  return {
    users: users as Ref<UserEntry[]>,
    usersLoaded,
    userModalOpen,
    userModalMode,
    userEditId,
    userSaving,
    userForm,
    currentEditingUser,
    reloadUsers,
    openCreateUser,
    openEditUser,
    saveUser,
    deleteUser
  }
}
