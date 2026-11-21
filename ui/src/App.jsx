import { useState, useEffect, useRef } from 'react'
import {
  Activity, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Zap, Shield,
  Users, CreditCard, MapPin, Cpu,
  RefreshCw, ChevronDown, ChevronUp,
  Gauge, Map, AlertCircle, CheckCircle2,
  Loader2, Wifi, WifiOff, Brain, Target,
  ShieldAlert, Play, Stop, Users as UsersIcon, Zap as ZapIcon
} from 'lucide-react'
import AttackScenarioPanel from './AttackScenarioPanel'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar,
  RadialBarChart, RadialBar
} from 'recharts'
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'

// Risk level colors
const riskColors = {
  LOW: '#22c55e',
  MEDIUM: '#eab308',
  HIGH: '#ef4444',
}

const riskIcons = {
  LOW: CheckCircle,
  MEDIUM: AlertTriangle,
  HIGH: XCircle,
}

// ==========================================
// COMPONENTS
// ==========================================

function StatCard({ title, value, icon: Icon, trend, color = '#3b82f6' }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <Icon className="stat-icon" style={{ color }} size={20} />
        <span className="stat-title">{title}</span>
      </div>
      <div className="stat-value">{value}</div>
      {trend && (
        <div className={`stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
          <TrendingUp size={12} /> {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
        </div>
      )}
    </div>
  )
}

function RiskBadge({ level }) {
  const Icon = riskIcons[level] || AlertTriangle
  const color = riskColors[level] || '#6b7280'
  return (
    <span className="risk-badge" style={{ backgroundColor: `${color}20`, color, borderColor: `${color}40` }}>
      <Icon size={12} /> {level}
    </span>
  )
}

function RiskGauge({ score, riskLevel }) {
  const color = riskColors[riskLevel] || '#6b7280'
  return (
    <div className="gauge-container">
      <RadialBarChart width={150} height={150} data={[{ value: Math.round(score * 100) }]}>
        <RadialBar
          minAngle=-90
          maxAngle=90
          innerRadius="60%"
          outerRadius="80%"
          dataKey="value"
          stroke={color}
          fill={color}
          background={{ stroke: '#374151', strokeWidth: 8 }}
        >
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#f1f5f9" fontSize="24" fontWeight="bold">
            {Math.round(score * 100)}%
          </text>
        </RadialBar>
      </RadialBarChart>
      <div className="gauge-label" style={{ color }}>{riskLevel} RISK</div>
    </div>
  )
}

function SHAPReasonChips({ shapValues }) {
  if (!shapValues || Object.keys(shapValues).length === 0) return null

  const sorted = Object.entries(shapValues)
    .sort(([,a], [,b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 5)

  return (
    <div className="shap-chips">
      <Brain size={14} className="shap-icon" />
      <span className="shap-label">Top Factors:</span>
      {sorted.map(([feature, value]) => (
        <span key={feature} className={`shap-chip ${value > 0 ? 'positive' : 'negative'}`}>
          {feature}: {value > 0 ? '+' : ''}{value.toFixed(3)}
        </span>
      ))}
    </div>
  )
}

function TransactionRow({ txn }) {
  return (
    <tr className="txn-row">
      <td className="txn-id">{txn.txn_id?.slice(0, 8)}...</td>
      <td>{txn.user_id?.slice(0, 8)}...</td>
      <td className="txn-amount">${txn.amount?.toFixed(2) || '0.00'}</td>
      <td><RiskBadge level={txn.risk_level || 'LOW'} /></td>
      <td className="txn-reasons">{txn.reason_codes?.join(', ') || 'normal'}</td>
      <td className="txn-time">{txn.timestamp ? new Date(txn.timestamp).toLocaleTimeString() : 'N/A'}</td>
    </tr>
  )
}

function ThroughputChart({ data }) {
  return (
    <div className="chart-container">
      <h3>Transaction Throughput (txns/sec)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorThroughput" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#f3f4f6' }} />
          <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorThroughput)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function LatencyChart({ data }) {
  return (
    <div className="chart-container">
      <h3>Scorer Latency (p95 / p99)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#f3f4f6' }} />
          <Line type="monotone" dataKey="p95" stroke="#22c55e" strokeWidth={2} dot={false} name="p95" />
          <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} dot={false} name="p99" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function RiskDistributionChart({ data }) {
  const COLORS = ['#22c55e', '#eab308', '#ef4444']
  return (
    <div className="chart-container">
      <h3>Risk Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function FeatureDriftChart({ data }) {
  return (
    <div className="chart-container">
      <h3>Feature Drift (Amount Z-Score)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
          <YAxis dataKey="name" type="category" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} width={100} />
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GeoMap({ transactions }) {
  const validTxns = transactions.filter(t => t.lat && t.lon && !isNaN(t.lat) && !isNaN(t.lon))

  if (validTxns.length === 0) {
    return (
      <div className="chart-container map-container">
        <h3>Live Transaction Map</h3>
        <div className="map-placeholder">Waiting for transactions with geo data...</div>
      </div>
    )
  }

  return (
    <div className="chart-container map-container">
      <h3>Live Transaction Map</h3>
      <MapContainer center={[39.8283, -98.5795]} zoom={4} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
        {validTxns.slice(0, 50).map((txn) => (
          <CircleMarker
            key={txn.txn_id}
            center={[txn.lat, txn.lon]}
            radius={8}
            color={riskColors[txn.risk_level] || '#6b7280'}
            fillOpacity={0.8}
            stroke={true}
            weight={1}
          >
            <Popup>
              <div className="map-popup">
                <strong>{txn.txn_id?.slice(0, 12)}...</strong><br/>
                ${txn.amount?.toFixed(2)} • {txn.risk_level}<br/>
                {txn.reason_codes?.join(', ')}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

function AnalystQueue({ transactions, onAction }) {
  const reviewTxns = transactions.filter(t => t.risk_level === 'HIGH' || t.risk_level === 'MEDIUM').slice(0, 20)

  return (
    <div className="chart-container">
      <h3>Analyst Review Queue</h3>
      {reviewTxns.length === 0 ? (
        <div className="empty-state">No transactions pending review</div>
      ) : (
        <div className="queue-table-container">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>TXN ID</th>
                <th>Amount</th>
                <th>Risk</th>
                <th>Reasons</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviewTxns.map((txn, i) => (
                <tr key={i} className="txn-row">
                  <td className="txn-id">{txn.txn_id?.slice(0, 8)}...</td>
                  <td className="txn-amount">${txn.amount?.toFixed(2)}</td>
                  <td><RiskBadge level={txn.risk_level} /></td>
                  <td className="txn-reasons">{txn.reason_codes?.join(', ')}</td>
                  <td className="queue-actions">
                    <button className="btn-challenge" onClick={() => onAction(txn.txn_id, 'CHALLENGE')}>
                      <AlertCircle size={14} /> Challenge
                    </button>
                    <button className="btn-approve" onClick={() => onAction(txn.txn_id, 'APPROVE')}>
                      <CheckCircle2 size={14} /> Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConnectionStatus({ connected, modelLoaded }) {
  return (
    <div className="header-center">
      <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
        <span className="status-dot" />
        {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
        {connected ? 'Live Stream' : 'Disconnected'}
      </div>
      <div className="health-status">
        <span className={modelLoaded ? 'healthy' : 'degraded'}>
          {modelLoaded ? <CheckCircle size={12} /> : <Cpu size={12} />}
          {modelLoaded ? 'Model Loaded' : 'Rule-Based Mode'}
        </span>
      </div>
    </div>
  )
}

// ==========================================
// MAIN APP
// ==========================================
function App() {
  const [health, setHealth] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [stats, setStats] = useState({
    throughput: 0,
    latency_p95: 0,
    latency_p99: 0,
    total_scored: 0,
    risk_distribution: { LOW: 0, MEDIUM: 0, HIGH: 0 },
  })
  const [charts, setCharts] = useState({
    throughput: [],
    latency: [],
    risk_dist: [],
    drift: [],
  })
  const [ws, setWs] = useState(null)
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [queueExpanded, setQueueExpanded] = useState(true)
  const [activeScenario, setActiveScenario] = useState(null)
  const reconnectTimeoutRef = useRef(null)
  const wsUrlRef = useRef(WS_URL)

  // Attack scenario handlers
  const handleScenarioStart = async (scenarioId) => {
    setActiveScenario(scenarioId)
    // The actual attack scripts run on the generator container
    // Here we just update UI state - the backend handles the actual attack
    try {
      const response = await fetch(`${API_URL}/scenario/${scenarioId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error('Failed to start scenario')
    } catch (err) {
      console.error('Failed to start scenario:', err)
    }
  }

  const handleScenarioStop = async (scenarioId) => {
    setActiveScenario(null)
    try {
      const response = await fetch(`${API_URL}/scenario/${scenarioId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error('Failed to stop scenario')
    } catch (err) {
      console.error('Failed to stop scenario:', err)
    }
  }

  // Mock data generator (fallback when WS disconnected)
  const generateMockData = () => {
    const now = Date.now()
    const throughputData = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(now - (19 - i) * 3000).toLocaleTimeString(),
      value: Math.floor(Math.random() * 50) + 50,
    }))

    const latencyData = Array.from({ length: 20 }, (_, i) => ({
      time: new Date(now - (19 - i) * 3000).toLocaleTimeString(),
      p95: (Math.random() * 20 + 10).toFixed(1),
      p99: (Math.random() * 50 + 30).toFixed(1),
    }))

    const riskDist = [
      { name: 'LOW', value: Math.floor(Math.random() * 50) + 60 },
      { name: 'MEDIUM', value: Math.floor(Math.random() * 30) + 10 },
      { name: 'HIGH', value: Math.floor(Math.random() * 20) + 1 },
    ]

    const driftData = [
      { name: 'amount_zscore', value: (Math.random() * 2).toFixed(2) },
      { name: 'velocity_1m', value: (Math.random() * 1.5).toFixed(2) },
      { name: 'geo_speed', value: (Math.random() * 3).toFixed(2) },
      { name: 'device_trust', value: (Math.random() * 1).toFixed(2) },
    ]

    setCharts({ throughput: throughputData, latency: latencyData, risk_dist: riskDist, drift: driftData })
    setStats({
      throughput: throughputData[throughputData.length - 1].value,
      latency_p95: parseFloat(latencyData[latencyData.length - 1].p95),
      latency_p99: parseFloat(latencyData[latencyData.length - 1].p99),
      total_scored: Math.floor(Math.random() * 10000) + 50000,
      risk_distribution: { LOW: riskDist[0].value, MEDIUM: riskDist[1].value, HIGH: riskDist[2].value },
    })
  }

  // Fetch health on mount
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/health`)
        const data = await res.json()
        setHealth(data)
      } catch (e) {
        setHealth({ status: 'unhealthy', model_loaded: false })
      }
    }
    fetchHealth()
    generateMockData()
    const interval = setInterval(generateMockData, 3000)
    return () => clearInterval(interval)
  }, [])

  // WebSocket connection
  const connectWebSocket = () => {
    try {
      const websocket = new WebSocket(wsUrlRef.current)
      websocket.onopen = () => {
        setConnected(true)
        console.log('WebSocket connected')
      }
      websocket.onclose = () => {
        setConnected(false)
        console.log('WebSocket disconnected, reconnecting in 3s...')
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000)
      }
      websocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'SCORE_RESULT' && msg.payload) {
            const txn = msg.payload
            setTransactions(prev => [txn, ...prev].slice(0, 100))

            // Update stats from real data
            setStats(prev => ({
              ...prev,
              total_scored: prev.total_scored + 1,
              risk_distribution: {
                ...prev.risk_distribution,
                [txn.risk_level]: (prev.risk_distribution[txn.risk_level] || 0) + 1
              }
            }))
          }
        } catch (e) {
          console.error('WS message parse error:', e)
        }
      }
      websocket.onerror = (err) => {
        console.error('WebSocket error:', err)
      }
      setWs(websocket)
    } catch (e) {
      console.log('WebSocket not available, using mock data')
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000)
    }
  }

  useEffect(() => {
    connectWebSocket()
    return () => {
      ws?.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [])

  // Handle analyst actions
  const handleAnalystAction = async (txnId, action) => {
    try {
      await fetch(`${API_URL}/outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txn_id: txnId, decision_id: 'mock', outcome: action === 'CHALLENGE' ? 'FRAUD' : 'LEGIT', analyst_id: 'dashboard' })
      })
      // Remove from queue
      setTransactions(prev => prev.filter(t => t.txn_id !== txnId))
    } catch (e) {
      console.error('Action failed:', e)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <Zap size={28} className="logo-icon" />
            <span className="logo-text">Anomaly Engine</span>
          </div>
          <span className="badge hackathon">HACKATHON DEMO</span>
        </div>
        <ConnectionStatus connected={connected} modelLoaded={health?.model_loaded} />
        <div className="header-right">
          <button className="refresh-btn" onClick={generateMockData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      {/* Attack Scenario Launcher - Top Panel */}
      <section className="attack-section">
        <AttackScenarioPanel
          onScenarioStart={handleScenarioStart}
          onScenarioStop={handleScenarioStop}
          activeScenario={activeScenario}
        />
      </section>

      <main className="main">
        {/* Stats Grid */}
        <section className="stats-grid">
          <StatCard title="Throughput" value={`${stats.throughput}/sec`} icon={Activity} color="#3b82f6" trend={Math.random() * 10 - 5} />
          <StatCard title="p95 Latency" value={`${stats.latency_p95.toFixed(1)}ms`} icon={TrendingUp} color="#22c55e" trend={Math.random() * 5 - 2.5} />
          <StatCard title="p99 Latency" value={`${stats.latency_p99.toFixed(1)}ms`} icon={TrendingDown} color="#ef4444" trend={Math.random() * 5 - 2.5} />
          <StatCard title="Total Scored" value={stats.total_scored.toLocaleString()} icon={CreditCard} color="#8b5cf6" />
          <StatCard title="High Risk" value={stats.risk_distribution.HIGH} icon={AlertTriangle} color="#ef4444" />
          <StatCard title="Active Users" value={Math.floor(Math.random() * 500) + 100} icon={Users} color="#06b6d4" />
        </section>

        {/* Gauge + Map Row */}
        <section className="charts-row">
          <div className="chart-container">
            <h3>Current Risk Score</h3>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <RiskGauge score={transactions[0]?.score || 0.15} riskLevel={transactions[0]?.risk_level || 'LOW'} />
            </div>
            {transactions[0] && <SHAPReasonChips shapValues={transactions[0].shap_values} />}
          </div>
          <GeoMap transactions={transactions} />
        </section>

        {/* Charts Row 1 */}
        <section className="charts-row">
          <ThroughputChart data={charts.throughput} />
          <LatencyChart data={charts.latency} />
        </section>

        {/* Charts Row 2 */}
        <section className="charts-row">
          <RiskDistributionChart data={charts.risk_dist} />
          <FeatureDriftChart data={charts.drift} />
        </section>

        {/* Analyst Queue */}
        <section className="transactions-section">
          <div className="section-header">
            <h2>Analyst Review Queue</h2>
            <button className="expand-btn" onClick={() => setQueueExpanded(!queueExpanded)}>
              {queueExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {queueExpanded && <AnalystQueue transactions={transactions} onAction={handleAnalystAction} />}
        </section>

        {/* Recent Transactions */}
        <section className="transactions-section">
          <div className="section-header">
            <h2>Recent Transactions</h2>
            <button className="expand-btn" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          {expanded && (
            <div className="transactions-table-container">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>TXN ID</th>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Risk</th>
                    <th>Reasons</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((txn, i) => (
                    <TransactionRow key={i} txn={txn} />
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-state">Waiting for transactions...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <div className="footer-links">
          <a href="http://localhost:8000/docs" target="_blank" rel="noopener noreferrer">Scorer API Docs</a>
          <a href="http://localhost:3000" target="_blank" rel="noopener noreferrer">Grafana Dashboard</a>
          <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer">Prometheus</a>
          <a href="http://localhost:8082" target="_blank" rel="noopener noreferrer">Kafka UI (if running)</a>
        </div>
        <p>Real-Time Transaction Anomaly Engine — College Hackathon Project</p>
      </footer>
    </div>
  )
}

export default App