#!/usr/bin/env python3
"""
Synthetic transaction generator for hackathon demo.
Produces realistic transaction streams to Redpanda.
"""
import os
import json
import time
import random
import signal
import sys
from datetime import datetime, timedelta
from kafka import KafkaProducer
from faker import Faker
from prometheus_client import Counter, Histogram, start_http_server

fake = Faker()

# Config
BROKERS = os.getenv("REDPANDA_BROKERS", "localhost:9092").split(",")
TOPIC = os.getenv("TOPIC", "txns.raw")
RATE = int(os.getenv("RATE", "100"))  # txns/second
FRAUD_RATE = float(os.getenv("FRAUD_RATE", "0.02"))

# Metrics
TXN_GENERATED = Counter('generator_transactions_total', 'Total transactions generated')
TXN_LATENCY = Histogram('generator_latency_seconds', 'Send latency')

# Global producer
producer = None
running = True

def signal_handler(sig, frame):
    global running
    print("\nShutting down...")
    running = False

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def create_producer():
    return KafkaProducer(
        bootstrap_servers=BROKERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'),
        key_serializer=lambda k: k.encode('utf-8') if k else None,
        acks='all',
        retries=3,
        linger_ms=5,
        batch_size=16384,
    )

def generate_transaction(user_pool, merchant_pool, device_pool):
    """Generate a single synthetic transaction"""
    is_fraud = random.random() < FRAUD_RATE

    # Pick or create user
    if random.random() < 0.9 and user_pool:
        user = random.choice(user_pool)
    else:
        user = {
            'user_id': fake.uuid4(),
            'home_lat': random.uniform(25, 49),  # US latitudes
            'home_lon': random.uniform(-125, -66),  # US longitudes
            'devices': [fake.sha256() for _ in range(random.randint(1, 3))],
            'typical_amount': random.uniform(10, 500),
        }
        user_pool.append(user)

    # Pick merchant
    merchant = random.choice(merchant_pool) if merchant_pool else {
        'merchant_id': fake.uuid4(),
        'mcc': random.choice(['5411', '5812', '5732', '4814', '5999']),
        'lat': random.uniform(25, 49),
        'lon': random.uniform(-125, -66),
        'risk_score': random.uniform(0, 1),
    }
    if merchant not in merchant_pool:
        merchant_pool.append(merchant)

    # Base transaction
    now = datetime.utcnow()
    txn = {
        'txn_id': fake.uuid4(),
        'user_id': user['user_id'],
        'amount': round(random.lognormvariate(3, 1), 2),
        'currency': 'USD',
        'merchant_id': merchant['merchant_id'],
        'mcc': merchant['mcc'],
        'ts': now.isoformat() + 'Z',
        'lat': user['home_lat'] + random.uniform(-0.5, 0.5),
        'lon': user['home_lon'] + random.uniform(-0.5, 0.5),
        'device_fp': random.choice(user['devices']),
        'ip': fake.ipv4(),
        'is_fraud': is_fraud,
    }

    # Inject fraud patterns
    if is_fraud:
        fraud_type = random.choice(['amount', 'geo', 'velocity', 'device'])
        if fraud_type == 'amount':
            txn['amount'] = round(user['typical_amount'] * random.uniform(10, 50), 2)
        elif fraud_type == 'geo':
            # Impossible travel: far from home
            txn['lat'] = random.uniform(-90, 90)
            txn['lon'] = random.uniform(-180, 180)
        elif fraud_type == 'device':
            txn['device_fp'] = fake.sha256()  # New device

    return txn, user['user_id']

def main():
    global producer

    print(f"Starting generator: {RATE} txns/sec → {TOPIC} @ {BROKERS}")

    # Start metrics server
    start_http_server(8080)

    # Wait for Kafka to be ready
    for i in range(30):
        try:
            producer = create_producer()
            producer.bootstrap_connected()
            print("Connected to Redpanda!")
            break
        except Exception as e:
            print(f"Waiting for Kafka... ({i+1}/30) {e}")
            time.sleep(2)
    else:
        print("Failed to connect to Kafka")
        sys.exit(1)

    # Entity pools for realistic patterns
    user_pool = []
    merchant_pool = []
    device_pool = []

    # Pre-populate
    for _ in range(100):
        generate_transaction(user_pool, merchant_pool, device_pool)

    interval = 1.0 / RATE
    next_send = time.time()

    try:
        while running:
            txn, key = generate_transaction(user_pool, merchant_pool, device_pool)

            with TXN_LATENCY.time():
                future = producer.send(TOPIC, key=key, value=txn)
                future.add_errback(lambda e: print(f"Send error: {e}"))

            TXN_GENERATED.inc()

            # Rate limiting
            next_send += interval
            sleep_time = next_send - time.time()
            if sleep_time > 0:
                time.sleep(sleep_time)
            else:
                next_send = time.time()  # Catch up

    finally:
        producer.flush()
        producer.close()
        print("Generator stopped")

if __name__ == "__main__":
    main()