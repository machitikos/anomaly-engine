from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
import onnxruntime as ort
import numpy as np
import os
import json
import asyncio
import logging
from typing import List, Dict, Any, Optional
from prometheus_client import Counter, Histogram, generate_latest
from fastapi.responses import Response
from contextlib import asynccontextmanager

# ==========================================
# CONFIG & LOGGING
# ==========================================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

MODEL_PATH = os.getenv("MODEL_PATH", "/app/model.onnx")
KAFKA_BROKERS = os.getenv("KAFKA_BROKERS", "kafka:29092")
RISINGWAVE_DSN = os.getenv("RISINGWAVE_DSN", "postgresql://root@risingwave:4566/dev")
POSTGRES_DSN = os.getenv("POSTGRES_DSN", "postgresql://anomaly:anomaly123@postgres:5432/anomaly_engine")

# ==========================================
# METRICS
# ==========================================
SCORE_REQUESTS = Counter('scorer_requests_total', 'Total score requests')
SCORE_LATENCY = Histogram('scorer_latency_seconds', 'Score latency')
WS_CONNECTIONS = Counter('scorer_ws_connections_total', 'Total WebSocket connections')
DECISIONS_TOTAL = Counter('scorer_decisions_total', 'Total decisions', ['action'])

# ==========================================
# LOAD ONNX MODEL
# ==========================================
session = None
shap_explainer = None
model_version = "1.0.0-rule-fallback"

def load_model():
    global session, shap_explainer, model_version
    # Check file exists AND has content (not empty/corrupt)
    if os.path.exists(MODEL_PATH) and os.path.getsize(MODEL_PATH) > 100:
        try:
            session = ort.InferenceSession(MODEL_PATH)
            model_version = "1.0.0-onnx"
            logger.info(f"✅ Loaded ONNX model from {MODEL_PATH}")
            logger.info(f"Model inputs: {[i.name for i in session.get_inputs()]}")
            logger.info(f"Model outputs: {[o.name for o in session.get_outputs()]}")
        except Exception as e:
            logger.error(f"Failed to load ONNX model: {e}")
            session = None
    else:
        logger.warning(f"⚠️ Model not found/empty at {MODEL_PATH}, using rule-based fallback")
        session = None

# ==========================================
# PYDANTIC MODELS
# ==========================================
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
    # Extended features (from RisingWave feature_vector)
    merchant_risk_score: float = 0.5
    hour_of_day: int = 12
    is_night: int = 0
    is_weekend: int = 0
    is_business_hours: int = 1
    txn_count_merchant_cat_1h: int = 0
    amount_pctile_user: float = 1.0
    unique_merchants_1h: int = 1
    avg_merchant_distance_1h: float = 0.0

class ScoreResponse(BaseModel):
    txn_id: str
    score: float
    risk_level: str
    reason_codes: List[str]
    model_version: str
    shap_values: Optional[Dict[str, float]] = None

class DecisionRequest(BaseModel):
    txn_id: str
    user_id: str
    amount: float
    score: float
    risk_level: str
    reason_codes: List[str]
    model_version: str
    features: Dict[str, Any]

class DecisionResponse(BaseModel):
    decision_id: str
    txn_id: str
    action: str  # APPROVE, CHALLENGE, BLOCK, REVIEW
    matched_rule: str
    score: float
    timestamp: str

class OutcomeRequest(BaseModel):
    txn_id: str
    decision_id: str
    outcome: str  # FRAUD, LEGIT, CHARGEBACK
    analyst_id: str = "unknown"

# ==========================================
# LIFESPAN
# ==========================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield

app = FastAPI(
    title="Anomaly Scorer",
    version="1.0.0",
    lifespan=lifespan
)

# ==========================================
# WEBSOCKET MANAGER
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        WS_CONNECTIONS.inc()
        logger.info(f"WebSocket connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except:
                dead.append(conn)
        for d in dead:
            self.disconnect(d)

manager = ConnectionManager()

# ==========================================
# RULE-BASED SCORING (FALLBACK)
# ==========================================
def calculate_rule_score(f: TransactionFeatures) -> float:
    score = 0.0
    if abs(f.amount_zscore) > 3:
        score += 0.3
    if f.speed_kmh > 1000:
        score += 0.4
    if f.device_trusted == 0:
        score += 0.2
    if f.txn_count_1m > 20:
        score += 0.1
    # Extended rules
    if f.merchant_risk_score > 0.7:
        score += 0.15
    if f.is_night and f.amount_pctile_user > 3:
        score += 0.1
    if f.unique_merchants_1h > 5:
        score += 0.1
    return min(score, 1.0)

def get_rule_reasons(f: TransactionFeatures) -> List[str]:
    reasons = []
    if abs(f.amount_zscore) > 3:
        reasons.append("unusual_amount")
    if f.speed_kmh > 1000:
        reasons.append("impossible_travel")
    if f.device_trusted == 0:
        reasons.append("new_device")
    if f.txn_count_1m > 20:
        reasons.append("high_velocity")
    if f.merchant_risk_score > 0.7:
        reasons.append("risky_merchant")
    if f.is_night and f.amount_pctile_user > 3:
        reasons.append("night_high_amount")
    if f.unique_merchants_1h > 5:
        reasons.append("merchant_hopping")
    return reasons or ["normal"]

# ==========================================
# SHAP EXPLANATIONS (when model loaded)
# ==========================================
def get_shap_reasons(f: TransactionFeatures, score: float) -> List[str]:
    """Get top SHAP feature contributions"""
    if shap_explainer is None:
        return get_rule_reasons(f)

    try:
        input_data = np.array([[
            f.amount,
            f.txn_count_1m,
            f.amount_zscore,
            f.speed_kmh,
            f.device_trusted,
            f.merchant_risk_score,
            f.hour_of_day,
            f.is_night,
            f.is_weekend,
            f.is_business_hours,
            f.txn_count_merchant_cat_1h,
            f.amount_pctile_user,
            f.unique_merchants_1h,
            f.avg_merchant_distance_1h,
        ]], dtype=np.float32)

        shap_values = shap_explainer.shap_values(input_data)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]  # Positive class for binary

        feature_names = [
            'amount', 'txn_count_1m', 'amount_zscore', 'speed_kmh',
            'device_trusted', 'merchant_risk_score', 'hour_of_day',
            'is_night', 'is_weekend', 'is_business_hours',
            'txn_count_merchant_cat_1h', 'amount_pctile_user',
            'unique_merchants_1h', 'avg_merchant_distance_1h'
        ]

        # Get top 3 contributors
        contribs = list(zip(feature_names, shap_values[0]))
        contribs.sort(key=lambda x: abs(x[1]), reverse=True)
        return [f"{name}={val:.3f}" for name, val in contribs[:3]]
    except Exception as e:
        logger.error(f"SHAP error: {e}")
        return get_rule_reasons(f)

def get_shap_dict(f: TransactionFeatures) -> Dict[str, float]:
    """Return full SHAP values for dashboard"""
    if shap_explainer is None:
        return {}

    try:
        input_data = np.array([[
            f.amount, f.txn_count_1m, f.amount_zscore, f.speed_kmh,
            f.device_trusted, f.merchant_risk_score, f.hour_of_day,
            f.is_night, f.is_weekend, f.is_business_hours,
            f.txn_count_merchant_cat_1h, f.amount_pctile_user,
            f.unique_merchants_1h, f.avg_merchant_distance_1h,
        ]], dtype=np.float32)

        shap_values = shap_explainer.shap_values(input_data)
        if isinstance(shap_values, list):
            shap_values = shap_values[1]

        feature_names = [
            'amount', 'txn_count_1m', 'amount_zscore', 'speed_kmh',
            'device_trusted', 'merchant_risk_score', 'hour_of_day',
            'is_night', 'is_weekend', 'is_business_hours',
            'txn_count_merchant_cat_1h', 'amount_pctile_user',
            'unique_merchants_1h', 'avg_merchant_distance_1h'
        ]
        return dict(zip(feature_names, [float(v) for v in shap_values[0]]))
    except:
        return {}

# ==========================================
# DECISION ENGINE
# ==========================================
def make_decision(features: TransactionFeatures, score: float, reason_codes: List[str]) -> Dict:
    """Rule + model decision logic"""

    # Hard blocks (priority order)
    if features.merchant_risk_score > 0.9:
        return {"action": "BLOCK", "matched_rule": "critical_merchant", "priority": 100}
    if features.txn_count_1m > 100:
        return {"action": "BLOCK", "matched_rule": "velocity_cap", "priority": 95}
    if score > 0.95:
        return {"action": "BLOCK", "matched_rule": "critical_score", "priority": 90}

    # Challenge (3DS, OTP)
    if score > 0.7:
        return {"action": "CHALLENGE", "matched_rule": "high_score", "priority": 70}
    if features.speed_kmh > 1000:
        return {"action": "CHALLENGE", "matched_rule": "impossible_travel", "priority": 80}
    if features.device_trusted == 0 and features.amount_pctile_user > 5:
        return {"action": "CHALLENGE", "matched_rule": "new_device_high_amount", "priority": 75}

    # Review (analyst queue)
    if score > 0.3:
        return {"action": "REVIEW", "matched_rule": "medium_score", "priority": 50}
    if features.unique_merchants_1h > 5:
        return {"action": "REVIEW", "matched_rule": "merchant_hopping", "priority": 55}

    # Approve
    return {"action": "APPROVE", "matched_rule": "default", "priority": 10}

# ==========================================
# ENDPOINTS
# ==========================================
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "model_loaded": session is not None,
        "model_version": model_version,
        "shap_available": shap_explainer is not None
    }

@app.post("/score", response_model=ScoreResponse)
async def score_transaction(features: TransactionFeatures):
    SCORE_REQUESTS.inc()
    with SCORE_LATENCY.time():
        if session is None:
            # Rule-based fallback
            score = calculate_rule_score(features)
            reasons = get_rule_reasons(features)
            shap_vals = {}
        else:
            # ONNX inference
            input_data = np.array([[
                features.amount,
                features.txn_count_1m,
                features.amount_zscore,
                features.speed_kmh,
                features.device_trusted,
                features.merchant_risk_score,
                features.hour_of_day,
                features.is_night,
                features.is_weekend,
                features.is_business_hours,
                features.txn_count_merchant_cat_1h,
                features.amount_pctile_user,
                features.unique_merchants_1h,
                features.avg_merchant_distance_1h,
            ]], dtype=np.float32)
            score = float(session.run(None, {"input": input_data})[0][0])
            reasons = get_shap_reasons(features, score)
            shap_vals = get_shap_dict(features)

    risk_level = "HIGH" if score > 0.7 else "MEDIUM" if score > 0.3 else "LOW"

    response = ScoreResponse(
        txn_id=features.txn_id,
        score=score,
        risk_level=risk_level,
        reason_codes=reasons,
        model_version=model_version,
        shap_values=shap_vals if shap_vals else None
    )

    # Broadcast to WebSocket clients
    await manager.broadcast({
        "type": "SCORE_RESULT",
        "payload": {
            "txn_id": features.txn_id,
            "user_id": features.user_id,
            "amount": features.amount,
            "score": score,
            "risk_level": risk_level,
            "reason_codes": reasons,
            "model_version": model_version,
            "shap_values": shap_vals,
            "timestamp": np.datetime64('now').astype(str),
            "lat": 0.0,  # Would come from RisingWave in production
            "lon": 0.0
        }
    })

    return response

@app.post("/decision", response_model=DecisionResponse)
async def make_decision_endpoint(req: DecisionRequest):
    decision = make_decision(
        TransactionFeatures(**req.features),
        req.score,
        req.reason_codes
    )

    import uuid
    from datetime import datetime
    decision_id = str(uuid.uuid4())[:8]

    DECISIONS_TOTAL.labels(action=decision["action"]).inc()

    # In production: write to PostgreSQL decisions table
    # For now, just return

    return DecisionResponse(
        decision_id=decision_id,
        txn_id=req.txn_id,
        action=decision["action"],
        matched_rule=decision["matched_rule"],
        score=req.score,
        timestamp=datetime.utcnow().isoformat()
    )

@app.post("/outcome")
async def record_outcome(req: OutcomeRequest):
    # In production: write to PostgreSQL outcomes table
    # Trigger retrain check if enough new outcomes
    return {
        "status": "recorded",
        "retrain_triggered": False,
        "message": f"Outcome {req.outcome} recorded for {req.txn_id}"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep alive - wait for ping/pong or client messages
            data = await websocket.receive_json()
            if data.get("type") == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@app.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type="text/plain")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)