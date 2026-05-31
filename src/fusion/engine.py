"""
engine.py
---------
Fusion engine — combines three ML signals into a ranked
replenishment action list per dark store:

    Signal 1: LightGBM forecast  → base reorder quantity
    Signal 2: Association rules  → bundle suggestions
    Signal 3: Segment affinity   → dominant persona per store

Output: data/processed/action_list.parquet

Run:
    python3 -m src.fusion.engine
"""

import os
import pandas as pd
import numpy as np
from src.fusion.scoring import score_actions
from src.utils.config import DATA_PROCESSED, DATA_EXTERNAL


# Simulated current stock = rolling 7-day mean × 1.5
# In production this would come from a live inventory system
STOCK_MULTIPLIER = 1.5


def build_current_stock(forecasts: pd.DataFrame) -> pd.DataFrame:
    """
    Simulate current stock level per store × SKU.
    Uses the last known rolling_7d_mean × STOCK_MULTIPLIER.
    Clearly synthetic — flagged in WorkDoneTillNow.md.
    """
    latest = (
        forecasts.sort_values("order_date")
                 .groupby(["store_id", "product_name"])
                 .last()
                 .reset_index()
    )
    # rolling_7d_mean not in forecasts — use avg units_sold as proxy
    avg_demand = (
        forecasts[forecasts["units_sold"] > 0]
        .groupby(["store_id", "product_name"])["units_sold"]
        .mean()
        .reset_index(name="avg_daily_demand")
    )
    latest = latest.merge(avg_demand, on=["store_id", "product_name"])
    latest["current_stock"] = (latest["avg_daily_demand"] * 0.8).round().astype(int)
    return latest[["store_id", "product_name", "current_stock"]]


def get_dominant_segment(seg: pd.DataFrame, demo: pd.DataFrame) -> pd.DataFrame:
    """Most common customer segment per store."""
    store_seg = demo.merge(seg, on="user_id")
    dominant  = (
        store_seg.groupby(["store_id", "cluster_name"])["user_id"]
                 .count()
                 .reset_index(name="count")
                 .sort_values("count", ascending=False)
                 .groupby("store_id")
                 .first()
                 .reset_index()[["store_id", "cluster_name"]]
                 .rename(columns={"cluster_name": "dominant_segment"})
    )
    return dominant


def attach_bundles(actions: pd.DataFrame, rules: pd.DataFrame) -> pd.DataFrame:
    # Best rule per antecedent across ALL segments (fallback if no segment match)
    best_rules = (
        rules.sort_values("lift", ascending=False)
             .groupby("antecedent")
             .first()
             .reset_index()[["antecedent", "consequent", "lift"]]
    )
    actions = actions.merge(
        best_rules.rename(columns={
            "antecedent": "product_name",
            "consequent": "bundle_with",
            "lift":       "bundle_lift",
        }),
        on="product_name",
        how="left"
    )
    return actions


def build_action_list(forecasts, stock, dominant_seg, rules, events) -> pd.DataFrame:
    # Use the latest forecast date per store × SKU
    latest_fc = (
        forecasts.sort_values("order_date")
                 .groupby(["store_id", "product_name"])
                 .last()
                 .reset_index()
    )

    actions = latest_fc.merge(stock,        on=["store_id", "product_name"])
    actions = actions.merge(dominant_seg,   on="store_id", how="left")

    # Reorder quantity = forecast - current_stock (min 0)
    actions["reorder_qty"] = (
        actions["forecast_units"] - actions["current_stock"]
    ).clip(lower=0)

    # Attach latest event context
    latest_event = events.sort_values("date").iloc[-1]
    actions["days_to_festival"] = int(latest_event["days_to_festival"])
    actions["event_context"]    = (
        "festival_soon" if latest_event["is_festival"] else
        "ipl_season"    if latest_event["is_ipl_match_day"] else
        "monsoon"       if latest_event["is_monsoon"] else
        "normal"
    )

    # Score urgency
    actions = score_actions(actions)

    # Attach bundle suggestions
    actions = attach_bundles(actions, rules)

    # Add generated_at timestamp
    actions["generated_at"] = pd.Timestamp.now().floor("h")

    # Sort by urgency desc, reorder_qty desc
    actions = actions.sort_values(
        ["store_id", "urgency", "reorder_qty"],
        ascending=[True, False, False]
    ).reset_index(drop=True)

    return actions


def save(actions: pd.DataFrame) -> None:
    out = os.path.join(DATA_PROCESSED, "action_list.parquet")
    keep = [
        "store_id", "product_name", "forecast_units", "units_sold",
        "current_stock", "reorder_qty", "urgency", "urgency_label",
        "urgency_color", "dominant_segment", "bundle_with", "bundle_lift",
        "event_context", "days_to_festival", "generated_at"
    ]
    actions[keep].to_parquet(out, index=False)
    print(f"  Saved → {out}  shape={actions[keep].shape}")


if __name__ == "__main__":
    print("=== DarkIQ — Fusion Engine ===\n")

    forecasts = pd.read_parquet(os.path.join(DATA_PROCESSED, "forecasts.parquet"))
    seg       = pd.read_parquet(os.path.join(DATA_PROCESSED, "seg_labels.parquet"))
    demo      = pd.read_parquet(os.path.join(DATA_PROCESSED, "user_demographics.parquet"))
    rules     = pd.read_parquet(os.path.join(DATA_PROCESSED, "assoc_rules.parquet"))
    events    = pd.read_parquet(os.path.join(DATA_EXTERNAL,  "events.parquet"))
    events["date"] = pd.to_datetime(events["date"])

    print("  Building simulated current stock...")
    stock = build_current_stock(forecasts)

    print("  Computing dominant segment per store...")
    dominant_seg = get_dominant_segment(seg, demo)
    print(dominant_seg.to_string(index=False))

    print("\n  Building action list...")
    actions = build_action_list(forecasts, stock, dominant_seg, rules, events)

    print(f"\n  Action list shape: {actions.shape}")
    print(f"\n  Urgency distribution:")
    print(actions.groupby(["urgency_label","urgency"]).size()
                 .reset_index(name="count")
                 .sort_values("urgency", ascending=False)
                 .to_string(index=False))

    print(f"\n  Actions with bundle suggestions: {actions['bundle_with'].notna().sum()}")
    print(f"\n  Sample Critical actions:")
    crit = actions[actions["urgency"] == 5][
        ["store_id","product_name","forecast_units","current_stock","reorder_qty","urgency_label","bundle_with"]
    ].head(5)
    print(crit.to_string(index=False))

    save(actions)
    print("\nDone. ✅")
