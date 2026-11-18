# Katas Live Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A live, shared game map on GitHub Pages showing every student (one open PR each) as a soldier on a route of weekly "worlds", driven only by the instructor's official tests.

**Architecture:** A `pull_request_target` workflow runs the instructor's tests from `main` against the student's kata files in a read-only job, then a privileged job (never touching PR code) merges results into `progress.json` on a `map-data` branch and deploys Pages (`docs/` + `progress.json`). Python modules under `tools/map/` hold all logic (test running, validation, soldier positions) so it is unit-tested; the page is a static, dependency-free SVG renderer.

**Tech Stack:** Python 3.12 stdlib (`unittest`, `subprocess`, `json`), GitHub Actions (`actions/checkout@v4`, `actions/upload-artifact@v4`, `actions/download-artifact@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`), plain HTML/CSS/JS (ES modules) + SVG.

**Spec:** `docs/superpowers/specs/2026-11-18-katas-map-design.md`

## Global Constraints

- No personal access token; only the built-in `GITHUB_TOKEN`.
- Browser makes zero GitHub API calls; it fetches only `worlds.json` and `progress.json` from the Pages site. Avatars via `https://github.com/<login>.png`.
- Student code runs only in a job with `permissions: contents: read`, no secrets, no caches, `persist-credentials: false`.
- Only official tests on `main` (`katas/test/test_<kata>.py`) count; test files in PRs are ignored.
- Kata and login identifiers must match `^[A-Za-z0-9_-]+$` (logins) / `^[a-z0-9_]+$` (katas); anything else is dropped.
- No runtime dependency on other repos; all page assets live under `docs/`.
- Latest results replace previous ones for a student.

## Review Focus

- A world in `worlds.json` whose katas have no official tests yet must block soldiers at its first checkpoint (not let them walk past) → test `test_position_blocks_at_untested_world` in Task 1.
- A tampered/garbage `results.json` (unknown katas, non-list, huge file, wrong types) must not crash the collector or inject data → tests `test_load_results_*` in Task 2.
- An infinite loop or `input()` in a student's kata must not hang the run → test `test_run_kata_timeout` in Task 2.
- Two students pushing at the same time must not lose either update (Actions concurrency drops older pending runs) → retry-on-push loop in Task 3, verified in Task 6 E2E.
- A student whose PR is closed disappears on the next daily run; publishing a new world moves finished students forward without any student pushing → `test_prune_closed` and `test_recompute_after_new_world` in Task 1.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `docs/worlds.json` | Instructor-edited ordered list of worlds |
| `tools/map/__init__.py` | Package marker |
| `tools/map/progress.py` | Load worlds, compute positions, merge results, prune; CLI |
| `tools/map/run_tests.py` | Run official tests against a student's kata files; CLI |
| `tools/map/tests/test_progress.py`, `tools/map/tests/test_run_tests.py` | Unit tests |
| `.github/workflows/map.yaml` | Test → collect → deploy pipeline |
| `.github/workflows/main.yaml` | Deleted |
| `docs/index.html`, `docs/map.css`, `docs/map.js` | Map page |
| `docs/assets/` | Vendored images (CC0) |
| `docs/sample-progress.json` | Fixture for local preview (`?sample=1`) |
| `README.md` | Student + instructor instructions |

Run all Python tests with: `python3 -m unittest discover -s tools/map/tests -t .`

---

### Task 1: Worlds config and progress logic

**Files:**
- Create: `docs/worlds.json`, `tools/__init__.py`, `tools/map/__init__.py`, `tools/map/progress.py`, `tools/map/tests/__init__.py`, `tools/map/tests/test_progress.py`

**Interfaces:**
- Produces (in `tools/map/progress.py`):
  - `load_worlds(path: str) -> list[dict]` — each dict `{"id": str, "name": str, "theme": str, "katas": list[str], "required": int | None}`; raises `ValueError` on missing keys/bad kata names.
  - `position(worlds: list[dict], tested: set[str], passed: set[str]) -> tuple[int, int]` — `(world_index, checkpoint_index)`.
  - `apply_result(progress: dict, worlds: list[dict], tested: set[str], login: str, pr: int | None, passed: list[str], now: str) -> dict`
  - `recompute(progress: dict, worlds: list[dict], tested: set[str], now: str) -> dict`
  - `prune(progress: dict, open_logins: set[str]) -> dict`
  - CLI: `python3 -m tools.map.progress {apply,recompute,prune} --worlds PATH --progress PATH --katas-dir PATH [--results PATH --login L --pr N] [--open-logins a,b,c]` — reads/writes `--progress` in place (missing file = empty progress); `tested` = katas with `<katas-dir>/test/test_<kata>.py`.
  - `progress.json` schema: `{"updated_at": str, "tested": [str], "students": {login: {"passed": [str], "updated_at": str, "pr": int|null, "world": int, "checkpoint": int}}}`

- [ ] **Step 1: Create `docs/worlds.json`**

```json
{
  "title": "Python Katas — Oz",
  "worlds": [
    {
      "id": "w1",
      "name": "Hello Island",
      "theme": "beach",
      "katas": ["hello_world", "backoff_retry", "circuit_breaker", "curcular_buffer", "round_robin_load_balancer"]
    }
  ]
}
```

`required` is optional per world (default: all its tested katas).

- [ ] **Step 2: Write failing tests in `tools/map/tests/test_progress.py`**

Use two worlds `W = [{"id":"w1","katas":["a","b","c"],"required":None,...}, {"id":"w2","katas":["d","e"],"required":1,...}]`.

```python
def test_position_start(self):            self.assertEqual(position(W, {"a","b","c","d","e"}, set()), (0, 0))
def test_position_mid_world(self):        self.assertEqual(position(W, ALL, {"a","c"}), (0, 2))
def test_position_next_world(self):       self.assertEqual(position(W, ALL, {"a","b","c"}), (1, 0))
def test_position_required_override(self):self.assertEqual(position(W, ALL, {"a","b","c","e"}), (2, 0))  # finished
def test_position_untested_katas_not_required(self):
    self.assertEqual(position(W, {"a","b","d","e"}, {"a","b"}), (1, 0))   # c has no test -> required=2
def test_position_blocks_at_untested_world(self):
    self.assertEqual(position(W, {"a","b","c"}, {"a","b","c"}), (1, 0))   # w2 has 0 tested -> blocks
def test_passed_ignores_untested_and_unknown(self):
    p = apply_result({}, W, {"a"}, "bob", 7, ["a","zzz","b"], "T")
    self.assertEqual(p["students"]["bob"]["passed"], ["a"])
def test_apply_replaces_previous(self):
    p = apply_result({}, W, ALL, "bob", 7, ["a","b"], "T1")
    p = apply_result(p, W, ALL, "bob", 7, ["a"], "T2")
    self.assertEqual((p["students"]["bob"]["passed"], p["students"]["bob"]["checkpoint"]), (["a"], 1))
def test_recompute_after_new_world(self):
    p = apply_result({}, W[:1], set("abc"), "bob", 1, ["a","b","c"], "T")
    self.assertEqual(p["students"]["bob"]["world"], 1)          # finished (only 1 world)
    p = recompute(p, W, ALL, "T2")
    self.assertEqual((p["students"]["bob"]["world"], p["students"]["bob"]["checkpoint"]), (1, 0))
def test_prune_closed(self):
    p = apply_result({}, W, ALL, "bob", 1, [], "T"); p = apply_result(p, W, ALL, "amy", 2, [], "T")
    self.assertEqual(set(prune(p, {"amy"})["students"]), {"amy"})
def test_load_worlds_rejects_bad_kata(self):  # write tmp file with kata "../x" -> ValueError
def test_cli_apply_roundtrip(self):  # tmp dir with katas/test/test_a.py; run main([...]) ; read json; assert bob present
```

- [ ] **Step 3: Run tests, expect FAIL (ImportError)**

Run: `python3 -m unittest discover -s tools/map/tests -t .`

- [ ] **Step 4: Implement `tools/map/progress.py`**

Position rule (the algorithm): for each world `i` in order, `countable = [k for k in katas if k in tested]`; `done = len(passed ∩ countable)`; `need = min(required or len(countable), len(countable))`; if `len(countable) == 0` or `done < need`: return `(i, done)`. After the loop return `(len(worlds), 0)`. `passed` stored in world/kata order. `updated_at` top-level and per-student set to `now`. `main(argv: list[str] | None = None) -> int` with `argparse`; JSON written with `indent=1, sort_keys=True`.

- [ ] **Step 5: Run tests, expect PASS**

- [ ] **Step 6: Commit** — `git add docs/worlds.json tools && git commit -m "feat(map): worlds config and progress logic"`

---

### Task 2: Official test runner and results validation

**Files:**
- Create: `tools/map/run_tests.py`, `tools/map/tests/test_run_tests.py`
- Modify: `tools/map/progress.py` (add `load_results`)

**Interfaces:**
- Consumes: `load_worlds` (Task 1).
- Produces:
  - `run_kata(trusted_root: str, student_root: str, kata: str, timeout: float = 60) -> bool` — copies `student_root/katas/<kata>.py` over `trusted_root/katas/<kata>.py` (missing → `False`), runs `sys.executable -m unittest katas.test.test_<kata>` with `cwd=trusted_root`, `PYTHONPATH=trusted_root:trusted_root/katas`, stdin `DEVNULL`; `True` iff return code 0; timeout → `False`.
  - `run_all(trusted_root, student_root, worlds, timeout=60) -> list[str]` — passed katas, only for katas with an official test in `trusted_root`.
  - CLI: `python3 -m tools.map.run_tests --trusted DIR --student DIR --worlds PATH --out results.json` writes `{"passed": [...]}`; prints a per-kata PASS/FAIL table to stdout.
  - In `progress.py`: `load_results(path: str, max_bytes: int = 65536) -> list[str]` — returns `[]` for oversize/invalid JSON/non-dict/non-list `passed`; drops non-str or regex-failing entries.
  - CLI `apply` uses `load_results`.

- [ ] **Step 1: Write failing tests** (build temp trusted/student trees with `katas/test/test_k.py` asserting `from katas.k import f; f() == 1`)

```python
def test_run_kata_pass(self):       # student k.py returns 1 -> True
def test_run_kata_fail(self):       # returns 2 -> False
def test_run_kata_missing_file(self): # no student k.py -> False
def test_run_kata_timeout(self):    # student k.py: `while True: pass` at import, timeout=2 -> False
def test_run_all_skips_untested(self):  # worlds lists k and u (no test) -> ["k"]
def test_student_tests_ignored(self):   # student tree has katas/test/test_k.py asserting True, k.py wrong -> False
def test_load_results_garbage(self):    # "not json", [1,2], {"passed": "a"}, {"passed": [1, "../x", "a"]} -> [], [], [], ["a"]
def test_load_results_oversize(self):   # file > max_bytes -> []
```

- [ ] **Step 2: Run, expect FAIL**
- [ ] **Step 3: Implement** both modules as specified.
- [ ] **Step 4: Run all tests, expect PASS**
- [ ] **Step 5: Commit** — `git commit -m "feat(map): official test runner and results validation"`

---

### Task 3: Workflow `map.yaml`, remove `main.yaml`

**Files:**
- Create: `.github/workflows/map.yaml`
- Delete: `.github/workflows/main.yaml`

**Interfaces:**
- Consumes: CLIs from Tasks 1–2.

Triggers: `pull_request_target` (branches `[main]`, types `[opened, synchronize, reopened, closed]`), `push` (branches `[main]`, paths `docs/**`, `katas/test/**`, `tools/**`), `schedule` (`cron: "17 3 * * *"`), `workflow_dispatch`. Top-level `permissions: {}`.

Jobs:

1. **`test`** — `if: github.event_name == 'pull_request_target' && github.event.action != 'closed' && github.event.pull_request.head.repo.fork`; `permissions: contents: read`; `timeout-minutes: 15`.
   Steps: checkout `main` into `trusted/` (`persist-credentials: false`); checkout `${{ github.event.pull_request.head.repo.full_name }}` at `${{ github.event.pull_request.head.sha }}` into `student/` (`persist-credentials: false`); `actions/setup-python@v5` python `3.12` (no `cache`); informational `pip install pylint && pylint student/katas/*.py || true`; run from the workspace root with `env: PYTHONPATH: trusted`: `python3 -m tools.map.run_tests --trusted trusted --student student --worlds trusted/docs/worlds.json --out results.json`; upload artifact `results` (`results.json`, `retention-days: 1`).

2. **`collect`** — `needs: test` when PR, else runs alone: `if: always() && (needs.test.result == 'success' || github.event_name != 'pull_request_target' || github.event.action == 'closed')`; `permissions: contents: write`. Never checks out PR code.
   Steps: checkout `main` (trusted tools); download artifact (PR only); checkout/create branch `map-data` into `data/` (if `git ls-remote --heads origin map-data` empty: orphan branch with empty `progress.json` `{}`); run the matching CLI:
   - PR opened/synchronize/reopened: `apply --login ${{ github.event.pull_request.head.repo.owner.login }} --pr ${{ github.event.pull_request.number }} --results results.json`
   - PR closed or schedule: `prune --open-logins "$(gh pr list --state open --limit 500 --json headRepositoryOwner -q '[.[].headRepositoryOwner.login]|join(",")')"` then `recompute` (`GH_TOKEN: ${{ github.token }}`)
   - push / workflow_dispatch: `recompute`
   Pass login/PR via `env:` (never interpolate event fields directly into `run:` scripts). Commit as `github-actions[bot]`; push loop up to 5 tries: on rejection `git fetch origin map-data && git reset --hard origin/map-data`, re-run the CLI, commit, push.

3. **`deploy`** — `needs: collect`; `permissions: pages: write, id-token: write`; `environment: github-pages`; `concurrency: { group: pages, cancel-in-progress: true }`.
   Steps: checkout `main`; `git fetch origin map-data` and `git show origin/map-data:progress.json > docs/progress.json`; `actions/upload-pages-artifact@v3` path `docs`; `actions/deploy-pages@v4`.

- [ ] **Step 1: Write `map.yaml` as above; `git rm .github/workflows/main.yaml`**
- [ ] **Step 2: Validate syntax** — Run: `python3 -c "import yaml,sys;yaml.safe_load(open('.github/workflows/map.yaml'))"` (install `pyyaml` if needed) and, if available, `actionlint`. Expected: no errors.
- [ ] **Step 3: Simulate locally** — create `/tmp/student` as a copy of the repo with `katas/backoff_retry.py` solved; run the `run_tests` then `progress apply` commands exactly as in the workflow against a temp `progress.json`. Expected: `hello_world` (and any kata with an official test you solved) in `passed`.
- [ ] **Step 4: Commit** — `git commit -m "feat(map): PR-driven test/collect/deploy workflow"`

---

### Task 4: Map page — static mockup for instructor approval

**Files:**
- Create: `docs/index.html` (replaces the untracked old page), `docs/map.css`, `docs/map.js`, `docs/sample-progress.json`, `docs/assets/*`

**Interfaces:**
- Consumes: `worlds.json` and `progress.json` schemas (Task 1). `map.js` loads `progress.json`, or `sample-progress.json` when the URL has `?sample=1`.

Rendering decisions:
- Full-screen SVG; worlds laid left→right as islands along a winding dotted path (sine-like vertical offset), each island tinted by `theme` (`beach`, `jungle`, `desert`, `snow`, `lava`, `castle`; unknown → `beach`), 5 checkpoint circles + an end flag. One extra fogged island labeled "???" after the last world.
- Checkpoint states: tested (normal), untested ("coming soon", dashed + clock icon). Hover → tooltip "kata_name · N passed".
- Soldiers: circle-clipped avatar (`https://github.com/<login>.png?size=64`) with helmet badge, placed at `(world, checkpoint)`; `world == len(worlds)` → final flag. More than 3 at one spot → show 3 + "+N" bubble; hover lists all logins. Hover a soldier → "login · N katas passed".
- Header: title from `worlds.json`, participants count, "updated X min ago".
- Pan by drag, zoom by wheel/pinch (pointer events + SVG `viewBox`), no libraries. Mobile-friendly.
- "Find me" input → highlight + center soldier, saved in `localStorage["katasMapMe"]`.
- Assets: decorative CC0 images (Kenney) vendored into `docs/assets/` if downloadable; otherwise pure SVG/CSS shapes. No CDN at runtime.
- `sample-progress.json`: ~25 fake students spread over 2 worlds (add a second sample world only in the sample via a `worlds` override in the sample file: `{"worlds": [...], "progress": {...}}`).

- [ ] **Step 1: Build page; serve with `python3 -m http.server -d docs 8000`**
- [ ] **Step 2: Open `http://localhost:8000/?sample=1` in the browser, take screenshots (desktop + phone width), show to the instructor, iterate until approved**
- [ ] **Step 3: Commit** — `git commit -m "feat(map): new interactive world map page"`

---

### Task 5: Page polish — find-me confetti and empty/error states

**Files:**
- Modify: `docs/map.js`, `docs/map.css`
- Create: `docs/assets/confetti.min.js` (vendored `canvas-confetti`, ISC license header kept)

- [ ] **Step 1:** When the remembered login's `world` is higher than the value stored in `localStorage["katasMapMeWorld"]`, fire confetti and store the new value.
- [ ] **Step 2:** `progress.json` missing/404 → map renders with zero soldiers and banner "No participants yet — open your [map] PR!". Fetch error → banner "Could not load progress".
- [ ] **Step 3:** Verify in browser: `?sample=1`, then with `docs/progress.json` absent; set `localStorage` and reload to see confetti once.
- [ ] **Step 4: Commit** — `git commit -m "feat(map): celebrations and empty states"`

---

### Task 6: README and end-to-end check on GitHub

**Files:**
- Modify: `README.md`

- [ ] **Step 1:** Update README: upstream URL → `https://github.com/alonitac/PythonKatasOz.git`; remove "write a unittest" and "check Actions" steps; add "Join the map" (open one PR from your fork's `main` into `alonitac/PythonKatasOz:main`, title `[map] <your name>`, keep it open, never merged; don't edit `katas/test/`); add short "For the instructor" section (add katas + official test + `docs/worlds.json` entry per week; Settings → Pages → Source: GitHub Actions; `github-pages` environment must allow `main`).
- [ ] **Step 2: Commit** — `git commit -m "docs: map instructions"`
- [ ] **Step 3 (with instructor):** Push `main`; set Pages source to GitHub Actions; from a second GitHub account (or a student), fork, solve any World 1 kata that has an official test, open `[map]` PR. Expected: `map.yaml` runs without approval, `map-data` gets `progress.json`, the site shows the soldier within ~2 min. Push twice quickly from two forks if possible → both updates present.
