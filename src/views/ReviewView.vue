<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { GRADE, STATE } from '@/lib/srs'
import SessionHeader from '@/components/SessionHeader.vue'
import WordCard from '@/components/WordCard.vue'
import GradeButtons from '@/components/GradeButtons.vue'
import ClozeQuiz from '@/components/ClozeQuiz.vue'
import DataGate from '@/components/DataGate.vue'

/**
 * Review phase. Each due card is presented either as a recall card or, for a
 * configurable share of them, as a cloze on its own example sentence — the
 * cloze is what stops "I recognise this word" from being mistaken for "I can
 * use this word", and it is where confusable pairs get forced into contact.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const toast = useToast()
const router = useRouter()

const queue = ref([])
const step = ref(0)
const revealed = ref(false)
const shownAt = ref(Date.now())
const stats = ref({ right: 0, wrong: 0 })

const ids = computed(() => queue.value.map(q => q.id))
const currentEntry = computed(() => queue.value[step.value] || null)
const current = computed(() => currentEntry.value ? words.get(currentEntry.value.id) : null)
const isCloze = computed(() => currentEntry.value?.mode === 'cloze' && current.value?.examples?.length)
const done = computed(() => step.value >= queue.value.length)

/** Distractor pool: words the learner has actually met, so options feel real. */
const pool = computed(() => {
  const seen = [...progress.cards.keys()].slice(0, 400)
  return words.getMany(seen).filter(w => w.enriched)
})

function build () {
  const cards = session.reviewCards
  const ratio = settings.state.clozeRatio
  queue.value = cards.map((c, i) => {
    const w = words.get(c.wordId)
    const canCloze = !!w?.examples?.length && c.state === STATE.REVIEW
    // Deterministic per card so a re-render never re-rolls the mode mid-answer.
    const roll = ((c.wordId * 2654435761) % 1000) / 1000
    return { id: c.wordId, mode: canCloze && roll < ratio ? 'cloze' : 'card', order: i }
  })
}

/**
 * Cards whose short step has come due while this session was running.
 *
 * The engine schedules a new word 10 minutes out and a just-forgotten word
 * 10 minutes out, which is the whole point of having learning steps. The queue
 * used to be a single snapshot taken on mount, so neither ever arrived: the
 * phase ended, the day ended, and the card resurfaced tomorrow instead. The
 * grade buttons were promising a "10 分" review the app never delivered.
 *
 * Bounded per card so a run of 忘記 cannot make the phase unending.
 */
const REENTRY_LIMIT = 2
const reentries = new Map()

function pullNewlyDue () {
  const now = Date.now()
  const pending = new Set(queue.value.slice(step.value).map(q => q.id))
  const extra = []
  for (const c of progress.cards.values()) {
    if (c.state !== STATE.LEARNING && c.state !== STATE.RELEARNING) continue
    if (c.dueAt > now) continue
    if (pending.has(c.wordId)) continue
    if ((reentries.get(c.wordId) || 0) >= REENTRY_LIMIT) continue
    if (!words.get(c.wordId)) continue
    extra.push(c.wordId)
  }
  if (!extra.length) return 0
  for (const id of extra) reentries.set(id, (reentries.get(id) || 0) + 1)
  queue.value = [
    ...queue.value,
    ...extra.map((id, i) => ({ id, mode: 'card', order: queue.value.length + i }))
  ]
  return extra.length
}

function advance () {
  if (step.value + 1 <= queue.value.length) {
    step.value++
    revealed.value = false
    shownAt.value = Date.now()
  }
  if (step.value >= queue.value.length && !pullNewlyDue()) finish()
}

function grade (g) {
  const w = current.value
  if (!w) return
  progress.gradeCard(w.id, g, { mode: 'card', elapsedMs: Date.now() - shownAt.value })
  if (g >= GRADE.GOOD) stats.value.right++
  else stats.value.wrong++
  advance()
}

function onCloze ({ correct }) {
  const w = current.value
  if (!w) return
  progress.gradeCard(w.id, correct ? GRADE.GOOD : GRADE.AGAIN, {
    mode: 'cloze',
    elapsedMs: Date.now() - shownAt.value
  })
  if (correct) stats.value.right++
  else stats.value.wrong++
  setTimeout(advance, correct ? 700 : 2200)
}

function finish () {
  session.markDone('review')
  const total = stats.value.right + stats.value.wrong
  const pct = total ? Math.round((stats.value.right / total) * 100) : 100
  toast.info(`複習完成 · 正確率 ${pct}%`)
  setTimeout(() => router.push(session.nextRoute('review')), 700)
}

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
    <SessionHeader title="複習" :current="step" :total="queue.length" exit-to="/" />

    <DataGate :ids="ids">
      <main class="shell review">
        <template v-if="!done && current">
          <div class="phase-tag">
            <span class="chip" :class="isCloze ? 'chip--violet' : 'chip--jade'">
              {{ isCloze ? '例句填空' : '看字回想' }}
            </span>
            <span class="tally">
              <span class="tally__r num">{{ stats.right }}</span>
              <span class="tally__sep">·</span>
              <span class="tally__w num">{{ stats.wrong }}</span>
            </span>
          </div>

          <ClozeQuiz v-if="isCloze" :key="current.id" :word="current" :pool="pool" @answer="onCloze" />

          <template v-else>
            <WordCard :key="current.id" :word="current" :revealed="revealed" />
            <div class="review__actions">
              <button v-if="!revealed" class="btn btn--primary btn--block zh" @click="revealed = true">
                看答案
              </button>
              <GradeButtons v-else :card="progress.cardOf(current.id)" @grade="grade" />
            </div>
          </template>

          <button class="btn btn--quiet btn--sm review__skip zh" @click="skipPhase">跳過這個階段</button>
        </template>

        <div v-else class="empty">
          <div class="empty__mark">✓</div>
          <p class="zh">複習完成</p>
        </div>
      </main>
    </DataGate>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.review {
  display: flex; flex-direction: column; gap: var(--sp-4);
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6));
}

.phase-tag { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }

.tally { display: flex; align-items: center; gap: 6px; font-size: var(--step--1); }
.tally__r { color: var(--jade); }
.tally__w { color: var(--rose); }
.tally__sep { color: var(--ink-3); }

.review__actions { margin-top: var(--sp-1); }
.review__skip { align-self: center; }
</style>
