-- Raw layer: rates exactly as they arrived from the API.
-- Nothing is ever deleted here, so we can always rebuild the clean tables.
CREATE TABLE IF NOT EXISTS raw_rates (
    rate_date  DATE      NOT NULL,
    base       VARCHAR   NOT NULL,
    currency   VARCHAR   NOT NULL,
    rate       DOUBLE,
    loaded_at  TIMESTAMP NOT NULL
);
