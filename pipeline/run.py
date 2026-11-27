"""Run the whole pipeline: extract -> load -> transform (SQL) -> check -> export.

Usage:  python -m pipeline.run
"""
import sys
from datetime import date, datetime, timedelta, timezone

import duckdb

from . import config
from .checks import run_checks
from .extract import fetch_rates

TRANSFORMS = ["02_daily_rates.sql", "03_currency_daily_stats.sql", "04_currency_summary.sql"]
MARTS = ["daily_rates", "currency_daily_stats", "currency_summary"]


def run_sql_file(con, name):
    con.execute((config.SQL_DIR / name).read_text())


def next_start_date(con, first_day: date) -> date:
    """Incremental load: start the day after the newest date already stored."""
    latest = con.execute("SELECT MAX(rate_date) FROM raw_rates").fetchone()[0]
    return first_day if latest is None else latest + timedelta(days=1)


def load(con, rows):
    """LOAD: append new rows to raw_rates, stamped with the load time."""
    if not rows:
        return 0
    loaded_at = datetime.now(timezone.utc).replace(tzinfo=None)
    con.executemany(
        "INSERT INTO raw_rates VALUES (?, ?, ?, ?, ?)",
        [(*row, loaded_at) for row in rows],
    )
    return len(rows)


def run(con, today: date | None = None, fetch=fetch_rates, export_dir=None):
    today = today or date.today()
    run_sql_file(con, "01_schema.sql")

    start = next_start_date(con, date.fromisoformat(config.START_DATE))
    rows = fetch(start, today) if start <= today else []
    added = load(con, rows)

    for name in TRANSFORMS:
        run_sql_file(con, name)

    failures = run_checks(con, today=today)

    if export_dir is not None:
        export_dir.mkdir(parents=True, exist_ok=True)
        for table in MARTS:
            con.execute(f"COPY {table} TO '{export_dir / (table + '.csv')}' (HEADER)")

    return {"start": start, "rows_added": added, "failures": failures}


def main():
    config.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(config.DB_PATH))
    result = run(con, export_dir=config.MARTS_DIR)
    con.close()

    print(f"Loaded {result['rows_added']} new rows starting {result['start']}")
    if result["failures"]:
        print("Data-quality checks FAILED:")
        for f in result["failures"]:
            print(" -", f)
        sys.exit(1)
    print("All data-quality checks passed.")


if __name__ == "__main__":
    main()
