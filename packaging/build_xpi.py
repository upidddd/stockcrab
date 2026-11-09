#!/usr/bin/env python3
"""Packs src/stockcrab into dist/stockcrab-<version>.xpi (a zip with manifest.json at its root)."""
import json, os, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(ROOT, "src", "stockcrab")
version = json.load(open(os.path.join(EXT, "manifest.json"), encoding="utf-8"))["version"]
os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
out = os.path.join(ROOT, "dist", f"stockcrab-{version}.xpi")
skip = {".DS_Store", "Thumbs.db"}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dirpath, dirs, files in os.walk(EXT):
        dirs.sort()
        for f in sorted(files):
            if f in skip:
                continue
            full = os.path.join(dirpath, f)
            z.write(full, os.path.relpath(full, EXT).replace(os.sep, "/"))
print(f"{out}  {os.path.getsize(out) / 1e6:.1f} MB")
