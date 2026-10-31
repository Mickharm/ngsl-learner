import { computed } from 'vue'
import { useProgress } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { glossOf } from '@/lib/game'

/**
 * Words a game may use: ones the learner has met and that have a Chinese
 * gloss — a game on unseen words is a guessing game. When fewer than `min`
 * are available (a brand-new learner), it tops up with the most frequent
 * enriched words, so the game still runs and the learner is told why.
 */
export function useGamePool (min = 12) {
  const progress = useProgress()
  const words = useWords()

  const met = computed(() => {
    const ids = [...progress.cards.values()].filter(c => c.state !== 'new').map(c => c.wordId)
    return words.getMany(ids).filter(w => glossOf(w))
  })

  const pool = computed(() => {
    if (met.value.length >= min) return met.value
    const have = new Set(met.value.map(w => w.id))
    const extra = [...words.enriched.keys()].sort((a, b) => a - b)
      .filter(id => !have.has(id)).map(id => words.get(id)).filter(w => w && glossOf(w))
    return [...met.value, ...extra.slice(0, Math.max(0, 60 - met.value.length))]
  })

  const fromMet = computed(() => met.value.length >= min)
  return { pool, met, fromMet }
}
