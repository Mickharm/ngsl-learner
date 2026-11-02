<script setup>
import { onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useGrammar } from '@/stores/grammar'
import { useEssentials } from '@/stores/essentials'
import { useParts } from '@/stores/parts'
import { useToast } from '@/stores/toast'
import TabBar from '@/components/TabBar.vue'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
const auth = useAuth()
const settings = useSettings()
const words = useWords()
const progress = useProgress()
const grammar = useGrammar()
const essentials = useEssentials()
const parts = useParts()
const toast = useToast()

const showChrome = computed(() => route.meta.chrome !== false && auth.signedIn)

async function bootUserData () {
  await settings.load()
  await Promise.all([words.hydrate(), progress.load(), grammar.load(), essentials.load(), parts.load()])
}

onMounted(async () => {
  settings.applyTheme()
  if (!auth.ready) await auth.init()
  if (auth.signedIn) await bootUserData()

  window.addEventListener('online', () => {
    progress.flush()
    toast.info('已恢復連線，進度同步中')
  })
})

watch(() => auth.userId, async id => { if (id) await bootUserData() })
</script>

<template>
  <!-- Enter-only page transition: the old page leaves at once, the new one
       settles in over 140 ms. v3 faded out, waited, then faded in — 360 ms of
       blank screen on every tap. -->
  <RouterView v-slot="{ Component }">
    <Transition name="page">
      <component :is="Component" />
    </Transition>
  </RouterView>

  <TabBar v-if="showChrome" />
  <ToastHost />
</template>
