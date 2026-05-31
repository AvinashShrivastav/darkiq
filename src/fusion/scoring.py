"""
scoring.py
----------
Assigns urgency level (1-5) to each replenishment action.

Urgency levels:
    5 - Critical : forecast > current_stock AND festival in <3 days
    4 - High     : forecast > 80% of current_stock
    3 - Medium   : forecast > 60% of current_stock
    2 - Normal   : forecast > 0, routine replenishment
    1 - Watch    : forecast <= current_stock, monitor only
"""

import pandas as pd


URGENCY_COLORS = {
    5: "#DC2626",  # red
    4: "#EA580C",  # orange
    3: "#CA8A04",  # amber
    2: "#16A34A",  # green
    1: "#6B7280",  # gray
}

URGENCY_LABELS = {
    5: "Critical",
    4: "High",
    3: "Medium",
    2: "Normal",
    1: "Watch",
}


def assign_urgency(row: pd.Series) -> int:
    forecast      = row["forecast_units"]
    stock         = row["current_stock"]
    days_to_fest  = row.get("days_to_festival", 30)

    if forecast <= 0:
        return 1
    if forecast > stock and days_to_fest <= 3:
        return 5
    if forecast > stock * 0.80:
        return 4
    if forecast > stock * 0.60:
        return 3
    if forecast > 0:
        return 2
    return 1


def score_actions(df: pd.DataFrame) -> pd.DataFrame:
    df["urgency"]       = df.apply(assign_urgency, axis=1)
    df["urgency_label"] = df["urgency"].map(URGENCY_LABELS)
    df["urgency_color"] = df["urgency"].map(URGENCY_COLORS)
    return df
