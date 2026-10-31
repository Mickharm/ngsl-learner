/**
 * Surface form → NGSL headword id, as a pure function of the base list.
 *
 * Extracted from the words store so the same resolver runs in the browser
 * (tap any word in a text) and in Node (the story coverage test checks every
 * token of every bundled story against the learner's level with exactly the
 * logic the app uses).
 */

/**
 * Irregular surface forms the NGSL family lists and the suffix rules both miss.
 *
 * The suffix stripper handles -s/-ed/-ing/-ies; it cannot handle "went",
 * "children" or "better". Those are among the most frequent words in any
 * text, so without this table a beginner tapping the commonest words got
 * nothing back at all.
 */
export const IRREGULAR = Object.freeze({
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  went: 'go', gone: 'go', goes: 'go',
  said: 'say', made: 'make', took: 'take', taken: 'take',
  came: 'come', saw: 'see', seen: 'see', knew: 'know', known: 'know',
  got: 'get', gotten: 'get', gave: 'give', given: 'give',
  found: 'find', thought: 'think', told: 'tell', became: 'become',
  left: 'leave', felt: 'feel', put: 'put', brought: 'bring',
  began: 'begin', begun: 'begin', kept: 'keep', held: 'hold',
  wrote: 'write', written: 'write', stood: 'stand', heard: 'hear',
  let: 'let', meant: 'mean', met: 'meet', ran: 'run', paid: 'pay',
  sat: 'sit', spoke: 'speak', spoken: 'speak', lay: 'lie', led: 'lead',
  grew: 'grow', grown: 'grow', lost: 'lose', fell: 'fall', fallen: 'fall',
  sent: 'send', built: 'build', understood: 'understand',
  drew: 'draw', drawn: 'draw', broke: 'break', broken: 'break',
  spent: 'spend', cut: 'cut', rose: 'rise', risen: 'rise',
  driven: 'drive', drove: 'drive', bought: 'buy', wore: 'wear', worn: 'wear',
  chose: 'choose', chosen: 'choose', ate: 'eat', eaten: 'eat',
  sold: 'sell', taught: 'teach', caught: 'catch', flew: 'fly', flown: 'fly',
  fought: 'fight', threw: 'throw', thrown: 'throw', slept: 'sleep',
  won: 'win', laid: 'lay', read: 'read', hit: 'hit', set: 'set', cost: 'cost',
  forgot: 'forget', forgotten: 'forget', woke: 'wake', woken: 'wake',
  shook: 'shake', hung: 'hang', rang: 'ring', sang: 'sing', drank: 'drink',
  swam: 'swim', hid: 'hide', hidden: 'hide', lent: 'lend', fed: 'feed',
  children: 'child', men: 'man', women: 'woman', people: 'person',
  feet: 'foot', teeth: 'tooth', lives: 'life', wives: 'wife',
  knives: 'knife', leaves: 'leaf', halves: 'half', selves: 'self',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: 'much', most: 'much', less: 'little', least: 'little',
  further: 'far', furthest: 'far', farther: 'far', farthest: 'far',
  an: 'a', its: 'it', his: 'he', him: 'he', her: 'she', hers: 'she',
  them: 'they', their: 'they', theirs: 'they', us: 'we', our: 'we', ours: 'we',
  me: 'i', my: 'i', mine: 'i', your: 'you', yours: 'you',
  "won't": 'will', "can't": 'can', "don't": 'do', "didn't": 'do',
  "doesn't": 'do', "isn't": 'be', "aren't": 'be', "wasn't": 'be', "weren't": 'be',
  "couldn't": 'could', "wouldn't": 'would', "shouldn't": 'should', "haven't": 'have',
  "hasn't": 'have', "i'm": 'i', "i've": 'i', "i'll": 'i', "i'd": 'i',
  "you're": 'you', "we're": 'we', "they're": 'they', "it's": 'it', "that's": 'that',
  "there's": 'there', "let's": 'let', "what's": 'what', "he's": 'he', "she's": 'she'
})

/** Build a resolver over the base word list ({ id, h, f }). */
export function makeLookup (base) {
  const idBySurface = new Map()
  for (const w of base) {
    const key = w.h.toLowerCase()
    if (!idBySurface.has(key)) idBySurface.set(key, w.id)
    for (const f of w.f || []) {
      const fk = String(f).toLowerCase()
      if (fk && !idBySurface.has(fk)) idBySurface.set(fk, w.id)
    }
  }

  return function lookup (surface) {
    if (!surface) return null
    const k = String(surface).toLowerCase().replace(/[’]/g, "'").replace(/[^a-z'-]/g, '')
    if (!k) return null
    const direct = idBySurface.get(k)
    const irr = IRREGULAR[k]
    const viaIrr = irr ? idBySurface.get(irr) : undefined
    // "found" is both a headword (#2799, to establish) and the past of find
    // (#~70); "saw", "left", "lay" collide the same way. Prefer the far more
    // frequent reading — a beginner tapping "found" in a story means find.
    if (direct && viaIrr) return Math.min(direct, viaIrr)
    if (direct) return direct
    if (viaIrr) return viaIrr
    // Cheap morphology for forms the family list misses. Deliberately no
    // -er/-ly stripping: "belly → bell", "liver → live" are the plausible-but-
    // false matches that teach nonsense; an unresolved word just gets a gloss.
    for (const strip of ['s', 'es', 'ed', 'ing', "'s"]) {
      if (!k.endsWith(strip)) continue
      const stem = k.slice(0, -strip.length)
      if (idBySurface.has(stem)) return idBySurface.get(stem)
      if (strip === 'ing' || strip === 'ed') {
        if (idBySurface.has(stem + 'e')) return idBySurface.get(stem + 'e')
        // running → run, stopped → stop
        if (stem.length > 2 && stem.at(-1) === stem.at(-2) && idBySurface.has(stem.slice(0, -1))) {
          return idBySurface.get(stem.slice(0, -1))
        }
      }
    }
    if (k.endsWith('ies') && idBySurface.has(k.slice(0, -3) + 'y')) return idBySurface.get(k.slice(0, -3) + 'y')
    return null
  }
}

/** Split running text into word tokens (keeps contractions together). */
export function wordTokens (text) {
  return String(text).match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []
}
