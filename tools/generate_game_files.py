"""Regenerate every file taken from the game (not in git, as it is Czech Games Edition's material).

Usage: python tools/generate_game_files.py ["D:/Games/GOG/Through the Ages"]
The game folder can also be set with the TTA_GAME_DIR environment variable.
Writes data/challenges.json, public/img/challenges/*.jpg and public/img/groups/*.jpg.
"""
import os, sys
from pathlib import Path

import extract_challenges, extract_images

DEFAULT_GAME_DIR = "D:/Games/GOG/Through the Ages"


def main():
    game_dir = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TTA_GAME_DIR", DEFAULT_GAME_DIR))
    if not (game_dir / "Atlases" / "scenarios_jpeg.jpg").exists():
        sys.exit(f'Game files not found in "{game_dir}". Pass the Through the Ages install folder as the argument.')
    extract_challenges.main(game_dir)  # images need challenges.json, so this runs first
    extract_images.main(game_dir)


if __name__ == "__main__":
    main()
