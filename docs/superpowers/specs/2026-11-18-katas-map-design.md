# Python Katas Live Map — Design

## Intent

Students fork `alonitac/PythonKatasOz`, solve katas, push, and pass tests. The instructor wants a single
shared game map at https://alonitac.github.io/PythonKatasOz showing **every participant** as a soldier
walking a route of checkpoints, so the course feels like a game. The route grows during the course
(about 5 new katas per week), so the map must grow too: each week is a new "world" that gets discovered.

The project is old and partly broken; it must be revised before going back to students.

### Current state (why a rewrite)

- `docs/index.html` loads all logic, markers and map tiles from another repo
  (`exit-zero-academy/DevOpsTheHardWayAssets`). Markers belong to an older course and list ~25 katas
  that do not exist here.
- The old map reads an `internal/test` branch in each fork that `main.yaml` never writes, so it shows
  no progress for this repo.
- Each student must type their GitHub user and repo; there is no shared view of all students.
- README tells students to pull from `PythonKatasFursa` instead of `PythonKatasOz`.

## Goals

- One shared live map of all participants, updated ~1–2 minutes after a student pushes.
- No personal access token anywhere, and no GitHub API calls from visitors' browsers (classrooms share
  one IP, so the 60 req/h unauthenticated limit would be exhausted).
- Adding a week = adding kata files + one entry in a config file. No drawing, no map editing.
- Modern, game-like look: worlds, checkpoints, fog over undiscovered worlds, soldiers with names on hover.
- Self-contained: no runtime dependency on other repos.

## Non-goals

- Hard cheat-proofing (e.g. hiding tests). Official tests are public in the repo; a student could
  hard-code answers. This is a motivational game, not grading.
- Students writing tests. Only the instructor's official tests count.
- Login / identifying "me" via GitHub auth.
- Historical charts or analytics.

## Anti-goals (failure even if it "works")

- Students needing to enable anything beyond opening one PR.
- The instructor having to do manual work per push (including approving workflow runs).
- Running student code in a context that has write access to the upstream repo.
- A map that needs redrawing every week.

## Approaches considered

**Data collection**

1. *5-minute cron in upstream* polling forks via the built-in `GITHUB_TOKEN`. Simple, but updates lag
   ~5–15 min (scheduled runs are often delayed) and students must enable Actions on their forks.
2. *Fork triggers upstream* (`repository_dispatch`). Impossible without a token: a fork's
   `GITHUB_TOKEN` cannot write to upstream.
3. **Chosen: long-lived PR per student.** Student opens one PR from their fork into upstream `main` and
   leaves it open. Every push to their fork's branch triggers tests in upstream; results feed the map.
   Near-live, no fork Actions needed, joining is explicit. Cost: many open never-merged PRs.
   Merge conflicts do not matter: the workflow reads the student's kata files from the PR head directly
   and never merges. A daily cron is kept as a safety net.

   Trigger choice: GitHub requires maintainer approval for `pull_request` runs from contributors who
   never had anything *merged*, and these PRs are never merged, so `pull_request` would need approval on
   **every push**. Instead use `pull_request_target`, which always runs (no approval) and always uses the
   workflow file from upstream `main` (students cannot edit it). Student code runs only in a job whose
   token is read-only, with no secrets and no caches; a separate job with write permissions consumes only
   the results artifact.

**Map rendering**

1. **Chosen: custom page, no game engine.** Plain HTML/CSS/JS + SVG generates the route and worlds from
   a config file, using CC0 Kenney sprites. Board-game feel, no build step, trivial weekly growth.
2. *Phaser 3 + Tiled tilemaps.* Most game-like, but a tilemap must be authored weekly and the page is
   heavier to maintain.
3. *Keep Leaflet with an image per world.* Closest to the old map, but needs new art weekly and keeps
   the dated look.

## Architecture

```
student fork branch ──PR (opened / synchronize)──► upstream: map.yaml (pull_request_target)
   job `test`    (permissions: contents: read; checks out PR head; runs student code) ─► artifact results.json
   job `collect` (needs: test; write perms; never checks out PR code)
       ├─ validate results, update progress.json on branch `map-data`
       └─ build site (docs/ from main + progress.json) ─► deploy GitHub Pages
map.yaml also runs on: daily schedule, workflow_dispatch, push to main touching docs/** (collect/deploy only)
browser ──► GET progress.json + worlds.json (static, no API)
```

### Config: `docs/worlds.json` (instructor-edited)

Ordered list of worlds. Each world: `id`, `name`, `theme` (e.g. `beach`, `jungle`, `desert`, `snow`,
`lava`, `castle`), `katas` (ordered list of kata module names, e.g. `hello_world`), optional
`required` (katas needed to advance to the next world; default = all). Only published worlds are listed;
the map always draws one extra fogged "???" world after the last one as a teaser.

World 1 = the 5 katas currently in `katas/`: `hello_world`, `backoff_retry`, `circuit_breaker`,
`curcular_buffer`, `round_robin_load_balancer`.

### `map.yaml` job `test` (trigger: `pull_request_target` to `main`, types opened/synchronize/reopened)

- Job-level `permissions: contents: read`; no secrets; no `actions/cache` or setup-python caching
  (avoids cache poisoning of the base branch).
- Kata list comes from `docs/worlds.json` on upstream `main` (the trusted checkout), not from the PR.
- **Tests are the instructor's official tests from upstream `main` only** (`katas/test/test_<kata>.py`).
  Any test files in the student's PR are ignored.
- Checks out upstream `main` (trusted) and the PR head (untrusted, separate directory). For each kata in
  `worlds.json` that has an official test on `main`, copies only `katas/<kata>.py` from the PR head over
  the trusted tree, then runs `python -m unittest katas.test.test_<kata>` with a per-kata timeout (~60s).
  Missing kata file or failing/erroring/timing-out test = not passed. A kata listed in `worlds.json`
  without an official test yet is not counted and is shown as "coming soon" on the map.
- Write `results.json` `{ "passed": [kata, ...] }` and upload as artifact.

### `map.yaml` job `collect`

- Never checks out or executes PR code.
- **Identity comes from the event, not the artifact**: student login =
  `github.event.pull_request.head.repo.owner.login`, PR number from the event. Reject if head repo is not
  a fork of this repo.
- Validate artifact: only kata names present in `worlds.json`, size-capped; anything else ignored.
- Update `progress.json` on branch `map-data`:
  `{ "updated_at", "students": { "<login>": { "passed": [...], "updated_at", "pr": <number|null> } } }`.
  Latest run replaces previous results (a broken test moves the soldier back).
- Concurrency group (`cancel-in-progress: false`) so collect runs are serialized; push with retry.
- Build site artifact = `docs/` from `main` + `progress.json`, deploy with `actions/deploy-pages`
  (Pages source switched to "GitHub Actions"; this also avoids the ~10 builds/hour soft limit of
  branch-based Pages).
- Daily cron: list open PRs (one API call) and re-run tests for PRs with no recent result / drop
  students whose PR was closed — builder decides exact recovery logic.
- Also deploy on `push` to `main` touching `docs/**`, so publishing a new world updates the site.

### Existing `main.yaml`

Removed. Students do not run tests in their forks; `map.yaml` is the only place tests run. Linting
(pylint) moves into job `test` as informational output only (does not affect the map).

## The map page (`docs/index.html`, `docs/map.js`, `docs/map.css`, `docs/assets/`)

- Worlds laid out as a chain of themed islands connected by a winding dotted path; each world has
  5 checkpoints (one per kata) and a flag/castle at its end. Pan by drag, zoom by wheel/pinch; works on
  phones.
- Fogged "???" island after the last published world.
- Soldier position: a student stands in the first world whose `required` count they have not met,
  at the checkpoint index = number of passed katas in that world. Students who finished everything stand
  at the final flag.
- Soldier = GitHub avatar (`https://github.com/<login>.png`, not API-limited) in a small helmet/badge.
  Hover/tap shows login and "N katas passed". Soldiers on the same checkpoint stack with a "+N" badge;
  hovering the stack lists them.
- Hover a checkpoint: kata name and how many students passed it.
- "Find me" box: type a login to highlight and center your soldier; remembered in `localStorage`.
  When the remembered student completed a new world since last visit, show confetti.
- Header: course title, number of participants, last updated time.
- Assets vendored into `docs/assets/` (Kenney CC0 sprites); no external runtime dependencies other than
  possibly the confetti library (vendor it too).

## README changes

- Fix upstream URL to `PythonKatasOz`.
- Remove "write a unittest" and "check Actions in your repo" steps. Students solve kata files, commit,
  push; their soldier moves on the map. They must not edit files under `katas/test/` (ignored anyway).
- New "Join the map" section: open one PR from your fork's `main` into `alonitac/PythonKatasOz:main`,
  title `[map] <your name>`, keep it open forever, never expect a merge.
- Instructor notes (short): adding a world = add katas + entry in `docs/worlds.json`;
  Pages source = GitHub Actions.

## Constraints

- No PAT; only built-in `GITHUB_TOKEN`. Public repo, GitHub Pages.
- Student code runs only in `pull_request` context (read-only).
- Static hosting only.

## Left to the builder

- Exact visual style within the approach (to be shown to the instructor as a mockup before finishing).
- Island layout algorithm, path drawing, choice of Kenney packs.
- Daily cron recovery details.
- Whether job `test` uses one job or a matrix (one job is simpler for producing a single artifact).

## Calls made during design (instructor to check)

- `hello_world` is already solved upstream, so every participant starts with checkpoint 1 done — treated
  as the "tutorial" checkpoint.
- Latest results replace previous ones (a broken test moves a soldier back).
- Progress data lives on a `map-data` branch, and Pages deploys via Actions instead of from `docs/`.
- `main.yaml` is removed (students don't run tests); lint output kept as info only in `map.yaml`.
- World 1 needs official tests for `backoff_retry`, `circuit_breaker`, `curcular_buffer`,
  `round_robin_load_balancer` (instructor writes them); until then they show as "coming soon".
