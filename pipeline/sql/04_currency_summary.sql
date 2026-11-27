-- Summary layer: one row per currency, ready for a dashboard.
-- Volatility = how much the rate moves day to day over the last 90 days of data.
CREATE OR REPLACE TABLE currency_summary AS
WITH latest AS (
    SELECT base, currency, MAX(rate_date) AS latest_date
    FROM currency_daily_stats
    GROUP BY base, currency
),
recent AS (
    SELECT s.*
    FROM currency_daily_stats s
    JOIN latest l USING (base, currency)
    WHERE s.rate_date > l.latest_date - INTERVAL 90 DAY
)
SELECT
    l.base,
    l.currency,
    l.latest_date,
    s.rate                               AS latest_rate,
    ROUND(s.avg_30d, 6)                  AS avg_30d,
    ROUND(STDDEV_SAMP(r.pct_change), 4)  AS volatility_90d_pct,
    ROUND(MAX(ABS(r.pct_change)), 4)     AS biggest_daily_move_90d_pct,
    COUNT(*)                             AS days_in_last_90d
FROM latest l
JOIN currency_daily_stats s
  ON s.base = l.base AND s.currency = l.currency AND s.rate_date = l.latest_date
JOIN recent r
  ON r.base = l.base AND r.currency = l.currency
GROUP BY l.base, l.currency, l.latest_date, s.rate, s.avg_30d
ORDER BY volatility_90d_pct DESC;
