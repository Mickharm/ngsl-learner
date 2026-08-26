<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useToast } from '@/stores/toast'
import { TOTAL_WORDS } from '@/config'
import { DRILL_COUNT } from '@/data/grammar'

const auth = useAuth()
const router = useRouter()
const route = useRoute()
const toast = useToast()

const mode = ref('signin')
const email = ref('')
const password = ref('')
const name = ref('')
const err = ref('')

const isSignUp = computed(() => mode.value === 'signup')
const canSubmit = computed(() =>
  /.+@.+\..+/.test(email.value) && password.value.length >= 6 && !auth.busy
)

async function submit () {
  err.value = ''
  try {
    if (isSignUp.value) {
      const res = await auth.signUp(email.value.trim(), password.value, name.value.trim())
      if (!res.session) {
        toast.info('註冊成功，請到信箱點擊確認信後再登入')
        mode.value = 'signin'
        return
      }
      router.push('/setup')
    } else {
      await auth.signIn(email.value.trim(), password.value)
      router.push(route.query.next || '/')
    }
  } catch (e) {
    err.value = e.message
  }
}
</script>

<template>
  <main class="login">
    <div class="login__inner">
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

      <form class="form card card--pad" @submit.prevent="submit">
        <div class="switch">
          <button
            type="button" class="switch__btn zh"
            :class="{ 'switch__btn--on': !isSignUp }"
            @click="mode = 'signin'; err = ''"
          >登入</button>
          <button
            type="button" class="switch__btn zh"
            :class="{ 'switch__btn--on': isSignUp }"
            @click="mode = 'signup'; err = ''"
          >註冊</button>
        </div>

        <div v-if="isSignUp" class="field">
          <label class="label" for="name">顯示名稱</label>
          <input id="name" v-model="name" class="input" type="text" autocomplete="nickname" placeholder="Mick">
        </div>

        <div class="field">
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
            id="pw" v-model="password" class="input" type="password"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            placeholder="至少 6 個字元" required minlength="6"
          >
        </div>

        <p v-if="err" class="err zh">{{ err }}</p>

        <button class="btn btn--primary btn--block" type="submit" :disabled="!canSubmit">
          <span class="zh">{{ auth.busy ? '處理中…' : (isSignUp ? '建立帳號' : '登入') }}</span>
        </button>

        <p class="hint zh">
          進度存在雲端，換手機、換瀏覽器都接得上。兩個人各自註冊，資料互不干擾。
        </p>
      </form>
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

.figures {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-4);
}
.fig { display: flex; flex-direction: column; align-items: center; gap: 1px; }
.fig__n { font-size: var(--step-1); color: var(--ink); }
.fig__l { font-size: var(--step--2); color: var(--ink-3); }
.fig__rule { width: 1px; height: 26px; background: var(--rule); }

.form { display: flex; flex-direction: column; gap: var(--sp-4); }

.switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  padding: 3px;
  background: var(--surface-2);
  border-radius: var(--radius);
}
.switch__btn {
  padding: 9px;
  border-radius: 9px;
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--ink-3);
  transition: background 0.15s, color 0.15s;
}
.switch__btn--on { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); }

.err {
  font-size: var(--step--1);
  color: var(--rose);
  background: var(--rose-wash);
  border: 1px solid var(--rose-edge);
  border-radius: var(--radius);
  padding: var(--sp-3);
}

.hint { font-size: var(--step--2); color: var(--ink-3); line-height: 1.6; text-align: center; }
</style>
