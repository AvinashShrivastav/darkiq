# HyperLocal Demand Intelligence System — Implementation Plan

> **Project:** DarkIQ — End-to-end demand intelligence for quick-commerce / dark store operations
> **Repo:** https://github.com/AvinashShrivastav/darkiq
> **Stack:** Python · FastAPI · PostgreSQL · Redis · Next.js · Material UI · Docker
> **Timeline:** 9 weeks

---

## How to Use This Plan

- Work **one phase at a time** — each phase produces a concrete deliverable before moving to the next
- Every phase ends with a **checkpoint** — a list of things that must be true before proceeding
- Code goes in `src/`, exploration goes in `notebooks/`, production API in `api/`, frontend in `frontend/`
- Commit to GitHub at the end of every working session

---

## Phase 0 — Environment & Repo Setup
**Duration:** Day 1 (before Week 1)

### Steps
1. GitHub repo is live at: `https://github.com/AvinashShrivastav/darkiq`
2. Clone locally and set up folder structure:
```
darkiq/
├── data/
│   ├── raw/
│   ├── processed/
│   └── external/
├── notebooks/
├── src/
│   ├── data/
│   ├── features/
│   ├── models/
│   ├── fusion/
│   └── utils/
├── api/
│   ├── routers/
│   ├── models/
│   └── tests/
├── frontend/                  # Next.js + MUI app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Store Overview
│   │   ├── replenishment/
│   │   ├── bundles/
│   │   ├── forecast/
│   │   ├── segments/
│   │   ├── map/
│   │   └── explain/
│   ├── components/
│   │   ├── KpiCard.tsx
│   │   ├── ReplenishmentTable.tsx
│   │   ├── ForecastChart.tsx
│   │   ├── SegmentRadar.tsx
│   │   ├── BundleCard.tsx
│   │   ├── DemandMap.tsx
│   │   └── UrgencyBadge.tsx
│   ├── lib/
│   │   └── api.ts             # typed fetch wrappers for FastAPI
│   ├── types/
│   │   └── index.ts           # shared TypeScript interfaces
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.ts
├── .gitignore
├── .env.example
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```
3. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate   # macOS/Linux
```
4. Install all dependencies:
```bash
pip install pandas numpy scikit-learn mlxtend lightgbm prophet \
  matplotlib seaborn plotly scipy imbalanced-learn shap rapidfuzz \
  requests sqlalchemy fastapi uvicorn redis celery \
  jupyter psycopg2-binary python-dotenv alembic
pip freeze > requirements.txt
```
5. Add `.gitignore` entries: `data/raw/`, `venv/`, `__pycache__/`, `.env`
6. Create `.env.example` with placeholders for `DATABASE_URL`, `REDIS_URL`

### Checkpoint ✅
- [ ] Repo exists on GitHub with initial commit
- [ ] `pip install -r requirements.txt` runs without errors
- [ ] Folder structure is in place

---

## Phase 1 — Data Ingestion & EDA
**Duration:** Week 1
**Deliverables:** `data/processed/master.parquet`, `notebooks/01_eda.ipynb`

### 1.1 Download Datasets

| Dataset | Source | How |
|---|---|---|
| Instacart transactions | Kaggle | `kaggle datasets download -d psparks/instacart-market-basket-analysis` |
| Weather (historical) | Open-Meteo | Free API, no key needed |
| Festival/IPL calendar | Hardcoded + Kaggle | Manual CSV creation |
| Product metadata | Open Food Facts | Download CSV |

### 1.2 Build the Master Table (`src/data/ingest.py`)
```python
# Pseudocode — implement in src/data/ingest.py
orders            = pd.read_csv('data/raw/orders.csv')
order_products    = pd.read_csv('data/raw/order_products__prior.csv')
products          = pd.read_csv('data/raw/products.csv')
aisles            = pd.read_csv('data/raw/aisles.csv')
departments       = pd.read_csv('data/raw/departments.csv')

products = products.merge(aisles, on='aisle_id').merge(departments, on='department_id')
df = orders.merge(order_products, on='order_id').merge(products, on='product_id')
df.to_parquet('data/processed/master.parquet', index=False)
```

### 1.3 Synthetic Demographics (`src/data/clean.py`)
- Assign each `user_id` a random Indian `pin_code` from 6 cities
- Assign `income_bucket` (low/mid/high) with realistic probabilities `[0.3, 0.5, 0.2]`
- Assign `age_group` (18-25 / 26-40 / 40+) with probabilities `[0.35, 0.45, 0.2]`
- Map `pin_code → store_id` (6 pin codes → 3 stores: store_A, store_B, store_C)
- Save to `data/processed/user_demographics.parquet`

### 1.4 EDA Notebook (`notebooks/01_eda.ipynb`)

Run and document all of the following analyses:

| Analysis | What to Look For |
|---|---|
| Order volume by day-of-week | Peak on Saturday/Sunday |
| Order volume by hour-of-day | Late-night vs morning peaks |
| Top 50 products by frequency | Banana, whole milk dominate |
| Basket size distribution | Mean ~8, heavy right skew |
| Days since prior order | Strong 7-day and 30-day peaks |
| Department × hour heatmap | Produce peaks morning, snacks at night |
| User reorder rate | Power users vs one-time buyers |
| Product correlation matrix (top 30) | Seeds intuition for association rules |

### Checkpoint ✅
- [ ] `master.parquet` exists and has >3M rows
- [ ] `user_demographics.parquet` exists with `pin_code`, `store_id`, `income_bucket`, `age_group`
- [ ] EDA notebook runs top-to-bottom without errors
- [ ] At least 6 plots saved as images in `notebooks/figures/`

---

## Phase 2 — Feature Engineering
**Duration:** Week 2
**Deliverables:** `data/processed/feat_rfm.parquet`, `data/processed/feature_store.parquet`

### 2.1 RFM Features (`src/features/rfm.py`)

| Feature | Computation |
|---|---|
| `recency` | Days since last order per `user_id` |
| `frequency` | Total orders in last 90 days |
| `monetary` | Avg basket size × avg reorder rate |
| `avg_order_hour` | `mean(order_hour_of_day)` per user |
| `night_owl_score` | Fraction of orders placed 22:00–03:00 |
| `weekend_concentration` | Fraction of orders on Sat/Sun |
| `reorder_ratio` | `reordered.mean()` per user |
| `organic_affinity` | Fraction of cart from organic products |

Save to `data/processed/feat_rfm.parquet`

### 2.2 Weather Features (`src/features/temporal.py`)
- Call Open-Meteo historical API for Mumbai (lat: 19.076, lon: 72.877)
- Fetch: `temperature_2m_max`, `precipitation_sum`, `weathercode`
- Create bins:
  - `temp_bin`: cold (<20°C) / mild (20–30°C) / hot (>30°C)
  - `rain_bin`: dry (<1mm) / drizzle (1–10mm) / heavy (>10mm)
- Join to `master.parquet` on `order_date`
- Save to `data/external/weather.parquet`

### 2.3 Event Features (`src/features/events.py`)

| Feature | How to Create |
|---|---|
| `is_festival` | Binary: 1 on Diwali, Holi, Eid, Navratri, Dussehra |
| `days_to_festival` | Days until next festival (0 on day, max 30) |
| `is_ipl_match_day` | 1 if any IPL match played that day |
| `is_exam_season` | 1 during March–April, Oct–Nov |
| `is_monsoon` | 1 for June–September |
| `is_weekend` | 1 for Saturday/Sunday |

Save to `data/external/events.parquet`

### 2.4 Merge into Feature Store
- Join `feat_rfm` + `weather` + `events` + `user_demographics` on `user_id` / `order_date`
- Save final `data/processed/feature_store.parquet`

### Checkpoint ✅
- [ ] `feat_rfm.parquet` has one row per `user_id` with all 8 RFM features
- [ ] `weather.parquet` covers the full date range of the orders data
- [ ] `feature_store.parquet` has no nulls in key feature columns
- [ ] `notebooks/02_feature_engineering.ipynb` runs clean top-to-bottom

---

## Phase 3 — Customer Micro-Segmentation
**Duration:** Week 3
**Deliverables:** `data/processed/seg_labels.parquet`, `notebooks/03_clustering.ipynb`

### 3.1 Prepare Feature Matrix (`src/models/clustering.py`)
1. Load `feature_store.parquet`, select the 12 clustering features
2. Apply `StandardScaler` — RFM values are on very different scales
3. Handle nulls: fill with column median

### 3.2 Find Optimal K
```python
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

scores = []
for k in range(3, 12):
    km = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = km.fit_predict(X_scaled)
    scores.append({
        'k': k,
        'inertia': km.inertia_,
        'silhouette': silhouette_score(X_scaled, labels)
    })
# Plot both — pick elbow on inertia + peak on silhouette
```

### 3.3 Fit Final Model
- Fit K-Means with best K (expect K=6 or K=7)
- Run DBSCAN (eps=0.5, min_samples=5) separately to isolate power-buyer outliers
- Label DBSCAN cluster as "Power User"

### 3.4 Name Each Cluster
- Compute mean feature values per cluster
- Assign persona names based on dominant features:

| Cluster | Persona Name | Key Signal |
|---|---|---|
| 0 | Late-night bachelor | High `night_owl_score`, snack affinity |
| 1 | Morning health buyer | High `organic_affinity`, orders 7–9am |
| 2 | Weekend family shopper | High `weekend_concentration`, large basket |
| 3 | Impulse buyer | Low recency, varied basket |
| 4 | Festival bulk buyer | Spikes on `is_festival` days |
| 5 | Power user (DBSCAN) | Extreme frequency, orders every 2–3 days |
| 6 | Student/exam buyer | High `is_exam_season` orders |

### 3.5 Validate & Report
- Silhouette Score target: **> 0.30**
- Davies-Bouldin Index target: **< 1.5**
- Plot t-SNE 2D scatter coloured by cluster label
- Pull top-20 products per cluster and confirm they match persona name

### Checkpoint ✅
- [ ] `seg_labels.parquet` has `user_id`, `cluster_id`, `cluster_name`, `silhouette_score`
- [ ] Silhouette Score ≥ 0.30
- [ ] t-SNE plot shows visually separable clusters
- [ ] Top products per cluster make intuitive sense

---

## Phase 4 — Basket Intelligence (Association Rules)
**Duration:** Week 4
**Deliverables:** `data/processed/assoc_rules.parquet`, `notebooks/04_association_rules.ipynb`

### 4.1 Prepare Contextual Slices (`src/models/association.py`)
1. Attach `segment_label`, `time_slot`, `rain_bin` to every order row
2. Define 4 time slots:
   - `morning`: 06:00–12:00
   - `afternoon`: 12:00–18:00
   - `evening`: 18:00–22:00
   - `night`: 22:00–06:00

### 4.2 Run FP-Growth Per Context Slice
```python
from mlxtend.frequent_patterns import fpgrowth, association_rules

all_rules = []
for seg in segments:
    for slot in time_slots:
        for weather in ['dry', 'drizzle', 'heavy']:
            sub = df[(df.segment==seg) & (df.time_slot==slot) & (df.rain_bin==weather)]
            if len(sub) < 200:
                continue  # skip sparse cells
            basket = sub.groupby(['order_id', 'product_name'])['reordered'] \
                        .count().unstack(fill_value=0)
            basket = basket.applymap(lambda x: 1 if x > 0 else 0)
            freq = fpgrowth(basket, min_support=0.05, use_colnames=True)
            rules = association_rules(freq, metric='lift', min_threshold=1.5)
            rules[['segment','time_slot','weather_bin']] = seg, slot, weather
            all_rules.append(rules)

final_rules = pd.concat(all_rules).sort_values('lift', ascending=False)
```

### 4.3 Store Rules
- Columns to keep: `antecedent`, `consequent`, `support`, `confidence`, `lift`, `segment`, `time_slot`, `weather_bin`
- Save to `data/processed/assoc_rules.parquet`

### 4.4 Metrics to Report

| Metric | Target |
|---|---|
| Total rules generated | 500–5,000 |
| Average lift | > 2.0 |
| Rule coverage (% baskets matched) | > 60% |
| Contextual lift vs global lift | Segment rules should be 30–50% higher |

### Checkpoint ✅
- [ ] `assoc_rules.parquet` exists with > 500 rules
- [ ] Average lift > 2.0
- [ ] Rules have `segment`, `time_slot`, `weather_bin` columns populated
- [ ] Top-5 rules per segment make business sense

---

## Phase 5 — Demand Forecasting
**Duration:** Week 5
**Deliverables:** `data/processed/forecasts.parquet`, `notebooks/05_forecasting.ipynb`

### 5.1 Build Demand Time Series (`src/models/forecasting.py`)
```python
demand = (df.groupby(['order_date', 'store_id', 'product_name'])
            .agg(units_sold=('product_id', 'count'))
            .reset_index())

# Lag features
demand['lag_1d']  = demand.groupby(['store_id','product_name'])['units_sold'].shift(1)
demand['lag_7d']  = demand.groupby(['store_id','product_name'])['units_sold'].shift(7)
demand['lag_14d'] = demand.groupby(['store_id','product_name'])['units_sold'].shift(14)
demand['lag_30d'] = demand.groupby(['store_id','product_name'])['units_sold'].shift(30)
demand['rolling_7d_mean'] = demand.groupby(['store_id','product_name'])['units_sold'] \
                                  .transform(lambda x: x.shift(1).rolling(7).mean())
demand['rolling_7d_std']  = demand.groupby(['store_id','product_name'])['units_sold'] \
                                  .transform(lambda x: x.shift(1).rolling(7).std())

# Join weather and events
demand = demand.merge(weather_df, on='order_date').merge(events_df, on='order_date')
```

### 5.2 Feature Set for LightGBM

| Group | Features | Importance |
|---|---|---|
| Lag | lag_1d, lag_7d, lag_14d, lag_30d | Very High |
| Rolling | rolling_7d_mean, rolling_7d_std, rolling_30d_mean | Very High |
| Calendar | day_of_week, is_weekend, month, week_of_year | High |
| Events | is_festival, days_to_festival, is_ipl_day, is_exam_season | High |
| Weather | temp_bin_encoded, rain_bin_encoded, precipitation_sum | Medium-High |
| Product | department_encoded, is_perishable, is_organic | Medium |
| Store | store_id_encoded, pin_income_bucket_encoded | Medium |

### 5.3 Training Strategy
- **NEVER use random split** — use `TimeSeriesSplit(n_splits=5)`
- Train LightGBM on high-volume SKUs (>50 sales/day avg)
- Train Prophet on seasonal SKUs (festival spikes, weekly patterns)
- Always compute naive baseline: `last_week_same_day`

### 5.4 Evaluation Targets

| Metric | Target |
|---|---|
| MAPE on top-50 SKUs | < 20% |
| MAE vs naive baseline | LightGBM beats naive by > 25% |
| Hit rate at 80% CI | > 80% of actuals within predicted range |

### 5.5 SHAP Explainability
```python
import shap
explainer   = shap.TreeExplainer(lgbm_model)
shap_values = explainer(X_test)
shap.summary_plot(shap_values, X_test, plot_type='bar')   # feature importance
shap.waterfall_plot(shap_values[0])                        # single prediction
```
Screenshot both plots — they are portfolio gold.

### Checkpoint ✅
- [ ] `forecasts.parquet` has `store_id`, `product_id`, `forecast_date`, `forecast_units`, `model_type`, `mape`
- [ ] MAPE < 20% on top-50 SKUs
- [ ] LightGBM beats naive baseline by > 25%
- [ ] SHAP summary plot saved as image

---

## Phase 6 — Intelligence Fusion Engine
**Duration:** Week 6
**Deliverables:** `data/processed/action_list.parquet`, `notebooks/06_fusion_engine.ipynb`

### 6.1 Fusion Logic (`src/fusion/engine.py`)

| Signal | Role |
|---|---|
| Forecast (LightGBM) | Base replenishment quantity |
| Stockout risk | `forecast_units > current_stock` → priority multiplier |
| Association rule lift | Bundle suggestions for high-demand items |
| Segment affinity | Boost if dominant segment has high item affinity |
| Event flag | Multiply forecast by event uplift factor |

### 6.2 Urgency Scoring (`src/fusion/scoring.py`)

| Level | Condition | Colour |
|---|---|---|
| 5 — Critical | forecast > stock AND festival in <3 days | #DC2626 red |
| 4 — High | forecast > 80% of stock | #EA580C orange |
| 3 — Medium | forecast > 60% of stock | #CA8A04 amber |
| 2 — Normal | routine replenishment | #16A34A green |
| 1 — Watch | low-velocity, downward trend | #6B7280 gray |

### 6.3 Output Schema — `action_list` table
```
store_id | sku_id | sku_name | forecast_units | current_stock | reorder_qty
| urgency | bundle_with | bundle_lift | segment_trigger | event_context | generated_at
```

### 6.4 30-Day Backtest
1. Hold out last 30 days of data (never seen during training)
2. Run fusion engine on day-1 data → generate action list
3. Compare recommended reorder qty vs actual demand on day-2
4. Count: avoided stockouts, over-stock incidents, bundle conversion proxies
5. Compute: `avoided_stockouts × avg_order_value_per_SKU` = estimated GMV impact

### Checkpoint ✅
- [ ] `action_list.parquet` has all schema columns populated
- [ ] Urgency levels 1–5 are correctly assigned
- [ ] Backtest produces a GMV impact estimate
- [ ] At least one "Critical" stockout event is caught > 6hr in advance

---

## Phase 7 — Database Setup
**Duration:** Start of Week 7 (before API)
**Deliverables:** Running PostgreSQL with all tables, Alembic migrations

### 7.1 Database Schema (`api/models/orm.py`)

| Table | Primary Key | Key Columns |
|---|---|---|
| `dim_products` | product_id | name, department, is_perishable, is_organic |
| `dim_users` | user_id | pin_code, income_bucket, age_group, store_id, segment_label |
| `fact_orders` | order_id | user_id, order_date, order_hour, weather_bin, event_flags |
| `fact_order_items` | (order_id, product_id) | quantity, reordered |
| `feat_rfm` | user_id | recency, frequency, monetary, night_owl, weekend_conc |
| `seg_labels` | user_id | cluster_id, cluster_name, silhouette_score |
| `assoc_rules` | rule_id | antecedent, consequent, support, confidence, lift, segment, slot, weather |
| `forecasts` | (store_id, product_id, forecast_date) | forecast_units, model_type, mape |
| `action_list` | (store_id, product_id, generated_at) | forecast_units, reorder_qty, urgency, bundle_with |

### 7.2 Setup Steps
```bash
# Start PostgreSQL via Docker
docker run --name pgdb -e POSTGRES_PASSWORD=secret -p 5432:5432 -d postgres:16

# Run Alembic migrations
alembic init alembic
alembic revision --autogenerate -m "initial schema"
alembic upgrade head

# Load parquet files into DB
python src/utils/db.py --load-all
```

### Checkpoint ✅
- [ ] All 9 tables exist in PostgreSQL
- [ ] Parquet data is loaded into the DB
- [ ] Can query `action_list` and get results

---

## Phase 8 — FastAPI Backend
**Duration:** Week 7
**Deliverables:** Working API at `localhost:8000/docs`

### 8.1 API Endpoints (`api/routers/`)

| Endpoint | File | Returns |
|---|---|---|
| `GET /stores` | stores.py | List of all dark stores |
| `GET /stores/{store_id}/actions` | stores.py | Ranked action list (cached 1hr) |
| `GET /stores/{store_id}/forecast` | forecast.py | 24hr SKU demand forecast |
| `GET /stores/{store_id}/bundles` | stores.py | Top bundle suggestions |
| `GET /segments` | segments.py | Cluster personas with feature profile |
| `GET /segments/{segment_id}/rules` | segments.py | Top association rules |
| `GET /sku/{product_id}/explain` | forecast.py | SHAP waterfall for SKU forecast |
| `POST /pipeline/trigger` | stores.py | Manually trigger ML pipeline re-run |
| `GET /health` | main.py | Health check |

### 8.2 Redis Caching Pattern (`api/main.py`)
```python
cache_key = f'actions:{store_id}'
cached = redis_client.get(cache_key)
if cached:
    return json.loads(cached)
# ... query DB ...
redis_client.setex(cache_key, 3600, json.dumps(result))  # 1hr TTL
```

### 8.3 Pydantic Schemas (`api/models/schemas.py`)
- Define response models for every endpoint
- This gives you automatic validation + clean Swagger docs

### Checkpoint ✅
- [ ] `uvicorn api.main:app --reload` starts without errors
- [ ] All 9 endpoints return valid JSON at `localhost:8000/docs`
- [ ] Redis caching works (second call is faster)
- [ ] `/health` returns `{"status": "ok"}`

---

## Phase 9 — Next.js + Material UI Frontend
**Duration:** Week 8
**Deliverables:** Working dashboard at `localhost:3000`

### 9.1 Project Bootstrap
```bash
cd frontend
npx create-next-app@latest . --typescript --app --tailwind=false --eslint
# NEXT_PUBLIC_API_URL=http://localhost:8000 → add to frontend/.env.local
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install recharts                        # charts
npm install react-leaflet leaflet           # pin-code map
npm install @tanstack/react-query           # API data fetching + caching
npm install @tanstack/react-table           # replenishment data table
```

### 9.2 MUI Theme Setup (`frontend/app/layout.tsx`)
```tsx
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';

const theme = createTheme({
  palette: {
    primary:   { main: '#1F4E79' },
    secondary: { main: '#2E75B6' },
  },
  typography: { fontFamily: 'Inter, Arial, sans-serif' },
});

export default function RootLayout({ children }) {
  return (
    <html><body>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </body></html>
  );
}
```

### 9.3 Pages & Key MUI Components

| Route | Page | Key MUI / Library Components |
|---|---|---|
| `/` | Store Overview | `Grid`, `Card`, `Typography` — KPI cards for SKU count, stockout risk, top alerts |
| `/replenishment` | Replenishment Board | `DataGrid` (MUI X) or TanStack Table, `Chip` for urgency badges |
| `/bundles` | Bundle Suggestions | `Card`, `CardContent`, `Chip` — antecedent → consequent, lift score |
| `/forecast` | Demand Forecast | Recharts `LineChart` — actual vs forecast, MUI `Autocomplete` SKU picker |
| `/segments` | Customer Segments | Recharts `RadarChart` per cluster, `ScatterChart` for t-SNE, `BarChart` |
| `/map` | Pin-Code Map | `react-leaflet` choropleth, MUI `Drawer` for store detail panel |
| `/explain` | Model Explainability | Recharts `BarChart` horizontal — SHAP feature importance waterfall |

### 9.4 Urgency Badge Component (`components/UrgencyBadge.tsx`)
```tsx
const URGENCY_CONFIG = {
  5: { label: 'Critical', color: '#DC2626' },
  4: { label: 'High',     color: '#EA580C' },
  3: { label: 'Medium',   color: '#CA8A04' },
  2: { label: 'Normal',   color: '#16A34A' },
  1: { label: 'Watch',    color: '#6B7280' },
};

export function UrgencyBadge({ level }: { level: number }) {
  const cfg = URGENCY_CONFIG[level];
  return (
    <Chip label={cfg.label} size="small"
      sx={{ bgcolor: cfg.color, color: '#fff', fontWeight: 700 }} />
  );
}
```

### 9.5 API Client (`frontend/lib/api.ts`)
```ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export const api = {
  getActions:  (storeId: string) => fetch(`${BASE}/stores/${storeId}/actions`).then(r => r.json()),
  getForecast: (storeId: string) => fetch(`${BASE}/stores/${storeId}/forecast`).then(r => r.json()),
  getBundles:  (storeId: string) => fetch(`${BASE}/stores/${storeId}/bundles`).then(r => r.json()),
  getSegments: ()                => fetch(`${BASE}/segments`).then(r => r.json()),
  getExplain:  (skuId: string)   => fetch(`${BASE}/sku/${skuId}/explain`).then(r => r.json()),
};
```

### 9.6 TanStack Query Wiring (`frontend/app/replenishment/page.tsx`)
```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ReplenishmentPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['actions', storeId],
    queryFn:  () => api.getActions(storeId),
    staleTime: 60_000,   // re-fetch every 60s
  });
  // render MUI DataGrid with data
}
```

### Checkpoint ✅
- [ ] `npm run dev` starts at `localhost:3000` without errors
- [ ] All 7 routes render without TypeScript errors
- [ ] Replenishment table shows urgency `Chip` colours correctly
- [ ] Forecast page renders Recharts `LineChart` with actual vs predicted
- [ ] Map page renders Leaflet choropleth
- [ ] All API calls go through `lib/api.ts` — no direct DB access from frontend
- [ ] MUI theme colours match the urgency colour system

---

## Phase 10 — Docker & Final Polish
**Duration:** Week 9
**Deliverables:** GitHub repo, `docker-compose up` works, README, portfolio write-up

### 10.1 Docker Compose (`docker-compose.yml`)
Services to define:
- `postgres` — PostgreSQL 16
- `redis` — Redis 7
- `api` — FastAPI app (depends on postgres, redis)
- `frontend` — Next.js app (depends on api)
- `pipeline` — One-shot container to run ML pipeline on startup

### 10.2 Dockerfiles

**API (`Dockerfile.api`)**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Frontend (`frontend/Dockerfile`)**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone .
COPY --from=builder /app/public ./public
CMD ["node", "server.js"]
```

### 10.3 README Sections
1. Project overview (2–3 sentences)
2. Architecture diagram (even a text-based one)
3. Quickstart: `git clone` → `docker-compose up`
4. Screenshots of dashboard pages
5. Key results (Silhouette Score, MAPE, GMV impact estimate)
6. Tech stack badges

### 10.4 Final Checklist
- [ ] `docker-compose up` starts all services in one command
- [ ] README has screenshots and key metrics
- [ ] All notebooks run clean top-to-bottom
- [ ] GitHub commit history shows regular progress (not one giant commit)
- [ ] `.env.example` has all required keys documented

---

## Summary — Deliverables by Week

| Week | Phase | Key Deliverable |
|---|---|---|
| 0 (Day 1) | Environment | Repo + folder structure + requirements.txt |
| 1 | Data Ingestion & EDA | master.parquet, eda_notebook.ipynb |
| 2 | Feature Engineering | feat_rfm.parquet, feature_store.parquet |
| 3 | Clustering | seg_labels.parquet, clustering_notebook.ipynb |
| 4 | Association Rules | assoc_rules.parquet, rules_notebook.ipynb |
| 5 | Forecasting | forecasts.parquet, forecast_notebook.ipynb |
| 6 | Fusion Engine | action_list.parquet, fusion_notebook.ipynb |
| 7 | DB + FastAPI | Working API at localhost:8000/docs |
| 8 | Next.js + MUI Frontend | Working dashboard at localhost:3000 |
| 9 | Docker + Polish | GitHub repo + README + portfolio post |

---

## Key Metrics to Hit

| Module | Metric | Target |
|---|---|---|
| Clustering | Silhouette Score | > 0.30 |
| Clustering | Davies-Bouldin Index | < 1.5 |
| Association Rules | Average Lift | > 2.0 |
| Association Rules | Contextual vs global lift gain | 30–50% higher |
| Forecasting | MAPE on top-50 SKUs | < 20% |
| Forecasting | Beat naive baseline | > 25% improvement |
| Fusion | Critical stockouts caught | > 6hr in advance |

---

## How to Work With Me (Amazon Q)

At each phase, come back and say something like:

- **"Let's start Phase 1"** → I'll scaffold `src/data/ingest.py` and the EDA notebook
- **"Phase 3 clustering is done, review it"** → I'll review your code and suggest improvements
- **"Help me debug the FP-Growth memory error"** → I'll diagnose and fix it
- **"Write the FastAPI router for /stores/{store_id}/actions"** → I'll write production-ready code
- **"Set up Docker Compose"** → I'll write the full `docker-compose.yml`
- **"Scaffold the Next.js frontend"** → I'll create the full folder structure, MUI theme, and all page skeletons
- **"Write the ReplenishmentTable component"** → I'll write the full typed MUI/TanStack Table component

Just tell me which phase you're on and what you need — I'll write the code, debug errors, or review what you've built.
