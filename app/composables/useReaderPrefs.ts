const STORAGE_KEY = 'dms-reader-prefs'

interface ReaderPrefs {
  scale: number
  serif: boolean
  inverted: boolean
  handwritten: boolean
}

function load(): ReaderPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReaderPrefs>
      return {
        scale: typeof parsed.scale === 'number' ? parsed.scale : 1,
        serif: typeof parsed.serif === 'boolean' ? parsed.serif : true,
        inverted: typeof parsed.inverted === 'boolean' ? parsed.inverted : false,
        handwritten: typeof parsed.handwritten === 'boolean' ? parsed.handwritten : true
      }
    }
  }
  catch {}
  return { scale: 1, serif: true, inverted: false, handwritten: true }
}

const prefs = load()

const scale = ref<number>(prefs.scale)
const serif = ref<boolean>(prefs.serif)
const inverted = ref<boolean>(prefs.inverted)
const handwritten = ref<boolean>(prefs.handwritten)

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      scale: scale.value,
      serif: serif.value,
      inverted: inverted.value,
      handwritten: handwritten.value
    }))
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

  function toggleInvert() {
    inverted.value = !inverted.value
    persist()
  }

  function toggleHandwritten() {
    handwritten.value = !handwritten.value
    persist()
  }

  return { scale, serif, inverted, handwritten, setScale, stepScale, toggleSerif, toggleInvert, toggleHandwritten }
}
