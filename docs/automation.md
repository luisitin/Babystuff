# Automation guide

Two GitHub Actions workflows live in `.github/workflows/`. You do not need to install anything; GitHub runs them for you.

## What each workflow does

**CI (`ci.yml`)** runs on every push and pull request. It builds `index.html` with `node scripts/build.mjs`, fails if the committed `index.html` differs from the fresh build (run the build locally and commit the result to fix it), then runs `node --test`.

**Link check (`link-check.yml`)** runs every Monday and whenever you start it by hand. It visits the `signupUrl` of every program in `data/programs.json`, one at a time with a pause between requests, and writes a report (uploaded as the `link-report` artifact on the run page).

- If any link is NOT-FOUND (404/410 or a "page not found" title) or OFF-DOMAIN (it now redirects to an unexpected site), the run fails (red in the Actions tab) and an issue labeled `link-check` is opened, or a comment is added to the one already open.
- If everything is fine and a `link-check` issue is open, the workflow comments "All links OK" and closes it.
- BLOCKED results (403, bot challenges, timeouts, network errors) are listed in the report but never fail the run. The checker uses one honest User-Agent and never retries with other headers.

## Run the link check by hand

On github.com, or in the GitHub mobile app or phone browser: open the repo, tap **Actions**, choose **Link check** in the workflow list, tap **Run workflow**, pick the branch (`main`), then tap the green **Run workflow** button. Refresh after a minute and open the run to see the result and download the report.

## Email notifications

GitHub emails the repo owner about new issues and about failed workflow runs by default. A new `link-check` issue therefore arrives as an email. To change this, go to github.com > Settings > Notifications (for Actions, see the "System" section; for issues, the repo's Watch menu).

## Run the checker locally

```
node scripts/check-links.mjs --out link-report.md --json link-report.json
node scripts/check-links.mjs --only similac-mysimilac-rewards,pampers-rewards
```

Without `--out` the Markdown report prints to the terminal. The exit code is 1 only when a NOT-FOUND or OFF-DOMAIN entry exists. The full run takes a few minutes because of the 1.5 second pause between requests.

Behind an HTTPS proxy, Node's `fetch` ignores `HTTPS_PROXY` unless you run with `NODE_USE_ENV_PROXY=1` (Node 22.21 or newer):

```
NODE_USE_ENV_PROXY=1 node scripts/check-links.mjs
```

## Blocked sites need a manual look

Many brand sites block automated requests. A BLOCKED entry is not proof the link is broken. Open it in a normal browser; if the page works, nothing to do. If it is really gone, update `data/programs.json` and re-verify the entry.

## Workflows only run from the default branch

Scheduled runs and the "Run workflow" button only exist once the workflow files are merged into the repository's default branch, which should be `main`. Until then, only CI runs (on the branch push or pull request). Check under Settings > General > Default branch.
