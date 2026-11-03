<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { gradeFromAnswer } from '@/lib/wordsrs'
import { glossOf, shuffle, meaningOptions } from '@/lib/game'
import { saveNote, loadNote } from '@/lib/notes'
import { sfx } from '@/lib/sfx'
import SessionHeader from '@/components/SessionHeader.vue'
import DataGate from '@/components/DataGate.vue'
import AudioButton from '@/components/AudioButton.vue'
import PictureTile from '@/components/PictureTile.vue'
import WordAnatomy from '@/components/WordAnatomy.vue'
import AnswerSheet from '@/components/ui/AnswerSheet.vue'
import WordGame from '@/components/games/WordGame.vue'
import MatchPairs from '@/components/games/MatchPairs.vue'

/**
 * Word Lab — the new-word phase.
 *
 *   GUESS   before anything is explained, the learner guesses the meaning —
 *           from the word's parts when it has them (un + happy → ?), from
 *           its sentence when it does not. Not graded. Guessing first, even
 *           wrongly, makes the answer that follows stick better than reading
 *           it cold (the pretesting effect: Richland, Kornell & Kao 2009;
 *           Potts & Shanks 2014).
 *   MEET    the word's anatomy (parts with meanings, or syllables with the
 *           stress marked — always with a legend), meaning, a real sentence,
 *           its family, and the hooks that actually exist for it: a
 *           look-alike to keep apart, a mnemonic, the learner's own sentence.
 *           v2's free drawing is gone: for most words there was nothing to
 *           draw, and a blank canvas is not a memory aid.
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

// guess-first
const guessing = ref(true)
const guessPick = ref(null)

// the learner's own sentence
const note = ref('')
const noteOpen = ref(false)

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

const family = computed(() => {
  if (!current.value) return []
  return words.wordFamily(current.value.id).filter(f => f.id !== current.value.id).slice(0, 4)
})
const anatomy = computed(() => current.value ? words.anatomy(current.value.headword) : null)

/** What the guess is made from: the parts if the word has them, else its sentence. */
const guess = computed(() => {
  const w = current.value
  if (!w || !glossOf(w)) return null
  const opts = meaningOptions(w, pool.value, w.id * 3 + 1)
  if (opts.length < 3) return null
  if (anatomy.value?.mode === 'parts') return { from: 'parts', options: opts }
  if (w.examples?.[0]?.en) return { from: 'sentence', options: opts, sentence: w.examples[0].en }
  return null
})

async function loadHooks () {
  const w = current.value
  if (!w) return
  guessPick.value = null
  guessing.value = true
  noteOpen.value = false
  note.value = await loadNote(w.id)
  noteOpen.value = !!note.value
}
watch(() => current.value?.id, loadHooks)

function pickGuess (o, i) {
  if (guessPick.value !== null) return
  guessPick.value = i
  sfx(o.correct ? 'good' : 'soft')
}
const guessRight = computed(() => guessPick.value !== null && !!guess.value?.options[guessPick.value]?.correct)
const guessAnswer = computed(() => guess.value?.options.find(o => o.correct)?.zh || '')

async function nextWord () {
  const w = current.value
  if (w) await saveNote(w.id, note.value)
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
  sfx('win')
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
    <SessionHeader title="新單字" :current="headerCurrent" :total="headerTotal" />

    <DataGate :ids="ids">
      <main class="shell lab">
        <!-- ================= MEET ================= -->
        <template v-if="stage === 'meet' && current">
          <!-- guess first -->
          <section v-if="guessing && guess" class="guess">
            <p class="guess__ask zh">{{ guess.from === 'parts' ? '先別看答案——從零件猜猜看它的意思' : '先別看答案——從句子猜猜看它的意思' }}</p>
            <div class="guess__card card">
              <WordAnatomy v-if="guess.from === 'parts'" :word="current.headword" size="lg" :explore="false" />
              <template v-else>
                <p class="guess__sent" v-html="marked(guess.sentence, current)" />
                <AudioButton :text="guess.sentence" size="sm" />
              </template>
            </div>
            <div class="guess__opts">
              <button
                v-for="(o, i) in guess.options" :key="o.id"
                class="gopt zh"
                :class="{ 'gopt--right': guessPick !== null && o.correct, 'gopt--wrong': guessPick === i && !o.correct, 'gopt--mute': guessPick !== null && guessPick !== i && !o.correct }"
                :disabled="guessPick !== null"
                @click="pickGuess(o, i)"
              >{{ o.zh }}</button>
            </div>
            <button v-if="guessPick === null" class="btn btn--quiet btn--sm zh guess__skip" @click="guessing = false">我不想猜，直接看</button>
            <AnswerSheet
              v-if="guessPick !== null"
              :right="guessRight"
              :title="guessRight ? '猜對了' : '猜錯沒關係'"
              :chars="20"
              next-label="看完整字卡"
              @next="guessing = false"
            >
              <p class="zh">{{ guessRight ? '你從線索推出來了，這樣記得最牢。' : '先猜過再看答案，反而記得更牢。' }}</p>
              <p class="guess__ans"><b class="en">{{ current.headword }}</b>　<span class="gloss">{{ guessAnswer }}</span></p>
            </AnswerSheet>
          </section>

          <template v-else>
            <article class="meet card">
              <div class="meet__top">
                <PictureTile :word-id="current.id" :headword="current.headword" :size="64" />
                <div class="meet__sound">
                  <AudioButton :text="current.headword" size="lg" />
                  <span v-if="current.ipa" class="meet__ipa">{{ current.ipa }}</span>
                </div>
              </div>

              <WordAnatomy :word="current.headword" size="lg" />

              <ul class="meet__means">
                <li v-for="(m, i) in current.meanings" :key="i"><span class="pos">{{ m.pos }}</span><span class="zh">{{ m.zh }}</span></li>
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
            </article>

            <!-- the hooks that exist for this word -->
            <section v-if="family.length || current.confusables?.length || current.mnemonic" class="hooks">
              <div v-if="family.length" class="hk">
                <h3 class="hk__t zh">同一家族</h3>
                <div class="hk__fam">
                  <span v-for="f in family" :key="f.id" class="fam"><b>{{ f.headword }}</b><span v-if="f.affix" class="fam__a">{{ f.affix }}</span></span>
                </div>
              </div>
              <div v-if="current.confusables?.length" class="hk">
                <h3 class="hk__t zh">別跟它搞混</h3>
                <p v-for="c in current.confusables" :key="c.word" class="hk__p zh"><b class="en">{{ c.word }}</b>　{{ c.diff }}</p>
              </div>
              <div v-if="current.mnemonic" class="hk">
                <h3 class="hk__t zh">記法</h3>
                <p class="hk__p zh">{{ current.mnemonic }}</p>
              </div>
            </section>

            <section class="mine">
              <button v-if="!noteOpen" class="mine__open zh" @click="noteOpen = true">＋ 用 <b class="en">{{ current.headword }}</b> 寫一句關於你自己的話（選填）</button>
              <template v-else>
                <label class="mine__label zh" :for="'note' + current.id">我的句子：跟自己有關的句子最好記，中英混寫也可以</label>
                <textarea :id="'note' + current.id" v-model="note" class="input mine__note" rows="2" :placeholder="`I ${current.headword} ...`" autocapitalize="off" spellcheck="false" />
              </template>
            </section>

            <button class="btn btn--primary btn--block zh" @click="nextWord">
              {{ meetIndex + 1 < list.length ? '下一個字' : '開始回想' }}
            </button>
            <button class="btn btn--quiet btn--sm lab__skip zh" @click="skipPhase">跳過這個階段</button>
          </template>
        </template>

        <!-- ================= MATCH ================= -->
        <template v-else-if="stage === 'match'">
          <div class="phase">
            <span class="phase__t">連連看</span>
            <span class="dim zh">剛剛那幾個字，配得起來嗎？</span>
          </div>
          <MatchPairs :words="matchWords" :seed="meetIndex + 3" :count="matchWords.length" @done="onMatchDone" />
        </template>

        <!-- ================= RECALL ================= -->
        <template v-else-if="stage === 'recall' && recallWord">
          <div class="phase">
            <span class="phase__t">{{ recallItem.graded ? '回想挑戰' : '再試一次' }}</span>
            <span class="dim zh">{{ recallItem.graded ? '答對答錯決定它什麼時候回來' : '這題不計分，記住它就好' }}</span>
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
            <span v-for="w in list" :key="w.id" class="lt sticker" :class="firstTry.get(w.id) === false ? 'lt--bad' : 'lt--good'">{{ w.headword }}</span>
          </div>
          <h2 class="done__title zh">今天的新字都見過了</h2>
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
.phase { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); font-size: var(--step--2); }
.phase__t { font-size: var(--step-1); font-weight: 700; color: var(--ink); }
.lab__skip { align-self: center; }

/* guess */
.guess { display: flex; flex-direction: column; gap: var(--sp-3); animation: rise 0.2s ease-out; }
.guess__ask { font-weight: 700; font-size: var(--step-0); }
.guess__card { padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
.guess__sent { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.5; text-align: center; }
.guess__sent :deep(mark), .ex__en :deep(mark) { background: var(--sun-wash); color: inherit; padding: 0 4px; border-radius: 6px; font-weight: 700; box-shadow: inset 0 -2px 0 var(--sun); }
.guess__opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.gopt { min-height: 64px; padding: 8px; font-weight: 600; font-size: var(--step-0); line-height: 1.3; }
.gopt--right { animation: pop-in 0.25s; }
.gopt--wrong { animation: shake 0.3s; }
.guess__skip { align-self: center; }
.guess__ans { font-size: var(--step-1); }

/* meet */
.meet { padding: var(--sp-4) var(--sp-4) var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-4); }
.meet__top { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); min-height: 56px; }
.meet__sound { display: flex; align-items: center; gap: var(--sp-3); }
.meet__ipa { color: var(--ink-2); font-size: var(--step-0); font-family: var(--font-word); }
.meet__means { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.meet__means li { display: flex; gap: 8px; align-items: baseline; font-size: var(--step-1); font-weight: 700; }
.pos { font-size: var(--step--1); color: var(--ink-3); font-weight: 500; font-family: var(--font-word); }
.meet__ex { display: flex; flex-direction: column; gap: var(--sp-3); padding-top: var(--sp-4); border-top: 0.5px solid var(--rule); }
.ex__row { display: flex; align-items: flex-start; gap: var(--sp-2); justify-content: space-between; }
.ex__en { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.5; }
.ex__zh { font-size: var(--step--1); color: var(--ink-2); margin-top: 2px; }

/* hooks: a plain list, one line of heading each — not cards in cards */
.hooks { display: flex; flex-direction: column; gap: var(--sp-3); padding: 0 var(--sp-1); }
.hk { display: flex; flex-direction: column; gap: 6px; }
.hk__t { font-size: var(--step--1); font-weight: 700; color: var(--ink-3); }
.hk__p { font-size: var(--step-0); line-height: 1.6; }
.hk__fam { display: flex; flex-wrap: wrap; gap: 8px; }
.fam { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 12px; font-family: var(--font-word); }
.fam__a { font-size: var(--step--2); color: var(--t-suffix); font-weight: 600; }
.en { font-family: var(--font-word); }

.mine { display: flex; flex-direction: column; gap: 6px; }
.mine__open { text-align: left; padding: 12px 14px; border-radius: var(--radius); border: 1.5px dashed var(--rule-strong); color: var(--ink-2); font-size: var(--step--1); }
.mine__label { font-size: var(--step--1); color: var(--ink-2); }
.mine__note { font-family: var(--font-word); font-size: var(--step-0); resize: none; }

.done { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); text-align: center; padding-top: var(--sp-5); }
.done__stickers { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 8px; }
.sticker { font-size: var(--step-1); animation: pop-in 0.35s both; }
.done__title { font-size: var(--step-2); font-weight: 800; }
.done__desc { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; max-width: 32ch; }
</style>
