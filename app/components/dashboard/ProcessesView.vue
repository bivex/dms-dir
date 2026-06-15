<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'
import type { ProcNode, ProcNodeType } from '~/composables/dashboard/useProcesses'

const store = useDashboard()

const newProcName = ref('')
const dragId = ref<string | null>(null)
const dragOff = ref({ x: 0, y: 0 })
const linkFrom = ref<string | null>(null)
const selectedNodeId = ref<string | null>(null)

onMounted(() => {
  store.reloadProcesses()
})

const proc = computed(() => store.selectedProcess.value)

const NODE_W = 150
const NODE_H = 56

function nodeFill(type: ProcNodeType): string {
  if (type === 'start') return 'var(--ui-success, #16a34a)'
  if (type === 'end') return 'var(--ui-error, #dc2626)'
  if (type === 'gateway') return 'var(--ui-warning, #d97706)'
  return 'var(--ui-primary, #2563eb)'
}

function nodeCenter(n: ProcNode) {
  return { cx: n.x + NODE_W / 2, cy: n.y + NODE_H / 2 }
}

// --- drag вузлів ---
function onNodeDown(ev: MouseEvent, n: ProcNode) {
  if (linkFrom.value) {
    // у режимі звʼязку — клік завершує лінію
    finishLink(n.id)
    return
  }
  selectedNodeId.value = n.id
  dragId.value = n.id
  dragOff.value = { x: ev.offsetX - n.x, y: ev.offsetY - n.y }
}

function onSvgMove(ev: MouseEvent) {
  if (!dragId.value || !proc.value) return
  const n = proc.value.graph.nodes.find(x => x.id === dragId.value)
  if (!n) return
  n.x = Math.max(0, ev.offsetX - dragOff.value.x)
  n.y = Math.max(0, ev.offsetY - dragOff.value.y)
}

function onSvgUp() {
  dragId.value = null
}

// --- редагування графа ---
let nodeSeq = 0
function addNode(type: ProcNodeType) {
  if (!proc.value) return
  nodeSeq += 1
  const id = `c${Date.now()}_${nodeSeq}`
  const labels: Record<ProcNodeType, string> = {
    start: 'Початок', task: 'Завдання', gateway: 'Розгалуження', end: 'Кінець'
  }
  proc.value.graph.nodes.push({ id, type, label: labels[type], x: 60, y: 60 })
  selectedNodeId.value = id
}

function removeNode(id: string) {
  if (!proc.value) return
  proc.value.graph.nodes = proc.value.graph.nodes.filter(n => n.id !== id)
  proc.value.graph.edges = proc.value.graph.edges.filter(e => e.from !== id && e.to !== id)
  if (selectedNodeId.value === id) selectedNodeId.value = null
}

function startLink(id: string) {
  linkFrom.value = id
}

function finishLink(toId: string) {
  if (!proc.value || !linkFrom.value || linkFrom.value === toId) {
    linkFrom.value = null
    return
  }
  const exists = proc.value.graph.edges.some(e => e.from === linkFrom.value && e.to === toId)
  if (!exists) proc.value.graph.edges.push({ from: linkFrom.value, to: toId, label: '' })
  linkFrom.value = null
}

function removeEdge(idx: number) {
  if (!proc.value) return
  proc.value.graph.edges.splice(idx, 1)
}

function edgePath(e: { from: string; to: string }) {
  if (!proc.value) return ''
  const a = proc.value.graph.nodes.find(n => n.id === e.from)
  const b = proc.value.graph.nodes.find(n => n.id === e.to)
  if (!a || !b) return ''
  const p1 = nodeCenter(a)
  const p2 = nodeCenter(b)
  return `M ${p1.cx} ${p1.cy} L ${p2.cx} ${p2.cy}`
}

function edgeMid(e: { from: string; to: string }) {
  if (!proc.value) return { x: 0, y: 0 }
  const a = proc.value.graph.nodes.find(n => n.id === e.from)
  const b = proc.value.graph.nodes.find(n => n.id === e.to)
  if (!a || !b) return { x: 0, y: 0 }
  const p1 = nodeCenter(a)
  const p2 = nodeCenter(b)
  return { x: (p1.cx + p2.cx) / 2, y: (p1.cy + p2.cy) / 2 }
}

const selectedNode = computed(() =>
  proc.value?.graph.nodes.find(n => n.id === selectedNodeId.value) ?? null
)

async function doCreate() {
  const name = newProcName.value.trim()
  if (!name) return
  await store.createProcess(name)
  newProcName.value = ''
}
</script>

<template>
  <div class="flex h-full">
    <!-- список процесів -->
    <aside class="w-72 flex-shrink-0 border-r border-default flex flex-col">
      <div class="p-3 border-b border-default">
        <div class="font-semibold text-sm mb-2">Процеси документообігу</div>
        <div class="flex gap-1">
          <UInput v-model="newProcName" placeholder="Новий процес…" size="sm" class="flex-1" @keyup.enter="doCreate" />
          <UButton icon="i-lucide-plus" size="sm" :disabled="!newProcName.trim()" @click="doCreate" />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto">
        <div
          v-for="p in store.processes.value"
          :key="p.id"
          class="p-3 border-b border-default cursor-pointer hover:bg-elevated transition-colors"
          :class="{ 'bg-elevated': store.selectedProcessId.value === p.id }"
          @click="store.selectProcess(p.id)"
        >
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-medium truncate flex-1">{{ p.name }}</span>
            <UBadge v-if="p.is_builtin" label="вбуд." size="xs" color="neutral" variant="subtle" />
          </div>
          <div class="text-xs text-muted truncate mt-0.5">{{ p.description || '—' }}</div>
          <div class="text-[10px] text-muted/70 mt-1">{{ p.graph.nodes.length }} вузлів · {{ p.graph.edges.length }} звʼязків</div>
        </div>
        <div v-if="store.processes.value.length === 0" class="p-6 text-center text-muted text-sm">
          Процесів ще немає
        </div>
      </div>
    </aside>

    <!-- редактор -->
    <div class="flex-1 overflow-hidden flex flex-col">
      <div v-if="!proc" class="flex items-center justify-center h-full text-muted">
        <div class="text-center">
          <UIcon name="i-lucide-workflow" class="text-5xl mb-3 opacity-30" />
          <div>Оберіть процес зі списку або створіть новий</div>
        </div>
      </div>

      <template v-else>
        <!-- тулбар -->
        <div class="p-3 border-b border-default flex items-center gap-2 flex-wrap">
          <UInput v-model="proc.name" class="font-medium w-64" size="sm" />
          <div class="flex items-center gap-1 ml-2">
            <span class="text-xs text-muted mr-1">Додати:</span>
            <UButton label="Старт" icon="i-lucide-play" size="xs" variant="soft" color="success" @click="addNode('start')" />
            <UButton label="Завдання" icon="i-lucide-square" size="xs" variant="soft" color="primary" @click="addNode('task')" />
            <UButton label="Розгалуження" icon="i-lucide-git-fork" size="xs" variant="soft" color="warning" @click="addNode('gateway')" />
            <UButton label="Кінець" icon="i-lucide-flag" size="xs" variant="soft" color="error" @click="addNode('end')" />
          </div>
          <div class="ml-auto flex items-center gap-1">
            <UButton
              label="Дублювати"
              icon="i-lucide-copy"
              size="xs"
              variant="ghost"
              color="neutral"
              @click="store.duplicateProcess(proc)"
            />
            <UButton
              label="Зберегти"
              icon="i-lucide-save"
              size="xs"
              :loading="store.savingProcess.value"
              :disabled="proc.is_builtin"
              :title="proc.is_builtin ? 'Вбудований процес: дублюйте, щоб змінити' : ''"
              @click="store.saveProcess(proc)"
            />
            <UButton
              v-if="!proc.is_builtin"
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="ghost"
              @click="store.deleteProcess(proc)"
            />
          </div>
        </div>

        <div v-if="proc.is_builtin" class="px-3 py-1.5 bg-warning/5 border-b border-warning/20 text-xs text-muted flex items-center gap-1.5">
          <UIcon name="i-lucide-info" class="text-warning flex-shrink-0" />
          Вбудований процес. Щоб редагувати — натисніть «Дублювати» і змініть копію.
        </div>

        <div v-if="linkFrom" class="px-3 py-1.5 bg-primary/5 border-b border-primary/20 text-xs text-primary flex items-center gap-1.5">
          <UIcon name="i-lucide-spline" class="flex-shrink-0" />
          Режим звʼязку: клікніть на цільовий вузол. <button class="underline ml-1" @click="linkFrom = null">Скасувати</button>
        </div>

        <!-- полотно -->
        <div class="flex-1 overflow-auto bg-elevated/20">
          <svg
            :width="1500"
            :height="600"
            class="select-none"
            @mousemove="onSvgMove"
            @mouseup="onSvgUp"
            @mouseleave="onSvgUp"
          >
            <defs>
              <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L8,3 L0,6 Z" fill="var(--ui-text-muted, #888)" />
              </marker>
            </defs>

            <!-- звʼязки -->
            <g v-for="(e, idx) in proc.graph.edges" :key="`e${idx}`">
              <path :d="edgePath(e)" stroke="var(--ui-text-muted, #888)" stroke-width="1.5" fill="none" marker-end="url(#arrow)" />
              <g v-if="e.label" :transform="`translate(${edgeMid(e).x}, ${edgeMid(e).y})`">
                <rect x="-18" y="-10" width="36" height="16" rx="3" fill="var(--ui-bg, #fff)" stroke="var(--ui-border, #ddd)" />
                <text text-anchor="middle" y="2" font-size="10" fill="var(--ui-text, #333)">{{ e.label }}</text>
              </g>
              <!-- видалити звʼязок -->
              <circle
                :cx="edgeMid(e).x" :cy="edgeMid(e).y - 16" r="7"
                fill="var(--ui-error, #dc2626)" class="cursor-pointer opacity-0 hover:opacity-100"
                @click="removeEdge(idx)"
              />
            </g>

            <!-- вузли -->
            <g
              v-for="n in proc.graph.nodes"
              :key="n.id"
              :transform="`translate(${n.x}, ${n.y})`"
              class="cursor-move"
              @mousedown="onNodeDown($event, n)"
            >
              <rect
                :width="NODE_W" :height="NODE_H"
                :rx="n.type === 'gateway' ? 28 : 8"
                :fill="nodeFill(n.type)"
                :stroke="selectedNodeId === n.id ? 'var(--ui-text, #111)' : 'transparent'"
                stroke-width="2"
                opacity="0.92"
              />
              <text :x="NODE_W/2" :y="NODE_H/2 + 4" text-anchor="middle" font-size="12" fill="#fff" font-weight="500">
                {{ n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label }}
              </text>
            </g>
          </svg>
        </div>

        <!-- інспектор вибраного вузла -->
        <div v-if="selectedNode && !proc.is_builtin" class="p-3 border-t border-default flex items-end gap-2 flex-wrap bg-default/5">
          <UFormField label="Назва вузла" class="flex-1 min-w-48">
            <UInput v-model="selectedNode.label" size="sm" class="w-full" />
          </UFormField>
          <UButton label="Звʼязати →" icon="i-lucide-spline" size="sm" variant="soft" @click="startLink(selectedNode.id)" />
          <UButton label="Видалити вузол" icon="i-lucide-trash-2" size="sm" color="error" variant="soft" @click="removeNode(selectedNode.id)" />
        </div>
      </template>
    </div>
  </div>
</template>
