# Chrysflow

**Chrysos** (Greek for "gold") + **flow**: a currency tracker with a daily data pipeline behind it.

**Live site:** https://hannay-sen.github.io/chrysflow/

Two parts in one repo:

1. **Web app** (React + Recharts): convert between currencies and see how a rate changed over time.
2. **Data pipeline** (Python + SQL + DuckDB): collects daily exchange rates for 30 currencies, cleans them, and builds analysis tables automatically every weekday. It currently holds 22,000+ daily rates going back to January 2024.

Data source: [Frankfurter API](https://frankfurter.dev), which publishes the European Central Bank's reference rates. Rates exist only for working days.

---

## The data pipeline

```
Frankfurter API ──► extract.py ──► raw_rates ──► daily_rates ──► currency_daily_stats ──► currency_summary
   (JSON)          (Python)       (raw layer)   (clean layer)      (analytics layer)        (summary layer)
                                                       │
                                                       └──► data-quality checks (pipeline fails if any check fails)
```

| Step | File | What it does |
| --- | --- | --- |
| Extract | `pipeline/extract.py` | Downloads USD-based rates from the API, one calendar year per request. |
| Load | `pipeline/run.py` | Appends new rows to `raw_rates` with a load timestamp. **Incremental**: each run starts the day after the newest date already stored, so old data is never downloaded twice. |
| Clean | `pipeline/sql/02_daily_rates.sql` | Drops missing or impossible rates and keeps only the newest load of each day and currency. |
| Analyze | `pipeline/sql/03_currency_daily_stats.sql` | Daily % change, 7-day and 30-day moving averages (SQL window functions). |
| Summarize | `pipeline/sql/04_currency_summary.sql` | One row per currency: latest rate, 30-day average, 90-day volatility, biggest daily move. |
| Check | `pipeline/checks.py` | Fails the run if there are duplicates, bad rates, future dates, missing stats, or stale data. |
| Automate | `.github/workflows/pipeline.yml` | GitHub Actions runs the tests and the pipeline every weekday and commits the new data. |

### Tables

| Table | One row per | Columns |
| --- | --- | --- |
| `raw_rates` | rate as received | `rate_date`, `base`, `currency`, `rate`, `loaded_at` |
| `daily_rates` | day + currency | `rate_date`, `base`, `currency`, `rate` |
| `currency_daily_stats` | day + currency | `daily_rates` columns + `prev_rate`, `pct_change`, `avg_7d`, `avg_30d` |
| `currency_summary` | currency | `latest_date`, `latest_rate`, `avg_30d`, `volatility_90d_pct`, `biggest_daily_move_90d_pct`, `days_in_last_90d` |

The warehouse is `data/fx.duckdb`. CSV copies of the clean and analysis tables are in `data/marts/`.

### Run it yourself

```bash
pip install -r requirements.txt
pytest                      # tests use fake data, no internet needed
python -m pipeline.run      # first run loads everything since 2024-01-01
```

Query the warehouse with SQL:

```bash
python -c "import duckdb; print(duckdb.connect('data/fx.duckdb').sql('SELECT * FROM currency_summary LIMIT 10'))"
```

---

## The web app

```bash
npm install
npm run dev
```

Built with React, Vite and Recharts. Deployed to GitHub Pages by `.github/workflows/deploy-site.yml` whenever the app code changes.
