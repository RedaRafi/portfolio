"""Validate, deduplicate, and aggregate a batch of sample order events.

Run from the project root:
    python examples/pipeline.py --input data/sample-events.json

This is an educational, in-memory batch example, not the implementation of an
employer's system. The browser demo follows the same data contract.
"""

from __future__ import annotations

import argparse
from collections import defaultdict
from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import re
from typing import Any


SUPPORTED_REGIONS = {"CA", "EU", "US"}
MONEY = re.compile(r"[0-9]{1,7}(?:\.[0-9]{1,2})?")


def validate_event(record: Any) -> dict[str, Any]:
    """Return a normalized event or explain why the source row is invalid."""
    if not isinstance(record, dict):
        raise ValueError("Expected an event object.")

    event_id = record.get("event_id")
    if not isinstance(event_id, str) or not 1 <= len(event_id.strip()) <= 80:
        raise ValueError("event_id must contain 1–80 characters.")

    occurred_at = record.get("occurred_at")
    try:
        if not isinstance(occurred_at, str):
            raise ValueError
        occurred_at = occurred_at.strip()
        parsed = date.fromisoformat(occurred_at)
        if parsed.isoformat() != occurred_at or parsed.year < 1000:
            raise ValueError
    except ValueError:
        raise ValueError("occurred_at must be a valid calendar date (YYYY-MM-DD).") from None

    region = record.get("region")
    if not isinstance(region, str) or region.strip().upper() not in SUPPORTED_REGIONS:
        raise ValueError("region must be CA, EU, or US.")

    amount = record.get("amount")
    if isinstance(amount, bool) or not isinstance(amount, (str, int, float)):
        raise ValueError("amount must be 0–9,999,999.99 with at most two decimal places.")
    # JSON numbers lose the sign of zero in the browser; use the same policy here.
    if isinstance(amount, (int, float)) and amount == 0:
        amount = 0
    amount = str(amount).strip()
    if not MONEY.fullmatch(amount):
        raise ValueError("amount must be 0–9,999,999.99 with at most two decimal places.")

    return {
        "event_id": event_id.strip(),
        "occurred_at": occurred_at,
        "region": region.strip().upper(),
        "amount_cents": int(Decimal(amount) * 100),
    }


def process_events(records: list[Any]) -> dict[str, Any]:
    """Keep the first valid event per ID and quarantine failures for inspection."""
    if not isinstance(records, list):
        raise ValueError("Input must be a JSON array of events.")
    if len(records) > 5000:
        raise ValueError("This demo accepts at most 5,000 events per run.")

    accepted, rejected, duplicates = [], [], []
    seen: set[str] = set()
    regions: dict[str, dict[str, Any]] = {}
    daily: dict[str, int] = defaultdict(int)
    total_cents = 0

    for row_number, record in enumerate(records, start=1):
        try:
            event = validate_event(record)
        except ValueError as error:
            rejected.append({"row": row_number, "reason": str(error), "record": record})
            continue

        # Validate first: an invalid row must not reserve the ID of a good retry.
        event_id = event["event_id"]
        if event_id in seen:
            duplicates.append({"row": row_number, "event_id": event_id,
                               "reason": "Duplicate event_id; first valid event retained."})
            continue
        seen.add(event_id)
        accepted.append(event)

        cents = event["amount_cents"]
        total_cents += cents
        region = regions.setdefault(event["region"], {"region": event["region"], "count": 0, "totalCents": 0})
        region["count"] += 1
        region["totalCents"] += cents
        daily[event["occurred_at"]] += cents

    return {
        "inputCount": len(records),
        "accepted": accepted,
        "rejected": rejected,
        "duplicates": duplicates,
        "totalCents": total_cents,
        "regions": [regions[key] for key in sorted(regions)],
        "daily": [{"date": day, "totalCents": daily[day]} for day in sorted(daily)],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="JSON array of events")
    parser.add_argument("--output", type=Path, help="Write results to this file instead of stdout")
    args = parser.parse_args()
    try:
        records = json.loads(args.input.read_text(encoding="utf-8"))
        result = process_events(records)
        output = json.dumps(result, indent=2, ensure_ascii=False)
        if args.output:
            args.output.write_text(output + "\n", encoding="utf-8")
        else:
            print(output)
    except (OSError, ValueError) as error:
        parser.exit(2, f"Pipeline failed: {error}\n")


if __name__ == "__main__":
    main()
