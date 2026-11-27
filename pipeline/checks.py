"""Data-quality checks. Each query counts bad rows; every count must be 0."""
from datetime import date

CHECKS = {
    "no duplicate (day, currency) rows in daily_rates": """
        SELECT COUNT(*) FROM (
            SELECT rate_date, base, currency
            FROM daily_rates
            GROUP BY rate_date, base, currency
            HAVING COUNT(*) > 1
        )""",
    "no missing or non-positive rates in daily_rates": """
        SELECT COUNT(*) FROM daily_rates WHERE rate IS NULL OR rate <= 0""",
    "no dates in the future": """
        SELECT COUNT(*) FROM daily_rates WHERE rate_date > CURRENT_DATE""",
    "every daily_rates row has stats": """
        SELECT (SELECT COUNT(*) FROM daily_rates) - (SELECT COUNT(*) FROM currency_daily_stats)""",
}


def run_checks(con, today: date | None = None, max_age_days: int = 7):
    """Run every check and return a list of failure messages (empty list = all passed)."""
    failures = []
    for name, sql in CHECKS.items():
        bad = con.execute(sql).fetchone()[0]
        if bad:
            failures.append(f"{name}: {bad} bad rows")

    # Freshness: rates are published on working days, so allow a few days for weekends/holidays.
    today = today or date.today()
    latest = con.execute("SELECT MAX(rate_date) FROM daily_rates").fetchone()[0]
    if latest is None:
        failures.append("daily_rates is empty")
    elif (today - latest).days > max_age_days:
        failures.append(f"data is stale: newest rate is from {latest}")
    return failures
