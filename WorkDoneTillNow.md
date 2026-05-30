# DarkIQ — Work Done Till Now

> This file is your single source of truth for interviews, portfolio reviews, and resume prep.
> Updated after every phase. Never skip reading this before an interview.

---

## Phase 0 — Project Scaffold & Setup
**Date Completed:** 2025-01-27
**Status:** ✅ Complete

---

### What Was Built

| File / Folder | What It Is |
|---|---|
| `README.md` | Full project description with badges, architecture diagram, tech stack table, quickstart, and roadmap |
| `requirements.txt` | All Python dependencies pinned to exact versions |
| `.env.example` | Template for all environment variables — DB URL, Redis URL, API port, Kaggle keys |
| `Dockerfile.api` | Docker container definition for the FastAPI backend |
| `docker-compose.yml` | Orchestrates all 5 services: PostgreSQL, Redis, API, Frontend, Pipeline |
| `IMPLEMENTATION_PLAN.md` | Detailed 10-phase build plan with checkpoints, code snippets, and metrics targets |
| `.gitignore` | Prevents node_modules, venv, raw data, .env, ML model files from being committed |
| `.amazonq/rules/WorkDoneTillNow.md` | Rule that forces this file to be updated after every phase |
| `src/data/ingest.py` | Placeholder — will load and merge Instacart CSVs |
| `src/data/clean.py` | Placeholder — will clean data and add synthetic Indian geography |
| `src/data/weather_api.py` | Placeholder — will call Open-Meteo API |
| `src/features/rfm.py` | Placeholder — will compute RFM + behavioural features per user |
| `src/features/temporal.py` | Placeholder — will compute time-of-day and weather features |
| `src/features/events.py` | Placeholder — will create festival, IPL, exam season flags |
| `src/models/clustering.py` | Placeholder — will run K-Means + DBSCAN |
| `src/models/association.py` | Placeholder — will run FP-Growth per context slice |
| `src/models/forecasting.py` | Placeholder — will train LightGBM + Prophet |
| `src/fusion/engine.py` | Placeholder — will combine all ML signals into action list |
| `src/fusion/scoring.py` | Placeholder — will assign urgency scores 1–5 |
| `src/utils/db.py` | Placeholder — will handle DB connections and parquet loading |
| `src/utils/cache.py` | Placeholder — will handle Redis get/set helpers |
| `src/utils/config.py` | Placeholder — will load .env variables into a config object |
| `api/main.py` | Placeholder — FastAPI app entry point |
| `api/routers/stores.py` | Placeholder — /stores endpoints |
| `api/routers/segments.py` | Placeholder — /segments endpoints |
| `api/routers/rules.py` | Placeholder — /rules endpoints |
| `api/routers/forecast.py` | Placeholder — /forecast + /explain endpoints |
| `api/models/schemas.py` | Placeholder — Pydantic response models |
| `api/models/orm.py` | Placeholder — SQLAlchemy table definitions |
| `api/tests/test_endpoints.py` | Placeholder — API tests |
| `frontend/` | Empty folder tree ready for Next.js bootstrap in Phase 9 |
| `data/raw/`, `data/processed/`, `data/external/` | Empty folders with .gitkeep — data goes here but is never committed |
| `generate_doc.js` | Node.js script that generates the full project PDF/DOCX using the `docx` library |
| `HyperLocal_Demand_Intelligence_Project_Document.docx` | Generated 25-page project reference document |

---

### Decisions Made

**1. Project name: DarkIQ**
- Considered: StockSense, DarkPulse, ZeroStockout, NexStore
- Chose DarkIQ because: two syllables, directly references dark stores (the domain), "IQ" signals intelligence and ML, unique and Googleable, looks good as a badge and in a LinkedIn headline

**2. Frontend: Next.js 14 + Material UI instead of Streamlit**
- Streamlit was the original plan (fastest to build)
- Switched to Next.js + MUI because: it produces a production-grade portfolio piece, MUI gives a polished Google-style UI out of the box, TypeScript gives type safety across the API boundary, and it is far more impressive to recruiters than a Streamlit app
- Trade-off: takes longer to build (Week 8 vs a few hours for Streamlit)

**3. Python version: 3.11**
- Chose 3.11 over 3.12 because Prophet (Facebook's forecasting library) has known compatibility issues with 3.12 as of mid-2025
- 3.11 is stable, widely supported, and all ML libraries have tested wheels for it

**4. Database: PostgreSQL 16 (not SQLite)**
- SQLite would be simpler for local dev but cannot handle concurrent API requests well
- PostgreSQL is what real production systems use — using it here makes the project honest and the skills transferable
- For local dev without Docker: can still use SQLite by changing DATABASE_URL in .env

**5. ORM: SQLAlchemy 2.x (not raw SQL)**
- SQLAlchemy 2.x has a cleaner async-compatible API than 1.x
- Alembic (same ecosystem) handles schema migrations — this is a real production pattern
- Raw SQL would be faster to write but harder to maintain and less impressive on a resume

**6. Caching: Redis (not in-memory)**
- FastAPI can cache in-memory but that cache dies on every restart
- Redis persists across restarts and works across multiple API workers
- Redis is the industry standard for this use case (Blinkit, Zepto use it)

**7. Task queue: Celery + Redis broker**
- The ML pipeline (clustering, forecasting) needs to re-run on a schedule
- Celery is the standard Python task queue — it uses Redis as both broker and result backend
- Alternative was APScheduler (simpler) but Celery is more resume-worthy

**8. Forecasting: LightGBM as primary, Prophet as secondary**
- LightGBM: best for high-volume SKUs, handles lag features and event flags natively, very fast training, industry standard at Flipkart/Amazon
- Prophet: best for seasonal SKUs with strong weekly/festival patterns, interpretable decomposition
- Naive baseline (last week same day) always computed — you cannot claim your model is good without beating a baseline

**9. Association rules: FP-Growth over Apriori**
- Apriori generates all candidate itemsets first — memory explodes on 50K products
- FP-Growth builds a compressed tree structure — O(n) on the tree pass, far more memory efficient
- mlxtend implements both — FP-Growth is the right choice at this data scale

**10. Synthetic Indian geography layer**
- Instacart is US data — no Indian pin codes, cities, or store IDs exist in it
- Decision: assign each user_id a random Indian pin code from 6 real Indian cities (Mumbai, Delhi, Bangalore)
- The buying behaviour (what people buy, when, how often) is 100% real Instacart data
- Only the geography mapping is synthetic — this is standard practice in portfolio projects and must be disclosed (it is, in the README and this file)

**11. Git strategy: commit after every phase**
- One giant commit at the end looks bad to recruiters — they check commit history
- Committing after each phase shows disciplined, incremental development
- Commit messages follow the format: `feat: phase X — description`

**12. .gitignore: exclude data files**
- Raw CSVs and parquet files can be hundreds of MB — never commit them
- Anyone cloning the repo downloads the data themselves (instructions in README)
- ML model files (.pkl, .joblib) also excluded — models are re-trained from the pipeline

---

### Challenges & How They Were Resolved

**Challenge 1: generate_doc.js output path was `/mnt/user-data/outputs/` (a Linux sandbox path)**
- This path does not exist on macOS
- Fix: changed output path to `/Users/avinash/Projects/MLProject/HyperLocal_Demand_Intelligence_Project_Document.docx`

**Challenge 2: `docx` npm package was not installed**
- Running `node generate_doc.js` threw `Cannot find module 'docx'`
- Fix: ran `npm install docx` in the project directory

**Challenge 3: `node_modules/` was about to be tracked by git**
- No `.gitignore` existed when the repo was first initialised
- Fix: created `.gitignore` before the first `git add .` — `node_modules/` was never actually committed

**Challenge 4: Git remote already existed when re-initialising**
- Running `git remote add origin` after `git init` on an existing repo threw `error: remote origin already exists`
- Fix: this was harmless — the remote was already correctly set, so we proceeded with `git add` and `git commit`

---

### What Is Real vs Synthetic

| Data | Real or Synthetic | Source |
|---|---|---|
| Order transactions (3.4M orders) | ✅ Real | Instacart via Kaggle |
| Product catalogue (50K products) | ✅ Real | Instacart via Kaggle |
| User buying behaviour (reorders, basket size, timing) | ✅ Real | Instacart via Kaggle |
| Weather data | ✅ Real | Open-Meteo historical API |
| Festival & IPL calendar | ✅ Real | Public calendars |
| Indian pin codes assigned to users | ⚠️ Synthetic | Randomly assigned — disclosed in README |
| Store IDs (store_A, store_B, store_C) | ⚠️ Synthetic | Mapped from pin codes — disclosed |
| Income bucket & age group per user | ⚠️ Synthetic | Randomly assigned with realistic probabilities |

---

### Resume Talking Points

- **"Designed and scaffolded a production-grade ML system from scratch — defined a 5-layer architecture (ingestion → feature store → ML pipelines → fusion engine → API + dashboard) with clear separation of concerns between each layer."**

- **"Made deliberate technology choices at every layer: PostgreSQL over SQLite for production realism, FP-Growth over Apriori for memory efficiency at scale, LightGBM + Prophet dual-model strategy for different SKU velocity profiles, and Next.js + MUI over Streamlit for a portfolio-grade frontend."**

- **"Applied professional engineering practices from day one: pinned dependency versions in requirements.txt, environment variable management via .env, Docker Compose for one-command reproducibility, and a git commit strategy that shows incremental progress to recruiters."**

---

### Up Next

Phase 1 — download the Instacart dataset, build the master transaction table, add synthetic Indian geography, and run full EDA with 8 documented analyses and saved plots.

---

---

## Phase 1 — Data Ingestion & EDA
**Date Completed:** 2025-01-27
**Status:** ✅ Complete

---

### What Was Built

| File | What It Does |
|---|---|
| `src/utils/config.py` | Loads all environment variables from `.env` into Python constants — `DATA_RAW`, `DATA_PROCESSED`, `DATABASE_URL`, etc. Every other script imports from here instead of hardcoding paths |
| `src/data/ingest.py` | Loads all 5 Instacart CSVs, merges them into one flat transaction table, filters to `eval_set == 'prior'` (the actual historical orders), saves as `data/processed/master.parquet` |
| `src/data/clean.py` | Assigns each `user_id` a synthetic Indian pin code, city, store_id, income_bucket, and age_group. Saves as `data/processed/user_demographics.parquet` |
| `src/data/weather_api.py` | Calls the Open-Meteo free historical API for Mumbai (2013–2015), creates `temp_bin` (cold/mild/hot) and `rain_bin` (dry/drizzle/heavy) columns, saves as `data/external/weather.parquet` |
| `notebooks/01_eda.ipynb` | Full EDA notebook with 8 analyses and plots, all saved to `notebooks/figures/` |

---

### Decisions Made

**1. Filter to `eval_set == 'prior'` only**
- Instacart has 3 eval sets: `prior` (historical orders), `train` (last order for their ML challenge), `test` (held out for their challenge)
- We only want `prior` — it contains the full order history (3.2M+ orders)
- `train` and `test` are artefacts of Instacart's own Kaggle competition, not relevant to our use case

**2. `numpy.random.default_rng(seed=42)` for synthetic demographics**
- Used the new NumPy Generator API (`default_rng`) instead of the legacy `np.random.seed()`
- Reason: `default_rng` is statistically better (PCG64 algorithm), reproducible, and the modern NumPy standard
- Fixed seed 42 means every run produces the same user→pin_code mapping — important for reproducibility

**3. 6 pin codes across 3 cities (Mumbai, Delhi, Bangalore)**
- Chose India's 3 largest metro cities — most realistic for quick-commerce (Blinkit, Zepto operate here)
- 2 pin codes per city → 2 dark stores per city → 6 stores total
- This gives enough geographic variety to make the store-level analysis interesting

**4. Weather date range: 2013–2015**
- Instacart's order data is from approximately 2013–2015 (inferred from order sequence numbers)
- Open-Meteo archive goes back to 1940 — no issue fetching this range
- Mumbai chosen as the representative city because ~33% of users are assigned there

**5. Normalised heatmap for Department × Hour analysis**
- Raw counts would make high-volume departments (produce, dairy) dominate the colour scale
- Normalising each row by its own max shows *relative* peak hours per department — much more informative
- This is the correct way to compare departments of very different sizes

**6. Product correlation matrix on top-30 only**
- Full 50K product correlation matrix would be 50K × 50K — impossible to compute or visualise
- Top-30 by frequency gives the most actionable co-purchase signal
- This directly seeds intuition for which association rules to expect in Phase 4

**7. `figures/` folder inside `notebooks/`**
- All plots saved as PNG files at 150 DPI — good enough for portfolio screenshots, not too large for git
- Keeping figures inside `notebooks/figures/` keeps the notebook folder self-contained

---

### Challenges & How They Were Resolved

**Challenge 1: Python 3.9 on the machine vs 3.11 in requirements.txt**
- The system Python is 3.9.6, but requirements.txt specifies 3.11
- This is fine for Phase 1 — pandas, numpy, matplotlib all work on 3.9
- Resolution: noted for later — when Prophet is installed (Phase 5), a virtual environment with 3.11 will be needed. For now, system Python is sufficient.

**Challenge 2: `pyarrow` and `mlxtend` were not installed**
- `pip3 show pyarrow mlxtend` returned nothing
- Resolution: `pip3 install pyarrow mlxtend requests python-dotenv` — installed cleanly

**Challenge 3: Instacart data requires manual download**
- Kaggle CLI requires authentication — cannot be automated without the user's Kaggle API key
- Resolution: `ingest.py` raises a clear `FileNotFoundError` with the exact download URL and target folder if CSVs are missing. The user downloads once and the script handles everything else.

---

### What Is Real vs Synthetic

| Data | Real or Synthetic | Notes |
|---|---|---|
| Orders, products, baskets | ✅ Real | Instacart Kaggle dataset |
| Weather (temp, rain, weathercode) | ✅ Real | Open-Meteo historical API |
| `pin_code`, `city`, `store_id` | ⚠️ Synthetic | Randomly assigned to user_ids — disclosed in code comments and README |
| `income_bucket`, `age_group` | ⚠️ Synthetic | Randomly assigned with realistic Indian urban probabilities |

---

### Resume Talking Points

- **"Built a robust ETL pipeline in Python that ingests 5 relational CSVs (3.4M orders, 50K products, 206K users), merges them into a single flat transaction table, and persists as Parquet for efficient downstream processing."**

- **"Conducted 8-point EDA on the Instacart dataset — identified key behavioural signals including a 7-day and 30-day reorder cycle, morning peaks for produce, evening peaks for snacks, and a right-skewed basket size distribution — all of which directly informed feature engineering decisions in Phase 2."**

- **"Integrated real historical weather data via the Open-Meteo API (free, no key required) and engineered temperature and rainfall bins to serve as contextual features for association rule mining and demand forecasting."**

---

### Up Next

Phase 2 — compute RFM + behavioural features per user, join weather and event flags, and build the unified feature store that feeds the clustering and forecasting models.

---

---

## Phase 2 — Feature Engineering
**Date Completed:** 2025-01-27
**Status:** ✅ Complete

---

### What Was Built

| File | What It Does |
|---|---|
| `src/features/rfm.py` | Computes 10 user-level features: recency, frequency, monetary proxy, avg basket size, reorder ratio, night owl score, weekend concentration, avg order hour, organic affinity, avg days between orders |
| `src/features/events.py` | Builds a 1,095-day calendar (2013–2015) with festival flags, days_to_festival, IPL window flags, exam season, monsoon, and weekend flags |
| `src/features/temporal.py` | Assigns synthetic order dates to every order, joins weather + events onto orders, aggregates to user level, merges with RFM + demographics → `feature_store.parquet` |
| `data/processed/feat_rfm.parquet` | 206,209 rows × 11 columns — one row per user |
| `data/external/events.parquet` | 1,095 rows × 7 columns — one row per calendar day |
| `data/processed/feature_store.parquet` | 206,209 rows × 21 columns — the unified input to clustering |
| `data/processed/order_context.parquet` | 3,214,874 rows — every order with its date, weather, and event context — used by association rules and forecasting |

---

### Decisions Made

**1. Recency computed from days_since_prior_order gaps, not real dates**
- Instacart has no calendar dates — only `order_number` (1–99) and `days_since_prior_order`
- Recency = `max_total_days - user_total_days` so that lower recency = more recently active
- This is the correct approach for datasets without timestamps

**2. Monetary proxy = avg_basket_size × reorder_ratio**
- Instacart has no price data
- Basket size × reorder ratio is the best available proxy: a user who buys 15 items and reorders 80% of them is more valuable than one who buys 5 items and reorders 20%
- This is a standard technique when price data is unavailable

**3. Synthetic order dates anchored to 2013-01-01 with random per-user offsets**
- Each user's first order is assigned a random date in 2013 (offset 0–364 days)
- Subsequent orders step forward using `days_since_prior_order`
- Fixed seed 42 ensures the same dates are produced every run
- This is necessary to join weather and event data, which are calendar-based
- Clearly synthetic — disclosed in code comments

**4. IPL flagged as a season window, not individual match days**
- Individual IPL match schedules for 2013–2015 would require scraping
- Flagging the entire IPL season (Apr–May) is accurate enough for demand signal purposes — snack/beverage demand is elevated throughout the season, not just on match days

**5. Weather aggregated to user level as percentages**
- Weather is order-level (each order has a weather context)
- For clustering we need user-level features
- `pct_rainy_orders` = fraction of a user's orders placed on rainy days — this captures whether a user is a "rainy day buyer" which is a real behavioural signal

**6. Saved `order_context.parquet` separately**
- The order-level weather + event context is needed again in Phase 4 (association rules) and Phase 5 (forecasting)
- Saving it now avoids recomputing the date assignment and joins later

---

### Challenges & How They Were Resolved

**Challenge 1: No real dates in Instacart**
- Cannot join weather or events without dates
- Resolution: synthetic date assignment using cumulative `days_since_prior_order` gaps per user, anchored to 2013-01-01. Capped at 2015-12-31 to stay within the weather/event data range.

**Challenge 2: `date_x` / `date_y` column collision after double merge**
- Merging on `order_date` vs `date` (weather) then again vs `date` (events) created duplicate `date` columns
- Resolution: `drop(columns=["date_x", "date_y"], errors="ignore")` after both merges

---

### What Is Real vs Synthetic

| Data | Real or Synthetic |
|---|---|
| RFM features (recency, frequency, basket size, reorder ratio) | ✅ Real — computed from real Instacart behaviour |
| night_owl_score, weekend_concentration, organic_affinity | ✅ Real — computed from real order timing and product names |
| Festival dates, IPL season windows | ✅ Real — actual Indian calendar dates |
| Weather (temp_bin, rain_bin) | ✅ Real — Open-Meteo historical API |
| order_date assigned to each order | ⚠️ Synthetic — anchored simulation, not real timestamps |
| pct_festival_orders, pct_rainy_orders | ⚠️ Derived from synthetic dates — directionally valid, not exact |

---

### Resume Talking Points

- **"Engineered a 21-feature user-level feature store from raw transaction data — including RFM metrics, behavioural signals (night-owl score, organic affinity, weekend concentration), and contextual aggregates (% orders on rainy days, % during IPL season) — with zero null values across 206K users."**

- **"Solved the absence of real timestamps in the Instacart dataset by implementing a reproducible synthetic date assignment strategy using cumulative order gap simulation, enabling calendar-based feature joins with real weather and festival data."**

- **"Built a reusable event calendar covering 3 years of Indian festivals (Diwali, Holi, Eid, Navratri, Dussehra), IPL season windows, exam seasons, and monsoon periods — all as binary/numeric features ready for ML consumption."**

---

### Up Next

Phase 3 — load the feature store into a clustering pipeline, find optimal K using elbow + silhouette analysis, fit K-Means + DBSCAN, name each cluster as a persona, and validate with t-SNE.

---
