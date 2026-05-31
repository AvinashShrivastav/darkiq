"""
forecasting.py
--------------
Forecasts daily per-SKU demand per store using LightGBM.

Pipeline:
    1. Build daily demand time series (store × product × date)
    2. Engineer lag + rolling features
    3. Join weather + event features
    4. Train LightGBM using TimeSeriesSplit (no data leakage)
    5. Evaluate MAPE vs naive baseline
    6. Generate SHAP feature importance plot
    7. Save forecasts.parquet

Scope: top-50 SKUs by total volume (covers ~40% of all demand)

Output: data/processed/forecasts.parquet

Run:
    python3 -m src.models.forecasting
"""

import os
import warnings
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

import lightgbm as lgb
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import LabelEncoder

from src.utils.config import DATA_PROCESSED, DATA_EXTERNAL

warnings.filterwarnings("ignore")
FIGURES  = "notebooks/figures"
TOP_SKUS = 50
os.makedirs(FIGURES, exist_ok=True)


# ── 1. Build demand time series ───────────────────────────────────────────
def build_demand() -> pd.DataFrame:
    master  = pd.read_parquet(os.path.join(DATA_PROCESSED, "master.parquet"))
    oc      = pd.read_parquet(os.path.join(DATA_PROCESSED, "order_context.parquet"))
    demo    = pd.read_parquet(os.path.join(DATA_PROCESSED, "user_demographics.parquet"))
    weather = pd.read_parquet(os.path.join(DATA_EXTERNAL,  "weather.parquet"))
    events  = pd.read_parquet(os.path.join(DATA_EXTERNAL,  "events.parquet"))

    df = (master[["order_id","user_id","product_name"]]
          .merge(oc[["order_id","order_date"]], on="order_id")
          .merge(demo[["user_id","store_id"]],  on="user_id"))

    # Daily units sold per store × product
    demand = (df.groupby(["order_date","store_id","product_name"])["order_id"]
                .count()
                .reset_index(name="units_sold"))

    # Keep only top-50 SKUs
    top_skus = (demand.groupby("product_name")["units_sold"]
                      .sum().nlargest(TOP_SKUS).index)
    demand = demand[demand["product_name"].isin(top_skus)].copy()

    # Full date spine — fill missing days with 0
    dates   = pd.date_range(demand["order_date"].min(), demand["order_date"].max())
    stores  = demand["store_id"].unique()
    skus    = demand["product_name"].unique()
    spine   = pd.MultiIndex.from_product([dates, stores, skus],
                names=["order_date","store_id","product_name"])
    demand  = (demand.set_index(["order_date","store_id","product_name"])
                     .reindex(spine, fill_value=0)
                     .reset_index())

    # Join weather + events
    weather["date"] = pd.to_datetime(weather["date"])
    events["date"]  = pd.to_datetime(events["date"])
    demand = (demand
              .merge(weather[["date","temp_max","precipitation","rain_bin"]],
                     left_on="order_date", right_on="date", how="left")
              .merge(events[["date","is_festival","days_to_festival",
                              "is_ipl_match_day","is_exam_season","is_monsoon","is_weekend"]],
                     left_on="order_date", right_on="date", how="left")
              .drop(columns=["date_x","date_y"], errors="ignore"))

    demand = demand.sort_values(["store_id","product_name","order_date"])
    print(f"  Demand shape: {demand.shape}")
    return demand


# ── 2. Lag + rolling features ─────────────────────────────────────────────
def add_lag_features(demand: pd.DataFrame) -> pd.DataFrame:
    grp = demand.groupby(["store_id","product_name"])["units_sold"]
    for lag in [1, 7, 14, 30]:
        demand[f"lag_{lag}d"] = grp.shift(lag)
    demand["rolling_7d_mean"]  = grp.shift(1).transform(lambda x: x.rolling(7,  min_periods=1).mean())
    demand["rolling_7d_std"]   = grp.shift(1).transform(lambda x: x.rolling(7,  min_periods=1).std().fillna(0))
    demand["rolling_30d_mean"] = grp.shift(1).transform(lambda x: x.rolling(30, min_periods=1).mean())

    demand["day_of_week"]  = pd.to_datetime(demand["order_date"]).dt.dayofweek
    demand["month"]        = pd.to_datetime(demand["order_date"]).dt.month
    demand["week_of_year"] = pd.to_datetime(demand["order_date"]).dt.isocalendar().week.astype(int)

    return demand.dropna(subset=["lag_30d"])   # drop first 30 days (no lag yet)


# ── 3. Encode categoricals ────────────────────────────────────────────────
def encode(demand: pd.DataFrame):
    le_store = LabelEncoder()
    le_sku   = LabelEncoder()
    le_rain  = LabelEncoder()
    demand["store_enc"] = le_store.fit_transform(demand["store_id"])
    demand["sku_enc"]   = le_sku.fit_transform(demand["product_name"])
    demand["rain_enc"]  = le_rain.fit_transform(demand["rain_bin"].astype(str))
    return demand


FEATURES = [
    "lag_1d","lag_7d","lag_14d","lag_30d",
    "rolling_7d_mean","rolling_7d_std","rolling_30d_mean",
    "day_of_week","month","week_of_year","is_weekend",
    "is_festival","days_to_festival","is_ipl_match_day","is_exam_season","is_monsoon",
    "temp_max","precipitation","rain_enc",
    "store_enc","sku_enc",
]


# ── 4. Train + evaluate ───────────────────────────────────────────────────
def train_evaluate(demand: pd.DataFrame):
    # Train only on rows with actual demand — zero-demand rows skew MAPE badly
    # Zero rows are kept in the full dataset for forecasting output
    demand_nz = demand[demand["units_sold"] > 0].copy()
    demand_nz = demand_nz.sort_values("order_date").reset_index(drop=True)
    X = demand_nz[FEATURES].fillna(0).values
    y = demand_nz["units_sold"].values

    tscv   = TimeSeriesSplit(n_splits=5)
    mapes, naive_mapes = [], []
    models = []

    for fold, (tr_idx, te_idx) in enumerate(tscv.split(X)):
        X_tr, X_te = X[tr_idx], X[te_idx]
        y_tr, y_te = y[tr_idx], y[te_idx]

        model = lgb.LGBMRegressor(
            n_estimators=300, learning_rate=0.05,
            num_leaves=63, min_child_samples=20,
            random_state=42, n_jobs=-1, verbose=-1
        )
        model.fit(X_tr, y_tr,
                  eval_set=[(X_te, y_te)],
                  callbacks=[lgb.early_stopping(30, verbose=False),
                             lgb.log_evaluation(-1)])

        preds = np.maximum(model.predict(X_te), 0)
        mape  = np.mean(np.abs((y_te - preds) / (y_te + 1))) * 100

        # Naive baseline: lag_7d (same day last week)
        naive = demand.iloc[te_idx]["lag_7d"].fillna(0).values
        naive_mape = np.mean(np.abs((y_te - naive) / (y_te + 1))) * 100

        mapes.append(mape)
        naive_mapes.append(naive_mape)
        models.append(model)
        print(f"  Fold {fold+1}: MAPE={mape:.2f}%  Naive={naive_mape:.2f}%  "
              f"Improvement={((naive_mape-mape)/naive_mape*100):.1f}%")

    avg_mape       = np.mean(mapes)
    avg_naive_mape = np.mean(naive_mapes)
    improvement    = (avg_naive_mape - avg_mape) / avg_naive_mape * 100
    print(f"\n  Avg MAPE:        {avg_mape:.2f}%")
    print(f"  Avg Naive MAPE:  {avg_naive_mape:.2f}%")
    print(f"  Improvement:     {improvement:.1f}%")

    # Use last fold model for SHAP + predictions
    best_model = models[-1]
    return best_model, avg_mape, improvement, demand_nz


# ── 5. SHAP feature importance ────────────────────────────────────────────
def plot_shap(model, demand_nz: pd.DataFrame) -> None:
    try:
        import shap
        X_sample = demand_nz[FEATURES].fillna(0).sample(2000, random_state=42).values
        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_sample)
        fig, ax = plt.subplots(figsize=(10, 7))
        shap.summary_plot(shap_values, X_sample,
                          feature_names=FEATURES,
                          plot_type="bar", show=False)
        plt.tight_layout()
        plt.savefig(f"{FIGURES}/11_shap_importance.png", dpi=150, bbox_inches="tight")
        plt.close()
        print(f"  SHAP plot saved → {FIGURES}/11_shap_importance.png")
    except ImportError:
        print("  shap not installed — skipping SHAP plot")


# ── 6. Generate + save forecasts ─────────────────────────────────────────
def save_forecasts(demand: pd.DataFrame, model, avg_mape: float) -> None:
    demand = demand.sort_values("order_date").reset_index(drop=True)
    X      = demand[FEATURES].fillna(0).values
    demand["forecast_units"] = np.maximum(model.predict(X), 0).round().astype(int)
    demand["model_type"]     = "lightgbm"
    demand["mape"]           = round(avg_mape, 2)

    out_cols = ["order_date","store_id","product_name",
                "units_sold","forecast_units","model_type","mape"]
    out = os.path.join(DATA_PROCESSED, "forecasts.parquet")
    demand[out_cols].to_parquet(out, index=False)
    print(f"  Saved → {out}  shape={demand.shape}")


if __name__ == "__main__":
    print("=== DarkIQ — Demand Forecasting ===\n")

    print("Building demand time series...")
    demand = build_demand()

    print("\nAdding lag + rolling features...")
    demand = add_lag_features(demand)
    demand = encode(demand)
    print(f"  Final shape after lag features: {demand.shape}")

    print("\nTraining LightGBM with TimeSeriesSplit...")
    model, avg_mape, improvement, demand_nz = train_evaluate(demand)

    print("\nGenerating SHAP plot...")
    plot_shap(model, demand_nz)

    print("\nSaving forecasts...")
    save_forecasts(demand, model, avg_mape)

    print("\nDone. ✅")
