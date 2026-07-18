"""Tests for scripts/provision_knowledge_db.py (deploy-time knowledge DB provisioning)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "provision_knowledge_db.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("provision_knowledge_db", _SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


prov = _load_module()


def _write_db(directory: Path, name: str, payload: bytes = b"SQLite format 3\x00fake") -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / name
    path.write_bytes(payload)
    return path


def test_is_allowed_name_accepts_db_and_catalog_only():
    assert prov.is_allowed_name("knowledge_db_tomato.sqlite3")
    assert prov.is_allowed_name("knowledge_catalog_all.json")
    # Traversal and unrelated names are rejected.
    assert not prov.is_allowed_name("../secret.sqlite3")
    assert not prov.is_allowed_name("knowledge_db_tomato.sqlite3/../x")
    assert not prov.is_allowed_name("passwords.txt")
    assert not prov.is_allowed_name("knowledge_db_.exe")


def test_build_manifest_hashes_db_files_and_skips_strays(tmp_path: Path):
    source = tmp_path / "knowledge"
    db = _write_db(source, "knowledge_db_tomato.sqlite3", b"tomato-bytes")
    _write_db(source, "unrelated.bin", b"nope")

    manifest = prov.build_manifest(source, include_catalogs=True)

    assert manifest["schema"] == prov.MANIFEST_SCHEMA
    names = [entry["name"] for entry in manifest["files"]]
    assert names == ["knowledge_db_tomato.sqlite3"]  # stray excluded
    entry = manifest["files"][0]
    assert entry["size"] == db.stat().st_size
    assert entry["sha256"] == prov.sha256_file(db)


def test_build_manifest_rejects_empty_directory(tmp_path: Path):
    empty = tmp_path / "empty"
    empty.mkdir()
    with pytest.raises(prov.ProvisionError):
        prov.build_manifest(empty)


def test_provision_copies_and_verifies_then_is_idempotent(tmp_path: Path):
    source = tmp_path / "store"
    _write_db(source, "knowledge_db_tomato.sqlite3", b"tomato")
    _write_db(source, "knowledge_db_cucumber.sqlite3", b"cucumber")
    prov.write_manifest(source, prov.build_manifest(source, include_catalogs=False))

    target = tmp_path / "artifacts" / "knowledge"

    first = prov.provision(source=str(source), target_dir=target)
    assert sorted(first["provisioned"]) == ["knowledge_db_cucumber.sqlite3", "knowledge_db_tomato.sqlite3"]
    assert first["skipped"] == []
    assert (target / "knowledge_db_tomato.sqlite3").read_bytes() == b"tomato"

    # Second run: identical files already present -> everything skipped, nothing re-downloaded.
    second = prov.provision(source=str(source), target_dir=target)
    assert second["provisioned"] == []
    assert sorted(second["skipped"]) == ["knowledge_db_cucumber.sqlite3", "knowledge_db_tomato.sqlite3"]


def test_provision_rejects_tampered_checksum_and_leaves_no_partial(tmp_path: Path):
    source = tmp_path / "store"
    _write_db(source, "knowledge_db_tomato.sqlite3", b"original")
    prov.write_manifest(source, prov.build_manifest(source, include_catalogs=False))

    # Tamper with the source bytes AFTER the manifest was hashed.
    (source / "knowledge_db_tomato.sqlite3").write_bytes(b"tampered-different-length")

    target = tmp_path / "artifacts" / "knowledge"
    with pytest.raises(prov.ProvisionError, match="checksum mismatch"):
        prov.provision(source=str(source), target_dir=target)

    # Fail-closed: no file and no leftover .part temp in the target.
    assert not (target / "knowledge_db_tomato.sqlite3").exists()
    assert list(target.glob("*.part")) == []


def test_provision_rejects_disallowed_name_in_manifest(tmp_path: Path):
    source = tmp_path / "store"
    _write_db(source, "knowledge_db_tomato.sqlite3", b"ok")
    tampered_manifest = {
        "schema": prov.MANIFEST_SCHEMA,
        "generated_at": "2026-07-18T00:00:00+00:00",
        "files": [{"name": "../etc/passwd", "size": 3, "sha256": "0" * 64}],
    }

    target = tmp_path / "artifacts" / "knowledge"
    with pytest.raises(prov.ProvisionError, match="disallowed file name"):
        prov.provision(source=str(source), target_dir=target, manifest=tampered_manifest)


def test_provision_rejects_unknown_manifest_schema(tmp_path: Path):
    with pytest.raises(prov.ProvisionError, match="schema"):
        prov.provision(
            source=str(tmp_path),
            target_dir=tmp_path / "out",
            manifest={"schema": "something-else", "files": [{"name": "knowledge_db_x.sqlite3", "sha256": "0" * 64}]},
        )
