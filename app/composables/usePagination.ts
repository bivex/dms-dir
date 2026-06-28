import { computed, ref, watch } from 'vue'

/**
 * Проста клієнтська пагінація для списків (документи, користувачі тощо).
 *
 * Повертає reactive-стан: поточна сторінка, розмір сторінки, sliced-список,
 * загальну к-сть сторінок і prev/next. Скидання page=1 при зміні джерела
 * (source) автоматично — щоб новий фільтр/пошук не залишав користувача на
 * порожній далекій сторінці.
 *
 * Приклад:
 *   const { page, pageSize, paged, totalPages, prev, next } = usePagination(() => filteredDocs.value, 20)
 *   <div v-for="d in paged">...</div>
 *   <UPagination :page="page" :total="totalPages" @update:page="page = $event" />
 */
export function usePagination<T>(
  source: () => T[],
  pageSize = 20,
) {
  const page = ref(1)
  const total = computed(() => source().length)
  const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

  // Скидати на 1-шу сторінку при зміні джерела (фільтр/пошук) — інакше користувач
  // може опинитись на порожній сторінці після звуження списку.
  watch(total, (n, old) => {
    if (page.value > totalPages.value) page.value = 1
    else if (n !== old) page.value = 1
  })

  const paged = computed(() => {
    const all = source()
    const start = (page.value - 1) * pageSize
    return all.slice(start, start + pageSize)
  })

  const prev = () => { if (page.value > 1) page.value-- }
  const next = () => { if (page.value < totalPages.value) page.value++ }
  const from = computed(() => total.value === 0 ? 0 : (page.value - 1) * pageSize + 1)
  const to = computed(() => Math.min(page.value * pageSize, total.value))

  return { page, pageSize, paged, total, totalPages, from, to, prev, next }
}
