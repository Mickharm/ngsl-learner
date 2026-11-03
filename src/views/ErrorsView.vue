<script setup>
import { ref, computed } from 'vue'
import { useProgress } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { GRAMMAR_BY_ID } from '@/data/grammar'
import { modeFor } from '@/lib/wordsrs'
import WordGame from '@/components/games/WordGame.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * The mistake notebook. Two things live here: the words with the most lapses
 * (drill them directly) and the individual wrong answers from grammar and
 * reading (read the explanation again).
 */

const progress = useProgress()
const words = useWords()

const tab = ref('words')
const drilling = ref(false)
const queue = ref([])
const step = ref(0)
const fixed = ref(0)

const trouble = computed(() =>
  progress.troubleWords
    .map(c => ({ card: c, word: words.get(c.wordId) }))
    .filter(x => x.word)
)

const questionErrors = computed(() => progress.questionErrors)

const grouped = computed(() => {
  const g = { grammar: [], article: [], cloze: [], word: [], write: [] }
  for (const e of progress.errors) (g[e.kind] ||= []).push(e)
  return g
})

const talkErrors = computed(() => (grouped.value.write || []).filter(e => e.payload?.better).slice(0, 30))

const current = computed(() => queue.value[step.value] || null)
const pool = computed(() => words.getMany([...progress.cards.keys()].slice(-400)).filter(w => w.meanings?.length))

/**
 * Drilling the notebook is extra practice, not a review: each word already
 * gets its one scheduled review a day, and a second, self-graded one here used
 * to push intervals around on the strength of a card the learner had just been
 * shown. So the drill uses the same games, at the word's own rung (recall at
 * least), and a correct answer only clears the word's open mistakes.
 */
function startDrill () {
  queue.value = trouble.value.slice(0, 20).map(t => {
    const m = modeFor(progress.cardOf(t.word.id), t.word)
    return { word: t.word, mode: !m || m === 'meaning' || m === 'listen' ? 'recall' : m }
  }).filter(q => q.word.meanings?.length)
  step.value = 0
  fixed.value = 0
  drilling.value = queue.value.length > 0
}

function onAnswer (a) {
  if (a.correct) { progress.clearWordErrors(current.value.word.id); fixed.value++ }
}

function next () {
  if (step.value + 1 < queue.value.length) step.value++
  else drilling.value = false
}
</script>

<template>
  <main class="shell err">
    <!-- drill mode -->
    <template v-if="drilling && current">
      <header class="row between">
        <span class="eyebrow">錯題強化 {{ step + 1 }}/{{ queue.length }}</span>
        <button class="btn btn--quiet btn--sm zh" @click="drilling = false">結束</button>
      </header>

      <WordGame
        :key="step + ':' + current.word.id"
        :word="current.word"
        :mode="current.mode"
        :pool="pool"
        :seed="current.word.id * 17 + step"
        @answer="onAnswer"
        @next="next"
      />
      <p class="dim zh err__note">錯題強化是額外練習，不會改變複習排程；答對會把這個字從錯題本移除。已修正 <span class="num">{{ fixed }}</span></p>
    </template>

    <!-- list mode -->
    <template v-else>
      <header class="err__head">
        <h1 class="page-title zh">錯題本</h1>
        <p class="err__sub zh">
          常忘的字會被強制拉高出現頻率。這裡是它們的清單，也是文法與閱讀答錯題的解析存放處。
        </p>
      </header>

      <div class="seg">
        <button class="seg__btn zh" :class="{ 'seg__btn--on': tab === 'words' }" @click="tab = 'words'">
          常忘單字 <span class="num">{{ trouble.length }}</span>
        </button>
        <button class="seg__btn zh" :class="{ 'seg__btn--on': tab === 'qs' }" @click="tab = 'qs'">
          答錯題目 <span class="num">{{ questionErrors.length }}</span>
        </button>
      </div>

      <!-- words -->
      <template v-if="tab === 'words'">
        <button v-if="trouble.length" class="btn btn--primary btn--block zh" @click="startDrill">
          開始強化練習（{{ Math.min(20, trouble.length) }} 個字）
        </button>

        <div v-if="trouble.length" class="tlist">
          <div v-for="t in trouble" :key="t.word.id" class="titem">
            <div class="titem__main">
              <div class="titem__row">
                <span class="titem__en">{{ t.word.headword }}</span>
                <AudioButton :text="t.word.headword" size="sm" />
              </div>
              <span class="titem__zh zh">{{ t.word.meanings?.[0]?.zh || '尚未產生翻譯' }}</span>
            </div>
            <div class="titem__meta">
              <!-- lapses only counts failures from the review state, so a word
                   missed while still new shows 0; label it by what happened. -->
              <span class="chip chip--rose">
                {{ t.card.lapses > 0 ? `忘 ${t.card.lapses}` : '答錯' }}
              </span>
              <span class="titem__ease num">難度 {{ progress.hardness(t.card).toFixed(1) }}</span>
            </div>
          </div>
        </div>

        <div v-else class="empty">
          <div class="empty__mark">○</div>
          <p class="zh">還沒有答錯記錄</p>
          <p class="dim zh" style="font-size: var(--step--2)">複習時按「忘記」的字會出現在這裡</p>
        </div>
      </template>

      <!-- questions -->
      <template v-else>
        <section v-if="grouped.grammar?.length" class="stack stack-2">
          <div class="eyebrow">文法</div>
          <div v-for="e in grouped.grammar" :key="e.id" class="qitem">
            <div class="qitem__top">
              <span class="chip chip--violet">{{ GRAMMAR_BY_ID[e.ref_id]?.band || 'G' }}</span>
              <span class="qitem__t zh">{{ GRAMMAR_BY_ID[e.ref_id]?.title || e.ref_id }}</span>
            </div>
            <p class="qitem__d zh">
              答對 {{ e.payload?.correct }}/{{ e.payload?.total }} —
              <RouterLink to="/grammar" class="qitem__link zh">再練一次</RouterLink>
            </p>
          </div>
        </section>

        <section v-if="grouped.article?.length" class="stack stack-2">
          <div class="eyebrow">閱讀理解</div>
          <div v-for="e in grouped.article" :key="e.id" class="qitem">
            <p class="qitem__q">{{ e.payload?.q }}</p>
            <p class="qitem__d zh">
              正解 <strong>{{ e.payload?.answer }}</strong> · 你選了 {{ e.payload?.picked }}
            </p>
            <p class="qitem__x zh">{{ e.payload?.explain }}</p>
            <button class="btn btn--quiet btn--sm zh" @click="progress.resolveError(e.id)">標記已懂</button>
          </div>
        </section>

        <section v-if="talkErrors.length" class="stack stack-2">
          <div class="eyebrow">主題對話裡要改的句子</div>
          <div v-for="e in talkErrors" :key="e.id" class="qitem">
            <p class="qitem__said">{{ e.payload.said }}</p>
            <div class="qitem__fix"><p>{{ e.payload.better }}</p><AudioButton :text="e.payload.better" size="sm" /></div>
            <p class="qitem__x zh">{{ e.payload.explain }}<template v-if="e.payload.topic">（{{ e.payload.topic }}）</template></p>
            <button class="btn btn--quiet btn--sm zh" @click="progress.resolveError(e.id)">標記已懂</button>
          </div>
        </section>

        <div v-if="!grouped.grammar?.length && !grouped.article?.length && !talkErrors.length" class="empty">
          <div class="empty__mark">○</div>
          <p class="zh">沒有待複習的題目</p>
        </div>
      </template>
    </template>
  </main>
</template>

<style scoped>
.err__note { font-size: var(--step--2); text-align: center; line-height: 1.6; }
.err { display: flex; flex-direction: column; gap: var(--sp-4); }
.err__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.err__sub { font-size: var(--step--1); color: var(--ink-2); line-height: 1.7; }

.seg { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; padding: 3px; background: var(--surface-2); border-radius: var(--radius); }
.seg__btn { padding: 9px 4px; border-radius: 9px; font-size: var(--step--1); font-weight: 600; color: var(--ink-3); transition: background 0.15s, color 0.15s; }
.seg__btn--on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); }
.seg__btn .num { opacity: 0.7; margin-left: 3px; }

.tlist { display: flex; flex-direction: column; gap: var(--sp-2); }
.titem { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); }
.titem__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.titem__row { display: flex; align-items: center; gap: var(--sp-2); }
.titem__en { font-family: var(--font-word); font-size: var(--step-1); font-weight: 500; }
.titem__zh { font-size: var(--step--1); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.titem__meta { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; }
.titem__ease { font-size: var(--step--2); color: var(--ink-3); }

.qitem { padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
.qitem__top { display: flex; align-items: center; gap: var(--sp-2); }
.qitem__t { font-size: var(--step--1); font-weight: 600; }
.qitem__q { font-family: var(--font-word); font-size: var(--step--1); line-height: 1.55; }
.qitem__d { font-size: var(--step--2); color: var(--ink-2); }
.qitem__d strong { color: var(--jade); }
.qitem__x { font-size: var(--step--2); color: var(--ink-3); line-height: 1.65; }
.qitem__link { color: var(--jade); text-decoration: underline; }
.qitem__said { font-family: var(--font-word); font-size: var(--step--1); color: var(--redpen); text-decoration: line-through; text-decoration-thickness: 1px; }
.qitem__fix { display: flex; align-items: flex-start; gap: 6px; }
.qitem__fix p { flex: 1; font-family: var(--font-word); font-weight: 700; color: var(--jade); line-height: 1.5; }
</style>
