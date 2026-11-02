import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useProgress } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { useSession } from '@/stores/session'
import { glossOf } from '@/lib/game'

/**
 * Words a game may use: ones the learner has met and that have a Chinese
 * gloss — a game on unseen words is a guessing game. When fewer than `min`
 * are available (a brand-new learner), it tops up with the most frequent
 * enriched words, so the game still runs and the learner is told why.
 *
 * Opened from the day's quest (?phase=1), today's words come first: the
 * game is then a second, spaced retrieval of what was studied an hour ago.
 */
export function useGamePool (min = 12) {
  const progress = useProgress()
  const words = useWords()
  const session = useSession()
  const route = useRoute()

  const inPhase = computed(() => route?.query?.phase === '1')

  const met = computed(() => {
    const ids = [...progress.cards.values()].filter(c => c.state !== 'new').map(c => c.wordId)
    return words.getMany(ids).filter(w => glossOf(w))
  })

  const today = computed(() => inPhase.value ? words.getMany(session.dayWordIds).filter(w => glossOf(w)) : [])

  const pool = computed(() => {
    const seen = new Set()
    const out = []
    for (const w of [...today.value, ...met.value]) if (!seen.has(w.id)) { seen.add(w.id); out.push(w) }
    if (out.length >= min) return out
    const extra = [...words.enriched.keys()].sort((a, b) => a - b)
      .filter(id => !seen.has(id)).map(id => words.get(id)).filter(w => w && glossOf(w))
    return [...out, ...extra.slice(0, Math.max(0, 60 - out.length))]
  })

  /** In the quest, the first `n` picks are today's words (shuffled by the caller). */
  const todayIds = computed(() => new Set(today.value.map(w => w.id)))
  const fromMet = computed(() => met.value.length >= min)
  return { pool, met, today, todayIds, fromMet, inPhase }
}
