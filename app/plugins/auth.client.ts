/**
 * Клієнтський plugin — відновлює auth стан із localStorage до першого рендеру.
 * Виконується тільки на клієнті (суфікс .client.ts).
 * Завдяки цьому middleware бачить токен при навігації на клієнті,
 * а SSR middleware пропускається для захищених сторінок через routeRules: ssr: false.
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
  }
})
