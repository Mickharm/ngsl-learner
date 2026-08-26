<script setup>
import { ref, computed } from 'vue'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { BANDS, STAGE_SIZE } from '@/config'
import { STATE, isMastered, formatDelay } from '@/lib/srs'
import AudioButton from '@/components/AudioButton.vue'
import WordCard from '@/components/WordCard.vue'

const words = useWords()
const progress = useProgress()
const settings = useSettings()
const toast = useToast()

const query = ref('')
const band = ref('all')
const filter = ref('all')     // all | learning | mastered | unseen
const page = ref(0)
const detail = ref(null)
const loadingDetail = ref(false)

const PAGE = 60

const filtered = computed(() => {
  if (query.value.trim()) return words.search(query.value, 100)

  const out = []
  for (const b of words.allBase) {
    if (band.value !== 'all' && b.b !== band.value) continue
    const c = progress.cards.get(b.id)
    if (filter.value === 'unseen' && c) continue
    if (filter.value === 'learning' && (!c || c.state === STATE.REVIEW)) continue
    if (filter.value === 'mastered' && (!c || !isMastered(c))) continue
    out.push(b.id)
  }
  return out.map(id => words.get(id))
})

const paged = computed(() => filtered.value.slice(0, (page.value + 1) * PAGE))
const hasMore = computed(() => paged.value.length < filtered.value.length)

function statusOf (id) {
  const c = progress.cards.get(id)
  if (!c) return { label: '未學', cls: 'chip--plain' }
  if (isMastered(c)) return { label: '熟練', cls: 'chip--jade' }
  if (c.state === STATE.REVIEW) return { label: formatDelay(Math.max(0, c.dueAt - Date.now())), cls: 'chip--violet' }
  if (c.state === STATE.RELEARNING) return { label: '重學', cls: 'chip--rose' }
  return { label: '學習中', cls: 'chip--amber' }
}

async function open (w) {
  detail.value = w
  if (!w.enriched && settings.hasGeminiKey) {
    loadingDetail.value = true
    try {
      await words.ensureEnriched([w.id])
      detail.value = words.get(w.id)
    } catch (e) {
      toast.error(e.message)
    } finally {
      loadingDetail.value = false
    }
  }
}

const unlockedTo = computed(() => (progress.unlockedStage + 2) * STAGE_SIZE)
</script>

<template>
  <main class="shell browse">
    <header class="browse__head">
      <div class="eyebrow">NGSL 2801</div>
      <h1 class="page-title zh">單字庫</h1>
    </header>

    <input
      v-model="query" class="input" type="search"
      placeholder="搜尋英文單字…" autocapitalize="none" autocorrect="off"
      @input="page = 0"
    >

    <div class="filters scroll-x">
      <button class="f zh" :class="{ 'f--on': band === 'all' }" @click="band = 'all'; page = 0">全部</button>
      <button
        v-for="b in Object.values(BANDS)" :key="b.key"
        class="f zh" :class="{ 'f--on': band === b.key }"
        @click="band = b.key; page = 0"
      >{{ b.label }}</button>
      <span class="f__sep" />
      <button class="f zh" :class="{ 'f--on': filter === 'all' }" @click="filter = 'all'; page = 0">不限狀態</button>
      <button class="f zh" :class="{ 'f--on': filter === 'learning' }" @click="filter = 'learning'; page = 0">學習中</button>
      <button class="f zh" :class="{ 'f--on': filter === 'mastered' }" @click="filter = 'mastered'; page = 0">熟練</button>
      <button class="f zh" :class="{ 'f--on': filter === 'unseen' }" @click="filter = 'unseen'; page = 0">未學</button>
    </div>

    <p class="count zh">
      共 <span class="num">{{ filtered.length }}</span> 個字 ·
      目前解鎖到第 <span class="num">{{ unlockedTo }}</span> 名
    </p>

    <ul class="wlist">
      <li v-for="w in paged" :key="w.id">
        <button class="wrow" @click="open(w)">
          <span class="wrow__rank num">{{ w.id }}</span>
          <span class="wrow__main">
            <span class="wrow__en">{{ w.headword }}</span>
            <span class="wrow__zh zh">{{ w.meanings?.[0]?.zh || '—' }}</span>
          </span>
          <span class="chip" :class="statusOf(w.id).cls">{{ statusOf(w.id).label }}</span>
          <AudioButton :text="w.headword" size="sm" />
        </button>
      </li>
    </ul>

    <button v-if="hasMore" class="btn btn--ghost btn--block zh" @click="page++">
      載入更多（還有 {{ filtered.length - paged.length }} 個）
    </button>

    <div v-if="!filtered.length" class="empty">
      <div class="empty__mark">∅</div>
      <p class="zh">沒有符合條件的單字</p>
    </div>

    <!-- detail sheet -->
    <Transition name="fade">
      <div v-if="detail" class="sheet" @click.self="detail = null">
        <div class="sheet__inner">
          <button class="sheet__close" aria-label="關閉" @click="detail = null">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <WordCard :word="detail" :revealed="true" />
          <p v-if="loadingDetail" class="sheet__loading zh">正在產生這個字的資料…</p>
          <p v-else-if="!detail.enriched" class="sheet__loading zh">
            這個字還沒有翻譯資料。到設定填入 Gemini API Key 後就會自動產生。
          </p>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.browse { display: flex; flex-direction: column; gap: var(--sp-3); }
.browse__head { display: flex; flex-direction: column; gap: 3px; margin-bottom: var(--sp-1); }

.filters { display: flex; gap: var(--sp-2); align-items: center; padding-bottom: 2px; }
.f {
  padding: 6px 13px; border-radius: var(--radius-pill);
  border: 1px solid var(--rule); background: var(--surface);
  font-size: var(--step--2); color: var(--ink-2); white-space: nowrap;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.f--on { background: var(--ink); border-color: var(--ink); color: var(--paper); font-weight: 600; }
.f__sep { width: 1px; height: 18px; background: var(--rule); flex-shrink: 0; }

.count { font-size: var(--step--2); color: var(--ink-3); }

.wlist { display: flex; flex-direction: column; gap: 1px; }
.wrow {
  width: 100%;
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-2);
  border-radius: var(--radius-sm);
  text-align: left;
  border-bottom: 1px solid var(--rule);
  transition: background 0.14s;
}
.wrow:active { background: var(--surface-2); }
.wrow__rank { font-size: var(--step--2); color: var(--ink-3); min-width: 34px; }
.wrow__main { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.wrow__en { font-family: var(--font-word); font-size: var(--step-0); font-weight: 500; }
.wrow__zh {
  font-size: var(--step--2); color: var(--ink-2);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* sheet */
.sheet {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-end; justify-content: center;
  padding: var(--sp-4);
  overflow-y: auto;
}
.sheet__inner {
  position: relative;
  width: 100%; max-width: 520px;
  margin: auto 0 calc(env(safe-area-inset-bottom) + 60px);
}
.sheet__close {
  position: absolute; top: -42px; right: 0;
  width: 34px; height: 34px;
  display: grid; place-items: center;
  border-radius: 50%;
  background: var(--surface);
  color: var(--ink-2);
  box-shadow: var(--shadow-2);
  z-index: 1;
}
.sheet__close svg { width: 17px; height: 17px; }
.sheet__loading {
  margin-top: var(--sp-3);
  text-align: center; font-size: var(--step--2); color: var(--paper);
  background: rgba(0, 0, 0, 0.35); border-radius: var(--radius); padding: var(--sp-2);
}
</style>
