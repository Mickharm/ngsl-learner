<script setup>
/**
 * The scene behind every page: すやり霞 (long bands of mist), 遠山 (three
 * layers of far hills) and a pale moon, in muted traditional colours.
 *
 * It exists for the glass. A blurred pane only reads as glass when there is
 * structure behind it to blur; over a plain gradient it reads as milky
 * plastic (v5.0's problem). The bands and ridgelines give every panel soft
 * edges sliding behind it as the page scrolls.
 *
 * Fixed and static: it is painted once and never animates, because every
 * glass panel re-samples it each frame and a moving backdrop would cost the
 * whole screen. Colours come from CSS variables, so the learner's tint and
 * dark mode need no second drawing.
 */
</script>

<template>
  <div class="bd" aria-hidden="true">
    <svg viewBox="0 0 400 860" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="bd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="bd__sky0" />
          <stop offset="0.62" class="bd__sky1" />
        </linearGradient>
        <!-- a band of mist thins out at both ends instead of stopping -->
        <linearGradient id="bd-mist" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" class="bd__m0" />
          <stop offset="0.3" class="bd__m1" />
          <stop offset="0.7" class="bd__m1" />
          <stop offset="1" class="bd__m0" />
        </linearGradient>
        <filter id="bd-soft" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="1.6" /></filter>
        <linearGradient id="bd-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff" stop-opacity="0" />
          <stop offset="1" class="bd__sky1" />
        </linearGradient>
      </defs>

      <rect width="400" height="860" fill="url(#bd-sky)" />

      <!-- moon -->
      <circle class="bd__moon" cx="306" cy="148" r="56" />

      <!-- mist bands, upper -->
      <rect class="bd__mist" fill="url(#bd-mist)" filter="url(#bd-soft)" x="-40" y="226" width="250" height="24" rx="12" />
      <rect class="bd__mist" fill="url(#bd-mist)" filter="url(#bd-soft)" x="168" y="262" width="290" height="18" rx="9" />
      <rect class="bd__mist" fill="url(#bd-mist)" filter="url(#bd-soft)" x="-70" y="404" width="300" height="28" rx="14" />
      <rect class="bd__mist" fill="url(#bd-mist)" filter="url(#bd-soft)" x="214" y="444" width="230" height="16" rx="8" />

      <!-- far hills -->
      <path class="bd__h1" d="M0 590 Q44 548 92 566 T188 548 Q236 520 288 552 T400 540 V860 H0 Z" />
      <!-- mist between ridges -->
      <rect class="bd__mist" fill="url(#bd-mist)" filter="url(#bd-soft)" x="30" y="604" width="330" height="22" rx="11" />
      <!-- middle hills -->
      <path class="bd__h2" d="M0 660 Q60 616 128 640 T252 628 Q316 604 400 642 V860 H0 Z" />
      <!-- near hills -->
      <path class="bd__h3" d="M0 732 Q72 700 150 718 T300 706 Q352 698 400 714 V860 H0 Z" />
      <rect class="bd__mist" fill="url(#bd-mist)" filter="url(#bd-soft)" x="-30" y="752" width="260" height="20" rx="10" />
      <rect y="760" width="400" height="100" fill="url(#bd-fade)" />
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
.bd__h1 { fill: var(--hill-1); }
.bd__h2 { fill: var(--hill-2); }
.bd__h3 { fill: var(--hill-3); }
</style>
