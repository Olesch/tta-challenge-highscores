"""Build data/challenges.json from the game's scenario files.

Usage: python tools/extract_challenges.py "D:/Games/GOG/Through the Ages"
"""
import json, re, sys
from pathlib import Path
import yaml

SETS = [  # (set id, folder, index file, id suffix)
    ("original", "", "challenges.yaml", ""),
    ("expansion", "exp", "challenges_exp.yaml", "_exp"),
    ("mix", "mix", "challenges_mix.yaml", "_mix"),
]
AI_LEVELS = {"isAI0": "easy", "isAI1": "medium", "isAI2": "hard"}


def load_yaml(path):
    # Files start with "---\n---" and end with "...", so take the first non-empty document.
    docs = [d for d in yaml.safe_load_all(path.read_text(encoding="utf-8")) if d]
    return docs[0]


def load_strings(game_dir, lang):
    path = game_dir / "Localization_strings" / f"challenges_strings_{lang}.yaml"
    strings = {}
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        m = re.match(r'^(sc-[\w-]+):\s*"(.*)"\s*$', line)
        if m:
            strings[m.group(1)] = m.group(2).replace("<br />", "\n").replace('\\"', '"')
    return strings


def texts(strings, sid, kind):
    out, i = [], 0
    while f"sc-{sid}-{kind}{i}" in strings:
        out.append(strings[f"sc-{sid}-{kind}{i}"])
        i += 1
    return out


def main(game_dir):
    game_dir = Path(game_dir)
    root = game_dir / "scenarios"
    strings = load_strings(game_dir, "EN")
    challenges = []
    for set_id, folder, index_file, suffix in SETS:
        index = load_yaml(root / folder / index_file)
        for group in index["groups"]:
            for slot, ch in enumerate(group["challenges"]):
                sid = ch["id"]
                sc = load_yaml(root / folder / f"{sid}.yaml")
                opponents = []
                for p in sc["configPlayers"]:
                    level = next(AI_LEVELS[k] for k in AI_LEVELS if p.get(k) == "y")
                    opponents.append({
                        "level": level,
                        "name": strings.get(p["name"]) if p.get("name") else None,
                        "flags": p.get("flags") or {},
                    })
                challenges.append({
                    "id": sid,
                    "set": set_id,
                    "group": group["id"],
                    "slot": slot,
                    "difficulty": ch["diff"],
                    "players": len(opponents) + 1,
                    "name": strings[f"sc-{sid}-name"],
                    "description": texts(strings, sid, "desc"),
                    "rules": texts(strings, sid, "rules"),
                    "opponents": opponents,
                    "flags": sc.get("flags") or {},
                    "agesToPlay": sc.get("agesToPlay"),
                })
    out = Path(__file__).resolve().parent.parent / "data" / "challenges.json"
    out.write_text(json.dumps(challenges, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(challenges)} challenges to {out}")


if __name__ == "__main__":
    main(sys.argv[1])
