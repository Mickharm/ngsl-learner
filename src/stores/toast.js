import { defineStore } from 'pinia'
import { ref } from 'vue'

let seq = 0

export const useToast = defineStore('toast', () => {
  const items = ref([])

  function push (text, { kind = 'info', ms = 3200 } = {}) {
    const id = ++seq
    items.value.push({ id, text, kind })
    setTimeout(() => dismiss(id), ms)
    return id
  }

  function dismiss (id) {
    const i = items.value.findIndex(t => t.id === id)
    if (i >= 0) items.value.splice(i, 1)
  }

  const info = t => push(t)
  const error = t => push(t, { kind: 'err', ms: 5000 })

  return { items, push, dismiss, info, error }
})
