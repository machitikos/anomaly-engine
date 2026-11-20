# anomaly-engine
Real-time fraud detection engine scoring transactions in &lt;50ms. RisingWave SQL features + LightGBM/ONNX + FastAPI + React dashboard. Hackathon MVP.
# Real-Time Transaction Anomaly Engine

A real-time fraud detection engine that scores transactions in under 50ms. Built for a hackathon, architected like a production system.

## What it does
- Ingests transactions via Kafka (Redpanda), computes streaming features in RisingWave SQL — velocity, geo-impossibility, device trust, merchant risk
- Scores with LightGBM exported to ONNX, served through FastAPI with SHAP reason codes
- Combines ML scores with hard rules (sanctions, velocity caps) for final decisions
- Feeds outcomes back into nightly retraining with drift detection (PSI) and canary deployment

## Stack
Python, SQL (RisingWave), TypeScript/React, Docker, Kafka, ONNX Runtime

## Run it
```bash
docker-compose up -d
# Dashboard at localhost:3000
# API at localhost:8000/score
# Grafana at localhost:3001
```

## Status
Hackathon MVP — core pipeline works, dashboard is live, model loaded. The code you see was written during the event; the docker-compose and model file were prepped the night before (per hackathon rules).
