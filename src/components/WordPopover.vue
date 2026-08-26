<script setup>
import { computed } from 'vue'
import AudioButton from './AudioButton.vue'

/**
 * The little card that appears when a word in an article is tapped.
 *
 * Positioned against the tapped word and clamped to the viewport, because on a
 * 390px screen an anchored popover that runs off the edge is worse than no
 * popover at all.
 */

const props = defineProps({
  word: { type: Object, default: null },
  rect: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})
defineEmits(['close'])

const WIDTH = 300

const style = computed(() => {
  if (!props.rect) return {}
  const vw = window.innerWidth
  const vh = window.innerHeight
  const w = Math.min(WIDTH, vw - 24)

  let left = props.rect.left + (props.rect.right - props.rect.left) / 2 - w / 2
  left = Math.max(12, Math.min(left, vw - w - 12))

  // Prefer below the word; flip above when there is not enough room.
  const below = vh - props.rect.bottom
  const placeAbove = below < 220 && props.rect.top > below

  return placeAbove
    ? { left: `${left}px`, bottom: `${vh - props.rect.top + 8}px`, width: `${w}px` }
    : { left: `${left}px`, top: `${props.rect.bottom + 8}px`, width: `${w}px` }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="word" class="pop-scrim" @click="$emit('close')">
        <div class="pop" :style="style" @click.stop>
          <header class="pop__top">
            <span class="pop__word">{{ word.headword }}</span>
            <AudioButton :text="word.headword" size="sm" />
            <button class="pop__x" aria-label="關閉" @click="$emit('close')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </header>

          <p v-if="word.ipa" class="pop__ipa num">{{ word.ipa }}</p>

          <p v-if="loading" class="pop__wait zh">正在產生這個字的資料…</p>

          <template v-else>
            <ul v-if="word.meanings?.length" class="pop__means">
              <li v-for="(m, i) in word.meanings" :key="i" class="pop__mean">
                <span class="pop__pos">{{ m.pos }}</span>
                <span class="zh">{{ m.zh }}</span>
              </li>
            </ul>
            <p v-else class="pop__wait zh">這個字還沒有翻譯資料</p>

            <div v-if="word.examples?.length" class="pop__ex">
              <div class="pop__exrow">
                <p class="pop__exen">{{ word.examples[0].en }}</p>
                <AudioButton :text="word.examples[0].en" size="sm" />
              </div>
              <p class="pop__exzh zh">{{ word.examples[0].zh }}</p>
            </div>

            <p v-if="word.confusables?.length" class="pop__conf zh">
              易混：<strong>{{ word.confusables[0].word }}</strong> — {{ word.confusables[0].diff }}
            </p>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.pop-scrim { position: fixed; inset: 0; z-index: 400; background: transparent; }

.pop {
  position: fixed;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--jade);
  border-radius: var(--radius);
  box-shadow: var(--shadow-3);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: var(--sp-2);
  max-height: 62vh;
  overflow-y: auto;
}

.pop__top { display: flex; align-items: center; gap: var(--sp-2); }
.pop__word { flex: 1; font-family: var(--font-word); font-size: var(--step-1); font-weight: 600; }
.pop__x { width: 26px; height: 26px; display: grid; place-items: center; color: var(--ink-3); border-radius: 50%; }
.pop__x svg { width: 14px; height: 14px; }

.pop__ipa { font-size: var(--step--2); color: var(--ink-2); margin-top: -4px; }
.pop__wait { font-size: var(--step--2); color: var(--ink-3); }

.pop__means { display: flex; flex-direction: column; gap: 4px; }
.pop__mean { display: flex; align-items: baseline; gap: var(--sp-2); font-size: var(--step--1); }
.pop__pos {
  font-family: var(--font-mono); font-size: 10px; color: var(--jade);
  background: var(--jade-wash); padding: 1px 6px; border-radius: 4px; flex-shrink: 0;
}

.pop__ex {
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  padding: var(--sp-2);
  display: flex; flex-direction: column; gap: 2px;
}
.pop__exrow { display: flex; align-items: flex-start; gap: var(--sp-2); }
.pop__exen { flex: 1; font-family: var(--font-word); font-size: var(--step--1); line-height: 1.5; }
.pop__exzh { font-size: var(--step--2); color: var(--ink-2); }

.pop__conf {
  font-size: var(--step--2); color: var(--amber);
  background: var(--amber-wash); border-radius: var(--radius-sm);
  padding: var(--sp-2); line-height: 1.6;
}
.pop__conf strong { font-family: var(--font-word); }
</style>
