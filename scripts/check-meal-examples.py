"""Checks example meals written in the screen form of docs/lab-meal-format.md against the
format's rules, and prints counts. Usage: check-meal-examples.py docs/lab-meal-examples.md

Meals start at "## The meals" (lines before it are ignored); fence lines (```) are skipped.
A meal:      #### N. Title · cuisine · where   (any number of #, then a number)
A row:       - Name — amount            (a food row; a dish row has parts)
A part:        - Name — amount          (two spaces; parts are food rows)
A question:  <indent>X why: opt / [chosen] / opt
             X: P product, U sized product, S size, C count
A problem:   ! tag: note
"""
import re
import sys
from collections import Counter

files = sys.argv[1:]
meals = []
cur = None
for f in files:
    started = False
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        line = line.rstrip("\n")
        if line.startswith("```"):
            continue
        if line == "## The meals":
            started = True
            continue
        if not started:
            continue
        if re.match(r"#+ \d+\. ", line):
            cur = {"head": line, "lines": [line], "where": f"{f}:{n}"}
            meals.append(cur)
        elif cur is not None and line.strip():
            cur["lines"].append(line)

errors = []
kinds = Counter()
problems = Counter()
dish_meals = 0
rows_total = 0
q_rows = Counter()
opt_counts = Counter()
max_rows = 0

for m in meals:
    rows = []  # each: {"indent": 0|2, "qs": [...], "parts": [...]}
    for line in m["lines"][1:]:
        s = line.lstrip(" ")
        ind = len(line) - len(s)
        if line.startswith("#"):
            continue
        if s.startswith("! "):
            problems[s[2:].split(":")[0]] += 1
            continue
        if s.startswith("- "):
            row = {"name": s[2:], "qs": [], "parts": [], "indent": ind}
            if ind == 0:
                rows.append(row)
            elif ind == 2:
                if not rows:
                    errors.append(f"{m['head']}: part without a row")
                    continue
                rows[-1]["parts"].append(row)
            else:
                errors.append(f"{m['head']}: bad indent: {line}")
            continue
        mm = re.match(r"([PUSC]) (.*?): (.*)$", s)
        if not mm:
            errors.append(f"{m['head']}: can't read: {line}")
            continue
        kind, why, opts = mm.groups()
        opts = [o.strip() for o in opts.split(" / ")]
        target = None
        if rows:
            target = rows[-1]["parts"][-1] if rows[-1]["parts"] and ind >= 4 else rows[-1]
        if target is None:
            errors.append(f"{m['head']}: question without a row: {line}")
            continue
        target["qs"].append(kind)
        kinds[kind] += 1
        opt_counts[len(opts)] += 1
        chosen = [o for o in opts if o.startswith("[") and o.endswith("]")]
        if len(chosen) != 1:
            errors.append(f"{m['head']}: not exactly one chosen: {line}")
        labels = [o.strip("[]") for o in opts]
        if len(set(labels)) != len(labels):
            errors.append(f"{m['head']}: labels repeat: {line}")
        if len(opts) < 2:
            errors.append(f"{m['head']}: a question needs 2+ options: {line}")
        if len(opts) > 8:
            errors.append(f"{m['head']}: more than 8 options: {line}")
    rows_total += len(rows)
    max_rows = max(max_rows, len(rows))
    if any(r["parts"] for r in rows):
        dish_meals += 1
    for r in rows:
        qs = Counter(r["qs"])
        if r["parts"]:
            if qs["P"] or qs["U"]:
                errors.append(f"{m['head']}: a dish row has a what question: {r['name']}")
            for p in r["parts"]:
                if p["parts"]:
                    errors.append(f"{m['head']}: a part with parts")
        for x in [r] + r["parts"]:
            q = Counter(x["qs"])
            if q["P"] and q["U"]:
                errors.append(f"{m['head']}: both P and U: {x['name']}")
            if q["U"] and q["S"]:
                errors.append(f"{m['head']}: U with S: {x['name']}")
            for k in "PUSC":
                if q[k] > 1:
                    errors.append(f"{m['head']}: two {k} questions: {x['name']}")
            q_rows["".join(sorted(x["qs"])) or "-"] += 1

print(f"meals: {len(meals)}, rows: {rows_total}, with a dish: {dish_meals}, max rows: {max_rows}")
print("questions:", dict(kinds))
print("question sets per row:", dict(q_rows.most_common()))
print("options per question:", dict(sorted(opt_counts.items())))
print("problems:", dict(problems))
print(f"errors: {len(errors)}")
for e in errors[:50]:
    print("  ", e)
