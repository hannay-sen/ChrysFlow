-- Analytics layer: daily change and moving averages for every currency.
-- Window functions look at the rows before each day for the same currency.
CREATE OR REPLACE TABLE currency_daily_stats AS
SELECT
    rate_date,
    base,
    currency,
    rate,
    LAG(rate) OVER w AS prev_rate,
    ROUND(100 * (rate - LAG(rate) OVER w) / LAG(rate) OVER w, 4) AS pct_change,
    AVG(rate) OVER (w ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)  AS avg_7d,
    AVG(rate) OVER (w ROWS BETWEEN 29 PRECEDING AND CURRENT ROW) AS avg_30d
FROM daily_rates
WINDOW w AS (PARTITION BY base, currency ORDER BY rate_date);
