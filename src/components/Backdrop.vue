<script setup>
/**
 * The scene behind every page, kept to the top of the screen: a pale sky in
 * the learner's colour, a moon, two bands of mist (すやり霞). Below the first
 * third it is plain paper.
 *
 * v5.1 drew far hills down the whole screen so the glass had something to
 * blur, but ridgelines under a paragraph pull the eye and cost legibility.
 * Reading wins: structure only where headers and the first panel sit, and
 * text further down rests on an even field.
 *
 * Fixed and static, painted once; colours are CSS variables.
 */
</script>

<template>
  <div class="bd" aria-hidden="true">
    <svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMin slice">
      <defs>
        <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="bd__sky0" />
          <stop offset="0.42" class="bd__sky1" />
        </linearGradient>
        <linearGradient id="bd-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" class="bd__m0" />
          <stop offset="0.35" class="bd__m1" />
          <stop offset="0.65" class="bd__m1" />
          <stop offset="1" class="bd__m0" />
        </linearGradient>
        <filter id="bd-soft" x="-5%" y="-60%" width="110%" height="220%"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>
      <rect width="400" height="860" fill="url(#bd-sky)" />
      <circle class="bd__moon" cx="318" cy="96" r="44" />
      <rect fill="url(#bd-mist)" filter="url(#bd-soft)" x="-30" y="150" width="270" height="20" rx="10" />
      <rect fill="url(#bd-mist)" filter="url(#bd-soft)" x="190" y="186" width="250" height="14" rx="7" />
    </svg>
  </div>
</template>

<style scoped>
.bd { position: fixed; inset: 0; z-index: -1; pointer-events: none; background: var(--bg); }
.bd svg { width: 100%; height: 100%; display: block; }
.bd__sky0 { stop-color: var(--sky); }
.bd__sky1 { stop-color: var(--bg); }
.bd__moon { fill: var(--moon); }
.bd__m0 { stop-color: var(--mist); stop-opacity: 0; }
.bd__m1 { stop-color: var(--mist); }
</style>
