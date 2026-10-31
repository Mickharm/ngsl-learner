#!/usr/bin/env node
/**
 * Publish dist/ to the gh-pages branch.
 *
 * GitHub Pages is configured as "deploy from a branch", which needs no
 * `workflow` token scope — see deploy/README.md for why that matters.
 *
 *   npm run build && npm run deploy
 *
 * v3: no copying. The old version copied dist/ into a temp folder with
 * fs.cpSync and died silently on Windows (exit 0xC0000409) when the project
 * path held non-ASCII characters (…\英文學習計畫\…). Now git reads dist/ in
 * place through --work-tree, with a throwaway --git-dir in the temp folder,
 * so no file is copied at all. Every step prints before it runs, and git's
 * own output goes straight to the terminal, so a failure is never silent.
 *
 * Auth: $GITHUB_TOKEN or ~/.ghtok if present; otherwise git's normal
 * credential helper (Git Credential Manager on Windows) is used.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
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
const token = process.env.GITHUB_TOKEN || (existsSync(tokenFile) ? readFileSync(tokenFile, 'utf8').trim() : '')

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim()
const match = remote.match(/github\.com[/:]([^/]+)\/(.+?)(?:\.git)?$/)
if (!match) {
  console.error(`✗ Could not parse an owner/repo out of the origin remote: ${remote}`)
  process.exit(1)
}
const [, owner, repo] = match
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim()

const gitDir = mkdtempSync(join(tmpdir(), 'ghp-'))
const git = (args, inherit = false) => execFileSync('git', ['--git-dir', gitDir, '--work-tree', DIST, ...args], {
  cwd: ROOT,
  stdio: inherit ? 'inherit' : 'pipe',
  encoding: 'utf8'
})
const step = msg => console.log(`· ${msg}`)

try {
  // Pages otherwise runs the output through Jekyll and drops files starting with _
  writeFileSync(join(DIST, '.nojekyll'), '')

  step('init a temporary repository for dist/')
  execFileSync('git', ['init', '-q', '--bare', gitDir], { stdio: 'pipe' })
  git(['config', 'core.bare', 'false'])
  git(['config', 'user.email', 'deploy@localhost'])
  git(['config', 'user.name', 'ngsl-deploy'])
  git(['config', 'core.autocrlf', 'false'])
  git(['symbolic-ref', 'HEAD', 'refs/heads/gh-pages'])

  step('stage the build')
  git(['add', '-A', '.'])
  git(['commit', '-q', '-m', `Deploy ${sha}`])

  const pushUrl = token
    ? `https://x-access-token:${token}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`
  step(`push dist/ → ${owner}/${repo}@gh-pages`)
  const dry = process.env.DEPLOY_DRY_RUN ? ['--dry-run'] : []
  git(['push', '-f', ...dry, pushUrl, 'HEAD:refs/heads/gh-pages'], true)

  console.log(`✓ deployed ${sha}`)
  console.log(`  https://${owner.toLowerCase()}.github.io/${repo}/`)
  console.log('  Pages usually rebuilds within a minute.')
} catch (err) {
  console.error('\n✗ Deploy failed:', err.stderr?.toString().trim() || err.message)
  process.exitCode = 1
} finally {
  rmSync(gitDir, { recursive: true, force: true })
}
