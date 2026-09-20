<script setup lang="ts">
import { computed } from 'vue'
import { useDashboard } from '~/composables/dashboard/useDashboard'

const store = useDashboard()
const { form } = store

const availableUsers = computed(() =>
  store.users.value
    .filter((u: any) => !form.approverUsers.some(a => a.user_id === u.id))
    .map((u: any) => ({
      label: `${u.name}${u.position ? ' — ' + u.position : ''} · ${u.email}`,
      value: u.id
    }))
)

function addApprover(userId: number | string) {
  const id = Number(userId)
  const u = store.users.value.find((x: any) => x.id === id)
  if (!u || form.approverUsers.some(a => a.user_id === id)) return
  form.approverUsers.push({ user_id: id, full_name: u.name, position: u.position })
}

function removeApprover(index: number) {
  form.approverUsers.splice(index, 1)
}

function applyStandardRoute(type: 'basic' | 'hr') {
  form.approverUsers = []
  if (type === 'basic') {
    const lawyer = store.users.value.find((u: any) => u.name.includes('Бойко') || u.position?.toLowerCase().includes('юрист'))
    if (lawyer) {
      form.approverUsers.push({ user_id: lawyer.id, full_name: lawyer.name, position: lawyer.position })
    }
    const accountant = store.users.value.find((u: any) => u.name.includes('Бондаренко') || u.position?.toLowerCase().includes('бухгалтер'))
    if (accountant) {
      form.approverUsers.push({ user_id: accountant.id, full_name: accountant.name, position: accountant.position })
    }
  } else if (type === 'hr') {
    const hr = store.users.value.find((u: any) => u.name.includes('Кузьменко') || u.position?.toLowerCase().includes('кадр'))
    if (hr) {
      form.approverUsers.push({ user_id: hr.id, full_name: hr.name, position: hr.position })
    }
    const lawyer = store.users.value.find((u: any) => u.name.includes('Бойко'))
    if (lawyer) {
      form.approverUsers.push({ user_id: lawyer.id, full_name: lawyer.name, position: lawyer.position })
    }
  }
}

const availableSignerUsers = computed(() =>
  store.users.value
    .filter((u: any) => !form.signerUsers.some(s => s.user_id === u.id))
    .map((u: any) => ({
      label: `${u.name}${u.position ? ' — ' + u.position : ''} · ${u.email}`,
      value: u.id
    }))
)

function addSigner(userId: number | string) {
  const id = Number(userId)
  const u = store.users.value.find((x: any) => x.id === id)
  if (!u || form.signerUsers.some(s => s.user_id === id)) return
  form.signerUsers.push({ user_id: id, full_name: u.name, position: u.position, signer_type: 'person' })
}

function removeSigner(index: number) {
  form.signerUsers.splice(index, 1)
}

function toggleSignerType(index: number) {
  const s = form.signerUsers[index]
  if (!s) return
  if (s.signer_type === 'seal') {
    s.signer_type = 'person'
    return
  }
  s.signer_type = 'seal'
  if (!s.full_name.trim() && form.org_name.trim()) {
    s.full_name = form.org_name.trim()
  }
}

const availableAcknowledgeUsers = computed(() =>
  store.users.value
    .filter((u: any) => !(form.acknowledge_user_ids || []).includes(u.id))
    .map((u: any) => ({
      label: `${u.name}${u.position ? ' — ' + u.position : ''} · ${u.email}`,
      value: u.id
    }))
)

function addAcknowledgeUser(userId: number | string) {
  const id = Number(userId)
  if (!form.acknowledge_user_ids) {
    form.acknowledge_user_ids = []
  }
  if (!form.acknowledge_user_ids.includes(id)) {
    form.acknowledge_user_ids.push(id)
  }
}

function removeAcknowledgeUser(id: number) {
  if (form.acknowledge_user_ids) {
    form.acknowledge_user_ids = form.acknowledge_user_ids.filter(x => x !== id)
  }
}

function getUserInfo(id: number) {
  return store.users.value.find((x: any) => x.id === id) || { name: 'Невідомий', position: '' }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Погоджувачі -->
    <UFormField>
      <template #label>
        <div class="flex items-center justify-between w-full">
          <span>Погоджувачі (із користувачів системи)</span>
          <div v-if="store.isOrder.value" class="flex gap-1.5">
            <UButton
              size="xs"
              variant="subtle"
              color="neutral"
              icon="i-lucide-route"
              @click="applyStandardRoute('basic')"
            >
              Типовий: Юрист + Бухгалтер
            </UButton>
            <UButton
              size="xs"
              variant="subtle"
              color="neutral"
              icon="i-lucide-route"
              @click="applyStandardRoute('hr')"
            >
              Типовий: Кадри + Юрист
            </UButton>
          </div>
        </div>
      </template>
      <div class="space-y-2 w-full">
        <USelect
          :model-value="undefined"
          :items="availableUsers"
          placeholder="Оберіть користувача для додавання…"
          class="w-full"
          @update:model-value="addApprover"
        />
        <div v-if="form.approverUsers.length" class="space-y-1">
          <div
            v-for="(a, i) in form.approverUsers"
            :key="a.user_id"
            class="flex items-center gap-2 p-2 rounded border border-default bg-default/5 text-sm"
          >
            <span class="text-muted font-mono text-xs w-5 flex-shrink-0">{{ i + 1 }}.</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ a.full_name }}</div>
              <div class="text-xs text-muted truncate">{{ a.position || 'Посада не вказана' }}</div>
            </div>
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="error"
              variant="ghost"
              title="Прибрати"
              aria-label="Прибрати погоджувача"
              @click="removeApprover(i)"
            />
          </div>
        </div>
        <div v-else class="text-xs text-muted">Погоджувачів не додано.</div>
      </div>
    </UFormField>

    <!-- Підписанти -->
    <UFormField label="Підписанти (із користувачів системи)">
      <div class="space-y-2 w-full">
        <USelect
          :model-value="undefined"
          :items="availableSignerUsers"
          placeholder="Оберіть користувача для додавання…"
          class="w-full"
          @update:model-value="addSigner"
        />
        <div v-if="form.signerUsers.length" class="space-y-1">
          <div
            v-for="(s, i) in form.signerUsers"
            :key="s.user_id ?? i"
            class="flex items-center gap-2 p-2 rounded border border-default bg-default/5 text-sm"
          >
            <span class="text-muted font-mono text-xs w-5 flex-shrink-0">{{ i + 1 }}.</span>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate flex items-center gap-1.5">
                {{ s.full_name }}
                <UBadge
                  v-if="s.signer_type === 'seal'"
                  label="Печатка"
                  color="primary"
                  variant="subtle"
                  size="xs"
                  icon="i-lucide-stamp"
                />
              </div>
              <div class="text-xs text-muted truncate">{{ s.position || 'Посада не вказана' }}</div>
            </div>
            <UButton
              :icon="s.signer_type === 'seal' ? 'i-lucide-building-2' : 'i-lucide-user'"
              :color="s.signer_type === 'seal' ? 'primary' : 'neutral'"
              :variant="s.signer_type === 'seal' ? 'soft' : 'ghost'"
              size="xs"
              :title="s.signer_type === 'seal' ? 'Печатка юрособи (натисніть → КЕП особи)' : 'КЕП особи (натисніть → печатка юрособи)'"
              :aria-label="s.signer_type === 'seal' ? 'Печатка юрособи' : 'КЕП особи'"
              @click="toggleSignerType(i)"
            />
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="error"
              variant="ghost"
              title="Прибрати"
              aria-label="Прибрати підписанта"
              @click="removeSigner(i)"
            />
          </div>
        </div>
        <div v-else class="text-xs text-muted">Підписантів не додано.</div>
      </div>
    </UFormField>

    <!-- Аркуш ознайомлення (для наказів) -->
    <UFormField v-if="store.isOrder.value" label="Аркуш ознайомлення (Розсилка)">
      <div class="space-y-2 w-full">
        <USelect
          :model-value="undefined"
          :items="availableAcknowledgeUsers"
          placeholder="Оберіть користувача для ознайомлення…"
          class="w-full"
          @update:model-value="addAcknowledgeUser"
        />
        <div v-if="form.acknowledge_user_ids && form.acknowledge_user_ids.length" class="space-y-1">
          <div
            v-for="id in form.acknowledge_user_ids"
            :key="id"
            class="flex items-center gap-2 p-2 rounded border border-default bg-default/5 text-sm"
          >
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{{ getUserInfo(id).name }}</div>
              <div class="text-xs text-muted truncate">{{ getUserInfo(id).position || 'Посада не вказана' }}</div>
            </div>
            <UButton
              icon="i-lucide-x"
              size="xs"
              color="error"
              variant="ghost"
              title="Прибрати"
              aria-label="Прибрати з ознайомлення"
              @click="removeAcknowledgeUser(id)"
            />
          </div>
        </div>
        <div v-else class="text-xs text-muted">Список ознайомлення порожній.</div>
      </div>
    </UFormField>
  </div>
</template>
