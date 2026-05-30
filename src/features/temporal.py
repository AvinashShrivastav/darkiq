"""
temporal.py
-----------
Merges feat_rfm + user_demographics + weather + events into
a single feature store used by clustering and forecasting.

Since Instacart has no real dates, we assign a synthetic
order_date to each order by anchoring the first order of
each user to 2013-01-01 and stepping forward using
days_since_prior_order gaps.

Output: data/processed/feature_store.parquet

Run:
    python3 -m src.features.temporal
"""

import os
import pandas as pd
import numpy as np
from src.utils.config import DATA_PROCESSED, DATA_EXTERNAL


def assign_order_dates(master: pd.DataFrame) -> pd.DataFrame:
    """
    Assign a synthetic calendar date to every order.
    Strategy: anchor each user's first order to a random date
    in 2013, then walk forward using days_since_prior_order.
    Fixed seed ensures reproducibility.
    """
    rng = np.random.default_rng(seed=42)

    orders = (
        master[["user_id", "order_id", "order_number", "days_since_prior_order"]]
        .drop_duplicates("order_id")
        .sort_values(["user_id", "order_number"])
    )

    # Random start date in 2013 for each user
    user_ids    = orders["user_id"].unique()
    start_offsets = rng.integers(0, 365, size=len(user_ids))
    start_map   = dict(zip(user_ids, start_offsets))

    orders["start_offset"] = orders["user_id"].map(start_map)
    orders["days_since_prior_order"] = orders["days_since_prior_order"].fillna(0)

    # Cumulative days per user → add to anchor date
    orders["cum_days"] = (
        orders.groupby("user_id")["days_since_prior_order"].cumsum()
    )
    anchor = pd.Timestamp("2013-01-01")
    orders["order_date"] = pd.to_datetime(
        orders["start_offset"] + orders["cum_days"], unit="D", origin=anchor
    ).dt.normalize()

    # Cap at 2015-12-31 to stay within weather/event range
    orders["order_date"] = orders["order_date"].clip(upper=pd.Timestamp("2015-12-31"))

    return orders[["order_id", "user_id", "order_number", "order_date"]]


def build_feature_store() -> pd.DataFrame:
    master = pd.read_parquet(os.path.join(DATA_PROCESSED, "master.parquet"))
    rfm    = pd.read_parquet(os.path.join(DATA_PROCESSED, "feat_rfm.parquet"))
    demo   = pd.read_parquet(os.path.join(DATA_PROCESSED, "user_demographics.parquet"))
    weather = pd.read_parquet(os.path.join(DATA_EXTERNAL, "weather.parquet"))
    events  = pd.read_parquet(os.path.join(DATA_EXTERNAL, "events.parquet"))

    print("  Assigning synthetic order dates...")
    order_dates = assign_order_dates(master)

    # User-level feature store: rfm + demographics
    user_features = rfm.merge(demo, on="user_id", how="left")

    # Order-level context: join weather + events on order_date
    weather["date"] = pd.to_datetime(weather["date"])
    events["date"]  = pd.to_datetime(events["date"])

    order_context = (
        order_dates
        .merge(weather[["date", "temp_bin", "rain_bin", "temp_max", "precipitation"]], 
               left_on="order_date", right_on="date", how="left")
        .merge(events[["date", "is_festival", "days_to_festival", 
                        "is_ipl_match_day", "is_exam_season", "is_monsoon", "is_weekend"]],
               left_on="order_date", right_on="date", how="left")
        .drop(columns=["date_x", "date_y"], errors="ignore")
    )

    # Aggregate order-level context to user level (mean/mode per user)
    ctx_agg = order_context.groupby("user_id").agg(
        avg_temp_max        =("temp_max",         "mean"),
        pct_rainy_orders    =("precipitation",    lambda x: (x > 1).mean()),
        pct_festival_orders =("is_festival",      "mean"),
        pct_ipl_orders      =("is_ipl_match_day", "mean"),
        pct_monsoon_orders  =("is_monsoon",       "mean"),
    ).reset_index()

    feature_store = user_features.merge(ctx_agg, on="user_id", how="left")

    print(f"  Feature store shape: {feature_store.shape}")
    print(f"  Columns: {feature_store.columns.tolist()}")
    print(f"  Nulls:\n{feature_store.isnull().sum()[feature_store.isnull().sum() > 0]}")
    return feature_store, order_context


def save(feature_store: pd.DataFrame, order_context: pd.DataFrame) -> None:
    fs_out = os.path.join(DATA_PROCESSED, "feature_store.parquet")
    oc_out = os.path.join(DATA_PROCESSED, "order_context.parquet")
    feature_store.to_parquet(fs_out, index=False)
    order_context.to_parquet(oc_out, index=False)
    print(f"\n  Saved → {fs_out}")
    print(f"  Saved → {oc_out}")


if __name__ == "__main__":
    print("=== DarkIQ — Feature Store Build ===\n")
    feature_store, order_context = build_feature_store()
    save(feature_store, order_context)
    print("\nDone. ✅")
