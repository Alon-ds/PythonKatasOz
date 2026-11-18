import json
import os
import tempfile
import unittest

from tools.map.progress import load_results
from tools.map.run_tests import main, run_all, run_kata

OFFICIAL_TEST = """import unittest
from katas.k import f


class TestK(unittest.TestCase):
    def test_f(self):
        self.assertEqual(f(), 1)
"""


class RunTestsBase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.trusted = os.path.join(self.tmp.name, "trusted")
        self.student = os.path.join(self.tmp.name, "student")
        self._write(self.trusted, "katas/__init__.py", "")
        self._write(self.trusted, "katas/test/__init__.py", "")
        self._write(self.trusted, "katas/test/test_k.py", OFFICIAL_TEST)
        self._write(self.trusted, "katas/k.py", "def f():\n    raise NotImplementedError\n")

    def tearDown(self):
        self.tmp.cleanup()

    @staticmethod
    def _write(root, rel, content):
        path = os.path.join(root, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path


class TestRunKata(RunTestsBase):
    def test_run_kata_pass(self):
        self._write(self.student, "katas/k.py", "def f():\n    return 1\n")
        self.assertTrue(run_kata(self.trusted, self.student, "k"))

    def test_run_kata_fail(self):
        self._write(self.student, "katas/k.py", "def f():\n    return 2\n")
        self.assertFalse(run_kata(self.trusted, self.student, "k"))

    def test_run_kata_missing_file(self):
        self.assertFalse(run_kata(self.trusted, self.student, "k"))

    def test_run_kata_timeout(self):
        self._write(self.student, "katas/k.py", "while True:\n    pass\n")
        self.assertFalse(run_kata(self.trusted, self.student, "k", timeout=2))

    def test_run_kata_input_does_not_hang(self):
        self._write(self.student, "katas/k.py", "input()\ndef f():\n    return 1\n")
        self.assertFalse(run_kata(self.trusted, self.student, "k", timeout=5))

    def test_student_tests_ignored(self):
        self._write(self.student, "katas/k.py", "def f():\n    return 2\n")
        self._write(self.student, "katas/test/test_k.py",
                    "import unittest\nclass T(unittest.TestCase):\n    def test(self):\n        pass\n")
        self.assertFalse(run_kata(self.trusted, self.student, "k"))

    def test_run_all_skips_untested(self):
        self._write(self.student, "katas/k.py", "def f():\n    return 1\n")
        self._write(self.student, "katas/u.py", "")
        worlds = [{"id": "w", "name": "W", "theme": "beach", "katas": ["k", "u"], "required": None}]
        self.assertEqual(run_all(self.trusted, self.student, worlds), ["k"])

    def test_cli_writes_results(self):
        self._write(self.student, "katas/k.py", "def f():\n    return 1\n")
        worlds = self._write(self.trusted, "docs/worlds.json", json.dumps({"title": "T", "worlds": [
            {"id": "w", "name": "W", "theme": "beach", "katas": ["k"]}]}))
        out = os.path.join(self.tmp.name, "results.json")
        self.assertEqual(main(["--trusted", self.trusted, "--student", self.student,
                               "--worlds", worlds, "--out", out]), 0)
        with open(out, encoding="utf-8") as f:
            self.assertEqual(json.load(f), {"passed": ["k"]})


class TestLoadResults(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()

    def tearDown(self):
        self.tmp.cleanup()

    def _results(self, content):
        path = os.path.join(self.tmp.name, "r.json")
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return path

    def test_load_results_garbage(self):
        cases = {
            "not json": [],
            "[1, 2]": [],
            '{"passed": "a"}': [],
            '{"passed": [1, "../x", "a"]}': ["a"],
        }
        for content, expected in cases.items():
            with self.subTest(content=content):
                self.assertEqual(load_results(self._results(content)), expected)

    def test_load_results_oversize(self):
        path = self._results(json.dumps({"passed": ["a"], "pad": "x" * 100}))
        self.assertEqual(load_results(path, max_bytes=50), [])

    def test_load_results_missing_file(self):
        self.assertEqual(load_results(os.path.join(self.tmp.name, "nope.json")), [])


if __name__ == "__main__":
    unittest.main()
