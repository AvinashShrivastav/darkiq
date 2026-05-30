"""
events.py
---------
Creates event flags (festival, IPL, exam season, monsoon, weekend)
mapped to Instacart's relative order timeline.

Since Instacart has no real dates, we simulate a calendar by
anchoring order_number=1 to 2013-01-01 and computing a
synthetic order_date per order using cumulative days gaps.

Output: data/external/events.parquet

Run:
    python3 -m src.features.events
"""

import os
import pandas as pd
import numpy as np
from src.utils.config import DATA_PROCESSED, DATA_EXTERNAL


# ── Indian festival dates 2013–2015 ──────────────────────────────────────
FESTIVAL_DATES = [
    # Diwali
    "2013-11-03", "2014-10-23", "2015-11-11",
    # Holi
    "2013-03-27", "2014-03-17", "2015-03-06",
    # Eid ul-Fitr
    "2013-08-08", "2014-07-29", "2015-07-18",
    # Navratri start
    "2013-10-05", "2014-09-25", "2015-10-13",
    # Dussehra
    "2013-10-13", "2014-10-03", "2015-10-22",
]

# ── IPL match days (approximate — season runs Apr–May each year) ──────────
# We flag the entire IPL season window rather than individual match days
IPL_WINDOWS = [
    ("2013-04-03", "2013-05-26"),
    ("2014-04-16", "2014-06-01"),
    ("2015-04-08", "2015-05-24"),
]


def build_event_calendar(start="2013-01-01", end="2015-12-31") -> pd.DataFrame:
    dates = pd.date_range(start=start, end=end, freq="D")
    df    = pd.DataFrame({"date": dates})

    festival_dates = pd.to_datetime(FESTIVAL_DATES)

    # is_festival: 1 on exact festival day
    df["is_festival"] = df["date"].isin(festival_dates).astype(int)

    # days_to_festival: days until next festival (capped at 30)
    def days_to_next(d):
        future = festival_dates[festival_dates >= d]
        return min((future - d).days.min(), 30) if len(future) else 30

    df["days_to_festival"] = df["date"].apply(days_to_next)

    # is_ipl_match_day
    ipl_flags = pd.Series(False, index=df.index)
    for start_d, end_d in IPL_WINDOWS:
        mask = (df["date"] >= start_d) & (df["date"] <= end_d)
        ipl_flags |= mask
    df["is_ipl_match_day"] = ipl_flags.astype(int)

    # is_exam_season: Mar–Apr and Oct–Nov
    df["is_exam_season"] = df["date"].dt.month.isin([3, 4, 10, 11]).astype(int)

    # is_monsoon: Jun–Sep
    df["is_monsoon"] = df["date"].dt.month.isin([6, 7, 8, 9]).astype(int)

    # is_weekend: Sat or Sun
    df["is_weekend"] = df["date"].dt.dayofweek.isin([5, 6]).astype(int)

    return df


def save(df: pd.DataFrame) -> None:
    os.makedirs(DATA_EXTERNAL, exist_ok=True)
    out = os.path.join(DATA_EXTERNAL, "events.parquet")
    df.to_parquet(out, index=False)
    print(f"  Saved → {out}")


if __name__ == "__main__":
    print("=== DarkIQ — Event Calendar ===\n")
    df = build_event_calendar()
    print(f"  Calendar rows: {len(df)}")
    print(f"  Festival days: {df['is_festival'].sum()}")
    print(f"  IPL days:      {df['is_ipl_match_day'].sum()}")
    save(df)
    print("\nDone. ✅")
