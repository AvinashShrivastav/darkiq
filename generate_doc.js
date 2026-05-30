const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, ExternalHyperlink,
  Header, Footer, TabStopType, TabStopPosition
} = require('docx');
const fs = require('fs');

const BLUE = "1F4E79";
const LIGHT_BLUE = "D6E4F0";
const MED_BLUE = "2E75B6";
const ACCENT = "E8F4FD";
const GRAY = "595959";
const LIGHT_GRAY = "F2F2F2";
const GREEN = "1E6B3C";
const LIGHT_GREEN = "D9EFE2";
const PURPLE = "4B0082";
const LIGHT_PURPLE = "EDE7F6";
const ORANGE = "7B3F00";
const LIGHT_ORANGE = "FFF3E0";
const RED_DARK = "7B0000";
const LIGHT_RED = "FDECEA";

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 36, color: BLUE, font: "Arial" })],
    spacing: { before: 400, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: MED_BLUE, space: 4 } }
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 28, color: MED_BLUE, font: "Arial" })],
    spacing: { before: 320, after: 120 }
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 24, color: GRAY, font: "Arial" })],
    spacing: { before: 240, after: 100 }
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 22, font: "Arial", color: "333333", ...opts })],
    spacing: { before: 80, after: 80 },
    alignment: AlignmentType.JUSTIFIED
  });
}

function bold(text) {
  return new TextRun({ text, bold: true, size: 22, font: "Arial", color: "111111" });
}

function link(text, url) {
  return new ExternalHyperlink({
    link: url,
    children: [new TextRun({ text, style: "Hyperlink", size: 22, font: "Arial" })]
  });
}

function bullet(text, level = 0, opts = {}) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    children: [new TextRun({ text, size: 22, font: "Arial", color: "333333", ...opts })],
    spacing: { before: 60, after: 60 }
  });
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    children: [new TextRun({ text, size: 22, font: "Arial", color: "333333" })],
    spacing: { before: 60, after: 60 }
  });
}

function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ children: [new TextRun("")], spacing: { before: 60, after: 60 } }));
}

function infoBox(title, lines, fillColor = ACCENT, titleColor = MED_BLUE) {
  const rows = [
    new TableRow({
      children: [new TableCell({
        columnSpan: 1,
        borders,
        shading: { fill: fillColor, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 80, left: 160, right: 160 },
        children: [
          new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 22, color: titleColor, font: "Arial" })], spacing: { before: 0, after: 60 } }),
          ...lines.map(l => {
            if (typeof l === 'object' && l._docxType) return l;
            return new Paragraph({ children: [new TextRun({ text: l, size: 20, font: "Arial", color: "333333" })], spacing: { before: 40, after: 40 } });
          })
        ]
      })]
    })
  ];
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [9360], rows });
}

function twoColTable(headers, rows, widths = [3120, 3120, 3120]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      borders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: MED_BLUE, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "FFFFFF", font: "Arial" })], alignment: AlignmentType.CENTER })]
    }))
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      borders,
      width: { size: widths[ci], type: WidthType.DXA },
      shading: { fill: ri % 2 === 0 ? "FFFFFF" : LIGHT_GRAY, type: ShadingType.CLEAR },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, font: "Arial", color: "333333" })], alignment: AlignmentType.LEFT })]
    }))
  }));
  return new Table({ width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths, rows: [headerRow, ...dataRows] });
}

function sectionDivider(label, color = MED_BLUE) {
  return new Paragraph({
    children: [new TextRun({ text: `  ${label}  `, bold: true, size: 20, color: "FFFFFF", font: "Arial", highlight: undefined })],
    shading: { fill: color, type: ShadingType.CLEAR },
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color, space: 4 } }
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: BLUE },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: MED_BLUE },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: GRAY },
        paragraph: { spacing: { before: 240, after: 100 }, outlineLevel: 2 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.DECIMAL, text: "%1.%2.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ]},
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [new TextRun({ text: "HyperLocal Demand Intelligence System — Project Document", size: 18, color: "888888", font: "Arial" })],
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } },
          alignment: AlignmentType.RIGHT
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: "Page ", size: 18, color: "888888", font: "Arial" }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: "Arial" }),
            new TextRun({ text: " | Confidential — For Internal Project Use", size: 18, color: "AAAAAA", font: "Arial" })
          ],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: "CCCCCC", space: 4 } }
        })]
      })
    },
    children: [

      // ─────────────────────────────────────────
      // TITLE PAGE
      // ─────────────────────────────────────────
      ...spacer(4),
      new Paragraph({
        children: [new TextRun({ text: "HyperLocal Demand Intelligence System", bold: true, size: 52, color: BLUE, font: "Arial" })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "For Quick-Commerce / Dark Store Operations", size: 30, color: MED_BLUE, font: "Arial" })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Complete Project Document — End-to-End Build Guide", size: 24, color: GRAY, font: "Arial", italics: true })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 600 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Inspired by real-world systems at Blinkit · Zepto · BigBasket Now · Swiggy Instamart", size: 20, color: GRAY, font: "Arial" })],
        alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }
      }),
      new Paragraph({
        children: [new TextRun({ text: "Version 1.0  |  2025", size: 20, color: "AAAAAA", font: "Arial" })],
        alignment: AlignmentType.CENTER
      }),
      pageBreak(),

      // ─────────────────────────────────────────
      // TABLE OF CONTENTS (manual)
      // ─────────────────────────────────────────
      h1("Table of Contents"),
      ...spacer(1),
      ...[
        ["1.", "Project Overview & Problem Statement", "3"],
        ["2.", "Datasets — What to Use & Where to Get It", "4"],
        ["3.", "Tech Stack & Software Requirements", "5"],
        ["4.", "Project Architecture", "7"],
        ["5.", "Phase 1 — Data Ingestion & EDA", "8"],
        ["6.", "Phase 2 — Feature Engineering", "10"],
        ["7.", "Phase 3 — Customer Micro-Segmentation (Clustering)", "11"],
        ["8.", "Phase 4 — Basket Intelligence (Association Rules)", "13"],
        ["9.", "Phase 5 — Demand Forecasting", "15"],
        ["10.", "Phase 6 — Intelligence Fusion Layer", "17"],
        ["11.", "Phase 7 — Backend API Design", "18"],
        ["12.", "Phase 8 — UI / Dashboard Design", "20"],
        ["13.", "Evaluation & Metrics", "22"],
        ["14.", "Project Timeline", "23"],
        ["15.", "Folder Structure", "24"],
        ["16.", "Résumé Talking Points", "25"],
      ].map(([num, title, page]) =>
        new Paragraph({
          children: [
            new TextRun({ text: `${num}  ${title}`, size: 22, font: "Arial", color: "222222" }),
            new TextRun({ text: `\t${page}`, size: 22, font: "Arial", color: GRAY })
          ],
          tabStops: [{ type: TabStopType.RIGHT, position: 9000, leader: TabStopType.DOT }],
          spacing: { before: 60, after: 60 }
        })
      ),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 1 — PROJECT OVERVIEW
      // ─────────────────────────────────────────
      h1("1. Project Overview & Problem Statement"),
      p("Quick-commerce platforms (Blinkit, Zepto, Swiggy Instamart, BigBasket Now) promise grocery delivery in 10–20 minutes. Their competitive moat is not logistics — it is intelligence: knowing exactly what to stock, at which dark store, for which customer cohort, at which hour of the day, taking into account weather, festivals, and local demographics. This project replicates that intelligence layer from scratch."),
      ...spacer(1),
      h2("1.1 The Business Problem"),
      p("A dark store manager today relies on gut instinct and static weekly re-order sheets. This causes:"),
      bullet("Stockouts on high-demand items during peak windows (IPL nights, rain, festivals)"),
      bullet("Dead stock on low-velocity items that consume cold-chain capacity"),
      bullet("Missed bundle opportunities — items frequently bought together are never promoted"),
      bullet("One-size-fits-all stocking irrespective of pin-code demographics"),
      ...spacer(1),
      h2("1.2 What This System Does"),
      infoBox("System Capabilities", [
        "Segments customers into behavioural micro-personas using clustering on RFM + temporal + geo features",
        "Mines segment-conditional, event-aware association rules (not generic basket rules)",
        "Forecasts per-SKU demand 24 hours ahead per pin-code using gradient boosting with weather & event features",
        "Fuses all three signals into a ranked replenishment action list per dark store",
        "Exposes everything via a FastAPI backend + Streamlit/React dashboard",
      ], ACCENT, MED_BLUE),
      ...spacer(1),
      h2("1.3 What Makes This Different from Generic Projects"),
      p("Most market basket analysis projects run Apriori on the full Instacart dataset and report lift values. This project goes further in three ways:"),
      numbered("Rules are computed per customer segment and per time slot, not globally."),
      numbered("Forecasting features include weather, festival calendars, and IPL schedules — sources no Kaggle notebook uses."),
      numbered("The output is a ranked business action (stock this, bundle that) not just a model accuracy number."),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 2 — DATASETS
      // ─────────────────────────────────────────
      h1("2. Datasets — What to Use & Where to Get It"),
      p("All datasets listed below are publicly available for free. Together they simulate a realistic quick-commerce environment."),
      ...spacer(1),
      h2("2.1 Primary Transaction Dataset"),
      infoBox("Instacart Market Basket Analysis (Kaggle)", [
        "URL: https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis",
        "Size: ~3.4 million orders, 49,685 products, 206,209 users",
        "Files: orders.csv, order_products__prior.csv, products.csv, aisles.csv, departments.csv",
        "Licence: Instacart open data licence — free for non-commercial use",
        "What you will use it for: basket construction, RFM computation, association rule mining, demand time series",
      ], LIGHT_GREEN, GREEN),
      ...spacer(1),
      h2("2.2 Weather Data"),
      infoBox("OpenWeatherMap Historical API", [
        "URL: https://openweathermap.org/history",
        "Free tier: 1,000 calls/day. Historical bulk: https://openweathermap.org/history-bulk",
        "Alternatively (fully free, no signup): Open-Meteo Historical API — https://open-meteo.com/en/docs/historical-weather-api",
        "Fields to fetch: temperature_2m, precipitation, weathercode, windspeed_10m",
        "How to use: Join to orders.csv on date. Create bins: dry/drizzle/heavy_rain, cold/mild/hot",
      ], LIGHT_BLUE, MED_BLUE),
      ...spacer(1),
      h2("2.3 Indian Festival & Event Calendar"),
      infoBox("Public Holiday & IPL Schedule", [
        "Indian public holidays CSV: https://data.gov.in/resource/list-government-holidays — or scrape Wikipedia's table",
        "IPL schedule CSV 2024: https://www.kaggle.com/datasets/vora1011/ipl-2024-schedule",
        "Festival dates (Diwali, Holi, Eid, Navratri, Dussehra): Hardcode from India.gov.in calendar",
        "How to use: Create binary flags is_festival, is_ipl_day, days_to_festival in feature engineering",
      ], LIGHT_ORANGE, ORANGE),
      ...spacer(1),
      h2("2.4 Synthetic Pin-Code Demographics"),
      infoBox("How to Create It", [
        "Real source: Census India 2011 pin-code data — https://censusindia.gov.in/nada/index.php/catalog",
        "Easier alternative: Generate synthetic data using numpy. Assign each user_id a random pin-code.",
        "Fields to create: pin_code, avg_household_income_bucket (low/mid/high), dominant_age_group (18-25 / 26-40 / 40+), store_id (which dark store serves this pin)",
        "This is intentionally synthetic — it is a valid data science practice to augment public data",
      ], LIGHT_PURPLE, PURPLE),
      ...spacer(1),
      h2("2.5 Product Metadata Enrichment"),
      infoBox("Open Food Facts", [
        "URL: https://world.openfoodfacts.org/data",
        "Download: https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz",
        "Use it to add: product_category, is_perishable, is_vegetarian flags to product table",
        "Join on product_name using fuzzy matching (fuzzywuzzy / rapidfuzz)",
      ], LIGHT_GRAY, GRAY),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 3 — TECH STACK
      // ─────────────────────────────────────────
      h1("3. Tech Stack & Software Requirements"),
      h2("3.1 Languages & Runtimes"),
      twoColTable(
        ["Component", "Tool / Version", "Purpose"],
        [
          ["Language", "Python 3.11+", "All data science and backend code"],
          ["Environment manager", "conda or venv", "Dependency isolation"],
          ["Version control", "Git + GitHub", "Code management"],
          ["Notebook IDE", "Jupyter Lab 4.x", "Exploration and EDA"],
          ["Code IDE", "VS Code or PyCharm", "Production code development"],
        ],
        [2800, 3000, 3560]
      ),
      ...spacer(1),
      h2("3.2 Core Python Libraries"),
      twoColTable(
        ["Library", "Version", "Why You Need It"],
        [
          ["pandas", "2.x", "Data manipulation and merging"],
          ["numpy", "1.26+", "Numerical operations"],
          ["scikit-learn", "1.4+", "K-Means, DBSCAN, preprocessing, metrics"],
          ["mlxtend", "0.23+", "Apriori, FP-Growth, association_rules()"],
          ["lightgbm", "4.x", "Gradient-boosted demand forecasting"],
          ["prophet", "1.1.5", "Time-series decomposition for seasonal SKUs"],
          ["matplotlib + seaborn", "Latest", "EDA plots"],
          ["plotly", "5.x", "Interactive dashboard charts"],
          ["scipy", "1.12+", "Silhouette scores, statistical tests"],
          ["imbalanced-learn", "0.12+", "Handle class imbalance in segment labels"],
          ["shap", "0.45+", "Model explainability for forecasting"],
          ["rapidfuzz", "3.x", "Fuzzy join of product names to Open Food Facts"],
          ["requests", "2.x", "Weather API calls"],
          ["sqlalchemy", "2.x", "Database ORM for backend"],
        ],
        [2400, 2000, 4960]
      ),
      ...spacer(1),
      h2("3.3 Backend & API"),
      twoColTable(
        ["Component", "Tool", "Notes"],
        [
          ["REST API framework", "FastAPI 0.111+", "Async endpoints, auto OpenAPI docs"],
          ["ASGI server", "Uvicorn", "Run FastAPI in production"],
          ["Database", "PostgreSQL 16 (dev: SQLite)", "Store processed features, forecasts"],
          ["ORM", "SQLAlchemy 2.x", "Database abstraction"],
          ["Caching", "Redis 7.x", "Cache association rules and forecasts"],
          ["Task queue", "Celery + Redis broker", "Re-run forecasting pipelines on schedule"],
          ["Containerisation", "Docker + Docker Compose", "Reproducible environment"],
        ],
        [2600, 2600, 4160]
      ),
      ...spacer(1),
      h2("3.4 Dashboard / Frontend"),
      twoColTable(
        ["Component", "Tool", "Notes"],
        [
          ["Dashboard (quick)", "Streamlit 1.35+", "Fastest path to working demo"],
          ["Dashboard (polished)", "React 18 + Vite", "For a production-grade UI"],
          ["Charts", "Plotly / Recharts", "Interactive charts in both options"],
          ["Maps", "Folium (Streamlit) / Leaflet.js (React)", "Pin-code choropleth maps"],
          ["State management (React)", "Zustand", "Lightweight store"],
          ["Styling (React)", "Tailwind CSS 3.x", "Utility-first styling"],
        ],
        [2600, 2600, 4160]
      ),
      ...spacer(1),
      h2("3.5 Installation Commands"),
      infoBox("pip install (copy-paste into terminal)", [
        "pip install pandas numpy scikit-learn mlxtend lightgbm prophet matplotlib seaborn plotly scipy imbalanced-learn shap rapidfuzz requests sqlalchemy fastapi uvicorn redis celery streamlit folium jupyter",
        "",
        "Or create requirements.txt with pinned versions — starter file at: https://github.com/topics/mlxtend (search for project forks)"
      ], LIGHT_GRAY, GRAY),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 4 — ARCHITECTURE
      // ─────────────────────────────────────────
      h1("4. Project Architecture"),
      p("The system is built as five decoupled layers that communicate through a shared PostgreSQL database and a Redis cache. Each layer can be developed and tested independently."),
      ...spacer(1),
      twoColTable(
        ["Layer", "Responsibility", "Runs When"],
        [
          ["Layer 0: Ingestion", "Download, clean, join all raw datasets into a single fact table", "Once (setup) then weekly"],
          ["Layer 1: Feature Store", "Compute and persist all features (RFM, temporal, weather, event)", "Daily cron"],
          ["Layer 2: ML Pipelines", "Clustering, association rules, forecasting — reads feature store", "Daily cron"],
          ["Layer 3: Fusion Engine", "Combines model outputs into ranked action list per store", "Hourly cron"],
          ["Layer 4: API + Dashboard", "Serves data to the UI, exposes REST endpoints", "Always on"],
        ],
        [2200, 4560, 2600]
      ),
      ...spacer(1),
      infoBox("Data Flow Summary", [
        "Raw CSVs + Weather API + Calendar CSV",
        "  → pandas ETL (Layer 0) → PostgreSQL: dim_products, dim_users, fact_orders",
        "  → Feature engineering (Layer 1) → PostgreSQL: feat_rfm, feat_temporal, feat_weather",
        "  → ML pipelines (Layer 2) → PostgreSQL: seg_labels, assoc_rules, forecasts",
        "  → Fusion engine (Layer 3) → PostgreSQL: action_list (ranked replenishments + bundles)",
        "  → FastAPI (Layer 4) → Redis cache → Streamlit / React dashboard",
      ], ACCENT, MED_BLUE),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 5 — EDA
      // ─────────────────────────────────────────
      h1("5. Phase 1 — Data Ingestion & EDA"),
      h2("5.1 Loading the Instacart Data"),
      infoBox("Step-by-step data loading", [
        "1. Download from Kaggle: kaggle datasets download -d psparks/instacart-market-basket-analysis",
        "2. Unzip: unzip instacart-market-basket-analysis.zip -d data/raw/",
        "3. Load in notebook:",
        "   orders = pd.read_csv('data/raw/orders.csv')",
        "   order_products = pd.read_csv('data/raw/order_products__prior.csv')",
        "   products = pd.read_csv('data/raw/products.csv')",
        "4. Merge: df = orders.merge(order_products, on='order_id').merge(products, on='product_id')",
        "5. Save master: df.to_parquet('data/processed/master.parquet')",
      ], LIGHT_BLUE, MED_BLUE),
      ...spacer(1),
      h2("5.2 EDA Checklist — What to Analyse and Plot"),
      twoColTable(
        ["Analysis", "Code Hint / Library", "What to Look For"],
        [
          ["Order volume by day-of-week", "df.groupby('order_dow').size().plot()", "Peak days — Saturday/Sunday"],
          ["Order volume by hour-of-day", "df.groupby('order_hour_of_day').size()", "Late-night vs morning peaks"],
          ["Top 50 products by order frequency", "order_products.product_id.value_counts()", "Banana, whole milk always top"],
          ["Basket size distribution", "order_products.groupby('order_id').size().hist()", "Mean ~8, heavy right skew"],
          ["Days since prior order distribution", "orders.days_since_prior_order.hist()", "Strong 7-day and 30-day peaks"],
          ["Department-level sales heatmap", "seaborn.heatmap(pivot by dept x hour)", "Produce peaks in morning, snacks at night"],
          ["User reorder rate", "(reorder==1).mean() per user", "Power users vs one-time buyers"],
          ["Product correlation matrix (top 30)", "pandas crosstab + seaborn heatmap", "Seed your association rule intuition"],
        ],
        [2800, 3200, 3360]
      ),
      ...spacer(1),
      h2("5.3 Synthetic Pin-Code & Store Assignment"),
      p("Since Instacart is US data, you need to add Indian context. Do this in a notebook cell:"),
      infoBox("Python: Create synthetic pin-code data", [
        "import numpy as np, pandas as pd",
        "np.random.seed(42)",
        "users = orders['user_id'].unique()",
        "pin_codes = np.random.choice(['400001','400002','110001','110002','560001','560002'], len(users))",
        "income_buckets = np.random.choice(['low','mid','high'], len(users), p=[0.3, 0.5, 0.2])",
        "age_groups = np.random.choice(['18-25','26-40','40+'], len(users), p=[0.35, 0.45, 0.2])",
        "store_map = {'400001':'store_A','400002':'store_B', ...}  # Mumbai pin → store",
        "user_demo = pd.DataFrame({'user_id': users, 'pin_code': pin_codes, ...})",
        "user_demo.to_parquet('data/processed/user_demographics.parquet')",
      ], LIGHT_GRAY, GRAY),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 6 — FEATURE ENGINEERING
      // ─────────────────────────────────────────
      h1("6. Phase 2 — Feature Engineering"),
      h2("6.1 RFM Features"),
      p("RFM (Recency, Frequency, Monetary) is the foundation of customer segmentation. Compute at user level."),
      twoColTable(
        ["Feature", "Computation", "Type"],
        [
          ["Recency", "days since last order per user_id", "Numeric"],
          ["Frequency", "total orders in last 90 days", "Numeric"],
          ["Monetary proxy", "avg basket size × avg reorder rate", "Numeric"],
          ["Avg order hour", "mean(order_hour_of_day) per user", "Numeric"],
          ["Night-owl score", "fraction of orders placed 22:00–03:00", "Numeric (0–1)"],
          ["Weekend concentration", "fraction of orders on Sat/Sun", "Numeric (0–1)"],
          ["Reorder ratio", "reordered.mean() per user", "Numeric (0–1)"],
          ["Organic affinity", "fraction of cart from organic products", "Numeric (0–1)"],
        ],
        [2500, 4000, 2860]
      ),
      ...spacer(1),
      h2("6.2 Weather Features"),
      infoBox("Using Open-Meteo (free, no API key needed)", [
        "import requests",
        "url = 'https://archive-api.open-meteo.com/v1/archive'",
        "params = {'latitude': 19.076, 'longitude': 72.877,  # Mumbai",
        "          'start_date': '2022-01-01', 'end_date': '2023-01-01',",
        "          'daily': 'temperature_2m_max,precipitation_sum,weathercode'}",
        "r = requests.get(url, params=params).json()",
        "weather_df = pd.DataFrame(r['daily'])",
        "# Create bins",
        "weather_df['temp_bin'] = pd.cut(weather_df['temperature_2m_max'], bins=[0,20,30,50], labels=['cold','mild','hot'])",
        "weather_df['rain_bin'] = pd.cut(weather_df['precipitation_sum'], bins=[-1,1,10,999], labels=['dry','drizzle','heavy'])",
        "# Join to orders on order_date",
      ], LIGHT_BLUE, MED_BLUE),
      ...spacer(1),
      h2("6.3 Event Features"),
      twoColTable(
        ["Feature Name", "How to Create", "Expected Signal"],
        [
          ["is_festival", "Binary: 1 on Diwali, Holi, Eid, Navratri, Dussehra", "Snacks, sweets spike"],
          ["days_to_festival", "days until next festival (0 on the day, max 30)", "Lead-up buying wave"],
          ["is_ipl_match_day", "1 if any IPL match played that day", "Chips, cola, beverages spike"],
          ["is_exam_season", "1 during March–April, Oct–Nov in student pin-codes", "Maggi, coffee, energy drinks spike"],
          ["is_monsoon", "1 for June–September", "Umbrella effect: hot drinks, pakoda items"],
          ["is_weekend", "1 for Saturday/Sunday", "Organic, fresh produce spike"],
        ],
        [2400, 4000, 2960]
      ),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 7 — CLUSTERING
      // ─────────────────────────────────────────
      h1("7. Phase 3 — Customer Micro-Segmentation (Clustering)"),
      h2("7.1 Concept"),
      p("We cluster users into micro-personas so that association rules and forecasts can be computed per segment rather than globally. This is the key differentiator of this project."),
      ...spacer(1),
      h2("7.2 Step-by-Step Implementation"),
      numbered("Assemble the feature matrix: join feat_rfm, feat_temporal, user_demographics on user_id. Shape should be ~200,000 rows × 12 features."),
      numbered("Scale: use StandardScaler from scikit-learn. RFM values are on very different scales."),
      numbered("Find optimal K using the Elbow method (inertia) and Silhouette Score. Plot both. Typically K=6 or K=7 works well on this dataset."),
      numbered("Fit K-Means with best K. Store labels."),
      numbered("Run DBSCAN separately (eps=0.5, min_samples=5) to isolate outlier/power-buyer cluster."),
      numbered("Name each cluster by profiling: compute mean feature values per cluster and name it."),
      numbered("Append segment_label column back to user table. Persist to database."),
      ...spacer(1),
      infoBox("Expected Cluster Personas (approximate, will vary with your data)", [
        "Cluster 0 — Late-night bachelor: high night_owl_score, high ramen/noodles/beer affinity, low frequency",
        "Cluster 1 — Morning health buyer: high organic_affinity, orders 7–9am, high reorder_ratio",
        "Cluster 2 — Weekend family shopper: high weekend_concentration, large basket size, fresh produce heavy",
        "Cluster 3 — Impulse buyer: low recency, medium frequency, varied basket, high snack affinity",
        "Cluster 4 — Festival bulk buyer: spikes on is_festival days, large basket, sweets/dry fruits heavy",
        "Cluster 5 — Power user (DBSCAN): extreme frequency, high monetary, orders every 2–3 days",
        "Cluster 6 — Student/exam buyer: exam_season_orders high, Maggi/coffee/chips heavy, price-sensitive",
      ], LIGHT_PURPLE, PURPLE),
      ...spacer(1),
      h2("7.3 Key Code Snippets"),
      infoBox("Silhouette analysis", [
        "from sklearn.cluster import KMeans",
        "from sklearn.metrics import silhouette_score",
        "from sklearn.preprocessing import StandardScaler",
        "",
        "X = StandardScaler().fit_transform(feature_matrix)",
        "scores = []",
        "for k in range(3, 12):",
        "    km = KMeans(n_clusters=k, random_state=42, n_init=10)",
        "    labels = km.fit_predict(X)",
        "    scores.append({'k': k, 'inertia': km.inertia_, 'silhouette': silhouette_score(X, labels)})",
        "pd.DataFrame(scores).set_index('k').plot(subplots=True)  # pick elbow",
      ], LIGHT_GRAY, GRAY),
      ...spacer(1),
      h2("7.4 Validation & What to Report"),
      bullet("Report Silhouette Score for chosen K (target: > 0.30)"),
      bullet("Plot cluster distribution (bar chart) — check for imbalanced clusters"),
      bullet("Plot radar/spider chart of mean feature values per cluster — makes a great dashboard visual"),
      bullet("Sanity check: pull top-20 products per cluster and confirm they match persona name"),
      bullet("Bonus: reduce to 2D with t-SNE and plot coloured scatter — visually compelling for portfolio"),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 8 — ASSOCIATION RULES
      // ─────────────────────────────────────────
      h1("8. Phase 4 — Basket Intelligence (Association Rules)"),
      h2("8.1 Concept"),
      p("Association rule mining discovers co-purchase patterns. The standard approach (run Apriori on all orders) produces trivial rules like {milk} → {bread}. The approach in this project is fundamentally different: rules are computed per customer segment and per time-weather slot, producing rules like:"),
      infoBox("Example of a contextual rule (what you will produce)", [
        "Segment: Late-night bachelor   |   Slot: rainy night (22:00–03:00, heavy rain)",
        "Rule: {instant noodles, beer} → {chips}",
        "Support: 0.12   |   Confidence: 0.71   |   Lift: 4.2",
        "",
        "Interpretation: On rainy nights, late-night buyers who have instant noodles AND beer",
        "in their cart add chips 71% of the time. Lift of 4.2 means this is 4× more likely",
        "than random chance. Dark store action: pre-bundle these three items, trigger a push notification.",
      ], LIGHT_GREEN, GREEN),
      ...spacer(1),
      h2("8.2 Step-by-Step Implementation"),
      numbered("Attach segment_label and weather/event context to every order row."),
      numbered("Define 4 time slots: morning (6–12), afternoon (12–18), evening (18–22), night (22–6)."),
      numbered("For each combination of (segment × time_slot × weather_bin), extract the sub-dataset."),
      numbered("Convert to basket matrix: one-hot encode products per order using pd.get_dummies and groupby."),
      numbered("Run FP-Growth (faster than Apriori) from mlxtend with min_support=0.05."),
      numbered("Generate rules with min_confidence=0.5. Filter for lift > 1.5."),
      numbered("Store: rule_id, antecedent, consequent, support, confidence, lift, segment, time_slot, weather_bin."),
      numbered("Persist to database table: assoc_rules."),
      ...spacer(1),
      infoBox("Key mlxtend code", [
        "from mlxtend.frequent_patterns import fpgrowth, association_rules",
        "",
        "for seg in segments:",
        "    for slot in time_slots:",
        "        for weather in weather_bins:",
        "            sub = df[(df.segment==seg)&(df.time_slot==slot)&(df.rain_bin==weather)]",
        "            if len(sub) < 200: continue  # skip sparse cells",
        "            basket = sub.groupby(['order_id','product_name'])['reordered'].count().unstack(fill_value=0)",
        "            basket = basket.applymap(lambda x: 1 if x > 0 else 0)",
        "            freq = fpgrowth(basket, min_support=0.05, use_colnames=True)",
        "            rules = association_rules(freq, metric='lift', min_threshold=1.5)",
        "            rules['segment'], rules['time_slot'], rules['weather_bin'] = seg, slot, weather",
        "            all_rules.append(rules)",
        "",
        "final_rules = pd.concat(all_rules).sort_values('lift', ascending=False)",
      ], LIGHT_GRAY, GRAY),
      ...spacer(1),
      h2("8.3 What to Report"),
      twoColTable(
        ["Metric", "Target", "How to Compute"],
        [
          ["Number of rules generated", "500–5,000", "len(final_rules)"],
          ["Average lift across all rules", "> 2.0", "final_rules.lift.mean()"],
          ["Top-10 rules by lift per segment", "Table in dashboard", "final_rules.groupby('segment').apply(top10)"],
          ["Rule coverage (% baskets covered)", "> 60%", "Orders matching at least one antecedent"],
          ["Contextual lift gain", "Compare vs global rules", "Global lift vs segment-conditioned lift"],
        ],
        [2600, 2200, 4560]
      ),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 9 — FORECASTING
      // ─────────────────────────────────────────
      h1("9. Phase 5 — Demand Forecasting"),
      h2("9.1 Concept"),
      p("Forecasting predicts how many units of each SKU will be ordered in the next 24 hours at each dark store (proxied by pin-code group). This drives the replenishment quantity in the final action list."),
      ...spacer(1),
      h2("9.2 Creating the Demand Time Series"),
      infoBox("Aggregation logic", [
        "# daily demand per SKU per store",
        "demand = (df.groupby(['order_date', 'store_id', 'product_name'])",
        "           .agg(units_sold=('product_id','count'))",
        "           .reset_index())",
        "",
        "# Add lagged features",
        "demand['lag_1d'] = demand.groupby(['store_id','product_name'])['units_sold'].shift(1)",
        "demand['lag_7d'] = demand.groupby(['store_id','product_name'])['units_sold'].shift(7)",
        "demand['rolling_7d_mean'] = demand.groupby(['store_id','product_name'])['units_sold'].transform(",
        "    lambda x: x.shift(1).rolling(7).mean())",
        "",
        "# Join weather, event features on order_date",
        "demand = demand.merge(weather_df, on='order_date').merge(events_df, on='order_date')",
      ], LIGHT_BLUE, MED_BLUE),
      ...spacer(1),
      h2("9.3 Model Choice"),
      twoColTable(
        ["Model", "When to Use", "Library"],
        [
          ["LightGBM Regressor", "High-volume SKUs (>50 sales/day average). Fast and accurate.", "lightgbm.LGBMRegressor"],
          ["Facebook Prophet", "Seasonal SKUs (festival spikes, weekly patterns). Interpretable.", "prophet.Prophet"],
          ["Naive baseline", "Always compute as benchmark: last_week_same_day", "pandas shift()"],
        ],
        [2200, 4000, 3160]
      ),
      ...spacer(1),
      h2("9.4 Feature Set for LightGBM"),
      twoColTable(
        ["Feature Group", "Features", "Importance Rank"],
        [
          ["Lag features", "lag_1d, lag_7d, lag_14d, lag_30d", "Very High"],
          ["Rolling stats", "rolling_7d_mean, rolling_7d_std, rolling_30d_mean", "Very High"],
          ["Calendar", "day_of_week, is_weekend, month, week_of_year", "High"],
          ["Event flags", "is_festival, days_to_festival, is_ipl_day, is_exam_season", "High"],
          ["Weather", "temp_bin_encoded, rain_bin_encoded, precipitation_sum", "Medium-High"],
          ["Product metadata", "department_encoded, is_perishable, is_organic", "Medium"],
          ["Store context", "store_id_encoded, pin_income_bucket_encoded", "Medium"],
        ],
        [2200, 4400, 2760]
      ),
      ...spacer(1),
      h2("9.5 Training and Evaluation"),
      infoBox("Validation strategy — IMPORTANT", [
        "DO NOT use random train/test split for time-series data. Use TimeSeriesSplit.",
        "",
        "from sklearn.model_selection import TimeSeriesSplit",
        "tscv = TimeSeriesSplit(n_splits=5)",
        "for train_idx, test_idx in tscv.split(X):",
        "    X_train, X_test = X[train_idx], X[test_idx]",
        "    model.fit(X_train, y_train)",
        "    pred = model.predict(X_test)",
        "    mape = np.mean(np.abs((y_test - pred) / (y_test + 1e-5))) * 100",
        "",
        "Target MAPE: < 20% for top-50 SKUs by volume",
      ], LIGHT_RED, RED_DARK),
      ...spacer(1),
      h2("9.6 SHAP for Explainability"),
      p("SHAP (SHapley Additive exPlanations) lets you show which features drove a particular forecast. This is a critical addition for a data science project — it shows you understand model interpretability, not just model fitting."),
      infoBox("SHAP code", [
        "import shap",
        "explainer = shap.TreeExplainer(lgbm_model)",
        "shap_values = explainer(X_test)",
        "shap.summary_plot(shap_values, X_test, plot_type='bar')  # feature importance",
        "shap.waterfall_plot(shap_values[0])  # single prediction explanation",
        "# Screenshot these for your portfolio",
      ], LIGHT_GRAY, GRAY),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 10 — FUSION ENGINE
      // ─────────────────────────────────────────
      h1("10. Phase 6 — Intelligence Fusion Layer"),
      h2("10.1 What It Does"),
      p("The fusion engine combines three signals — segment composition of a store's customers, forecasted demand, and top association rules for the relevant segment/context — into a single ranked action list per store. This is the most impactful layer and should be the centrepiece of your demo."),
      ...spacer(1),
      h2("10.2 Fusion Logic"),
      twoColTable(
        ["Signal", "Contribution", "Weight"],
        [
          ["Forecast (LightGBM)", "Base replenishment quantity for each SKU", "Primary driver"],
          ["Stockout risk score", "Items forecasted to sell > current stock level", "Priority multiplier"],
          ["Association rule lift", "Items that should be bundled with high-demand items", "Bundle suggestion"],
          ["Segment affinity", "Boost forecast if dominant segment has high affinity for item", "Secondary adjustment"],
          ["Event flag", "Multiply forecast by event uplift factor for flagged days", "Spike adjustment"],
        ],
        [2400, 4000, 2960]
      ),
      ...spacer(1),
      infoBox("Fusion output schema — action_list table", [
        "store_id | sku_id | sku_name | forecast_units | current_stock | reorder_qty | urgency (1–5)",
        "| bundle_with (list of SKU IDs) | bundle_lift | segment_trigger | event_context | generated_at",
        "",
        "Example row:",
        "store_A | P0042 | Instant Noodles 5-pack | 340 | 80 | 260 | 5 (CRITICAL)",
        "| [P0155 (Chai Masala), P0088 (Chilli Sauce)] | 3.2 | late_night_bachelor | rainy_night | 2025-06-01 02:00",
      ], ACCENT, MED_BLUE),
      ...spacer(1),
      h2("10.3 Urgency Scoring"),
      bullet("Level 5 (Critical): forecast_units > current_stock AND is_festival in next 3 days"),
      bullet("Level 4 (High): forecast_units > 0.8 × current_stock"),
      bullet("Level 3 (Medium): forecast_units > 0.6 × current_stock"),
      bullet("Level 2 (Normal): routine replenishment"),
      bullet("Level 1 (Watch): low-velocity item with downward trend"),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 11 — BACKEND API
      // ─────────────────────────────────────────
      h1("11. Phase 7 — Backend API Design"),
      h2("11.1 Technology"),
      p("Use FastAPI. It generates automatic interactive docs at /docs (Swagger UI) which makes your project look very professional to reviewers. Redis caches the action list so each API call does not re-run queries."),
      ...spacer(1),
      h2("11.2 API Endpoints"),
      twoColTable(
        ["Endpoint", "Method", "Returns"],
        [
          ["GET /stores", "GET", "List of all dark stores with metadata"],
          ["GET /stores/{store_id}/actions", "GET", "Ranked action list for a store (cached 1hr)"],
          ["GET /stores/{store_id}/forecast", "GET", "24hr SKU demand forecast for a store"],
          ["GET /stores/{store_id}/bundles", "GET", "Top bundle suggestions for current context"],
          ["GET /segments", "GET", "Cluster personas with feature profile"],
          ["GET /segments/{segment_id}/rules", "GET", "Top association rules for a segment"],
          ["GET /sku/{product_id}/explain", "GET", "SHAP waterfall for latest SKU forecast"],
          ["POST /pipeline/trigger", "POST", "Manually trigger ML pipeline re-run"],
          ["GET /health", "GET", "Health check (used by Docker Compose)"],
        ],
        [3200, 1400, 4760]
      ),
      ...spacer(1),
      h2("11.3 Example FastAPI Code Structure"),
      infoBox("main.py skeleton", [
        "from fastapi import FastAPI, Depends",
        "from sqlalchemy.orm import Session",
        "import redis, json",
        "",
        "app = FastAPI(title='HyperLocal Demand Intelligence API', version='1.0')",
        "cache = redis.Redis(host='localhost', port=6379, db=0)",
        "",
        "@app.get('/stores/{store_id}/actions')",
        "async def get_actions(store_id: str, db: Session = Depends(get_db)):",
        "    cache_key = f'actions:{store_id}'",
        "    cached = cache.get(cache_key)",
        "    if cached: return json.loads(cached)",
        "    actions = db.query(ActionList).filter_by(store_id=store_id)",
        "              .order_by(ActionList.urgency.desc()).limit(50).all()",
        "    result = [a.to_dict() for a in actions]",
        "    cache.setex(cache_key, 3600, json.dumps(result))  # cache 1 hour",
        "    return result",
      ], LIGHT_GRAY, GRAY),
      ...spacer(1),
      h2("11.4 Database Schema (Key Tables)"),
      twoColTable(
        ["Table", "Primary Key", "Key Columns"],
        [
          ["dim_products", "product_id", "name, department, is_perishable, is_organic"],
          ["dim_users", "user_id", "pin_code, income_bucket, age_group, store_id, segment_label"],
          ["fact_orders", "order_id", "user_id, order_date, order_hour, weather_bin, event_flags"],
          ["fact_order_items", "(order_id, product_id)", "quantity, reordered, price_proxy"],
          ["feat_rfm", "user_id", "recency, frequency, monetary, night_owl, weekend_conc, reorder_ratio"],
          ["seg_labels", "user_id", "cluster_id, cluster_name, silhouette_score, assigned_at"],
          ["assoc_rules", "rule_id", "antecedent, consequent, support, confidence, lift, segment, slot, weather"],
          ["forecasts", "(store_id, product_id, forecast_date)", "forecast_units, model_type, mape"],
          ["action_list", "(store_id, product_id, generated_at)", "forecast_units, reorder_qty, urgency, bundle_with"],
        ],
        [2400, 2400, 4560]
      ),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 12 — UI DESIGN
      // ─────────────────────────────────────────
      h1("12. Phase 8 — UI / Dashboard Design"),
      h2("12.1 Dashboard Pages Overview"),
      twoColTable(
        ["Page / Screen", "Key Components", "Data Source"],
        [
          ["Store Overview", "KPI cards: total SKUs, stockout risk count, top urgency alerts", "action_list"],
          ["Replenishment Board", "Filterable table sorted by urgency, colour-coded urgency badges", "action_list"],
          ["Bundle Suggestions", "Card grid: each card shows antecedent → consequent, lift, segment context", "assoc_rules"],
          ["Demand Forecast", "Line chart: actual vs forecast per SKU, SKU picker dropdown", "forecasts"],
          ["Customer Segments", "Radar chart per cluster, scatter plot (t-SNE), segment size bar chart", "seg_labels + feat_rfm"],
          ["Pin-Code Map", "Choropleth map: demand intensity per pin-code, store location markers", "action_list + user_demo"],
          ["Model Explainability", "SHAP waterfall chart for selected SKU forecast", "SHAP values via API"],
        ],
        [2200, 4400, 2760]
      ),
      ...spacer(1),
      h2("12.2 Streamlit Implementation (Fastest Path)"),
      infoBox("Streamlit app.py structure", [
        "import streamlit as st, requests, plotly.express as px, pandas as pd",
        "",
        "st.set_page_config(layout='wide', page_title='Dark Store Intelligence')",
        "store_id = st.sidebar.selectbox('Select Dark Store', ['store_A','store_B','store_C'])",
        "page = st.sidebar.radio('View', ['Replenishment', 'Bundles', 'Forecast', 'Segments', 'Map'])",
        "",
        "if page == 'Replenishment':",
        "    data = requests.get(f'http://localhost:8000/stores/{store_id}/actions').json()",
        "    df = pd.DataFrame(data)",
        "    # Colour urgency column",
        "    st.dataframe(df.style.apply(color_urgency, axis=1))",
        "",
        "elif page == 'Forecast':",
        "    sku = st.selectbox('Select SKU', sku_list)",
        "    data = requests.get(f'http://localhost:8000/stores/{store_id}/forecast?sku={sku}').json()",
        "    fig = px.line(data, x='date', y=['actual','forecast'], title=f'Demand Forecast: {sku}')",
        "    st.plotly_chart(fig, use_container_width=True)",
      ], LIGHT_GRAY, GRAY),
      ...spacer(1),
      h2("12.3 React Frontend (Polished Portfolio Version)"),
      p("If you want a production-grade UI, build a React 18 app. Use these component decisions:"),
      twoColTable(
        ["Component Need", "Recommended Library", "Installation"],
        [
          ["Charts (line, bar, scatter)", "Recharts", "npm install recharts"],
          ["Data table with filters/sort", "TanStack Table v8", "npm install @tanstack/react-table"],
          ["Pin-code map", "React-Leaflet", "npm install react-leaflet leaflet"],
          ["KPI cards, layouts", "Tailwind CSS", "npx tailwindcss init"],
          ["Radar chart (cluster profiles)", "Chart.js + react-chartjs-2", "npm install chart.js react-chartjs-2"],
          ["Icons", "Lucide React", "npm install lucide-react"],
          ["API calls + caching", "TanStack Query", "npm install @tanstack/react-query"],
          ["Notifications (urgency alerts)", "Sonner", "npm install sonner"],
        ],
        [2800, 2800, 3760]
      ),
      ...spacer(1),
      h2("12.4 Colour System for Dashboard"),
      twoColTable(
        ["Urgency Level", "Hex Colour", "When to Show"],
        [
          ["Critical (5)", "#DC2626 (red)", "Forecast > stock, festival in <3 days"],
          ["High (4)", "#EA580C (orange)", "Forecast > 80% of stock"],
          ["Medium (3)", "#CA8A04 (amber)", "Forecast > 60% of stock"],
          ["Normal (2)", "#16A34A (green)", "Routine order"],
          ["Watch (1)", "#6B7280 (gray)", "Monitor, no action required"],
        ],
        [2000, 2400, 4960]
      ),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 13 — EVALUATION
      // ─────────────────────────────────────────
      h1("13. Evaluation & Metrics"),
      h2("13.1 Per-Module Metrics"),
      twoColTable(
        ["Module", "Metric", "Target / Benchmark"],
        [
          ["Clustering", "Silhouette Score", "> 0.30 (good), > 0.45 (very good)"],
          ["Clustering", "Davies-Bouldin Index", "< 1.5 (lower is better)"],
          ["Clustering", "Business validation", "Top products per cluster match persona name"],
          ["Association Rules", "Average Lift", "> 2.0 across all rules"],
          ["Association Rules", "Contextual vs global lift gain", "Segment-conditioned rules should have 30-50% higher lift"],
          ["Forecasting", "MAPE on top-50 SKUs", "< 20%"],
          ["Forecasting", "MAE vs naive baseline", "LightGBM should beat naive by >25%"],
          ["Forecasting", "Hit rate at 80% CI", "> 80% of actuals fall within predicted range"],
          ["Fusion", "Action list fill rate", "% of critical stockouts caught >6hr in advance"],
        ],
        [2200, 3200, 3960]
      ),
      ...spacer(1),
      h2("13.2 Business Simulation"),
      p("To make evaluation compelling, simulate a 30-day backtest:"),
      numbered("Take last 30 days of data as holdout (never seen by model during training)."),
      numbered("Run fusion engine on day-1 data to generate action list."),
      numbered("Compare recommended reorder quantity vs actual demand on day-2."),
      numbered("Count: avoided stockouts, over-stock incidents, bundle conversion proxies."),
      numbered("Express as estimated GMV impact: avoided_stockouts × avg_order_value_per_SKU."),
      p("Even a simulated GMV impact number (e.g. 'our system would have prevented 340 stockout events worth an estimated ₹2.1L in lost sales') is an extremely powerful portfolio talking point."),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 14 — TIMELINE
      // ─────────────────────────────────────────
      h1("14. Project Timeline"),
      twoColTable(
        ["Week", "What to Complete", "Deliverable"],
        [
          ["Week 1", "Data download, EDA, synthetic demographics, initial data pipeline", "master.parquet, eda_notebook.ipynb"],
          ["Week 2", "Feature engineering — RFM, weather join, event flags", "feat_rfm.parquet, feature_store.parquet"],
          ["Week 3", "Clustering — K-Means + DBSCAN, persona naming, t-SNE plot", "seg_labels.parquet, clustering_notebook.ipynb"],
          ["Week 4", "Association rule mining per segment × slot × weather", "assoc_rules.parquet, rules_notebook.ipynb"],
          ["Week 5", "Demand forecasting — LightGBM + Prophet, SHAP, backtest", "forecasts.parquet, forecast_notebook.ipynb"],
          ["Week 6", "Fusion engine, action list generation, backtest evaluation", "action_list.parquet, fusion_notebook.ipynb"],
          ["Week 7", "FastAPI backend, database setup, Redis caching", "Working API at localhost:8000/docs"],
          ["Week 8", "Streamlit dashboard, all 6 pages, final polish", "Working dashboard at localhost:8501"],
          ["Week 9", "Docker Compose, README, GitHub repo, portfolio write-up", "GitHub repo + project blog post"],
        ],
        [1200, 5200, 2960]
      ),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 15 — FOLDER STRUCTURE
      // ─────────────────────────────────────────
      h1("15. Folder Structure"),
      infoBox("Complete repository layout", [
        "hyperlocal-demand-intelligence/",
        "├── data/",
        "│   ├── raw/                    # original downloaded files (gitignored)",
        "│   ├── processed/              # cleaned parquet files",
        "│   └── external/               # weather CSV, events CSV",
        "├── notebooks/",
        "│   ├── 01_eda.ipynb",
        "│   ├── 02_feature_engineering.ipynb",
        "│   ├── 03_clustering.ipynb",
        "│   ├── 04_association_rules.ipynb",
        "│   ├── 05_forecasting.ipynb",
        "│   └── 06_fusion_engine.ipynb",
        "├── src/",
        "│   ├── data/          ingest.py, clean.py, weather_api.py",
        "│   ├── features/      rfm.py, temporal.py, events.py",
        "│   ├── models/        clustering.py, association.py, forecasting.py",
        "│   ├── fusion/        engine.py, scoring.py",
        "│   └── utils/         db.py, cache.py, config.py",
        "├── api/",
        "│   ├── main.py        FastAPI app",
        "│   ├── routers/       stores.py, segments.py, rules.py, forecast.py",
        "│   ├── models/        schemas.py (Pydantic), orm.py (SQLAlchemy)",
        "│   └── tests/         test_endpoints.py",
        "├── dashboard/",
        "│   ├── app.py         Streamlit entry point",
        "│   └── pages/         replenishment.py, bundles.py, forecast.py, segments.py, map.py",
        "├── docker-compose.yml",
        "├── Dockerfile",
        "├── requirements.txt",
        "├── .env.example",
        "└── README.md",
      ], LIGHT_GRAY, GRAY),
      pageBreak(),

      // ─────────────────────────────────────────
      // SECTION 16 — RESUME POINTS
      // ─────────────────────────────────────────
      h1("16. Résumé Talking Points"),
      p("When you complete this project, use these bullet points on your CV and LinkedIn. They are framed in the language that data science recruiters respond to."),
      ...spacer(1),
      infoBox("Copy-paste ready résumé bullets", [
        "• Built an end-to-end demand intelligence system for quick-commerce dark stores, integrating clustering, association rule mining, and gradient-boosted forecasting into a unified replenishment engine.",
        "",
        "• Segmented 200K+ users into 7 behavioural micro-personas using K-Means + DBSCAN on RFM, temporal, and geo features; achieved Silhouette Score of 0.42.",
        "",
        "• Implemented segment-conditional, weather-aware association rule mining (FP-Growth) across 120+ context slices, producing rules with average lift of 3.1× vs 1.8× for global baseline.",
        "",
        "• Forecasted 24-hour per-SKU demand using LightGBM with lag, weather, festival, and IPL event features; achieved MAPE < 18% on top-50 SKUs; model outperformed naïve baseline by 31%.",
        "",
        "• Designed and deployed a FastAPI backend with Redis caching serving 9 REST endpoints, and a Streamlit dashboard with 6 interactive views including a choropleth demand map.",
        "",
        "• Backtested on 30-day holdout: system would have prevented an estimated 340 stockout events worth ~₹2.1L in avoided lost sales.",
        "",
        "• Containerised full stack (ML pipeline + API + dashboard + PostgreSQL + Redis) with Docker Compose for one-command local deployment.",
      ], LIGHT_GREEN, GREEN),
      ...spacer(1),
      h2("16.1 Interview Questions You Will Be Able to Answer"),
      bullet("Why did you choose FP-Growth over Apriori? (Answer: FP-Growth is O(n) on the tree pass, Apriori generates candidate pairs which explodes at large itemsets.)"),
      bullet("How did you handle class imbalance in clustering? (Answer: DBSCAN separates outliers naturally; K-Means was run with multiple random seeds and best silhouette was kept.)"),
      bullet("Why not use a random split for the forecasting model? (Answer: Time-series data has temporal dependency; a random split leaks future into training, inflating MAPE artificially.)"),
      bullet("How does the fusion engine decide replenishment quantity? (Answer: Forecast units minus current stock level, adjusted by event uplift factor and urgency classification.)"),
      bullet("What is SHAP and why did you use it? (Answer: SHapley Additive exPlanations assigns each feature a marginal contribution to each prediction, providing post-hoc interpretability for the LightGBM model.)"),
      ...spacer(2),
      infoBox("Final Note", [
        "This document is your single source of truth. Work through it section by section.",
        "Every notebook should be clean, well-commented, and reproducible top-to-bottom.",
        "Push to GitHub regularly. The commit history itself signals seriousness to recruiters.",
        "",
        "Good luck. Build it and own it.",
      ], ACCENT, MED_BLUE),

    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/Users/avinash/Projects/MLProject/HyperLocal_Demand_Intelligence_Project_Document.docx', buffer);
  console.log('Done!');
});