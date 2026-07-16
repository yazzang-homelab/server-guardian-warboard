#!/usr/bin/env python3
"""Create and verify deterministic video-asset quality manifests.

The CLI only records file metadata (path, byte count, and SHA-256). It never
prints file contents or input JSON values, so failed validation cannot expose a
secret supplied by mistake.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any


SCHEMA_CANDIDATE = "asset-quality/candidate/v1"
SCHEMA_RELEASE = "asset-quality/release/v1"
SCHEMA_VERIFICATION = "asset-quality/verification/v1"
SCHEMA_SCORE = "asset-quality/score/v1"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
VISUAL_ROWS = (
    ("composition", 26),
    ("legibility", 14),
    ("motion", 14),
    ("consistency", 13),
    ("evidence", 20),
    ("finish", 13),
)
ROW_THRESHOLD = 80
TOTAL_THRESHOLD = 85


class CommandError(Exception):
    """An expected, non-sensitive command-line error."""


def no_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate JSON object key")
        result[key] = value
    return result


def reject_non_finite(_value: str) -> None:
    raise ValueError("non-finite JSON number")


def load_json_object(path: Path) -> tuple[Path, dict[str, Any]]:
    """Load one UTF-8 JSON object without echoing its path or contents."""
    try:
        resolved = path.expanduser().resolve(strict=True)
        with resolved.open("r", encoding="utf-8") as handle:
            value = json.load(
                handle,
                object_pairs_hook=no_duplicate_keys,
                parse_constant=reject_non_finite,
            )
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        raise CommandError("cannot read a valid UTF-8 JSON input object") from error
    if not isinstance(value, dict):
        raise CommandError("the JSON input root must be an object")
    return resolved, value


def canonical_json(value: Any) -> bytes:
    """Emit the compact UTF-8 JSON form used for manifests and result objects."""
    try:
        return json.dumps(
            value,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as error:
        raise CommandError("cannot serialize canonical JSON") from error


def manifest_hash(manifest: dict[str, Any]) -> str:
    """Hash a manifest while excluding its top-level self_sha256 field."""
    unsigned = {key: value for key, value in manifest.items() if key != "self_sha256"}
    return hashlib.sha256(canonical_json(unsigned)).hexdigest()


def add_self_hash(manifest: dict[str, Any]) -> dict[str, Any]:
    result = dict(manifest)
    result["self_sha256"] = manifest_hash(result)
    return result


def atomic_write_json(path: Path, value: Any) -> None:
    """Write canonical JSON through a restrictive temporary file and atomic rename."""
    data = canonical_json(value)
    requested = path.expanduser()
    if not requested.name:
        raise CommandError("output must name a file")
    try:
        parent = requested.parent.resolve(strict=True)
    except OSError as error:
        raise CommandError("output directory is unavailable") from error
    if not parent.is_dir():
        raise CommandError("output directory is unavailable")
    destination = parent / requested.name
    temporary_name: str | None = None
    descriptor: int | None = None
    try:
        descriptor, temporary_name = tempfile.mkstemp(
            prefix=f".{destination.name}.", suffix=".tmp", dir=parent
        )
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb", closefd=True) as handle:
            descriptor = None
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary_name, destination)
        temporary_name = None
        try:
            directory_descriptor = os.open(parent, os.O_RDONLY | os.O_DIRECTORY)
        except (AttributeError, OSError):
            directory_descriptor = None
        if directory_descriptor is not None:
            try:
                os.fsync(directory_descriptor)
            finally:
                os.close(directory_descriptor)
    except OSError as error:
        raise CommandError("cannot write output atomically") from error
    finally:
        if descriptor is not None:
            os.close(descriptor)
        if temporary_name is not None:
            try:
                os.unlink(temporary_name)
            except OSError:
                pass


def output_path(value: str) -> Path:
    requested = Path(value).expanduser()
    if not requested.name:
        raise CommandError("output must name a file")
    try:
        parent = requested.parent.resolve(strict=True)
    except OSError as error:
        raise CommandError("output directory is unavailable") from error
    if not parent.is_dir():
        raise CommandError("output directory is unavailable")
    return parent / requested.name


def ensure_distinct_input_output(input_path: Path, output: Path | None) -> None:
    if output is not None and input_path == output:
        raise CommandError("input and output must be different files")


def require_object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CommandError(f"{label} must be an object")
    return value


def require_list(value: Any, label: str, non_empty: bool = True) -> list[Any]:
    if not isinstance(value, list) or (non_empty and not value):
        qualifier = "a non-empty array" if non_empty else "an array"
        raise CommandError(f"{label} must be {qualifier}")
    return value


def require_text(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip() or "\x00" in value:
        raise CommandError(f"{label} must be a non-empty string")
    return value


def source_value(value: Any, label: str) -> str:
    if isinstance(value, str):
        return require_text(value, f"{label} source")
    record = require_object(value, label)
    if "source" not in record:
        raise CommandError(f"{label} source is required")
    return require_text(record["source"], f"{label} source")


def resolve_source(raw_source: str, base: Path, label: str) -> Path:
    source = Path(raw_source).expanduser()
    if not source.is_absolute():
        source = base / source
    try:
        resolved = source.resolve(strict=True)
        if not resolved.is_file():
            raise OSError("not a regular file")
        return resolved
    except (OSError, ValueError) as error:
        raise CommandError(f"{label} source cannot be read") from error


def source_from_spec(value: Any, base: Path, label: str) -> Path:
    return resolve_source(source_value(value, label), base, label)


def portable_source(path: Path, manifest_directory: Path) -> str:
    try:
        return os.path.relpath(path, start=manifest_directory).replace(os.sep, "/")
    except ValueError as error:
        raise CommandError("cannot make a portable manifest source path") from error


def digest_file(path: Path, label: str) -> tuple[str, int]:
    digest = hashlib.sha256()
    byte_count = 0
    try:
        with path.open("rb") as handle:
            while chunk := handle.read(1024 * 1024):
                digest.update(chunk)
                byte_count += len(chunk)
    except OSError as error:
        raise CommandError(f"{label} source cannot be read") from error
    return digest.hexdigest(), byte_count


def file_record(path: Path, manifest_directory: Path, label: str) -> dict[str, Any]:
    digest, byte_count = digest_file(path, label)
    return {
        "source": portable_source(path, manifest_directory),
        "sha256": digest,
        "bytes": byte_count,
    }


def app_spec_value(spec: dict[str, Any], key: str, flat_key: str) -> Any:
    app = spec.get("app")
    if app is not None:
        app_object = require_object(app, "app")
        if key in app_object:
            return app_object[key]
    if flat_key in spec:
        return spec[flat_key]
    raise CommandError(f"app {key} source is required")


def artifact_records(
    value: Any,
    base: Path,
    manifest_directory: Path,
    label: str,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_roles: set[str] = set()
    for index, item in enumerate(require_list(value, label)):
        item_label = f"{label} artifact {index + 1}"
        item_object = require_object(item, item_label)
        role = require_text(item_object.get("role"), f"{item_label} role")
        if role in seen_roles:
            raise CommandError(f"{label} artifact roles must be unique")
        seen_roles.add(role)
        record = file_record(source_from_spec(item_object, base, item_label), manifest_directory, item_label)
        record["role"] = role
        records.append(record)
    return sorted(records, key=lambda record: record["role"])


def tooling_records(
    value: Any,
    base: Path,
    manifest_directory: Path,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_names: set[str] = set()
    for index, item in enumerate(require_list(value, "tooling")):
        item_label = f"tooling item {index + 1}"
        item_object = require_object(item, item_label)
        name = require_text(item_object.get("name"), f"{item_label} name")
        if name in seen_names:
            raise CommandError("tooling names must be unique")
        seen_names.add(name)
        record = file_record(source_from_spec(item_object, base, item_label), manifest_directory, item_label)
        record["name"] = name
        records.append(record)
    return sorted(records, key=lambda record: record["name"])


def expected_modes(spec: dict[str, Any]) -> Any:
    if "expected_exact_modes" in spec:
        modes = spec["expected_exact_modes"]
    elif "expected_modes" in spec:
        modes = spec["expected_modes"]
    else:
        raise CommandError("expected_exact_modes is required")
    if not isinstance(modes, (dict, list)) or not modes:
        raise CommandError("expected_exact_modes must be a non-empty object or array")
    return modes


def build_candidate(spec: dict[str, Any], input_directory: Path, manifest_directory: Path) -> dict[str, Any]:
    html = source_from_spec(app_spec_value(spec, "html", "app_html"), input_directory, "app html")
    atlas = source_from_spec(app_spec_value(spec, "atlas", "atlas"), input_directory, "app atlas")
    fixture = source_from_spec(spec.get("fixture"), input_directory, "fixture")
    manifest = {
        "schema": SCHEMA_CANDIDATE,
        "app": {
            "html": file_record(html, manifest_directory, "app html"),
            "atlas": file_record(atlas, manifest_directory, "app atlas"),
        },
        "expected_exact_modes": expected_modes(spec),
        "fixture": file_record(fixture, manifest_directory, "fixture"),
        "baseline_artifacts": artifact_records(
            spec.get("baseline_artifacts"),
            input_directory,
            manifest_directory,
            "baseline_artifacts",
        ),
        "mask_artifacts": artifact_records(
            spec.get("mask_artifacts"),
            input_directory,
            manifest_directory,
            "mask_artifacts",
        ),
        "tooling": tooling_records(spec.get("tooling"), input_directory, manifest_directory),
    }
    return add_self_hash(manifest)


def valid_sha256(value: Any) -> bool:
    return isinstance(value, str) and SHA256_RE.fullmatch(value) is not None


def valid_bytes(value: Any) -> bool:
    return type(value) is int and value >= 0


def valid_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip()) and "\x00" not in value


def validate_digest_record(value: Any, label: str, errors: list[str]) -> bool:
    if not isinstance(value, dict):
        errors.append(f"{label}.missing_fields")
        return False
    valid = True
    if not valid_text(value.get("source")):
        errors.append(f"{label}.source_missing")
        valid = False
    if not valid_sha256(value.get("sha256")):
        errors.append(f"{label}.sha256_missing")
        valid = False
    if not valid_bytes(value.get("bytes")):
        errors.append(f"{label}.bytes_missing")
        valid = False
    return valid


def validate_named_records(
    value: Any,
    label: str,
    field: str,
    errors: list[str],
) -> bool:
    if not isinstance(value, list) or not value:
        errors.append(f"{label}.missing")
        return False
    valid = True
    seen: set[str] = set()
    for index, record in enumerate(value):
        item_label = f"{label}.{index}"
        record_valid = validate_digest_record(record, item_label, errors)
        name: Any = None
        if isinstance(record, dict):
            name = record.get(field)
        if not valid_text(name):
            errors.append(f"{item_label}.{field}_missing")
            record_valid = False
        elif name in seen:
            errors.append(f"{item_label}.{field}_duplicate")
            record_valid = False
        else:
            seen.add(name)
        valid = valid and record_valid
    return valid


def validate_self_hash(manifest: dict[str, Any], errors: list[str]) -> bool:
    recorded = manifest.get("self_sha256")
    if not valid_sha256(recorded):
        errors.append("self_sha256_missing")
        return False
    if not hmac.compare_digest(recorded, manifest_hash(manifest)):
        errors.append("self_sha256_mismatch")
        return False
    return True


def validate_candidate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if manifest.get("schema") != SCHEMA_CANDIDATE:
        errors.append("candidate.schema_invalid")
    app = manifest.get("app")
    if not isinstance(app, dict):
        errors.append("candidate.app.missing")
    else:
        validate_digest_record(app.get("html"), "candidate.app.html", errors)
        validate_digest_record(app.get("atlas"), "candidate.app.atlas", errors)
    modes = manifest.get("expected_exact_modes")
    if not isinstance(modes, (dict, list)) or not modes:
        errors.append("candidate.expected_exact_modes_missing")
    validate_digest_record(manifest.get("fixture"), "candidate.fixture", errors)
    validate_named_records(manifest.get("baseline_artifacts"), "candidate.baseline_artifacts", "role", errors)
    validate_named_records(manifest.get("mask_artifacts"), "candidate.mask_artifacts", "role", errors)
    validate_named_records(manifest.get("tooling"), "candidate.tooling", "name", errors)
    validate_self_hash(manifest, errors)
    return errors


def verify_file_record(record: dict[str, Any], base: Path, label: str, errors: list[str]) -> None:
    try:
        path = resolve_source(record["source"], base, label)
        actual_digest, actual_bytes = digest_file(path, label)
    except (CommandError, KeyError, TypeError):
        errors.append(f"{label}.unreadable")
        return
    if actual_bytes != record["bytes"]:
        errors.append(f"{label}.bytes_mismatch")
    if not hmac.compare_digest(actual_digest, record["sha256"]):
        errors.append(f"{label}.sha256_mismatch")


def verify_candidate_manifest(manifest: dict[str, Any], manifest_directory: Path) -> list[str]:
    errors = validate_candidate_manifest(manifest)
    if errors:
        return sorted(set(errors))
    app = manifest["app"]
    verify_file_record(app["html"], manifest_directory, "candidate.app.html", errors)
    verify_file_record(app["atlas"], manifest_directory, "candidate.app.atlas", errors)
    verify_file_record(manifest["fixture"], manifest_directory, "candidate.fixture", errors)
    for index, record in enumerate(manifest["baseline_artifacts"]):
        verify_file_record(record, manifest_directory, f"candidate.baseline_artifacts.{index}", errors)
    for index, record in enumerate(manifest["mask_artifacts"]):
        verify_file_record(record, manifest_directory, f"candidate.mask_artifacts.{index}", errors)
    for index, record in enumerate(manifest["tooling"]):
        verify_file_record(record, manifest_directory, f"candidate.tooling.{index}", errors)
    return sorted(set(errors))


def release_artifact_records(
    value: Any,
    base: Path,
    manifest_directory: Path,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    seen_roles: set[str] = set()
    for index, item in enumerate(require_list(value, "artifacts")):
        item_label = f"artifact {index + 1}"
        item_object = require_object(item, item_label)
        role = require_text(item_object.get("role"), f"{item_label} role")
        destination = require_text(item_object.get("destination"), f"{item_label} destination")
        if role in seen_roles:
            raise CommandError("artifact roles must be unique")
        seen_roles.add(role)
        record = file_record(source_from_spec(item_object, base, item_label), manifest_directory, item_label)
        record["role"] = role
        record["destination"] = destination
        records.append(record)
    return sorted(records, key=lambda record: record["role"])


def build_release(spec: dict[str, Any], input_directory: Path, manifest_directory: Path) -> dict[str, Any]:
    candidate_value = spec.get("candidate_manifest", spec.get("candidate_manifest_source"))
    candidate_path = source_from_spec(candidate_value, input_directory, "candidate manifest")
    _, candidate = load_json_object(candidate_path)
    candidate_errors = verify_candidate_manifest(candidate, candidate_path.parent)
    if candidate_errors:
        raise CommandError("candidate manifest failed verification")
    candidate_hash = candidate["self_sha256"]
    manifest = {
        "schema": SCHEMA_RELEASE,
        "candidate_manifest": {
            "source": portable_source(candidate_path, manifest_directory),
            "sha256": candidate_hash,
        },
        "artifacts": release_artifact_records(spec.get("artifacts"), input_directory, manifest_directory),
    }
    return add_self_hash(manifest)


def validate_release_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if manifest.get("schema") != SCHEMA_RELEASE:
        errors.append("release.schema_invalid")
    candidate = manifest.get("candidate_manifest")
    if not isinstance(candidate, dict):
        errors.append("release.candidate_manifest.missing")
    else:
        if not valid_text(candidate.get("source")):
            errors.append("release.candidate_manifest.source_missing")
        if not valid_sha256(candidate.get("sha256")):
            errors.append("release.candidate_manifest.sha256_missing")
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list) or not artifacts:
        errors.append("release.artifacts.missing")
    else:
        seen_roles: set[str] = set()
        for index, record in enumerate(artifacts):
            label = f"release.artifacts.{index}"
            record_valid = validate_digest_record(record, label, errors)
            role: Any = None
            destination: Any = None
            if isinstance(record, dict):
                role = record.get("role")
                destination = record.get("destination")
            if not valid_text(role):
                errors.append(f"{label}.role_missing")
                record_valid = False
            elif role in seen_roles:
                errors.append(f"{label}.role_duplicate")
                record_valid = False
            else:
                seen_roles.add(role)
            if not valid_text(destination):
                errors.append(f"{label}.destination_missing")
                record_valid = False
            if not record_valid:
                continue
    validate_self_hash(manifest, errors)
    return errors


def verify_release_manifest(manifest: dict[str, Any], manifest_directory: Path) -> list[str]:
    errors = validate_release_manifest(manifest)
    if errors:
        return sorted(set(errors))
    candidate_record = manifest["candidate_manifest"]
    try:
        candidate_path = resolve_source(
            candidate_record["source"], manifest_directory, "release candidate manifest"
        )
        _, candidate = load_json_object(candidate_path)
    except CommandError:
        errors.append("release.candidate_manifest.unreadable_or_invalid")
    else:
        candidate_errors = verify_candidate_manifest(candidate, candidate_path.parent)
        if candidate_errors:
            errors.append("release.candidate_manifest.verification_failed")
        elif not hmac.compare_digest(candidate["self_sha256"], candidate_record["sha256"]):
            errors.append("release.candidate_manifest.sha256_mismatch")
    for index, record in enumerate(manifest["artifacts"]):
        verify_file_record(record, manifest_directory, f"release.artifacts.{index}", errors)
    return sorted(set(errors))


def verification_result(manifest: dict[str, Any], manifest_path: Path) -> dict[str, Any]:
    schema = manifest.get("schema")
    if schema == SCHEMA_CANDIDATE:
        kind = "candidate"
        errors = verify_candidate_manifest(manifest, manifest_path.parent)
    elif schema == SCHEMA_RELEASE:
        kind = "release"
        errors = verify_release_manifest(manifest, manifest_path.parent)
    else:
        kind = "unknown"
        errors = ["manifest.schema_invalid"]
    return {
        "schema": SCHEMA_VERIFICATION,
        "manifest_kind": kind,
        "status": "PASS" if not errors else "FAIL",
        "errors": errors,
    }


def build_score(spec: dict[str, Any]) -> dict[str, Any]:
    rows = spec.get("rows", spec.get("scores"))
    if not isinstance(rows, dict):
        raise CommandError("score input must contain a rows object")
    expected_names = {name for name, _weight in VISUAL_ROWS}
    if set(rows) != expected_names:
        raise CommandError("score rows must contain exactly the six fixed visual row identifiers")
    result_rows: list[dict[str, Any]] = []
    total_hundredths = 0
    for name, weight in VISUAL_ROWS:
        score = rows[name]
        if type(score) is not int or not 0 <= score <= 100:
            raise CommandError("each visual row score must be an integer from 0 through 100")
        weighted_hundredths = weight * score
        total_hundredths += weighted_hundredths
        result_rows.append(
            {
                "id": name,
                "weight": weight,
                "score": score,
                "weighted_points": weighted_hundredths / 100,
                "status": "PASS" if score >= ROW_THRESHOLD else "FAIL",
            }
        )
    weighted_total = total_hundredths / 100
    passed = all(row["status"] == "PASS" for row in result_rows) and weighted_total >= TOTAL_THRESHOLD
    return {
        "schema": SCHEMA_SCORE,
        "row_threshold": ROW_THRESHOLD,
        "total_threshold": TOTAL_THRESHOLD,
        "rows": result_rows,
        "weighted_total": weighted_total,
        "status": "PASS" if passed else "FAIL",
    }


def emit_result(result: dict[str, Any], output: str | None) -> None:
    if output is not None:
        atomic_write_json(output_path(output), result)
    else:
        sys.stdout.buffer.write(canonical_json(result) + b"\n")


def candidate_command(args: argparse.Namespace) -> int:
    input_path, spec = load_json_object(Path(args.input))
    destination = output_path(args.output)
    ensure_distinct_input_output(input_path, destination)
    manifest = build_candidate(spec, input_path.parent, destination.parent)
    atomic_write_json(destination, manifest)
    return 0


def release_command(args: argparse.Namespace) -> int:
    input_path, spec = load_json_object(Path(args.input))
    destination = output_path(args.output)
    ensure_distinct_input_output(input_path, destination)
    manifest = build_release(spec, input_path.parent, destination.parent)
    atomic_write_json(destination, manifest)
    return 0


def verify_command(args: argparse.Namespace) -> int:
    manifest_path, manifest = load_json_object(Path(args.input))
    if args.output is not None:
        ensure_distinct_input_output(manifest_path, output_path(args.output))
    result = verification_result(manifest, manifest_path)
    emit_result(result, args.output)
    return 0 if result["status"] == "PASS" else 1


def score_command(args: argparse.Namespace) -> int:
    input_path, spec = load_json_object(Path(args.input))
    if args.output is not None:
        ensure_distinct_input_output(input_path, output_path(args.output))
    result = build_score(spec)
    emit_result(result, args.output)
    return 0 if result["status"] == "PASS" else 1


def add_input_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--input", required=True, metavar="JSON", help="input JSON object")


def add_optional_output_argument(parser: argparse.ArgumentParser) -> None:
    parser.add_argument(
        "--output",
        metavar="JSON",
        help="write compact JSON with a temporary file and atomic rename",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="asset-quality.py",
        description="Create, verify, and score deterministic video asset evidence.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    candidate = commands.add_parser(
        "candidate",
        help="create a candidate manifest",
        description=(
            "Create a candidate manifest. The input must contain app.html/app.atlas "
            "(or app_html/atlas), expected_exact_modes, fixture, non-empty "
            "baseline_artifacts and mask_artifacts arrays, and a non-empty tooling array. "
            "Artifact records use role/source; tooling records use name/source."
        ),
    )
    add_input_argument(candidate)
    candidate.add_argument("--output", required=True, metavar="JSON", help="candidate manifest destination")
    candidate.set_defaults(handler=candidate_command)

    release = commands.add_parser(
        "release",
        help="create a release manifest from a verified candidate",
        description=(
            "Create a release manifest. Input requires candidate_manifest (or "
            "candidate_manifest_source) and a non-empty artifacts array. Each artifact "
            "requires role, source, and destination."
        ),
    )
    add_input_argument(release)
    release.add_argument("--output", required=True, metavar="JSON", help="release manifest destination")
    release.set_defaults(handler=release_command)

    verify = commands.add_parser(
        "verify",
        help="verify candidate or release manifest files and self-hash",
        description="Verify required fields, self_sha256, and every recorded file digest and byte count.",
    )
    add_input_argument(verify)
    add_optional_output_argument(verify)
    verify.set_defaults(handler=verify_command)

    score = commands.add_parser(
        "score",
        help="score six fixed visual rows",
        description=(
            "Score rows object keys: composition (26), legibility (14), motion (14), "
            "consistency (13), evidence (20), finish (13). Each integer score must be "
            "0..100; every row must reach 80 and weighted total must reach 85."
        ),
    )
    add_input_argument(score)
    add_optional_output_argument(score)
    score.set_defaults(handler=score_command)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return args.handler(args)
    except CommandError as error:
        print(f"asset-quality.py: error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
