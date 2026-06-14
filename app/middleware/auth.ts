/**
 * Route middleware: захищає сторінки що потребують авторизації.
 * Виконується тільки на клієнті — токен живе в localStorage.
 */
export default defineNuxtRouteMiddleware(() => {
  // На сервері пропускаємо — перевірка відбудеться на клієнті після гідратації
  if (import.meta.server) return

  const { isLoggedIn } = useAuth()
  if (!isLoggedIn.value) {
    return navigateTo('/login')
  }
})
