#!/usr/bin/env node
/**
 * Publish dist/ to the gh-pages branch.
 *
 * GitHub Pages is configured as "deploy from a branch", which needs no
 * `workflow` token scope — see deploy/README.md for why that matters and how
 * to switch to GitHub Actions instead.
 *
 *   npm run build && npm run deploy
 *
 * Auth: a token with Contents:write, from $GITHUB_TOKEN or ~/.ghtok.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync, rmSync, mkdtempSync, cpSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('✗ dist/index.html is missing — run `npm run build` first.')
  process.exit(1)
}

const tokenFile = join(homedir(), '.ghtok')
const token = process.env.GITHUB_TOKEN
  || (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '')

if (!token) {
  console.error('✗ No token. Set GITHUB_TOKEN, or put one in ~/.ghtok (needs Contents: write).')
  process.exit(1)
}

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim()
const match = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/)
if (!match) {
  console.error(`✗ Could not parse an owner/repo out of the origin remote: ${remote}`)
  process.exit(1)
}
const [, owner, repo] = match

const work = mkdtempSync(join(tmpdir(), 'ghp-'))
const run = (args, opts = {}) => execFileSync('git', args, { cwd: work, stdio: 'pipe', ...opts })

try {
  cpSync(DIST, work, { recursive: true })
  // Pages otherwise runs the output through Jekyll and drops files starting with _
  writeFileSync(join(work, '.nojekyll'), '')

  run(['init', '-q', '-b', 'gh-pages'])
  run(['config', 'user.email', 'deploy@localhost'])
  run(['config', 'user.name', 'ngsl-deploy'])
  run(['add', '-A'])

  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()
  run(['commit', '-q', '-m', `Deploy ${sha}`])

  // The token stays in this throwaway clone's config, never in the real repo.
  run(['remote', 'add', 'origin', `https://x-access-token:${token}@github.com/${owner}/${repo}.git`])

  process.stdout.write(`pushing dist/ → ${owner}/${repo}@gh-pages … `)
  run(['push', '-f', 'origin', 'gh-pages'])
  console.log('done')
  console.log(`  https://${owner.toLowerCase()}.github.io/${repo}/`)
  console.log('  Pages usually rebuilds within a minute.')
} catch (err) {
  console.error('\n✗ Deploy failed:', err.stderr?.toString().trim() || err.message)
  process.exitCode = 1
} finally {
  rmSync(work, { recursive: true, force: true })
}
