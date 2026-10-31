<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { gradeFromAnswer } from '@/lib/wordsrs'
import { glossOf, shuffle } from '@/lib/game'
import { pictureOf } from '@/data/pictures'
import { saveDrawing, loadDrawing, saveNote, loadNote } from '@/lib/drawings'
import SessionHeader from '@/components/SessionHeader.vue'
import DataGate from '@/components/DataGate.vue'
import AudioButton from '@/components/AudioButton.vue'
import PictureTile from '@/components/PictureTile.vue'
import WordChunks from '@/components/WordChunks.vue'
import SketchPad from '@/components/SketchPad.vue'
import WordGame from '@/components/games/WordGame.vue'
import MatchPairs from '@/components/games/MatchPairs.vue'

/**
 * Word Lab — the new-word phase, rebuilt around Marzano's six steps and the
 * "systematic study, random practice" schedule (Pan et al. 2019):
 *
 *   MEET    picture · spoken chunks · meaning · a real sentence · word family,
 *           then the learner makes their OWN hook: a drawing (drawing effect)
 *           or a sentence about their own life (self-reference). Studied in
 *           order, one word at a time.
 *   MATCH   every few words, a 連連看 round on the words just met — play,
 *           not measurement.
 *   RECALL  after all words, each one is retrieved once, shuffled, in a
 *           harder direction (picture + 中文 → English). THIS answer is the
 *           word's first scheduled review. Missed words are re-taught and
 *           retried once so the sitting ends on a success — but the retry is
 *           practice and never reaches the scheduler.
 *
 * The old phase graded the card the learner was reading ("看完後誠實評分"):
 * self-assessment right after study is the most overconfident judgement a
 * learner makes, and it set the first interval.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const router = useRouter()

const MATCH_EVERY = 4

const ids = ref([])
const stage = ref('meet')          // meet | match | recall | done
const meetIndex = ref(0)
const matchFrom = ref(0)

// hooks
const hookTab = ref('draw')        // draw | sentence | tip
const drawing = ref('')
const note = ref('')

// recall
const recallQueue = ref([])        // { id, mode, graded }
const recallIndex = ref(0)
const firstTry = ref(new Map())    // id -> correct

const list = computed(() => words.getMany(ids.value))
const current = computed(() => list.value[meetIndex.value] || null)
const recallItem = computed(() => recallQueue.value[recallIndex.value] || null)
const recallWord = computed(() => recallItem.value ? words.get(recallItem.value.id) : null)

const pool = computed(() => {
  const seen = [...progress.cards.keys()].slice(-400)
  let out = words.getMany([...new Set([...ids.value, ...seen])]).filter(w => w.enriched && w.meanings?.length)
  if (out.length < 12) {
    const more = [...words.enriched.keys()].slice(0, 200)
    out = [...out, ...words.getMany(more).filter(w => w.meanings?.length && !out.some(o => o.id === w.id))]
  }
  return out
})

const headerCurrent = computed(() => {
  if (stage.value === 'meet') return meetIndex.value + 1
  if (stage.value === 'recall') return recallIndex.value + 1
  return list.value.length
})
const headerTotal = computed(() => stage.value === 'recall' ? recallQueue.value.length : list.value.length)

/** Highlight the target word (any inflected form) in its example. */
function marked (sentence, w) {
  if (!sentence) return ''
  const forms = [w.headword, ...(w.family || [])].filter(f => f && f.length > 1)
    .sort((a, b) => b.length - a.length).map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const esc = sentence.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return forms.length ? esc.replace(new RegExp(`\\b(${forms.join('|')})\\b`, 'gi'), '<mark>$1</mark>') : esc
}

const derivation = computed(() => current.value ? words.derivation(current.value.id) : null)
const family = computed(() => current.value ? words.derivedFrom(current.value.id).slice(0, 4) : [])

async function loadHooks () {
  const w = current.value
  if (!w) return
  drawing.value = await loadDrawing(w.id)
  note.value = await loadNote(w.id)
  hookTab.value = pictureOf(w.headword) ? (w.mnemonic ? 'tip' : 'sentence') : 'draw'
}
watch(() => current.value?.id, loadHooks)

function onDraw (dataUrl) { drawing.value = dataUrl }

async function nextWord () {
  const w = current.value
  if (w) {
    if (drawing.value) await saveDrawing(w.id, drawing.value)
    await saveNote(w.id, note.value)
  }
  const met = meetIndex.value + 1
  const sinceMatch = met - matchFrom.value
  if ((sinceMatch >= MATCH_EVERY || met >= list.value.length) && sinceMatch >= 3) {
    stage.value = 'match'
    return
  }
  advanceMeet()
}

function advanceMeet () {
  if (meetIndex.value + 1 < list.value.length) {
    meetIndex.value++
    stage.value = 'meet'
  } else {
    startRecall()
  }
}

function onMatchDone () {
  matchFrom.value = meetIndex.value + 1
  advanceMeet()
}

const matchWords = computed(() => list.value.slice(matchFrom.value, meetIndex.value + 1))

function startRecall () {
  recallQueue.value = shuffle(list.value.map(w => ({ id: w.id, mode: 'recall', graded: true })), Date.now())
  recallIndex.value = 0
  stage.value = 'recall'
}

function onAnswer (a) {
  const item = recallItem.value
  if (!item?.graded) return
  firstTry.value = new Map(firstTry.value).set(item.id, a.correct)
  progress.gradeCard(item.id, gradeFromAnswer(a), { mode: 'learn', elapsedMs: a.elapsedMs, level: 0 })
  if (!a.correct) {
    // Re-taught by the reveal panel, then tried once more at the end — easier
    // direction, ungraded — so the word is not left on a failure.
    recallQueue.value = [...recallQueue.value, { id: item.id, mode: 'meaning', graded: false }]
  }
}

function onRecallNext () {
  if (recallIndex.value + 1 < recallQueue.value.length) recallIndex.value++
  else finish()
}

const correctFirst = computed(() => [...firstTry.value.values()].filter(Boolean).length)

function finish () {
  stage.value = 'done'
  session.markDone('learn')
}

function goNext () { router.push(session.nextRoute('learn')) }
function skipPhase () { session.markDone('learn'); router.push('/') }

onMounted(() => {
  session.startClock()
  ids.value = session.lockNewIds()
  if (!ids.value.length) {
    session.markDone('learn')
    router.replace(session.nextRoute('learn'))
    return
  }
  loadHooks()
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader title="Word Lab · 新單字" :current="headerCurrent" :total="headerTotal" />

    <DataGate :ids="ids">
      <main class="shell lab">
        <!-- ================= MEET ================= -->
        <template v-if="stage === 'meet' && current">
          <div class="phase">
            <span class="chip chip--jade zh">認識新字</span>
            <span class="dim zh">先看、再聽、最後做你自己的記號</span>
          </div>

          <article class="meet card">
            <div class="meet__hero">
              <PictureTile :key="current.id" :word-id="current.id" :headword="current.headword" :size="132" :live="drawing || null" placeholder />
            </div>
            <div class="meet__word">
              <WordChunks :word="current.headword" />
              <div class="meet__sound">
                <AudioButton :text="current.headword" size="lg" />
                <span v-if="current.ipa" class="meet__ipa num">{{ current.ipa }}</span>
              </div>
            </div>

            <ul class="meet__means">
              <li v-for="(m, i) in current.meanings" :key="i"><span class="pos num">{{ m.pos }}</span><span class="zh">{{ m.zh }}</span></li>
            </ul>

            <div v-if="current.examples?.length" class="meet__ex">
              <div v-for="(ex, i) in current.examples.slice(0, 2)" :key="i" class="ex">
                <div class="ex__row">
                  <p class="ex__en" v-html="marked(ex.en, current)" />
                  <AudioButton :text="ex.en" size="sm" />
                </div>
                <p class="ex__zh zh">{{ ex.zh }}</p>
              </div>
            </div>

            <div v-if="derivation || family.length" class="meet__fam">
              <span class="meet__famlabel zh">字族</span>
              <span v-if="derivation" class="famchip"><b>{{ derivation.base }}</b> + {{ derivation.affix }} → {{ current.headword }}</span>
              <span v-for="f in family" :key="f.id" class="famchip">{{ current.headword }} → <b>{{ f.headword }}</b></span>
            </div>
          </article>

          <!-- the learner's own hook -->
          <section class="hook card">
            <div class="hook__head">
              <span class="hook__title zh">記憶鉤</span>
              <div class="hook__tabs">
                <button class="htab zh" :class="{ 'htab--on': hookTab === 'draw' }" @click="hookTab = 'draw'">✏️ 畫下來</button>
                <button class="htab zh" :class="{ 'htab--on': hookTab === 'sentence' }" @click="hookTab = 'sentence'">💬 我的句子</button>
                <button v-if="current.mnemonic" class="htab zh" :class="{ 'htab--on': hookTab === 'tip' }" @click="hookTab = 'tip'">💡 記法</button>
              </div>
            </div>

            <div v-if="hookTab === 'draw'" class="hook__body">
              <p class="hook__help zh">用 5 秒畫出「{{ glossOf(current) }}」— 畫得醜沒關係，研究顯示畫過的字比抄寫的字好記一倍。</p>
              <SketchPad :key="'pad' + current.id" :size="220" :initial="drawing" @change="onDraw" />
            </div>
            <div v-else-if="hookTab === 'sentence'" class="hook__body">
              <p class="hook__help zh">用 <b>{{ current.headword }}</b> 說一句跟「你自己」有關的話，中英混著寫也可以。</p>
              <textarea v-model="note" class="input hook__note" rows="2" :placeholder="`I ${current.headword} ...`" autocapitalize="off" spellcheck="false" />
            </div>
            <div v-else class="hook__body">
              <p class="hook__tip zh">{{ current.mnemonic }}</p>
              <p class="hook__help zh">諧音記法很快，但單靠它一週後會忘得比較快——再配一句自己的句子最穩。</p>
            </div>
          </section>

          <button class="btn btn--primary btn--block zh" @click="nextWord">
            {{ meetIndex + 1 < list.length ? '下一個字' : '開始回想' }}
          </button>
          <button class="btn btn--quiet btn--sm lab__skip zh" @click="skipPhase">跳過這個階段</button>
        </template>

        <!-- ================= MATCH ================= -->
        <template v-else-if="stage === 'match'">
          <div class="phase">
            <span class="chip chip--amber zh">連連看</span>
            <span class="dim zh">剛剛那幾個字，配得起來嗎？</span>
          </div>
          <MatchPairs :words="matchWords" :seed="meetIndex + 3" :count="matchWords.length" @done="onMatchDone" />
        </template>

        <!-- ================= RECALL ================= -->
        <template v-else-if="stage === 'recall' && recallWord">
          <div class="phase">
            <span class="chip chip--violet zh">{{ recallItem.graded ? '回想挑戰' : '再試一次' }}</span>
            <span class="dim zh">{{ recallItem.graded ? '這一題的結果決定它什麼時候回來' : '這題不計分，記住它就好' }}</span>
          </div>
          <WordGame
            :key="recallIndex + ':' + recallItem.id"
            :word="recallWord"
            :mode="recallItem.mode"
            :pool="pool"
            :seed="recallItem.id * 13 + recallIndex"
            @answer="onAnswer"
            @next="onRecallNext"
          />
        </template>

        <!-- ================= DONE ================= -->
        <section v-else-if="stage === 'done'" class="done">
          <div class="done__stickers">
            <span v-for="w in list" :key="w.id" class="sticker" :class="{ 'sticker--miss': firstTry.get(w.id) === false }">
              <PictureTile :word-id="w.id" :headword="w.headword" :size="44" placeholder />
              <span class="sticker__w">{{ w.headword }}</span>
            </span>
          </div>
          <h2 class="done__title zh">新字收進圖鑑了</h2>
          <p class="done__desc zh">
            第一次回想答對 <b class="num">{{ correctFirst }}</b> / <span class="num">{{ list.length }}</span>。
            答錯的字明天會先回來，答對的過幾天再考你——每次都會換一種更難的考法。
          </p>
          <button class="btn btn--primary btn--block zh" @click="goNext">下一關</button>
        </section>
      </main>
    </DataGate>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.lab { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6)); }
.phase { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); font-size: var(--step--2); }
.lab__skip { align-self: center; }

.meet { padding: var(--sp-5) var(--sp-4) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-4); border-top: 3px solid var(--jade); }
.meet__hero { display: flex; justify-content: center; }
.meet__word { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; }
.meet__sound { display: flex; align-items: center; gap: var(--sp-3); }
.meet__ipa { color: var(--ink-2); font-size: var(--step-0); }
.meet__means { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.meet__means li { display: flex; gap: 8px; align-items: baseline; font-size: var(--step-1); font-weight: 600; }
.pos { font-size: var(--step--1); color: var(--ink-3); font-weight: 400; }
.meet__ex { display: flex; flex-direction: column; gap: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--rule); }
.ex__row { display: flex; align-items: flex-start; gap: var(--sp-2); justify-content: space-between; }
.ex__en { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.45; }
.ex__en :deep(mark) { background: var(--jade-wash); color: var(--jade-ink); padding: 0 3px; border-radius: 4px; font-weight: 600; }
.ex__zh { font-size: var(--step--1); color: var(--ink-2); margin-top: 2px; }
.meet__fam { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.meet__famlabel { font-size: var(--step--2); color: var(--ink-3); margin-right: 2px; }
.famchip { font-size: var(--step--1); padding: 3px 9px; border-radius: 999px; background: var(--violet-wash); color: var(--violet); }

.hook { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.hook__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); flex-wrap: wrap; }
.hook__title { font-weight: 700; }
.hook__tabs { display: flex; gap: 4px; }
.htab { font-size: var(--step--1); padding: 5px 10px; border-radius: 999px; border: 1px solid var(--rule); color: var(--ink-2); }
.htab--on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.hook__body { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.hook__help { font-size: var(--step--1); color: var(--ink-2); line-height: 1.55; align-self: stretch; }
.hook__note { width: 100%; font-family: var(--font-word); font-size: var(--step-0); resize: none; }
.hook__tip { font-size: var(--step-0); line-height: 1.6; padding: var(--sp-3); background: var(--amber-wash); border-radius: var(--radius-sm); align-self: stretch; }

.done { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); text-align: center; padding-top: var(--sp-5); }
.done__stickers { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-2); }
.sticker { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px; background: var(--surface); border: 1px solid var(--jade-edge); border-radius: var(--radius); min-width: 72px; animation: pop 0.4s both; }
.sticker--miss { border-color: var(--amber-edge); }
.sticker__w { font-family: var(--font-word); font-size: var(--step--1); }
.done__title { font-size: var(--step-2); font-weight: 700; }
.done__desc { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; max-width: 32ch; }
@keyframes pop { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
