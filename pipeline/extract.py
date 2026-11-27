"""EXTRACT: download daily exchange rates from the Frankfurter API."""
from datetime import date, timedelta

import requests

from .config import API, BASE


def _year_chunks(start: date, end: date):
    """Split a long date range into one-year pieces so each API response stays small."""
    while start <= end:
        chunk_end = min(date(start.year, 12, 31), end)
        yield start, chunk_end
        start = chunk_end + timedelta(days=1)


def fetch_rates(start: date, end: date, base: str = BASE, get=requests.get):
    """Return a list of (rate_date, base, currency, rate) rows between start and end.

    The API only has rates for working days, so weekends and holidays are simply missing.
    `get` can be swapped out in tests so they never touch the internet.
    """
    rows = []
    for chunk_start, chunk_end in _year_chunks(start, end):
        url = f"{API}/{chunk_start.isoformat()}..{chunk_end.isoformat()}"
        resp = get(url, params={"base": base}, timeout=30)
        resp.raise_for_status()
        payload = resp.json()
        for day, rates in payload.get("rates", {}).items():
            d = date.fromisoformat(day)
            if not (chunk_start <= d <= chunk_end):  # the API can return the working day before the range
                continue
            for currency, rate in rates.items():
                rows.append((d, base, currency, rate))
    return rows
