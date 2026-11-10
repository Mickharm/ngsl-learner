<script setup>
import { ref, computed } from 'vue'
import { useProgress, todayKey } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { GRAMMAR_BY_ID } from '@/data/grammar'
import { modeFor } from '@/lib/wordsrs'
import { contrastRound } from '@/lib/confusion'
import { layoutPart2 } from '@/lib/part2'
import { KIND_LABEL } from '@/data/part2'
import { speak } from '@/lib/tts'
import { useSettings } from '@/stores/settings'
import { sfx, buzz } from '@/lib/sfx'
import WordGame from '@/components/games/WordGame.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * The mistake notebook: every kind of mistake the app records has a place
 * here and a way out of here.
 *
 *   常忘單字  words with open misses — drill them with the review games
 *   易混淆    pairs of words taken for each other — a head-to-head drill
 *             (lib/confusion.js); two clean rounds retire a pair
 *   聽力      words and 應答 items missed by ear — hear them again; they
 *             also lead tomorrow's listening round
 *   答錯題目  grammar / reading / talk answers with their explanations, and
 *             units that were failed and not passed since
 *
 * Before v6.1 the last two kinds existed only as rows in the database.
 */
const progress = useProgress()
const words = useWords()
const settings = useSettings()

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

/* ---------------- 易混淆: pairs, and the head-to-head drill ---------------- */

const short = w => (w?.meanings?.[0]?.zh || '').replace(/[（(][^）)]*[）)]/g, '').split(/[;；]/)[0].trim()
const daySeed = () => Number(todayKey().replace(/-/g, '')) % 100000
/** Only pairs that can be drilled fairly are listed (progress.drillablePairs), so the count is honest. */
const pairs = computed(() => progress.drillablePairs.map(r => ({ ...r, wa: words.get(r.a), wb: words.get(r.b) })))

const vs = ref(null)   // { rounds, pair, item, picked, settled, missed:Set, cleared }
const vsRound = computed(() => vs.value?.rounds[vs.value.pair] || null)
const vsItem = computed(() => vsRound.value?.items[vs.value.item] || null)
const vsTotal = computed(() => vs.value?.rounds.reduce((n, r) => n + r.items.length, 0) || 0)
const vsDone = computed(() => {
  if (!vs.value) return 0
  let n = vs.value.item
  for (let i = 0; i < vs.value.pair; i++) n += vs.value.rounds[i].items.length
  return n
})

function say (text) {
  if (text) speak(text, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
}
function startVs () {
  const rounds = contrastRound(progress.confusedPairs, id => words.get(id), { maxPairs: 5, seed: daySeed() + Object.keys(progress.confusions).length })
  if (!rounds.length) return
  vs.value = { rounds, pair: 0, item: 0, picked: null, settled: false, missed: false, cleared: 0, finished: false }
  say(rounds[0].items[0].say)
}
function pickVs (i) {
  const v = vs.value
  if (!v || v.settled) return
  const it = vsItem.value
  const ok = i === it.answer
  sfx(ok ? 'good' : 'bad')
  if (!ok) { buzz(40); progress.noteConfusion(it.targetId, it.otherId) }
  vs.value = { ...v, picked: i, settled: true, missed: v.missed || !ok }
  if (it.kind === 'gap') say(it.full)
}
function nextVs () {
  const v = vs.value
  if (!v) return
  const round = vsRound.value
  if (v.item + 1 < round.items.length) {
    vs.value = { ...v, item: v.item + 1, picked: null, settled: false }
  } else {
    // the pair's round is over: a clean one counts toward retiring it
    let cleared = v.cleared
    if (!v.missed) { progress.settlePair(round.a, round.b); cleared++ }
    if (v.pair + 1 < v.rounds.length) vs.value = { ...v, pair: v.pair + 1, item: 0, picked: null, settled: false, missed: false, cleared }
    else { vs.value = { ...v, cleared, finished: true }; sfx('win'); return }
  }
  say(vsItem.value?.say)
}

/* ---------------- 聽力 ---------------- */

const heard = computed(() => progress.listenErrors.map(e => ({ ...e, word: words.get(e.wordId) })))
const missed2 = computed(() => progress.part2Missed.map(it => layoutPart2(it, 1)))
const shown = ref(new Set())
const show = id => { shown.value = new Set(shown.value).add(id) }
const listenCount = computed(() => heard.value.length + missed2.value.length)

/* ---------------- units ---------------- */
const units = computed(() => progress.unitErrors)
const qCount = computed(() => questionErrors.value.length + units.value.length)
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

    <!-- head-to-head drill -->
    <template v-else-if="vs && vs.finished">
      <div class="vsend">
        <h2 class="vsend__t kai">分辨練習完成</h2>
        <p class="vsend__n zh">這一輪 {{ vs.rounds.length }} 組裡，有 <b class="fig">{{ vs.cleared }}</b> 組全對。</p>
        <p class="dim zh err__note">同一組連續兩輪全對就會從清單移除；又選錯的話重新計算。</p>
      </div>
      <button class="btn btn--primary btn--block zh" @click="vs = null">回錯題本</button>
    </template>
    <template v-else-if="vs && vsItem">
      <header class="row between">
        <span class="eyebrow">分辨 {{ vsDone + 1 }}/{{ vsTotal }}</span>
        <button class="btn btn--quiet btn--sm zh" @click="vs = null">結束</button>
      </header>

      <div class="vs__pair zh">
        <span>{{ words.get(vsRound.a)?.headword }}</span><i>還是</i><span>{{ words.get(vsRound.b)?.headword }}</span>
      </div>

      <div class="vs__q card">
        <p class="vs__kind zh">{{ vsItem.kind === 'zh→word' ? '這個意思是哪一個字？' : vsItem.kind === 'word→zh' ? '這個字是哪一個意思？' : '空格裡是哪一個字？' }}</p>
        <p class="vs__prompt" :class="{ zh: vsItem.kind === 'zh→word' }">
          {{ vsItem.prompt }}
          <AudioButton v-if="vsItem.say" :text="vsItem.say" size="sm" />
        </p>
        <p v-if="vsItem.zh && vs.settled" class="vs__zh zh">{{ vsItem.zh }}</p>
      </div>

      <div class="vs__opts">
        <button
          v-for="(o, i) in vsItem.options" :key="i"
          class="opt vs__opt"
          :class="{
            'opt--right': vs.settled && i === vsItem.answer,
            'opt--wrong': vs.settled && vs.picked === i && i !== vsItem.answer,
            'opt--mute': vs.settled && vs.picked !== i && i !== vsItem.answer,
            zh: vsItem.kind === 'word→zh'
          }"
          :disabled="vs.settled"
          @click="pickVs(i)"
        >{{ o.text }}</button>
      </div>

      <template v-if="vs.settled">
        <div class="vs__key">
          <p><b>{{ words.get(vsRound.a)?.headword }}</b><span class="zh">{{ short(words.get(vsRound.a)) }}</span></p>
          <p><b>{{ words.get(vsRound.b)?.headword }}</b><span class="zh">{{ short(words.get(vsRound.b)) }}</span></p>
        </div>
        <button class="btn btn--primary btn--block zh" @click="nextVs">繼續</button>
      </template>
      <p class="dim zh err__note">每一題都只有這兩個字可選，答案會換邊：不分清楚就過不了。</p>
    </template>

    <!-- list mode -->
    <template v-else>
      <header class="err__head">
        <h1 class="page-title zh">錯題本</h1>
        <p class="err__sub zh">
          每一種錯都有地方放，也都有離開這裡的方法：答對、分清楚、聽懂，或是把單元重新上過。
        </p>
      </header>

      <div class="seg seg--4">
        <button class="seg__btn zh" :class="{ 'seg__btn--on': tab === 'words' }" @click="tab = 'words'">
          常忘 <span class="num">{{ trouble.length }}</span>
        </button>
        <button class="seg__btn zh" :class="{ 'seg__btn--on': tab === 'pairs' }" @click="tab = 'pairs'">
          易混淆 <span class="num">{{ pairs.length }}</span>
        </button>
        <button class="seg__btn zh" :class="{ 'seg__btn--on': tab === 'listen' }" @click="tab = 'listen'">
          聽力 <span class="num">{{ listenCount }}</span>
        </button>
        <button class="seg__btn zh" :class="{ 'seg__btn--on': tab === 'qs' }" @click="tab = 'qs'">
          題目 <span class="num">{{ qCount }}</span>
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

      <!-- confusable pairs -->
      <template v-else-if="tab === 'pairs'">
        <button v-if="pairs.length" class="btn btn--primary btn--block zh" @click="startVs">
          開始分辨練習（{{ Math.min(5, pairs.length) }} 組）
        </button>
        <div v-if="pairs.length" class="tlist">
          <div v-for="p in pairs" :key="p.a + '-' + p.b" class="pitem">
            <div class="pitem__w"><b>{{ p.wa.headword }}</b><span class="zh">{{ short(p.wa) }}</span></div>
            <span class="pitem__x zh">↔</span>
            <div class="pitem__w"><b>{{ p.wb.headword }}</b><span class="zh">{{ short(p.wb) }}</span></div>
            <span class="chip chip--amber num">混 {{ p.n }}</span>
          </div>
        </div>
        <div v-else class="empty">
          <div class="empty__mark">○</div>
          <p class="zh">還沒有搞混的字</p>
          <p class="dim zh" style="font-size: var(--step--2)">選擇題選到另一個字、或拼成另一個字時，那一對會記在這裡</p>
        </div>
      </template>

      <!-- listening -->
      <template v-else-if="tab === 'listen'">
        <p v-if="listenCount" class="err__sub zh">這些明天的聽力會先出。先按播放聽聽看，再打開答案。</p>
        <div v-if="heard.length" class="tlist">
          <div v-for="e in heard" :key="e.id" class="litem">
            <AudioButton :text="e.payload?.audio || e.word.headword" size="md" />
            <div class="litem__body">
              <template v-if="shown.has(e.id)">
                <p class="litem__en">{{ e.payload?.audio || e.word.headword }}</p>
                <p class="litem__zh zh"><b>{{ e.word.headword }}</b>　{{ short(e.word) }}</p>
              </template>
              <button v-else class="litem__show zh" @click="show(e.id)">聽完了，看答案</button>
            </div>
            <button v-if="shown.has(e.id)" class="btn btn--quiet btn--sm zh" @click="progress.clearListenErrors(e.wordId)">聽懂了</button>
          </div>
        </div>
        <section v-if="missed2.length" class="stack stack-2">
          <div class="eyebrow">應答聽力</div>
          <div v-for="it in missed2" :key="it.id" class="qitem">
            <div class="qitem__top">
              <span class="chip chip--violet">{{ KIND_LABEL[it.kind] }}</span>
              <AudioButton :text="it.q" size="sm" />
              <span class="qitem__q">{{ it.q }}</span>
            </div>
            <p class="qitem__d zh">{{ it.zh }}</p>
            <p class="qitem__fix"><span class="qitem__ok">{{ it.options[it.answer].en }}</span><AudioButton :text="it.options[it.answer].en" size="sm" /></p>
            <p class="qitem__x zh">{{ it.tip }}</p>
          </div>
        </section>
        <div v-if="!listenCount" class="empty">
          <div class="empty__mark">○</div>
          <p class="zh">沒有聽錯的題目</p>
          <p class="dim zh" style="font-size: var(--step--2)">聽力關卡裡聽錯的字和應答題會出現在這裡</p>
        </div>
      </template>

      <!-- questions -->
      <template v-else>
        <section v-if="units.length" class="stack stack-2">
          <div class="eyebrow">沒過、還沒重上的單元</div>
          <div v-for="e in units" :key="e.id" class="qitem">
            <div class="qitem__top">
              <span class="chip chip--amber zh">{{ e.kind === 'parts' ? '字首字尾' : '基礎知識' }}</span>
              <span class="qitem__t zh">{{ e.payload?.title || e.ref_id }}</span>
            </div>
            <p class="qitem__d zh">
              上次答對 {{ e.payload?.correct }}/{{ e.payload?.total }} —
              <RouterLink :to="e.kind === 'parts' ? `/parts?unit=${e.ref_id}` : '/essentials'" class="qitem__link zh">重上這個單元</RouterLink>
              <span class="dim">（通過就會從這裡消失）</span>
            </p>
          </div>
        </section>

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

        <div v-if="!units.length && !grouped.grammar?.length && !grouped.article?.length && !talkErrors.length" class="empty">
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

.seg--4 { grid-template-columns: repeat(4, 1fr); }
.seg--4 .seg__btn { font-size: var(--step--2); padding: 9px 2px; }

.pitem { display: grid; grid-template-columns: 1fr auto 1fr auto; align-items: center; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-control); background: var(--surface); box-shadow: var(--rim); }
.pitem__w { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.pitem__w b { font-family: var(--font-word); font-size: var(--step-0); font-weight: 600; }
.pitem__w span { font-size: var(--step--2); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pitem__x { color: var(--ink-3); }

.litem { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-control); background: var(--surface); box-shadow: var(--rim); }
.litem__body { min-width: 0; }
.litem__en { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.45; }
.litem__zh { font-size: var(--step--1); color: var(--ink-2); }
.litem__zh b { font-family: var(--font-word); color: var(--ink); }
.litem__show { font-size: var(--step--1); font-weight: 600; color: var(--pen); padding: 8px 0; }
.qitem__ok { font-family: var(--font-word); font-weight: 700; color: var(--jade); }

/* head-to-head */
.vs__pair { display: flex; align-items: baseline; justify-content: center; gap: var(--sp-3); font-family: var(--font-word); font-size: var(--step-1); font-weight: 700; }
.vs__pair i { font-family: var(--font-zh); font-style: normal; font-weight: 400; font-size: var(--step--1); color: var(--ink-3); }
.vs__q { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-5); min-height: 148px; justify-content: center; text-align: center; }
.vs__kind { font-size: var(--step--1); color: var(--ink-2); }
.vs__prompt { font-family: var(--font-word); font-size: var(--step-2); line-height: 1.45; display: flex; align-items: center; justify-content: center; gap: var(--sp-2); flex-wrap: wrap; }
.vs__prompt.zh { font-family: var(--font-zh); font-weight: 700; }
.vs__zh { font-size: var(--step--1); color: var(--ink-2); }
.vs__opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.vs__opt { min-height: 76px; justify-content: center; text-align: center; font-family: var(--font-word); font-size: var(--step-1); font-weight: 600; padding: var(--sp-3); }
.vs__opt.zh { font-family: var(--font-zh); font-size: var(--step-0); }
.vs__key { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: var(--r-inset); background: var(--surface-2); }
.vs__key p { display: flex; align-items: baseline; gap: 10px; font-size: var(--step--1); }
.vs__key b { font-family: var(--font-word); font-size: var(--step-0); min-width: 5.5em; }
.vsend { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-7) 0 var(--sp-4); text-align: center; }
.vsend__t { font-size: var(--step-3); font-weight: 700; letter-spacing: 0.03em; }
.vsend__n { font-size: var(--step-0); color: var(--ink-2); }
.vsend__n b { font-size: var(--step-2); color: var(--ink); margin: 0 2px; }
</style>
