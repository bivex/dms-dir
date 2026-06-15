import type { Ref } from 'vue'
import type { UserEntry } from './types'

/**
 * Список користувачів системи — для вибору погоджувачів/підписантів із реальних юзерів.
 * Патерн як useCounterparties: ref + loaded-прапорець + reloadX().
 */
export function useUsers(deps: {
  apiFetch: ReturnType<typeof useAuth>['apiFetch']
}) {
  const toast = useToast()
  const { apiFetch } = deps

  const users = ref<UserEntry[]>([])
  const usersLoaded = ref(false)

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

  return {
    users: users as Ref<UserEntry[]>,
    usersLoaded,
    reloadUsers
  }
}
