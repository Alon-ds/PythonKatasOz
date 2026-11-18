"""Run the official kata tests from a trusted tree against a student's kata files."""

import argparse
import json
import os
import shutil
import subprocess
import sys

from tools.map.progress import load_worlds


def run_kata(trusted_root, student_root, kata, timeout=60):
    student_file = os.path.join(student_root, "katas", f"{kata}.py")
    if not os.path.isfile(student_file) or os.path.islink(student_file):
        return False
    shutil.copyfile(student_file, os.path.join(trusted_root, "katas", f"{kata}.py"))
    env = {**os.environ, "PYTHONPATH": os.pathsep.join([trusted_root, os.path.join(trusted_root, "katas")])}
    try:
        proc = subprocess.run([sys.executable, "-m", "unittest", f"katas.test.test_{kata}"],
                              cwd=trusted_root, env=env, stdin=subprocess.DEVNULL,
                              stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        return False
    return proc.returncode == 0


def run_all(trusted_root, student_root, worlds, timeout=60):
    passed = []
    for world in worlds:
        for kata in world["katas"]:
            if not os.path.isfile(os.path.join(trusted_root, "katas", "test", f"test_{kata}.py")):
                continue
            ok = run_kata(trusted_root, student_root, kata, timeout)
            print(f"{'PASS' if ok else 'FAIL'}  {kata}")
            if ok:
                passed.append(kata)
    return passed


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trusted", required=True)
    parser.add_argument("--student", required=True)
    parser.add_argument("--worlds", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--timeout", type=float, default=60)
    args = parser.parse_args(argv)

    passed = run_all(args.trusted, args.student, load_worlds(args.worlds), args.timeout)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({"passed": passed}, f)
    return 0


if __name__ == "__main__":
    sys.exit(main())
