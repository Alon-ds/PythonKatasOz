# Python Katas

Kata is a Japanese word (型 or 形) meaning "form".
It refers to a detailed choreographed pattern of martial arts movements made to be practiced alone.

**Python Katas** are short, focused coding exercises designed for practice, aimed at improving specific programming skills, often involving solving problems or implementing algorithms.

Your progress is shown live on the game map: https://alonitac.github.io/PythonKatasOz

## Getting started

1. **Fork** this repo, clone your fork and open it in your preferred IDE (e.g. PyCharm).
2. **Join the map** (once): on GitHub, open a pull request from your fork's `main` branch into `alonitac/PythonKatasOz` `main`.
   Title it `[map] <your name>`. **Keep it open** — it is never merged; it's how your soldier gets onto the map.
3. Solve the katas under `katas/`. Don't change files under `katas/test/` — the official tests always come from this repo.
4. Commit and push to your fork's `main`. About a minute later, your soldier moves forward on the map.

To check a kata before pushing, run its official test from the project root:

```bash
python -m unittest katas.test.test_hello_world
```

> [!NOTE]
> New katas are added every week. To get them, run **from branch `main`**:
>
> ```bash
> git remote add upstream https://github.com/alonitac/PythonKatasOz.git 2>/dev/null
> git pull upstream main
> ```

## For the instructor

- **Publishing a week:** add the kata files to `katas/`, their official tests to `katas/test/test_<kata>.py`,
  and a new world to `docs/worlds.json` (`id`, `name`, `theme` — one of `beach`, `jungle`, `desert`, `snow`, `lava`, `castle` —
  and the ordered `katas`; optional `required` = katas needed to move on, default all). Push to `main`; the map redeploys.
  A kata without an official test shows as "coming soon" and doesn't block anyone.
- **One-time setup:** Settings → Pages → Source: **GitHub Actions**. The `github-pages` environment must allow deployments from `main` (the default).
- **How it works:** `.github/workflows/map.yaml` runs on every student PR push (`pull_request_target`, no approvals needed):
  the official tests run against the student's kata files with a read-only token, results are stored in `progress.json`
  on the `map-data` branch, and the site is redeployed. Closing a student's PR removes their soldier.
- **Preview with sample data:** https://alonitac.github.io/PythonKatasOz/?sample=1, or locally `python3 -m http.server -d docs` and open `http://localhost:8000/?sample=1`.
- **Map tooling tests:** `python3 -m unittest discover -s tools/map/tests -t .`
