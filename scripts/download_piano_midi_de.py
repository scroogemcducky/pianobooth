#!/usr/bin/env python3
"""
Download every MIDI file listed on piano-midi.de and store license metadata.

This script crawls the composer pages linked from midi_files.htm, downloads all
referenced .mid files into public/midi/piano-midi-de/, and writes a JSON index
that associates each file with its composer, piece title, source URLs, and the
Creative Commons BY-SA 3.0 Germany license notice attributed to Bernd Krueger.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys
import unicodedata
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Iterable, List, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen


BASE_URL = "http://piano-midi.de/"
MIDI_INDEX_URL = urljoin(BASE_URL, "midi_files.htm")
COPYRIGHT_URL = urljoin(BASE_URL, "copy.htm")
DEST_ROOT = Path("midi/public")
QUEUE_ROOT = Path("midi/video_queue")
LICENSE_FILE = DEST_ROOT / "piano-midi-de-license.txt"
INDEX_FILE = DEST_ROOT / "piano-midi-de.index.json"


MIDI_LINK_RE = re.compile(
    r'<a[^>]+href="([^"]+?\.mid)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
ANCHOR_RE = re.compile(r'href="([^"]+?\.htm)"', re.IGNORECASE)
TAG_RE = re.compile(r"<[^>]+>")
WHITESPACE_RE = re.compile(r"\s+")


@dataclass
class MidiEntry:
    composer: str
    composer_page: str
    title: str
    source_url: str
    relative_path: str

    def to_dict(self, license_blob: dict) -> dict:
        data = {
            "composer": self.composer,
            "composer_page": self.composer_page,
            "title": self.title,
            "source_url": self.source_url,
            "public_path": self.relative_path,
            "license": license_blob,
        }
        return data


def fetch_text(url: str) -> str:
    with urlopen(url) as resp:
        charset = resp.headers.get_content_charset() or "utf-8"
        return resp.read().decode(charset, errors="ignore")


def fetch_bytes(url: str) -> bytes:
    with urlopen(url) as resp:
        return resp.read()


def strip_html(html: str) -> str:
    text = TAG_RE.sub(" ", html)
    text = WHITESPACE_RE.sub(" ", text)
    return unescape(text).strip()


def extract_license_notice(html: str) -> str:
    plain = strip_html(html)
    match = re.search(
        r"The MIDI, audio.*?open source\.",
        plain,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if match:
        return match.group(0).strip()
    return plain


def collect_candidate_pages(index_html: str) -> List[str]:
    candidates = set()
    for href in ANCHOR_RE.findall(index_html):
        href = href.strip()
        if href.startswith(("http://", "https://", "mailto:")):
            continue
        if href.lower().startswith(("datenschutz", "copy", "impressum")):
            continue
        candidates.add(href)
    return sorted(candidates)


def extract_heading(html: str) -> str:
    match = re.search(r'<h1[^>]*>(.*?)</h1>', html, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return strip_html(match.group(1))


def extract_midi_links(html: str) -> List[Tuple[str, str]]:
    links: List[Tuple[str, str]] = []
    for href, inner in MIDI_LINK_RE.findall(html):
        title = strip_html(inner)
        if not title:
            title = Path(href).stem
        links.append((unescape(href), title))
    return links


def sanitize_relative_path(href: str) -> Path:
    clean_href = href.split("://", 1)[-1] if "://" in href else href
    clean_href = clean_href.split("midis/", 1)[-1] if "midis/" in clean_href else clean_href
    clean_href = clean_href.lstrip("/").split("?", 1)[0]
    clean_href = clean_href.split("#", 1)[0]
    rel_path = Path(clean_href)
    # Prevent escaping the destination root
    rel_path = Path(*[part for part in rel_path.parts if part not in ("..", "")])
    return rel_path


def ensure_destination(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)

def strip_diacritics(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def sanitize_filename_component(text: str) -> str:
    text = unescape(text or "")
    text = strip_diacritics(text)
    text = WHITESPACE_RE.sub(" ", text).strip()
    text = re.sub(r"[^A-Za-z0-9 _\-\.,]", "_", text)
    return text.strip(" _-.")

def enqueue_for_render(src: Path, composer: str, title: str, rel_path: Path) -> None:
    """Copy the MIDI into midi/video_queue/ with a deterministic, human-friendly name."""
    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)
    base_parts = [sanitize_filename_component(composer), sanitize_filename_component(title)]
    base = " - ".join([p for p in base_parts if p])
    if not base:
        base = sanitize_filename_component(rel_path.stem)
    if not base:
        base = rel_path.stem or "midi"
    base = base[:190]
    suffix = src.suffix.lower() or ".mid"
    candidate = QUEUE_ROOT / f"{base}{suffix}"
    dedupe = 1
    while candidate.exists():
        # Skip copying if an identically named file already exists
        try:
            if candidate.stat().st_size == src.stat().st_size:
                return
        except FileNotFoundError:
            pass
        candidate = QUEUE_ROOT / f"{base}_{dedupe}{suffix}"
        dedupe += 1
    shutil.copy2(src, candidate)
    print(f"Queued for rendering: {candidate}")


def build_license_blob(license_text: str) -> dict:
    return {
        "name": "Creative Commons Attribution-ShareAlike 3.0 Germany",
        "short": "CC BY-SA 3.0 DE",
        "url": "http://creativecommons.org/licenses/by-sa/3.0/de/deed.en",
        "attribution_name": "Bernd Krueger",
        "attribution_url": "http://www.piano-midi.de",
        "text": license_text,
    }


def main() -> int:
    index_html = fetch_text(MIDI_INDEX_URL)
    license_text = extract_license_notice(fetch_text(COPYRIGHT_URL))

    candidate_pages = collect_candidate_pages(index_html)
    DEST_ROOT.mkdir(parents=True, exist_ok=True)
    QUEUE_ROOT.mkdir(parents=True, exist_ok=True)

    entries: List[MidiEntry] = []
    seen_files = set()

    for relative in candidate_pages:
        page_url = urljoin(BASE_URL, relative)
        page_html = fetch_text(page_url)
        midi_links = extract_midi_links(page_html)
        if not midi_links:
            continue
        composer_name = extract_heading(page_html) or relative

        for href, title in midi_links:
            absolute_url = urljoin(page_url, href)
            rel_path = sanitize_relative_path(href)
            dest_path = DEST_ROOT / rel_path
            public_rel = str(Path("midi/public") / rel_path)

            if absolute_url in seen_files:
                continue
            seen_files.add(absolute_url)

            ensure_destination(dest_path)
            if dest_path.exists():
                print(f"Already exists, skipping download: {dest_path}")
            else:
                try:
                    data = fetch_bytes(absolute_url)
                except (HTTPError, URLError) as exc:
                    print(f"Failed to download {absolute_url}: {exc}")
                    continue
                with open(dest_path, "wb") as fh:
                    fh.write(data)
                print(f"Downloaded {absolute_url} -> {dest_path}")

            entries.append(
                MidiEntry(
                    composer=composer_name,
                    composer_page=page_url,
                    title=title,
                    source_url=absolute_url,
                    relative_path=public_rel.replace(os.sep, "/"),
                )
            )
            print(f"Downloaded {absolute_url} -> {dest_path}")
            enqueue_for_render(dest_path, composer_name, title, rel_path)

    license_blob = build_license_blob(license_text)

    with open(LICENSE_FILE, "w", encoding="utf-8") as fh:
        fh.write(
            "The MIDI files in this folder were downloaded from http://www.piano-midi.de "
            "and are licensed under the Creative Commons Attribution-ShareAlike 3.0 Germany "
            "license by Bernd Krueger.\n\n"
            f"{license_blob['text']}\n"
        )

    with open(INDEX_FILE, "w", encoding="utf-8") as fh:
        json.dump([entry.to_dict(license_blob) for entry in entries], fh, ensure_ascii=False, indent=2)

    print(f"Wrote metadata for {len(entries)} MIDI files to {INDEX_FILE}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
