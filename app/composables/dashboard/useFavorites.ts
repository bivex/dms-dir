import type { Ref } from 'vue'

/**
 * Обрані документи — персональна позначка у localStorage (Idb-free).
 * Стан живе в composable (один інстанс на сторінку через provide/inject).
 */
export function useFavorites() {
  const favorites = ref<Set<string>>(new Set())

  function loadFavorites() {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('dilovod_favorites')
      favorites.value = new Set(raw ? JSON.parse(raw) : [])
    }
    catch {
      favorites.value = new Set()
    }
  }

  function persistFavorites() {
    if (typeof window === 'undefined') return
    localStorage.setItem('dilovod_favorites', JSON.stringify([...favorites.value]))
  }

  function toggleFavorite(docId: string) {
    const next = new Set(favorites.value)
    if (next.has(docId)) next.delete(docId)
    else next.add(docId)
    favorites.value = next
    persistFavorites()
  }

  function removeFromFavorites(docId: string) {
    if (!favorites.value.has(docId)) return
    const next = new Set(favorites.value)
    next.delete(docId)
    favorites.value = next
    persistFavorites()
  }

  function isFavorite(docId: string): boolean {
    return favorites.value.has(docId)
  }

  return { favorites: favorites as Ref<Set<string>>, loadFavorites, persistFavorites, toggleFavorite, removeFromFavorites, isFavorite }
}
