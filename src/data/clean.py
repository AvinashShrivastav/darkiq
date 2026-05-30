"""
clean.py
--------
Adds synthetic Indian geography (pin_code, city, store_id,
income_bucket, age_group) to each user_id.

Why synthetic?
    Instacart is US data — no Indian geography exists in it.
    The buying behaviour (what, when, how often) is 100% real.
    Only the location mapping is fabricated, which is standard
    practice when adapting a public dataset to a new domain.

Run:
    python3 -m src.data.clean
"""

import os
import numpy as np
import pandas as pd
from src.utils.config import DATA_RAW, DATA_PROCESSED


# 6 real Indian pin codes mapped to 3 dark stores
# Each store serves 2 pin codes (a realistic dark store coverage radius)
PIN_TO_STORE = {
    "400001": "store_mumbai_south",    # South Mumbai
    "400051": "store_mumbai_west",     # Bandra West
    "110001": "store_delhi_central",   # Connaught Place
    "110075": "store_delhi_south",     # Saket
    "560001": "store_bangalore_cbd",   # MG Road
    "560034": "store_bangalore_north", # Hebbal
}

PIN_CODES  = list(PIN_TO_STORE.keys())
CITY_MAP   = {
    "400001": "Mumbai",    "400051": "Mumbai",
    "110001": "Delhi",     "110075": "Delhi",
    "560001": "Bangalore", "560034": "Bangalore",
}


def build_demographics(orders_path: str) -> pd.DataFrame:
    """
    Assign each unique user_id a pin_code, city, store_id,
    income_bucket, and age_group.
    """
    orders = pd.read_csv(orders_path, usecols=["user_id"])
    users  = orders["user_id"].unique()
    rng    = np.random.default_rng(seed=42)   # fixed seed → reproducible

    pin_codes     = rng.choice(PIN_CODES, size=len(users))
    income_bucket = rng.choice(
        ["low", "mid", "high"],
        size=len(users),
        p=[0.30, 0.50, 0.20]   # realistic Indian urban income distribution
    )
    age_group = rng.choice(
        ["18-25", "26-40", "40+"],
        size=len(users),
        p=[0.35, 0.45, 0.20]
    )

    demo = pd.DataFrame({
        "user_id":       users,
        "pin_code":      pin_codes,
        "city":          [CITY_MAP[p]       for p in pin_codes],
        "store_id":      [PIN_TO_STORE[p]   for p in pin_codes],
        "income_bucket": income_bucket,
        "age_group":     age_group,
    })

    print(f"  Users processed:  {len(demo):,}")
    print(f"  Store distribution:\n{demo['store_id'].value_counts().to_string()}")
    return demo


def save_demographics(demo: pd.DataFrame) -> None:
    os.makedirs(DATA_PROCESSED, exist_ok=True)
    out = os.path.join(DATA_PROCESSED, "user_demographics.parquet")
    demo.to_parquet(out, index=False)
    print(f"\n  Saved → {out}")


if __name__ == "__main__":
    print("=== DarkIQ — Synthetic Demographics ===\n")
    orders_path = os.path.join(DATA_RAW, "orders.csv")
    demo = build_demographics(orders_path)
    save_demographics(demo)
    print("\nDone. ✅")
    print("\nNOTE: pin_code, city, store_id, income_bucket, age_group are SYNTHETIC.")
    print("      Buying behaviour in master.parquet is 100% real Instacart data.")
