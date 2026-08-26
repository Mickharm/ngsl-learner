<script setup>
import { useToast } from '@/stores/toast'
const toast = useToast()
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <TransitionGroup name="slide-up">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="toast"
        :class="{ 'toast--err': t.kind === 'err' }"
      >{{ t.text }}</div>
    </TransitionGroup>
  </div>
</template>
