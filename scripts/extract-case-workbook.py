"""Archive the supplied workbook's values, including all source and editorial cells."""

import argparse
import hashlib
import json
from io import BytesIO
from pathlib import Path

from openpyxl import load_workbook


def extract(path):
    content = path.read_bytes()
    workbook = load_workbook(BytesIO(content), read_only=True, data_only=False)
    try:
        sheets = {}
        for sheet in workbook:
            # The supplied file's dimension metadata is unreliable. Read actual cells.
            sheet.reset_dimensions()
            sheets[sheet.title] = [list(row) for row in sheet.values]
        return {"sha256": hashlib.sha256(content).hexdigest(), "sheets": sheets}
    finally:
        workbook.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--output", type=Path, help="Write a new archive for review")
    target.add_argument("--check", type=Path, help="Compare against an existing archive")
    args = parser.parse_args()
    snapshot = extract(args.workbook)
    if args.check:
        if json.loads(args.check.read_text(encoding="utf-8")) != snapshot:
            parser.exit(1, "Workbook or archived cells differ. Review the new batch first.\n")
        print("Workbook digest and all sheets match the reviewed archive.")
    else:
        with args.output.open("x", encoding="utf-8", newline="\n") as output:
            json.dump(snapshot, output, ensure_ascii=False, indent=2)
            output.write("\n")
