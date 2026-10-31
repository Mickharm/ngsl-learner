<script setup>
/**
 * A tense drawn as a picture on a time line — the diagram every American ESL
 * grammar (Azar's included) uses, because "where on the line is the action?"
 * is the question a tense answers. Small variant is used as a tappable option.
 */
defineProps({
  tense: { type: String, required: true },
  small: { type: Boolean, default: false }
})
</script>

<template>
  <svg class="tl" :class="{ 'tl--small': small }" viewBox="0 0 320 96" role="img" :aria-label="tense">
    <!-- axis -->
    <line x1="14" y1="58" x2="300" y2="58" class="tl__axis" />
    <path d="M300 58 l-9 -5 v10 z" class="tl__arrowhead" />
    <line x1="170" y1="20" x2="170" y2="76" class="tl__now" />
    <template v-if="!small">
      <text x="56" y="90" class="tl__lbl">過去</text>
      <text x="170" y="90" class="tl__lbl tl__lbl--now">現在</text>
      <text x="270" y="90" class="tl__lbl">未來</text>
    </template>

    <!-- marks -->
    <g v-if="tense === 'habit'" class="tl__mark">
      <g v-for="x in [52, 92, 132, 210, 250]" :key="x"><path :d="`M${x - 6} ${52} l12 12 M${x + 6} ${52} l-12 12`" /></g>
      <path d="M164 52 l12 12 M176 52 l-12 12" />
    </g>
    <g v-else-if="tense === 'past'" class="tl__mark">
      <path d="M84 46 l20 20 M104 46 l-20 20" class="tl__x" />
    </g>
    <g v-else-if="tense === 'now'" class="tl__mark">
      <path d="M138 58 q8 -14 16 0 t16 0 t16 0 t16 0" class="tl__wave" />
    </g>
    <g v-else-if="tense === 'past-ongoing'" class="tl__mark">
      <path d="M44 58 q8 -14 16 0 t16 0 t16 0 t16 0 t16 0" class="tl__wave" />
      <path d="M86 40 l12 12 M98 40 l-12 12" class="tl__x tl__x--alt" />
    </g>
    <g v-else-if="tense === 'future'" class="tl__mark">
      <path d="M232 46 l20 20 M252 46 l-20 20" class="tl__x" />
    </g>
    <g v-else-if="tense === 'past-now'" class="tl__mark">
      <circle cx="70" cy="58" r="6" class="tl__dot" />
      <line x1="76" y1="58" x2="158" y2="58" class="tl__span" />
      <path d="M166 58 l-12 -7 v14 z" class="tl__dot" />
    </g>
    <g v-else-if="tense === 'past-past'" class="tl__mark">
      <path d="M40 46 l16 16 M56 46 l-16 16" class="tl__x tl__x--alt" />
      <text x="48" y="38" class="tl__num">1</text>
      <path d="M108 46 l16 16 M124 46 l-16 16" class="tl__x" />
      <text x="116" y="38" class="tl__num">2</text>
    </g>
  </svg>
</template>

<style scoped>
.tl { width: 100%; max-width: 360px; height: auto; display: block; color: var(--ink); }
.tl--small { max-width: 150px; }
.tl__axis { stroke: var(--ink-3); stroke-width: 3; stroke-linecap: round; }
.tl__arrowhead { fill: var(--ink-3); }
.tl__now { stroke: var(--jade); stroke-width: 2; stroke-dasharray: 4 4; }
.tl__lbl { font-size: 13px; fill: var(--ink-3); text-anchor: middle; font-family: var(--font-zh); }
.tl__lbl--now { fill: var(--jade); font-weight: 700; }
.tl__mark path, .tl__mark line { fill: none; stroke: var(--role-v); stroke-width: 4; stroke-linecap: round; }
.tl__x--alt { stroke: var(--role-s) !important; }
.tl__wave { stroke-width: 5 !important; }
.tl__span { stroke-width: 6 !important; }
.tl__dot { fill: var(--role-v) !important; stroke: none !important; }
.tl__num { font-size: 13px; fill: var(--ink-2); text-anchor: middle; font-family: var(--font-mono); }
</style>
