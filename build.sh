#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path, PurePosixPath
from io import BytesIO
import base64, hashlib, json, shutil, zipfile

expected_sha256 = "9365397a6a1c2db35e3bfb53b4d5e7d29d8a4226428d713ffd1795659b1f7615"
expected_parts = [
    "001.b64", "002a.b64", "002b.b64", "003.b64", "004.b64",
    "005.b64", "006.b64", "007.b64", "008.b64", "009a.b64",
    "009b.b64", "010.b64", "011.b64", "012.b64", "013.b64",
]

parts_dir = Path(".deploy")
parts = sorted(parts_dir.glob("*.b64"))
actual_parts = [p.name for p in parts]
if actual_parts != expected_parts:
    raise SystemExit(f"Deployment bundle segments mismatch: {actual_parts!r}")

encoded = "".join(p.read_text(encoding="ascii").strip() for p in parts)
archive_bytes = base64.b64decode(encoded, validate=True)
actual_sha256 = hashlib.sha256(archive_bytes).hexdigest()
if actual_sha256 != expected_sha256:
    raise SystemExit(f"Source ZIP checksum mismatch: {actual_sha256}")

bundle = BytesIO(archive_bytes)
with zipfile.ZipFile(bundle) as zf:
    bad_member = zf.testzip()
    if bad_member is not None:
        raise SystemExit(f"Corrupt ZIP member: {bad_member}")
    names = set(zf.namelist())
    required = {
        "nama-work/index.html",
        "nama-work/sw.js",
        "nama-work/manifest.json",
        "nama-work/icon.svg",
    }
    missing = required - names
    if missing:
        raise SystemExit(f"Required app files are missing: {sorted(missing)}")
    for name in names:
        p = PurePosixPath(name)
        if p.is_absolute() or ".." in p.parts:
            raise SystemExit(f"Unsafe archive path: {name}")
    stage = Path("/tmp/nama-unpacked")
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    zf.extractall(stage)

source = Path("/tmp/nama-unpacked/nama-work")
public = Path("public")
if public.exists():
    shutil.rmtree(public)
shutil.copytree(source, public)

with (public / "manifest.json").open(encoding="utf-8") as f:
    json.load(f)

for filename in ("index.html", "sw.js", "manifest.json", "icon.svg"):
    if not (public / filename).is_file():
        raise SystemExit(f"Build output missing: {filename}")

print("Nama build verified. Original source archive SHA-256:", actual_sha256)
print("Published files:", ", ".join(sorted(p.name for p in public.iterdir())))
PY
