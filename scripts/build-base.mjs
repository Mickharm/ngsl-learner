/**
 * Turn NGSL_2801_full.csv into src/data/words.base.json.
 *
 * The base file carries only what the CSV knows: rank, band, headword and the
 * inflected family. Translations / IPA / examples arrive later, either from
 * generate-words.mjs or on demand inside the app.
 *
 *   node scripts/build-base.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const CSV = resolve(here, 'NGSL_2801_full.csv')
const OUT = resolve(here, '../src/data/words.base.json')

/** Minimal RFC4180 splitter — enough for this file, and correct for quoted commas. */
function splitCsvLine (line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = false
      } else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

const raw = readFileSync(CSV, 'utf8').replace(/^﻿/, '')
const lines = raw.split(/\r?\n/).filter(l => l.trim().length)
const header = splitCsvLine(lines[0]).map(h => h.trim())

const col = name => {
  const i = header.indexOf(name)
  if (i < 0) throw new Error(`CSV is missing the "${name}" column. Found: ${header.join(', ')}`)
  return i
}

const iRank = col('rank')
const iBand = col('band')
const iHead = col('headword')
const iFam = col('word_family')

const words = []
const seen = new Set()

for (let n = 1; n < lines.length; n++) {
  const cells = splitCsvLine(lines[n])
  const rank = Number(cells[iRank])
  const headword = (cells[iHead] || '').trim()
  if (!Number.isFinite(rank) || !headword) continue
  if (seen.has(rank)) continue
  seen.add(rank)

  // "B1 (1-1000)" → "B1"
  const band = (cells[iBand] || '').trim().split(/\s+/)[0] || 'B1'

  const family = (cells[iFam] || '')
    .split('|')
    .map(s => s.trim())
    .filter(s => s && s.toLowerCase() !== headword.toLowerCase())

  words.push({ id: rank, h: headword, b: band, f: family })
}

words.sort((a, b) => a.id - b.id)
writeFileSync(OUT, JSON.stringify(words), 'utf8')

const byBand = words.reduce((acc, w) => { acc[w.b] = (acc[w.b] || 0) + 1; return acc }, {})
console.log(`✓ ${OUT}`)
console.log(`  ${words.length} words —`, Object.entries(byBand).map(([k, v]) => `${k}:${v}`).join('  '))
console.log(`  ${(JSON.stringify(words).length / 1024).toFixed(1)} KB`)
