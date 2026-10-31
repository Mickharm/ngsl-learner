<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { modeFor, ladderOf, gradeFromAnswer, LADDER } from '@/lib/wordsrs'
import SessionHeader from '@/components/SessionHeader.vue'
import DataGate from '@/components/DataGate.vue'
import WordGame from '@/components/games/WordGame.vue'
import PictureTile from '@/components/PictureTile.vue'

/**
 * Review as games. Each due word gets ONE task, chosen by its ladder rung —
 * a word recognised last time is recalled this time, a word recalled is
 * spelled, a word spelled is used in a sentence. The answer is graded
 * objectively and becomes the word's single review for the day.
 *
 * A missed word is re-taught on the spot (the reveal panel) and comes back
 * once at the end of the session in the easiest direction, ungraded, so the
 * learner leaves having got it right once — relearning to criterion — while
 * the scheduler still records the miss.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const router = useRouter()

const queue = ref([])            // { id, mode, graded, from }
const step = ref(0)
const stats = ref({ right: 0, wrong: 0, up: 0, down: 0 })
const combo = ref(0)
const bestCombo = ref(0)
const finished = ref(false)

const ids = computed(() => [...new Set(queue.value.map(q => q.id))])
const item = computed(() => queue.value[step.value] || null)
const current = computed(() => item.value ? words.get(item.value.id) : null)
const gradedTotal = computed(() => queue.value.filter(q => q.graded).length)

const pool = computed(() => {
  const seen = [...progress.cards.keys()].slice(-500)
  return words.getMany(seen).filter(w => w.enriched && w.meanings?.length)
})

function build () {
  queue.value = session.reviewCards.map(c => ({ id: c.wordId, mode: null, seed: 0, graded: true, from: ladderOf(c) }))
}

/**
 * Fix the task and its seed the first time an item is shown with its data.
 *
 * Both used to be computed live from the card, and grading the answer changes
 * the card (new rung, one more rep) — so the moment the learner answered, the
 * task and seed changed under them, the game reset, the reveal vanished and the
 * same word could be answered again and again. Resolved once, lazily, because
 * the word may only just have been enriched by DataGate.
 */
watch([item, () => current.value?.meanings?.length], () => {
  const it = item.value
  if (!it || it.mode || !current.value?.meanings?.length) return
  const card = progress.cardOf(it.id)
  it.mode = modeFor(card, current.value) || 'meaning'
  it.seed = it.id * 31 + (card?.reps || 0)
}, { immediate: true })
const mode = computed(() => item.value?.mode || null)

function onAnswer (a) {
  const it = item.value
  if (!it || !it.graded) return
  const before = ladderOf(progress.cardOf(it.id))
  const updated = progress.gradeCard(it.id, gradeFromAnswer(a), { mode: a.mode, elapsedMs: a.elapsedMs, level: before })
  const after = ladderOf(updated)
  if (after > before) stats.value.up++
  if (after < before) stats.value.down++
  if (a.correct) {
    stats.value.right++
    combo.value++
    bestCombo.value = Math.max(bestCombo.value, combo.value)
    progress.clearWordErrors(it.id)
  } else {
    stats.value.wrong++
    combo.value = 0
    queue.value = [...queue.value, { id: it.id, mode: 'meaning', seed: it.id * 7 + 1, graded: false, from: after }]
  }
}

function next () {
  if (step.value + 1 < queue.value.length) step.value++
  else finish()
}

const accuracy = computed(() => {
  const t = stats.value.right + stats.value.wrong
  return t ? Math.round((stats.value.right / t) * 100) : 100
})

const missedWords = computed(() =>
  words.getMany([...new Set(queue.value.filter(q => !q.graded).map(q => q.id))])
)

function finish () {
  finished.value = true
  session.markDone('review')
}

function goNext () { router.push(session.nextRoute('review')) }
function skipPhase () {
  session.markDone('review')
  router.push(session.nextRoute('review'))
}

onMounted(() => {
  session.startClock()
  build()
  if (!queue.value.length) {
    session.markDone('review')
    router.replace(session.nextRoute('review'))
  }
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader title="複習挑戰" :current="Math.min(step + 1, queue.length)" :total="queue.length" exit-to="/" />

    <DataGate :ids="ids">
      <main class="shell review">
        <template v-if="!finished && current">
          <div class="hud">
            <span class="hud__rung zh">
              <i v-for="l in LADDER" :key="l.level" class="rung" :class="{ 'rung--on': l.level <= item.from }" />
              {{ item.graded ? LADDER[item.from].short : '重學' }}
            </span>
            <span class="hud__combo" :class="{ 'hud__combo--hot': combo >= 3 }">
              <span v-if="combo >= 2">🔥 <span class="num">{{ combo }}</span> 連對</span>
            </span>
            <span class="tally">
              <span class="tally__r num">{{ stats.right }}</span><span class="tally__sep">·</span><span class="tally__w num">{{ stats.wrong }}</span>
            </span>
          </div>

          <WordGame
            v-if="mode"
            :key="step + ':' + item.id"
            :word="current"
            :mode="mode"
            :pool="pool"
            :seed="item.seed"
            @answer="onAnswer"
            @next="next"
          />

          <button class="btn btn--quiet btn--sm review__skip zh" @click="skipPhase">跳過這個階段</button>
        </template>

        <section v-else-if="finished" class="sum">
          <div class="sum__big num">{{ accuracy }}%</div>
          <p class="sum__label zh">答對率 · {{ stats.right }}/{{ gradedTotal }}</p>
          <div class="sum__grid">
            <div class="sum__cell"><b class="num up">↑ {{ stats.up }}</b><span class="zh">升一階</span></div>
            <div class="sum__cell"><b class="num down">↓ {{ stats.down }}</b><span class="zh">退一階</span></div>
            <div class="sum__cell"><b class="num">🔥 {{ bestCombo }}</b><span class="zh">最長連對</span></div>
          </div>
          <p class="sum__note zh">升階的字下次會用更難的方式考你；退階的字兩天內會回來。</p>
          <div v-if="missedWords.length" class="sum__miss">
            <span v-for="w in missedWords" :key="w.id" class="miss">
              <PictureTile :word-id="w.id" :headword="w.headword" :size="30" />
              <span>{{ w.headword }}</span>
            </span>
          </div>
          <button class="btn btn--primary btn--block zh" @click="goNext">下一關</button>
        </section>
      </main>
    </DataGate>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.review { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6)); }
.review__skip { align-self: center; }

.hud { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); min-height: 26px; }
.hud__rung { display: flex; align-items: center; gap: 3px; font-size: var(--step--2); color: var(--ink-2); }
.rung { width: 8px; height: 14px; border-radius: 2px; background: var(--surface-3); display: inline-block; }
.rung--on { background: var(--violet); }
.hud__combo { font-size: var(--step--1); color: var(--amber); font-weight: 700; transition: transform 0.2s; }
.hud__combo--hot { transform: scale(1.12); }
.tally { display: flex; align-items: center; gap: 6px; font-size: var(--step--1); }
.tally__r { color: var(--jade); }
.tally__w { color: var(--rose); }
.tally__sep { color: var(--ink-3); }

.sum { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding-top: var(--sp-6); }
.sum__big { font-size: var(--step-6); color: var(--jade); line-height: 1; }
.sum__label { color: var(--ink-2); font-size: var(--step--1); }
.sum__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); width: 100%; margin-top: var(--sp-2); }
.sum__cell { background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius); padding: var(--sp-3) var(--sp-2); display: flex; flex-direction: column; gap: 2px; font-size: var(--step--2); color: var(--ink-3); }
.sum__cell b { font-size: var(--step-2); color: var(--ink); }
.sum__cell .up { color: var(--jade); }
.sum__cell .down { color: var(--rose); }
.sum__note { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; max-width: 34ch; }
.sum__miss { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.miss { display: flex; align-items: center; gap: 4px; padding: 3px 10px 3px 4px; border-radius: 999px; background: var(--rose-wash); color: var(--rose); font-family: var(--font-word); font-size: var(--step--1); }
</style>
