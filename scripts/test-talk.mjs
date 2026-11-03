/**
 * 主題對話: the authored scenarios and the two model calls' guard rails.
 *
 * What must hold whatever the model returns:
 *  - the hint is a starter, never a full sentence (v4's complete example was
 *    copied verbatim — the reason this phase was rebuilt);
 *  - goals_done always has one value per goal, and stays boolean;
 *  - a "fix" identical to what the learner wrote is not shown as a fix;
 *  - rubric scores are integers 0-4, and a "fix" that changes nothing is dropped.
 *
 *   npm run test:talk
 */
import assert from 'node:assert/strict'
import { TALK_TOPICS, TALK_TURNS, TALK_MIN_TURNS, TALK_MAX_CHARS, pickTopic } from '../src/data/talk-topics.js'

let pass = 0
const ok = (c, m) => { assert.ok(c, m); pass++ }
const eq = (a, b, m) => { assert.deepEqual(a, b, m); pass++ }

/* scenarios */
const ids = new Set()
for (const t of TALK_TOPICS) {
  ok(!ids.has(t.id), `unique id ${t.id}`); ids.add(t.id)
  ok(['travel', 'daily', 'work'].includes(t.area), `${t.id} area`)
  ok(t.goals.length === 3 && t.goals.every(g => g.zh && g.en), `${t.id} has three goals`)
  ok(t.opener.en && t.opener.zh, `${t.id} opener`)
  ok(t.frames.length >= 3 && t.frames.every(f => f.includes('…') && f.split(/\s+/).length <= 6), `${t.id} frames are partial starters`)
  ok(t.script.length >= TALK_MIN_TURNS && t.script.length <= TALK_TURNS, `${t.id} script length`)
  ok(t.samples.length >= t.script.length, `${t.id} one sample per learner reply`)
  ok(t.samples.every(s => s.length <= TALK_MAX_CHARS), `${t.id} samples fit the reply cap`)
  ok(t.partner.name && t.partner.role_en && t.partner.role_zh, `${t.id} partner`)
}
ok(TALK_TOPICS.length >= 8, 'enough scenarios to rotate')

/* topic choice */
const a = pickTopic({ day: '2026-11-03', user: 'dai@ngsl.app', areas: ['travel', 'daily', 'work'] })
const b = pickTopic({ day: '2026-11-03', user: 'dai@ngsl.app', areas: ['travel', 'daily', 'work'] })
eq(a.id, b.id, 'same learner, same day, same topic')
ok(pickTopic({ day: '2026-11-03', user: 'x', areas: ['work'] }).area === 'work', 'areas filter')
ok(pickTopic({ day: '2026-11-03', user: 'x', areas: ['news'] }), 'unknown area falls back to all')
const recent = TALK_TOPICS.filter(t => t.area === 'travel').slice(0, 4).map(t => t.id)
ok(!recent.includes(pickTopic({ day: '2026-11-03', user: 'x', areas: ['travel'], recent }).id), 'recent topics avoided while others remain')
const days = new Set(Array.from({ length: 14 }, (_, i) => pickTopic({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, user: 'xin@ngsl.app' }).id))
ok(days.size >= 4, `two weeks rotate through several topics (${days.size})`)
ok(pickTopic({ day: 'd', user: 'u', shift: 1 }).id !== pickTopic({ day: 'd', user: 'u', shift: 0 }).id, 'reroll changes the topic')

/* model calls, through a stubbed fetch */
let next = null
globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(next) }] }, finishReason: 'STOP' }] })
})
const { talkTurn, talkReport } = await import('../src/lib/gemini.js')
const topic = TALK_TOPICS[0]
const call = p => { next = p; return talkTurn({ topic, history: [{ who: 'ai', en: topic.opener.en }], learner: 'I want big latte', turnsLeft: 4, key: 'k', model: 'gemini-x' }) }

let r = await call({ reply_en: 'A large latte? Sure!', reply_zh: '大杯拿鐵？好的！', understood: true, fix: "I'd like a large latte.", note_zh: '點餐用 I\'d like', goals_done: [true], hint_en: 'I would like a muffin and a coffee, please.', end: false })
eq(r.goals_done, [true, false, false], 'goals padded to the goal count')
eq(r.hint_en, '', 'a full-sentence hint is dropped')
ok(r.fix === "I'd like a large latte.", 'a real fix is kept')

r = await call({ reply_en: 'Sure.', reply_zh: '好。', understood: true, fix: 'I want big latte.', note_zh: '', goals_done: [1, 0, 0, 1], hint_en: 'A medium', end: false })
eq(r.fix, '', 'a fix identical to the learner text is not a fix')
eq(r.goals_done, [true, false, false], 'goals truncated and boolean')
eq(r.hint_en, 'A medium …', 'a short starter gains the ellipsis')

r = await call({ reply_en: 'Bye!', reply_zh: '再見！', understood: false, fix: '', note_zh: '', goals_done: 'nope', hint_en: '', end: true })
eq(r.goals_done, [false, false, false], 'malformed goals become all false')
ok(r.end === true && r.understood === false, 'flags pass through')

next = {
  task: 5, vocabulary: -1, accuracy: 2.6, interaction: '3', level: 'C2', summary_zh: '很好',
  strengths: [{ quote: 'A medium, please.', why_zh: '有禮貌' }, { quote: 'x', why_zh: 'y' }, { quote: 'z', why_zh: 'w' }],
  fixes: [{ said: 'I want big latte', better: "I'd like a large latte.", why_zh: '點餐用 I\'d like' }, { said: 'Thanks.', better: 'thanks', why_zh: '一樣' }],
  upgrade: { en: 'Could I get it to go?', zh: '可以外帶嗎？', when_zh: '點完餐時' }
}
const rep = await talkReport({ topic, history: [], key: 'k', model: 'gemini-x' })
eq(rep.scores, { task: 4, vocabulary: 0, accuracy: 3, interaction: 3 }, 'scores clamped to integers 0-4')
eq(rep.level, '', 'an unknown CEFR label is dropped rather than shown')
eq(rep.strengths.length, 2, 'at most two strengths')
eq(rep.fixes.length, 1, 'a fix that changes nothing is dropped')
ok(rep.upgrade?.en, 'upgrade kept')

console.log(`talk: ${pass} checks passed · ${TALK_TOPICS.length} scenarios`)
