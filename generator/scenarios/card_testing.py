#!/usr/bin/env python3
"""
Demo Scenario 3: Card Testing / Enumeration Attack
Simulates attacker testing stolen card numbers with small amounts across many merchants
Run: python card_testing.py
"""

import asyncio
import json
import random
import time
from datetime import datetime
from kafka import KafkaProducer

KAFKA_BROKER = "localhost:9092"
TOPIC = "txns.raw"

# Many "test" users (simulating different stolen cards)
TEST_USERS = [f"user_cardtest_{i:04d}" for i in range(1, 51)]  # 50 different cards
MERCHANTS = [f"merchant_test_{i:03d}" for i in range(1, 21)]   # 20 test merchants
MCC_CODES = ["5812", "5814", "5499", "5734", "4816", "5968"]  # Various low-risk MCCs

producer = KafkaProducer(
    bootstrap_servers=KAFKA_BROKER,
    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
    acks='all'
)

def generate_test_txn(user_id, merchant_id, mcc, attempt_num):
    """Generate a card testing transaction - small amount, high velocity"""
    return {
        "txn_id": f"cardtest_{user_id}_attempt{attempt_num}_{int(time.time()*1000)}",
        "user_id": user_id,
        "amount": round(random.uniform(0.50, 5.00), 2),  # Tiny amounts ($0.50-$5)
        "currency": "USD",
        "merchant_id": merchant_id,
        "mcc": mcc,
        "ts": datetime.utcnow().isoformat(),
        "lat": round(random.uniform(30, 50), 6),  # Distributed across US
        "lon": round(random.uniform(-120, -70), 6),
        "device_fp": f"device_botnet_{random.randint(1, 10)}",  # Shared botnet devices
        "ip": f"203.0.{random.randint(1,255)}.{random.randint(1,255)}",  # Same IP range
        "is_fraud": True
    }

async def run_card_testing():
    print("💳 Starting CARD TESTING / ENUMERATION scenario...")
    print(f"   Cards being tested: {len(TEST_USERS)} (simulated stolen cards)")
    print(f"   Test merchants: {len(MERCHANTS)}")
    print("   Pattern: Micro-transactions ($0.50-$5), high velocity, distributed")
    print("   Goal: Find valid cards before making large fraudulent purchases")
    print()

    txn_count = 0
    attempts_per_card = {}

    try:
        print("🤖 Botnet starting card enumeration...")
        print("   Each card: 10-50 attempts across different merchants")
        print()

        while True:
            for user in TEST_USERS:
                # Each card gets tested 10-50 times
                num_attempts = random.randint(10, 50)
                attempts_per_card[user] = attempts_per_card.get(user, 0) + num_attempts

                for attempt in range(num_attempts):
                    merchant = random.choice(MERCHANTS)
                    mcc = random.choice(MCC_CODES)

                    txn = generate_test_txn(user, merchant, mcc, attempt + 1)
                    producer.send(TOPIC, txn)
                    txn_count += 1

                # Flush per card to simulate distributed botnet
                producer.flush()

                if txn_count % 100 == 0:
                    valid_found = sum(1 for v in attempts_per_card.values() if v > 30)
                    print(f"   📊 Progress: {txn_count} test txns | {len(attempts_per_card)} cards tested | {valid_found} potentially valid")

            print(f"\n✅ Full enumeration cycle complete: {txn_count} transactions")
            print(f"   Cards tested: {len(attempts_per_card)}")
            print("   Waiting 30s before next enumeration wave...\n")
            await asyncio.sleep(30)

    except KeyboardInterrupt:
        print(f"\n🛑 Stopped. Total test transactions: {txn_count}")
        print(f"   Unique cards tested: {len(attempts_per_card)}")
        avg = sum(attempts_per_card.values()) / len(attempts_per_card) if attempts_per_card else 0
        print(f"   Avg attempts per card: {avg:.1f}")
    finally:
        producer.close()

if __name__ == "__main__":
    asyncio.run(run_card_testing())