import { useState } from 'react'
import {
  AlertTriangle, Shield, CreditCard, Users, Zap, Loader2,
  CheckCircle, XCircle, Play, Stop, Target, ShieldAlert
} from 'lucide-react'

const SCENARIOS = [
  {
    id: 'account_takeover',
    name: 'Account Takeover (ATO)',
    description: 'Legitimate user suddenly transacts from new device/location at high velocity. Shows impossible travel (SF→NY→London→Tokyo).',
    icon: Users,
    color: '#ef4444',
    severity: 'HIGH',
    tags: ['Impossible Travel', 'New Device', 'High Velocity'],
    script: 'account_takeover.py'
  },
  {
    id: 'fraud_ring',
    name: 'Fraud Ring Attack',
    description: 'Coordinated fraud across multiple stolen cards at same merchants. Shows velocity spikes, shared devices, high amounts.',
    icon: CreditCard,
    color: '#f97316',
    severity: 'HIGH',
    tags: ['Velocity Spike', 'Shared Devices', 'Coordinated'],
    script: 'fraud_ring.py'
  },
  {
    id: 'card_testing',
    name: 'Card Testing / Enumeration',
    description: 'Attacker testing stolen card numbers with micro-transactions across many merchants. Shows low amounts, high velocity, botnet IPs.',
    icon: Zap,
    color: '#eab308',
    severity: 'MEDIUM',
    tags: ['Micro Transactions', 'Enumeration', 'Botnet'],
    script: 'card_testing.py'
  }
]

export function AttackScenarioPanel({ onScenarioStart, onScenarioStop, activeScenario }) {
  const [runningScenarios, setRunningScenarios] = useState(new Set())
  const [logs, setLogs] = useState([])

  const startScenario = async (scenario) => {
    setRunningScenarios(prev => new Set([...prev, scenario.id]))
    addLog(`🚀 Starting ${scenario.name}...`, 'info')

    try {
      await onScenarioStart(scenario.id)
      addLog(`✅ ${scenario.name} started successfully`, 'success')
    } catch (err) {
      addLog(`❌ Failed to start ${scenario.name}: ${err.message}`, 'error')
      setRunningScenarios(prev => {
        const next = new Set(prev)
        next.delete(scenario.id)
        return next
      })
    }
  }

  const stopScenario = async (scenario) => {
    addLog(`🛑 Stopping ${scenario.name}...`, 'warning')
    try {
      await onScenarioStop(scenario.id)
      setRunningScenarios(prev => {
        const next = new Set(prev)
        next.delete(scenario.id)
        return next
      })
      addLog(`✅ ${scenario.name} stopped`, 'success')
    } catch (err) {
      addLog(`❌ Failed to stop ${scenario.name}: ${err.message}`, 'error')
    }
  }

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-49), { timestamp, message, type }])
  }

  const isRunning = (id) => runningScenarios.has(id)

  return (
    <div className="attack-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Zap size={20} className="panel-icon" />
          <h2>Attack Scenario Launcher</h2>
          <span className="panel-subtitle">Launch live attack scenarios to test detection</span>
        </div>
        <div className="panel-status">
          {runningScenarios.size > 0 && (
            <span className="status-badge running">
              <Loader2 size={14} className="spin" />
              {runningScenarios.size} Running
            </span>
          )}
        </div>
      </div>

      <div className="scenarios-grid">
        {SCENARIOS.map((scenario) => (
          <div key={scenario.id} className={`scenario-card ${isRunning(scenario.id) ? 'running' : ''}`}>
            <div className="scenario-header">
              <div className="scenario-icon" style={{ backgroundColor: `${scenario.color}20`, color: scenario.color }}>
                <scenario.icon size={20} />
              </div>
              <div className="scenario-info">
                <h3>{scenario.name}</h3>
                <span className={`severity-badge ${scenario.severity.toLowerCase()}`}>{scenario.severity}</span>
              </div>
            </div>

            <p className="scenario-description">{scenario.description}</p>

            <div className="scenario-tags">
              {scenario.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>

            <div className="scenario-actions">
              {isRunning(scenario.id) ? (
                <button
                  className="btn-stop"
                  onClick={() => stopScenario(scenario)}
                  disabled={runningScenarios.has(scenario.id) && false}
                >
                  <Stop size={14} /> Stop Attack
                </button>
              ) : (
                <button
                  className="btn-start"
                  onClick={() => startScenario(scenario)}
                  style={{ backgroundColor: scenario.color, borderColor: scenario.color }}
                >
                  <Play size={14} /> Launch Attack
                </button>
              )}
            </div>

            {isRunning(scenario.id) && (
              <div className="running-indicator">
                <div className="pulse-ring"></div>
                <span>Attack Active - Generating Live Transactions</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Live Logs */}
      <div className="logs-section">
        <div className="logs-header">
          <h3><AlertTriangle size={16} /> Live Attack Logs</h3>
          <button className="btn-clear" onClick={() => setLogs([])}>Clear</button>
        </div>
        <div className="logs-container">
          {logs.length === 0 ? (
            <div className="logs-empty">No attack logs yet. Launch a scenario to see live activity...</div>
          ) : (
            logs.slice().reverse().map((log, i) => (
              <div key={i} className={`log-entry ${log.type}`}>
                <span className="log-time">{log.timestamp}</span>
                <span className="log-message">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-mini">
          <ShieldAlert size={20} color="#ef4444" />
          <div>
            <span className="stat-value">HIGH</span>
            <span className="stat-label">Alert Level</span>
          </div>
        </div>
        <div className="stat-mini">
          <Target size={20} color="#3b82f6" />
          <div>
            <span className="stat-value">{runningScenarios.size}</span>
            <span className="stat-label">Active Scenarios</span>
          </div>
        </div>
        <div className="stat-mini">
          <CreditCard size={20} color="#8b5cf6" />
          <div>
            <span className="stat-value">LIVE</span>
            <span className="stat-label">Detection Status</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AttackScenarioPanel