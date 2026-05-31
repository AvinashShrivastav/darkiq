"""
association.py
--------------
Mines segment-conditional, weather-aware basket association rules
using FP-Growth. Rules are computed per context slice:
    segment × time_slot × rain_bin

This is the key differentiator vs generic market basket analysis
which runs on all orders globally and produces trivial rules.

Output: data/processed/assoc_rules.parquet

Run:
    python3 -m src.models.association
"""

import os
import warnings
import pandas as pd
import numpy as np
from mlxtend.frequent_patterns import fpgrowth, association_rules
from src.utils.config import DATA_PROCESSED

warnings.filterwarnings("ignore")

MIN_ORDERS_PER_SLICE = 500    # skip slices with too few orders
MAX_ORDERS_PER_SLICE = 15000  # cap to control memory
TOP_PRODUCTS         = 50     # only top-N products per slice
MIN_SUPPORT          = 0.02
MIN_LIFT             = 1.2
MIN_CONFIDENCE       = 0.2

TIME_SLOTS = {
    "morning":   (6,  12),
    "afternoon": (12, 18),
    "evening":   (18, 22),
    "night":     (22, 6),   # wraps midnight
}


def assign_time_slot(hour: pd.Series) -> pd.Series:
    def _slot(h):
        if 6  <= h < 12: return "morning"
        if 12 <= h < 18: return "afternoon"
        if 18 <= h < 22: return "evening"
        return "night"
    return hour.map(_slot)


def build_enriched(master, oc, seg) -> pd.DataFrame:
    df = (
        master[["order_id", "user_id", "order_hour_of_day", "product_name"]]
        .merge(oc[["order_id", "rain_bin"]], on="order_id")
        .merge(seg[["user_id", "cluster_name"]], on="user_id")
    )
    df["time_slot"] = assign_time_slot(df["order_hour_of_day"])
    df["rain_bin"]  = df["rain_bin"].astype(str)
    return df


def make_basket(sub: pd.DataFrame) -> pd.DataFrame:
    """Convert order-product rows to binary order × product matrix."""
    basket = (
        sub.groupby(["order_id", "product_name"])["product_name"]
           .count()
           .unstack(fill_value=0)
    )
    return (basket > 0).astype(bool)


def run_fpgrowth(basket: pd.DataFrame, segment: str, slot: str, weather: str) -> pd.DataFrame:
    freq  = fpgrowth(basket, min_support=MIN_SUPPORT, use_colnames=True)
    if freq.empty:
        return pd.DataFrame()
    rules = association_rules(freq, metric="lift", min_threshold=MIN_LIFT)
    rules = rules[rules["confidence"] >= MIN_CONFIDENCE]
    if rules.empty:
        return pd.DataFrame()

    rules["segment"]    = segment
    rules["time_slot"]  = slot
    rules["weather_bin"] = weather
    # Convert frozensets to readable strings
    rules["antecedent"] = rules["antecedents"].apply(lambda x: ", ".join(sorted(x)))
    rules["consequent"] = rules["consequents"].apply(lambda x: ", ".join(sorted(x)))
    return rules[["antecedent", "consequent", "support", "confidence",
                  "lift", "segment", "time_slot", "weather_bin"]]


def mine_rules(df: pd.DataFrame) -> pd.DataFrame:
    segments  = df["cluster_name"].unique()
    slots     = df["time_slot"].unique()
    weathers  = df["rain_bin"].unique()

    all_rules  = []
    total      = len(segments) * len(slots) * len(weathers)
    done       = 0

    for seg in segments:
        for slot in slots:
            for weather in weathers:
                done += 1
                sub = df[
                    (df["cluster_name"] == seg) &
                    (df["time_slot"]    == slot) &
                    (df["rain_bin"]     == weather)
                ]
                n_orders = sub["order_id"].nunique()
                if n_orders < MIN_ORDERS_PER_SLICE:
                    continue

                # Cap orders per slice to control memory
                if n_orders > MAX_ORDERS_PER_SLICE:
                    order_sample = (
                        sub["order_id"].drop_duplicates()
                           .sample(MAX_ORDERS_PER_SLICE, random_state=42)
                    )
                    sub = sub[sub["order_id"].isin(order_sample)]

                basket = make_basket(sub)
                # Limit to top-N products per slice for memory efficiency
                top_cols = basket.sum().nlargest(TOP_PRODUCTS).index
                basket   = basket[top_cols]

                rules = run_fpgrowth(basket, seg, slot, weather)
                if not rules.empty:
                    all_rules.append(rules)
                    print(f"  [{done}/{total}] {seg[:20]:20s} | {slot:9s} | {weather:7s} "
                          f"| orders={n_orders:,} | rules={len(rules)}")

    if not all_rules:
        print("  No rules generated — try lowering MIN_SUPPORT")
        return pd.DataFrame()

    final = pd.concat(all_rules, ignore_index=True).sort_values("lift", ascending=False)
    return final


def save(rules: pd.DataFrame) -> None:
    out = os.path.join(DATA_PROCESSED, "assoc_rules.parquet")
    rules.to_parquet(out, index=False)
    print(f"\n  Saved → {out}")


if __name__ == "__main__":
    print("=== DarkIQ — Association Rule Mining ===\n")

    master = pd.read_parquet(os.path.join(DATA_PROCESSED, "master.parquet"))
    oc     = pd.read_parquet(os.path.join(DATA_PROCESSED, "order_context.parquet"))
    seg    = pd.read_parquet(os.path.join(DATA_PROCESSED, "seg_labels.parquet"))

    print(f"  master: {master.shape}  |  order_context: {oc.shape}  |  seg_labels: {seg.shape}\n")

    df    = build_enriched(master, oc, seg)
    rules = mine_rules(df)

    if not rules.empty:
        print(f"\n  Total rules generated: {len(rules):,}")
        print(f"  Average lift:          {rules['lift'].mean():.3f}")
        print(f"  Max lift:              {rules['lift'].max():.3f}")
        print(f"\n  Top 5 rules by lift:")
        print(rules[["antecedent","consequent","lift","segment","time_slot","weather_bin"]]
              .head(5).to_string(index=False))
        save(rules)

    print("\nDone. ✅")
