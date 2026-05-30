# DarkIQ 🧠🏪

> AI-powered demand intelligence engine for quick-commerce dark stores.

[![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![MUI](https://img.shields.io/badge/MUI-5-007FFF?logo=mui)](https://mui.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

---

## What is DarkIQ?

Quick-commerce platforms (Blinkit, Zepto, Swiggy Instamart) promise 10-minute delivery. Their edge isn't logistics — it's **knowing exactly what to stock, where, and when**.

DarkIQ replicates that intelligence layer from scratch:

- **Clusters** 200K+ customers into behavioural micro-personas (K-Means + DBSCAN)
- **Mines** segment-conditional, weather-aware basket rules (FP-Growth)
- **Forecasts** per-SKU demand 24hr ahead using LightGBM with weather + festival + IPL features
- **Fuses** all three signals into a ranked replenishment action list per dark store
- **Serves** everything via a FastAPI backend + Next.js + Material UI dashboard

---

## Architecture

```
Raw CSVs + Weather API + Calendar
  → ETL Pipeline       → PostgreSQL: dim_products, dim_users, fact_orders
  → Feature Store      → PostgreSQL: feat_rfm, feat_temporal, feat_weather
  → ML Pipelines       → PostgreSQL: seg_labels, assoc_rules, forecasts
  → Fusion Engine      → PostgreSQL: action_list (ranked replenishments)
  → FastAPI + Redis    → Next.js / MUI Dashboard
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Data & ML | Python 3.11, pandas, scikit-learn, LightGBM, Prophet, mlxtend, SHAP |
| Backend API | FastAPI, SQLAlchemy, Alembic, Redis, Celery |
| Database | PostgreSQL 16 |
| Frontend | Next.js 14, Material UI 5, Recharts, React-Leaflet, TanStack Query |
| Infrastructure | Docker, Docker Compose |

---

## Quickstart

```bash
# 1. Clone
git clone https://github.com/AvinashShrivastav/darkiq.git
cd darkiq

# 2. Copy env
cp .env.example .env

# 3. Start all services
docker-compose up --build

# API docs  → http://localhost:8000/docs
# Dashboard → http://localhost:3000
```

---

## Project Structure

```
darkiq/
├── data/
│   ├── raw/                  # original downloaded files (gitignored)
│   ├── processed/            # cleaned parquet files (gitignored)
│   └── external/             # weather CSV, events CSV (gitignored)
├── notebooks/                # EDA + ML exploration notebooks
├── src/
│   ├── data/                 # ingest.py, clean.py, weather_api.py
│   ├── features/             # rfm.py, temporal.py, events.py
│   ├── models/               # clustering.py, association.py, forecasting.py
│   ├── fusion/               # engine.py, scoring.py
│   └── utils/                # db.py, cache.py, config.py
├── api/
│   ├── main.py               # FastAPI app entry point
│   ├── routers/              # stores.py, segments.py, rules.py, forecast.py
│   ├── models/               # schemas.py (Pydantic), orm.py (SQLAlchemy)
│   └── tests/                # test_endpoints.py
├── frontend/                 # Next.js 14 + Material UI app
│   ├── app/                  # App Router pages
│   ├── components/           # Reusable UI components
│   ├── lib/                  # api.ts — typed FastAPI client
│   └── types/                # Shared TypeScript interfaces
├── .env.example
├── docker-compose.yml
├── Dockerfile.api
├── requirements.txt
└── IMPLEMENTATION_PLAN.md
```

---

## Key Metrics (targets)

| Module | Metric | Target |
|---|---|---|
| Clustering | Silhouette Score | > 0.30 |
| Association Rules | Average Lift | > 2.0 |
| Forecasting | MAPE on top-50 SKUs | < 20% |
| Forecasting | vs naive baseline | > 25% improvement |
| Fusion | Critical stockouts caught | > 6hr in advance |

---

## Roadmap

- [x] Project scaffold & implementation plan
- [ ] Phase 1 — Data ingestion & EDA
- [ ] Phase 2 — Feature engineering
- [ ] Phase 3 — Customer segmentation
- [ ] Phase 4 — Association rule mining
- [ ] Phase 5 — Demand forecasting
- [ ] Phase 6 — Fusion engine
- [ ] Phase 7 — Database + FastAPI
- [ ] Phase 8 — Next.js dashboard
- [ ] Phase 9 — Docker + deployment

---

## Dataset Credits

- [Instacart Market Basket Analysis](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis) — Kaggle
- [Open-Meteo Historical Weather API](https://open-meteo.com) — Free, no key needed
- [Open Food Facts](https://world.openfoodfacts.org/data) — Product metadata

---

*Built as a portfolio project inspired by real-world systems at Blinkit · Zepto · BigBasket Now · Swiggy Instamart*
