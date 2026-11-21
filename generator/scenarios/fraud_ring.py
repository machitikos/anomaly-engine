#!/usr/bin/env python3
"""
Demo Scenario 1: Fraud Ring Attack
Simulates coordinated fraud across multiple stolen cards at same merchants
Run: python fraud_ring.py
"""

import asyncio
import json
import random
import time
from datetime import datetime, timedelta
from kafka import KafkaProducer

KAFKA_BROKER = "localhost:9092"
TOPIC = "txns.raw"

# Fraud ring: 5 compromised users, hitting same 3 merchants rapidly
FRAUD_USERS = [f"user_fraud_{i}" for i in range(100, 105)]
MERCHANTS = ["merchant_atm_001", "merchant_electronics_002", "merchant_jewelry_003"]
MCC_CODES = ["6011", "5732", "5094"]  # ATM, Electronics, Jewelry

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BROKER,
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    acks='all'
)

def generate_fraud_txn(user_id, merchant_id, mcc, base_time):
    """Generate a clearly fraudulent transaction"""
    return {
        "txn_id": f"fraud_{user_id}_{int(time.time()*1000)}_{random.randint(1000,9999)}",
        "user_id": user_id,
        "amount": round(random.uniform(500, 5000), 2),  # High amounts
        "currency": "USD",
        "merchant_id": merchant_id,
        "mcc": mcc,
        "ts": (base_time + timedelta(seconds=random.randint(0, 30))).isoformat(),
        "lat": round(random.uniform(40.7, 40.8), 6),  # NYC area
        "lon": round(random.uniform(-74.0, -73.9), 6),
        "device_fp": f"device_fraud_{random.randint(1,3)}",  # Shared devices
        "ip": f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
        "is_fraud": True
    }

async def run_fraud_ring():
    print("🎭 Starting FRAUD RING scenario...")
    print(f"   Users: {FRAUD_USERS}")
    print(f"   Merchants: {MERCHANTS}")
    print("   Pattern: High-value, rapid succession, shared devices")
    print()

    base_time = datetime.utcnow()
    txn_count = 0

    try:
        while True:
            # Burst: all fraud users hit all merchants in quick succession
            for user in FRAUD_USERS:
                for merchant, mcc in zip(MERCHANTS, MCC_CODES):
                    txn = generate_fraud_txn(user, merchant, mcc, base_time)
                    producer.send(TOPIC, txn)
                    txn_count += 1

                    if txn_count % 10 == 0:
                        print(f"   Sent {txn_count} fraud transactions...")

            producer.flush()
            print(f"   ✅ Burst complete: {txn_count} total. Waiting 10s for next wave...")
            await asyncio.sleep(10)
            base_time = datetime.utcnow()

    except KeyboardInterrupt:
        print(f"\n🛑 Stopped. Total sent: {txn_count}")
    finally:
        producer.close()

if __name__ == "__main__":
    asyncio.run(run_fraud_ring())