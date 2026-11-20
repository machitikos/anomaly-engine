from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import onnxruntime as ort
import numpy as np
import os
import logging
from prometheus_client import Counter, Histogram, generate_latest
from fastapi.responses import Response

app = FastAPI(title="Anomaly Scorer", version="1.0.0")

# Metrics
SCORE_REQUESTS = Counter('scorer_requests_total', 'Total score requests')
SCORE_LATENCY = Histogram('scorer_latency_seconds', 'Score latency')

# Load ONNX model
MODEL_PATH = os.getenv("MODEL_PATH", "/app/model.onnx")
session = ort.InferenceSession(MODEL_PATH) if os.path.exists(MODEL_PATH) else None

class TransactionFeatures(BaseModel):
    txn_id: str
    user_id: str
    amount: float
    txn_count_1m: int = 0
    amount_sum_1m: float = 0.0
    amount_avg_1m: float = 0.0
    amount_std_1m: float = 1.0
    amount_zscore: float = 0.0
    speed_kmh: float = 0.0
    device_trusted: int = 1

class ScoreResponse(BaseModel):
    txn_id: str
    score: float
    risk_level: str
    reason_codes: list[str]
    model_version: str

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": session is not None}

@app.post("/score", response_model=ScoreResponse)
async def score_transaction(features: TransactionFeatures):
    SCORE_REQUESTS.inc()
    with SCORE_LATENCY.time():
        if session is None:
            # Fallback: rule-based scoring for hackathon demo
            score = calculate_rule_score(features)
            reasons = get_rule_reasons(features)
        else:
            # ONNX inference
            input_data = np.array([[
                features.amount,
                features.txn_count_1m,
                features.amount_zscore,
                features.speed_kmh,
                features.device_trusted
            ]], dtype=np.float32)
            score = float(session.run(None, {"input": input_data})[0][0])
            reasons = get_shap_reasons(features, score)

    risk_level = "HIGH" if score > 0.7 else "MEDIUM" if score > 0.3 else "LOW"

    return ScoreResponse(
        txn_id=features.txn_id,
        score=score,
        risk_level=risk_level,
        reason_codes=reasons,
        model_version="1.0.0-hackathon"
    )

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")

def calculate_rule_score(f: TransactionFeatures) -> float:
    """Fallback rule-based scoring for demo without trained model"""
    score = 0.0
    # High amount z-score
    if abs(f.amount_zscore) > 3:
        score += 0.3
    # Impossible travel speed
    if f.speed_kmh > 1000:
        score += 0.4
    # Untrusted device
    if f.device_trusted == 0:
        score += 0.2
    # High velocity
    if f.txn_count_1m > 20:
        score += 0.1
    return min(score, 1.0)

def get_rule_reasons(f: TransactionFeatures) -> list[str]:
    reasons = []
    if abs(f.amount_zscore) > 3:
        reasons.append("unusual_amount")
    if f.speed_kmh > 1000:
        reasons.append("impossible_travel")
    if f.device_trusted == 0:
        reasons.append("new_device")
    if f.txn_count_1m > 20:
        reasons.append("high_velocity")
    return reasons or ["normal"]

def get_shap_reasons(f: TransactionFeatures, score: float) -> list[str]:
    """Placeholder for SHAP explanations"""
    return get_rule_reasons(f)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)