<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { generateWritingTask, judgeProduction } from '@/lib/gemini'
import SessionHeader from '@/components/SessionHeader.vue'
import AudioButton from '@/components/AudioButton.vue'
import DataGate from '@/components/DataGate.vue'

/**
 * Production practice.
 *
 * Every other phase tests recognition — pick the right option, remember the
 * translation. None of it proves the learner can produce a sentence, which is
 * the whole point of "able to hold a conversation abroad". Here they write one
 * and get it marked: what was wrong, the minimum fix, and how a native speaker
 * would have said it.
 */

const WORDS_PER_DAY = 4

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const toast = useToast()
const router = useRouter()

const step = ref(0)
const task = ref(null)
const draft = ref('')
const result = ref(null)
const loadingTask = ref(false)
const judging = ref(false)
const scores = ref([])
const box = ref(null)

/** Prefer words met today; fall back to whatever is in rotation. */
const pool = computed(() => {
  const today = words.getMany(session.dayWordIds).filter(w => w.enriched && w.meanings?.length)
  if (today.length >= WORDS_PER_DAY) return today
  const rest = words.getMany([...progress.cards.keys()].slice(0, 200))
    .filter(w => w.enriched && w.meanings?.length && !today.some(t => t.id === w.id))
  return [...today, ...rest]
})

const picked = computed(() => {
  // Deterministic per day so leaving and returning does not reshuffle.
  const seed = Number(progress.today.day.replace(/-/g, ''))
  const list = pool.value
  const out = []
  for (let i = 0; i < Math.min(WORDS_PER_DAY, list.length); i++) {
    out.push(list[(seed + i * 37) % list.length])
  }
  return [...new Map(out.map(w => [w.id, w])).values()]
})

const word = computed(() => picked.value[step.value] || null)
const ids = computed(() => picked.value.map(w => w.id))
const done = computed(() => step.value >= picked.value.length)

async function loadTask () {
  if (!word.value) return
  task.value = null
  result.value = null
  draft.value = ''

  if (!settings.hasGeminiKey) {
    // Still usable without a key, just without a tailored prompt.
    task.value = {
      task_zh: `用 ${word.value.headword}（${word.value.meanings[0].zh}）寫一個句子`,
      hint_en: ''
    }
    return
  }

  loadingTask.value = true
  try {
    task.value = await generateWritingTask({
      word: word.value.headword,
      meaning: word.value.meanings[0].zh,
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
  } catch {
    task.value = {
      task_zh: `用 ${word.value.headword}（${word.value.meanings[0].zh}）寫一個句子`,
      hint_en: ''
    }
  } finally {
    loadingTask.value = false
    await nextTick()
    box.value?.focus()
  }
}

async function submit () {
  if (!draft.value.trim() || judging.value) return
  if (!settings.hasGeminiKey) {
    toast.error('造句批改需要 Gemini API Key')
    return
  }
  judging.value = true
  try {
    const r = await judgeProduction({
      task: task.value.task_zh,
      target: word.value.headword,
      learner: draft.value.trim(),
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    result.value = r
    scores.value[step.value] = r.score ?? 0
    if (!r.ok) {
      progress.logError('write', String(word.value.id), {
        word: word.value.headword,
        wrote: draft.value.trim(),
        corrected: r.corrected || '',
        explain: r.explain_zh || ''
      })
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    judging.value = false
  }
}

async function next () {
  step.value++
  if (!done.value) await loadTask()
  else finishPhase()
}

function finishPhase () {
  const total = scores.value.filter(s => s !== undefined).length
  const sum = scores.value.reduce((a, b) => a + (b || 0), 0)
  progress.bumpDay({ grammar_correct: Math.round(sum / 3), grammar_total: total })
  session.markDone('write')
}

function finish () {
  session.markDone('write')
  router.push(session.nextRoute('write'))
}

function skipPhase () {
  session.markDone('write')
  router.push(session.nextRoute('write'))
}

const avgScore = computed(() => {
  const done = scores.value.filter(s => s !== undefined)
  return done.length ? done.reduce((a, b) => a + b, 0) / done.length : 0
})

const SCORE_LABEL = ['寫不出來', '看得懂但有錯', '正確', '正確又自然']

onMounted(async () => {
  session.startClock()
  if (!picked.value.length) {
    session.markDone('write')
    router.replace(session.nextRoute('write'))
    return
  }
  await loadTask()
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader title="造句" :current="done ? picked.length : step + 1" :total="picked.length" />

    <DataGate :ids="ids">
      <main class="shell wr">
        <template v-if="!done && word">
          <div class="wr__top">
            <span class="chip chip--violet">用這個字造句</span>
            <span class="dim num">{{ step + 1 }} / {{ picked.length }}</span>
          </div>

          <header class="wr__word">
            <div class="wr__row">
              <h1 class="wr__en">{{ word.headword }}</h1>
              <AudioButton :text="word.headword" size="md" />
            </div>
            <p class="wr__zh zh">{{ word.meanings?.[0]?.zh }}</p>
          </header>

          <section v-if="loadingTask" class="wr__task wr__task--wait">
            <span class="zh">正在想一個適合你的題目…</span>
          </section>
          <section v-else-if="task" class="wr__task">
            <p class="wr__taskzh zh">{{ task.task_zh }}</p>
            <p v-if="task.hint_en" class="wr__hint">提示：{{ task.hint_en }}</p>
          </section>

          <textarea
            ref="box"
            v-model="draft"
            class="input wr__box"
            rows="3"
            :disabled="!!result || judging"
            placeholder="用英文寫一句話…"
            autocapitalize="sentences"
            autocorrect="off"
            spellcheck="true"
          />

          <button
            v-if="!result"
            class="btn btn--primary btn--block zh"
            :disabled="!draft.trim() || judging"
            @click="submit"
          >{{ judging ? '批改中…' : '送出批改' }}</button>

          <!-- feedback -->
          <Transition name="slide-up">
            <section v-if="result" class="fb" :class="result.ok ? 'fb--ok' : 'fb--no'">
              <div class="fb__head">
                <span class="zh">{{ SCORE_LABEL[result.score] || '已批改' }}</span>
                <span class="fb__score num">{{ result.score }}/3</span>
              </div>

              <p v-if="!result.usedTarget" class="fb__flag zh">
                這句話沒有正確用到 <strong>{{ word.headword }}</strong>。
              </p>

              <div v-if="result.corrected && result.corrected !== draft.trim()" class="fb__block">
                <div class="eyebrow">修正後</div>
                <div class="fb__row">
                  <p class="fb__sent">{{ result.corrected }}</p>
                  <AudioButton :text="result.corrected" size="sm" />
                </div>
              </div>

              <div v-if="result.better" class="fb__block">
                <div class="eyebrow">母語者會這樣說</div>
                <div class="fb__row">
                  <p class="fb__sent">{{ result.better }}</p>
                  <AudioButton :text="result.better" size="sm" />
                </div>
              </div>

              <p class="fb__explain zh">{{ result.explain_zh }}</p>

              <button class="btn btn--primary btn--block zh" @click="next">
                {{ step + 1 < picked.length ? '下一個字' : '看結果' }}
              </button>
            </section>
          </Transition>

          <button class="btn btn--quiet btn--sm wr__skip zh" @click="skipPhase">跳過這個階段</button>
        </template>

        <!-- summary -->
        <template v-else>
          <div class="res">
            <div class="res__ring" :style="{ '--pct': (avgScore / 3) * 100 }">
              <span class="res__pct num">{{ avgScore.toFixed(1) }}<small>/3</small></span>
            </div>
            <h2 class="res__title zh">造句練習完成</h2>
            <p class="res__note zh">
              <template v-if="avgScore >= 2.5">句子正確又自然，這是最難的部分，狀態很好。</template>
              <template v-else-if="avgScore >= 1.5">句子大致能溝通了。改過的地方值得回錯題本再看一次。</template>
              <template v-else>先求說得出來，再求正確。答錯的都存進錯題本了。</template>
            </p>
          </div>
          <button class="btn btn--primary btn--block zh" @click="finish">繼續，進入閱讀</button>
        </template>
      </main>
    </DataGate>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.wr { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6)); }

.wr__top { display: flex; align-items: center; gap: var(--sp-2); }
.wr__top .dim { margin-left: auto; font-size: var(--step--1); }

.wr__word {
  background: var(--surface); border: 1px solid var(--rule);
  border-top: 3px solid var(--violet); border-radius: var(--radius-lg);
  padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-1);
  box-shadow: var(--shadow-1);
}
.wr__row { display: flex; align-items: center; gap: var(--sp-3); }
.wr__en { font-family: var(--font-word); font-size: var(--step-3); font-weight: 500; line-height: 1.1; }
.wr__zh { font-size: var(--step-0); color: var(--ink-2); }

.wr__task {
  background: var(--violet-wash); border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: 4px;
}
.wr__task--wait { color: var(--ink-3); font-size: var(--step--1); }
.wr__taskzh { font-size: var(--step-0); font-weight: 600; line-height: 1.6; }
.wr__hint { font-family: var(--font-word); font-size: var(--step--1); color: var(--ink-2); }

.wr__box { min-height: 96px; font-family: var(--font-word); font-size: var(--step-1); line-height: 1.6; }

.fb { border-radius: var(--radius); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); border: 1px solid; }
.fb--ok { background: var(--jade-wash); border-color: var(--jade-edge); }
.fb--no { background: var(--amber-wash); border-color: var(--amber-edge); }
.fb__head { display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: var(--step-0); }
.fb--ok .fb__head { color: var(--jade); }
.fb--no .fb__head { color: var(--amber); }
.fb__score { font-size: var(--step--1); opacity: 0.8; }
.fb__flag { font-size: var(--step--1); color: var(--rose); }
.fb__flag strong { font-family: var(--font-word); }
.fb__block { display: flex; flex-direction: column; gap: 4px; }
.fb__row { display: flex; align-items: flex-start; gap: var(--sp-2); background: var(--surface); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3); }
.fb__sent { flex: 1; font-family: var(--font-word); font-size: var(--step-0); line-height: 1.55; }
.fb__explain { font-size: var(--step--1); line-height: 1.75; color: var(--ink-2); }

.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-6) 0 var(--sp-4); text-align: center; }
.res__ring {
  width: 118px; height: 118px; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--violet) calc(var(--pct) * 1%), var(--surface-3) 0); position: relative;
}
.res__ring::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--paper); }
.res__pct { position: relative; z-index: 1; font-size: var(--step-2); font-weight: 600; }
.res__pct small { font-size: var(--step--1); color: var(--ink-3); }
.res__title { font-size: var(--step-1); font-weight: 700; }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.7; max-width: 32ch; }

.wr__skip { align-self: center; }
</style>
