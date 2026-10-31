<script setup>
import { ref, computed } from 'vue'
import { useProgress } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { THEMES } from '@/data/pictures'
import { ladderOf, isMasteredV2, LADDER } from '@/lib/wordsrs'
import { glossOf } from '@/lib/game'
import PictureTile from '@/components/PictureTile.vue'
import AudioButton from '@/components/AudioButton.vue'
import WordChunks from '@/components/WordChunks.vue'

/**
 * 圖鑑 — every picture word as a sticker. Unmet words are locked "?" tiles,
 * met words show their picture, words that have climbed to recall show in
 * full colour, mastered words get a gold ring. A collection is a long-horizon
 * goal that is the learning itself: the only way to colour a sticker in is to
 * remember the word on a harder task.
 */
const progress = useProgress()
const words = useWords()
const selected = ref(null)

const idOf = new Map(words.allBase.map(w => [w.h.toLowerCase(), w.id]))

const shelves = computed(() =>
  Object.entries(THEMES).map(([key, t]) => {
    const items = Object.entries(t.words).map(([head, emoji]) => {
      const id = idOf.get(head)
      const card = id ? progress.cardOf(id) : null
      const met = !!card && card.state !== 'new'
      return {
        id, head, emoji, met,
        level: met ? ladderOf(card) : -1,
        mastered: met && isMasteredV2(card)
      }
    })
    return { key, label: t.label, items, got: items.filter(i => i.met).length }
  }).sort((a, b) => (b.got > 0) - (a.got > 0))
)

const totals = computed(() => {
  let all = 0; let got = 0; let gold = 0
  for (const s of shelves.value) for (const i of s.items) { all++; if (i.met) got++; if (i.mastered) gold++ }
  return { all, got, gold }
})

const detail = computed(() => selected.value?.id ? words.get(selected.value.id) : null)
</script>

<template>
  <main class="shell col">
    <header class="col__head">
      <div>
        <div class="eyebrow">Sticker Book</div>
        <h1 class="page-title zh">單字圖鑑</h1>
      </div>
      <div class="col__count">
        <span class="num">{{ totals.got }}</span><span class="dim">/{{ totals.all }}</span>
        <span class="col__gold zh">🥇 {{ totals.gold }}</span>
      </div>
    </header>
    <p class="col__lead zh">學過的字會亮起來；用更難的方式答對（看圖拼字、句中使用）它會變成全彩，熟練後鑲金邊。</p>

    <section v-for="s in shelves" :key="s.key" class="shelf">
      <div class="shelf__head">
        <span class="shelf__label zh">{{ s.label }}</span>
        <span class="num dim">{{ s.got }}/{{ s.items.length }}</span>
      </div>
      <div class="grid">
        <button
          v-for="it in s.items" :key="it.head"
          class="stk"
          :class="{ 'stk--locked': !it.met, 'stk--faded': it.met && it.level < 2, 'stk--gold': it.mastered }"
          :disabled="!it.met"
          @click="selected = it"
        >
          <span class="stk__pic" aria-hidden="true">{{ it.met ? it.emoji : '❔' }}</span>
          <span class="stk__w">{{ it.met ? it.head : '' }}</span>
        </button>
      </div>
    </section>

    <Transition name="fade">
      <div v-if="detail" class="sheet-scrim" @click="selected = null">
        <div class="sheet card" @click.stop>
          <PictureTile :word-id="detail.id" :headword="detail.headword" :size="96" />
          <WordChunks :word="detail.headword" size="md" />
          <AudioButton :text="detail.headword" size="md" />
          <p class="zh">{{ glossOf(detail) || '（尚未產生翻譯）' }}</p>
          <p class="sheet__lvl zh">目前程度：<b>{{ LADDER[selected.level]?.short }}</b>{{ selected.mastered ? ' · 已熟練' : '' }}</p>
          <button class="btn btn--ghost btn--block zh" @click="selected = null">關閉</button>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.col { display: flex; flex-direction: column; gap: var(--sp-4); }
.col__head { display: flex; align-items: flex-end; justify-content: space-between; }
.col__count { display: flex; align-items: baseline; gap: 4px; font-size: var(--step-2); }
.col__gold { font-size: var(--step--1); margin-left: 8px; }
.col__lead { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; }
.shelf { display: flex; flex-direction: column; gap: var(--sp-2); }
.shelf__head { display: flex; justify-content: space-between; align-items: baseline; }
.shelf__label { font-weight: 700; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 6px; }
.stk {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  aspect-ratio: 1 / 1.1; border-radius: var(--radius);
  background: var(--surface); border: 1.5px solid var(--jade-edge);
  transition: transform 0.12s;
}
.stk:active:not(:disabled) { transform: scale(0.95); }
.stk__pic { font-size: 1.8rem; line-height: 1; }
.stk__w { font-family: var(--font-word); font-size: 0.72rem; color: var(--ink-2); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 0 2px; }
.stk--locked { background: var(--surface-2); border: 1.5px dashed var(--rule-strong); opacity: 0.6; }
.stk--faded .stk__pic { filter: grayscale(0.85); opacity: 0.65; }
.stk--gold { border: 2px solid #d4a017; box-shadow: 0 0 0 3px rgba(212, 160, 23, 0.18); }
.sheet-scrim { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.35); display: grid; place-items: end center; z-index: 200; padding: var(--sp-4); }
.sheet { width: 100%; max-width: 420px; padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; margin-bottom: env(safe-area-inset-bottom); }
.sheet__lvl { font-size: var(--step--1); color: var(--ink-2); }
</style>
