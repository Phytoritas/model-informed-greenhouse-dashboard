#!/usr/bin/env python
"""Evaluate feedback/outcome routing associations without changing online policy."""

from __future__ import annotations

import argparse
import json

from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.quality_ledger import (
    QualityLedger,
)
from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.routing_regression import (
    evaluate_routing_regression,
)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=None, help="Optional quality-ledger SQLite path")
    parser.add_argument("--minimum-examples", type=int, default=12)
    parser.add_argument("--holdout-fraction", type=float, default=0.25)
    parser.add_argument("--ridge-alpha", type=float, default=1.0)
    args = parser.parse_args()
    result = evaluate_routing_regression(
        QualityLedger(args.db),
        minimum_examples=args.minimum_examples,
        holdout_fraction=args.holdout_fraction,
        ridge_alpha=args.ridge_alpha,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] in {"ready", "insufficient_data"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
