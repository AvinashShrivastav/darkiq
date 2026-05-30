"""
weather_api.py
--------------
Fetches real historical daily weather from the Open-Meteo
archive API (free, no API key needed) for Mumbai.

Why Mumbai?
    We assigned ~33% of users to Mumbai stores. Using Mumbai
    weather as the representative city keeps things simple for
    Phase 1. In a production system you'd fetch per-city.

Output: data/external/weather.parquet
    Columns: date, temp_max, precipitation, weathercode,
             temp_bin, rain_bin

Run:
    python3 -m src.data.weather_api
"""

import os
import requests
import pandas as pd
from src.utils.config import DATA_EXTERNAL


# Instacart orders span roughly 2013–2015 based on order sequence.
# Open-Meteo archive goes back to 1940 so this is fine.
WEATHER_CONFIG = {
    "latitude":   19.076,
    "longitude":  72.877,
    "start_date": "2013-01-01",
    "end_date":   "2015-12-31",
    "daily":      "temperature_2m_max,precipitation_sum,weathercode",
    "timezone":   "Asia/Kolkata",
}


def fetch_weather() -> pd.DataFrame:
    url = "https://archive-api.open-meteo.com/v1/archive"
    print(f"  Fetching weather from Open-Meteo ({WEATHER_CONFIG['start_date']} → {WEATHER_CONFIG['end_date']})...")
    r = requests.get(url, params=WEATHER_CONFIG, timeout=30)
    r.raise_for_status()
    data = r.json()["daily"]

    df = pd.DataFrame({
        "date":          pd.to_datetime(data["time"]),
        "temp_max":      data["temperature_2m_max"],
        "precipitation": data["precipitation_sum"],
        "weathercode":   data["weathercode"],
    })

    # Temperature bins
    df["temp_bin"] = pd.cut(
        df["temp_max"],
        bins=[-999, 20, 30, 999],
        labels=["cold", "mild", "hot"]
    )

    # Rain bins
    df["rain_bin"] = pd.cut(
        df["precipitation"],
        bins=[-1, 1, 10, 9999],
        labels=["dry", "drizzle", "heavy"]
    )

    print(f"  Fetched {len(df)} days of weather data")
    print(f"  Rain distribution:\n{df['rain_bin'].value_counts().to_string()}")
    return df


def save_weather(df: pd.DataFrame) -> None:
    os.makedirs(DATA_EXTERNAL, exist_ok=True)
    out = os.path.join(DATA_EXTERNAL, "weather.parquet")
    df.to_parquet(out, index=False)
    print(f"\n  Saved → {out}")


if __name__ == "__main__":
    print("=== DarkIQ — Weather Fetch ===\n")
    df = fetch_weather()
    save_weather(df)
    print("\nDone. ✅")
