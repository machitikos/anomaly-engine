import { useState, useEffect } from 'react'
import {
  Activity, AlertTriangle, CheckCircle, XCircle,
  TrendingUp, TrendingDown, Zap, Shield,
  Users, CreditCard, MapPin, Cpu,
  RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'
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
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
          />
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
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
            labelStyle={{ color: '#f3f4f6' }}
          />
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
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
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
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
          />
          <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

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

  // Mock data generators for demo
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

    setCharts({
      throughput: throughputData,
      latency: latencyData,
      risk_dist: riskDist,
      drift: driftData,
    })

    setStats({
      throughput: throughputData[throughputData.length - 1].value,
      latency_p95: parseFloat(latencyData[latencyData.length - 1].p95),
      latency_p99: parseFloat(latencyData[latencyData.length - 1].p99),
      total_scored: Math.floor(Math.random() * 10000) + 50000,
      risk_distribution: {
        LOW: riskDist[0].value,
        MEDIUM: riskDist[1].value,
        HIGH: riskDist[2].value,
      },
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

  // WebSocket connection for real-time updates
  useEffect(() => {
    try {
      const websocket = new WebSocket(WS_URL)
      websocket.onopen = () => setConnected(true)
      websocket.onclose = () => setConnected(false)
      websocket.onmessage = (event) => {
        const txn = JSON.parse(event.data)
        setTransactions(prev => [txn, ...prev].slice(0, 50))
      }
      setWs(websocket)
    } catch (e) {
      console.log('WebSocket not available, using polling')
    }
    return () => ws?.close()
  }, [])

  // Simulate new transactions for demo
  useEffect(() => {
    const interval = setInterval(() => {
      const riskLevels = ['LOW', 'MEDIUM', 'HIGH']
      const reasons = [
        ['normal'],
        ['unusual_amount'],
        ['impossible_travel'],
        ['new_device'],
        ['high_velocity'],
        ['unusual_amount', 'new_device'],
      ]
      const risk = riskLevels[Math.floor(Math.random() * riskLevels.length)]
      const reason = reasons[Math.floor(Math.random() * reasons.length)]

      const newTxn = {
        txn_id: `txn_${Math.random().toString(36).substr(2, 9)}`,
        user_id: `user_${Math.floor(Math.random() * 1000)}`,
        amount: Math.random() * 5000,
        risk_level: risk,
        reason_codes: reason,
        score: risk === 'HIGH' ? 0.8 + Math.random() * 0.2 : risk === 'MEDIUM' ? 0.4 + Math.random() * 0.3 : Math.random() * 0.3,
        timestamp: new Date().toISOString(),
      }
      setTransactions(prev => [newTxn, ...prev].slice(0, 50))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

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
        <div className="header-center">
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            <span className="status-dot" />
            {connected ? 'Live Stream' : 'Simulated'}
          </div>
          <div className="health-status">
            <span className={health?.model_loaded ? 'healthy' : 'degraded'}>
              {health?.model_loaded ? <CheckCircle size={12} /> : <Cpu size={12} />}
              {health?.model_loaded ? 'Model Loaded' : 'Rule-Based Mode'}
            </span>
          </div>
        </div>
        <div className="header-right">
          <button className="refresh-btn" onClick={generateMockData}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      <main className="main">
        {/* Stats Grid */}
        <section className="stats-grid">
          <StatCard
            title="Throughput"
            value={`${stats.throughput}/sec`}
            icon={Activity}
            color="#3b82f6"
            trend={Math.random() * 10 - 5}
          />
          <StatCard
            title="p95 Latency"
            value={`${stats.latency_p95.toFixed(1)}ms`}
            icon={TrendingUp}
            color="#22c55e"
            trend={Math.random() * 5 - 2.5}
          />
          <StatCard
            title="p99 Latency"
            value={`${stats.latency_p99.toFixed(1)}ms`}
            icon={TrendingDown}
            color="#ef4444"
            trend={Math.random() * 5 - 2.5}
          />
          <StatCard
            title="Total Scored"
            value={stats.total_scored.toLocaleString()}
            icon={CreditCard}
            color="#8b5cf6"
          />
          <StatCard
            title="High Risk"
            value={stats.risk_distribution.HIGH}
            icon={AlertTriangle}
            color="#ef4444"
          />
          <StatCard
            title="Active Users"
            value={Math.floor(Math.random() * 500) + 100}
            icon={Users}
            color="#06b6d4"
          />
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
          <a href="http://localhost:8082" target="_blank" rel="noopener noreferrer">Redpanda Console</a>
        </div>
        <p>Real-Time Transaction Anomaly Engine — College Hackathon Project</p>
      </footer>
    </div>
  )
}

export default App