<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSettings } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import { useProgress } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import { testConnection, listModels, resolveModel } from '@/lib/gemini'
import { whenVoicesReady, englishVoices, speak, ttsSupported } from '@/lib/tts'
import { TOTAL_WORDS } from '@/config'

const settings = useSettings()
const auth = useAuth()
const progress = useProgress()
const words = useWords()
const session = useSession()
const toast = useToast()
const router = useRouter()

const s = computed(() => settings.state)

/* ---- Gemini ---- */
const keyInput = ref('')
const keyVisible = ref(false)
const testing = ref(false)
const testResult = ref(null)
const models = ref([])

async function saveKey () {
  settings.set({ geminiKey: keyInput.value.trim() })
  testResult.value = null
  toast.info('API Key 已儲存')
}

async function runTest () {
  testing.value = true
  testResult.value = null
  try {
    const r = await testConnection({ key: keyInput.value.trim() || s.value.geminiKey, model: s.value.geminiModel })
    if (r.switched) settings.set({ geminiModel: r.model })
    testResult.value = {
      ok: true,
      text: r.switched
        ? `連線成功 · ${r.ms} ms — 原本設定的模型不存在，已自動改用 ${r.model}`
        : `連線成功 · ${r.ms} ms · 模型 ${r.model}`
    }
  } catch (e) {
    testResult.value = { ok: false, text: e.message }
  } finally {
    testing.value = false
  }
}

async function loadModels () {
  try {
    models.value = await listModels(keyInput.value.trim() || s.value.geminiKey)
    toast.info(`找到 ${models.value.length} 個可用模型`)
  } catch (e) {
    toast.error(e.message)
  }
}

/** Ask the API what it has and take the best fit, so nobody has to guess. */
async function autoPickModel () {
  try {
    const picked = await resolveModel(keyInput.value.trim() || s.value.geminiKey, null)
    settings.set({ geminiModel: picked })
    toast.info(`已選用 ${picked}`)
  } catch (e) {
    toast.error(e.message)
  }
}

/* ---- pre-generate all words ---- */
const bulk = ref({ running: false, done: 0, total: 0 })
let bulkAbort = null

async function pregenerate () {
  const ids = words.allBase.map(w => w.id)
  const missing = words.missing(ids)
  if (!missing.length) { toast.info('所有單字資料都已備妥'); return }
  if (!confirm(`還有 ${missing.length} 個單字沒有資料。\n預估需要 ${Math.ceil(missing.length / 20)} 次 API 呼叫、約 ${Math.ceil(missing.length / 20 * 4 / 60)} 分鐘。\n過程中請保持這個頁面開著。要繼續嗎？`)) return

  bulkAbort = new AbortController()
  bulk.value = { running: true, done: 0, total: missing.length }
  try {
    await words.ensureEnriched(missing, {
      signal: bulkAbort.signal,
      onProgress: p => { bulk.value = { running: true, done: p.done, total: p.total } }
    })
    toast.info('單字資料產生完成')
  } catch (e) {
    toast.error(e.message)
  } finally {
    bulk.value = { ...bulk.value, running: false }
    bulkAbort = null
  }
}

function stopBulk () {
  bulkAbort?.abort()
  bulk.value = { ...bulk.value, running: false }
}

/* ---- voices ---- */
const voices = ref([])
onMounted(async () => {
  keyInput.value = s.value.geminiKey || ''
  await whenVoicesReady()
  voices.value = englishVoices()
})

function previewVoice () {
  speak('The train to the airport leaves at seven.', {
    rate: s.value.ttsRate, voiceURI: s.value.ttsVoiceURI
  })
}

/* ---- data ---- */
function exportJson () {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: s.value,
    cards: [...progress.cards.values()],
    today: progress.today
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ngsl-backup-${progress.today.day}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function hardReset () {
  if (!confirm('這會刪除你所有的學習進度、複習排程與錯題記錄，且無法復原。確定嗎？')) return
  if (!confirm('再確認一次：真的要清空全部進度？')) return
  await progress.resetAll()
  session.resetToday()
  localStorage.removeItem('ngsl.placed')
  toast.info('進度已清空')
  router.push('/setup')
}

async function signOut () {
  await progress.flush()
  await auth.signOut()
  router.push('/login')
}

const TOPICS = [
  { key: 'daily', label: '日常' }, { key: 'travel', label: '旅遊' },
  { key: 'work', label: '職場' }, { key: 'tech', label: '科技' }, { key: 'news', label: '新聞' }
]

function toggleTopic (k) {
  const cur = new Set(s.value.articleTopics)
  if (cur.has(k)) { if (cur.size > 1) cur.delete(k) } else cur.add(k)
  settings.set({ articleTopics: [...cur] })
}

const enrichedPct = computed(() => (words.enrichedCount / TOTAL_WORDS) * 100)
</script>

<template>
  <main class="shell set">
    <header class="set__head">
      <div class="eyebrow">Settings</div>
      <h1 class="page-title zh">設定</h1>
    </header>

    <!-- ---------- daily load ---------- -->
    <section class="card card--pad grp">
      <h2 class="grp__title zh">每日份量</h2>

      <div class="field">
        <div class="row between">
          <label class="label" for="new">每日新單字</label>
          <span class="num val">{{ s.newPerDay }}</span>
        </div>
        <input
          id="new" class="slider" type="range" min="5" max="30" step="1"
          :value="s.newPerDay" @input="settings.set({ newPerDay: +$event.target.value })"
        >
        <p class="note zh">
          以你的目標推算：每天 {{ s.newPerDay }} 個字，走完 2801 字需要
          <strong class="num">{{ Math.ceil(TOTAL_WORDS / s.newPerDay / 30) }}</strong> 個月。
          新字越多，之後每天的複習量也越大。
        </p>

        <!-- say plainly whether this takes effect today, and what today will be -->
        <p class="effect zh" :class="session.newCountLocked ? 'effect--later' : 'effect--now'">
          <template v-if="session.newCountLocked">
            今天的新字已經開始了，清單不會中途變動——這個設定<strong>明天生效</strong>。
          </template>
          <template v-else-if="session.plan.newCount < s.newPerDay">
            今天只排得出 <strong class="num">{{ session.plan.newCount }}</strong> 個新字：
            目前解鎖的關卡裡沒有更多沒學過的字了。把已解鎖範圍的字複習到 80% 就會開下一關。
          </template>
          <template v-else>
            今天就會套用：<strong class="num">{{ session.plan.newCount }}</strong> 個新字。
          </template>
        </p>
      </div>

      <div class="field">
        <div class="row between">
          <label class="label" for="cap">每日複習上限</label>
          <span class="num val">{{ s.reviewCap }}</span>
        </div>
        <input
          id="cap" class="slider" type="range" min="20" max="150" step="5"
          :value="s.reviewCap" @input="settings.set({ reviewCap: +$event.target.value })"
        >
        <p class="note zh">超過上限的到期卡片會順延到隔天，優先保留最快忘記的那些。</p>
      </div>

      <div class="field">
        <div class="row between">
          <label class="label" for="cloze">例句填空比例</label>
          <span class="num val">{{ Math.round(s.clozeRatio * 100) }}%</span>
        </div>
        <input
          id="cloze" class="slider" type="range" min="0" max="80" step="5"
          :value="Math.round(s.clozeRatio * 100)" @input="settings.set({ clozeRatio: +$event.target.value / 100 })"
        >
        <p class="note zh">複習時有多少比例改用例句填空。填空比純字卡更接近真實使用，但比較花時間。</p>
      </div>
    </section>

    <!-- ---------- gemini ---------- -->
    <section class="card card--pad grp">
      <h2 class="grp__title zh">Gemini API</h2>
      <p class="note zh">
        單字的翻譯、音標、例句與每日文章都由 Gemini 產生。Key 只存在你的帳號設定裡，
        直接從你的瀏覽器送到 Google，不經過任何中間伺服器。
      </p>

      <div class="field">
        <label class="label" for="key">API Key</label>
        <div class="row row-2">
          <input
            id="key" v-model="keyInput" class="input input--mono grow"
            :type="keyVisible ? 'text' : 'password'"
            autocomplete="off" autocapitalize="none" spellcheck="false"
            placeholder="貼上你的 Gemini API Key"
          >
          <button class="btn btn--ghost btn--sm zh" @click="keyVisible = !keyVisible">
            {{ keyVisible ? '隱藏' : '顯示' }}
          </button>
        </div>
        <div class="row row-2 wrap">
          <button class="btn btn--primary btn--sm zh" :disabled="!keyInput.trim()" @click="saveKey">儲存</button>
          <button class="btn btn--ghost btn--sm zh" :disabled="testing || !(keyInput.trim() || s.geminiKey)" @click="runTest">
            {{ testing ? '測試中…' : '測試連線' }}
          </button>
          <button class="btn btn--quiet btn--sm zh" :disabled="!(keyInput.trim() || s.geminiKey)" @click="loadModels">列出可用模型</button>
        </div>
        <p v-if="testResult" class="result zh" :class="testResult.ok ? 'result--ok' : 'result--no'">
          {{ testResult.text }}
        </p>
      </div>

      <div class="field">
        <label class="label" for="model">模型</label>
        <input
          v-if="!models.length" id="model" class="input input--mono"
          :value="s.geminiModel" @change="settings.set({ geminiModel: $event.target.value.trim() })"
        >
        <select v-else id="model" class="input input--mono" :value="s.geminiModel" @change="settings.set({ geminiModel: $event.target.value })">
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
        <div class="row row-2 wrap">
          <button class="btn btn--ghost btn--sm zh" :disabled="!(keyInput.trim() || s.geminiKey)" @click="autoPickModel">
            自動偵測可用模型
          </button>
        </div>
        <p class="note zh">
          不用自己記模型名稱。Google 會改名或下架模型，遇到 404 時 App 會自己去問
          有哪些能用並換過去，這裡只是讓你看得到目前用的是哪一個。
        </p>
      </div>

      <div class="hr" />

      <div class="field">
        <div class="row between">
          <span class="label">單字資料完成度</span>
          <span class="num val">{{ words.enrichedCount }} / {{ TOTAL_WORDS }}</span>
        </div>
        <div class="bar"><div class="bar__fill" :style="{ width: enrichedPct + '%' }" /></div>
        <p class="note zh">
          平常會在需要時自動產生。也可以一次把 2801 個字全部備妥，之後就完全離線可用。
        </p>
        <div v-if="bulk.running" class="stack stack-2">
          <div class="bar"><div class="bar__fill bar__fill--amber" :style="{ width: (bulk.done / bulk.total * 100) + '%' }" /></div>
          <div class="row between">
            <span class="num note">{{ bulk.done }} / {{ bulk.total }}</span>
            <button class="btn btn--danger btn--sm zh" @click="stopBulk">停止</button>
          </div>
        </div>
        <button v-else class="btn btn--ghost btn--sm zh" :disabled="!settings.hasGeminiKey" @click="pregenerate">
          一次產生全部單字資料
        </button>
      </div>
    </section>

    <!-- ---------- audio ---------- -->
    <section class="card card--pad grp">
      <h2 class="grp__title zh">發音</h2>

      <div v-if="!ttsSupported" class="note zh">這個瀏覽器不支援語音合成。</div>

      <template v-else>
        <div class="field">
          <div class="row between">
            <label class="label" for="rate">語速</label>
            <span class="num val">{{ s.ttsRate.toFixed(2) }}×</span>
          </div>
          <input
            id="rate" class="slider" type="range" min="0.5" max="1.3" step="0.05"
            :value="s.ttsRate" @input="settings.set({ ttsRate: +$event.target.value })"
          >
        </div>

        <div class="field">
          <label class="label" for="voice">語音</label>
          <select id="voice" class="input" :value="s.ttsVoiceURI" @change="settings.set({ ttsVoiceURI: $event.target.value })">
            <option value="">自動選擇最佳</option>
            <option v-for="v in voices" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }} ({{ v.lang }})</option>
          </select>
        </div>

        <div class="row between">
          <label class="label zh" for="auto">字卡自動發音</label>
          <button
            id="auto" class="toggle" :data-on="String(s.autoPlayAudio)"
            :aria-pressed="s.autoPlayAudio"
            @click="settings.set({ autoPlayAudio: !s.autoPlayAudio })"
          />
        </div>

        <button class="btn btn--ghost btn--sm zh" @click="previewVoice">試聽</button>
      </template>
    </section>

    <!-- ---------- article topics ---------- -->
    <section class="card card--pad grp">
      <h2 class="grp__title zh">文章主題</h2>
      <div class="chips">
        <button
          v-for="t in TOPICS" :key="t.key"
          class="pick zh" :class="{ 'pick--on': s.articleTopics.includes(t.key) }"
          @click="toggleTopic(t.key)"
        >{{ t.label }}</button>
      </div>
      <p class="note zh">第一個選中的主題會是每天的預設，其他可以在閱讀頁面隨時切換。</p>
    </section>

    <!-- ---------- appearance ---------- -->
    <section class="card card--pad grp">
      <h2 class="grp__title zh">外觀</h2>
      <div class="seg">
        <button
          v-for="opt in [{ k: 'system', l: '跟隨系統' }, { k: 'light', l: '淺色' }, { k: 'dark', l: '深色' }]"
          :key="opt.k" class="seg__btn zh" :class="{ 'seg__btn--on': s.theme === opt.k }"
          @click="settings.set({ theme: opt.k })"
        >{{ opt.l }}</button>
      </div>

      <div class="row between">
        <label class="label zh">顯示下次複習時間</label>
        <button class="toggle" :data-on="String(s.showIntervalHints)" :aria-pressed="s.showIntervalHints"
          @click="settings.set({ showIntervalHints: !s.showIntervalHints })" />
      </div>
    </section>

    <!-- ---------- account & data ---------- -->
    <section class="card card--pad grp">
      <h2 class="grp__title zh">帳號與資料</h2>

      <div class="kv">
        <span class="label">帳號</span>
        <span class="kv__v">{{ auth.user?.email }}</span>
      </div>
      <div class="kv">
        <span class="label zh">已學單字</span>
        <span class="kv__v num">{{ progress.stats.seen }}</span>
      </div>
      <div class="kv">
        <span class="label zh">待同步</span>
        <span class="kv__v num">{{ progress.syncing ? '同步中…' : '已同步' }}</span>
      </div>

      <div class="row row-2 wrap">
        <button class="btn btn--ghost btn--sm zh" @click="exportJson">匯出備份 JSON</button>
        <button class="btn btn--ghost btn--sm zh" @click="progress.flush()">立即同步</button>
        <RouterLink to="/setup" class="btn btn--ghost btn--sm zh">重做分級測驗</RouterLink>
      </div>

      <div class="hr" />

      <button class="btn btn--ghost btn--block zh" @click="signOut">登出</button>
      <button class="btn btn--danger btn--block zh" @click="hardReset">清空所有進度</button>
    </section>

    <p class="foot zh">NGSL Learner · 2801 words · 30 grammar points</p>
  </main>
</template>

<style scoped>
.set { display: flex; flex-direction: column; gap: var(--sp-4); }
.set__head { display: flex; flex-direction: column; gap: 3px; margin-bottom: var(--sp-1); }

.grp { display: flex; flex-direction: column; gap: var(--sp-4); }
.grp__title { font-size: var(--step-0); font-weight: 700; letter-spacing: -0.01em; }

.val { font-size: var(--step-0); color: var(--jade); }

.effect {
  font-size: var(--step--2);
  line-height: 1.7;
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  border-left: 3px solid;
}
.effect strong { font-weight: 700; }
.effect--now { color: var(--jade); background: var(--jade-wash); border-color: var(--jade); }
.effect--later { color: var(--amber); background: var(--amber-wash); border-color: var(--amber); }

.note { font-size: var(--step--2); color: var(--ink-3); line-height: 1.7; }
.note strong { color: var(--jade); }
.note code {
  font-family: var(--font-mono);
  background: var(--surface-2);
  padding: 1px 5px; border-radius: 4px; color: var(--ink-2);
}

.result {
  font-size: var(--step--2);
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  line-height: 1.6;
}
.result--ok { color: var(--jade); background: var(--jade-wash); }
.result--no { color: var(--rose); background: var(--rose-wash); }

.chips { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.pick {
  padding: 7px 15px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--rule-strong);
  background: var(--surface);
  font-size: var(--step--1);
  color: var(--ink-2);
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.pick--on { background: var(--jade); border-color: var(--jade); color: var(--surface); font-weight: 600; }

.seg {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 3px; padding: 3px;
  background: var(--surface-2); border-radius: var(--radius);
}
.seg__btn {
  padding: 9px 4px; border-radius: 9px;
  font-size: var(--step--1); font-weight: 600; color: var(--ink-3);
  transition: background 0.15s, color 0.15s;
}
.seg__btn--on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); }

.kv { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); }
.kv__v { font-size: var(--step--1); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; }

.foot {
  text-align: center;
  font-size: var(--step--2);
  color: var(--ink-3);
  padding: var(--sp-4) 0 var(--sp-6);
}
</style>
