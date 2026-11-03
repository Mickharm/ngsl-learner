<script setup>
import AnswerSheet from '@/components/ui/AnswerSheet.vue'
import { sfx } from '@/lib/sfx'
import { ref, computed, watch, onMounted } from 'vue'
import AudioButton from '@/components/AudioButton.vue'
import TenseTimeline from './TenseTimeline.vue'
import SentenceSlots from './SentenceSlots.vue'
import { TENSES, ROLES } from '@/data/grammar-studio'
import { GRAMMAR_BY_ID } from '@/data/grammar'
import { shuffle, scramble } from '@/lib/game'
import { inlineMd } from '@/lib/format'

/**
 * One Grammar Studio item, any type:
 *
 *   choice    fill the gap                 picture   which sentence matches the picture
 *   meaning   read → answer about meaning  judge     which of two sentences is right
 *   timeline  where on the time line?      blocks    put chunks into the coloured slots
 *   order     build the sentence           tap       tap the wrong word
 *   sort      ✅ / ❌ several sentences
 *
 * After answering, the item names the grammar point it was testing — in the
 * mixed round that label is half the lesson ("this one was 現在完成式").
 */
const props = defineProps({
  item: { type: Object, required: true },
  seed: { type: Number, default: 1 },
  showPoint: { type: Boolean, default: true }
})
const emit = defineEmits(['answer', 'next'])

const settled = ref(false)
const correct = ref(false)
const picked = ref(null)

// order / blocks
const built = ref([])
const bank = ref([])
// tap
const tapped = ref(null)
// sort
const sortIdx = ref(0)
const sortRight = ref(0)
const sortLast = ref(null)
// timeline
const zoneOptions = ref([])

const point = computed(() => GRAMMAR_BY_ID[props.item.pointId] || null)
const blockSlots = computed(() => (props.item.blocks || []).map(([, role]) => [role, ROLES[role]?.label || role]))
const fillBlocks = computed(() => blockSlots.value.map((_, i) => built.value[i] || null))
const wrongSlots = computed(() => settled.value && props.item.type === 'blocks'
  ? fillBlocks.value.map((b, i) => (b && b.role !== props.item.blocks[i][1] ? i : -1)).filter(i => i >= 0)
  : [])

function reset () {
  settled.value = false; correct.value = false; picked.value = null
  built.value = []; tapped.value = null
  sortIdx.value = 0; sortRight.value = 0; sortLast.value = null
  const it = props.item
  if (it.type === 'order') bank.value = scramble(it.tokens.map((t, i) => ({ text: t, key: `${t}${i}` })), props.seed, b => b.text)
  else if (it.type === 'blocks') bank.value = scramble(it.blocks.map(([text, role], i) => ({ text, role, key: `${i}` })), props.seed, b => b.text)
  else bank.value = []
  if (it.type === 'timeline') {
    const others = shuffle(Object.keys(TENSES).filter(k => k !== it.answer), props.seed).slice(0, 3)
    zoneOptions.value = shuffle([it.answer, ...others], props.seed + 1)
  }
}

function settle (ok) {
  if (settled.value) return
  settled.value = true
  correct.value = ok
  if (props.item.type !== 'sort') sfx(ok ? 'good' : 'bad')
  emit('answer', { correct: ok, pointId: props.item.pointId, type: props.item.type })
}

function pick (i) {
  if (settled.value) return
  picked.value = i
  settle(i === props.item.answer)
}
function pickZone (z, i) {
  if (settled.value) return
  picked.value = i
  settle(z === props.item.answer)
}

/* order + blocks */
function push (b) {
  if (settled.value) return
  built.value = [...built.value, b]
  bank.value = bank.value.filter(x => x.key !== b.key)
  if (!bank.value.length) check()
}
function pop (i) {
  if (settled.value) return
  const b = built.value[i]
  built.value = built.value.filter((_, k) => k !== i)
  bank.value = [...bank.value, b]
}
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim()
function check () {
  const it = props.item
  if (it.type === 'order') settle(norm(built.value.map(b => b.text).join(' ')) === norm(it.answer))
  else settle(built.value.every((b, i) => b.role === it.blocks[i][1]))
}

/* tap */
function tap (i) {
  if (settled.value) return
  tapped.value = i
  settle(i === props.item.wrongIndex)
}

/* sort */
const sortCard = computed(() => props.item.cards?.[sortIdx.value] || null)
function judgeCard (says) {
  if (settled.value || !sortCard.value) return
  const ok = says === sortCard.value.ok
  if (ok) sortRight.value++
  sortLast.value = { ok, card: sortCard.value }
  sfx(ok ? 'good' : 'bad')
  // A right card moves on by itself; a wrong one waits for 下一句, so the
  // correction under it can actually be read.
  if (ok) sortTimer = setTimeout(nextSortCard, 650)
}
let sortTimer = 0
function nextSortCard () {
  clearTimeout(sortTimer)
  sortLast.value = null
  if (sortIdx.value + 1 < props.item.cards.length) sortIdx.value++
  else settle(sortRight.value >= props.item.cards.length - 1)
}

const explain = computed(() => {
  const it = props.item
  if (it.type === 'sort') return `${sortRight.value} / ${it.cards.length} 判斷正確。`
  return it.explain || ''
})

watch(() => props.item, reset)
onMounted(reset)
</script>

<template>
  <section class="gg" :class="settled && (correct ? 'gg--right' : 'gg--wrong')">
    <!-- ===== prompt ===== -->
    <div class="gg__prompt card">
      <template v-if="item.type === 'choice'">
        <p class="gg__ask zh">選出正確的答案</p>
        <p class="gg__sent">{{ item.q }}</p>
      </template>

      <template v-else-if="item.type === 'picture'">
        <div class="gg__scene" aria-hidden="true">{{ item.scene }}</div>
        <p class="gg__ask zh">{{ item.q }}</p>
      </template>

      <template v-else-if="item.type === 'meaning'">
        <div class="gg__row">
          <p class="gg__sent">{{ item.s }}</p>
          <AudioButton :text="item.s" size="sm" />
        </div>
        <p class="gg__ask zh">{{ item.q }}</p>
      </template>

      <template v-else-if="item.type === 'judge'">
        <p class="gg__ask zh">哪一句是對的？</p>
      </template>

      <template v-else-if="item.type === 'timeline'">
        <div class="gg__row">
          <p class="gg__sent">{{ item.s }}</p>
          <AudioButton :text="item.s" size="sm" />
        </div>
        <p class="gg__zh zh">{{ item.zh }}</p>
        <p class="gg__ask zh">這個動作在時間線上的哪裡？</p>
      </template>

      <template v-else-if="item.type === 'blocks'">
        <p class="gg__ask zh">把英文積木放進對的位置：</p>
        <p class="gg__zhbig zh">{{ item.zh }}</p>
        <SentenceSlots :slots="blockSlots" :fill="fillBlocks" :wrong-at="wrongSlots" />
      </template>

      <template v-else-if="item.type === 'order'">
        <p class="gg__ask zh">排出這句英文：</p>
        <p class="gg__zhbig zh">{{ item.zh }}</p>
        <div class="built">
          <button v-for="(b, i) in built" :key="b.key" class="wtile wtile--on" @click="pop(i)">{{ b.text }}</button>
          <span v-if="!built.length" class="built__ph zh">點下面的字</span>
        </div>
      </template>

      <template v-else-if="item.type === 'tap'">
        <p class="gg__ask zh">這句有一個字錯了，點它。</p>
        <p class="taps">
          <button
            v-for="(t, i) in item.tokens" :key="i"
            class="tapw"
            :class="{
              'tapw--hit': settled && i === item.wrongIndex,
              'tapw--miss': settled && tapped === i && i !== item.wrongIndex
            }"
            :disabled="settled"
            @click="tap(i)"
          >{{ t }}<span v-if="settled && i === item.wrongIndex" class="tapw__fix">{{ item.fix || '（刪掉）' }}</span></button>
        </p>
      </template>

      <template v-else-if="item.type === 'sort' && sortCard">
        <p class="gg__ask zh">這句對還是錯？ <span class="num dim">{{ sortIdx + 1 }}/{{ item.cards.length }}</span></p>
        <p class="gg__sent" :class="sortLast && (sortLast.ok ? 'gg__sent--ok' : 'gg__sent--no')">{{ sortCard.s }}</p>
        <p v-if="sortLast && !sortLast.ok" class="gg__fix zh">{{ sortCard.ok ? '這句是對的。' : `正確：${sortCard.fix}` }}</p>
      </template>
    </div>

    <!-- ===== answer area ===== -->
    <div v-if="['choice', 'picture', 'meaning', 'judge'].includes(item.type)" class="gg__opts">
      <button
        v-for="(o, i) in item.options" :key="o"
        class="gopt"
        :class="{
          'gopt--sent': item.type !== 'meaning' || /[a-z]{3}/i.test(o),
          'gopt--right': settled && i === item.answer,
          'gopt--wrong': settled && picked === i && i !== item.answer,
          'gopt--mute': settled && picked !== i && i !== item.answer
        }"
        :disabled="settled"
        @click="pick(i)"
      >{{ o }}</button>
    </div>

    <div v-else-if="item.type === 'timeline'" class="zones">
      <button
        v-for="(z, i) in zoneOptions" :key="z"
        class="zone"
        :class="{ 'zone--right': settled && z === item.answer, 'zone--wrong': settled && picked === i && z !== item.answer, 'gopt--mute': settled && picked !== i && z !== item.answer }"
        :disabled="settled"
        @click="pickZone(z, i)"
      >
        <TenseTimeline :tense="z" small />
        <span class="zone__lbl zh">{{ TENSES[z].label }}</span>
      </button>
    </div>

    <div v-else-if="(item.type === 'order' || item.type === 'blocks') && !settled" class="bank">
      <button v-for="b in bank" :key="b.key" class="wtile" @click="push(b)">{{ b.text }}</button>
    </div>

    <div v-else-if="item.type === 'sort' && !settled" class="sortbtns">
      <template v-if="sortLast && !sortLast.ok">
        <button class="btn btn--block btn--ink zh sortnext" @click="nextSortCard">看懂了，下一句</button>
      </template>
      <template v-else>
        <button class="sortbtn sortbtn--no zh" :disabled="!!sortLast" @click="judgeCard(false)">錯</button>
        <button class="sortbtn sortbtn--ok zh" :disabled="!!sortLast" @click="judgeCard(true)">對</button>
      </template>
    </div>

    <!-- ===== feedback ===== -->
    <AnswerSheet v-if="settled" :right="correct" :title="correct ? '答對了' : '差一點'" :chars="(explain || '').length" @next="emit('next')">
      <span v-if="showPoint && point" class="fb__point zh">這題考：{{ point.title.split('：')[0] }}</span>
      <p v-if="item.type === 'order' && !correct" class="fb__ans">{{ item.answer }}</p>
      <p v-if="item.type === 'tap'" class="fb__ans">{{ item.answer }}</p>
      <p v-if="item.type === 'blocks' && !correct" class="fb__ans">{{ item.blocks.map(b => b[0]).join(' ') }}</p>
      <p v-if="explain" class="fb__ex zh" v-html="inlineMd(explain)" />
    </AnswerSheet>
  </section>
</template>

<style scoped>
.gg { display: flex; flex-direction: column; gap: var(--sp-4); }
.gg__prompt {
  padding: var(--sp-5) var(--sp-4);
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
  text-align: center; border-top: 0; min-height: 150px; justify-content: center;
}
.gg__ask { font-size: var(--step--1); color: var(--ink-2); }
.gg__sent { font-family: var(--font-word); font-size: var(--step-2); line-height: 1.45; transition: color 0.2s; }
.gg__sent--ok { color: var(--jade); }
.gg__sent--no { color: var(--rose); }
.gg__fix { font-size: var(--step--1); color: var(--jade); }
.gg__zh { font-size: var(--step--1); color: var(--ink-2); }
.gg__zhbig { font-size: var(--step-1); font-weight: 600; }
.gg__row { display: flex; align-items: center; gap: var(--sp-2); justify-content: center; }
.gg__scene { font-size: 3.4rem; line-height: 1.1; letter-spacing: 0.08em; }

.gg__opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.gopt { min-height: 52px; padding: var(--sp-2) var(--sp-4); text-align: left; font-size: var(--step-0); font-weight: 500; line-height: 1.4; }
.gopt--sent { font-family: var(--font-word); font-size: var(--step-1); }
.gopt--wrong { animation: shake 0.35s; }

.zones { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.zone { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--sp-2); }
.zone__lbl { font-size: var(--step--1); font-weight: 600; }

.built { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 52px; padding: 8px; width: 100%; }
.built__ph { color: var(--ink-3); font-size: var(--step--1); align-self: center; }
.bank { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.wtile { padding: 8px 14px; font-family: var(--font-word); font-size: var(--step-1); }

.taps { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.tapw { position: relative; padding: 6px 10px; font-family: var(--font-word); font-size: var(--step-1); }
.tapw--hit { border-style: solid; }
.tapw--miss { border-style: solid; }
.tapw__fix { position: absolute; left: 50%; top: 100%; transform: translate(-50%, 4px); color: var(--jade); text-decoration: none; font-weight: 700; font-size: var(--step--1); white-space: nowrap; }

.sortbtns { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.sortnext { grid-column: 1 / -1; }
.sortbtn { min-height: 64px; border-radius: var(--radius); font-size: var(--step-1); font-weight: 700; border: 2px solid; }
.sortbtn--ok { border-color: var(--jade); color: var(--jade); background: var(--jade-wash); }
.sortbtn--no { border-color: var(--rose); color: var(--rose); background: var(--rose-wash); }
.sortbtn:active { transform: scale(0.97); }

.fb__point { align-self: flex-start; font-size: var(--step--2); color: var(--ink-2); background: var(--sun-wash); padding: 2px 10px; border-radius: 999px; }
.fb__ans { font-family: var(--font-word); font-size: var(--step-1); color: var(--jade-ink); }
.fb__ex { font-size: var(--step-0); color: var(--ink-2); line-height: 1.65; }

@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
</style>
