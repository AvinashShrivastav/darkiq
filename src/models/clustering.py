"""
clustering.py
-------------
Clusters 206K users into behavioural micro-personas using
K-Means (main clusters) + DBSCAN (outlier/power-buyer detection).

Steps:
    1. Select 12 numeric features from feature_store.parquet
    2. StandardScaler — RFM values are on very different scales
    3. Elbow + Silhouette analysis to find optimal K
    4. Fit K-Means with best K
    5. Run DBSCAN to tag power-buyer outliers
    6. Name each cluster based on dominant feature profile
    7. Save seg_labels.parquet

Output: data/processed/seg_labels.parquet

Run:
    python3 -m src.models.clustering
"""

import os
import warnings
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")   # non-interactive backend — safe for scripts
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score, davies_bouldin_score
from sklearn.decomposition import PCA

from src.utils.config import DATA_PROCESSED

warnings.filterwarnings("ignore")

FIGURES = "notebooks/figures"
os.makedirs(FIGURES, exist_ok=True)

# ── Features used for clustering ─────────────────────────────────────────
CLUSTER_FEATURES = [
    "recency",
    "frequency",
    "monetary_proxy",
    "avg_basket_size",
    "reorder_ratio",
    "night_owl_score",
    "weekend_concentration",
    "avg_order_hour",
    "organic_affinity",
    "avg_days_between_orders",
    "pct_rainy_orders",
    "pct_festival_orders",
]


def load_and_scale(df: pd.DataFrame):
    X_raw = df[CLUSTER_FEATURES].fillna(df[CLUSTER_FEATURES].median())
    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)
    return X, scaler


def elbow_silhouette(X: np.ndarray, k_range=range(3, 11)) -> int:
    """Find optimal K and save elbow + silhouette plot."""
    inertias, silhouettes = [], []
    print("  Running elbow + silhouette analysis...")
    for k in k_range:
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(X)
        inertias.append(km.inertia_)
        silhouettes.append(silhouette_score(X, labels, sample_size=20000, random_state=42))
        print(f"    K={k}  inertia={km.inertia_:,.0f}  silhouette={silhouettes[-1]:.4f}")

    # Plot
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
    ax1.plot(list(k_range), inertias, "bo-")
    ax1.set_title("Elbow Method — Inertia", fontweight="bold")
    ax1.set_xlabel("K"); ax1.set_ylabel("Inertia")

    ax2.plot(list(k_range), silhouettes, "ro-")
    ax2.set_title("Silhouette Score by K", fontweight="bold")
    ax2.set_xlabel("K"); ax2.set_ylabel("Silhouette Score")

    plt.tight_layout()
    plt.savefig(f"{FIGURES}/09_elbow_silhouette.png", dpi=150)
    plt.close()

    best_k = list(k_range)[int(np.argmax(silhouettes))]
    print(f"\n  Best K by silhouette: {best_k}  (score={max(silhouettes):.4f})")
    return best_k


def fit_kmeans(X: np.ndarray, k: int) -> np.ndarray:
    km = KMeans(n_clusters=k, random_state=42, n_init=15)
    labels = km.fit_predict(X)
    sil = silhouette_score(X, labels, sample_size=20000, random_state=42)
    dbi = davies_bouldin_score(X, labels)
    print(f"\n  K-Means K={k}  Silhouette={sil:.4f}  Davies-Bouldin={dbi:.4f}")
    return labels


def fit_dbscan(X: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """
    Run DBSCAN on a sample to find power-buyer outliers.
    DBSCAN labels outliers as -1 — we remap these to a
    dedicated 'power_user' cluster.
    """
    # DBSCAN on full 206K is slow — run on high-frequency users only
    # (top 5% by frequency, which is where power buyers live)
    db = DBSCAN(eps=1.2, min_samples=10, n_jobs=-1)
    db_labels = db.fit_predict(X)
    # Mark DBSCAN outliers as power_user cluster (label = max_k + 1)
    power_user_label = labels.max() + 1
    labels = labels.copy()
    labels[db_labels == -1] = power_user_label
    n_power = (db_labels == -1).sum()
    print(f"  DBSCAN power-buyer outliers tagged: {n_power:,}")
    return labels, power_user_label


def name_clusters(df: pd.DataFrame, labels: np.ndarray, power_user_label: int) -> dict:
    """
    Profile each cluster by mean feature values and assign
    a human-readable persona name.
    """
    df = df.copy()
    df["cluster_id"] = labels

    profile = df.groupby("cluster_id")[CLUSTER_FEATURES].mean()

    # Naming rules based on dominant signals
    names = {}
    for cid, row in profile.iterrows():
        if cid == power_user_label:
            names[cid] = "power_user"
        elif row["night_owl_score"] > profile["night_owl_score"].quantile(0.75):
            names[cid] = "late_night_bachelor"
        elif row["organic_affinity"] > profile["organic_affinity"].quantile(0.75):
            names[cid] = "morning_health_buyer"
        elif row["weekend_concentration"] > profile["weekend_concentration"].quantile(0.75):
            names[cid] = "weekend_family_shopper"
        elif row["pct_festival_orders"] > profile["pct_festival_orders"].quantile(0.75):
            names[cid] = "festival_bulk_buyer"
        elif row["frequency"] < profile["frequency"].quantile(0.35) and row["avg_basket_size"] < profile["avg_basket_size"].quantile(0.5):
            names[cid] = "student_exam_buyer"
        else:
            names[cid] = "impulse_buyer"

    print("\n  Cluster personas:")
    for cid, name in names.items():
        size = (labels == cid).sum()
        print(f"    Cluster {cid}: {name:30s}  n={size:,}")
    return names


def plot_pca(X: np.ndarray, labels: np.ndarray, names: dict) -> None:
    """2D PCA scatter — faster than t-SNE, good enough for validation."""
    print("\n  Generating PCA scatter plot...")
    pca = PCA(n_components=2, random_state=42)
    # Sample 30K points for speed
    idx = np.random.default_rng(42).choice(len(X), size=min(30000, len(X)), replace=False)
    X_2d = pca.fit_transform(X[idx])
    lbl  = labels[idx]

    unique_labels = np.unique(lbl)
    colors = plt.cm.tab10(np.linspace(0, 1, len(unique_labels)))

    fig, ax = plt.subplots(figsize=(11, 8))
    patches = []
    for i, cid in enumerate(unique_labels):
        mask = lbl == cid
        ax.scatter(X_2d[mask, 0], X_2d[mask, 1],
                   c=[colors[i]], s=2, alpha=0.4)
        patches.append(mpatches.Patch(color=colors[i], label=f"{cid}: {names.get(cid, '')}"))

    ax.legend(handles=patches, loc="upper right", fontsize=8)
    ax.set_title("Customer Segments — PCA 2D Projection", fontsize=14, fontweight="bold")
    ax.set_xlabel(f"PC1 ({pca.explained_variance_ratio_[0]*100:.1f}% var)")
    ax.set_ylabel(f"PC2 ({pca.explained_variance_ratio_[1]*100:.1f}% var)")
    plt.tight_layout()
    plt.savefig(f"{FIGURES}/10_pca_clusters.png", dpi=150)
    plt.close()
    print(f"  Saved → {FIGURES}/10_pca_clusters.png")


def save(df: pd.DataFrame, labels: np.ndarray, names: dict) -> None:
    seg = df[["user_id"]].copy()
    seg["cluster_id"]   = labels
    seg["cluster_name"] = seg["cluster_id"].map(names)
    out = os.path.join(DATA_PROCESSED, "seg_labels.parquet")
    seg.to_parquet(out, index=False)
    print(f"\n  Saved → {out}")
    print(f"  Shape: {seg.shape}")
    print(seg["cluster_name"].value_counts().to_string())


if __name__ == "__main__":
    print("=== DarkIQ — Customer Segmentation ===\n")

    df = pd.read_parquet(os.path.join(DATA_PROCESSED, "feature_store.parquet"))
    print(f"  Loaded feature store: {df.shape}")

    X, scaler = load_and_scale(df)

    best_k    = elbow_silhouette(X)
    labels    = fit_kmeans(X, best_k)
    labels, power_user_label = fit_dbscan(X, labels)
    names     = name_clusters(df, labels, power_user_label)

    plot_pca(X, labels, names)
    save(df, labels, names)

    print("\nDone. ✅")
