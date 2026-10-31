/**
 * Game items for the Word Parts course, generated from the unit data.
 *
 * Five kinds, so a round never collapses into "the same question eight
 * times" — the complaint that sank the old grammar drills:
 *
 *   choice  read the pieces, pick what the whole word means — or what one
 *           piece means. Meaning from form: the skill the unit exists for.
 *   build   see the meaning, build the word from part tiles (with decoys
 *           from the same unit, so the choice is between real parts).
 *   split   the word as bare letters; tap where it breaks into parts.
 *   trap    is that `un` really a prefix? Real examples and imposters
 *           (uncle, really, table) mixed, so cutting is not automatic.
 *   pos     for suffixes: which part of speech does it make? The TOEIC
 *           Part 5 skill, isolated.
 *
 * Every item is seeded: a re-render never reshuffles under a finger.
 */
import { PARTS, familyOf } from '../data/morphology.js'
import { parseParts } from '../data/morphology.js'
import { rng, shuffle } from './game.js'

export const GAME_KINDS = ['choice', 'build', 'split', 'trap', 'pos']

export const POS_ZH = { 'n.': '名詞', 'v.': '動詞', 'adj.': '形容詞', 'adv.': '副詞' }

function examplesOf (unit) {
  return unit.ex.map(([w, spec, zh, pos]) => ({ w, zh, pos, tiles: parseParts(spec) }))
}

function mainPart (unit) { return unit.parts[0] || null }

/** The piece of an example that belongs to the unit — what the item is about. */
function focusTile (unit, ex) {
  const own = new Set(unit.parts)
  return ex.tiles.find(t => own.has(t.ref) || own.has(PARTS[t.ref]?.of)) || null
}

/* ------------------------------------------------------------------ */

/**
 * Discover: before anything is explained, show words that share a part and
 * ask what it means. Same induction move as Grammar Studio.
 */
export function discoverOf (unit, seed = 1) {
  const exs = examplesOf(unit)
  if (unit.discover) {
    const d = unit.discover
    return {
      words: d.words.map(w => exs.find(e => e.w === w)).filter(Boolean),
      focus: null,
      q: d.q,
      options: shuffle(d.options, seed),
      answer: d.answer,
      why: unit.hook
    }
  }
  const part = mainPart(unit)
  if (!part) {
    const words = shuffle(exs, seed).slice(0, 4)
    return {
      words,
      focus: null,
      q: '這幾個字有什麼共同點？',
      options: shuffle(['都是兩個字黏在一起', '都是外來語', '都是動詞', '都是縮寫'], seed + 1),
      answer: '都是兩個字黏在一起',
      why: unit.hook
    }
  }
  const fam = familyOf(part)
  const withPart = exs.filter(e => e.tiles.some(t => familyOf(t.ref) === fam))
  const words = shuffle(withPart, seed).slice(0, 4)
  const answer = PARTS[part].zh
  const others = shuffle(
    [...new Set(Object.values(PARTS).filter(p => p.kind === PARTS[part].kind && p.zh !== answer).map(p => p.zh))],
    seed + 2
  ).slice(0, 3)
  return {
    words,
    focus: part,
    q: `這幾個字都有 ${PARTS[part].label.split(' ')[0]}，它最可能是什麼意思？`,
    options: shuffle([answer, ...others], seed + 3),
    answer,
    why: unit.hook
  }
}

/* ------------------------------------------------------------------ */

function choiceMeaning (unit, ex, exs, seed) {
  const others = shuffle(exs.filter(e => e.w !== ex.w && e.zh !== ex.zh), seed).slice(0, 3).map(e => e.zh)
  return {
    kind: 'choice',
    variant: 'meaning',
    word: ex.w,
    tiles: ex.tiles,
    prompt: '這些零件拼起來是什麼意思？',
    options: shuffle([ex.zh, ...others], seed + 1),
    answer: ex.zh,
    explain: `${ex.w} = ${ex.tiles.filter(t => t.kind !== 'link').map(t => t.text).join(' + ')} → ${ex.zh}`
  }
}

function choicePart (unit, ex, seed) {
  const f = focusTile(unit, ex)
  if (!f) return null
  const p = PARTS[f.ref]
  const answer = p.zh
  const pool = [...new Set(Object.values(PARTS).filter(q => q.kind === p.kind && q.zh !== answer).map(q => q.zh))]
  const options = shuffle([answer, ...shuffle(pool, seed).slice(0, 3)], seed + 1)
  return {
    kind: 'choice',
    variant: 'part',
    word: ex.w,
    tiles: ex.tiles,
    focus: f.ref,
    prompt: `${ex.w}（${ex.zh}）裡的「${f.text}」是什麼意思？`,
    options,
    answer,
    explain: `${p.label} = ${p.zh}${p.more ? '。' + p.more : ''}`
  }
}

function build (unit, ex, exs, seed) {
  const answer = ex.tiles.map(t => t.text)
  const kinds = Object.fromEntries(ex.tiles.map(t => [t.text, t.kind]))
  // Decoys: pieces of other examples in the unit that are not in this word.
  const decoyPool = shuffle(exs.filter(e => e.w !== ex.w).flatMap(e => e.tiles).filter(t => t.kind !== 'link' && !answer.includes(t.text)), seed)
  const decoys = []
  for (const t of decoyPool) {
    if (decoys.length >= Math.max(2, 5 - answer.length)) break
    if (decoys.some(d => d.text === t.text)) continue
    decoys.push(t)
    kinds[t.text] = t.kind
  }
  const bank = shuffle([...new Set([...answer, ...decoys.map(d => d.text)])], seed + 1)
  return {
    kind: 'build',
    word: ex.w,
    zh: ex.zh,
    pos: ex.pos,
    tiles: ex.tiles,
    answer,
    bank,
    kinds,
    prompt: `用零件拼出「${ex.zh}」`,
    explain: `${ex.tiles.filter(t => t.kind !== 'link').map(t => t.text).join(' + ')} = ${ex.w}`
  }
}

function split (unit, ex) {
  if (ex.tiles.some(t => t.kind === 'link')) return null
  const cuts = []
  let at = 0
  for (const t of ex.tiles.slice(0, -1)) { at += t.text.length; cuts.push(at) }
  return {
    kind: 'split',
    word: ex.w,
    zh: ex.zh,
    tiles: ex.tiles,
    cuts,
    prompt: `把 ${ex.w}（${ex.zh}）切成零件`,
    explain: ex.tiles.map(t => t.text).join(' | ')
  }
}

const IS_PART = '是，它是零件'
const NOT_PART = '不是，整個字一起記'

function trap (unit, item, real, seed) {
  if (real) {
    const f = focusTile(unit, item) || item.tiles[0]
    return {
      kind: 'trap',
      word: item.w,
      tiles: item.tiles,
      prompt: `${item.w} 裡的「${f.text}」是可以拆開的零件嗎？`,
      options: [IS_PART, NOT_PART],
      answer: IS_PART,
      explain: `${item.w} = ${item.tiles.map(t => t.text).join(' + ')}，${item.zh}`
    }
  }
  const [w, why] = item
  const part = unit.parts.map(p => PARTS[p]).find(p => {
    const txt = p.label.split(' ')[0].replace(/^-|-$/g, '')
    return p.kind === 'prefix' ? w.startsWith(txt) : w.endsWith(txt)
  })
  const piece = part ? part.label.split(' ')[0].replace(/^-|-$/g, '') : w.slice(0, Math.ceil(w.length / 2))
  return {
    kind: 'trap',
    word: w,
    tiles: null,
    prompt: `${w} 裡的「${piece}」是可以拆開的零件嗎？`,
    options: [IS_PART, NOT_PART],
    answer: NOT_PART,
    explain: why
  }
}

function pos (unit, ex, seed) {
  const last = ex.tiles.at(-1)
  const p = PARTS[last?.ref]
  if (!p || p.kind !== 'suffix' || !POS_ZH[ex.pos]) return null
  const answer = POS_ZH[ex.pos]
  return {
    kind: 'pos',
    word: ex.w,
    tiles: ex.tiles,
    focus: last.ref,
    prompt: `${ex.w} 結尾是 ${p.label.split(' ')[0]}，它是什麼詞性？`,
    options: ['名詞', '動詞', '形容詞', '副詞'],
    answer,
    explain: `${p.label} 會把字變成${POS_ZH[p.pos]}：${ex.w}（${ex.zh}）`
  }
}

/**
 * One practice round for a unit: `n` items, at least three kinds,
 * interleaved so two neighbours are never the same kind or the same word.
 */
export function partsRound (unit, seed = 1, n = 8) {
  const exs = examplesOf(unit)
  const r = rng(seed)
  const pickEx = (() => {
    let order = shuffle(exs, seed)
    let i = 0
    return () => { if (i >= order.length) { order = shuffle(exs, seed + i); i = 0 } return order[i++] }
  })()

  const hasSuffix = unit.parts.some(p => PARTS[p].kind === 'suffix')
  const plan = ['choice', 'build', 'split', hasSuffix ? 'pos' : 'trap', 'choice', 'build', 'trap', 'split', 'choice', 'build']
  const traps = shuffle(unit.traps || [], seed + 7)
  let trapI = 0

  const out = []
  let guard = 0
  for (let k = 0; out.length < n && guard < n * 6; guard++, k++) {
    const kind = plan[k % plan.length]
    const ex = pickEx()
    if (out.some(o => o.word === ex.w)) continue
    let item = null
    const s = seed * 31 + k
    if (kind === 'choice') item = (r() < 0.5 && unit.parts.length) ? choicePart(unit, ex, s) : choiceMeaning(unit, ex, exs, s)
    else if (kind === 'build') item = build(unit, ex, exs, s)
    else if (kind === 'split') item = split(unit, ex)
    else if (kind === 'pos') item = pos(unit, ex, s)
    else if (kind === 'trap') {
      const useTrap = traps.length && trapI < traps.length && r() < 0.6
      item = useTrap ? trap(unit, traps[trapI++], false, s) : trap(unit, ex, true, s)
    }
    if (!item) continue
    if (out.at(-1)?.kind === item.kind) continue
    out.push(item)
  }
  return out
}

/** Did the learner's cut positions match the item's? */
export function cutsMatch (item, cuts) {
  const a = [...new Set(cuts)].sort((x, y) => x - y)
  return a.length === item.cuts.length && a.every((c, i) => c === item.cuts[i])
}

/**
 * A build item from any course example, with decoys from `pool` (other
 * examples). The arcade's 零件積木 uses this across every unit the learner
 * has opened.
 */
export function builderItem (ex, pool, seed = 1) {
  return build(null, ex, pool, seed)
}
