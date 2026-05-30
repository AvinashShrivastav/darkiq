"""
rfm.py
------
Computes RFM (Recency, Frequency, Monetary proxy) and
behavioural features per user_id from master.parquet.

NOTE on "Recency":
    Instacart has no real calendar dates — only order_number
    (1 to 99) and days_since_prior_order gaps.
    Recency = total days spanned from order 1 to last order,
    computed by summing days_since_prior_order per user.
    Lower recency = more recent / active buyer.

Output: data/processed/feat_rfm.parquet

Run:
    python3 -m src.features.rfm
"""

import os
import pandas as pd
import numpy as np
from src.utils.config import DATA_PROCESSED


def compute_rfm(master: pd.DataFrame) -> pd.DataFrame:
    # One row per order (drop product-level duplicates)
    orders = master.drop_duplicates("order_id")

    # ── Recency ──────────────────────────────────────────────────────────
    # Sum of all days_since_prior_order gaps per user = total active days
    # Higher value = user has been ordering for longer (more history)
    # We invert it: recency = max_possible - user_total so lower = more recent
    total_days = (
        orders.groupby("user_id")["days_since_prior_order"]
        .sum()
        .fillna(0)
        .rename("total_days_active")
    )
    max_days = total_days.max()
    recency  = (max_days - total_days).rename("recency")

    # ── Frequency ────────────────────────────────────────────────────────
    frequency = orders.groupby("user_id")["order_id"].count().rename("frequency")

    # ── Monetary proxy ───────────────────────────────────────────────────
    # No price data in Instacart — use avg basket size × reorder ratio
    basket_size   = master.groupby("order_id")["product_id"].count().rename("basket_size")
    orders        = orders.join(basket_size, on="order_id")
    avg_basket    = orders.groupby("user_id")["basket_size"].mean().rename("avg_basket_size")
    reorder_ratio = master.groupby("user_id")["reordered"].mean().rename("reorder_ratio")
    monetary      = (avg_basket * reorder_ratio).rename("monetary_proxy")

    # ── Behavioural features ─────────────────────────────────────────────
    # Night-owl score: fraction of orders placed between 22:00 and 03:00
    night_mask  = orders["order_hour_of_day"].isin([22, 23, 0, 1, 2, 3])
    night_owl   = (
        orders[night_mask].groupby("user_id")["order_id"].count()
        / frequency
    ).fillna(0).rename("night_owl_score")

    # Weekend concentration: fraction of orders on Sat (day 6) or Sun (day 0)
    # Instacart order_dow: 0=Sunday, 1=Monday … 6=Saturday
    weekend_mask  = orders["order_dow"].isin([0, 6])
    weekend_conc  = (
        orders[weekend_mask].groupby("user_id")["order_id"].count()
        / frequency
    ).fillna(0).rename("weekend_concentration")

    # Average order hour
    avg_hour = orders.groupby("user_id")["order_hour_of_day"].mean().rename("avg_order_hour")

    # Organic affinity: fraction of cart items from organic products
    master_copy = master.copy()
    master_copy["is_organic"] = master_copy["product_name"].str.contains("Organic", case=False, na=False).astype(int)
    organic_affinity = master_copy.groupby("user_id")["is_organic"].mean().rename("organic_affinity")

    # Avg days between orders
    avg_days_between = (
        orders.groupby("user_id")["days_since_prior_order"]
        .mean()
        .fillna(0)
        .rename("avg_days_between_orders")
    )

    # ── Merge all features ───────────────────────────────────────────────
    feat = pd.concat([
        recency, frequency, monetary,
        avg_basket, reorder_ratio,
        night_owl, weekend_conc,
        avg_hour, organic_affinity,
        avg_days_between,
    ], axis=1).reset_index()

    print(f"  RFM feature matrix shape: {feat.shape}")
    print(f"  Null counts:\n{feat.isnull().sum()[feat.isnull().sum() > 0]}")
    return feat


def save(feat: pd.DataFrame) -> None:
    out = os.path.join(DATA_PROCESSED, "feat_rfm.parquet")
    feat.to_parquet(out, index=False)
    print(f"\n  Saved → {out}")


if __name__ == "__main__":
    print("=== DarkIQ — RFM Feature Engineering ===\n")
    master = pd.read_parquet(os.path.join(DATA_PROCESSED, "master.parquet"))
    print(f"  Loaded master: {master.shape}")
    feat = compute_rfm(master)
    save(feat)
    print("\nDone. ✅")
