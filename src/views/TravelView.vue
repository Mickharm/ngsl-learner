<script setup>
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { generateDialogue } from '@/lib/gemini'
import { useSettings } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useToast } from '@/stores/toast'
import AudioButton from '@/components/AudioButton.vue'
import { speak } from '@/lib/tts'

/**
 * Travel roleplay. This is the part of the app aimed at the actual goal —
 * holding a conversation abroad — rather than at the test. Twenty scenes,
 * each generated once and then cached, so it works on a plane.
 */

const SCENES = [
  { key: 'checkin', icon: '🛫', label: '機場報到', prompt: '在機場櫃檯辦理登機報到、託運行李' },
  { key: 'security', icon: '🛂', label: '出入境查驗', prompt: '通過海關與入境審查，回答旅行目的' },
  { key: 'hotel-checkin', icon: '🏨', label: '飯店入住', prompt: '到飯店櫃檯 check in、詢問設施' },
  { key: 'hotel-issue', icon: '🔧', label: '房間有問題', prompt: '房間冷氣壞了 / 沒有熱水，向櫃檯反映' },
  { key: 'restaurant', icon: '🍽️', label: '餐廳點餐', prompt: '在餐廳訂位、點餐、詢問餐點內容' },
  { key: 'allergy', icon: '⚠️', label: '飲食限制', prompt: '告知服務生自己不吃某些食材，詢問替代餐點' },
  { key: 'cafe', icon: '☕', label: '咖啡廳', prompt: '在咖啡廳點飲料、詢問 Wi-Fi 密碼' },
  { key: 'directions', icon: '🗺️', label: '問路', prompt: '在街上向路人問路、確認方向與距離' },
  { key: 'train', icon: '🚆', label: '搭車買票', prompt: '在車站買票、確認月台與班次' },
  { key: 'taxi', icon: '🚕', label: '搭計程車', prompt: '叫車、說明目的地、詢問車資' },
  { key: 'shopping', icon: '🛍️', label: '購物', prompt: '在店裡問尺寸顏色、試穿、結帳' },
  { key: 'bargain', icon: '💰', label: '退換貨', prompt: '拿發票回店裡退貨或換貨' },
  { key: 'pharmacy', icon: '💊', label: '藥局', prompt: '在藥局描述不舒服的症狀、買成藥' },
  { key: 'lost', icon: '🎒', label: '東西掉了', prompt: '行李或錢包遺失，到服務台求助報案' },
  { key: 'sim', icon: '📱', label: '辦網路卡', prompt: '在電信櫃檯辦 SIM 卡或 eSIM、詢問流量' },
  { key: 'atm', icon: '🏧', label: '換匯提款', prompt: '在銀行或匯兌處換錢、詢問手續費' },
  { key: 'tickets', icon: '🎟️', label: '買門票', prompt: '在景點售票口買票、詢問開放時間' },
  { key: 'smalltalk', icon: '💬', label: '閒聊', prompt: '和旅途中認識的人閒聊，介紹自己來自台灣' },
  { key: 'business', icon: '💼', label: '出差會面', prompt: '出差時與海外同事初次見面、簡短自我介紹' },
  { key: 'emergency', icon: '🚨', label: '緊急狀況', prompt: '請人幫忙叫救護車或報警，說明狀況' }
]

const settings = useSettings()
const auth = useAuth()
const words = useWords()
const progress = useProgress()
const toast = useToast()

const active = ref(null)
const dialogue = ref(null)
const loading = ref(false)
const errMsg = ref('')
const showZh = ref(true)
const playing = ref(false)

const recentWords = computed(() =>
  words.getMany([...progress.cards.keys()].slice(-20)).filter(w => w.enriched).slice(0, 10)
)

async function openScene (scene) {
  active.value = scene
  dialogue.value = null
  errMsg.value = ''
  loading.value = true

  try {
    if (auth.userId) {
      const { data } = await supabase.from('dialogues')
        .select('payload').eq('user_id', auth.userId).eq('scene_key', scene.key).maybeSingle()
      if (data?.payload) { dialogue.value = data.payload; loading.value = false; return }
    }

    if (!settings.hasGeminiKey) {
      errMsg.value = '需要 Gemini API Key 才能產生對話。到設定頁面填入後回來。'
      return
    }

    const result = await generateDialogue({
      sceneKey: scene.key,
      sceneLabel: scene.prompt,
      words: recentWords.value,
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    dialogue.value = result

    if (auth.userId) {
      supabase.from('dialogues').upsert({
        user_id: auth.userId, scene_key: scene.key, payload: result
      }, { onConflict: 'user_id,scene_key' }).then(() => {}, () => {})
    }
  } catch (e) {
    errMsg.value = e?.message || '產生對話時發生錯誤'
  } finally {
    loading.value = false
  }
}

async function regenerate () {
  if (!active.value) return
  if (auth.userId) {
    await supabase.from('dialogues').delete()
      .eq('user_id', auth.userId).eq('scene_key', active.value.key)
  }
  openScene(active.value)
}

async function playAll () {
  if (!dialogue.value || playing.value) return
  playing.value = true
  for (const line of dialogue.value.lines) {
    if (!playing.value) break
    await speak(line.en, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
    await new Promise(r => setTimeout(r, 260))
  }
  playing.value = false
}

function close () {
  playing.value = false
  active.value = null
  dialogue.value = null
}
</script>

<template>
  <main class="shell travel">
    <template v-if="!active">
      <header class="travel__head">
        <div class="eyebrow">Roleplay</div>
        <h1 class="page-title zh">旅遊情境會話</h1>
        <p class="travel__sub zh">
          20 個出國真的會用到的場景。每個對話會用上你最近學過的單字，生成一次之後就存起來，沒網路也能看。
        </p>
      </header>

      <div class="scenes">
        <button v-for="s in SCENES" :key="s.key" class="scene" @click="openScene(s)">
          <span class="scene__icon" aria-hidden="true">{{ s.icon }}</span>
          <span class="scene__label zh">{{ s.label }}</span>
        </button>
      </div>
    </template>

    <template v-else>
      <header class="row between">
        <button class="btn btn--quiet btn--sm zh" @click="close">← 所有場景</button>
        <span class="chip chip--plain">{{ active.label }}</span>
      </header>

      <div v-if="loading" class="empty">
        <div class="gate__spinner"><span /><span /><span /></div>
        <p class="zh">正在寫這個場景的對話…</p>
      </div>

      <div v-else-if="errMsg" class="empty">
        <div class="empty__mark">!</div>
        <p class="zh">{{ errMsg }}</p>
        <RouterLink to="/settings" class="btn btn--primary zh">前往設定</RouterLink>
      </div>

      <template v-else-if="dialogue">
        <header class="dlg__head">
          <h2 class="dlg__title zh">{{ dialogue.scene_zh }}</h2>
          <p class="dlg__en">{{ dialogue.scene }}</p>
          <div class="row row-2 wrap">
            <button class="btn btn--ghost btn--sm zh" :disabled="playing" @click="playAll">
              {{ playing ? '播放中…' : '整段朗讀' }}
            </button>
            <button v-if="playing" class="btn btn--danger btn--sm zh" @click="playing = false">停止</button>
            <button class="btn btn--quiet btn--sm zh" @click="showZh = !showZh">
              {{ showZh ? '隱藏中譯' : '顯示中譯' }}
            </button>
            <button class="btn btn--quiet btn--sm zh" @click="regenerate">換一組</button>
          </div>
        </header>

        <div class="lines">
          <div
            v-for="(l, i) in dialogue.lines" :key="i"
            class="line" :class="l.speaker === 'you' ? 'line--you' : 'line--other'"
          >
            <div class="line__bubble">
              <p class="line__en">{{ l.en }}</p>
              <p v-if="showZh" class="line__zh zh">{{ l.zh }}</p>
            </div>
            <AudioButton :text="l.en" size="sm" />
          </div>
        </div>

        <section v-if="dialogue.key_phrases?.length" class="card card--pad stack stack-3">
          <div class="eyebrow">背起來就能用</div>
          <div v-for="(p, i) in dialogue.key_phrases" :key="i" class="kp">
            <div class="kp__row">
              <p class="kp__en">{{ p.en }}</p>
              <AudioButton :text="p.en" size="sm" />
            </div>
            <p class="kp__zh zh">{{ p.zh }}</p>
          </div>
        </section>
      </template>
    </template>
  </main>
</template>

<style scoped>
.travel { display: flex; flex-direction: column; gap: var(--sp-4); }
.travel__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.travel__sub { font-size: var(--step--1); color: var(--ink-2); line-height: 1.7; }

.scenes { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: var(--sp-2); }
.scene {
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--sp-4) var(--sp-2);
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
  transition: border-color 0.15s, transform 0.1s;
}
.scene:active { transform: scale(0.97); background: var(--surface-2); }
.scene__icon { font-size: 1.5rem; line-height: 1; }
.scene__label { font-size: var(--step--2); font-weight: 600; text-align: center; }

.dlg__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.dlg__title { font-size: var(--step-1); font-weight: 700; }
.dlg__en { font-family: var(--font-word); font-size: var(--step--1); color: var(--ink-2); }

.lines { display: flex; flex-direction: column; gap: var(--sp-3); }
.line { display: flex; align-items: flex-end; gap: var(--sp-2); }
.line--you { flex-direction: row-reverse; }

.line__bubble {
  max-width: 82%;
  border-radius: var(--radius-lg);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: 3px;
}
.line--other .line__bubble {
  background: var(--surface-2);
  border: 1px solid var(--rule);
  border-bottom-left-radius: 5px;
}
.line--you .line__bubble {
  background: var(--jade-wash);
  border: 1px solid var(--jade-edge);
  border-bottom-right-radius: 5px;
}
.line__en { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.55; }
.line--you .line__en { color: var(--jade); }
.line__zh { font-size: var(--step--2); color: var(--ink-3); }

.kp { display: flex; flex-direction: column; gap: 2px; padding: var(--sp-2) 0; border-bottom: 1px solid var(--rule); }
.kp:last-child { border-bottom: none; }
.kp__row { display: flex; align-items: center; gap: var(--sp-2); }
.kp__en { flex: 1; font-family: var(--font-word); font-size: var(--step-0); font-weight: 500; }
.kp__zh { font-size: var(--step--2); color: var(--ink-2); }

.gate__spinner { display: flex; gap: 6px; }
.gate__spinner span { width: 8px; height: 8px; border-radius: 50%; background: var(--jade); animation: bounce 1.1s ease-in-out infinite; }
.gate__spinner span:nth-child(2) { animation-delay: 0.14s; }
.gate__spinner span:nth-child(3) { animation-delay: 0.28s; }
@keyframes bounce { 0%,70%,100% { transform: translateY(0); opacity: 0.4; } 35% { transform: translateY(-7px); opacity: 1; } }
</style>
