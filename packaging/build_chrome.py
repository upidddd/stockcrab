#!/usr/bin/env python3
"""Builds the Chrome version from the same sources: dist/chrome/ (load it unpacked) and dist/stockcrab-chrome-<version>.zip.

The Firefox manifest (src/stockcrab/manifest.json) is the source of truth: the Chrome manifest and the offscreen
document are generated from it, so both versions always load the same scripts in the same order.
--test-origin http://127.0.0.1:8000/* also runs the content scripts on that origin (for local tests only)."""
import argparse, json, os, shutil, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src", "stockcrab")
PLATFORM = os.path.join(ROOT, "platforms", "chrome")
OUT = os.path.join(ROOT, "dist", "chrome")

ap = argparse.ArgumentParser()
ap.add_argument("--test-origin", action="append", default=[])
ap.add_argument("--no-zip", action="store_true")
args = ap.parse_args()

ff = json.load(open(os.path.join(SRC, "manifest.json"), encoding="utf-8"))
shutil.rmtree(OUT, ignore_errors=True)
shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns("manifest.json", ".DS_Store"))
os.makedirs(os.path.join(OUT, "chrome"), exist_ok=True)
for f in ("browser-shim.js", "offscreen-shim.js", "service-worker.js", "page-fen.js"):
    shutil.copy(os.path.join(PLATFORM, f), os.path.join(OUT, "chrome", f))

# the engine host: the Firefox background scripts, in the same order, behind the shim
tags = "\n".join(f'<script src="../{p}"></script>' for p in ["chrome/offscreen-shim.js"] + ff["background"]["scripts"])
open(os.path.join(OUT, "chrome", "offscreen.html"), "w", encoding="utf-8").write(
    f'<!doctype html>\n<meta charset="utf-8">\n<title>StockCrab engine</title>\n{tags}\n')

cs = ff["content_scripts"][0]
matches = cs["matches"] + args.test_origin
chess_com = [m for m in cs["matches"] if "chess.com" in m] + args.test_origin
manifest = {
    "manifest_version": 3,
    "name": ff["name"],
    "version": ff["version"],
    "description": ff["description"],
    "homepage_url": ff.get("homepage_url"),
    "icons": ff["icons"],
    "minimum_chrome_version": "116",
    "background": {"service_worker": "chrome/service-worker.js"},
    "permissions": sorted(set(ff.get("permissions", []) + ["offscreen"])),
    "content_security_policy": ff["content_security_policy"],
    "content_scripts": [
        {"js": ["chrome/browser-shim.js"] + cs["js"], "matches": matches},
        {"js": ["chrome/page-fen.js"], "matches": chess_com, "world": "MAIN"},
    ],
}
if ff.get("web_accessible_resources"):
    manifest["web_accessible_resources"] = [{"resources": r["resources"], "matches": r["matches"] + args.test_origin} for r in ff["web_accessible_resources"]]
manifest = {k: v for k, v in manifest.items() if v is not None}
json.dump(manifest, open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8"), indent=2)

# every file the manifest and the offscreen document name must be there
missing = [p for p in manifest["content_scripts"][0]["js"] + manifest["content_scripts"][1]["js"] + ["chrome/service-worker.js"] + ff["background"]["scripts"]
           if not os.path.exists(os.path.join(OUT, p))]
if missing:
    sys.exit("missing in the Chrome build: " + ", ".join(missing))

print(f"{OUT}  (Chrome: chrome://extensions -> Developer mode -> Load unpacked)")
if not args.no_zip and not args.test_origin:
    out = os.path.join(ROOT, "dist", f"stockcrab-chrome-{ff['version']}.zip")
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for dirpath, dirs, files in os.walk(OUT):
            dirs.sort()
            for f in sorted(files):
                full = os.path.join(dirpath, f)
                z.write(full, os.path.relpath(full, OUT).replace(os.sep, "/"))
    print(f"{out}  {os.path.getsize(out) / 1e6:.1f} MB")
