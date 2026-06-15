import type { Ref } from 'vue'
import type { DocEntry } from './types'

/**
 * Календар документів: сітка місяця + фільтр за обраним днем.
 * Читає docs + searchQuery (з useDocuments).
 */
export function useCalendar(deps: {
  docs: Ref<DocEntry[]>
  searchQuery: Ref<string>
}) {
  const { docs, searchQuery } = deps

  const selectedDay = ref<string | null>(null)
  const calCursor = ref(new Date())

  function docDate(d: DocEntry): Date | null {
    const raw = d.registered_at || d.created_at
    if (!raw) return null
    const dt = new Date(raw)
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  function docDayKey(d: DocEntry): string | null {
    const dt = docDate(d)
    if (!dt) return null
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  const docsByDay = computed<Map<string, DocEntry[]>>(() => {
    const map = new Map<string, DocEntry[]>()
    let list = docs.value.filter(d => !d.archived)
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.doc_id.toLowerCase().includes(q))
    }
    for (const d of list) {
      const k = docDayKey(d)
      if (!k) continue
      const arr = map.get(k)
      if (arr) arr.push(d)
      else map.set(k, [d])
    }
    return map
  })

  const UA_MONTHS = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
  ]
  const UA_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']

  const calMonthLabel = computed(() =>
    `${UA_MONTHS[calCursor.value.getMonth()]} ${calCursor.value.getFullYear()}`
  )

  interface CalCell {
    key: string
    day: number
    inMonth: boolean
    isToday: boolean
    count: number
  }

  const calGrid = computed<CalCell[]>(() => {
    const year = calCursor.value.getFullYear()
    const month = calCursor.value.getMonth()
    const first = new Date(year, month, 1)
    const lead = (first.getDay() + 6) % 7
    const start = new Date(year, month, 1 - lead)
    const todayKey = (() => {
      const t = new Date()
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    })()
    const cells: CalCell[] = []
    for (let i = 0; i < 42; i++) {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      cells.push({
        key,
        day: dt.getDate(),
        inMonth: dt.getMonth() === month,
        isToday: key === todayKey,
        count: docsByDay.value.get(key)?.length ?? 0
      })
    }
    return cells
  })

  function calPrevMonth() {
    calCursor.value = new Date(calCursor.value.getFullYear(), calCursor.value.getMonth() - 1, 1)
  }
  function calNextMonth() {
    calCursor.value = new Date(calCursor.value.getFullYear(), calCursor.value.getMonth() + 1, 1)
  }
  function calToday() {
    const t = new Date()
    calCursor.value = new Date(t.getFullYear(), t.getMonth(), 1)
    selectedDay.value = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  }
  function pickDay(cell: CalCell) {
    if (cell.count === 0 && !cell.inMonth) return
    selectedDay.value = selectedDay.value === cell.key ? null : cell.key
  }

  const selectedDayLabel = computed(() => {
    if (!selectedDay.value) return ''
    const [y, m, d] = selectedDay.value.split('-').map(Number)
    return `${d} ${UA_MONTHS[(m ?? 1) - 1]?.toLowerCase()} ${y}`
  })

  /** Перейти на місяць найсвіжішого документа, якщо поточний порожній. */
  function jumpToLatestMonth() {
    if (docsByDay.value.size && ![...docsByDay.value.keys()].some(k => k.startsWith(
      `${calCursor.value.getFullYear()}-${String(calCursor.value.getMonth() + 1).padStart(2, '0')}`
    ))) {
      const latest = [...docsByDay.value.keys()].sort().at(-1)
      if (latest) {
        const [y, m] = latest.split('-').map(Number)
        calCursor.value = new Date(y ?? 2026, (m ?? 1) - 1, 1)
      }
    }
  }

  return {
    selectedDay,
    calCursor,
    UA_MONTHS,
    UA_WEEKDAYS,
    calMonthLabel,
    calGrid,
    calPrevMonth,
    calNextMonth,
    calToday,
    pickDay,
    selectedDayLabel,
    jumpToLatestMonth,
    docDate,
    docDayKey,
    docsByDay
  }
}
