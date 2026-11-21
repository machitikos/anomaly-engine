-- ==========================================
-- RISINGWAVE INITIALIZATION (v1.10 compatible)
-- Real-Time Transaction Anomaly Engine
-- ==========================================

-- Drop existing views/tables if they exist (clean slate)
DROP MATERIALIZED VIEW IF EXISTS feature_vector;
DROP MATERIALIZED VIEW IF EXISTS features_cross_merchant;
DROP MATERIALIZED VIEW IF EXISTS features_behavioral;
DROP MATERIALIZED VIEW IF EXISTS features_temporal;
DROP MATERIALIZED VIEW IF EXISTS features_merchant_risk;
DROP MATERIALIZED VIEW IF EXISTS features_device_trust;
DROP MATERIALIZED VIEW IF EXISTS features_geo_impossibility;
DROP MATERIALIZED VIEW IF EXISTS features_amount_zscore;
DROP MATERIALIZED VIEW IF EXISTS features_velocity;
DROP VIEW IF EXISTS txns_parsed;
DROP SOURCE IF EXISTS txns_raw;
DROP TABLE IF EXISTS model_versions;
DROP TABLE IF EXISTS outcomes;
DROP TABLE IF EXISTS decisions;
DROP TABLE IF EXISTS known_devices;
DROP TABLE IF EXISTS merchant_risk;
DROP TABLE IF EXISTS merchant_mcc_risk;

-- ==========================================
-- KAFKA SOURCE (PLAIN format with inline schema)
-- ==========================================
CREATE SOURCE txns_raw (
    txn_id TEXT,
    user_id TEXT,
    amount NUMERIC,
    currency TEXT,
    merchant_id TEXT,
    mcc TEXT,
    ts TIMESTAMPTZ,
    lat FLOAT,
    lon FLOAT,
    device_fp TEXT,
    ip TEXT,
    is_fraud BOOLEAN
)
WITH (
    connector = 'kafka',
    topic = 'txns.raw',
    properties.bootstrap.server = 'kafka:9092',
    scan.startup.mode = 'earliest'
)
FORMAT PLAIN ENCODE JSON;

-- Parse JSON payload (inline schema already parsed it)
CREATE VIEW txns_parsed AS
SELECT
  txn_id,
  user_id,
  amount,
  currency,
  merchant_id,
  mcc,
  ts,
  lat,
  lon,
  device_fp,
  ip,
  is_fraud
FROM txns_raw;

-- ==========================================
-- REFERENCE TABLES (must be created before views that reference them)
-- ==========================================
CREATE TABLE known_devices (
  user_id TEXT,
  device_fp TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, device_fp)
);

CREATE TABLE merchant_mcc_risk (
  mcc TEXT PRIMARY KEY,
  category TEXT,
  risk_score FLOAT
);

INSERT INTO merchant_mcc_risk (mcc, category, risk_score) VALUES
('5411', 'Grocery Stores', 0.1),
('5812', 'Restaurants', 0.2),
('5814', 'Fast Food', 0.25),
('5732', 'Electronics', 0.6),
('5094', 'Jewelry', 0.8),
('6011', 'ATM/Cash', 0.9),
('4816', 'Computer Network', 0.4),
('5999', 'Misc Retail', 0.5),
('5734', 'Computer Software', 0.5),
('4814', 'Telecom', 0.3),
('5968', 'Direct Marketing', 0.7),
('5499', 'Misc Food', 0.3);

CREATE TABLE merchant_risk (
  merchant_id TEXT PRIMARY KEY,
  mcc TEXT,
  risk_score FLOAT DEFAULT 0.5,
  txn_count BIGINT DEFAULT 0,
  fraud_count BIGINT DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- FEATURE VIEWS (Materialized for serving)
-- ==========================================

-- Velocity features (1m tumbling window)
CREATE MATERIALIZED VIEW features_velocity AS
SELECT
  user_id,
  window_start,
  COUNT(*) AS txn_count_1m,
  SUM(amount) AS amount_sum_1m,
  AVG(amount) AS amount_avg_1m,
  stddev_samp(amount::float) AS amount_std_1m
FROM TUMBLE(txns_parsed, ts, INTERVAL '1 MINUTE')
GROUP BY user_id, window_start;

-- Amount Z-score (per user, 1h rolling window using velocity windows)
-- 60 preceding 1-min windows = ~1 hour
CREATE MATERIALIZED VIEW features_amount_zscore AS
SELECT
  v.user_id,
  v.window_start,
  (v.amount_avg_1m - AVG(v.amount_avg_1m) OVER (PARTITION BY v.user_id ORDER BY v.window_start ROWS BETWEEN 60 PRECEDING AND CURRENT ROW))
  / NULLIF(stddev_samp(v.amount_avg_1m) OVER (PARTITION BY v.user_id ORDER BY v.window_start ROWS BETWEEN 60 PRECEDING AND CURRENT ROW), 0)
  AS amount_zscore
FROM features_velocity v;

-- Geo impossibility (simplified Euclidean distance * 111.32 km/degree)
CREATE MATERIALIZED VIEW features_geo_impossibility AS
SELECT
  t1.user_id,
  t1.txn_id,
  SQRT(
    POWER(t1.lat - t2.lat, 2) + POWER(t1.lon - t2.lon, 2)
  ) * 111.32 / EXTRACT(EPOCH FROM (t1.ts - t2.ts)) * 3.6 AS speed_kmh
FROM txns_parsed t1
JOIN LATERAL (
  SELECT lat, lon, ts
  FROM txns_parsed t2
  WHERE t2.user_id = t1.user_id AND t2.ts < t1.ts
  ORDER BY t2.ts DESC
  LIMIT 1
) t2 ON true
WHERE EXTRACT(EPOCH FROM (t1.ts - t2.ts)) > 0;

-- Device trust (using JOIN with known_devices table)
CREATE MATERIALIZED VIEW features_device_trust AS
SELECT
  t.txn_id,
  t.user_id,
  CASE WHEN kd.device_fp IS NOT NULL THEN 1 ELSE 0 END AS device_trusted
FROM txns_parsed t
LEFT JOIN known_devices kd ON kd.user_id = t.user_id AND kd.device_fp = t.device_fp;

-- Merchant risk feature view
CREATE MATERIALIZED VIEW features_merchant_risk AS
SELECT
  t.txn_id,
  t.user_id,
  t.ts,
  COALESCE(m.risk_score, mm.risk_score, 0.5) AS merchant_risk_score
FROM txns_parsed t
LEFT JOIN merchant_risk m ON t.merchant_id = m.merchant_id
LEFT JOIN merchant_mcc_risk mm ON t.mcc = mm.mcc;

-- Temporal features
CREATE MATERIALIZED VIEW features_temporal AS
SELECT
  txn_id,
  user_id,
  ts,
  EXTRACT(HOUR FROM ts)::INT AS hour_of_day,
  CASE WHEN EXTRACT(HOUR FROM ts) BETWEEN 22 AND 5 THEN 1 ELSE 0 END AS is_night,
  CASE WHEN EXTRACT(DOW FROM ts) IN (0,6) THEN 1 ELSE 0 END AS is_weekend,
  CASE WHEN EXTRACT(HOUR FROM ts) BETWEEN 9 AND 17 THEN 1 ELSE 0 END AS is_business_hours
FROM txns_parsed;

-- Behavioral velocity (per MCC category in last hour)
CREATE MATERIALIZED VIEW features_behavioral AS
SELECT
  t.txn_id,
  t.user_id,
  t.ts,
  (SELECT COUNT(*) FROM txns_parsed t2
   WHERE t2.user_id = t.user_id AND t2.ts < t.ts
   AND t2.ts >= t.ts - INTERVAL '1 HOUR' AND t2.mcc = t.mcc) AS txn_count_merchant_cat_1h,
  (SELECT AVG(t2.amount) FROM txns_parsed t2
   WHERE t2.user_id = t.user_id AND t2.ts < t.ts
   AND t2.ts >= t.ts - INTERVAL '1 HOUR') AS amount_avg_user_1h,
  CASE
    WHEN (SELECT AVG(t2.amount) FROM txns_parsed t2
          WHERE t2.user_id = t.user_id AND t2.ts < t.ts
          AND t2.ts >= t.ts - INTERVAL '1 HOUR') > 0
    THEN t.amount / (SELECT AVG(t2.amount) FROM txns_parsed t2
                     WHERE t2.user_id = t.user_id AND t2.ts < t.ts
                     AND t2.ts >= t.ts - INTERVAL '1 HOUR')
    ELSE 1.0
  END AS amount_pctile_user
FROM txns_parsed t;

-- Cross-merchant velocity (unique merchants in last hour)
CREATE MATERIALIZED VIEW features_cross_merchant AS
SELECT
  t1.txn_id,
  t1.user_id,
  t1.ts,
  (SELECT COUNT(DISTINCT t2.merchant_id) FROM txns_parsed t2
   WHERE t2.user_id = t1.user_id AND t2.ts < t1.ts
   AND t2.ts >= t1.ts - INTERVAL '1 HOUR') AS unique_merchants_1h
FROM txns_parsed t1;

-- ==========================================
-- WIDE FEATURE VECTOR FOR MODEL SERVING
-- ==========================================
CREATE MATERIALIZED VIEW feature_vector AS
SELECT
  t.txn_id,
  t.user_id,
  t.ts,
  t.amount,
  v.txn_count_1m,
  v.amount_sum_1m,
  v.amount_avg_1m,
  v.amount_std_1m,
  z.amount_zscore,
  g.speed_kmh,
  d.device_trusted,
  mr.merchant_risk_score,
  tmp.hour_of_day,
  tmp.is_night,
  tmp.is_weekend,
  tmp.is_business_hours,
  b.txn_count_merchant_cat_1h,
  b.amount_pctile_user,
  cm.unique_merchants_1h,
  t.is_fraud AS label
FROM txns_parsed t
LEFT JOIN features_velocity v ON t.user_id = v.user_id AND t.ts >= v.window_start AND t.ts < v.window_start + INTERVAL '1 MINUTE'
LEFT JOIN features_amount_zscore z ON t.user_id = z.user_id AND t.ts >= z.window_start AND t.ts < z.window_start + INTERVAL '1 MINUTE'
LEFT JOIN features_geo_impossibility g ON t.txn_id = g.txn_id
LEFT JOIN features_device_trust d ON t.txn_id = d.txn_id
LEFT JOIN features_merchant_risk mr ON t.txn_id = mr.txn_id
LEFT JOIN features_temporal tmp ON t.txn_id = tmp.txn_id
LEFT JOIN features_behavioral b ON t.txn_id = b.txn_id
LEFT JOIN features_cross_merchant cm ON t.txn_id = cm.txn_id;

-- ==========================================
-- DECISIONS & OUTCOMES TABLES
-- ==========================================
CREATE TABLE decisions (
  decision_id TEXT PRIMARY KEY,
  txn_id TEXT,
  user_id TEXT,
  action TEXT,
  matched_rule TEXT,
  score FLOAT,
  reason_codes TEXT[],
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE outcomes (
  outcome_id TEXT PRIMARY KEY,
  decision_id TEXT,
  txn_id TEXT,
  outcome TEXT,
  analyst_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE model_versions (
  version TEXT PRIMARY KEY,
  model_path TEXT,
  trained_at TIMESTAMPTZ,
  metrics TEXT,
  is_champion BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);