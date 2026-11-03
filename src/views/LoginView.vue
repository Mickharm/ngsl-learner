<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { PROFILES } from '@/config'

/**
 * Three named profiles instead of an email field — this instance is for
 * exactly these three people, so nobody has to remember that "Dai" is
 * spelled dai@ngsl.app; the app knows.
 *
 * There is no free-form login and no general sign-up. The only way to create
 * an account is the one-time first-use link on a profile marked `firstUse`
 * (玟廷, added in v4), and that only works while sign-up is still enabled in
 * Supabase; once it is turned off the link fails with a plain message.
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
const mode = ref('signin')        // signin | signup
const password = ref('')
const remember = ref(true)
const err = ref('')
const pwField = ref(null)

onMounted(() => {
  const last = auth.lastEmail
  const known = PROFILES.find(p => p.email === last)
  if (known) choose(known, { focus: false })
})

const activeEmail = computed(() => picked.value?.email || '')
const activeName = computed(() => picked.value?.name || '')

const canSubmit = computed(() =>
  /.+@.+\..+/.test(activeEmail.value) && password.value.length >= 6 && !auth.busy
)

async function choose (p, { focus = true } = {}) {
  picked.value = p
  mode.value = 'signin'
  err.value = ''
  password.value = ''
  await nextTick()
  if (focus) pwField.value?.focus()
}

function back () {
  picked.value = null
  mode.value = 'signin'
  password.value = ''
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
        <p class="brand__kicker">每天一頁的</p>
        <h1 class="brand__title"><span class="staff brand__staff">English</span></h1>
        <p class="brand__sub">高頻 2801 字，從字的零件學起</p>
      </section>

      <!-- ---------- profile chooser: one exercise book each ---------- -->
      <section v-if="!picked" class="pick">
        <p class="pick__label zh">點你的名字</p>
        <div class="pick__grid">
          <button
            v-for="p in PROFILES" :key="p.email"
            class="book" :class="`book--${p.accent}`"
            @click="choose(p)"
          >
            <span class="book__orb" aria-hidden="true">{{ p.name[0] }}</span>
            <span class="book__name">{{ p.name }}</span>
          </button>
        </div>
      </section>

      <!-- ---------- password ---------- -->
      <form v-else class="form card card--pad" @submit.prevent="submit">
        <header v-if="picked" class="who__head">
          <span class="book__orb who__orb" :class="`book--${picked.accent}`" aria-hidden="true">{{ picked.name[0] }}</span>
          <div class="who__meta">
            <div class="who__hi">{{ picked.name }}</div>
            <div class="who__mail">{{ picked.email }}</div>
          </div>
          <button type="button" class="btn btn--quiet btn--sm zh" @click="back">換人</button>
        </header>
        <p v-if="mode === 'signup'" class="first zh">第一次使用：自己設定一組密碼（至少 6 個字），之後就用它登入。建立後會先做一個 5 分鐘的程度測驗。</p>

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
          v-if="picked?.firstUse"
          type="button" class="btn btn--quiet btn--sm btn--block zh"
          @click="mode = mode === 'signup' ? 'signin' : 'signup'; err = ''"
        >
          {{ mode === 'signup' ? '我已經有帳號，回到登入' : '第一次使用？設定密碼、建立帳號' }}
        </button>
      </form>

      <p class="hint zh">
        進度存在雲端，換手機、換瀏覽器都接得上。每個人的進度完全獨立，只有單字的翻譯與例句是共用的。
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

.brand { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
.brand__kicker { font-size: var(--step-0); font-weight: 600; color: var(--ink-2); }
.brand__title { font-size: clamp(3rem, 16vw, 4.2rem); font-weight: 700; line-height: 1; }
.brand__staff { padding: 0 0.25em; }
.brand__sub { font-size: var(--step-0); color: var(--ink-2); margin-top: var(--sp-2); }
.brand__staff { --line: rgba(60, 60, 67, 0.22); }

.pick { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.pick__label { font-size: var(--step-0); font-weight: 600; color: var(--ink-2); }
.pick__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); width: 100%; }

/* a glass tile per learner, lit by an orb in their own colour */
.book {
  --o1: #ff8db8; --o2: #c8a6ff;
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 18px 8px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--rim), var(--shadow-1);
  transition: transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1);
}
.book:active { transform: scale(0.95); }
.book--pink { --o1: #c99599; --o2: #a99aae; }
.book--blue { --o1: #7398a8; --o2: #8ea79a; }
.book--yellow { --o1: #c2a35a; --o2: #b2977a; }
.book__orb {
  width: clamp(56px, 18vw, 72px); aspect-ratio: 1; border-radius: 50%;
  display: grid; place-items: center;
  font-family: var(--font-sys); font-weight: 700; font-size: clamp(1.4rem, 6vw, 1.8rem); color: #fff;
  background: radial-gradient(120% 120% at 30% 18%, rgba(255, 255, 255, 0.35), transparent 45%), linear-gradient(160deg, var(--o1), var(--o2));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -4px 10px rgba(0, 0, 0, 0.06), 0 8px 18px -12px rgba(40, 35, 30, 0.5);
  text-shadow: none;
}
.book__name { font-size: var(--step-0); font-weight: 650; letter-spacing: -0.01em; }

.form { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5); }
.who__head { display: flex; align-items: center; gap: var(--sp-3); padding-bottom: var(--sp-3); box-shadow: inset 0 -0.5px 0 var(--rule); }
.who__orb { width: 48px; font-size: 1.2rem; flex-shrink: 0; }
.first { font-size: var(--step--1); line-height: 1.6; color: var(--ink-2); background: var(--pen-wash); padding: 10px 12px; border-radius: var(--radius); }
.who__meta { flex: 1; min-width: 0; }
.who__hi { font-size: var(--step-1); font-weight: 700; line-height: 1.2; letter-spacing: -0.01em; }
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
  border-radius: var(--radius);
  padding: var(--sp-3);
  line-height: 1.6;
}

.hint { font-size: var(--step--2); color: var(--ink-3); line-height: 1.6; text-align: center; }
</style>
