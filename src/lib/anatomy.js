/**
 * Word anatomy — how a word is built, for display.
 *
 * Three sources, best first:
 *
 *   1. a curated example from the Word Parts course (morphology.js) —
 *      hand-split, with a meaning for every piece
 *   2. the NGSL derivation graph (affix.json) — base + affix, with a short
 *      list of links whose split is real etymology but misleading for a
 *      learner (hardly ≠ hard + ly) left out
 *   3. spoken syllables (chunks.json) — no meaning, only where the stress is
 *
 * The result is always one of two shapes, and the UI labels them
 * differently, because colour without a legend was exactly the complaint:
 *
 *   { mode: 'parts', tiles: [{ text, kind, ref, gloss, base? }], zh?, pos? }
 *   { mode: 'syllables', tiles: [{ text, stress }] }
 *
 * Pure: the caller hands in the data so Node tests and the app share it.
 */
import { PARTS, BASE_ZH, EXAMPLE_BY_WORD } from '../data/morphology.js'

/** affix.json affix strings → PARTS ids. */
const AFFIX_TO_PART = {
  '-sion': '-tion', '-ition': '-tion', '-ation': '-tion', '-tion': '-tion',
  '-ence': '-ance', '-ance': '-ance', '-ible': '-able', '-able': '-able',
  'co-': 'con-'
}

/**
 * Links in affix.json that are left out of the display: the meaning of the
 * whole is not the sum of the parts, so showing the sum would teach the
 * wrong meaning (hardly = 幾乎不, not 努力地), or the split is a false one.
 */
export const OPAQUE = new Set([
  'hardly', 'nearly', 'highly', 'fairly', 'largely', 'lately', 'shortly',
  'modify', 'classic', 'restore', 'recover', 'resolve', 'disappoint', 'tension',
  'pleasant', 'relative', 'relatively', 'unlikely', 'stranger', 'objective',
  'bloody', 'server', 'variable', 'considerable', 'provision',
  'corporation', 'regardless', 'likely',
  // -y making a noun, not the adjective -y (rain → rainy) the course teaches
  'difficulty', 'delivery', 'discovery', 'recovery'
])

/** Links whose suffix is the homograph with a different job. */
const SUFFIX_OVERRIDE = {
  friendly: '-ly2', lovely: '-ly2', daily: '-ly2', weekly: '-ly2', monthly: '-ly2',
  arrival: '-al2', proposal: '-al2', approval: '-al2', survival: '-al2'
}

export function partInfo (ref) {
  return PARTS[ref] || null
}

export function makeAnatomy ({ base, affix, chunks }) {
  const byId = new Map(base.map(w => [w.id, w]))
  const idByHead = new Map(base.map(w => [w.h.toLowerCase(), w.id]))

  function glossBase (word, lookup) {
    return BASE_ZH[word] || lookup?.(word) || ''
  }

  /** A curated split for a base, so transportation reads trans + port + ation. */
  function curatedTiles (word) {
    const c = EXAMPLE_BY_WORD.get(word)
    return c ? c.tiles.map(t => ({ ...t })) : null
  }

  /** Decompose via the derivation graph; null when there is no usable link. */
  function fromGraph (head, depth = 0) {
    if (depth > 2 || OPAQUE.has(head)) return null
    const id = idByHead.get(head)
    const link = id && affix.links[id]
    if (!link) return null
    const baseWord = byId.get(link.base)?.h?.toLowerCase()
    if (!baseWord) return null

    let ref = AFFIX_TO_PART[link.affix] || link.affix
    if (link.kind === 'suffix') {
      // affix.json records gently/possibly as "-y" (the e was dropped);
      // what the learner sees on the end of the word is -ly.
      if (ref === '-y' && head.endsWith('ly')) ref = '-ly'
      const sfx = ref === '-ly' ? 'ly' : link.affix.replace(/^-/, '')
      ref = SUFFIX_OVERRIDE[head] || ref
      if (!PARTS[ref] || !head.endsWith(sfx)) return null
      const stemText = head.slice(0, head.length - sfx.length)
      if (!stemText) return null
      const inner = stemText === baseWord ? (curatedTiles(baseWord) || fromGraph(baseWord, depth + 1)) : null
      const stemTiles = inner || [{ text: stemText, kind: 'base', ref: baseWord }]
      return [...stemTiles, { text: sfx, kind: 'suffix', ref }]
    }
    // prefix
    const pfx = link.affix.replace(/-$/, '')
    if (!PARTS[ref] || !head.startsWith(pfx)) return null
    const rest = head.slice(pfx.length)
    if (rest !== baseWord) return null
    const inner = curatedTiles(baseWord) || fromGraph(baseWord, depth + 1)
    return [{ text: pfx, kind: 'prefix', ref }, ...(inner || [{ text: rest, kind: 'base', ref: baseWord }])]
  }

  /**
   * @param {string} headword
   * @param {(word:string)=>string} [lookup] gloss for a base word the
   *        bundled table does not cover (the app passes the enriched gloss)
   */
  function anatomy (headword, lookup) {
    const head = String(headword || '').toLowerCase()
    if (!head) return null

    const curated = EXAMPLE_BY_WORD.get(head)
    if (curated) {
      return {
        mode: 'parts',
        source: 'course',
        unit: curated.unit,
        zh: curated.zh,
        pos: curated.pos,
        tiles: curated.tiles.map(t => decorate(t, lookup))
      }
    }

    const graph = fromGraph(head)
    if (graph && graph.length >= 2) {
      return { mode: 'parts', source: 'graph', tiles: graph.map(t => decorate(t, lookup)) }
    }

    const ch = chunks?.[head]
    if (ch && ch.c.length >= 2) {
      return { mode: 'syllables', tiles: ch.c.map((text, i) => ({ text, stress: i === ch.s })) }
    }
    return { mode: 'whole', tiles: [{ text: head, stress: true }] }
  }

  function decorate (t, lookup) {
    if (t.kind === 'base') {
      const shown = t.text
      return { ...t, gloss: glossBase(t.ref, lookup), base: shown !== t.ref ? t.ref : null }
    }
    if (t.kind === 'link') return { ...t, gloss: '' }
    const p = PARTS[t.ref]
    return { ...t, gloss: p?.zh || '', label: p?.label || t.text, pos: p?.pos || null }
  }

  return { anatomy, fromGraph }
}

/** A one-line reading of a parts anatomy: "un- 不 + happy 快樂的". */
export function formulaOf (an) {
  if (!an || an.mode !== 'parts') return ''
  return an.tiles.filter(t => t.kind !== 'link').map(t => `${t.kind === 'base' ? (t.base || t.text) : t.label} ${t.gloss}`.trim()).join(' + ')
}
