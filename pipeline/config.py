"""Settings for the exchange-rate pipeline."""
from pathlib import Path

API = "https://api.frankfurter.dev/v1"   # free, no key needed (rates from the European Central Bank)
BASE = "USD"                             # every rate is "1 USD = X currency"
START_DATE = "2024-01-01"                # first day loaded on the very first run

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "fx.duckdb"    # the warehouse file
MARTS_DIR = ROOT / "data" / "marts"      # CSV copies of the final tables
SQL_DIR = Path(__file__).resolve().parent / "sql"
