#!/usr/bin/env python3
"""
Train LightGBM model on synthetic/IEEE-CIS data and export to ONNX.
Run this before hackathon to generate model.onnx for the scorer.
"""
import os
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
import onnxmltools
from skl2onnx.common.data_types import FloatTensorType

# ==========================================
# CONFIG
# ==========================================
MODEL_OUTPUT_PATH = "model.onnx"
N_SAMPLES = 100000  # Increase for real training
FRAUD_RATE = 0.02

# ==========================================
# GENERATE SYNTHETIC TRAINING DATA
# (Replace with real IEEE-CIS / PaySim data for production)
# ==========================================
def generate_training_data(n_samples=N_SAMPLES, fraud_rate=FRAUD_RATE):
    np.random.seed(42)
    n_fraud = int(n_samples * fraud_rate)
    n_normal = n_samples - n_fraud

    # Normal transactions
    normal_data = {
        'amount': np.random.lognormal(3, 1, n_normal),
        'txn_count_1m': np.random.poisson(5, n_normal),
        'amount_zscore': np.random.normal(0, 1, n_normal),
        'speed_kmh': np.random.exponential(50, n_normal),
        'device_trusted': np.ones(n_normal, dtype=int),
        'merchant_risk_score': np.random.beta(2, 5, n_normal),
        'hour_of_day': np.random.randint(0, 24, n_normal),
        'is_night': np.random.choice([0, 1], n_normal, p=[0.7, 0.3]),
        'is_weekend': np.random.choice([0, 1], n_normal, p=[0.7, 0.3]),
        'is_business_hours': np.random.choice([0, 1], n_normal, p=[0.4, 0.6]),
        'txn_count_merchant_cat_1h': np.random.poisson(2, n_normal),
        'amount_pctile_user': np.random.uniform(0.5, 2.0, n_normal),
        'unique_merchants_1h': np.random.randint(1, 5, n_normal),
        'avg_merchant_distance_1h': np.random.exponential(10, n_normal),
        'label': 0
    }

    # Fraud transactions - biased features
    fraud_data = {
        'amount': np.random.lognormal(5, 1.5, n_fraud),  # Higher amounts
        'txn_count_1m': np.random.poisson(30, n_fraud),  # Higher velocity
        'amount_zscore': np.abs(np.random.normal(3, 2, n_fraud)),  # High z-score
        'speed_kmh': np.random.exponential(500, n_fraud) + 1000,  # Impossible travel
        'device_trusted': np.zeros(n_fraud, dtype=int),  # New devices
        'merchant_risk_score': np.random.beta(5, 2, n_fraud),  # Risky merchants
        'hour_of_day': np.random.choice(list(range(22, 24)) + list(range(0, 6)), n_fraud),  # Night
        'is_night': np.ones(n_fraud, dtype=int),
        'is_weekend': np.random.choice([0, 1], n_fraud, p=[0.5, 0.5]),
        'is_business_hours': np.zeros(n_fraud, dtype=int),
        'txn_count_merchant_cat_1h': np.random.poisson(10, n_fraud),
        'amount_pctile_user': np.random.uniform(5, 50, n_fraud),  # Way above normal
        'unique_merchants_1h': np.random.randint(3, 10, n_fraud),
        'avg_merchant_distance_1h': np.random.exponential(100, n_fraud) + 500,
        'label': 1
    }

    # Combine
    data = {}
    for key in normal_data:
        data[key] = np.concatenate([normal_data[key], fraud_data[key]])

    df = pd.DataFrame(data)
    return df.sample(frac=1, random_state=42).reset_index(drop=True)

# ==========================================
# TRAIN MODEL
# ==========================================
def train_model(df):
    feature_cols = [c for c in df.columns if c != 'label']
    X = df[feature_cols]
    y = df['label']

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # LightGBM params
    params = {
        'objective': 'binary',
        'metric': 'auc',
        'boosting_type': 'gbdt',
        'num_leaves': 64,
        'learning_rate': 0.05,
        'feature_fraction': 0.8,
        'bagging_fraction': 0.8,
        'bagging_freq': 5,
        'verbose': -1,
        'random_state': 42,
        'class_weight': 'balanced',
    }

    train_data = lgb.Dataset(X_train, label=y_train)
    valid_data = lgb.Dataset(X_test, label=y_test, reference=train_data)

    model = lgb.train(
        params,
        train_data,
        num_boost_round=500,
        valid_sets=[valid_data],
        callbacks=[lgb.early_stopping(50), lgb.log_evaluation(100)]
    )

    # Evaluate
    y_pred = model.predict(X_test, num_iteration=model.best_iteration)
    auc = roc_auc_score(y_test, y_pred)
    print(f"\nTest AUC: {auc:.4f}")
    print(f"Best iteration: {model.best_iteration}")

    # Feature importance
    importance = pd.DataFrame({
        'feature': feature_cols,
        'importance': model.feature_importance(importance_type='gain')
    }).sort_values('importance', ascending=False)
    print("\nTop 10 Features:")
    print(importance.head(10))

    return model, feature_cols

# ==========================================
# EXPORT TO ONNX
# ==========================================
def export_onnx(model, feature_cols, output_path=MODEL_OUTPUT_PATH):
    # Define input schema
    initial_types = [('input', FloatTensorType([None, len(feature_cols)]))]

    # Convert
    onnx_model = onnxmltools.convert_lightgbm(
        model,
        initial_types=initial_types,
        target_opset=14
    )

    # Save
    onnxmltools.utils.save_model(onnx_model, output_path)
    print(f"\n✅ Model exported to {output_path}")

    # Verify
    import onnxruntime as ort
    session = ort.InferenceSession(output_path)
    print(f"ONNX inputs: {[i.name for i in session.get_inputs()]}")
    print(f"ONNX outputs: {[o.name for o in session.get_outputs()]}")

    # Test inference
    test_input = np.random.randn(1, len(feature_cols)).astype(np.float32)
    result = session.run(None, {'input': test_input})
    print(f"Test inference result: {result[0][0]:.4f}")

# ==========================================
# MAIN
# ==========================================
if __name__ == "__main__":
    print("Generating training data...")
    df = generate_training_data()

    print(f"Data shape: {df.shape}, Fraud rate: {df['label'].mean():.3f}")

    print("Training LightGBM...")
    model, feature_cols = train_model(df)

    print("Exporting to ONNX...")
    export_onnx(model, feature_cols)

    print("\n✅ Done! Copy model.onnx to scorer/ directory and rebuild:")
    print("   docker-compose build scorer")
    print("   docker-compose up -d scorer")