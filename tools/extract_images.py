"""Cut challenge pictures out of the game's scenario atlas and copy the group backgrounds.

Usage: python tools/extract_images.py "D:/Games/GOG/Through the Ages"
Writes public/img/challenges/<challenge id>.jpg and public/img/groups/<group>.jpg.
"""
import json, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent


def load_pack(path):
    sprites = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        name = Path(parts[0]).stem
        x, y, w, h = map(int, parts[1:5])
        sprites[name] = (x, y, w, h, "rot" in parts[5:])
    return sprites


def main(game_dir):
    game_dir = Path(game_dir)
    atlas = Image.open(game_dir / "Atlases" / "scenarios_jpeg.jpg").convert("RGB")
    sprites = load_pack(game_dir / "Atlases" / "scenarios_jpeg.pack")
    challenges = json.loads((ROOT / "data" / "challenges.json").read_text(encoding="utf-8"))

    out = ROOT / "public" / "img" / "challenges"
    out.mkdir(parents=True, exist_ok=True)
    for ch in challenges:
        # Expansion/mix challenges reuse the original picture unless they have their own.
        key = ch["id"] if ch["id"] in sprites else ch["id"].rsplit("_", 1)[0]
        key = key if key in sprites else key.replace("_exp", "").replace("_mix", "")
        x, y, w, h, rot = sprites[key]
        img = atlas.crop((x, y, x + w, y + h))
        if rot:
            img = img.transpose(Image.Transpose.ROTATE_270)
        img.save(out / f"{ch['id']}.jpg", quality=85)

    groups = ROOT / "public" / "img" / "groups"
    groups.mkdir(parents=True, exist_ok=True)
    for bg in (game_dir / "scenarios" / "UI_imgs").glob("challenge_bg_*.jpg"):
        shutil.copy(bg, groups / bg.name.replace("challenge_bg_", ""))
    print(f"wrote {len(challenges)} challenge images and {len(list(groups.iterdir()))} group backgrounds")


if __name__ == "__main__":
    main(sys.argv[1])
