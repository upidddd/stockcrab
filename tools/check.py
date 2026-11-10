#!/usr/bin/env python3
"""Checks the extension before it is packed: every file the manifest names exists, every script is named in the manifest,
the JavaScript parses, and the engine files the registry points to are there. Exit code 1 if something is wrong."""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(ROOT, "src", "stockcrab")
problems = []

def need(path, why):
    if not os.path.exists(os.path.join(EXT, path)):
        problems.append(f"missing {path} ({why})")

manifest = json.load(open(os.path.join(EXT, "manifest.json"), encoding="utf-8"))
listed = []
for size, path in manifest.get("icons", {}).items():
    need(path, f"icon {size}")
for path in manifest["background"]["scripts"]:
    need(path, "background script")
    listed.append(path)
for cs in manifest["content_scripts"]:
    for path in cs["js"]:
        need(path, "content script")
        listed.append(path)
for res in manifest.get("web_accessible_resources", []):
    for pattern in res["resources"]:
        folder = pattern.split("*")[0].rstrip("/")
        need(folder, "web accessible folder")

# every script is in the manifest
for folder in ("background", "content", "data"):
    for dirpath, _, files in os.walk(os.path.join(EXT, folder)):
        for f in files:
            rel = os.path.relpath(os.path.join(dirpath, f), EXT).replace(os.sep, "/")
            if f.endswith(".js") and rel not in listed:
                problems.append(f"{rel} is not listed in manifest.json")
if len(listed) != len(set(listed)):
    problems.append("a script is listed twice in manifest.json")

# engine files exist
models = open(os.path.join(EXT, "background", "engine", "models.js"), encoding="utf-8").read()
for path in re.findall(r'file: "([^"]+)"', models):
    need(path, "engine build named in background/engine/models.js")

# JavaScript parses
node = shutil.which("node")
if node:
    for path in listed:
        if not os.path.exists(os.path.join(EXT, path)):
            continue
        r = subprocess.run([node, "--check", os.path.join(EXT, path)], capture_output=True, text=True)
        if r.returncode:
            problems.append(f"{path}: {r.stderr.strip().splitlines()[0] if r.stderr.strip() else 'syntax error'}")
else:
    print("note: node is not installed, the syntax check is skipped")

if problems:
    print("\n".join("PROBLEM: " + p for p in problems))
    sys.exit(1)
print(f"ok: {manifest['name']} {manifest['version']}: {len(manifest['content_scripts'][0]['js'])} content scripts, "
      f"{len(manifest['background']['scripts'])} background scripts, all files present")
