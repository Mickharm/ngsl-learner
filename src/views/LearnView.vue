<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { GRADE } from '@/lib/srs'
import SessionHeader from '@/components/SessionHeader.vue'
import WordCard from '@/components/WordCard.vue'
import GradeButtons from '@/components/GradeButtons.vue'
import DataGate from '@/components/DataGate.vue'

/**
 * New-word phase. Each word is seen twice before the phase ends: once as a
 * card being read, then again in a rapid recognition round. Seeing a word once
 * and calling it "learned" is what makes vocabulary evaporate.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const toast = useToast()
const router = useRouter()

const ids = ref([])
const step = ref(0)
const revealed = ref(false)
const mode = ref('read')        // read | recall | done
const shownAt = ref(Date.now())

// recall round
const recallQueue = ref([])
const recallIndex = ref(0)
const recallPicked = ref(null)
const recallWrong = ref([])

const list = computed(() => words.getMany(ids.value))
const current = computed(() => list.value[step.value] || null)
const total = computed(() => list.value.length)

const recallCurrent = computed(() => recallQueue.value[recallIndex.value] || null)

const recallOptions = computed(() => {
  const w = recallCurrent.value
  if (!w) return []
  const answer = w.meanings?.[0]?.zh || w.headword
  const pool = list.value
    .filter(o => o.id !== w.id && o.meanings?.[0]?.zh)
    .map(o => o.meanings[0].zh)
  const extras = []
  for (const p of pool) {
    if (extras.length >= 3) break
    if (p !== answer && !extras.includes(p)) extras.push(p)
  }
  // Backfill from the wider word list if this day's batch is small.
  if (extras.length < 3) {
    for (let i = 0; i < 60 && extras.length < 3; i++) {
      const rid = 1 + Math.floor(Math.random() * 2801)
      const cand = words.get(rid)?.meanings?.[0]?.zh
      if (cand && cand !== answer && !extras.includes(cand)) extras.push(cand)
    }
  }
  const all = [answer, ...extras]
  let seed = w.id * 7919 + 13
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
})

const recallAnswerIndex = computed(() => {
  const w = recallCurrent.value
  if (!w) return -1
  return recallOptions.value.indexOf(w.meanings?.[0]?.zh || w.headword)
})

function reveal () {
  revealed.value = true
}

function grade (g) {
  const w = current.value
  if (!w) return
  progress.gradeCard(w.id, g, { mode: 'card', elapsedMs: Date.now() - shownAt.value })

  if (step.value + 1 < total.value) {
    step.value++
    revealed.value = false
    shownAt.value = Date.now()
  } else {
    startRecall()
  }
}

function startRecall () {
  recallQueue.value = [...list.value].sort(() => Math.random() - 0.5)
  recallIndex.value = 0
  recallPicked.value = null
  recallWrong.value = []
  mode.value = 'recall'
}

function pickRecall (i) {
  if (recallPicked.value !== null) return
  recallPicked.value = i
  const w = recallCurrent.value
  const correct = i === recallAnswerIndex.value
  if (!correct) {
    recallWrong.value.push(w.id)
    progress.gradeCard(w.id, GRADE.AGAIN, { mode: 'cloze' })
  }
  setTimeout(() => {
    if (recallIndex.value + 1 < recallQueue.value.length) {
      recallIndex.value++
      recallPicked.value = null
    } else {
      finish()
    }
  }, correct ? 550 : 1600)
}

function finish () {
  mode.value = 'done'
  session.markDone('learn')
  const wrong = recallWrong.value.length
  toast.info(wrong ? `完成，${wrong} 個字需要加強` : '全部答對，進入複習')
  setTimeout(() => router.push(session.plan.reviewCount ? '/review' : '/grammar'), 900)
}

function skipPhase () {
  session.markDone('learn')
  router.push('/')
}

onMounted(async () => {
  session.startClock()
  ids.value = session.lockNewIds()
  if (!ids.value.length) {
    session.markDone('learn')
    router.replace(session.nextRoute('learn'))
  }
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader
      title="新單字"
      :current="mode === 'read' ? step + 1 : total"
      :total="total"
    />

    <DataGate :ids="ids">
      <main class="shell learn">
        <!-- reading round -->
        <template v-if="mode === 'read' && current">
          <div class="phase-tag">
            <span class="chip chip--jade">第一次見面</span>
            <span class="dim zh">看完後誠實評分</span>
          </div>

          <WordCard :word="current" :revealed="revealed" />

          <div class="learn__actions">
            <button v-if="!revealed" class="btn btn--primary btn--block zh" @click="reveal">
              看答案
            </button>
            <GradeButtons v-else :card="progress.cardOf(current.id)" @grade="grade" />
          </div>

          <button class="btn btn--quiet btn--sm learn__skip zh" @click="skipPhase">跳過這個階段</button>
        </template>

        <!-- recall round -->
        <template v-else-if="mode === 'recall' && recallCurrent">
          <div class="phase-tag">
            <span class="chip chip--violet">快速回想</span>
            <span class="dim num">{{ recallIndex + 1 }} / {{ recallQueue.length }}</span>
          </div>

          <div class="recall">
            <h2 class="recall__word">{{ recallCurrent.headword }}</h2>
            <p v-if="recallCurrent.ipa" class="recall__ipa num">{{ recallCurrent.ipa }}</p>
          </div>

          <div class="recall__opts">
            <button
              v-for="(o, i) in recallOptions"
              :key="o + i"
              class="ropt zh"
              :class="{
                'ropt--right': recallPicked !== null && i === recallAnswerIndex,
                'ropt--wrong': recallPicked === i && i !== recallAnswerIndex,
                'ropt--mute': recallPicked !== null && recallPicked !== i && i !== recallAnswerIndex
              }"
              :disabled="recallPicked !== null"
              @click="pickRecall(i)"
            >{{ o }}</button>
          </div>
        </template>

        <!-- done -->
        <div v-else class="empty">
          <div class="empty__mark">✓</div>
          <p class="zh">這個階段完成了</p>
        </div>
      </main>
    </DataGate>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.learn { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6)); }

.phase-tag { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); font-size: var(--step--2); }

.learn__actions { margin-top: var(--sp-1); }
.learn__skip { align-self: center; }

/* recall */
.recall {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--violet);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  padding: var(--sp-7) var(--sp-4);
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
}
.recall__word {
  font-family: var(--font-word);
  font-size: clamp(2rem, 10vw, 2.8rem);
  font-weight: 500;
  text-align: center;
  word-break: break-word;
}
.recall__ipa { font-size: var(--step--1); color: var(--ink-2); }

.recall__opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.ropt {
  min-height: 52px;
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--radius);
  border: 1px solid var(--rule-strong);
  background: var(--surface);
  font-size: var(--step-0);
  font-weight: 500;
  text-align: left;
  line-height: 1.45;
  transition: background 0.14s, border-color 0.14s, opacity 0.2s;
}
.ropt:active:not(:disabled) { background: var(--surface-2); }
.ropt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade); }
.ropt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.ropt--mute { opacity: 0.4; }
</style>
