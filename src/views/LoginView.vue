<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { TOTAL_WORDS, PROFILES } from '@/config'
import { DRILL_COUNT } from '@/data/grammar'

/**
 * Two named profiles instead of an email field. Public signup is disabled in
 * Supabase, so there is no reason to make either person remember that "Dai"
 * is spelled dai@ngsl.app — the app knows.
 *
 * The manual form stays available behind a link: it is what the first-run
 * registration uses, and the escape hatch if a third account is ever added.
 *
 * The device also remembers who used it last, so a returning learner lands on
 * their own password box rather than the chooser — and with "記住我" left on,
 * on nothing at all, because the auth store signs them back in before this
 * screen is ever reached.
 */

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const picked = ref(null)          // a PROFILES entry, or null on the chooser
const manual = ref(false)
const mode = ref('signin')        // signin | signup
const email = ref('')
const password = ref('')
const remember = ref(true)
const err = ref('')
const pwField = ref(null)

onMounted(() => {
  const last = auth.lastEmail
  const known = PROFILES.find(p => p.email === last)
  if (known) choose(known, { focus: false })
  else if (last) { manual.value = true; email.value = last }
})

const activeEmail = computed(() =>
  manual.value ? email.value.trim() : (picked.value?.email || '')
)
const activeName = computed(() =>
  manual.value ? email.value.split('@')[0] : (picked.value?.name || '')
)

const canSubmit = computed(() =>
  /.+@.+\..+/.test(activeEmail.value) && password.value.length >= 6 && !auth.busy
)

async function choose (p, { focus = true } = {}) {
  picked.value = p
  manual.value = false
  err.value = ''
  password.value = ''
  await nextTick()
  if (focus) pwField.value?.focus()
}

function back () {
  picked.value = null
  manual.value = false
  password.value = ''
  err.value = ''
}

function openManual () {
  manual.value = true
  picked.value = null
  err.value = ''
}

async function submit () {
  err.value = ''
  try {
    if (mode.value === 'signup') {
      const res = await auth.signUp(activeEmail.value, password.value, activeName.value, { remember: remember.value })
      if (!res.session) {
        toast.info('帳號已建立，請重新登入')
        mode.value = 'signin'
        return
      }
      router.push('/setup')
    } else {
      await auth.signIn(activeEmail.value, password.value, { remember: remember.value })
      if (remember.value && !auth.canRemember) {
        toast.info('這個瀏覽器無法安全保存密碼，下次仍需輸入')
      }
      router.push(route.query.next || '/')
    }
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <main class="login">
    <div v-if="auth.restoring" class="resume">
      <div class="resume__dot" />
      <p class="resume__t zh">正在幫你登入…</p>
    </div>

    <div v-else class="login__inner">
      <section class="brand">
        <div class="brand__mark">
          <span class="brand__n">N</span>
          <span class="brand__g">G</span>
        </div>
        <h1 class="brand__title">NGSL Learner</h1>
        <p class="brand__sub zh">2801 個高頻單字 · 30 個文法點 · 每天一關</p>
      </section>

      <section class="figures">
        <div class="fig">
          <div class="fig__n num">{{ TOTAL_WORDS.toLocaleString() }}</div>
          <div class="fig__l zh">單字</div>
        </div>
        <div class="fig__rule" />
        <div class="fig">
          <div class="fig__n num">30</div>
          <div class="fig__l zh">文法點</div>
        </div>
        <div class="fig__rule" />
        <div class="fig">
          <div class="fig__n num">{{ DRILL_COUNT }}</div>
          <div class="fig__l zh">練習題</div>
        </div>
      </section>

      <!-- ---------- profile chooser ---------- -->
      <section v-if="!picked && !manual" class="pick">
        <p class="pick__label zh">你是誰？</p>
        <div class="pick__grid">
          <button
            v-for="p in PROFILES" :key="p.email"
            class="who" :class="`who--${p.accent}`"
            @click="choose(p)"
          >
            <span class="who__initial">{{ p.name[0] }}</span>
            <span class="who__name">{{ p.name }}</span>
          </button>
        </div>
        <button class="btn btn--quiet btn--sm zh" @click="openManual">用其他帳號登入</button>
      </section>

      <!-- ---------- password / manual form ---------- -->
      <form v-else class="form card card--pad" @submit.prevent="submit">
        <header v-if="picked" class="who__head">
          <span class="who__chip" :class="`who--${picked.accent}`">{{ picked.name[0] }}</span>
          <div class="who__meta">
            <div class="who__hi zh">{{ picked.name }}</div>
            <div class="who__mail">{{ picked.email }}</div>
          </div>
          <button type="button" class="btn btn--quiet btn--sm zh" @click="back">換人</button>
        </header>

        <div v-if="manual" class="field">
          <label class="label" for="email">Email</label>
          <input
            id="email" v-model="email" class="input" type="email"
            autocomplete="email" inputmode="email" autocapitalize="none"
            placeholder="you@example.com" required
          >
        </div>

        <div class="field">
          <label class="label" for="pw">密碼</label>
          <input
            id="pw" ref="pwField" v-model="password" class="input" type="password"
            :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
            placeholder="至少 6 個字元" required minlength="6"
          >
        </div>

        <label class="remember" :class="{ 'remember--off': !auth.canRemember }">
          <button
            type="button" class="toggle" :data-on="String(remember && auth.canRemember)"
            :aria-pressed="remember" :disabled="!auth.canRemember"
            @click="remember = !remember"
          />
          <span class="remember__txt">
            <span class="remember__t zh">在這台裝置記住我</span>
            <span class="remember__d zh">
              {{ auth.canRemember
                ? '下次打開直接進入，不用再輸入密碼。密碼加密後存在這台裝置。'
                : '這個瀏覽器不支援安全保存（無痕模式？），每次仍需輸入密碼。' }}
            </span>
          </span>
        </label>

        <p v-if="err" class="err zh">{{ err }}</p>

        <button class="btn btn--primary btn--block zh" type="submit" :disabled="!canSubmit">
          {{ auth.busy ? '處理中…' : (mode === 'signup' ? '建立帳號' : '進入') }}
        </button>

        <button
          type="button" class="btn btn--quiet btn--sm btn--block zh"
          @click="mode = mode === 'signup' ? 'signin' : 'signup'; err = ''"
        >
          {{ mode === 'signup' ? '← 回到登入' : '第一次使用？建立這個帳號' }}
        </button>

        <button v-if="manual" type="button" class="btn btn--quiet btn--sm btn--block zh" @click="back">
          ← 回到選擇使用者
        </button>
      </form>

      <p class="hint zh">
        進度存在雲端，換手機、換瀏覽器都接得上。兩個帳號的資料完全獨立，只有單字的翻譯與例句是共用的。
      </p>
    </div>
  </main>
</template>

<style scoped>
.login {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: calc(env(safe-area-inset-top) + var(--sp-6)) var(--sp-4) calc(env(safe-area-inset-bottom) + var(--sp-6));
}
.login__inner {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-5);
}

.brand { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.brand__mark {
  display: flex;
  font-family: var(--font-word);
  font-size: 2.6rem;
  font-weight: 600;
  line-height: 1;
  border: 2px solid var(--ink);
  border-radius: var(--radius);
  overflow: hidden;
}
.brand__n { padding: 10px 12px 10px 14px; }
.brand__g { padding: 10px 14px 10px 12px; background: var(--ink); color: var(--paper); }

.brand__title {
  font-family: var(--font-ui);
  font-size: var(--step-2);
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-top: var(--sp-2);
}
.brand__sub { font-size: var(--step--1); color: var(--ink-2); text-align: center; }

.figures { display: flex; align-items: center; justify-content: center; gap: var(--sp-4); }
.fig { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.fig__n { font-size: var(--step-1); color: var(--ink); }
.fig__l { font-size: var(--step--2); color: var(--ink-3); }
.fig__rule { width: 1px; height: 26px; background: var(--rule); }

/* ---- chooser ---- */
.pick { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
.pick__label { font-size: var(--step--1); color: var(--ink-2); font-weight: 600; }
.pick__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); width: 100%; }

.who {
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-2);
  padding: var(--sp-5) var(--sp-3);
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-1);
  transition: transform 0.12s ease, border-color 0.15s, box-shadow 0.15s;
}
.who:active { transform: scale(0.97); }
.who:hover { box-shadow: var(--shadow-2); }

.who__initial {
  width: 54px; height: 54px;
  border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--font-word);
  font-size: var(--step-3);
  font-weight: 600;
  line-height: 1;
}
.who__name { font-size: var(--step-1); font-weight: 700; letter-spacing: -0.01em; }

.who--jade { border-top: 3px solid var(--jade); }
.who--jade .who__initial { background: var(--jade-wash); color: var(--jade); }
.who--violet { border-top: 3px solid var(--violet); }
.who--violet .who__initial { background: var(--violet-wash); color: var(--violet); }

/* ---- form ---- */
.form { display: flex; flex-direction: column; gap: var(--sp-3); }

.who__head {
  display: flex; align-items: center; gap: var(--sp-3);
  padding-bottom: var(--sp-3);
  border-bottom: 1px solid var(--rule);
}
.who__chip {
  width: 38px; height: 38px; border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--font-word); font-size: var(--step-1); font-weight: 600;
  border-top: none !important;
  flex-shrink: 0;
}
.who__chip.who--jade { background: var(--jade-wash); color: var(--jade); }
.who__chip.who--violet { background: var(--violet-wash); color: var(--violet); }
.who__meta { flex: 1; min-width: 0; }
.who__hi { font-size: var(--step-0); font-weight: 700; line-height: 1.2; }
.who__mail {
  font-family: var(--font-mono); font-size: var(--step--2); color: var(--ink-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* ---- remember ---- */
.remember {
  display: flex; align-items: flex-start; gap: var(--sp-3);
  padding: var(--sp-3);
  background: var(--surface-2);
  border-radius: var(--radius);
}
.remember--off { opacity: 0.6; }
.remember__txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.remember__t { font-size: var(--step--1); font-weight: 600; }
.remember__d { font-size: var(--step--2); color: var(--ink-3); line-height: 1.5; }

/* ---- silent re-login ---- */
.resume { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
.resume__dot {
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid var(--rule); border-top-color: var(--jade);
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.resume__t { font-size: var(--step--1); color: var(--ink-2); }

.err {
  font-size: var(--step--1);
  color: var(--rose);
  background: var(--rose-wash);
  border: 1px solid var(--rose-edge);
  border-radius: var(--radius);
  padding: var(--sp-3);
  line-height: 1.6;
}

.hint { font-size: var(--step--2); color: var(--ink-3); line-height: 1.6; text-align: center; }
</style>
