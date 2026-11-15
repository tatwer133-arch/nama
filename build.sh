#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path, PurePosixPath
from io import BytesIO
from html.parser import HTMLParser
import base64, hashlib, json, re, shutil, subprocess, zipfile

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

with zipfile.ZipFile(BytesIO(archive_bytes)) as zf:
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
        path = PurePosixPath(name)
        if path.is_absolute() or ".." in path.parts:
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

# Apply reviewed source fixes without modifying the immutable, checksum-verified upload.
overrides = Path("site-overrides")
allowed_overrides = {"sw.js", "manifest.json", "patch-index.py", "studio.html", "studio.css", "studio.js", "avatar-runtime.js", "avatar-realistic.webp.b64", "avatar-assets.zip"}
if overrides.exists():
    for candidate in sorted(overrides.rglob("*")):
        if candidate.is_dir():
            continue
        relative = candidate.relative_to(overrides).as_posix()
        if relative not in allowed_overrides:
            raise SystemExit(f"Unexpected site override: {relative}")
        if relative in {"sw.js", "manifest.json"}:
            shutil.copy2(candidate, public / relative)
        elif relative == "avatar-realistic.webp.b64":
            image_bytes = base64.b64decode(candidate.read_text(encoding="ascii").strip(), validate=True)
            if not image_bytes.startswith(b"RIFF") or image_bytes[8:12] != b"WEBP":
                raise SystemExit("Realistic avatar asset is not a valid WebP image")
            avatar_sha256 = hashlib.sha256(image_bytes).hexdigest()
            expected_avatar_sha256 = "bd57545e240e8b1aa92bd9737f711b8b1647e2f4c4edf6d283aaa633a54b8db7"
            if avatar_sha256 != expected_avatar_sha256:
                raise SystemExit(f"Transparent avatar asset checksum mismatch: {avatar_sha256}")
            if len(image_bytes) != 22918:
                raise SystemExit(f"Unexpected transparent avatar byte length: {len(image_bytes)}")
            (public / "avatar-realistic.webp").write_bytes(image_bytes)
        elif relative == "avatar-assets.zip":
            avatar_archive = candidate.read_bytes()
            expected_assets_sha256 = "d7fb8c845981f6def12471e72aca786004c01a1133aec10bc8bdfaa709abbafe"
            actual_assets_sha256 = hashlib.sha256(avatar_archive).hexdigest()
            if actual_assets_sha256 != expected_assets_sha256:
                raise SystemExit(f"Avatar assets archive checksum mismatch: {actual_assets_sha256}")
            with zipfile.ZipFile(BytesIO(avatar_archive)) as avatar_zip:
                bad_avatar = avatar_zip.testzip()
                if bad_avatar is not None:
                    raise SystemExit(f"Corrupt avatar asset: {bad_avatar}")
                expected_names = {
                    "avatar-female.webp", "avatar-male-tshirt.webp",
                    "avatar-male-hoodie.webp", "avatar-male-jacket.webp",
                    "portrait-girl.webp", "portrait-woman-young.webp",
                    "portrait-woman-senior.webp", "portrait-boy.webp",
                    "portrait-man-young.webp", "portrait-man-senior.webp",
                    "manifest.json"
                }
                asset_names = set(avatar_zip.namelist())
                if asset_names != expected_names:
                    raise SystemExit(f"Avatar asset set mismatch: {sorted(asset_names)}")
                for asset_name in sorted(expected_names - {"manifest.json"}):
                    asset_bytes = avatar_zip.read(asset_name)
                    if not asset_bytes.startswith(b"RIFF") or asset_bytes[8:12] != b"WEBP":
                        raise SystemExit(f"Invalid WebP avatar asset: {asset_name}")
                    (public / asset_name).write_bytes(asset_bytes)
                avatar_manifest = json.loads(avatar_zip.read("manifest.json").decode("utf-8"))
                for asset_name in expected_names - {"manifest.json"}:
                    if asset_name not in avatar_manifest:
                        raise SystemExit(f"Avatar asset missing from manifest: {asset_name}")
    patcher = overrides / "patch-index.py"
    if patcher.is_file():
        subprocess.run(["python3", str(patcher), str(public)], check=True)

manifest_path = public / "manifest.json"
with manifest_path.open(encoding="utf-8") as f:
    manifest = json.load(f)
if manifest.get("start_url") != "./" or manifest.get("scope") != "./":
    raise SystemExit("PWA manifest must use project-relative start_url and scope")
if not manifest.get("icons") or manifest["icons"][0].get("src") != "./icon.svg":
    raise SystemExit("PWA manifest icon path must be project-relative")

for filename in ("index.html", "sw.js", "manifest.json", "icon.svg", "avatar-realistic.webp", "avatar-female.webp", "avatar-male-tshirt.webp", "avatar-male-hoodie.webp", "avatar-male-jacket.webp", "portrait-girl.webp", "portrait-woman-young.webp", "portrait-woman-senior.webp", "portrait-boy.webp", "portrait-man-young.webp", "portrait-man-senior.webp"):
    if not (public / filename).is_file():
        raise SystemExit(f"Build output missing: {filename}")

html = (public / "index.html").read_text(encoding="utf-8")
if 'href="./manifest.json"' not in html or 'href="./icon.svg"' not in html:
    raise SystemExit("HTML app-shell asset paths must be project-relative")
if "serviceWorker.register(new URL('sw.js',appBase)" not in html:
    raise SystemExit("Service worker registration must respect the project subpath")

class IdCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
    def handle_starttag(self, tag, attrs):
        value = dict(attrs).get("id")
        if value:
            self.ids.append(value)

collector = IdCollector()
collector.feed(html)
seen, duplicates = set(), set()
for value in collector.ids:
    if value in seen:
        duplicates.add(value)
    seen.add(value)
if duplicates:
    raise SystemExit(f"Duplicate HTML IDs: {sorted(duplicates)}")

scripts = re.findall(r"<script(?:\s[^>]*)?>(.*?)</script>", html, re.S | re.I)
if len(scripts) != 1:
    raise SystemExit(f"Expected one inline application script, found {len(scripts)}")
if shutil.which("node"):
    app_script = Path("/tmp/nama-app-check.js")
    app_script.write_text(scripts[0], encoding="utf-8")
    subprocess.run(["node", "--check", str(app_script)], check=True)
    subprocess.run(["node", "--check", str(public / "sw.js")], check=True)

print("Nama build + static QA passed. Original source archive SHA-256:", actual_sha256)
print("HTML IDs:", len(collector.ids), "(unique)")
print("Published files:", ", ".join(sorted(p.name for p in public.iterdir())))
PY
