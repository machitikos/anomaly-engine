#!/usr/bin/env python3
"""
Demo Scenario 2: Account Takeover (ATO)
Simulates legitimate user suddenly transacting from new device/location at high velocity
Run: python account_takeover.py
"""

import asyncio
import json
import random
import time
from datetime import datetime, timedelta
from kafka import KafkaProducer

KAFKA_BROKER = "localhost:9092"
TOPIC = "txns.raw"

# Legitimate user who gets compromised
VICTIM_USER = "user_vip_001"
LEGIT_DEVICE = "device_legit_iphone_001"
LEGIT_LOCATION = (37.7749, -122.4194)  # San Francisco

# Attacker details
ATTACKER_DEVICES = [f"device_attacker_{i}" for i in range(1, 4)]
ATTACKER_LOCATIONS = [
    (40.7128, -74.0060),   # New York
    (51.5074, -0.1278),    # London
    (35.6762, 139.6503),   # Tokyo
]

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BROKER,
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    acks='all'
)

def generate_txn(user_id, device, lat, lon, amount_range, is_fraud=False):
    return {
        "txn_id": f"{'fraud' if is_fraud else 'legit'}_{user_id}_{int(time.time()*1000)}_{random.randint(1000,9999)}",
        "user_id": user_id,
        "amount": round(random.uniform(*amount_range), 2),
        "currency": "USD",
        "merchant_id": f"merchant_{random.randint(1, 50):03d}",
        "mcc": random.choice(["5411", "5812", "5999", "4816", "5732"]),
        "ts": datetime.utcnow().isoformat(),
        "lat": round(lat + random.uniform(-0.01, 0.01), 6),
        "lon": round(lon + random.uniform(-0.01, 0.01), 6),
        "device_fp": device,
        "ip": f"10.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}",
        "is_fraud": is_fraud
    }

async def run_account_takeover():
    print("🔓 Starting ACCOUNT TAKEOVER scenario...")
    print(f"   Victim: {VICTIM_USER}")
    print(f"   Legit device: {LEGIT_DEVICE} @ SF")
    print(f"   Attacker devices: {ATTACKER_DEVICES} @ NY/London/Tokyo")
    print("   Phase 1: Normal behavior (30s)")
    print("   Phase 2: Takeover - new device, impossible travel, high velocity")
    print()

    txn_count = 0
    phase = 1

    try:
        # PHASE 1: Normal behavior
        print("📍 PHASE 1: Normal user activity (San Francisco, trusted device)")
        start = time.time()
        while time.time() - start < 30:
            txn = generate_txn(VICTIM_USER, LEGIT_DEVICE, *LEGIT_LOCATION, (20, 200))
            producer.send(TOPIC, txn)
            txn_count += 1
            await asyncio.sleep(random.uniform(2, 5))  # Normal pacing

        producer.flush()
        print(f"   Phase 1 done: {txn_count} legitimate transactions")

        # PHASE 2: Account Takeover
        print("\n🚨 PHASE 2: ACCOUNT TAKEOVER DETECTED!")
        print("   - New device fingerprint")
        print("   - Impossible travel (SF → NY → London → Tokyo in minutes)")
        print("   - High velocity transactions")
        print("   - Higher amounts")

        attack_start = time.time()
        location_idx = 0

        while time.time() - attack_start < 60:  # 1 minute of attack
            # Impossible travel: jump locations rapidly
            lat, lon = ATTACKER_LOCATIONS[location_idx % len(ATTACKER_LOCATIONS)]
            device = ATTACKER_DEVICES[location_idx % len(ATTACKER_DEVICES)]
            location_idx += 1

            # Burst of 3-5 transactions per location
            for _ in range(random.randint(3, 5)):
                txn = generate_txn(
                    VICTIM_USER, device, lat, lon,
                    (500, 3000),  # Higher amounts
                    is_fraud=True
                )
                producer.send(TOPIC, txn)
                txn_count += 1

            producer.flush()
            print(f"   💸 Attack burst from {device} @ ({lat:.2f}, {lon:.2f}) - {txn_count} total")
            await asyncio.sleep(random.uniform(1, 3))  # Fast pacing

        print(f"\n✅ Attack phase complete. Total: {txn_count}")

        # PHASE 3: Return to normal (recovery)
        print("\n📍 PHASE 3: Legitimate user regains control")
        for _ in range(10):
            txn = generate_txn(VICTIM_USER, LEGIT_DEVICE, *LEGIT_LOCATION, (20, 200))
            producer.send(TOPIC, txn)
            txn_count += 1
            await asyncio.sleep(2)

        producer.flush()
        print(f"   Recovery transactions sent. Final total: {txn_count}")

    except KeyboardInterrupt:
        print(f"\n🛑 Stopped. Total sent: {txn_count}")
    finally:
        producer.close()

if __name__ == "__main__":
    asyncio.run(run_account_takeover())