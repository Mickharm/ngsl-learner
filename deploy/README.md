# Deployment

The site is served from the `gh-pages` branch (GitHub Pages → Deploy from a
branch). That path needs no special token scope, which is why it is the default
here.

## Deploying

```bash
npm run build
npm run deploy          # force-pushes dist/ to gh-pages
```

`deploy` needs a GitHub token with **Contents: write** on the repo, taken from
`GITHUB_TOKEN` or `~/.ghtok`.

## Switching to GitHub Actions instead

`github-pages-workflow.yml` is a ready-to-use Actions workflow that builds and
deploys on every push to `main`. It is parked here rather than in
`.github/workflows/` because GitHub refuses to accept a workflow file from a
Personal Access Token that lacks the `workflow` scope:

```
refusing to allow a Personal Access Token to create or update
workflow `.github/workflows/deploy.yml` without `workflow` scope
```

To activate it:

1. Grant the token **Workflows: Read and write**
   (github.com/settings/personal-access-tokens → the token → Repository permissions)
2. `mkdir -p .github/workflows && git mv deploy/github-pages-workflow.yml .github/workflows/deploy.yml`
3. Commit and push
4. Repo → Settings → Pages → Source → **GitHub Actions**

After that, `npm run deploy` is no longer needed — pushing to `main` deploys.
