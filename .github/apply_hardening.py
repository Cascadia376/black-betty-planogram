"""Apply the reviewed, hash-locked source changes on an isolated branch only."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import lzma
import re
import subprocess

BASE = "5dcf3e28999401c6fe6d95ffa6df9c7bd46b1ce1"
MANIFEST_SHA256 = "fb1f5cf419d39d38a7dc6607dc3bd2bba74280b272ddf9d8be48828f511beb23"
ROOT = Path.cwd().resolve()


def digest(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


compressed = b"".join((ROOT / f".github/hardening/part-{n}.xz").read_bytes() for n in range(1, 4))
decoder = lzma.LZMADecompressor(memlimit=128 * 1024 * 1024)
raw = decoder.decompress(compressed, max_length=2_000_000)
assert decoder.eof and not decoder.unused_data, "Incomplete or oversized delivery manifest"
assert hashlib.sha256(raw).hexdigest() == MANIFEST_SHA256, "Delivery manifest checksum mismatch"
manifest = json.loads(raw)
assert manifest["schema"] == 1 and manifest["base"] == BASE
assert len(manifest["files"]) == 52
subprocess.run(["git", "merge-base", "--is-ancestor", BASE, "HEAD"], check=True)
outputs = []
seen = set()
for item in manifest["files"]:
    name = item["path"]
    relative = PurePosixPath(name)
    assert not relative.is_absolute() and ".." not in relative.parts and str(relative) == name
    assert name == "README.md" or name.startswith(("src/", "tests/", "docs/")), name
    assert name not in seen, name
    seen.add(name)
    target = ROOT / name
    assert ROOT in target.resolve().parents and not target.is_symlink(), name
    assert not any(p.is_symlink() for p in target.parents if p != ROOT), name
    before = target.read_text(encoding="utf-8") if target.exists() else None
    assert (digest(before) if before is not None else None) == item["before"], f"Stale source: {name}"
    operation = item["operation"]
    if operation == "create":
        assert before is None
        after = item["content"]
    elif operation == "edit":
        assert before is not None
        previous_end = 0
        for start, end, text in item["edits"]:
            assert type(start) is int and type(end) is int and isinstance(text, str)
            assert previous_end <= start <= end <= len(before), name
            previous_end = end
        after = before
        for start, end, text in reversed(item["edits"]):
            after = after[:start] + text + after[end:]
    elif operation == "delete":
        assert before is not None
        after = None
    else:
        raise ValueError(f"Unknown operation for {name}")
    assert item["after"] is None or re.fullmatch(r"[0-9a-f]{64}", item["after"])
    assert (digest(after) if after is not None else None) == item["after"], f"Changed output: {name}"
    outputs.append((target, after))

# Preflight every input and every output before changing any source file.
for target, after in outputs:
    if after is None:
        target.unlink()
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(after, encoding="utf-8")
print(f"Applied {len(outputs)} reviewed files; all source and output hashes verified.")
