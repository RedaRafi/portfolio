"""Behavioral checks for the standalone example; no test dependencies needed."""

import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "examples"))
from pipeline import process_events


def event(**changes):
    return {"event_id": "evt-1", "occurred_at": "2026-10-20", "region": "CA", "amount": "19.95", **changes}


class PipelineTests(unittest.TestCase):
    def test_money_is_exact_and_regions_are_normalized(self):
        result = process_events([event(amount="0.10", region=" ca "), event(event_id="evt-2", amount="0.20")])
        self.assertEqual(result["totalCents"], 30)
        self.assertEqual(result["regions"], [{"region": "CA", "count": 2, "totalCents": 30}])

    def test_first_valid_event_wins(self):
        result = process_events([event(amount="-1"), event(), event(amount="99.00")])
        self.assertEqual(len(result["accepted"]), 1)
        self.assertEqual(len(result["rejected"]), 1)
        self.assertEqual(len(result["duplicates"]), 1)
        self.assertEqual(result["totalCents"], 1995)

    def test_bad_records_are_quarantined_with_reasons(self):
        records = [None, [], {}, event(event_id=" "), event(occurred_at="2026-02-30"),
                   event(occurred_at="2025-02-29"), event(region="XX"), event(amount="1.999"),
                   event(amount=""), event(amount=True), event(amount="NaN"), event(amount="1e3"),
                   event(amount="10000000.00"), event(amount=None)]
        result = process_events(records)
        self.assertEqual(len(result["rejected"]), len(records))
        self.assertTrue(all(row["reason"] for row in result["rejected"]))

    def test_leap_days_and_zero_values_are_valid(self):
        result = process_events([event(event_id=" evt-1 ", occurred_at="2024-02-29", amount=" 0.00 ")])
        self.assertEqual(result["accepted"][0]["event_id"], "evt-1")
        self.assertEqual(result["accepted"][0]["amount_cents"], 0)

    def test_daily_totals_are_sorted(self):
        result = process_events([event(occurred_at="2026-10-22"), event(event_id="evt-2")])
        self.assertEqual([row["date"] for row in result["daily"]], ["2026-10-20", "2026-10-22"])

    def test_numeric_negative_zero_is_zero_but_signed_strings_are_invalid(self):
        result = process_events([event(amount=-0.0), event(event_id="evt-2", amount="-0.00")])
        self.assertEqual(len(result["accepted"]), 1)
        self.assertEqual(result["accepted"][0]["amount_cents"], 0)
        self.assertEqual(len(result["rejected"]), 1)

    def test_empty_input_and_input_limits(self):
        self.assertEqual(process_events([])["totalCents"], 0)
        with self.assertRaisesRegex(ValueError, "array"):
            process_events({})
        with self.assertRaisesRegex(ValueError, "5,000"):
            process_events([None] * 5001)

    def test_shared_sample_totals(self):
        path = Path(__file__).resolve().parents[1] / "data" / "sample-events.json"
        result = process_events(json.loads(path.read_text(encoding="utf-8")))
        self.assertEqual(result["inputCount"], 12)
        self.assertEqual(len(result["accepted"]), 8)
        self.assertEqual(len(result["rejected"]), 3)
        self.assertEqual(len(result["duplicates"]), 1)
        self.assertEqual(result["totalCents"], 83650)


if __name__ == "__main__":
    unittest.main()
