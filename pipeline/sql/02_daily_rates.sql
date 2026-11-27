-- Clean layer: one trusted rate per day per currency.
-- 1. Drop rows with a missing or impossible (zero/negative) rate.
-- 2. If the same day was loaded twice, keep only the newest load.
CREATE OR REPLACE TABLE daily_rates AS
SELECT rate_date, base, currency, rate
FROM (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY rate_date, base, currency
            ORDER BY loaded_at DESC
        ) AS row_num
    FROM raw_rates
    WHERE rate IS NOT NULL
      AND rate > 0
)
WHERE row_num = 1;
