<script setup>
import { onMounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useGrammar } from '@/stores/grammar'
import { useToast } from '@/stores/toast'
import TabBar from '@/components/TabBar.vue'
import ToastHost from '@/components/ToastHost.vue'

const route = useRoute()
const auth = useAuth()
const settings = useSettings()
const words = useWords()
const progress = useProgress()
const grammar = useGrammar()
const toast = useToast()

const showChrome = computed(() => route.meta.chrome !== false && auth.signedIn)

async function bootUserData () {
  await settings.load()
  await Promise.all([words.hydrate(), progress.load(), grammar.load()])
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
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>

  <TabBar v-if="showChrome" />
  <ToastHost />
</template>
