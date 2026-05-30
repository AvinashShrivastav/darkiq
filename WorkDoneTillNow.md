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
