import json
import os
import tempfile
import unittest

from tools.map.progress import apply_result, load_worlds, main, position, prune, recompute

W = [
    {"id": "w1", "name": "One", "theme": "beach", "katas": ["a", "b", "c"], "required": None},
    {"id": "w2", "name": "Two", "theme": "jungle", "katas": ["d", "e"], "required": 1},
]
ALL = {"a", "b", "c", "d", "e"}


class TestPosition(unittest.TestCase):
    def test_position_start(self):
        self.assertEqual(position(W, ALL, set()), (0, 0))

    def test_position_mid_world(self):
        self.assertEqual(position(W, ALL, {"a", "c"}), (0, 2))

    def test_position_next_world(self):
        self.assertEqual(position(W, ALL, {"a", "b", "c"}), (1, 0))

    def test_position_required_override(self):
        self.assertEqual(position(W, ALL, {"a", "b", "c", "e"}), (2, 0))

    def test_position_untested_katas_block_world(self):
        self.assertEqual(position(W, {"a", "b", "d", "e"}, {"a", "b"}), (0, 2))

    def test_position_required_ignores_untested(self):
        self.assertEqual(position(W, ALL, {"a", "b", "c", "d"}), (2, 0))

    def test_position_required_larger_than_tested_blocks(self):
        worlds = [{**W[0], "required": 2}, W[1]]
        self.assertEqual(position(worlds, {"a", "d"}, {"a", "d"}), (0, 1))

    def test_position_blocks_at_untested_world(self):
        self.assertEqual(position(W, {"a", "b", "c"}, {"a", "b", "c"}), (1, 0))


class TestProgress(unittest.TestCase):
    def test_passed_ignores_untested_and_unknown(self):
        p = apply_result({}, W, {"a"}, "bob", 7, ["a", "zzz", "b"], "T")
        self.assertEqual(p["students"]["bob"]["passed"], ["a"])
        self.assertEqual(p["students"]["bob"]["pr"], 7)
        self.assertEqual(p["updated_at"], "T")

    def test_apply_replaces_previous(self):
        p = apply_result({}, W, ALL, "bob", 7, ["a", "b"], "T1")
        p = apply_result(p, W, ALL, "bob", 7, ["a"], "T2")
        bob = p["students"]["bob"]
        self.assertEqual((bob["passed"], bob["checkpoint"], bob["updated_at"]), (["a"], 1, "T2"))

    def test_passed_kept_in_route_order(self):
        p = apply_result({}, W, ALL, "bob", 7, ["d", "a", "c"], "T")
        self.assertEqual(p["students"]["bob"]["passed"], ["a", "c", "d"])

    def test_recompute_after_new_world(self):
        p = apply_result({}, W[:1], {"a", "b", "c"}, "bob", 1, ["a", "b", "c"], "T")
        self.assertEqual(p["students"]["bob"]["world"], 1)
        p = recompute(p, W, ALL, "T2")
        bob = p["students"]["bob"]
        self.assertEqual((bob["world"], bob["checkpoint"]), (1, 0))
        self.assertEqual(p["tested"], sorted(ALL))

    def test_prune_closed(self):
        p = apply_result({}, W, ALL, "bob", 1, [], "T")
        p = apply_result(p, W, ALL, "amy", 2, [], "T")
        self.assertEqual(set(prune(p, {"amy"})["students"]), {"amy"})


class TestFiles(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def _write(self, rel, content):
        path = os.path.join(self.dir, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content if isinstance(content, str) else json.dumps(content))
        return path

    def test_load_worlds_defaults_required(self):
        path = self._write("w.json", {"title": "T", "worlds": [
            {"id": "w1", "name": "One", "theme": "beach", "katas": ["a"]}]})
        self.assertIsNone(load_worlds(path)[0]["required"])

    def test_load_worlds_rejects_bad_kata(self):
        path = self._write("w.json", {"title": "T", "worlds": [
            {"id": "w1", "name": "One", "theme": "beach", "katas": ["../x"]}]})
        with self.assertRaises(ValueError):
            load_worlds(path)

    def test_load_worlds_rejects_missing_key(self):
        path = self._write("w.json", {"title": "T", "worlds": [{"id": "w1", "katas": ["a"]}]})
        with self.assertRaises(ValueError):
            load_worlds(path)

    def test_cli_apply_roundtrip(self):
        worlds = self._write("docs/worlds.json", {"title": "T", "worlds": [
            {"id": "w1", "name": "One", "theme": "beach", "katas": ["a", "b"]}]})
        self._write("katas/test/test_a.py", "")
        results = self._write("results.json", {"passed": ["a", "b"]})
        prog = os.path.join(self.dir, "progress.json")
        rc = main(["apply", "--worlds", worlds, "--progress", prog,
                   "--katas-dir", os.path.join(self.dir, "katas"),
                   "--results", results, "--login", "bob", "--pr", "3"])
        self.assertEqual(rc, 0)
        with open(prog, encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data["tested"], ["a"])
        self.assertEqual(data["students"]["bob"]["passed"], ["a"])
        self.assertEqual(data["students"]["bob"]["world"], 0)

    def test_cli_prune_and_recompute(self):
        worlds = self._write("docs/worlds.json", {"title": "T", "worlds": [
            {"id": "w1", "name": "One", "theme": "beach", "katas": ["a"]}]})
        prog = self._write("progress.json", {"students": {
            "bob": {"passed": [], "updated_at": "T", "pr": 1, "world": 0, "checkpoint": 0},
            "amy": {"passed": [], "updated_at": "T", "pr": 2, "world": 0, "checkpoint": 0}}})
        katas = os.path.join(self.dir, "katas")
        self.assertEqual(main(["prune", "--worlds", worlds, "--progress", prog,
                               "--katas-dir", katas, "--open-logins", "amy"]), 0)
        with open(prog, encoding="utf-8") as f:
            self.assertEqual(set(json.load(f)["students"]), {"amy"})

    def test_cli_apply_all_uses_only_targets(self):
        worlds = self._write("docs/worlds.json", {"title": "T", "worlds": [
            {"id": "w1", "name": "One", "theme": "beach", "katas": ["a", "b"]}]})
        self._write("katas/test/test_a.py", "")
        self._write("katas/test/test_b.py", "")
        prog = self._write("progress.json", {"students": {
            "amy": {"passed": ["a"], "updated_at": "T", "pr": 4, "world": 0, "checkpoint": 1}}})
        targets = self._write("targets.json", [
            {"login": "bob", "pr": 3, "repo": "bob/k", "sha": "x"},
            {"login": "amy", "pr": 4, "repo": "amy/k", "sha": "y"},
            {"login": "bad/one", "pr": 5, "repo": "z/k", "sha": "z"}])
        self._write("results/results-bob-3/results.json", {"passed": ["a", "b"]})
        self._write("results/results-mallory-9/results.json", {"passed": ["a", "b"]})
        self._write("results/results-bad/one-5/results.json", {"passed": ["a"]})
        rc = main(["apply-all", "--worlds", worlds, "--progress", prog,
                   "--katas-dir", os.path.join(self.dir, "katas"),
                   "--results-dir", os.path.join(self.dir, "results"), "--targets", targets])
        self.assertEqual(rc, 0)
        with open(prog, encoding="utf-8") as f:
            students = json.load(f)["students"]
        self.assertEqual(set(students), {"amy", "bob"})
        self.assertEqual((students["bob"]["passed"], students["bob"]["world"], students["bob"]["pr"]),
                         (["a", "b"], 1, 3))
        self.assertEqual(students["amy"]["passed"], ["a"])

    def test_cli_rejects_bad_login(self):
        worlds = self._write("docs/worlds.json", {"title": "T", "worlds": [
            {"id": "w1", "name": "One", "theme": "beach", "katas": ["a"]}]})
        results = self._write("results.json", {"passed": []})
        prog = os.path.join(self.dir, "progress.json")
        rc = main(["apply", "--worlds", worlds, "--progress", prog,
                   "--katas-dir", os.path.join(self.dir, "katas"),
                   "--results", results, "--login", "bad/login", "--pr", "3"])
        self.assertNotEqual(rc, 0)
        self.assertFalse(os.path.exists(prog))


if __name__ == "__main__":
    unittest.main()
