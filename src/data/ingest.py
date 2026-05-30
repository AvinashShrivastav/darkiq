"""
ingest.py
---------
Loads all raw Instacart CSVs, merges them into a single master
transaction table, and saves it as data/processed/master.parquet.

Run:
    python3 -m src.data.ingest
"""

import os
import pandas as pd
from src.utils.config import DATA_RAW, DATA_PROCESSED


def load_raw() -> dict[str, pd.DataFrame]:
    """Read all 5 Instacart CSV files into a dict of DataFrames."""
    files = {
        "orders":         "orders.csv",
        "order_products": "order_products__prior.csv",
        "products":       "products.csv",
        "aisles":         "aisles.csv",
        "departments":    "departments.csv",
    }
    dfs = {}
    for key, fname in files.items():
        path = os.path.join(DATA_RAW, fname)
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"Missing: {path}\n"
                f"Download from: https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis\n"
                f"Then unzip into: {DATA_RAW}/"
            )
        dfs[key] = pd.read_csv(path)
        print(f"  Loaded {fname}: {dfs[key].shape}")
    return dfs


def build_master(dfs: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """
    Merge all tables into one flat transaction table.

    Final columns:
        order_id, user_id, order_number, order_dow, order_hour_of_day,
        days_since_prior_order, product_id, product_name, reordered,
        aisle, department
    """
    # Enrich products with aisle and department names
    products = (
        dfs["products"]
        .merge(dfs["aisles"],       on="aisle_id")
        .merge(dfs["departments"],  on="department_id")
    )

    # Join orders → order_products → enriched products
    master = (
        dfs["orders"]
        .merge(dfs["order_products"], on="order_id")
        .merge(products[["product_id", "product_name", "aisle", "department"]], on="product_id")
    )

    # Keep only the 'prior' eval_set orders (training data)
    # 'train' and 'test' sets in Instacart are for their own ML challenge — we don't need them
    master = master[master["eval_set"] == "prior"].drop(columns=["eval_set"])

    print(f"\n  Master table shape: {master.shape}")
    print(f"  Unique users:       {master['user_id'].nunique():,}")
    print(f"  Unique orders:      {master['order_id'].nunique():,}")
    print(f"  Unique products:    {master['product_id'].nunique():,}")
    return master


def save_master(master: pd.DataFrame) -> None:
    os.makedirs(DATA_PROCESSED, exist_ok=True)
    out = os.path.join(DATA_PROCESSED, "master.parquet")
    master.to_parquet(out, index=False)
    print(f"\n  Saved → {out}")


if __name__ == "__main__":
    print("=== DarkIQ — Data Ingestion ===\n")
    print("Loading raw CSVs...")
    dfs    = load_raw()
    print("\nBuilding master table...")
    master = build_master(dfs)
    print("\nSaving...")
    save_master(master)
    print("\nDone. ✅")
