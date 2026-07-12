const STORAGE_KEY = 'dms-reader-prefs'

interface ReaderPrefs {
  scale: number
  serif: boolean
}

function load(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderPrefs>
      return {
        scale: typeof parsed.scale === 'number' ? parsed.scale : 1,
        serif: typeof parsed.serif === 'boolean' ? parsed.serif : true
      }
    }
  }
  catch {}
  return { scale: 1, serif: true }
}

const prefs = load()

const scale = ref<number>(prefs.scale)
const serif = ref<boolean>(prefs.serif)

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scale: scale.value, serif: serif.value }))
  }
  catch {}
}

export function useReaderPrefs() {
  function setScale(value: number) {
    scale.value = Math.min(1.6, Math.max(0.85, Math.round(value * 100) / 100))
    persist()
  }

  function stepScale(delta: number) {
    setScale(Math.round((scale.value + delta) * 100) / 100)
  }

  function toggleSerif() {
    serif.value = !serif.value
    persist()
  }

  return { scale, serif, setScale, stepScale, toggleSerif }
}
