const PptxGenJS = require('pptxgenjs');

const pres = new PptxGenJS();

// ==========================================
// COLOR PALETTE - Dark/tech aesthetic for fraud detection
// ==========================================
const COLORS = {
  // Backgrounds
  bgDark: "0A0E1A",       // Deep navy/black
  bgCard: "1E293B",       // Slate 800
  bgLight: "F8FAFC",      // Off-white
  bgCardLight: "FFFFFF",  // White
  borderDark: "334155",   // Slate 700
  borderLight: "E2E8F0",  // Slate 200

  // Text
  textDark: "0A0E1A",
  textLight: "F8FAFC",
  textMutedDark: "94A3B8", // Slate 400
  textMutedLight: "64748B", // Slate 500

  // Accents
  cyan: "06B6D4",      // Primary
  orange: "F97316",    // Alert/warning
  green: "22C55E",     // Safe
  red: "EF4444",       // Danger
  purple: "8B5CF6",    // ML/AI
  yellow: "EAB308",    // Medium
};

pres.layout = "LAYOUT_16x9"; // 10" x 5.625"

// ==========================================
// HELPER: Add section divider slide
// ==========================================
function addSectionDivider(title, subtitle, dark = true) {
  const slide = pres.addSlide();
  slide.background = { color: dark ? COLORS.bgDark : COLORS.bgLight };

  slide.addText(title, {
    x: 1, y: 1.8, w: 8, h: 1,
    fontSize: 40,
    bold: true,
    color: COLORS.cyan,
    align: "center",
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: 1, y: 3, w: 8, h: 0.8,
      fontSize: 18,
      color: dark ? COLORS.textMutedDark : COLORS.textMutedLight,
      align: "center",
    });
  }
  return slide;
}

// ==========================================
// HELPER: Add content slide with title + bullets
// ==========================================
function addContentSlide(title, bullets, options = {}) {
  const dark = options.dark !== false;
  const slide = pres.addSlide();
  slide.background = { color: dark ? COLORS.bgDark : COLORS.bgLight };

  // Title
  slide.addText(title, {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32,
    bold: true,
    color: dark ? COLORS.cyan : COLORS.textDark,
  });

  // Accent line
  slide.addShape("LINE", {
    x: 0.5, y: 1.0, w: 2, h: 0,
    line: { color: COLORS.cyan, width: 3 }
  });

  // Bullets
  const bulletItems = bullets.map((b, i) => ({
    text: b.text || b,
    options: {
      bullet: true,
      fontSize: b.size || 16,
      color: dark ? COLORS.textLight : COLORS.textDark,
      bold: b.bold || false,
      breakLine: i < bullets.length - 1,
      paraSpaceAfter: 8,
    }
  }));

  slide.addText(bulletItems, {
    x: 0.7, y: 1.3, w: 8.6, h: 3.8,
    margin: 0,
  });

  // Optional stat callout
  if (options.stat) {
    slide.addText(options.stat.value, {
      x: options.stat.x || 6.5, y: options.stat.y || 1.3,
      w: 3, h: 1.5,
      fontSize: options.stat.size || 48,
      bold: true,
      color: options.stat.color || COLORS.cyan,
      align: "center",
    });
    slide.addText(options.stat.label, {
      x: options.stat.x || 6.5, y: (options.stat.y || 1.3) + 1.2,
      w: 3, h: 0.5,
      fontSize: 14,
      color: dark ? COLORS.textMutedDark : COLORS.textMutedLight,
      align: "center",
    });
  }

  return slide;
}

// ==========================================
// HELPER: Add two-column slide
// ==========================================
function addTwoColumnSlide(title, leftTitle, leftBullets, rightTitle, rightBullets, options = {}) {
  const dark = options.dark !== false;
  const slide = pres.addSlide();
  slide.background = { color: dark ? COLORS.bgDark : COLORS.bgLight };

  slide.addText(title, {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32,
    bold: true,
    color: dark ? COLORS.cyan : COLORS.textDark,
  });

  slide.addShape("LINE", {
    x: 0.5, y: 1.0, w: 2, h: 0,
    line: { color: COLORS.cyan, width: 3 }
  });

  // Left column
  slide.addText(leftTitle, {
    x: 0.5, y: 1.3, w: 4, h: 0.5,
    fontSize: 20,
    bold: true,
    color: dark ? COLORS.cyan : COLORS.textDark,
  });

  const leftItems = leftBullets.map((b, i) => ({
    text: b.text || b,
    options: {
      bullet: true,
      fontSize: b.size || 14,
      color: dark ? COLORS.textLight : COLORS.textDark,
      bold: b.bold || false,
      breakLine: i < leftBullets.length - 1,
      paraSpaceAfter: 6,
    }
  }));

  slide.addText(leftItems, {
    x: 0.5, y: 1.8, w: 4.2, h: 3.2,
    margin: 0,
  });

  // Right column
  slide.addText(rightTitle, {
    x: 5.3, y: 1.3, w: 4, h: 0.5,
    fontSize: 20,
    bold: true,
    color: dark ? COLORS.cyan : COLORS.textDark,
  });

  const rightItems = rightBullets.map((b, i) => ({
    text: b.text || b,
    options: {
      bullet: true,
      fontSize: b.size || 14,
      color: dark ? COLORS.textLight : COLORS.textDark,
      bold: b.bold || false,
      breakLine: i < rightBullets.length - 1,
      paraSpaceAfter: 6,
    }
  }));

  slide.addText(rightItems, {
    x: 5.3, y: 1.8, w: 4.2, h: 3.2,
    margin: 0,
  });

  return slide;
}

// ==========================================
// HELPER: Add chart slide
// ==========================================
function addChartSlide(title, chartData, options = {}) {
  const dark = options.dark !== false;
  const slide = pres.addSlide();
  slide.background = { color: dark ? COLORS.bgDark : COLORS.bgLight };

  slide.addText(title, {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32,
    bold: true,
    color: dark ? COLORS.cyan : COLORS.textDark,
  });

  slide.addShape("LINE", {
    x: 0.5, y: 1.0, w: 2, h: 0,
    line: { color: COLORS.cyan, width: 3 }
  });

  slide.addChart(chartData.type, chartData.data, {
    x: 0.5, y: 1.3, w: 9, h: 3.8,
    ...chartData.options,
    chartColors: chartData.colors || [COLORS.cyan, COLORS.orange, COLORS.green, COLORS.red, COLORS.purple, COLORS.yellow],
    showTitle: false,
    catAxisLabelColor: dark ? COLORS.textMutedDark : COLORS.textMutedLight,
    valAxisLabelColor: dark ? COLORS.textMutedDark : COLORS.textMutedLight,
    valGridLine: { color: dark ? COLORS.borderDark : COLORS.borderLight, size: 1 },
    catGridLine: { style: "none" },
    showLegend: chartData.showLegend !== false,
    legendPos: "b",
    legendFontFace: "Calibri",
    legendFontSize: 11,
  });

  return slide;
}

// ==========================================
// HELPER: Add stat grid slide
// ==========================================
function addStatGridSlide(title, stats, options = {}) {
  const dark = options.dark !== false;
  const slide = pres.addSlide();
  slide.background = { color: dark ? COLORS.bgDark : COLORS.bgLight };

  slide.addText(title, {
    x: 0.5, y: 0.3, w: 9, h: 0.7,
    fontSize: 32,
    bold: true,
    color: dark ? COLORS.cyan : COLORS.textDark,
  });

  slide.addShape("LINE", {
    x: 0.5, y: 1.0, w: 2, h: 0,
    line: { color: COLORS.cyan, width: 3 }
  });

  stats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.8 + col * 3.1;
    const y = 1.4 + row * 1.8;

    // Card background
    slide.addShape("ROUNDED_RECTANGLE", {
      x, y, w: 2.8, h: 1.5,
      fill: { color: dark ? COLORS.bgCard : COLORS.bgCardLight },
      line: { color: dark ? COLORS.borderDark : COLORS.borderLight, width: 1 },
      rectRadius: 8,
      shadow: { type: "outer", color: "000000", blur: 10, offset: 2, angle: 90, opacity: 0.1 },
    });

    // Stat value
    slide.addText(stat.value, {
      x, y: y + 0.15, w: 2.8, h: 0.8,
      fontSize: 36,
      bold: true,
      color: stat.color || COLORS.cyan,
      align: "center",
    });

    // Stat label
    slide.addText(stat.label, {
      x, y: y + 0.9, w: 2.8, h: 0.4,
      fontSize: 12,
      color: dark ? COLORS.textMutedDark : COLORS.textMutedLight,
      align: "center",
    });
  });

  return slide;
}

// ==========================================
// SLIDE 1: TITLE SLIDE
// ==========================================
const titleSlide = pres.addSlide();
titleSlide.background = { color: COLORS.bgDark };

titleSlide.addText("Anomaly Engine", {
  x: 1, y: 1.5, w: 8, h: 1.2,
  fontSize: 56,
  bold: true,
  color: COLORS.cyan,
  align: "center",
});

titleSlide.addText("Real-Time Transaction Fraud Detection", {
  x: 1, y: 2.7, w: 8, h: 0.8,
  fontSize: 24,
  color: COLORS.textMutedDark,
  align: "center",
});

titleSlide.addText("Sub-50ms Latency • 1000+ TXN/sec • Streaming SQL + ONNX", {
  x: 1, y: 3.5, w: 8, h: 0.6,
  fontSize: 16,
  color: COLORS.orange,
  align: "center",
});

titleSlide.addText("College Hackathon Project", {
  x: 1, y: 4.3, w: 8, h: 0.5,
  fontSize: 14,
  color: COLORS.textMutedDark,
  align: "center",
});

titleSlide.addText("Team: 4 Members | 24 Hours | Live Demo", {
  x: 1, y: 4.8, w: 8, h: 0.5,
  fontSize: 13,
  color: COLORS.purple,
  align: "center",
});

// ==========================================
// SLIDE 2: PROBLEM STATEMENT
// ==========================================
addContentSlide(
  "The Problem: Fraud Is Winning",
  [
    { text: "Global card fraud losses: $32B+ annually (Nilson Report 2023)", bold: true },
    { text: "Traditional batch detection runs hours/days AFTER fraud occurs" },
    { text: "Rule-based systems generate 95%+ false positives — analyst burnout" },
    { text: "Modern attacks: fraud rings, account takeovers, card testing — coordinated, fast" },
    { text: "Need: Real-time scoring BEFORE transaction completes, with explainable decisions" },
  ],
  { stat: { value: "$32B+", label: "Annual Fraud Losses", color: COLORS.red, x: 6.5, y: 1.5, size: 42 } }
);

// ==========================================
// SLIDE 3: SOLUTION OVERVIEW
// ==========================================
addContentSlide(
  "Our Solution: Anomaly Engine",
  [
    { text: "End-to-end streaming fraud detection pipeline", bold: true },
    { text: "Scores 1000+ transactions/second with <50ms p99 latency" },
    { text: "Streaming SQL (RisingWave) computes 15+ behavioral features incrementally" },
    { text: "ONNX Runtime model inference in <5ms with SHAP explanations" },
    { text: "Four-tier decisions: APPROVE → CHALLENGE → REVIEW → BLOCK" },
    { text: "Live React dashboard with WebSocket push + Grafana observability" },
  ],
  { dark: true, stat: { value: "<50ms", label: "p99 Latency", color: COLORS.green, x: 6.5, y: 1.5, size: 42 } }
);

// ==========================================
// SLIDE 4: ARCHITECTURE
// ==========================================
const archSlide = pres.addSlide();
archSlide.background = { color: COLORS.bgDark };

archSlide.addText("Streaming Architecture", {
  x: 0.5, y: 0.3, w: 9, h: 0.7,
  fontSize: 32,
  bold: true,
  color: COLORS.cyan,
});

archSlide.addShape("LINE", {
  x: 0.5, y: 1.0, w: 2, h: 0,
  line: { color: COLORS.cyan, width: 3 }
});

// Architecture boxes - Generator → Kafka → RisingWave → Scorer → Dashboard
const components = [
  { name: "Generator", desc: "Synthetic TXNs\n100-800/sec", color: COLORS.purple, x: 0.4, y: 1.5 },
  { name: "Kafka", desc: "Message Bus\nRedpanda", color: COLORS.cyan, x: 2.4, y: 1.5 },
  { name: "RisingWave", desc: "Streaming SQL\n15+ Features", color: COLORS.green, x: 4.4, y: 1.5 },
  { name: "Scorer", desc: "FastAPI + ONNX\n<5ms inference", color: COLORS.orange, x: 6.4, y: 1.5 },
  { name: "Dashboard", desc: "React + WS\nLive Updates", color: COLORS.red, x: 8.4, y: 1.5 },
];

components.forEach((c, i) => {
  archSlide.addShape("ROUNDED_RECTANGLE", {
    x: c.x, y: c.y, w: 1.8, h: 1.4,
    fill: { color: c.color },
    rectRadius: 10,
    shadow: { type: "outer", color: "000000", blur: 15, offset: 3, angle: 90, opacity: 0.3 },
  });

  archSlide.addText(c.name, {
    x: c.x, y: c.y + 0.15, w: 1.8, h: 0.5,
    fontSize: 16, bold: true, color: "FFFFFF", align: "center",
  });

  archSlide.addText(c.desc, {
    x: c.x, y: c.y + 0.6, w: 1.8, h: 0.7,
    fontSize: 10, color: "FFFFFF", align: "center",
  });

  // Arrow between components
  if (i < components.length - 1) {
    archSlide.addShape("LINE", {
      x: c.x + 1.8, y: c.y + 0.7, w: 0.6, h: 0,
      line: { color: COLORS.textMutedDark, width: 2, headEndType: "triangle" }
    });
  }
});

// Bottom row: Monitoring
const monitoring = [
  { name: "Prometheus", desc: "Metrics", color: COLORS.purple, x: 0.4, y: 3.4 },
  { name: "Grafana", desc: "Dashboards", color: COLORS.cyan, x: 2.4, y: 3.4 },
  { name: "PostgreSQL", desc: "Decisions/\nOutcomes", color: COLORS.green, x: 4.4, y: 3.4 },
];

monitoring.forEach((c) => {
  archSlide.addShape("ROUNDED_RECTANGLE", {
    x: c.x, y: c.y, w: 1.8, h: 1.2,
    fill: { color: c.color },
    rectRadius: 10,
    shadow: { type: "outer", color: "000000", blur: 15, offset: 3, angle: 90, opacity: 0.3 },
  });

  archSlide.addText(c.name, {
    x: c.x, y: c.y + 0.1, w: 1.8, h: 0.4,
    fontSize: 14, bold: true, color: "FFFFFF", align: "center",
  });

  archSlide.addText(c.desc, {
    x: c.x, y: c.y + 0.5, w: 1.8, h: 0.6,
    fontSize: 10, color: "FFFFFF", align: "center",
  });
});

// ==========================================
// SLIDE 5: KEY METRICS
// ==========================================
addStatGridSlide(
  "Performance Targets (Achieved in Demo)",
  [
    { label: "Throughput", value: "800+ TXN/sec", color: COLORS.cyan },
    { label: "p95 Latency", value: "∼15ms", color: COLORS.green },
    { label: "p99 Latency", value: "∼35ms", color: COLORS.orange },
    { label: "Model Inference", value: "<5ms", color: COLORS.purple },
    { label: "False Positive Rate", value: "∼1.5%", color: COLORS.green },
    { label: "Block Rate", value: "<5%", color: COLORS.red },
  ],
  { dark: true }
);

// ==========================================
// SLIDE 6: RISINGWAVE STREAMING SQL
// ==========================================
addContentSlide(
  "RisingWave: Streaming Feature Engineering",
  [
    { text: "15+ features computed incrementally as events arrive — no batch jobs", bold: true },
    { text: "Velocity: 1-min tumbling windows (txn count, amount sum/avg/stddev)" },
    { text: "Amount Z-score: 1-hour rolling baseline per user" },
    { text: "Geo impossibility: Euclidean distance / time → speed in km/h" },
    { text: "Device trust: Join with known_devices table (new device = risk signal)" },
    { text: "Merchant risk: MCC lookup + dynamic merchant risk scoring" },
    { text: "Temporal: hour_of_day, is_night, is_weekend, is_business_hours" },
    { text: "Behavioral: merchant-category velocity, user amount percentile" },
    { text: "Cross-merchant: unique merchants in last hour (merchant hopping)" },
    { text: "Wide feature_vector materialized view joins all features per transaction" },
  ],
  { dark: true, stat: { value: "15+", label: "Real-Time Features", color: COLORS.purple, x: 6.5, y: 1.5, size: 38 } }
);

// ==========================================
// SLIDE 7: SCORER API & MODEL
// ==========================================
addTwoColumnSlide(
  "Scorer API: FastAPI + ONNX Runtime",
  "API Endpoints",
  [
    "POST /score — Main scoring endpoint (<50ms)",
    "POST /decision — Rule + model decision engine",
    "POST /outcome — Record fraud/legit outcomes",
    "GET /health — Model loaded status + version",
    "GET /metrics — Prometheus metrics export",
    "WS /ws — Live transaction push to dashboard",
  ],
  "Decision Logic (Priority Order)",
  [
    { text: "BLOCK: Critical merchant (>0.9) / Velocity cap (>100/min) / Score >0.95", bold: false },
    { text: "CHALLENGE: Score >0.7 / Impossible travel / New device + high amount", bold: false },
    { text: "REVIEW: Score >0.3 / Merchant hopping (>5/hr)", bold: false },
    { text: "APPROVE: Default for everything else", bold: true },
  ],
  { dark: true }
);

// ==========================================
// SLIDE 8: ML MODEL & EXPLAINABILITY
// ==========================================
addContentSlide(
  "ML Model: LightGBM → ONNX + SHAP",
  [
    { text: "Trained on 100k synthetic transactions (5% fraud rate from generator)", bold: true },
    { text: "LightGBM chosen for speed + tabular performance" },
    { text: "Exported to ONNX — runs anywhere, no Python dependency in prod" },
    { text: "ONNX Runtime inference: <3ms per transaction" },
    { text: "SHAP TreeExplainer provides per-transaction feature attribution" },
    { text: "/explain endpoint returns top 3 drivers + full SHAP dict" },
    { text: "Dashboard shows waterfall chart for every HIGH risk transaction" },
    { text: "Model versioning + A/B testing framework built in" },
    { text: "Rule-based fallback activates automatically if model fails to load" },
  ],
  { stat: { value: "<3ms", label: "ONNX Inference", color: COLORS.purple, x: 6.5, y: 1.5, size: 38 } }
);

// ==========================================
// SLIDE 9: DEMO SCENARIOS (1/2)
// ==========================================
addTwoColumnSlide(
  "Three Attack Scenarios (Live Demo)",
  "Scenario 1: Fraud Ring",
  [
    "5 compromised users, 3 high-risk merchants",
    "ATM (6011), Electronics (5732), Jewelry (5094)",
    "High amounts ($500-$5000), rapid bursts",
    "Shared device fingerprints across users",
    "Expected: HIGH risk, BLOCK decisions",
  ],
  "Scenario 2: Account Takeover",
  [
    "Legitimate user in SF → suddenly NY → London → Tokyo",
    "New device fingerprint each location",
    "Impossible travel speed (>1000 km/h)",
    "High velocity, elevated amounts",
    "Expected: CHALLENGE → BLOCK progression",
  ],
  { dark: true }
);

// ==========================================
// SLIDE 10: DEMO SCENARIOS (2/2)
// ==========================================
addContentSlide(
  "Scenario 3: Card Testing / Enumeration",
  [
    { text: "50 stolen cards tested via botnet (20 test merchants)", bold: true },
    { text: "Micro-transactions: $0.50 - $5.00 (fly under radar)" },
    { text: "10-50 attempts per card across different MCCs" },
    { text: "Shared botnet device fingerprints (10 devices)" },
    { text: "Same IP range (203.0.x.x) — coordinated infrastructure" },
    { text: "Goal: Find valid cards before large fraud purchases" },
    { text: "Expected: MEDIUM → HIGH risk, REVIEW queue buildup" },
  ],
  { dark: true, stat: { value: "50", label: "Cards Tested", color: COLORS.red, x: 6.5, y: 1.5, size: 38 } }
);

// ==========================================
// SLIDE 11: DASHBOARD UX
// ==========================================
addContentSlide(
  "React Dashboard: Real-Time Operator View",
  [
    { text: "Live transaction stream with risk badges (LOW/MEDIUM/HIGH)", bold: true },
    { text: "Risk gauge + SHAP factor chips for current transaction" },
    { text: "Geo map: Circle markers colored by risk level" },
    { text: "Throughput (area), Latency p95/p99 (line), Risk distribution (pie)" },
    { text: "Feature drift monitoring: amount z-score, velocity, geo, device trust" },
    { text: "Analyst Review Queue: CHALLENGE/APPROVE actions per transaction" },
    { text: "Attack Scenario Launcher: One-click fraud ring / ATO / card testing" },
    { text: "WebSocket connection status + model health indicator" },
    { text: "Responsive dark theme — projector ready" },
  ],
  { dark: true, stat: { value: "WS", label: "Live Push", color: COLORS.cyan, x: 6.5, y: 1.5, size: 38 } }
);

// ==========================================
// SLIDE 12: OBSERVABILITY (GRAFANA)
// ==========================================
addContentSlide(
  "Grafana: Single Pane of Glass",
  [
    { text: "Pre-provisioned 'Anomaly Engine Overview' dashboard (14 panels)", bold: true },
    { text: "Throughput + Scorer latency (p95/p99) time series" },
    { text: "Score request rate + Kafka topic offsets" },
    { text: "Decision actions rate: APPROVE/CHALLENGE/BLOCK/REVIEW" },
    { text: "Block rate % + Device trust distribution (pie)" },
    { text: "Max impossible travel speed (stat)" },
    { text: "Model Precision + False Positive Rate (RisingWave SQL)" },
    { text: "Feature drift monitoring (6hr window): z-score, speed, merchant risk" },
    { text: "WebSocket connections active" },
    { text: "Prometheus alerts: latency >50ms, throughput drop, risk spike" },
  ],
  { dark: true, stat: { value: "14", label: "Dashboard Panels", color: COLORS.purple, x: 6.5, y: 1.5, size: 38 } }
);

// ==========================================
// SLIDE 13: TECH STACK
// ==========================================
addTwoColumnSlide(
  "Production-Grade Tech Stack",
  "Streaming & Compute",
  [
    "RisingWave v1.10 — Streaming SQL, materialized views",
    "Redpanda (Kafka API) — Message streaming",
    "PostgreSQL 16 — Decisions, outcomes, reference data",
    "FastAPI + ONNX Runtime — Model serving",
  ],
  "Frontend & Ops",
  [
    "React 18 + Vite + Recharts + Leaflet",
    "WebSocket (native) — Live push",
    "Prometheus + Grafana — Metrics & dashboards",
    "Docker Compose — One-command deploy",
  ],
  { dark: true }
);

// ==========================================
// SLIDE 14: WHY THIS WINS
// ==========================================
addContentSlide(
  "Why This Wins the Hackathon",
  [
    { text: "✅ WORKING END-TO-END: docker-compose up → live in <2 minutes", bold: true },
    { text: "✅ REAL STREAMING: Not batch — features computed incrementally per event" },
    { text: "✅ SUB-50MS LATENCY: Measured, not claimed — Grafana proves it" },
    { text: "✅ EXPLAINABLE AI: SHAP values per transaction, not black box" },
    { text: "✅ ATTACK REALISM: 3 distinct fraud patterns, not synthetic noise" },
    { text: "✅ OBSERVABILITY BUILT-IN: Prometheus + Grafana, not an afterthought" },
    { text: "✅ OPERATOR UX: Analyst queue, geo map, drill-down — not just charts" },
    { text: "✅ RESILIENT: Rule fallback, WS reconnection, health endpoints" },
    { text: "✅ TECHNICAL DEPTH: RisingWave SQL, ONNX, feature engineering — ready for Q&A" },
  ],
  { dark: true }
);

// ==========================================
// SLIDE 15: FUTURE ROADMAP
// ==========================================
addTwoColumnSlide(
  "Roadmap: From Hackathon to Production",
  "Immediate (Post-Hackathon)",
  [
    "Train on real labeled data (not synthetic)",
    "Add feature store (Feast) for offline/online parity",
    "Implement model retraining pipeline (outcomes → features → train)",
    "Add canary deployment for model versions",
  ],
  "Scale & Harden",
  [
    "Horizontal Scorer scaling (stateless, K8s HPA)",
    "RisingWave cluster mode (HA, exactly-once)",
    "Kafka exactly-once + transactional outbox",
    "RBAC + audit logging for analyst actions",
    "PCI-DSS compliance, encryption at rest/in-transit",
  ],
  { dark: true }
);

// ==========================================
// SLIDE 16: CLOSING
// ==========================================
const closingSlide = pres.addSlide();
closingSlide.background = { color: COLORS.bgDark };

closingSlide.addText("Anomaly Engine", {
  x: 1, y: 1.5, w: 8, h: 1,
  fontSize: 52,
  bold: true,
  color: COLORS.cyan,
  align: "center",
});

closingSlide.addText("Real-Time Fraud Detection That Actually Works", {
  x: 1, y: 2.5, w: 8, h: 0.8,
  fontSize: 22,
  color: COLORS.textMutedDark,
  align: "center",
});

closingSlide.addText("Live Demo: http://localhost:5173", {
  x: 1, y: 3.5, w: 8, h: 0.6,
  fontSize: 18,
  color: COLORS.green,
  align: "center",
});

closingSlide.addText("Grafana: http://localhost:3000  |  API: http://localhost:8000/docs", {
  x: 1, y: 4.1, w: 8, h: 0.5,
  fontSize: 14,
  color: COLORS.textMutedDark,
  align: "center",
});

closingSlide.addText("Thank You — Questions?", {
  x: 1, y: 4.8, w: 8, h: 0.5,
  fontSize: 18,
  color: COLORS.orange,
  align: "center",
});

// ==========================================
// WRITE
// ==========================================
const outputPath = "Anomaly_Engine_Hackathon_Presentation.pptx";
pres.writeFile({ fileName: outputPath }).then(() => {
  console.log(`✅ Presentation saved to ${outputPath}`);
}).catch(err => {
  console.error("Error:", err);
});