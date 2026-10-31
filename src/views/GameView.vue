<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'

/** One arcade game, by id. Each game is its own chunk. */
const route = useRoute()
const GAMES = {
  rain: defineAsyncComponent(() => import('@/components/arcade/RainGame.vue')),
  bubbles: defineAsyncComponent(() => import('@/components/arcade/BubbleGame.vue')),
  wordle: defineAsyncComponent(() => import('@/components/arcade/WordleGame.vue')),
  builder: defineAsyncComponent(() => import('@/components/arcade/BuilderGame.vue')),
  memory: defineAsyncComponent(() => import('@/components/arcade/MemoryGame.vue')),
  match: defineAsyncComponent(() => import('@/components/arcade/MatchRush.vue'))
}
const game = computed(() => GAMES[route.params.id] || null)
</script>

<template>
  <component :is="game" v-if="game" :key="route.params.id" />
  <main v-else class="shell"><p class="zh">找不到這個遊戲。</p><RouterLink to="/games" class="btn btn--ghost zh">回遊戲中心</RouterLink></main>
</template>
