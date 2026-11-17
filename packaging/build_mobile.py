#!/usr/bin/env python3
"""Builds StockCrab Lite, the light build for phones, from the same sources: dist/mobile/ and dist/stockcrab-lite-<version>.xpi.

Only the small engines go in (Stockfish 19 Lite, Quick and JavaScript, a few MB instead of a few hundred), build.js says
"mobile" (a panel sized for fingers along the bottom of the screen, no cursor trail, HUD or hotkey) and the add-on has
its own id, so it installs next to the full version. --chrome also writes dist/stockcrab-lite-chrome-<version>.zip."""
import argparse, json, os, re, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "stockcrab")
OUT = os.path.join(ROOT, "dist", "mobile")
MOBILE_ID = "stockcrab-lite@local"

ap = argparse.ArgumentParser()
ap.add_argument("--chrome", action="store_true")
args = ap.parse_args()

# the engine files of the models marked `mobile: true`, plus the licence
models = open(os.path.join(SRC, "background", "engine", "models.js"), encoding="utf-8").read()
engines = {m.group(1) for m in re.finditer(r'file: "([^"]+)"[^\n]*mobile: true', models)}
if not engines:
    sys.exit("no model is marked mobile: true in background/engine/models.js")
keep = set()
for f in engines:
    keep.add(f)
    wasm = f[: -len(".js")] + ".wasm"
    if os.path.exists(os.path.join(SRC, wasm)):
        keep.add(wasm)
keep.add("engine/COPYING.txt")

def ignore(dirpath, names):
    rel = os.path.relpath(dirpath, SRC).replace(os.sep, "/")
    out = {".DS_Store", "Thumbs.db"}
    if rel == "engine" or rel.startswith("engine/"):
        for n in names:
            p = f"{rel}/{n}"
            if os.path.isdir(os.path.join(dirpath, n)) or p not in keep:
                out.add(n)
    return out

shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(SRC, OUT, ignore=ignore)

build = os.path.join(OUT, "build.js")
text = open(build, encoding="utf-8").read()
if 'const BUILD = "desktop";' not in text:
    sys.exit("build.js does not say const BUILD = \"desktop\";")
open(build, "w", encoding="utf-8").write(text.replace('const BUILD = "desktop";', 'const BUILD = "mobile";'))

manifest = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
manifest["name"] = "StockCrab Lite"
manifest["description"] = "The light StockCrab for phones: Stockfish move hints for chess.com and lichess.org."
gecko = manifest["browser_specific_settings"]["gecko"]
gecko["id"] = MOBILE_ID
manifest["browser_specific_settings"]["gecko_android"] = {"strict_min_version": "120.0"}
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"), indent=2)

missing = [f for f in sorted(keep) if not os.path.exists(os.path.join(OUT, f))]
missing += [p for p in manifest["background"]["scripts"] + manifest["content_scripts"][0]["js"] if not os.path.exists(os.path.join(OUT, p))]
if missing:
    sys.exit("missing in the light build: " + ", ".join(missing))

version = manifest["version"]
xpi = os.path.join(ROOT, "dist", f"stockcrab-lite-{version}.xpi")
with zipfile.ZipFile(xpi, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for dirpath, dirs, files in os.walk(OUT):
        dirs.sort()
        for f in sorted(files):
            full = os.path.join(dirpath, f)
            z.write(full, os.path.relpath(full, OUT).replace(os.sep, "/"))
print(f"{xpi}  {os.path.getsize(xpi) / 1e6:.1f} MB")

if args.chrome:
    subprocess.run([sys.executable, os.path.join(ROOT, "packaging", "build_chrome.py"), "--src", OUT, "--out", os.path.join(ROOT, "dist", "chrome-lite"),
                    "--zip-name", "stockcrab-lite-chrome"], check=True)
