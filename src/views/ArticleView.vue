<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'
import { generateArticle } from '@/lib/gemini'
import { idbGet, idbPut, STORE } from '@/lib/idb'
import { useWords } from '@/stores/words'
import { useProgress, todayKey } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import SessionHeader from '@/components/SessionHeader.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * Reading phase. One article per day, built from exactly the words the day
 * touched, so the vocabulary is met in context on the same day it was drilled
 * — the step that turns a recognised word into a usable one.
 *
 * Articles are cached in Supabase (per user per day) and mirrored to IndexedDB,
 * so re-opening the page never spends another Gemini call.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const auth = useAuth()
const toast = useToast()
const router = useRouter()

const TOPICS = [
  { key: 'daily', label: '日常' },
  { key: 'travel', label: '旅遊' },
  { key: 'work', label: '職場' },
  { key: 'tech', label: '科技' },
  { key: 'news', label: '新聞' }
]

const state = ref('idle')      // idle | loading | reading | quiz | result | error
const article = ref(null)
const errMsg = ref('')
const topic = ref('daily')
const showTranslation = ref(false)
const qIndex = ref(0)
const picks = ref([])
const settled = ref(false)

const cacheKey = computed(() => `${todayKey()}:${topic.value}`)
const dayWords = computed(() => words.getMany(session.dayWordIds).filter(w => w.enriched))
const questions = computed(() => article.value?.questions || [])
const question = computed(() => questions.value[qIndex.value] || null)
const correctCount = computed(() =>
  picks.value.reduce((n, p, i) => n + (p === questions.value[i]?.answer ? 1 : 0), 0)
)

/** Words from today that actually appear in the text, for the glossary strip. */
const usedWords = computed(() => {
  if (!article.value) return []
  const body = (article.value.body || '').toLowerCase()
  return dayWords.value.filter(w => {
    const stem = w.headword.length > 4 ? w.headword.slice(0, Math.ceil(w.headword.length * 0.7)) : w.headword
    return body.includes(stem.toLowerCase())
  })
})

const paragraphs = computed(() => (article.value?.body || '').split(/\n{2,}/).filter(Boolean))
const paragraphsZh = computed(() => (article.value?.body_zh || '').split(/\n{2,}/).filter(Boolean))

async function loadCached () {
  const local = await idbGet(STORE.ARTICLES, cacheKey.value)
  if (local?.payload) { article.value = local.payload; return true }

  if (!auth.userId) return false
  const { data } = await supabase.from('articles')
    .select('*')
    .eq('user_id', auth.userId)
    .eq('day', todayKey())
    .eq('topic', topic.value)
    .maybeSingle()

  if (data) {
    article.value = {
      title: data.title, title_zh: data.title_zh,
      body: data.body, body_zh: data.body_zh,
      questions: data.questions || [], used_words: []
    }
    await idbPut(STORE.ARTICLES, { key: cacheKey.value, payload: article.value })
    return true
  }
  return false
}

async function generate (force = false) {
  state.value = 'loading'
  errMsg.value = ''
  try {
    if (!force && await loadCached()) { state.value = 'reading'; return }

    if (!settings.hasGeminiKey) {
      state.value = 'error'
      errMsg.value = '尚未設定 Gemini API Key。到「設定」頁面填入後就能產生每日文章。'
      return
    }

    const source = dayWords.value.length ? dayWords.value : words.getMany([...progress.cards.keys()].slice(0, 15))
    if (!source.length) {
      state.value = 'error'
      errMsg.value = '今天還沒有學過任何單字，先完成前面的關卡再回來。'
      return
    }

    const result = await generateArticle({
      words: source.slice(0, 24),
      topic: topic.value,
      grammarPoint: session.grammarPoint,
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })

    article.value = result
    await idbPut(STORE.ARTICLES, { key: cacheKey.value, payload: result })

    if (auth.userId) {
      supabase.from('articles').upsert({
        user_id: auth.userId,
        day: todayKey(),
        topic: topic.value,
        title: result.title,
        title_zh: result.title_zh,
        body: result.body,
        body_zh: result.body_zh,
        word_ids: source.map(w => w.id),
        questions: result.questions
      }, { onConflict: 'user_id,day,topic' }).then(() => {}, () => {})
    }

    state.value = 'reading'
  } catch (e) {
    state.value = 'error'
    errMsg.value = e?.message || '產生文章時發生錯誤'
  }
}

function startQuiz () {
  qIndex.value = 0
  picks.value = []
  settled.value = false
  state.value = 'quiz'
}

function pick (i) {
  if (settled.value) return
  picks.value[qIndex.value] = i
  settled.value = true
  if (i !== question.value.answer) {
    progress.logError('article', cacheKey.value, {
      q: question.value.q,
      picked: question.value.options[i],
      answer: question.value.options[question.value.answer],
      explain: question.value.explain_zh
    })
  }
}

function nextQuestion () {
  if (qIndex.value + 1 < questions.value.length) {
    qIndex.value++
    settled.value = false
  } else {
    finishQuiz()
  }
}

function finishQuiz () {
  state.value = 'result'
  progress.setDay({
    article_done: true,
    article_correct: correctCount.value,
    article_total: questions.value.length
  })
  if (auth.userId) {
    supabase.from('articles')
      .update({ answers: picks.value, score: correctCount.value })
      .eq('user_id', auth.userId).eq('day', todayKey()).eq('topic', topic.value)
      .then(() => {}, () => {})
  }
}

function done () {
  session.markDone('article')
  router.push('/summary')
}

function skipPhase () {
  session.markDone('article')
  router.push('/summary')
}

const KIND_LABEL = { vocab: '單字語境', detail: '細節理解', grammar: '文法應用', inference: '情境推論' }

onMounted(() => {
  session.startClock()
  topic.value = settings.state.articleTopics?.[0] || 'daily'
  generate()
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader
      title="今日閱讀"
      :current="state === 'quiz' ? qIndex + 1 : (state === 'result' ? questions.length : 0)"
      :total="state === 'quiz' || state === 'result' ? questions.length : 0"
    />

    <!-- loading -->
    <main v-if="state === 'loading'" class="shell gate">
      <div class="gate__spinner"><span /><span /><span /></div>
      <h2 class="gate__title zh">正在生成今天的短文</h2>
      <p class="gate__desc zh">用你今天複習過的 {{ dayWords.length }} 個單字寫一篇文章，並出 6 道理解題。</p>
    </main>

    <!-- error -->
    <main v-else-if="state === 'error'" class="shell gate">
      <div class="empty__mark">!</div>
      <h2 class="gate__title zh">無法產生文章</h2>
      <p class="gate__desc zh">{{ errMsg }}</p>
      <div class="row row-2 wrap">
        <button class="btn btn--primary zh" @click="generate(true)">重試</button>
        <RouterLink to="/settings" class="btn btn--ghost zh">前往設定</RouterLink>
        <button class="btn btn--quiet zh" @click="skipPhase">跳過</button>
      </div>
    </main>

    <!-- reading -->
    <main v-else-if="state === 'reading' && article" class="shell art">
      <div class="art__topics scroll-x">
        <button
          v-for="t in TOPICS" :key="t.key"
          class="topic zh"
          :class="{ 'topic--on': topic === t.key }"
          @click="topic = t.key; generate()"
        >{{ t.label }}</button>
      </div>

      <header class="art__head">
        <h1 class="art__title">{{ article.title }}</h1>
        <p class="art__titlezh zh">{{ article.title_zh }}</p>
        <div class="art__tools">
          <AudioButton :text="article.body" size="sm" label="朗讀全文" />
          <button class="btn btn--quiet btn--sm zh" @click="showTranslation = !showTranslation">
            {{ showTranslation ? '隱藏中譯' : '顯示中譯' }}
          </button>
          <button class="btn btn--quiet btn--sm zh" @click="generate(true)">換一篇</button>
        </div>
      </header>

      <article class="art__body">
        <div v-for="(p, i) in paragraphs" :key="i" class="para">
          <p class="para__en">{{ p }}</p>
          <p v-if="showTranslation && paragraphsZh[i]" class="para__zh zh">{{ paragraphsZh[i] }}</p>
        </div>
      </article>

      <section v-if="usedWords.length" class="gloss">
        <div class="eyebrow">今日單字出現在文中</div>
        <div class="gloss__list">
          <div v-for="w in usedWords" :key="w.id" class="gloss__item">
            <span class="gloss__en">{{ w.headword }}</span>
            <span class="gloss__zh zh">{{ w.meanings?.[0]?.zh }}</span>
            <AudioButton :text="w.headword" size="sm" />
          </div>
        </div>
      </section>

      <button class="btn btn--primary btn--block zh" @click="startQuiz">
        開始作答（{{ questions.length }} 題）
      </button>
      <button class="btn btn--quiet btn--sm art__skip zh" @click="skipPhase">跳過這個階段</button>
    </main>

    <!-- quiz -->
    <main v-else-if="state === 'quiz' && question" class="shell art">
      <div class="phase-tag">
        <span class="chip chip--violet">{{ KIND_LABEL[question.kind] || '理解題' }}</span>
        <span class="tally num">{{ correctCount }} / {{ picks.filter(p => p !== undefined).length }}</span>
      </div>

      <div class="qbox">
        <p class="qbox__q">{{ question.q }}</p>
        <p v-if="question.q_zh" class="qbox__zh zh">{{ question.q_zh }}</p>
      </div>

      <div class="opts">
        <button
          v-for="(o, i) in question.options" :key="i"
          class="opt"
          :class="{
            'opt--right': settled && i === question.answer,
            'opt--wrong': settled && picks[qIndex] === i && i !== question.answer,
            'opt--mute': settled && picks[qIndex] !== i && i !== question.answer
          }"
          :disabled="settled"
          @click="pick(i)"
        >
          <span class="opt__key num">{{ 'ABCD'[i] }}</span>
          <span class="opt__text">{{ o }}</span>
        </button>
      </div>

      <Transition name="slide-up">
        <div v-if="settled" class="fb" :class="picks[qIndex] === question.answer ? 'fb--ok' : 'fb--no'">
          <div class="fb__head zh">{{ picks[qIndex] === question.answer ? '答對了' : '答錯了' }}</div>
          <p class="fb__explain zh">{{ question.explain_zh }}</p>
          <button class="btn btn--primary btn--block zh" @click="nextQuestion">
            {{ qIndex + 1 < questions.length ? '下一題' : '看結果' }}
          </button>
        </div>
      </Transition>

      <button class="btn btn--quiet btn--sm art__skip zh" @click="state = 'reading'">回去看文章</button>
    </main>

    <!-- result -->
    <main v-else-if="state === 'result'" class="shell art">
      <div class="res">
        <div class="res__ring" :style="{ '--pct': questions.length ? (correctCount / questions.length) * 100 : 0 }">
          <span class="res__pct num">{{ correctCount }}<small>/{{ questions.length }}</small></span>
        </div>
        <h2 class="res__title zh">閱讀理解完成</h2>
        <p class="res__note zh">
          <template v-if="correctCount / questions.length >= 0.8">理解度不錯，這些單字你已經能在句子裡讀懂了。</template>
          <template v-else>答錯的題目已存進錯題本，可以隨時回去看解析。</template>
        </p>
      </div>

      <div class="review-list">
        <div v-for="(q, i) in questions" :key="i" class="rq" :class="{ 'rq--no': picks[i] !== q.answer }">
          <div class="rq__top">
            <span class="rq__n num">{{ i + 1 }}</span>
            <span class="rq__q">{{ q.q }}</span>
          </div>
          <p class="rq__ans zh">
            正解：<strong>{{ q.options[q.answer] }}</strong>
            <template v-if="picks[i] !== q.answer"> · 你選了 {{ q.options[picks[i]] }}</template>
          </p>
          <p class="rq__ex zh">{{ q.explain_zh }}</p>
        </div>
      </div>

      <button class="btn btn--primary btn--block zh" @click="done">完成，看今日結算</button>
      <button class="btn btn--ghost btn--block zh" @click="state = 'reading'">再讀一次文章</button>
    </main>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.art {
  display: flex; flex-direction: column; gap: var(--sp-4);
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6));
}

.gate {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--sp-3); text-align: center; min-height: 60dvh;
}
.gate__title { font-size: var(--step-1); font-weight: 700; }
.gate__desc { font-size: var(--step--1); color: var(--ink-2); line-height: 1.7; max-width: 34ch; }
.gate__spinner { display: flex; gap: 6px; }
.gate__spinner span { width: 8px; height: 8px; border-radius: 50%; background: var(--jade); animation: bounce 1.1s ease-in-out infinite; }
.gate__spinner span:nth-child(2) { animation-delay: 0.14s; }
.gate__spinner span:nth-child(3) { animation-delay: 0.28s; }
@keyframes bounce { 0%,70%,100% { transform: translateY(0); opacity: 0.4; } 35% { transform: translateY(-7px); opacity: 1; } }

/* topics */
.art__topics { display: flex; gap: var(--sp-2); padding-bottom: 2px; }
.topic {
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--rule);
  background: var(--surface);
  font-size: var(--step--1);
  color: var(--ink-2);
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.topic--on { background: var(--jade); border-color: var(--jade); color: var(--surface); font-weight: 600; }

/* head */
.art__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.art__title {
  font-family: var(--font-word);
  font-size: var(--step-3);
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.art__titlezh { font-size: var(--step--1); color: var(--ink-2); }
.art__tools { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin-top: var(--sp-1); }

/* body */
.art__body { display: flex; flex-direction: column; gap: var(--sp-4); }
.para { display: flex; flex-direction: column; gap: var(--sp-2); }
.para__en {
  font-family: var(--font-word);
  font-size: var(--step-1);
  line-height: 1.85;
  letter-spacing: 0.002em;
}
.para__zh {
  font-size: var(--step--1);
  color: var(--ink-2);
  line-height: 1.8;
  padding-left: var(--sp-3);
  border-left: 2px solid var(--rule);
}

/* glossary */
.gloss {
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
}
.gloss__list { display: flex; flex-direction: column; gap: var(--sp-1); }
.gloss__item { display: flex; align-items: center; gap: var(--sp-3); padding: 3px 0; }
.gloss__en { font-family: var(--font-word); font-size: var(--step-0); font-weight: 500; min-width: 100px; }
.gloss__zh { flex: 1; font-size: var(--step--1); color: var(--ink-2); }

/* quiz shared with grammar */
.phase-tag { display: flex; align-items: center; gap: var(--sp-2); }
.tally { margin-left: auto; font-size: var(--step--1); color: var(--ink-2); }

.qbox {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-lg);
  padding: var(--sp-5) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
  box-shadow: var(--shadow-1);
}
.qbox__q { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.55; }
.qbox__zh { font-size: var(--step--1); color: var(--ink-2); }

.opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.opt {
  display: flex; align-items: flex-start; gap: var(--sp-3);
  min-height: 50px; padding: var(--sp-3);
  border-radius: var(--radius);
  border: 1px solid var(--rule-strong);
  background: var(--surface);
  text-align: left;
  transition: background 0.14s, border-color 0.14s, opacity 0.2s;
}
.opt__key {
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: var(--radius-sm); background: var(--surface-2);
  color: var(--ink-3); font-size: var(--step--2); flex-shrink: 0;
}
.opt__text { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; }
.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade); }
.opt--right .opt__key { background: var(--jade); color: var(--surface); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.opt--mute { opacity: 0.42; }

.fb { border-radius: var(--radius); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); border: 1px solid; }
.fb--ok { background: var(--jade-wash); border-color: var(--jade-edge); }
.fb--no { background: var(--rose-wash); border-color: var(--rose-edge); }
.fb__head { font-weight: 700; font-size: var(--step-0); }
.fb--ok .fb__head { color: var(--jade); }
.fb--no .fb__head { color: var(--rose); }
.fb__explain { font-size: var(--step--1); line-height: 1.75; color: var(--ink-2); }

/* result */
.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-5) 0 var(--sp-2); text-align: center; }
.res__ring {
  width: 112px; height: 112px; border-radius: 50%;
  display: grid; place-items: center;
  background: conic-gradient(var(--jade) calc(var(--pct) * 1%), var(--surface-3) 0);
  position: relative;
}
.res__ring::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--paper); }
.res__pct { position: relative; z-index: 1; font-size: var(--step-3); font-weight: 600; }
.res__pct small { font-size: var(--step-0); color: var(--ink-3); }
.res__title { font-size: var(--step-1); font-weight: 700; }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.7; max-width: 32ch; }

.review-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.rq {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-left: 3px solid var(--jade);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: 5px;
}
.rq--no { border-left-color: var(--rose); }
.rq__top { display: flex; gap: var(--sp-2); align-items: baseline; }
.rq__n { font-size: var(--step--2); color: var(--ink-3); flex-shrink: 0; }
.rq__q { font-family: var(--font-word); font-size: var(--step--1); line-height: 1.5; }
.rq__ans { font-size: var(--step--2); color: var(--ink-2); }
.rq__ans strong { color: var(--jade); }
.rq__ex { font-size: var(--step--2); color: var(--ink-3); line-height: 1.65; }

.art__skip { align-self: center; }
</style>
