# Deployment

The site is served from the `gh-pages` branch (GitHub Pages → Deploy from a
branch).

## Normal path: push to `main`

`.github/workflows/deploy.yml` runs on every push to `main`: install, unit
tests, build, then `scripts/deploy-pages.mjs` force-pushes `dist/` to
`gh-pages` using the workflow's own `GITHUB_TOKEN` (Contents: write). Nothing
needs to run on a local machine.

## By hand

```bash
npm run build
npm run deploy          # force-pushes dist/ to gh-pages
DEPLOY_DRY_RUN=1 npm run deploy   # everything except the actual push
```

Auth comes from `GITHUB_TOKEN`, `~/.ghtok`, or — if neither is set — git's
normal credential helper (Git Credential Manager on Windows).

The script no longer copies `dist/` anywhere: git reads it in place through
`--work-tree` with a temporary `--git-dir`. The previous copy step
(`fs.cpSync`) crashed silently on Windows (exit `-1073740791`, 0xC0000409)
when the project path contained non-ASCII characters.

`github-pages-workflow.yml` in this folder is the older artifact-based
workflow, kept for reference; it only works with Pages → Source → GitHub
Actions.
