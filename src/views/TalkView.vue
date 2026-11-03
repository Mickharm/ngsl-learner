<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { talkTurn, talkReport, buildTalkTopic } from '@/lib/gemini'
import { speak, stopSpeaking } from '@/lib/tts'
import { sfx } from '@/lib/sfx'
import { wordTokens } from '@/lib/lexicon'
import { glossOf } from '@/lib/game'
import { TALK_TOPICS, TALK_TURNS, TALK_MAX_CHARS, TALK_MIN_TURNS, planTalk, upgradeHistory } from '@/data/talk-topics'
import SessionHeader from '@/components/SessionHeader.vue'
import AudioButton from '@/components/AudioButton.vue'
import Stamp from '@/components/ui/Stamp.vue'

/**
 * 主題對話 — production practice as a short, bounded conversation.
 *
 * v4 gave one word, a task and a finished example sentence; learners typed the
 * example back. Now there is a situation, a partner and three goals, and the
 * learner has to say something to move on. Bounded on purpose: five replies
 * at most, 140 characters each, and the partner closes the talk when the goals
 * are met or the replies run out — a beginner's attention is the budget.
 *
 * Help is pulled, not pushed: a partial sentence starter on request, today's
 * words as chips, and Chinese allowed for a word they do not know (the partner
 * carries on, and the correction shows the English).
 *
 * Feedback comes at two speeds. During the talk: an implicit recast in the
 * partner's reply and a one-line correction under the learner's bubble. After:
 * a four-criterion rubric (task / vocabulary / accuracy / interaction, 0-4
 * each, after CEFR spoken-performance criteria), a CEFR estimate of this talk,
 * the three fixes that matter most — saved to the mistake notebook — and one
 * phrase to learn next.
 *
 * Without a Gemini key the partner reads an authored script and the learner
 * compares their replies with sample answers afterwards.
 *
 * v5.1: 30 scenarios; one met about a week ago comes back with a twist, and
 * the report compares the two scores. 自己出題 builds a scenario from a
 * Chinese description (needs the key).
 */

const HISTORY_KEY = 'ngsl.talk.history'
const LEGACY_KEY = 'ngsl.talk.recent'
const RUBRIC = [
  { key: 'task', label: '任務達成', desc: ['一個目標都沒做到', '做到一個目標', '大部分做到', '目標全部做到', '全部做到，還有細節'] },
  { key: 'vocabulary', label: '用字', desc: ['幾乎都是中文', '只有零星單字', '基本字夠用', '用字貼切', '用字多樣又精準'] },
  { key: 'accuracy', label: '正確度', desc: ['看不太懂', '錯很多，影響理解', '有錯但看得懂', '只有少數小錯', '幾乎沒有錯'] },
  { key: 'interaction', label: '互動', desc: ['沒有回應到對方', '只有單字或片段', '能用短句回應', '完整句回應，也會發問', '自然地一來一往'] }
]
const AREA_ZH = { travel: '旅遊', daily: '日常', work: '職場', tech: '職場・科技', custom: '自己出題' }

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const auth = useAuth()
const toast = useToast()
const router = useRouter()

const online = computed(() => settings.hasGeminiKey)
const stage = ref('brief')          // brief | chat | report
const shift = ref(0)
const messages = ref([])            // { who: 'ai'|'me', en, zh?, showZh?, fix?, note?, understood? }
const goalsDone = ref([])
const draft = ref('')
const sending = ref(false)
const ended = ref(false)
const hint = ref('')
const hintShown = ref(false)
const hintsUsed = ref(0)
const report = ref(null)
const reporting = ref(false)
const reportError = ref('')
const selfCheck = ref([])
const showLog = ref(false)
const customTopic = ref(null)
const customIdea = ref('')
const customOpen = ref(false)
const building = ref(false)
const plan = ref({ topic: TALK_TOPICS[0], twist: -1, repeatOf: null })
const box = ref(null)
let seq = 0

/* ---- topic ---- */
const storeKey = k => `${k}.${auth.user?.email || ''}`
function readHistory () {
  try {
    const h = JSON.parse(localStorage.getItem(storeKey(HISTORY_KEY)) || 'null')
    if (Array.isArray(h)) return upgradeHistory(h)
    return upgradeHistory(JSON.parse(localStorage.getItem(storeKey(LEGACY_KEY)) || '[]'))
  } catch { return [] }
}
function noteHistory (entry) {
  try {
    const list = [...readHistory(), entry].slice(-60)
    localStorage.setItem(storeKey(HISTORY_KEY), JSON.stringify(list))
  } catch { /* private mode: rotation falls back to the day hash */ }
}
function replan () {
  plan.value = planTalk({
    day: progress.today.day,
    user: auth.user?.email || '',
    areas: settings.state.articleTopics || [],
    history: readHistory(),
    shift: shift.value
  })
}
const topic = computed(() => customTopic.value || plan.value.topic)
/** The twist only exists when the AI plays the partner; the script has none. */
const twist = computed(() => (!customTopic.value && online.value && plan.value.twist >= 0) ? plan.value.topic.twists[plan.value.twist] : null)
const repeatOf = computed(() => (!customTopic.value && plan.value.repeatOf) || null)

async function makeCustom () {
  const idea = customIdea.value.trim()
  if (!idea || building.value) return
  building.value = true
  try {
    customTopic.value = await buildTalkTopic({ idea, key: settings.state.geminiKey, model: settings.state.geminiModel })
    customOpen.value = false
    sfx('good')
  } catch (e) {
    toast.error(e?.message || '情境沒有產生成功')
  } finally {
    building.value = false
  }
}
function dropCustom () { customTopic.value = null; customIdea.value = '' }

/**
 * Up to three of today's words worth steering a conversation towards: content
 * words (a noun, verb, adjective or adverb), already enriched. "for", "which"
 * and "up" are in every beginner's day and in every reply anyway.
 */
const FUNCTION_WORDS = new Set('a an the of to in on at by for with from into about over under up down out off and or but if so as than then that this these those it its he she they we you i me him her us them my your his our their be is are was were been do does did have has had not no yes can will would could should may might must shall what which who whom whose when where why how there here just very too also all any some each every much many more most other such only own same'.split(' '))
const targets = computed(() => words.getMany(session.dayWordIds)
  .filter(w => w.enriched && w.meanings?.length && /^[a-z][a-z-]{2,13}$/i.test(w.headword))
  .filter(w => !FUNCTION_WORDS.has(w.headword.toLowerCase()) && !/^(prep|conj|det|pron|art|aux)/i.test(w.meanings[0].pos || ''))
  .slice(0, 3))

/* ---- conversation state ---- */
const mine = computed(() => messages.value.filter(m => m.who === 'me'))
const turnsUsed = computed(() => mine.value.length)
const turnsLeft = computed(() => TALK_TURNS - turnsUsed.value)
const canEnd = computed(() => !ended.value && turnsUsed.value >= TALK_MIN_TURNS)
const charsLeft = computed(() => TALK_MAX_CHARS - draft.value.length)
const usedIds = computed(() => {
  const ids = new Set()
  for (const m of mine.value) for (const t of wordTokens(m.en)) { const id = words.lookup(t); if (id) ids.add(id) }
  return ids
})
const englishWords = computed(() => mine.value.reduce((n, m) => n + wordTokens(m.en).length, 0))

function start () {
  stopSpeaking()
  messages.value = []
  goalsDone.value = topic.value.goals.map(() => false)
  draft.value = ''
  ended.value = false
  report.value = null
  reportError.value = ''
  hintsUsed.value = 0
  showLog.value = false
  selfCheck.value = topic.value.goals.map(() => false)
  stage.value = 'chat'
  addAi(topic.value.opener.en, topic.value.opener.zh)
  setHint(topic.value.frames[0])
  nextTick(() => box.value?.focus({ preventScroll: true }))
}
function reroll () { sfx('tap'); customTopic.value = null; shift.value++; replan() }

function addAi (en, zh) {
  messages.value = [...messages.value, { id: ++seq, who: 'ai', en, zh, showZh: false }]
  if (settings.state.autoPlayAudio) say(en)
  scrollDown()
}
function setHint (h) { hint.value = h || ''; hintShown.value = false }
function say (t) { speak(t, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn }) }
function scrollDown () {
  nextTick(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
}

/* ---- composer ---- */
function insert (text) {
  const el = box.value
  const t = text.replace(/\s*…$/, '').trim() + ' '
  if (!el) { draft.value = (draft.value + t).slice(0, TALK_MAX_CHARS); return }
  const a = el.selectionStart ?? draft.value.length
  const b = el.selectionEnd ?? a
  const before = draft.value.slice(0, a)
  const glue = before && !/\s$/.test(before) ? ' ' : ''
  draft.value = (before + glue + t + draft.value.slice(b)).slice(0, TALK_MAX_CHARS)
  nextTick(() => { el.focus(); const p = Math.min(draft.value.length, (before + glue + t).length); el.setSelectionRange(p, p); grow() })
}
function revealHint () { hintShown.value = true; hintsUsed.value++; sfx('tap') }
function grow () {
  const el = box.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
watch(draft, () => nextTick(grow))
function onKey (e) {
  // Enter sends; Shift+Enter breaks the line. Never while an IME is composing
  // (Zhuyin / Pinyin use Enter to commit the candidate).
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault()
    send()
  }
}

async function send () {
  const text = draft.value.trim().slice(0, TALK_MAX_CHARS)
  if (!text || sending.value || ended.value) return
  sfx('tap')
  const history = messages.value.map(m => ({ who: m.who, en: m.en }))
  const me = { id: ++seq, who: 'me', en: text }
  messages.value = [...messages.value, me]
  draft.value = ''
  scrollDown()

  if (!online.value) {
    // authored script: the partner's next line, in order; the last one closes
    const line = topic.value.script[turnsUsed.value - 1]
    sending.value = true
    await new Promise(r => setTimeout(r, 650))
    sending.value = false
    if (line) addAi(line.en, line.zh)
    if (!line || turnsUsed.value >= topic.value.script.length || turnsUsed.value >= TALK_TURNS) ended.value = true
    else setHint(topic.value.frames[turnsUsed.value % topic.value.frames.length])
    return
  }

  sending.value = true
  try {
    const r = await talkTurn({
      topic: topic.value,
      twist: twist.value?.en || '',
      history,
      learner: text,
      turnsLeft: turnsLeft.value,
      targets: targets.value.map(w => w.headword),
      knownWords: progress.cards.size,
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    // annotate the learner's bubble in place
    messages.value = messages.value.map(m => m.id === me.id ? { ...m, fix: r.fix, note: r.note_zh, understood: r.understood } : m)
    goalsDone.value = goalsDone.value.map((g, i) => g || !!r.goals_done[i])
    if (r.reply_en) addAi(r.reply_en, r.reply_zh)
    if (r.end || turnsLeft.value <= 0) ended.value = true
    else setHint(r.hint_en)
  } catch (e) {
    // take the message back so it can be sent again unchanged
    messages.value = messages.value.filter(m => m.id !== me.id)
    draft.value = text
    toast.error(e?.message || '沒有連上 AI，再送一次')
  } finally {
    sending.value = false
    scrollDown()
  }
}

function endNow () {
  if (!canEnd.value) return
  ended.value = true
  scrollDown()
}

/* ---- report ---- */
const total = computed(() => report.value?.scores ? Object.values(report.value.scores).reduce((a, b) => a + b, 0) : 0)
const headline = computed(() => {
  const t = total.value
  return t >= 13 ? '這段對話很自然' : t >= 9 ? '溝通成功了' : t >= 5 ? '說出來了，下次更完整' : '開口了，就是第一步'
})
const goalsMet = computed(() => goalsDone.value.filter(Boolean).length)
const replyFixes = computed(() => mine.value.filter(m => m.fix))

async function finishTalk () {
  stopSpeaking()
  stage.value = 'report'
  window.scrollTo({ top: 0 })
  if (!online.value) {
    report.value = { offline: true }
    noteTalk(null)
    return
  }
  await makeReport()
}

async function makeReport () {
  reporting.value = true
  reportError.value = ''
  try {
    const r = await talkReport({
      topic: topic.value,
      twist: twist.value?.en || '',
      history: messages.value.map(m => ({ who: m.who, en: m.en })),
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    report.value = r
    sfx(total.value >= 9 ? 'win' : 'good')
    for (const f of r.fixes) {
      progress.logError('write', topic.value.id, { topic: topic.value.title, said: f.said, better: f.better, explain: f.why_zh })
    }
    const ok = mine.value.filter(m => m.understood !== false && !m.fix).length
    progress.bumpDay({ grammar_correct: ok, grammar_total: mine.value.length })
    noteTalk(total.value)
  } catch (e) {
    reportError.value = e?.message || '評分沒有完成'
  } finally {
    reporting.value = false
  }
}

/** One history row per finished talk; custom scenarios are not rotated. */
let noted = false
function noteTalk (score) {
  if (noted || customTopic.value) return
  noted = true
  const p = plan.value
  noteHistory({
    id: topic.value.id, day: progress.today.day, twist: p.twist, total: score,
    repeat: !!p.repeatOf, of: p.repeatOf?.day || undefined
  })
}

function again () { noted = false; start(); window.scrollTo({ top: 0 }) }
function done () {
  session.markDone('write')
  router.push(session.nextRoute('write'))
}
function skip () {
  session.markDone('write')
  router.push(session.nextRoute('write'))
}

onMounted(() => { session.startClock(); replan() })
onUnmounted(() => { session.stopClock(); stopSpeaking() })
</script>

<template>
  <div class="view tk-view">
    <SessionHeader title="主題對話" :current="stage === 'brief' ? 0 : turnsUsed" :total="TALK_TURNS" />

    <main class="shell tk">
      <!-- ============ brief ============ -->
      <template v-if="stage === 'brief'">
        <section class="brief card">
          <p class="brief__area zh">
            {{ AREA_ZH[topic.area] || '情境' }}
            <span v-if="repeatOf" class="brief__again">一週前聊過<template v-if="repeatOf.total != null">（{{ repeatOf.total }}/16）</template>，{{ twist ? '這次多一個狀況' : '再練一次' }}</span>
          </p>
          <h1 class="brief__title">{{ topic.title }}</h1>
          <p class="brief__scene zh">{{ topic.scene_zh }}</p>

          <div class="who">
            <span class="ava" aria-hidden="true">{{ topic.partner.name[0] }}</span>
            <div class="who__t">
              <b>{{ topic.partner.name }}</b>
              <span class="zh">{{ topic.partner.role_zh }}</span>
            </div>
          </div>

          <div v-if="twist" class="twist">
            <p class="twist__l zh">這次的狀況</p>
            <p class="twist__t zh">{{ twist.zh }}</p>
          </div>

          <h2 class="brief__h zh">這次要做到</h2>
          <ul class="goals">
            <li v-for="g in topic.goals" :key="g.en" class="goal zh"><span class="goal__dot" aria-hidden="true" />{{ g.zh }}</li>
          </ul>

          <template v-if="targets.length">
            <h2 class="brief__h zh">試著用上今天的字</h2>
            <div class="tw">
              <span v-for="w in targets" :key="w.id" class="tw__w"><b>{{ w.headword }}</b><small class="zh">{{ glossOf(w) }}</small></span>
            </div>
          </template>
        </section>

        <ul class="rules zh">
          <li>最多 {{ TALK_TURNS }} 回合，每次最多 {{ TALK_MAX_CHARS }} 個字元。</li>
          <li>不會的字可以先打中文，對方聽得懂，旁邊會告訴你英文怎麼說。</li>
          <li>卡住時按「給我開頭」，只會給句子的開頭。</li>
          <li v-if="!online">目前沒有設定 Gemini Key：對方照固定劇本說，結束後自己對照參考說法。</li>
        </ul>

        <button class="btn btn--primary btn--block zh" @click="start">開始對話</button>
        <div class="brief__alt">
          <button class="btn btn--quiet btn--sm zh" @click="reroll">換一個情境</button>
          <button v-if="online && !customTopic" class="btn btn--quiet btn--sm zh" :aria-expanded="customOpen" @click="customOpen = !customOpen">自己出題</button>
          <button v-if="customTopic" class="btn btn--quiet btn--sm zh" @click="dropCustom">回到今天的情境</button>
          <button class="btn btn--quiet btn--sm zh" @click="skip">今天跳過</button>
        </div>

        <section v-if="customOpen && !customTopic" class="mine card">
          <label class="mine__l zh" for="idea">用中文寫一個你想練的情境</label>
          <textarea
            id="idea" v-model="customIdea" class="input mine__box zh" rows="2" maxlength="60"
            placeholder="例如：在日本藥妝店問防曬乳在哪裡、有沒有免稅"
          />
          <button class="btn btn--ink btn--block zh" :disabled="!customIdea.trim() || building" @click="makeCustom">
            {{ building ? '正在設計情境…' : '產生情境' }}
          </button>
        </section>
      </template>

      <!-- ============ chat ============ -->
      <template v-else-if="stage === 'chat'">
        <section class="strip" aria-label="目標">
          <span v-for="(g, i) in topic.goals" :key="g.en" class="strip__g zh" :class="{ 'strip__g--on': goalsDone[i] }">
            <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.2" /><path v-if="goalsDone[i]" d="M6 10.4l2.7 2.7L14.2 7.6" /></svg>
            {{ g.zh }}
          </span>
        </section>

        <ol class="log">
          <li v-for="m in messages" :key="m.id" class="msg" :class="`msg--${m.who}`">
            <template v-if="m.who === 'ai'">
              <span class="ava ava--sm" aria-hidden="true">{{ topic.partner.name[0] }}</span>
              <div class="msg__col">
                <div class="bub bub--ai">
                  <p class="bub__en">{{ m.en }}</p>
                  <p v-if="m.showZh" class="bub__zh zh">{{ m.zh }}</p>
                </div>
                <div class="msg__tools">
                  <AudioButton :text="m.en" size="sm" />
                  <button class="msg__zhbtn zh" @click="m.showZh = !m.showZh">{{ m.showZh ? '收起中文' : '中文' }}</button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="msg__col msg__col--me">
                <div class="bub bub--me"><p class="bub__en">{{ m.en }}</p></div>
                <div v-if="m.fix" class="fix">
                  <p class="fix__lbl zh">這樣說更好</p>
                  <div class="fix__row"><p class="fix__en">{{ m.fix }}</p><AudioButton :text="m.fix" size="sm" /></div>
                  <p v-if="m.note" class="fix__note zh">{{ m.note }}</p>
                </div>
                <p v-else-if="m.understood" class="okline zh">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10.4l3.4 3.4L15.4 6.8" /></svg>說得對
                </p>
              </div>
            </template>
          </li>
          <li v-if="sending" class="msg msg--ai" aria-live="polite">
            <span class="ava ava--sm" aria-hidden="true">{{ topic.partner.name[0] }}</span>
            <div class="bub bub--ai bub--typing" aria-label="對方正在輸入"><i /><i /><i /></div>
          </li>
        </ol>

        <section v-if="ended && !sending" class="over card">
          <p class="over__t zh">對話結束</p>
          <p class="over__d zh">完成 {{ goalsMet }} / {{ topic.goals.length }} 個目標，說了 {{ turnsUsed }} 次。</p>
          <button class="btn btn--primary btn--block zh" @click="finishTalk">{{ online ? '看評分與回饋' : '對照參考說法' }}</button>
        </section>

        <!-- composer: sticky glass bar at the bottom of the flow, so the
             on-screen keyboard pushes it up like any focused field -->
        <div v-if="!ended" class="comp">
          <div class="comp__tools scroll-x">
            <button v-if="hint && !hintShown" class="pill zh" @click="revealHint">給我開頭</button>
            <button v-else-if="hint" class="pill pill--hint" @click="insert(hint)">{{ hint }}</button>
            <button
              v-for="w in targets" :key="w.id"
              class="pill pill--word" :class="{ 'pill--used': usedIds.has(w.id) }"
              @click="insert(w.headword)"
            >{{ w.headword }}</button>
            <button v-if="canEnd" class="pill pill--end zh" @click="endNow">結束對話</button>
          </div>
          <div class="comp__row">
            <textarea
              ref="box"
              v-model="draft"
              class="comp__box"
              rows="1"
              :maxlength="TALK_MAX_CHARS"
              :placeholder="turnsLeft === 1 ? '最後一句…' : '用英文回答…'"
              enterkeyhint="send"
              autocapitalize="sentences"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              :disabled="sending"
              aria-label="你的回答"
              @keydown="onKey"
            />
            <button class="comp__send" :disabled="!draft.trim() || sending" aria-label="送出" @click="send">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" /></svg>
            </button>
          </div>
          <p class="comp__meta zh">
            <span>還有 {{ turnsLeft }} 回合</span>
            <span v-if="charsLeft <= 30" :class="{ 'comp__warn': charsLeft <= 10 }">剩 {{ charsLeft }} 字元</span>
          </p>
        </div>
      </template>

      <!-- ============ report ============ -->
      <template v-else>
        <section v-if="reporting" class="wait card">
          <span class="wait__spin" aria-hidden="true" />
          <p class="zh">老師正在看你的對話…</p>
        </section>

        <section v-else-if="reportError" class="wait card">
          <p class="zh">{{ reportError }}</p>
          <button class="btn btn--primary zh" @click="makeReport">再試一次</button>
        </section>

        <!-- AI report -->
        <template v-else-if="report && !report.offline">
          <header class="rep">
            <Stamp :ratio="total / 16" :text="report.level || '—'" :size="132" />
            <p class="rep__head">{{ headline }}</p>
            <p class="rep__sum zh">{{ report.summary_zh }}</p>
            <p v-if="report.level" class="rep__lv zh">這段對話大約是 CEFR {{ report.level }} 的表現</p>
            <p v-if="repeatOf && repeatOf.total != null" class="rep__cmp zh">
              上次（{{ repeatOf.day.slice(5).replace('-', '/') }}）<b class="num">{{ repeatOf.total }}</b> 分 → 這次 <b class="num">{{ total }}</b> 分
              <span :class="total >= repeatOf.total ? 'up' : 'down'">{{ total > repeatOf.total ? `進步 ${total - repeatOf.total} 分` : total === repeatOf.total ? '持平' : '這次的狀況比較難' }}</span>
            </p>
          </header>

          <section class="grp">
            <div v-for="r in RUBRIC" :key="r.key" class="crit">
              <div class="crit__top">
                <span class="crit__l zh">{{ r.label }}</span>
                <span class="crit__n num">{{ report.scores[r.key] }}<small>/4</small></span>
              </div>
              <div class="crit__meter" :aria-label="`${r.label} ${report.scores[r.key]} 分`">
                <i v-for="n in 4" :key="n" :class="{ on: n <= report.scores[r.key] }" :style="{ '--d': n * 70 + 'ms' }" />
              </div>
              <p class="crit__d zh">{{ r.desc[report.scores[r.key]] }}</p>
            </div>
          </section>

          <section class="grp">
            <div class="row1"><span class="zh">目標</span><b class="num">{{ goalsMet }} / {{ topic.goals.length }}</b></div>
            <div class="row1"><span class="zh">回合</span><b class="num">{{ turnsUsed }} / {{ TALK_TURNS }}</b></div>
            <div class="row1"><span class="zh">說出的英文字</span><b class="num">{{ englishWords }}</b></div>
            <div v-if="targets.length" class="row1">
              <span class="zh">今天的字</span>
              <span class="row1__words">
                <span v-for="w in targets" :key="w.id" :class="usedIds.has(w.id) ? 'tw--on' : 'tw--off'">{{ w.headword }}</span>
              </span>
            </div>
            <div class="row1"><span class="zh">看了提示</span><b class="num">{{ hintsUsed }} 次</b></div>
          </section>

          <section v-if="report.strengths.length" class="blk">
            <h2 class="blk__h zh">做得好的地方</h2>
            <div v-for="(s, i) in report.strengths" :key="i" class="good card">
              <p class="good__q">“{{ s.quote }}”</p>
              <p class="good__w zh">{{ s.why_zh }}</p>
            </div>
          </section>

          <section v-if="report.fixes.length" class="blk">
            <h2 class="blk__h zh">最值得改的 {{ report.fixes.length }} 句</h2>
            <div v-for="(f, i) in report.fixes" :key="i" class="fixc card">
              <p class="fixc__said">{{ f.said }}</p>
              <div class="fixc__row"><p class="fixc__better">{{ f.better }}</p><AudioButton :text="f.better" size="sm" /></div>
              <p class="fixc__why zh">{{ f.why_zh }}</p>
            </div>
            <p class="blk__foot zh">這幾句已經存進錯題本。</p>
          </section>

          <section v-if="report.upgrade" class="blk">
            <h2 class="blk__h zh">下次可以這樣說</h2>
            <div class="up card">
              <div class="up__row"><p class="up__en">{{ report.upgrade.en }}</p><AudioButton :text="report.upgrade.en" size="sm" /></div>
              <p class="up__zh zh">{{ report.upgrade.zh }}</p>
              <p class="up__when zh">{{ report.upgrade.when_zh }}</p>
            </div>
          </section>
        </template>

        <!-- offline: compare with samples -->
        <template v-else-if="report?.offline">
          <header class="rep">
            <Stamp :ratio="selfCheck.filter(Boolean).length / topic.goals.length" text="自評" :size="120" />
            <p class="rep__head">對照參考說法</p>
            <p class="rep__sum zh">沒有 AI 時不打分數。看看你說的和參考說法差在哪裡，再勾選你做到的目標。</p>
          </header>
          <section class="grp">
            <button v-for="(g, i) in topic.goals" :key="g.en" class="row1 row1--btn zh" @click="selfCheck[i] = !selfCheck[i]">
              <span>{{ g.zh }}</span>
              <span class="tick" :class="{ 'tick--on': selfCheck[i] }" aria-hidden="true" />
            </button>
          </section>
          <section class="blk">
            <div v-for="(m, i) in mine" :key="i" class="cmp card">
              <p class="cmp__lbl zh">你說</p>
              <p class="cmp__me">{{ m.en }}</p>
              <template v-if="topic.samples[i]">
                <p class="cmp__lbl zh">參考說法</p>
                <div class="fixc__row"><p class="cmp__ref">{{ topic.samples[i] }}</p><AudioButton :text="topic.samples[i]" size="sm" /></div>
              </template>
            </div>
          </section>
        </template>

        <template v-if="!reporting && (report || reportError)">
          <section class="blk">
            <button class="disc zh" :aria-expanded="showLog" @click="showLog = !showLog">
              {{ showLog ? '收起對話' : '看整段對話' }}<span v-if="replyFixes.length" class="disc__n">{{ replyFixes.length }} 句有修正</span>
            </button>
            <ol v-if="showLog" class="log log--review">
              <li v-for="(m, i) in messages" :key="i" class="msg" :class="`msg--${m.who}`">
                <div class="msg__col" :class="{ 'msg__col--me': m.who === 'me' }">
                  <div class="bub" :class="m.who === 'me' ? 'bub--me' : 'bub--ai'"><p class="bub__en">{{ m.en }}</p></div>
                  <p v-if="m.fix" class="fix__en fix__en--inline">→ {{ m.fix }}</p>
                </div>
              </li>
            </ol>
          </section>

          <button class="btn btn--primary btn--block zh" @click="done">完成，下一關</button>
          <button class="btn btn--quiet btn--block zh" @click="again">同一個情境再聊一次</button>
        </template>
      </template>
    </main>
  </div>
</template>

<style scoped>
.tk-view { min-height: 100dvh; display: flex; flex-direction: column; }
.tk { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-5)); }

/* ---- brief ---- */
.brief { padding: var(--sp-5) var(--sp-5) var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-3); }
.brief__area { font-size: var(--step--1); font-weight: 600; color: var(--pen); }
.brief__title { font-family: var(--font-kai); font-size: var(--step-4); font-weight: 700; line-height: 1.1; letter-spacing: -0.015em; margin-top: -4px; }
.brief__scene { font-size: var(--step-0); color: var(--ink-2); line-height: 1.6; }
.brief__h { font-size: var(--step--1); font-weight: 600; color: var(--ink-2); margin-top: var(--sp-2); }
.brief__alt { display: flex; justify-content: center; flex-wrap: wrap; gap: var(--sp-1) var(--sp-2); margin-top: -8px; }
.brief__again { margin-left: 8px; font-weight: 500; color: var(--ink-2); }
.twist { padding: 12px 14px; border-radius: var(--radius); background: var(--amber-wash); display: flex; flex-direction: column; gap: 2px; }
.twist__l { font-size: var(--step--2); font-weight: 600; color: var(--amber); }
.twist__t { font-size: var(--step-0); line-height: 1.5; }
.mine { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.mine__l { font-size: var(--step--1); font-weight: 600; color: var(--ink-2); }
.mine__box { min-height: 72px; font-size: var(--step-0); }

.who { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-radius: var(--radius); background: var(--surface-2); }
.who__t { display: flex; flex-direction: column; line-height: 1.3; }
.who__t b { font-size: var(--step-0); font-weight: 650; }
.who__t span { font-size: var(--step--1); color: var(--ink-2); }
.ava {
  width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center;
  font-family: var(--font-kai); font-weight: 700; font-size: 1.15rem; color: #fff;
  background: linear-gradient(160deg, var(--a1), var(--a3));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 4px 12px -6px rgba(0, 0, 0, 0.35);
  
}
.ava--sm { width: 30px; height: 30px; font-size: 0.85rem; align-self: flex-start; margin-top: 2px; }

.goals { display: flex; flex-direction: column; gap: 8px; }
.goal { display: flex; align-items: center; gap: 10px; font-size: var(--step-0); line-height: 1.45; }
.goal__dot { width: 20px; height: 20px; border-radius: 50%; flex-shrink: 0; box-shadow: inset 0 0 0 1.6px var(--rule-strong); }

.tw { display: flex; flex-wrap: wrap; gap: 8px; }
.tw__w { display: inline-flex; align-items: baseline; gap: 6px; padding: 6px 12px; border-radius: 999px; background: var(--pen-wash); }
.tw__w b { font-family: var(--font-word); font-size: var(--step-0); color: var(--pen); }
.tw__w small { font-size: var(--step--2); color: var(--ink-2); }

.rules { display: flex; flex-direction: column; gap: 6px; padding: 0 var(--sp-2); font-size: var(--step--1); color: var(--ink-2); line-height: 1.55; }
.rules li { position: relative; padding-left: 14px; }
.rules li::before { content: ''; position: absolute; left: 0; top: 0.62em; width: 5px; height: 5px; border-radius: 50%; background: var(--ink-3); }

/* ---- chat ---- */
.strip { display: flex; flex-wrap: wrap; gap: 6px; }
.strip__g {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 11px 4px 7px; border-radius: 999px;
  font-size: var(--step--2); font-weight: 600; color: var(--ink-2);
  background: var(--surface); box-shadow: var(--rim);
  transition: background 0.3s, color 0.3s;
}
.strip__g svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.strip__g--on { color: var(--jade); background: var(--jade-wash); }
.strip__g--on svg circle { fill: var(--green); stroke: var(--green); }
.strip__g--on svg path { stroke: #fff; stroke-width: 2; animation: draw 0.3s forwards; stroke-dasharray: 14; stroke-dashoffset: 14; }

.log { display: flex; flex-direction: column; gap: 14px; }
.msg { display: flex; gap: 8px; animation: msg-in 0.34s cubic-bezier(0.2, 1.1, 0.3, 1); }
.msg--me { justify-content: flex-end; }
.msg__col { display: flex; flex-direction: column; gap: 4px; max-width: 82%; align-items: flex-start; }
.msg__col--me { align-items: flex-end; }
.bub { padding: 10px 15px; border-radius: 20px; line-height: 1.45; }
.bub__en { font-family: var(--font-word); font-size: var(--step-0); }
.bub__zh { font-size: var(--step--1); color: var(--ink-2); margin-top: 4px; }
.bub--ai { background: var(--surface); box-shadow: var(--rim), var(--shadow-1); border-bottom-left-radius: 6px; }
.bub--me { background: var(--pen); color: #fff; border-bottom-right-radius: 6px; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22), 0 6px 16px -10px var(--pen); }
.msg__tools { display: flex; align-items: center; gap: 4px; padding-left: 4px; }
.msg__zhbtn { font-size: var(--step--2); font-weight: 600; color: var(--pen); padding: 4px 8px; border-radius: 999px; }
.msg__zhbtn:active { background: var(--surface-2); }

.bub--typing { display: inline-flex; gap: 4px; padding: 14px 16px; }
.bub--typing i { width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); animation: dot 1.1s infinite ease-in-out; }
.bub--typing i:nth-child(2) { animation-delay: 0.15s; }
.bub--typing i:nth-child(3) { animation-delay: 0.3s; }
@keyframes dot { 0%, 70%, 100% { transform: translateY(0); opacity: 0.4; } 35% { transform: translateY(-4px); opacity: 1; } }
@keyframes msg-in { from { opacity: 0; transform: translateY(8px) scale(0.97); } }

.fix { align-self: stretch; max-width: 100%; padding: 10px 12px; border-radius: 16px; background: var(--amber-wash); display: flex; flex-direction: column; gap: 4px; }
.fix__lbl { font-size: var(--step--2); font-weight: 600; color: var(--amber); }
.fix__row { display: flex; align-items: flex-start; gap: 6px; }
.fix__en { flex: 1; font-family: var(--font-word); font-size: var(--step--1); line-height: 1.5; color: var(--ink); }
.fix__en--inline { color: var(--jade); padding-right: 6px; }
.fix__note { font-size: var(--step--2); color: var(--ink-2); line-height: 1.5; }
.okline { display: inline-flex; align-items: center; gap: 3px; font-size: var(--step--2); font-weight: 600; color: var(--jade); padding-right: 6px; }
.okline svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

.over { padding: var(--sp-5); display: flex; flex-direction: column; gap: var(--sp-2); text-align: center; animation: msg-in 0.4s cubic-bezier(0.2, 1.1, 0.3, 1); }
.over__t { font-size: var(--step-1); font-weight: 700; }
.over__d { font-size: var(--step--1); color: var(--ink-2); margin-bottom: var(--sp-2); }

/* composer */
.comp {
  position: sticky; bottom: calc(env(safe-area-inset-bottom) + 8px); z-index: 80;
  margin-top: auto;
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px 10px 8px; border-radius: 26px;
  background: var(--glass-solid);
  box-shadow: var(--glass-rim), var(--shadow-2);
}
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .comp { background: var(--glass); -webkit-backdrop-filter: blur(24px) saturate(115%); backdrop-filter: blur(24px) saturate(115%); }
}
@media (prefers-reduced-transparency: reduce) { .comp { background: var(--glass-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
.comp__tools { display: flex; gap: 6px; padding: 0 2px; }
.comp__tools:empty { display: none; }
.pill {
  flex-shrink: 0; min-height: 32px; padding: 0 13px; border-radius: 999px;
  font-size: var(--step--1); font-weight: 600; color: var(--ink);
  background: var(--surface-2);
  transition: transform 0.25s cubic-bezier(0.3, 1.5, 0.5, 1), background 0.2s;
}
.pill:active { transform: scale(0.94); }
.pill--hint { font-family: var(--font-word); color: var(--pen); background: var(--pen-wash); }
.pill--word { font-family: var(--font-word); }
.pill--used { color: var(--jade); background: var(--jade-wash); }
.pill--used::after { content: ' ✓'; }
.pill--end { color: var(--redpen); margin-left: auto; }
.comp__row { display: flex; align-items: flex-end; gap: 8px; }
.comp__box {
  flex: 1; resize: none; min-height: 40px; max-height: 120px;
  padding: 9px 14px; border: 0; border-radius: 20px;
  background: var(--surface); box-shadow: inset 0 0 0 1px var(--rule);
  font-family: var(--font-word); font-size: var(--step-0); line-height: 1.4; color: var(--ink);
}
.comp__box:focus { outline: none; box-shadow: inset 0 0 0 1.5px var(--focus); }
.comp__send {
  width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
  display: grid; place-items: center; background: var(--pen); color: #fff;
  transition: transform 0.25s cubic-bezier(0.3, 1.5, 0.5, 1), opacity 0.2s;
}
.comp__send svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.comp__send:active:not(:disabled) { transform: scale(0.88); }
.comp__send:disabled { opacity: 0.3; }
.comp__meta { display: flex; justify-content: space-between; padding: 0 8px; font-size: var(--step--2); color: var(--ink-3); }
.comp__warn { color: var(--redpen); font-weight: 600; }

/* ---- report ---- */
.wait { padding: var(--sp-6) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); color: var(--ink-2); text-align: center; }
.wait__spin { width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--surface-3); border-top-color: var(--pen); animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.rep { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; padding: var(--sp-3) 0 var(--sp-2); }
.rep__head { font-family: var(--font-kai); font-size: var(--step-3); font-weight: 700; letter-spacing: -0.015em; margin-top: var(--sp-2); }
.rep__sum { font-size: var(--step-0); color: var(--ink-2); line-height: 1.6; max-width: 34ch; }
.rep__lv { font-size: var(--step--1); color: var(--ink-3); }
.rep__cmp { font-size: var(--step--1); color: var(--ink-2); padding: 6px 14px; border-radius: 999px; background: var(--surface-2); }
.rep__cmp b { color: var(--ink); }
.rep__cmp .up { color: var(--jade); font-weight: 600; margin-left: 6px; }
.rep__cmp .down { color: var(--ink-3); margin-left: 6px; }

/* inset grouped list */
.grp { border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--rim), var(--shadow-1); overflow: hidden; }
.grp > * + * { box-shadow: inset 0 0.5px 0 var(--rule); }
.crit { padding: 14px 16px; display: flex; flex-direction: column; gap: 7px; }
.crit__top { display: flex; align-items: baseline; justify-content: space-between; }
.crit__l { font-weight: 600; }
.crit__n { font-size: var(--step-1); }
.crit__n small { font-size: var(--step--2); color: var(--ink-3); margin-left: 1px; }
.crit__meter { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.crit__meter i { height: 6px; border-radius: 3px; background: var(--surface-3); }
.crit__meter i.on { background: var(--pen); animation: seg-in 0.35s var(--d) both cubic-bezier(0.3, 1.3, 0.5, 1); transform-origin: left; }
@keyframes seg-in { from { transform: scaleX(0); } }
.crit__d { font-size: var(--step--1); color: var(--ink-2); }

.row1 { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); min-height: 48px; padding: 0 16px; width: 100%; text-align: left; font-size: var(--step-0); }
.row1 b { font-weight: 600; color: var(--ink-2); }
.row1__words { display: flex; flex-wrap: wrap; gap: 4px 10px; justify-content: flex-end; font-family: var(--font-word); }
.tw--on { color: var(--jade); font-weight: 700; }
.tw--on::after { content: ' ✓'; }
.tw--off { color: var(--ink-3); }
.row1--btn:active { background: var(--surface-2); }
.tick { width: 24px; height: 24px; border-radius: 50%; box-shadow: inset 0 0 0 1.6px var(--rule-strong); transition: background 0.2s; }
.tick--on { background: var(--green); box-shadow: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M7 12.4l3.2 3.2L17 8.8' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/></svg>"); }

.blk { display: flex; flex-direction: column; gap: var(--sp-2); }
.blk__h { font-size: var(--step--1); font-weight: 600; color: var(--ink-2); padding: 0 6px; margin-top: var(--sp-2); }
.blk__foot { font-size: var(--step--2); color: var(--ink-3); padding: 0 6px; }
.good { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.good__q { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; }
.good__w { font-size: var(--step--1); color: var(--ink-2); }
.fixc { padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.fixc__said { font-family: var(--font-word); font-size: var(--step--1); color: var(--redpen); text-decoration: line-through; text-decoration-thickness: 1px; }
.fixc__row { display: flex; align-items: flex-start; gap: 6px; }
.fixc__better { flex: 1; font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; color: var(--jade); font-weight: 700; }
.fixc__why { font-size: var(--step--1); color: var(--ink-2); line-height: 1.55; }
.up { padding: 16px; display: flex; flex-direction: column; gap: 4px; background: color-mix(in srgb, var(--a2) 40%, var(--surface)); }
.up__row { display: flex; align-items: flex-start; gap: 6px; }
.up__en { flex: 1; font-family: var(--font-word); font-size: var(--step-1); font-weight: 700; line-height: 1.35; }
.up__zh { font-size: var(--step-0); }
.up__when { font-size: var(--step--1); color: var(--ink-2); }
.cmp { padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.cmp__lbl { font-size: var(--step--2); font-weight: 600; color: var(--ink-3); }
.cmp__me { font-family: var(--font-word); font-size: var(--step-0); margin-bottom: 6px; }
.cmp__ref { flex: 1; font-family: var(--font-word); font-size: var(--step-0); color: var(--jade); font-weight: 700; }

.disc { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 16px; border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--rim); font-weight: 600; color: var(--pen); }
.disc__n { font-size: var(--step--2); color: var(--ink-3); font-weight: 500; }
.log--review { padding: var(--sp-2) 0; }
.log--review .msg { animation: none; }
</style>
