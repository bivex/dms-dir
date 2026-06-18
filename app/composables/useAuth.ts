/**
 * Auth composable — SSR-safe через useState + localStorage гідратація на клієнті.
 *
 * useState дає спільний стан між SSR і клієнтом (гідрація без мерехтіння).
 * localStorage читається тільки на клієнті через plugin або onMounted.
 */
export interface AuthUser {
  id: number
  email: string
  name: string
  position?: string | null
  role?: string | null
  kep_serial_number?: string | null
  kep_certificate_serial?: string | null
  kep_subject_cn?: string | null
}

export function useAuth() {
  const config = useRuntimeConfig()
  const apiBase = (config.public.apiBase as string) || 'http://localhost:8000'

  // useState — SSR-safe, спільний між сервером і клієнтом після гідратації
  const token = useState<string | null>('auth_token', () => null)
  const user = useState<AuthUser | null>('auth_user', () => null)

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
    const res = await $fetch<{ token: string; user: AuthUser }>(
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

  async function loginWithKep(sigB64: string, challenge: string): Promise<void> {
    const res = await $fetch<{ token: string; user: AuthUser }>(
      `${apiBase}/auth/login-kep`,
      { method: 'POST', body: { challenge, signature_b64: sigB64 } }
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
      },
      onResponseError({ response }) {
        // Токен невалідний/прострочений — чистимо сесію й ведемо на логін,
        // щоб не лишати зламаний дашборд із 401 у консолі.
        if (response.status === 401 && import.meta.client) {
          logout()
          navigateTo('/login')
        }
      }
    })
  }

  return { isLoggedIn, user, token, login, loginWithKep, logout, apiFetch }
}
