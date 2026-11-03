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
import { TALK_TOPICS, TALK_BY_ID, TALK_TURNS, TALK_MIN_TURNS, TALK_MAX_CHARS, planTalk, upgradeHistory } from '../src/data/talk-topics.js'

let pass = 0
const ok = (c, m) => { assert.ok(c, m); pass++ }
const eq = (a, b, m) => { assert.deepEqual(a, b, m); pass++ }

/* scenarios */
const ids = new Set()
for (const t of TALK_TOPICS) {
  ok(!ids.has(t.id), `unique id ${t.id}`); ids.add(t.id)
  ok(['travel', 'daily', 'work', 'tech'].includes(t.area), `${t.id} area`)
  ok(t.twists.length === 2 && t.twists.every(x => x.zh && x.en), `${t.id} has two twists`)
  ok(t.goals.length === 3 && t.goals.every(g => g.zh && g.en), `${t.id} has three goals`)
  ok(t.opener.en && t.opener.zh, `${t.id} opener`)
  ok(t.frames.length >= 3 && t.frames.every(f => f.includes('…') && f.split(/\s+/).length <= 6), `${t.id} frames are partial starters`)
  ok(t.script.length >= TALK_MIN_TURNS && t.script.length <= TALK_TURNS, `${t.id} script length`)
  ok(t.samples.length >= t.script.length, `${t.id} one sample per learner reply`)
  ok(t.samples.every(s => s.length <= TALK_MAX_CHARS), `${t.id} samples fit the reply cap`)
  ok(t.partner.name && t.partner.role_en && t.partner.role_zh, `${t.id} partner`)
}
ok(TALK_TOPICS.length >= 30, 'enough scenarios to rotate')

/* rotation: new first, a week-later repeat with a twist, then least recent */
const AREAS = ['travel', 'daily', 'work']
const pick = (o = {}) => planTalk({ day: '2026-11-03', user: 'dai@ngsl.app', areas: AREAS, ...o })
eq(pick().topic.id, pick().topic.id, 'same learner, same day, same topic')
ok(pick({ areas: ['work'] }).topic.area !== 'travel', 'areas filter')
ok(['work', 'tech'].includes(pick({ areas: ['work'] }).topic.area), '職場 brings the tech scenarios in')
ok(pick({ areas: ['news'] }).topic, 'unknown area falls back to all')
ok(pick({ shift: 1 }).topic.id !== pick({ shift: 0 }).topic.id, 'reroll changes the topic')

// simulate every other day for 120 days with no repeats taken; nothing repeats
// before the whole pool has been met
let hist = []
const seen = []
for (let d = 0; d < 120; d += 2) {
  const day = new Date(Date.UTC(2026, 10, 1) + d * 864e5).toISOString().slice(0, 10)
  const p = planTalk({ day, user: 'xin@ngsl.app', areas: AREAS, history: hist })
  hist.push({ id: p.topic.id, day, twist: p.twist, total: 8, repeat: !!p.repeatOf, of: p.repeatOf?.day })
  seen.push(p)
}
const firsts = seen.filter(p => !p.repeatOf).map(p => p.topic.id)
const poolSize = TALK_TOPICS.filter(t => AREAS.includes(t.area) || t.area === 'tech').length
ok(new Set(firsts.slice(0, poolSize)).size === Math.min(poolSize, firsts.slice(0, poolSize).length), 'no first meeting repeats before the pool is used up')
const repeats = seen.filter(p => p.repeatOf)
ok(repeats.length > 0, `some scenarios come back (${repeats.length} of ${seen.length} days)`)
ok(repeats.every(p => p.twist >= 0 && p.topic.twists[p.twist]), 'a returning scenario brings a twist')
ok(hist.filter(e => e.repeat).every(e => {
  const gap = (Date.parse(e.day) - Date.parse(e.of)) / 864e5
  return gap >= 6 && gap <= 10
}), 'repeats land 6-10 days after the first meeting')
const repeatCount = new Map()
for (const e of hist.filter(x => x.repeat)) repeatCount.set(`${e.id}|${e.of}`, (repeatCount.get(`${e.id}|${e.of}`) || 0) + 1)
ok([...repeatCount.values()].every(n => n === 1), 'each meeting is repeated at most once')
ok(new Set(seen.map(p => p.topic.id + ':' + p.twist)).size >= 40, `variety over four months (${new Set(seen.map(p => p.topic.id + ':' + p.twist)).size} distinct talks)`)

// the repeat is skipped when the learner asks for another scenario
const one = [{ id: 'cafe', day: '2026-10-27', twist: -1, total: 6 }]
const due = planTalk({ day: '2026-11-03', user: 'u', areas: AREAS, history: one })
ok(due.topic.id === 'cafe' && due.repeatOf?.day === '2026-10-27', 'a scenario met 7 days ago comes back')
ok(planTalk({ day: '2026-11-03', user: 'u', areas: AREAS, history: one, shift: 1 }).repeatOf === null, '換一個情境 skips the repeat')
ok(planTalk({ day: '2026-11-20', user: 'u', areas: AREAS, history: one }).repeatOf === null, 'too late (24 days) is a new scenario instead')
eq(upgradeHistory(['cafe', 'hotel']).map(e => e.id), ['cafe', 'hotel'], 'v5.0 id lists still count as met')
ok(TALK_BY_ID.airport.twists.length === 2, 'twists attached by id')
ok(planTalk({ day: '2026-11-03', user: 'u', areas: AREAS, history: [{ ...one[0], total: 14 }] }).repeatOf === null, 'a talk that went well is not repeated')
ok(planTalk({ day: '2026-11-03', user: 'u', areas: AREAS, history: [{ ...one[0], total: null }] }).repeatOf?.day === '2026-10-27', 'an unscored (offline) talk is repeated')

/* model calls, through a stubbed fetch */
let next = null
globalThis.fetch = async () => ({
  ok: true, status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(next) }] }, finishReason: 'STOP' }] })
})
const { talkTurn, talkReport, normalizeTalkTopic } = await import('../src/lib/gemini.js')
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

/* question starters survive; full sentences do not */
r = await call({ reply_en: 'Sure.', reply_zh: '好。', understood: true, fix: '', note_zh: '', goals_done: [true, true, false], hint_en: 'Do you have …?', end: false })
eq(r.hint_en, 'Do you have …?', 'a question starter with an ellipsis is kept')
r = await call({ reply_en: 'Sure.', reply_zh: '好。', understood: true, fix: '', note_zh: '', goals_done: [true, true, false], hint_en: 'Do you have any muffins?', end: false })
eq(r.hint_en, '', 'a full question is dropped')

/* 自己出題 */
const built = normalizeTalkTopic({
  title: '藥妝店', scene_zh: '你在藥妝店找防曬乳。', partner_name: 'Yuki Tanaka', partner_role_en: 'shop staff', partner_role_zh: '店員',
  goals: [{ zh: '問防曬乳在哪', en: 'ask where sunscreen is' }, { zh: '問有沒有小瓶', en: 'ask for a small one' }, { zh: '問能不能免稅', en: 'ask about tax-free' }],
  opener_en: 'Hello! Can I help you?', opener_zh: '你好！需要幫忙嗎？', frames: ['Where is …?', 'Do you have a smaller one?', 'Can I …?']
}, '藥妝店')
ok(built.custom && built.goals.length === 3 && built.partner.name === 'Yuki', 'a custom scenario is shaped like an authored one')
eq(built.frames, ['Where is …?', 'Can I …?'], 'custom frames that are full sentences are dropped')
assert.throws(() => normalizeTalkTopic({ goals: [{ zh: 'a', en: 'b' }], opener_en: 'Hi', partner_name: 'A' }), /沒有產生成功/); pass++

console.log(`talk: ${pass} checks passed · ${TALK_TOPICS.length} scenarios`)
