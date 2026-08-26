<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import AudioButton from './AudioButton.vue'
import { useSettings } from '@/stores/settings'

const props = defineProps({
  word: { type: Object, required: true },
  revealed: { type: Boolean, default: false },
  showBandTag: { type: Boolean, default: true }
})

const settings = useSettings()
const audio = ref(null)

const bandClass = computed(() => ({
  B1: 'chip--jade', B2: 'chip--violet', B3: 'chip--amber'
}[props.word.band] || 'chip--plain'))

/** Highlight the target word inside its own example sentence. */
function markExample (sentence, headword) {
  if (!sentence || !headword) return sentence
  const stem = headword.length > 4 ? headword.slice(0, Math.ceil(headword.length * 0.7)) : headword
  const re = new RegExp(`\\b(${stem}\\w*)`, 'gi')
  return sentence.replace(re, '<em>$1</em>')
}

async function autoplay () {
  if (!settings.state.autoPlayAudio) return
  await nextTick()
  audio.value?.play()
}

onMounted(autoplay)
watch(() => props.word.id, autoplay)
</script>

<template>
  <article class="wcard">
    <!-- ---------- front ---------- -->
    <header class="wcard__front">
      <div class="wcard__meta">
        <span v-if="showBandTag" class="chip" :class="bandClass">{{ word.band }}</span>
        <span class="chip chip--plain">#{{ word.id }}</span>
      </div>

      <h1 class="wcard__word">{{ word.headword }}</h1>

      <div class="wcard__sound">
        <AudioButton ref="audio" :text="word.headword" size="lg" />
        <span v-if="word.ipa" class="wcard__ipa">{{ word.ipa }}</span>
        <span v-else-if="!word.enriched" class="wcard__ipa dim">音標載入中…</span>
      </div>

      <p v-if="word.family?.length" class="wcard__family">
        <span v-for="f in word.family.slice(0, 6)" :key="f" class="wcard__fam">{{ f }}</span>
      </p>
    </header>

    <!-- ---------- back ---------- -->
    <Transition name="reveal">
      <div v-if="revealed" class="wcard__back">
        <div class="hr" />

        <section v-if="word.meanings?.length" class="wcard__block">
          <ul class="means">
            <li v-for="(m, i) in word.meanings" :key="i" class="mean">
              <span class="mean__pos">{{ m.pos }}</span>
              <span class="mean__zh zh">{{ m.zh }}</span>
            </li>
          </ul>
        </section>
        <p v-else class="dim wcard__pending zh">此單字尚未產生翻譯資料</p>

        <section v-if="word.examples?.length" class="wcard__block stack stack-3">
          <div class="eyebrow">Examples</div>
          <div v-for="(ex, i) in word.examples" :key="i" class="ex">
            <div class="ex__row">
              <p class="ex__en" v-html="markExample(ex.en, word.headword)" />
              <AudioButton :text="ex.en" size="sm" />
            </div>
            <p class="ex__zh zh">{{ ex.zh }}</p>
          </div>
        </section>

        <section v-if="word.confusables?.length" class="wcard__block">
          <div class="confuse">
            <div class="confuse__head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M12 8.5v5M12 16.8v.2" /><circle cx="12" cy="12" r="9" />
              </svg>
              <span class="zh">容易搞混</span>
            </div>
            <div v-for="(c, i) in word.confusables" :key="i" class="confuse__item">
              <div class="confuse__pair">
                <span class="confuse__w">{{ word.headword }}</span>
                <span class="confuse__vs">vs</span>
                <span class="confuse__w">{{ c.word }}</span>
                <AudioButton :text="c.word" size="sm" />
              </div>
              <p class="confuse__diff zh">{{ c.diff }}</p>
            </div>
          </div>
        </section>

        <section v-if="word.mnemonic" class="wcard__block">
          <p class="mnemonic zh"><span class="mnemonic__tag">記法</span>{{ word.mnemonic }}</p>
        </section>
      </div>
    </Transition>
  </article>
</template>

<style scoped>
.wcard {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  overflow: hidden;
  /* An index-card edge: a hairline of accent at the top, nothing else loud. */
  border-top: 3px solid var(--jade);
}

.wcard__front {
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-3);
  text-align: center;
}

.wcard__meta { display: flex; gap: var(--sp-2); }

.wcard__word {
  font-family: var(--font-word);
  font-size: clamp(2.2rem, 12vw, 3.4rem);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.015em;
  word-break: break-word;
  padding: var(--sp-1) 0;
}

.wcard__sound { display: flex; align-items: center; gap: var(--sp-3); }

.wcard__ipa {
  font-family: var(--font-mono);
  font-size: var(--step-0);
  color: var(--ink-2);
  letter-spacing: 0.01em;
}

.wcard__family {
  display: flex; flex-wrap: wrap; justify-content: center; gap: 5px;
  margin-top: var(--sp-1);
}
.wcard__fam {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-3);
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: 2px 7px;
}

.wcard__back { padding: 0 var(--sp-5) var(--sp-5); }
.wcard__block { margin-top: var(--sp-4); }
.wcard__pending { text-align: center; padding: var(--sp-4) 0; font-size: var(--step--1); }

/* meanings */
.means { display: flex; flex-direction: column; gap: var(--sp-2); }
.mean { display: flex; align-items: baseline; gap: var(--sp-3); }
.mean__pos {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--jade);
  background: var(--jade-wash);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  min-width: 42px;
  text-align: center;
}
.mean__zh { font-size: var(--step-1); font-weight: 500; line-height: 1.5; }

/* examples */
.ex {
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: var(--sp-1);
}
.ex__row { display: flex; align-items: flex-start; gap: var(--sp-2); }
.ex__en {
  font-family: var(--font-word);
  font-size: var(--step-1);
  line-height: 1.5;
  flex: 1;
}
.ex__en :deep(em) {
  font-style: normal;
  font-weight: 600;
  color: var(--jade);
  border-bottom: 2px solid var(--jade-edge);
}
.ex__zh { font-size: var(--step--1); color: var(--ink-2); }

/* confusables */
.confuse {
  border: 1px solid var(--amber-edge);
  background: var(--amber-wash);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: var(--sp-3);
}
.confuse__head {
  display: flex; align-items: center; gap: 6px;
  color: var(--amber);
  font-size: var(--step--1);
  font-weight: 700;
}
.confuse__head svg { width: 16px; height: 16px; }
.confuse__item { display: flex; flex-direction: column; gap: var(--sp-1); }
.confuse__pair { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.confuse__w {
  font-family: var(--font-word);
  font-size: var(--step-1);
  font-weight: 600;
}
.confuse__vs {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--ink-3);
}
.confuse__diff { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; }

/* mnemonic */
.mnemonic {
  font-size: var(--step--1);
  color: var(--ink-2);
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3);
  line-height: 1.65;
}
.mnemonic__tag {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  color: var(--violet);
  background: var(--violet-wash);
  padding: 2px 7px;
  border-radius: var(--radius-sm);
  margin-right: var(--sp-2);
}

/* reveal */
.reveal-enter-active { transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.2, 0.8, 0.3, 1); }
.reveal-enter-from { opacity: 0; transform: translateY(-6px); }
</style>
