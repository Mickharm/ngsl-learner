#!/usr/bin/env node
/**
 * Bulk-generate word data for all 2801 NGSL entries and upload it to the
 * shared Supabase `word_data` table.
 *
 * The app fills words in on demand, so this script is optional — it exists so
 * you can do the whole list in one overnight pass and then have the app work
 * fully offline from day one.
 *
 * Usage:
 *   GEMINI_API_KEY=...  SUPABASE_KEY=<publishable-or-service-key>  \
 *   node scripts/generate-words.mjs [--from 1] [--to 2801] [--batch 20] [--dry]
 *
 * Notes:
 *  - Resumable. Progress is checkpointed to scripts/.checkpoint.json, so a
 *    Ctrl-C or a crash costs at most one batch.
 *  - With SUPABASE_KEY set it also writes to Supabase (needs a signed-in
 *    session for the anon key, so in practice use the service_role key here,
 *    from a machine you control — never commit it).
 *  - Without SUPABASE_KEY it only writes src/data/words.generated.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const BASE = resolve(here, '../src/data/words.base.json')
const OUT = resolve(here, '../src/data/words.generated.json')
const CHECKPOINT = resolve(here, '.checkpoint.json')

const args = process.argv.slice(2)
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : def
}
const has = name => args.includes(`--${name}`)

const FROM = Number(flag('from', 1))
const TO = Number(flag('to', 2801))
const BATCH = Number(flag('batch', 20))
const DRY = has('dry')

const GEMINI_KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hlwmqtbgpconoclmxwll.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!GEMINI_KEY) {
  console.error('✗ GEMINI_API_KEY is not set.\n  export GEMINI_API_KEY=your-key')
  process.exit(1)
}

const words = JSON.parse(readFileSync(BASE, 'utf8'))
const byId = new Map(words.map(w => [w.id, w]))

let store = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
let checkpoint = existsSync(CHECKPOINT) ? JSON.parse(readFileSync(CHECKPOINT, 'utf8')) : { done: [] }
const done = new Set(checkpoint.done)

const SYSTEM = `你是一位專為台灣工程師設計英文教材的教學設計師。學習者字彙量約 400-500 字、無文法基礎，目標是 TOEIC 600 與旅遊會話。

規則：
1. 所有中文一律使用「繁體中文」，禁止簡體字。
2. 例句難度限制在 CEFR A2-B1，句長 6-14 字，只使用高頻字彙。
3. 例句必須是日常、旅遊或職場能真的用到的句子，不要教科書式的抽象句。
4. meanings 最多 3 個，依常用度排序。
5. examples 提供 2 句。
6. confusables 只在真的容易混淆時填寫，最多 2 個；沒有就給空陣列。
7. ipa 使用美式發音，含前後斜線。
8. mnemonic 只在有真正好記的聯想時填寫，否則留空字串。`

const SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      headword: { type: 'STRING' },
      ipa: { type: 'STRING' },
      meanings: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { pos: { type: 'STRING' }, zh: { type: 'STRING' } }, required: ['pos', 'zh'] }
      },
      examples: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { en: { type: 'STRING' }, zh: { type: 'STRING' } }, required: ['en', 'zh'] }
      },
      confusables: {
        type: 'ARRAY',
        items: { type: 'OBJECT', properties: { word: { type: 'STRING' }, diff: { type: 'STRING' } }, required: ['word', 'diff'] }
      },
      mnemonic: { type: 'STRING' }
    },
    required: ['headword', 'ipa', 'meanings', 'examples']
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function callGemini (headwords, attempt = 1) {
  const list = headwords.map((w, i) => `${i + 1}. ${w}`).join('\n')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: `為以下 ${headwords.length} 個英文單字產生學習資料。務必依原順序輸出同樣數量的項目，headword 與輸入完全一致。\n\n${list}` }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA
        }
      })
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const retryable = res.status === 429 || res.status >= 500
    if (retryable && attempt < 5) {
      const wait = 2000 * Math.pow(2, attempt - 1)
      console.log(`    ↻ ${res.status}, retrying in ${wait / 1000}s (attempt ${attempt + 1}/5)`)
      await sleep(wait)
      return callGemini(headwords, attempt + 1)
    }
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  const text = (json?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('')
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(cleaned)
}

async function pushToSupabase (rows) {
  if (!SUPABASE_KEY || DRY) return
  const res = await fetch(`${SUPABASE_URL}/rest/v1/word_data?on_conflict=id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  })
  if (!res.ok) {
    console.log(`    ⚠ Supabase ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`)
  }
}

const targets = words.filter(w => w.id >= FROM && w.id <= TO && !done.has(w.id))
const batches = Math.ceil(targets.length / BATCH)

console.log(`NGSL word generation`)
console.log(`  range   : ${FROM}–${TO}`)
console.log(`  pending : ${targets.length} words in ${batches} batches of ${BATCH}`)
console.log(`  model   : ${MODEL}`)
console.log(`  supabase: ${SUPABASE_KEY ? 'yes' : 'local file only'}${DRY ? '  (dry run)' : ''}\n`)

const started = Date.now()
let ok = 0
let failed = 0

for (let i = 0; i < targets.length; i += BATCH) {
  const chunk = targets.slice(i, i + BATCH)
  const n = Math.floor(i / BATCH) + 1
  const heads = chunk.map(w => w.h)
  process.stdout.write(`[${String(n).padStart(3)}/${batches}] ${heads[0]}…${heads.at(-1)}  `)

  try {
    const result = DRY ? [] : await callGemini(heads)
    const map = new Map(result.filter(r => r?.headword).map(r => [String(r.headword).toLowerCase(), r]))

    const rows = []
    for (const w of chunk) {
      const r = map.get(w.h.toLowerCase())
      if (!r) { failed++; continue }
      const row = {
        id: w.id,
        headword: w.h,
        band: w.b,
        ipa: r.ipa || '',
        meanings: (r.meanings || []).slice(0, 3),
        examples: (r.examples || []).slice(0, 2),
        confusables: (r.confusables || []).slice(0, 2),
        mnemonic: r.mnemonic || '',
        family: w.f || [],
        source: 'gemini'
      }
      store[w.id] = row
      rows.push(row)
      done.add(w.id)
      ok++
    }

    await pushToSupabase(rows)
    writeFileSync(OUT, JSON.stringify(store), 'utf8')
    writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }), 'utf8')

    const elapsed = (Date.now() - started) / 1000
    const rate = ok / Math.max(1, elapsed)
    const left = Math.round((targets.length - (i + chunk.length)) / Math.max(0.01, rate))
    console.log(`✓ ${rows.length}/${chunk.length}   eta ${Math.floor(left / 60)}m${String(left % 60).padStart(2, '0')}s`)
  } catch (err) {
    failed += chunk.length
    console.log(`✗ ${err.message.slice(0, 120)}`)
    await sleep(3000)
  }

  await sleep(400)  // stay well under the free-tier rate limit
}

console.log(`\ndone — ${ok} written, ${failed} failed`)
console.log(`  ${OUT}`)
if (failed) console.log(`  re-run the same command to retry only the failures`)
