#!/usr/bin/env python3
"""Generate background-removed cutout versions of artist thumbnail images.

Uses rembg CLI to automatically remove backgrounds and produce transparent PNGs.
Saves cutout versions to recording/thumbnail_images/{artist}/cutout/

Prerequisites:
    uv tool install "rembg[cpu,cli]" --python 3.12 --override <(echo 'numba>=0.59')

Usage:
    uv run scripts/generate_cutout_images.py
    uv run scripts/generate_cutout_images.py --artist taylor-swift
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
THUMBNAIL_DIR = Path("recording/thumbnail_images")


def check_rembg():
    """Check if rembg CLI is available."""
    if shutil.which("rembg") is None:
        print("Error: rembg CLI not found.")
        print("Install it with:")
        print('  uv tool install "rembg[cpu,cli]" --python 3.12 --override <(echo \'numba>=0.59\')')
        sys.exit(1)


def generate_cutout(input_path: Path, output_path: Path, model: str) -> bool:
    """Remove background from an image using rembg CLI."""
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        result = subprocess.run(
            ["rembg", "i", "-m", model, str(input_path), str(output_path)],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode != 0:
            print(f"  Warning: rembg failed for {input_path.name}: {result.stderr.strip()}")
            return False
        return output_path.exists()
    except subprocess.TimeoutExpired:
        print(f"  Warning: Timed out processing {input_path.name}")
        return False
    except Exception as e:
        print(f"  Warning: Failed to process {input_path}: {e}")
        return False


def process_artist(artist_dir: Path, model: str, force: bool = False) -> tuple[int, int]:
    """Process all images for a single artist. Returns (processed, failed)."""
    cutout_dir = artist_dir / "cutout"
    processed = 0
    failed = 0

    for img_path in sorted(artist_dir.iterdir()):
        if img_path.is_dir():
            continue
        if img_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue

        # Always save as PNG for transparency
        output_path = cutout_dir / f"{img_path.stem}.png"
        if output_path.exists() and not force:
            print(f"  Skipping (exists): {img_path.name}")
            processed += 1
            continue

        print(f"  Processing: {img_path.name}")
        if generate_cutout(img_path, output_path, model):
            processed += 1
        else:
            failed += 1

    return processed, failed


def main():
    parser = argparse.ArgumentParser(description="Generate cutout images (background removal)")
    parser.add_argument(
        "--artist",
        type=str,
        help="Only process a specific artist slug (e.g., taylor-swift)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing cutout images",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="birefnet-general",
        help="rembg model to use (default: birefnet-general)",
    )
    args = parser.parse_args()

    check_rembg()

    if not THUMBNAIL_DIR.exists():
        print(f"Error: {THUMBNAIL_DIR} not found. Run from project root.")
        sys.exit(1)

    if args.artist:
        artist_dirs = [THUMBNAIL_DIR / args.artist]
        if not artist_dirs[0].exists():
            print(f"Error: {artist_dirs[0]} not found.")
            sys.exit(1)
    else:
        artist_dirs = sorted(
            d for d in THUMBNAIL_DIR.iterdir()
            if d.is_dir() and d.name != ".DS_Store"
        )

    total_processed = 0
    total_failed = 0

    for artist_dir in artist_dirs:
        print(f"Artist: {artist_dir.name}")
        processed, failed = process_artist(artist_dir, args.model, force=args.force)
        total_processed += processed
        total_failed += failed
        print(f"  Done: {processed} processed, {failed} failed")

    print(f"\nTotal: {total_processed} processed, {total_failed} failed")


if __name__ == "__main__":
    main()
