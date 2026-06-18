import { computed } from 'vue'

/**
 * Ролі користувача — похідні від useAuth().user.role.
 *
 * Роль встановлюється на бекенді (UserRole: admin/director/accountant/clerk) і
 * приходить у JWT + login-відповіді. Тут лише тонкий шар computed для
 * використання в компонентах: canEditDoc(docStatus), canSign, canManageUsers тощо.
 *
 * Бекенд — єдине джерело істини (там _assert_editable / _require_role). Ці
 * computed лише ховають/показують UI; жодна дія не довіряє лише фронтовій перевірці.
 */

/** Чи може користувач з роллю `role` редагувати документ у статусі `docStatus`.
 *  admin — завжди (службовий обхід). Інакше — лише draft.
 *  Порожній статус ('') — це режим створення чернетки, теж editable. */
export function canRoleEdit(role: string | null | undefined, docStatus: string): boolean {
  if (role === 'admin') return true
  return docStatus === 'draft' || docStatus === ''
}

export function useRoles() {
  const { user } = useAuth()
  const role = computed(() => user.value?.role ?? 'clerk')

  const isAdmin = computed(() => role.value === 'admin')
  const canManageUsers = computed(() => role.value === 'admin')

  /** Чи може подавати документ у потік (погодження/підпис). clerk — лише чернетки. */
  const canSubmit = computed(() =>
    ['admin', 'director', 'accountant'].includes(role.value)
  )

  /** Чи має право підписувати КЕП (уточнюється per-doc у KeypadPanel). */
  const canSign = computed(() => role.value !== 'clerk')

  /** Блокувати форму документа: true коли статус не-draft і юзер не admin. */
  function isDocLocked(docStatus: string): boolean {
    return !canRoleEdit(role.value, docStatus)
  }

  return {
    role,
    isAdmin,
    canManageUsers,
    canSubmit,
    canSign,
    canRoleEdit,
    isDocLocked
  }
}
