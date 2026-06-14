/**
 * Auth composable — SSR-safe через useState + localStorage гідратація на клієнті.
 *
 * useState дає спільний стан між SSR і клієнтом (гідрація без мерехтіння).
 * localStorage читається тільки на клієнті через plugin або onMounted.
 */
export function useAuth() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  // useState — SSR-safe, спільний між сервером і клієнтом після гідратації
  const token = useState<string | null>('auth_token', () => null)
  const user = useState<{ email: string; name: string } | null>('auth_user', () => null)

  // На клієнті відновлюємо стан із localStorage (після гідратації)
  if (import.meta.client && token.value === null) {
    const stored = localStorage.getItem('dilovod_token')
    const storedUser = localStorage.getItem('dilovod_user')
    if (stored) {
      token.value = stored
      try {
        user.value = storedUser ? JSON.parse(storedUser) : null
      }
      catch { user.value = null }
    }
  }

  const isLoggedIn = computed(() => !!token.value)

  async function login(email: string, password: string): Promise<void> {
    const res = await $fetch<{ token: string; user: { email: string; name: string } }>(
      `${apiBase}/auth/login`,
      { method: 'POST', body: { email, password } }
    )
    token.value = res.token
    user.value = res.user
    if (import.meta.client) {
      localStorage.setItem('dilovod_token', res.token)
      localStorage.setItem('dilovod_user', JSON.stringify(res.user))
    }
  }

  function logout() {
    token.value = null
    user.value = null
    if (import.meta.client) {
      localStorage.removeItem('dilovod_token')
      localStorage.removeItem('dilovod_user')
    }
  }

  async function apiFetch<T>(path: string, opts: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    return $fetch<T>(`${apiBase}${path}`, {
      ...opts,
      headers: {
        ...(opts.headers as Record<string, string> | undefined),
        ...(token.value ? { Authorization: `Bearer ${token.value}` } : {})
      }
    })
  }

  return { isLoggedIn, user, token, login, logout, apiFetch }
}
