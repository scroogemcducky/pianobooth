#!/usr/bin/env python3
"""
Generate a TSV (tab‑separated) file compatible with your app's CSV export
(headers: Artist, Song, Album, Data), where Data is a base64 data URL.

This mirrors app/routes/add.tsx (which joins with "\t"), but runs offline.

Usage examples:
  pip install mido
  python scripts/generate_midi_csv.py --out song_data.tsv path/to/*.mid
  python scripts/generate_midi_csv.py --album "Nocturnes" --out nocturnes.tsv Debussy_Nocturne*.mid
  python scripts/generate_midi_csv.py --file --out out.tsv /folder/with/midis
  # Or, omit --out to auto-split per-artist into numbered files in an output folder
  python scripts/generate_midi_csv.py --file /folder/with/midis

Notes:
  - Title/Artist are inferred from MIDI metadata (track names) or filename.
  - If mido is not installed or parsing fails, falls back to filename.
  - Output is tab‑separated, matching the web editor's export format.

AI refinement (ChatGPT):
  Runs automatically each time. If OPENAI_API_KEY is present (or passed via
  --openai-api-key) and requests is installed, the script calls ChatGPT to
  normalize/correct artist/title from available hints. If unavailable, it
  gracefully falls back to heuristics.
"""

import argparse
import base64
import csv
import json
import os
import re
import sys
from pathlib import Path
from collections import defaultdict
from typing import Iterable, List, Optional, Tuple

try:
    import mido  # type: ignore
except Exception:
    mido = None
try:
    import requests  # type: ignore
except Exception:
    requests = None


KNOWN_COMPOSERS = re.compile(
    r"bach|beethoven|chopin|debussy|mozart|liszt|schubert|schumann|rachmaninoff|handel|haydn|tchaikovsky|gershwin",
    re.IGNORECASE,
)

COMMON_NAME_MAP = [
    (re.compile(r"bach", re.IGNORECASE), "Bach"),
    (re.compile(r"beethoven", re.IGNORECASE), "Beethoven"),
    (re.compile(r"chopin", re.IGNORECASE), "Chopin"),
    (re.compile(r"mozart", re.IGNORECASE), "Mozart"),
    (re.compile(r"debussy", re.IGNORECASE), "Debussy"),
    (re.compile(r"liszt", re.IGNORECASE), "Liszt"),
    (re.compile(r"schubert", re.IGNORECASE), "Schubert"),
    (re.compile(r"schumann", re.IGNORECASE), "Schumann"),
    (re.compile(r"rachmaninov|rachmaninoff", re.IGNORECASE), "Rachmaninoff"),
    (re.compile(r"handel", re.IGNORECASE), "Handel"),
    (re.compile(r"haydn", re.IGNORECASE), "Haydn"),
    (re.compile(r"tchaikovsky|chaikovsky", re.IGNORECASE), "Tchaikovsky"),
    (re.compile(r"gershwin", re.IGNORECASE), "Gershwin"),
]


def iter_midi_files(inputs: List[str]) -> Iterable[Path]:
    for inp in inputs:
        p = Path(inp)
        if p.is_dir():
            for ext in ("*.mid", "*.midi", "*.kar"):
                yield from sorted(p.rglob(ext))
        elif p.is_file():
            yield p


def clean_text(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def infer_from_filename(path: Path) -> Tuple[Optional[str], Optional[str]]:
    name = path.stem
    if "-" in name:
        parts = [p.strip() for p in name.split("-") if p.strip()]
        if len(parts) >= 2:
            a, b = parts[0], "-".join(parts[1:])
            artist, title = (a, b) if len(a) <= len(b) else (b, a)
            return clean_text(title), clean_text(artist)
    return None, None


def extract_meta_with_mido(path: Path) -> Tuple[Optional[str], Optional[str], List[str]]:
    if mido is None:
        return None, None, []
    try:
        mf = mido.MidiFile(str(path))
    except Exception:
        return None, None, []

    track_names: List[str] = []
    for track in mf.tracks:
        for msg in track:
            if msg.is_meta and msg.type == "track_name" and getattr(msg, "name", None):
                track_names.append(clean_text(msg.name))

    title: Optional[str] = None
    if track_names:
        title = max(track_names, key=len)

    artist: Optional[str] = None
    for n in track_names:
        if KNOWN_COMPOSERS.search(n):
            artist = n
            break
    if artist is None:
        hyphen = next((n for n in track_names if "-" in n), None)
        if hyphen:
            parts = [p.strip() for p in hyphen.split("-") if p.strip()]
            if len(parts) >= 2:
                a, b = parts[0], "-".join(parts[1:])
                artist = a if len(a) <= len(b) else b
                if not title:
                    title = b if len(b) >= len(a) else a

    return (clean_text(title) if title else None, clean_text(artist) if artist else None, track_names)


def ai_refine_metadata(
    *,
    filename: str,
    guessed_title: str,
    guessed_artist: str,
    track_names: List[str],
    api_key: Optional[str],
    model: str = "gpt-4o-mini",
    timeout: int = 30,
) -> Tuple[Optional[str], Optional[str]]:
    """Ask ChatGPT to normalize/correct artist/title.

    Returns (title, artist); any of them may be None if unavailable.
    """
    if not api_key or not requests:
        return None, None
    try:
        system = (
            "You are a precise metadata normalizer for MIDI files. "
            "Respond with a strict JSON object only. "
            "For classical composers, use the most common short canonical name for the artist (last name only), e.g., 'Bach', 'Beethoven', 'Chopin', 'Mozart', 'Debussy', 'Liszt', 'Schubert', 'Schumann', 'Rachmaninoff', 'Handel', 'Haydn', 'Tchaikovsky', 'Gershwin'. "
            "Do not return full names when a common short name exists."
        )
        user = {
            "instruction": (
                "Given MIDI hints, return best-guess fields artist and title. "
                "Favor the most common short canonical name for the artist (e.g., 'Bach' not 'Johann Sebastian Bach'). "
                "If unknown, use empty string."
            ),
            "filename": filename,
            "guessed": {"artist": guessed_artist, "title": guessed_title},
            "track_names": track_names[:25],
            "output_schema": {"artist": "string", "title": "string"},
        }
        payload = {
            "model": model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(user)},
            ],
        }
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps(payload),
            timeout=timeout,
        )
        if resp.status_code != 200:
            return None, None
        data = resp.json()
        content = data["choices"][0]["message"]["content"].strip()
        obj = json.loads(content)
        artist = clean_text(obj.get("artist", "")) if isinstance(obj, dict) else ""
        title = clean_text(obj.get("title", "")) if isinstance(obj, dict) else ""
        return (title or None, artist or None)
    except Exception:
        return None, None


def to_data_url(path: Path) -> str:
    b = path.read_bytes()
    b64 = base64.b64encode(b).decode("ascii")
    return f"data:audio/midi;base64,{b64}"


def canonicalize_common_artist_name(artist: str) -> str:
    a = artist or ""
    for pattern, canon in COMMON_NAME_MAP:
        if pattern.search(a):
            return canon
    return artist.strip()


def main():
    ap = argparse.ArgumentParser(description="Generate a TSV for Supabase import (Artist, Song, Album, Data)")
    ap.add_argument("paths", nargs="+", help="MIDI files or folders to include")
    ap.add_argument("--out", default=None, help="Single output TSV path (if omitted, splits per-artist into numbered files)")
    ap.add_argument("--out-dir", default="tsv_out", help="Output folder when --out is omitted (default: tsv_out)")
    ap.add_argument("--album", default=None, help="Album value to use for all rows")
    ap.add_argument("--file", action="store_true", help="Use the immediate parent folder name as Album")
    ap.add_argument("--openai-api-key", default=os.environ.get("OPENAI_API_KEY"), help="OpenAI API key (env OPENAI_API_KEY)")
    ap.add_argument("--model", default="gpt-4o-mini", help="OpenAI model (default: gpt-4o-mini)")
    ap.add_argument("--timeout", type=int, default=30, help="HTTP timeout seconds for OpenAI calls")
    args = ap.parse_args()

    rows: List[Tuple[str, str, str, str]] = []
    seen: set = set()

    for path in iter_midi_files(args.paths):
        key = str(path.resolve())
        if key in seen:
            continue
        seen.add(key)

        meta_title, meta_artist, track_names = extract_meta_with_mido(path)
        file_title, file_artist = infer_from_filename(path)
        title = meta_title or file_title or "Untitled"
        artist = meta_artist or file_artist or "Piano"

        # Always attempt AI refinement (falls back silently if no API key/requests)
        ai_title, ai_artist = ai_refine_metadata(
            filename=str(path.name),
            guessed_title=title,
            guessed_artist=artist,
            track_names=track_names,
            api_key=args.openai_api_key,
            model=args.model,
            timeout=args.timeout,
        )
        if ai_title:
            title = ai_title
        if ai_artist:
            artist = ai_artist

        # Enforce canonical short composer name when applicable
        artist = canonicalize_common_artist_name(artist)

        if args.file:
            album = path.parent.name
        else:
            album = args.album or ""

        data_url = to_data_url(path)
        rows.append((artist, title, album, data_url))

    def slugify(s: str) -> str:
        s = s.strip().lower()
        s = re.sub(r"[^a-z0-9]+", "_", s)
        return re.sub(r"(^_+|_+$)", "", s) or "artist"

    if args.out:
        # Single-file mode (legacy behavior)
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f, delimiter="\t")
            writer.writerow(["Artist", "Song", "Album", "Data"])
            for artist, title, album, data in rows:
                writer.writerow([artist, title, album, data])
        print(f"Wrote {len(rows)} row(s) to {out_path}")
    else:
        # Split per-artist into numbered files in a folder
        out_dir = Path(args.out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        grouped = defaultdict(list)
        for artist, title, album, data in rows:
            grouped[artist].append((artist, title, album, data))

        total_files = 0
        for artist, items in grouped.items():
            artist_slug = slugify(artist or "artist")
            # stable order by title for reproducible numbering
            items_sorted = sorted(items, key=lambda r: (r[1] or ""))
            for idx, (a, t, alb, d) in enumerate(items_sorted, start=1):
                filename = f"{artist_slug}_{idx}.tsv"
                out_path = out_dir / filename
                with out_path.open("w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f, delimiter="\t")
                    writer.writerow(["Artist", "Song", "Album", "Data"])
                    writer.writerow([a, t, alb, d])
                total_files += 1

        print(f"Wrote {total_files} file(s) to {out_dir}")


if __name__ == "__main__":
    main()
