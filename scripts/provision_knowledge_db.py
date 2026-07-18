"""Provision the SmartGrow knowledge database into the runtime directory at deploy time.

The knowledge DB (``artifacts/knowledge/*.sqlite3``) is what backs the advisor's answer
quality. It is deliberately NOT committed to git (``artifacts/`` is gitignored) because it
is a large, license-bound build artifact: committing it would redistribute copyrighted /
internal source material and permanently bloat history. Instead, publish it to a PRIVATE
store you control and pull it in at deploy time, so every deployed instance serves the
same answers WITHOUT the data ever living in source control.

Flow
----
1. Build the DB locally (the app rebuilds it from ``data/`` on demand).
2. ``build-manifest`` — hash the DB files into ``knowledge_db_manifest.json``.
3. Upload the DB files + manifest to a private store: a mounted secret volume, private
   object storage, or a private GitHub Release asset. Never a public URL.
4. On deploy, ``provision`` reads the manifest, downloads each listed file into
   ``KNOWLEDGE_DB_DIR``, and verifies size + sha256. Fail-closed and idempotent.

This never inspects or transforms the DB contents; it only moves verified bytes into
place. The runtime ``corpus_quarantine`` layer remains the safety net that keeps
quarantined families out of served answers regardless of what a provisioned DB contains.

Standalone by design: depends only on the standard library plus ``httpx`` (already a
project dependency). It does not import the FastAPI app, so it runs in a minimal deploy
step before the app is configured.

Usage
-----
    # Locally, after the DB has been built:
    python scripts/provision_knowledge_db.py build-manifest

    # On deploy, from a mounted directory or a private https base URL:
    python scripts/provision_knowledge_db.py provision --source /mnt/knowledge
    python scripts/provision_knowledge_db.py provision --source https://private.example/knowledge

Environment
-----------
    KNOWLEDGE_DB_DIR    Target/source knowledge directory (default <repo>/artifacts/knowledge).
    KNOWLEDGE_DB_SOURCE Default --source for provisioning (private dir/file/https base).
    KNOWLEDGE_DB_TOKEN  Optional bearer token when the source is a private https endpoint.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

MANIFEST_NAME = "knowledge_db_manifest.json"
MANIFEST_SCHEMA = "knowledge-db-manifest-v1"

# Only these basenames may be published or provisioned. This blocks path traversal and any
# accidental pull of an unrelated file; it does not describe *what* the data is.
_ALLOWED_NAME = re.compile(r"^knowledge_(db|catalog)_[A-Za-z0-9_.-]+\.(sqlite3|json)$")
_DB_GLOB = "knowledge_db_*.sqlite3"
_CATALOG_GLOB = "knowledge_catalog_*.json"

_CHUNK = 1024 * 1024  # 1 MiB streaming chunk


class ProvisionError(RuntimeError):
    """A provisioning step failed. Carries an operator-readable reason."""


def _repo_root() -> Path:
    # scripts/ sits directly under the repo root.
    return Path(__file__).resolve().parents[1]


def default_knowledge_dir() -> Path:
    env = os.environ.get("KNOWLEDGE_DB_DIR")
    if env:
        return Path(env)
    return _repo_root() / "artifacts" / "knowledge"


def is_allowed_name(name: str) -> bool:
    """True only for a plain, allowlisted basename (no directory component)."""
    if not name or name != Path(name).name:
        return False
    return bool(_ALLOWED_NAME.match(name))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(_CHUNK), b""):
            digest.update(block)
    return digest.hexdigest()


# --------------------------------------------------------------------------------------
# build-manifest
# --------------------------------------------------------------------------------------

def build_manifest(source_dir: Path, *, include_catalogs: bool = True) -> dict[str, Any]:
    """Hash the DB (and optionally catalog) files in ``source_dir`` into a manifest dict."""
    if not source_dir.is_dir():
        raise ProvisionError(f"knowledge directory not found: {source_dir}")

    names: list[str] = sorted(p.name for p in source_dir.glob(_DB_GLOB) if p.is_file())
    if include_catalogs:
        names += sorted(p.name for p in source_dir.glob(_CATALOG_GLOB) if p.is_file())

    files: list[dict[str, Any]] = []
    for name in names:
        if not is_allowed_name(name):  # defensive; the globs already constrain this
            continue
        path = source_dir / name
        files.append({"name": name, "size": path.stat().st_size, "sha256": sha256_file(path)})

    if not files:
        raise ProvisionError(
            f"no knowledge DB files matched {_DB_GLOB} in {source_dir}. "
            "Build the DB before publishing a manifest."
        )

    return {
        "schema": MANIFEST_SCHEMA,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "files": files,
    }


def write_manifest(source_dir: Path, manifest: dict[str, Any]) -> Path:
    target = source_dir / MANIFEST_NAME
    target.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return target


# --------------------------------------------------------------------------------------
# provision
# --------------------------------------------------------------------------------------

def _validate_manifest(manifest: Any) -> list[dict[str, Any]]:
    if not isinstance(manifest, dict):
        raise ProvisionError("manifest is not a JSON object.")
    if manifest.get("schema") != MANIFEST_SCHEMA:
        raise ProvisionError(f"unexpected manifest schema: {manifest.get('schema')!r}")
    files = manifest.get("files")
    if not isinstance(files, list) or not files:
        raise ProvisionError("manifest has no files.")
    for entry in files:
        if not isinstance(entry, dict):
            raise ProvisionError("manifest file entry is not an object.")
        name = entry.get("name")
        sha = entry.get("sha256")
        if not isinstance(name, str) or not is_allowed_name(name):
            raise ProvisionError(f"manifest lists a disallowed file name: {name!r}")
        if not isinstance(sha, str) or not re.fullmatch(r"[0-9a-f]{64}", sha):
            raise ProvisionError(f"manifest entry for {name!r} has an invalid sha256.")
    return files


class _LocalSource:
    """A mounted directory or ``file://`` base holding the manifest and DB files."""

    def __init__(self, base: Path) -> None:
        self.base = base

    def read_manifest(self) -> Any:
        manifest_path = self.base / MANIFEST_NAME
        if not manifest_path.is_file():
            raise ProvisionError(f"manifest not found at source: {manifest_path}")
        return json.loads(manifest_path.read_text(encoding="utf-8"))

    def stream(self, name: str, sink: Callable[[bytes], None]) -> None:
        src = self.base / name
        if not src.is_file():
            raise ProvisionError(f"source file missing: {src}")
        with src.open("rb") as handle:
            for block in iter(lambda: handle.read(_CHUNK), b""):
                sink(block)


class _HttpSource:
    """A private https base URL holding the manifest and DB files."""

    def __init__(self, base_url: str, token: str | None) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}

    def _url(self, name: str) -> str:
        return f"{self.base_url}/{name}"

    def read_manifest(self) -> Any:
        import httpx

        try:
            response = httpx.get(self._url(MANIFEST_NAME), headers=self.headers, timeout=30.0)
            response.raise_for_status()
        except httpx.HTTPError as exc:  # pragma: no cover - network failure path
            raise ProvisionError(f"failed to fetch manifest: {exc}") from exc
        return response.json()

    def stream(self, name: str, sink: Callable[[bytes], None]) -> None:
        import httpx

        try:
            with httpx.stream(
                "GET", self._url(name), headers=self.headers, timeout=None
            ) as response:
                response.raise_for_status()
                for block in response.iter_bytes(_CHUNK):
                    sink(block)
        except httpx.HTTPError as exc:  # pragma: no cover - network failure path
            raise ProvisionError(f"failed to download {name}: {exc}") from exc


def _make_source(source: str, token: str | None) -> _LocalSource | _HttpSource:
    if source.startswith(("http://", "https://")):
        return _HttpSource(source, token)
    if source.startswith("file://"):
        # Minimal file:// support: strip scheme, tolerate a leading slash on Windows drives.
        raw = source[len("file://"):]
        if os.name == "nt" and re.match(r"^/[A-Za-z]:", raw):
            raw = raw[1:]
        return _LocalSource(Path(raw))
    return _LocalSource(Path(source))


def _download_verified(
    source: _LocalSource | _HttpSource,
    entry: dict[str, Any],
    target_dir: Path,
) -> str:
    """Stream one file into ``target_dir`` atomically, verifying size + sha256.

    Returns ``"provisioned"`` on download or ``"skipped"`` when an identical file already
    exists. Raises :class:`ProvisionError` on any mismatch, leaving no partial file.
    """
    name = entry["name"]
    expected_sha = entry["sha256"]
    dest = target_dir / name

    if dest.is_file() and sha256_file(dest) == expected_sha:
        return "skipped"

    digest = hashlib.sha256()
    size = 0
    tmp_fd, tmp_name = tempfile.mkstemp(prefix=f".{name}.", suffix=".part", dir=target_dir)
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(tmp_fd, "wb") as handle:
            def sink(block: bytes) -> None:
                nonlocal size
                size += len(block)
                digest.update(block)
                handle.write(block)

            source.stream(name, sink)

        actual_sha = digest.hexdigest()
        if actual_sha != expected_sha:
            raise ProvisionError(
                f"checksum mismatch for {name}: expected {expected_sha}, got {actual_sha}"
            )
        expected_size = entry.get("size")
        if isinstance(expected_size, int) and expected_size != size:
            raise ProvisionError(
                f"size mismatch for {name}: expected {expected_size}, got {size}"
            )
        os.replace(tmp_path, dest)
        return "provisioned"
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def provision(
    *,
    source: str,
    target_dir: Path,
    token: str | None = None,
    manifest: dict[str, Any] | None = None,
) -> dict[str, list[str]]:
    """Materialize every manifest-listed file into ``target_dir``, verified and idempotent.

    ``manifest`` overrides the source's manifest when provided (e.g. a locally-trusted
    copy). Returns a summary of provisioned vs skipped file names.
    """
    backend = _make_source(source, token)
    raw_manifest = manifest if manifest is not None else backend.read_manifest()
    files = _validate_manifest(raw_manifest)

    target_dir.mkdir(parents=True, exist_ok=True)

    provisioned: list[str] = []
    skipped: list[str] = []
    for entry in files:
        outcome = _download_verified(backend, entry, target_dir)
        (provisioned if outcome == "provisioned" else skipped).append(entry["name"])
    return {"provisioned": provisioned, "skipped": skipped}


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------

def _cmd_build_manifest(args: argparse.Namespace) -> int:
    source_dir = Path(args.dir) if args.dir else default_knowledge_dir()
    manifest = build_manifest(source_dir, include_catalogs=not args.no_catalogs)
    path = write_manifest(source_dir, manifest)
    total = sum(entry["size"] for entry in manifest["files"])
    print(f"Wrote {path} ({len(manifest['files'])} files, {total / 1e6:.1f} MB total)")
    for entry in manifest["files"]:
        print(f"  {entry['name']}  {entry['size'] / 1e6:8.1f} MB  {entry['sha256'][:12]}…")
    return 0


def _cmd_provision(args: argparse.Namespace) -> int:
    source = args.source or os.environ.get("KNOWLEDGE_DB_SOURCE")
    if not source:
        raise ProvisionError(
            "no source given. Pass --source or set KNOWLEDGE_DB_SOURCE "
            "(a mounted dir, file:// path, or private https base URL)."
        )
    target_dir = Path(args.target) if args.target else default_knowledge_dir()
    token = os.environ.get(args.token_env) if args.token_env else None

    local_manifest: dict[str, Any] | None = None
    if args.manifest:
        local_manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))

    summary = provision(source=source, target_dir=target_dir, token=token, manifest=local_manifest)
    print(
        f"Provisioned into {target_dir}: "
        f"{len(summary['provisioned'])} downloaded, {len(summary['skipped'])} already current."
    )
    for name in summary["provisioned"]:
        print(f"  + {name}")
    for name in summary["skipped"]:
        print(f"  = {name}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build-manifest", help="Hash local DB files into a manifest.")
    build.add_argument("--dir", help="Knowledge directory (default: KNOWLEDGE_DB_DIR or repo artifacts/knowledge).")
    build.add_argument("--no-catalogs", action="store_true", help="Exclude knowledge_catalog_*.json from the manifest.")
    build.set_defaults(func=_cmd_build_manifest)

    prov = sub.add_parser("provision", help="Download + verify DB files from a private source.")
    prov.add_argument("--source", help="Private dir / file:// path / https base URL (default: KNOWLEDGE_DB_SOURCE).")
    prov.add_argument("--target", help="Target knowledge directory (default: KNOWLEDGE_DB_DIR or repo artifacts/knowledge).")
    prov.add_argument("--manifest", help="Local manifest JSON to trust instead of the source's manifest.")
    prov.add_argument("--token-env", default="KNOWLEDGE_DB_TOKEN", help="Env var holding a bearer token for https sources.")
    prov.set_defaults(func=_cmd_provision)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ProvisionError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
