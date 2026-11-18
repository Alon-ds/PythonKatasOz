
## For the instructor

- Add  a new world to `docs/worlds.json` (`id`, `name`, `theme` — one of `beach`, `jungle`, `desert`, `snow`, `lava`, `castle` —
  and the ordered `katas`; optional `required` = katas needed to move on, default all). Push to `main`; the map redeploys.
  A kata without an official test shows as "coming soon" and holds soldiers at that checkpoint until its test exists
  (unless `required` lets them move on). When you add a test, all open PRs are re-tested automatically.
-  Sample: https://alonitac.github.io/PythonKatasOz/?sample=1, or locally `python3 -m http.server -d docs` and open `http://localhost:8000/?sample=1`.
- Map tooling tests: `python3 -m unittest discover -s tools/map/tests -t .`
