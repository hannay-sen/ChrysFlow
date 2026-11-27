"""Tests run on a temporary in-memory database with fake API data, so no internet is needed."""
from datetime import date

import duckdb
import pytest

from pipeline import run as pipeline
from pipeline.checks import run_checks
from pipeline.extract import fetch_rates


def fake_fetch(days):
    """Pretend API: returns EUR and JPY rates for the given dates."""
    def _fetch(start, end):
        return [
            (d, "USD", cur, rate)
            for d, eur, jpy in days
            if start <= d <= end
            for cur, rate in (("EUR", eur), ("JPY", jpy))
        ]
    return _fetch


DAYS = [
    (date(2024, 1, 2), 0.90, 140.0),
    (date(2024, 1, 3), 0.99, 141.4),
    (date(2024, 1, 4), 0.891, 139.986),
]


@pytest.fixture
def con():
    c = duckdb.connect(":memory:")
    yield c
    c.close()


def test_full_run_builds_tables_and_passes_checks(con):
    result = pipeline.run(con, today=date(2024, 1, 5), fetch=fake_fetch(DAYS))
    assert result["rows_added"] == 6
    assert result["failures"] == []
    assert con.execute("SELECT COUNT(*) FROM daily_rates").fetchone()[0] == 6
    assert con.execute("SELECT COUNT(*) FROM currency_summary").fetchone()[0] == 2


def test_pct_change_is_correct(con):
    pipeline.run(con, today=date(2024, 1, 5), fetch=fake_fetch(DAYS))
    pct = con.execute("""
        SELECT pct_change FROM currency_daily_stats
        WHERE currency = 'EUR' ORDER BY rate_date
    """).fetchall()
    assert pct[0][0] is None                 # first day has nothing to compare to
    assert pct[1][0] == pytest.approx(10.0)  # 0.90 -> 0.99 is +10%
    assert pct[2][0] == pytest.approx(-10.0) # 0.99 -> 0.891 is -10%


def test_second_run_only_loads_new_days(con):
    pipeline.run(con, today=date(2024, 1, 3), fetch=fake_fetch(DAYS))
    result = pipeline.run(con, today=date(2024, 1, 5), fetch=fake_fetch(DAYS))
    assert result["start"] == date(2024, 1, 4)
    assert result["rows_added"] == 2
    assert con.execute("SELECT COUNT(*) FROM raw_rates").fetchone()[0] == 6


def test_cleaning_removes_duplicates_and_bad_rates(con):
    pipeline.run(con, today=date(2024, 1, 5), fetch=fake_fetch(DAYS))
    con.execute("INSERT INTO raw_rates VALUES ('2024-01-04', 'USD', 'EUR', 0.95, TIMESTAMP '2100-01-01')")  # a newer reload of the same day
    con.execute("INSERT INTO raw_rates VALUES ('2024-01-04', 'USD', 'GBP', -1, TIMESTAMP '2100-01-01')")    # impossible rate
    pipeline.run(con, today=date(2024, 1, 5), fetch=fake_fetch([]))
    rows = con.execute("""
        SELECT currency, rate FROM daily_rates WHERE rate_date = '2024-01-04' ORDER BY currency
    """).fetchall()
    assert rows == [("EUR", 0.95), ("JPY", 139.986)]  # newest EUR kept, GBP dropped


def test_checks_catch_stale_data(con):
    pipeline.run(con, today=date(2024, 1, 5), fetch=fake_fetch(DAYS))
    failures = run_checks(con, today=date(2024, 3, 1))
    assert any("stale" in f for f in failures)


def test_extract_parses_api_response_and_splits_years():
    calls = []

    class FakeResponse:
        def __init__(self, url):
            self.url = url
        def raise_for_status(self):
            pass
        def json(self):
            if "2023-12-29" in self.url:
                return {"rates": {"2023-12-29": {"EUR": 0.9}}}
            return {"rates": {"2023-12-29": {"EUR": 0.9}, "2024-01-02": {"EUR": 0.91}}}

    def fake_get(url, params, timeout):
        calls.append(url)
        return FakeResponse(url)

    rows = fetch_rates(date(2023, 12, 29), date(2024, 1, 2), get=fake_get)
    assert len(calls) == 2  # one request per calendar year
    assert rows == [(date(2023, 12, 29), "USD", "EUR", 0.9), (date(2024, 1, 2), "USD", "EUR", 0.91)]
