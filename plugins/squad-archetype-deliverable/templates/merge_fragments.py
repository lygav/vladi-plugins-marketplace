#!/usr/bin/env python3
"""Merge per-item fragment files into a unified deliverable."""

import glob
import json
import os
import sys


def merge_fragments(
    fragments_dir: str = "raw/fragments",
    output_file: str = "deliverable.json",
) -> dict:
    """Read all fragment-*.json files and merge into a single deliverable.

    Args:
        fragments_dir: Directory containing fragment files.
        output_file: Path to write the merged deliverable.

    Returns:
        The merged deliverable dict.
    """
    pattern = os.path.join(fragments_dir, "fragment-*.json")
    paths = sorted(glob.glob(pattern))

    if not paths:
        print(f"No fragment files found in {fragments_dir}/", file=sys.stderr)
        return {"items": [], "metadata": {"fragment_count": 0}}

    items = []
    errors = []

    for path in paths:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                items.extend(data)
            elif isinstance(data, dict):
                items.append(data)
            else:
                errors.append({"file": path, "error": "unexpected JSON type"})
        except json.JSONDecodeError as exc:
            errors.append({"file": path, "error": f"invalid JSON: {exc}"})
        except OSError as exc:
            errors.append({"file": path, "error": str(exc)})

    deliverable = {
        "items": items,
        "metadata": {
            "fragment_count": len(paths),
            "item_count": len(items),
            "errors": errors if errors else None,
        },
    }

    # Remove None values from metadata
    deliverable["metadata"] = {
        k: v for k, v in deliverable["metadata"].items() if v is not None
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(deliverable, f, indent=2)

    print(f"Merged {len(items)} items from {len(paths)} fragments -> {output_file}")
    if errors:
        print(f"  ⚠ {len(errors)} fragment(s) had errors", file=sys.stderr)

    return deliverable


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Merge fragment files into a deliverable.")
    parser.add_argument(
        "--fragments-dir",
        default="raw/fragments",
        help="Directory containing fragment-*.json files (default: raw/fragments)",
    )
    parser.add_argument(
        "--output",
        default="deliverable.json",
        help="Output deliverable file path (default: deliverable.json)",
    )
    args = parser.parse_args()

    merge_fragments(fragments_dir=args.fragments_dir, output_file=args.output)
