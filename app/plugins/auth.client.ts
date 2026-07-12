/**
 * Клієнтський plugin — відновлює auth стан із localStorage до першого рендеру.
 * Виконується тільки на клієнті (суфікс .client.ts).
 * Завдяки цьому middleware бачить токен при навігації на клієнті,
 * а SSR middleware пропускається для захищених сторінок через routeRules: ssr: false.
 *
 * Спершу синхронно гідруємо з localStorage (щоб UI малювався одразу), тоді
 * асинхронно підтягуємо свіжий профіль з /auth/me — це підхоплює нові поля
 * (напр. phone/address) та зміни, внесені в іншій вкладці, без logout/login.
 * Сталь-кеш dilovod_user був причиною того, що у блок «від кого» підставлявся
 * лише email (старий запис без phone/address).
 */
export default defineNuxtPlugin(() => {
  const token = useState<string | null>('auth_token', () => null)
  const user = useState<{ email: string; name: string } | null>('auth_user', () => null)

  const stored = localStorage.getItem('dilovod_token')
  const storedUser = localStorage.getItem('dilovod_user')

  if (stored) {
    token.value = stored
    try {
      user.value = storedUser ? JSON.parse(storedUser) : null
    }
    catch {
      user.value = null
    }

    // Свіже читання профілю з бекенду (не блокує перший рендер).
    const apiBase = (useRuntimeConfig().public.apiBase as string) || 'http://localhost:8000'
    $fetch<{ email: string; name: string }>('/auth/me', { baseURL: apiBase, headers: { Authorization: `Bearer ${stored}` } })
      .then((fresh) => {
        user.value = fresh
        localStorage.setItem('dilovod_user', JSON.stringify(fresh))
      })
      .catch(() => {
        // 401/мережа — лишаємо кешований стан; apiFetch у useAuth сам повикидає
        // logout+redirect при наступному запиті, якщо токен дійсно мертвий.
      })
  }
})
