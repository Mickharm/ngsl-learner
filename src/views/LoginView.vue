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
        <p class="brand__kicker kai">每天一頁的</p>
        <h1 class="brand__title"><span class="staff brand__staff">English</span></h1>
        <p class="brand__sub kai">高頻 2801 字，從字的零件學起</p>
      </section>

      <!-- ---------- profile chooser: one exercise book each ---------- -->
      <section v-if="!picked" class="pick">
        <p class="pick__label kai">拿起你的作業簿</p>
        <div class="pick__grid">
          <button
            v-for="p in PROFILES" :key="p.email"
            class="book" :class="`book--${p.accent}`"
            @click="choose(p)"
          >
            <span class="book__spine" aria-hidden="true" />
            <span class="book__title en">English</span>
            <span class="book__label">
              <span class="book__field zh">姓名</span>
              <span class="book__name kai">{{ p.name }}</span>
            </span>
          </button>
        </div>
      </section>

      <!-- ---------- password ---------- -->
      <form v-else class="form card card--pad" @submit.prevent="submit">
        <header v-if="picked" class="who__head">
          <span class="who__chip" :class="`book--${picked.accent}`" aria-hidden="true" />
          <div class="who__meta">
            <div class="who__hi kai">{{ picked.name }} 的作業簿</div>
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
.brand__kicker { font-size: var(--step-1); color: var(--ink-2); }
.brand__title { font-size: clamp(3rem, 16vw, 4.2rem); font-weight: 700; line-height: 1; }
.brand__staff { padding: 0 0.25em; }
.brand__sub { font-size: var(--step-0); color: var(--ink-2); margin-top: var(--sp-2); }

.pick { display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); }
.pick__label { font-size: var(--step-1); color: var(--ink); }
.pick__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); width: 100%; }

/* an exercise-book cover: coloured board, spine tape, white name label */
.book {
  --cover: #d98aa6;
  position: relative; aspect-ratio: 3 / 4.1;
  display: flex; flex-direction: column; align-items: center; justify-content: space-between;
  padding: 16% 10% 12% 16%;
  background: var(--cover);
  border-radius: 3px 8px 8px 3px;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08), 0 12px 20px -14px rgba(0, 0, 0, 0.55);
  transition: transform 0.15s ease;
}
.book:active { transform: translateY(2px) rotate(-1deg); }
.book--pink { --cover: #d98aa6; }
.book--blue { --cover: #7fa7d6; }
.book--yellow { --cover: #e5c25d; }
.book__spine { position: absolute; left: 0; top: 0; bottom: 0; width: 11%; background: rgba(0, 0, 0, 0.18); border-radius: 3px 0 0 3px; }
.book__title { font-family: var(--font-word); font-weight: 700; color: rgba(255, 255, 255, 0.92); font-size: clamp(0.9rem, 4vw, 1.1rem); letter-spacing: 0.02em; }
.book__label { width: 100%; background: #fffdf7; border-radius: 2px; padding: 6px 6px 4px; display: flex; flex-direction: column; align-items: flex-start; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06); }
.book__field { font-size: 0.62rem; color: #8a8f96; }
.book__name { font-size: clamp(1rem, 5vw, 1.3rem); color: #1f2530; font-weight: 700; line-height: 1.15; border-bottom: 1px solid #c9cfd6; width: 100%; text-align: center; padding-bottom: 2px; }

.form { display: flex; flex-direction: column; gap: var(--sp-3); }
.who__head { display: flex; align-items: center; gap: var(--sp-3); padding-bottom: var(--sp-3); border-bottom: 1px dashed var(--rule-strong); }
.who__chip { width: 34px; height: 44px; border-radius: 2px 5px 5px 2px; background: var(--cover); flex-shrink: 0; box-shadow: inset 5px 0 0 rgba(0, 0, 0, 0.18); }
.first { font-size: var(--step--1); line-height: 1.6; color: var(--ink-2); background: var(--hl-yellow); padding: 8px 10px; border-radius: 3px; }
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
