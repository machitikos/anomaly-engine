# Real-Time Transaction Anomaly Engine

Hackathon MVP — scores transactions in <50ms.

## Stack
- Python (FastAPI, ONNX Runtime)
- SQL (RisingWave streaming features)
- TypeScript/React (Dashboard)
- Kafka (Redpanda), Prometheus, Grafana

## Run
\\\bash
docker-compose up -d
# Dashboard: http://localhost:5173
# API: http://localhost:8000/docs
# Grafana: http://localhost:3000 (admin/admin123)
\\\

## Pre-hackathon scaffold
Tagged as \pre-hackathon-scaffold\ — all infra code prepared before event.
