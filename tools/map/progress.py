"""Soldier positions and progress.json maintenance for the katas map."""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone

KATA_RE = re.compile(r"^[a-z0-9_]+$")
LOGIN_RE = re.compile(r"^[A-Za-z0-9_-]+$")
WORLD_KEYS = ("id", "name", "theme", "katas")


def load_worlds(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    worlds = []
    for raw in data.get("worlds", []):
        missing = [k for k in WORLD_KEYS if k not in raw]
        if missing:
            raise ValueError(f"world {raw.get('id', '?')} missing keys: {missing}")
        katas = raw["katas"]
        if not isinstance(katas, list) or not all(isinstance(k, str) and KATA_RE.match(k) for k in katas):
            raise ValueError(f"world {raw['id']} has invalid kata names: {katas}")
        required = raw.get("required")
        if required is not None and (not isinstance(required, int) or required < 0):
            raise ValueError(f"world {raw['id']} has invalid required: {required}")
        worlds.append({"id": raw["id"], "name": raw["name"], "theme": raw["theme"],
                       "katas": katas, "required": required})
    return worlds


def tested_katas(worlds, katas_dir):
    return {k for w in worlds for k in w["katas"]
            if os.path.isfile(os.path.join(katas_dir, "test", f"test_{k}.py"))}


def position(worlds, tested, passed):
    for i, world in enumerate(worlds):
        countable = [k for k in world["katas"] if k in tested]
        done = sum(1 for k in countable if k in passed)
        need = min(world["required"] or len(countable), len(countable))
        if not countable or done < need:
            return i, done
    return len(worlds), 0


def _route(worlds, tested):
    return [k for w in worlds for k in w["katas"] if k in tested]


def _place(student, worlds, tested):
    student["world"], student["checkpoint"] = position(worlds, tested, set(student["passed"]))


def apply_result(progress, worlds, tested, login, pr, passed, now):
    passed_set = set(passed)
    student = {"passed": [k for k in _route(worlds, tested) if k in passed_set],
               "updated_at": now, "pr": pr}
    _place(student, worlds, tested)
    students = dict(progress.get("students", {}))
    students[login] = student
    return {**progress, "students": students, "tested": sorted(tested), "updated_at": now}


def recompute(progress, worlds, tested, now):
    route = _route(worlds, tested)
    students = {}
    for login, old in progress.get("students", {}).items():
        student = dict(old)
        known = set(student.get("passed", []))
        student["passed"] = [k for k in route if k in known] + sorted(known - set(route))
        student["world"], student["checkpoint"] = position(worlds, tested, known)
        students[login] = student
    return {**progress, "students": students, "tested": sorted(tested), "updated_at": now}


def prune(progress, open_logins):
    students = {k: v for k, v in progress.get("students", {}).items() if k in open_logins}
    return {**progress, "students": students}


def _read_progress(path):
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def _write_progress(path, progress):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=1, sort_keys=True)
        f.write("\n")


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["apply", "recompute", "prune"])
    parser.add_argument("--worlds", required=True)
    parser.add_argument("--progress", required=True)
    parser.add_argument("--katas-dir", required=True)
    parser.add_argument("--results")
    parser.add_argument("--login")
    parser.add_argument("--pr", type=int)
    parser.add_argument("--open-logins", default="")
    args = parser.parse_args(argv)

    worlds = load_worlds(args.worlds)
    tested = tested_katas(worlds, args.katas_dir)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    progress = _read_progress(args.progress)

    if args.command == "apply":
        if not args.login or not LOGIN_RE.match(args.login) or not args.results:
            print(f"invalid login or missing results: {args.login!r}", file=sys.stderr)
            return 2
        progress = apply_result(progress, worlds, tested, args.login, args.pr,
                                load_results(args.results), now)
    elif args.command == "prune":
        open_logins = {s for s in args.open_logins.split(",") if LOGIN_RE.match(s)}
        progress = prune(progress, open_logins)
    else:
        progress = recompute(progress, worlds, tested, now)

    _write_progress(args.progress, progress)
    return 0


def load_results(path, max_bytes=65536):
    try:
        if os.path.getsize(path) > max_bytes:
            return []
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        return []
    passed = data.get("passed") if isinstance(data, dict) else None
    if not isinstance(passed, list):
        return []
    return [k for k in passed if isinstance(k, str) and KATA_RE.match(k)]


if __name__ == "__main__":
    sys.exit(main())
