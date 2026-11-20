-- Create source from Redpanda
CREATE SOURCE txns_raw
FROM KAFKA BROKER 'redpanda:9092' TOPIC 'txns.raw'
FORMAT BYTES
ENVELOPE NONE
WITH (kafka.group.id = 'risingwave-consumer');

-- Parse JSON payload
CREATE VIEW txns_parsed AS
SELECT
  (payload::jsonb->>'txn_id')::text AS txn_id,
  (payload::jsonb->>'user_id')::text AS user_id,
  (payload::jsonb->>'amount')::numeric AS amount,
  (payload::jsonb->>'currency')::text AS currency,
  (payload::jsonb->>'merchant_id')::text AS merchant_id,
  (payload::jsonb->>'mcc')::text AS mcc,
  (payload::jsonb->>'ts')::timestamptz AS ts,
  (payload::jsonb->>'lat')::float AS lat,
  (payload::jsonb->>'lon')::float AS lon,
  (payload::jsonb->>'device_fp')::text AS device_fp,
  (payload::jsonb->>'ip')::text AS ip,
  (payload::jsonb->>'is_fraud')::boolean AS is_fraud
FROM txns_raw;

-- ==========================================
-- FEATURE VIEWS (Materialized for serving)
-- ==========================================

-- Velocity features (1m, 5m, 1h, 24h windows)
CREATE MATERIALIZED VIEW features_velocity AS
SELECT
  user_id,
  window_start,
  COUNT(*) AS txn_count_1m,
  SUM(amount) AS amount_sum_1m,
  AVG(amount) AS amount_avg_1m,
  STDDEV(amount) AS amount_std_1m
FROM TUMBLE(txns_parsed, ts, INTERVAL '1 MINUTE')
GROUP BY user_id, window_start;

-- Amount Z-score (per user, 1h window)
CREATE MATERIALIZED VIEW features_amount_zscore AS
SELECT
  user_id,
  window_start,
  (amount - AVG(amount) OVER w) / NULLIF(STDDEV(amount) OVER w, 0) AS amount_zscore
FROM txns_parsed
WINDOW w AS (PARTITION BY user_id ORDER BY ts RANGE BETWEEN INTERVAL '1 HOUR' PRECEDING AND CURRENT ROW);

-- Geo impossibility (speed > 1000 km/h)
CREATE MATERIALIZED VIEW features_geo_impossibility AS
SELECT
  t1.user_id,
  t1.txn_id,
  ST_Distance(
    ST_MakePoint(t1.lon, t1.lat)::geography,
    ST_MakePoint(t2.lon, t2.lat)::geography
  ) / EXTRACT(EPOCH FROM (t1.ts - t2.ts)) * 3.6 AS speed_kmh
FROM txns_parsed t1
JOIN LATERAL (
  SELECT lat, lon, ts
  FROM txns_parsed t2
  WHERE t2.user_id = t1.user_id AND t2.ts < t1.ts
  ORDER BY t2.ts DESC
  LIMIT 1
) t2 ON true
WHERE EXTRACT(EPOCH FROM (t1.ts - t2.ts)) > 0;

-- Device trust
CREATE MATERIALIZED VIEW features_device_trust AS
SELECT
  txn_id,
  user_id,
  CASE WHEN device_fp IN (
    SELECT device_fp FROM known_devices WHERE user_id = txns_parsed.user_id
  ) THEN 1 ELSE 0 END AS device_trusted
FROM txns_parsed;

-- Wide feature vector for model serving
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
  t.is_fraud AS label
FROM txns_parsed t
LEFT JOIN features_velocity v ON t.user_id = v.user_id
LEFT JOIN features_amount_zscore z ON t.txn_id = z.txn_id
LEFT JOIN features_geo_impossibility g ON t.txn_id = g.txn_id
LEFT JOIN features_device_trust d ON t.txn_id = d.txn_id;

-- Known devices table (for device trust feature)
CREATE TABLE known_devices (
  user_id TEXT,
  device_fp TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, device_fp)
);