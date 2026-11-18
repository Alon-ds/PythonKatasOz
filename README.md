# Python Katas

Kata is a Japanese word (型 or 形) meaning "form".
It refers to a detailed choreographed pattern of martial arts movements made to be practiced alone.

**Python Katas** are short, focused coding exercises designed for practice, aimed at improving specific programming skills, often involving solving problems or implementing algorithms.

Your progress is shown live on the game map: https://alonitac.github.io/PythonKatasOz

## Getting started

1. **Fork** this repo, clone your fork and open it in your preferred IDE.
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
