import { useState, useEffect, useRef } from 'react'
import { Shield, TriangleAlert as AlertTriangle, Crosshair, FileCode2, TrendingUp, Search, Activity, Zap, Globe, Server, Radio } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

interface IOCRecord { id: string; ioc_value: string; ioc_type: string; risk_score: number; metadata: Record<string, unknown>; tags: string[]; status: string; created_at: string; updated_at: string }
interface ReconTask { id: string; task_id: string; target: string; modules: string[]; status: string; progress: number; results: Record<string, unknown>; error: string | null; created_at: string; updated_at: string; completed_at: string | null }
interface DetectionRule { id: string; title: string; description: string | null; rule_format: string; rule_content: string; severity: 'low' | 'medium' | 'high' | 'critical'; status: 'test' | 'stable' | 'deprecated'; author: string; created_at: string; updated_at: string }
interface ActivityLog { id: string; event_type: string; severity: string; title: string; description: string | null; source: string; metadata: Record<string, unknown>; created_at: string }
interface ThreatIntel { id: string; feed_name: string; indicator_value: string; indicator_type: string; threat_type: string | null; confidence: number; description: string | null; is_active: boolean; first_seen: string; last_seen: string }

const severityColors: Record<string, string> = { info: 'badge-info', low: 'badge-low', medium: 'badge-medium', high: 'badge-high', critical: 'badge-critical' }
const severityDotColors: Record<string, string> = { info: 'var(--accent)', low: 'var(--green)', medium: 'var(--yellow)', high: 'var(--orange)', critical: 'var(--red)' }

export default function Dashboard() {
  const [stats, setStats] = useState({ iocCount: 0, highRiskCount: 0, reconCount: 0, rulesCount: 0, threatCount: 0, activeThreats: 0 })
  const [recentIOCs, setRecentIOCs] = useState<IOCRecord[]>([])
  const [recentRecon, setRecentRecon] = useState<ReconTask[]>([])
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [threatFeeds, setThreatFeeds] = useState<ThreatIntel[]>([])
  const [loading, setLoading] = useState(true)
  const [livePulse, setLivePulse] = useState(false)
  const activityRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadAllData()
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ioc_records' }, () => { loadStats(); setLivePulse(true); setTimeout(() => setLivePulse(false), 1000) })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recon_tasks' }, () => { loadStats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'detection_rules' }, () => { loadStats() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threat_intelligence' }, () => { loadStats(); loadActivity() })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setActivityLogs((prev) => [payload.new as ActivityLog, ...prev].slice(0, 20))
        setLivePulse(true)
        setTimeout(() => setLivePulse(false), 1000)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadAllData() {
    await Promise.all([loadStats(), loadActivity()])
    setLoading(false)
  }

  async function loadStats() {
    try {
      const [iocRes, reconRes, rulesRes, tiRes] = await Promise.all([
        supabase.from('ioc_records').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('recon_tasks').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('detection_rules').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('threat_intelligence').select('*').order('first_seen', { ascending: false }),
      ])
      const iocs = (iocRes.data as IOCRecord[]) || []
      const recon = (reconRes.data as ReconTask[]) || []
      const rules = (rulesRes.data as DetectionRule[]) || []
      const threats = (tiRes.data as ThreatIntel[]) || []
      setStats({
        iocCount: iocs.length,
        highRiskCount: iocs.filter((i) => i.risk_score >= 70).length,
        reconCount: recon.length,
        rulesCount: rules.length,
        threatCount: threats.length,
        activeThreats: threats.filter((t) => t.is_active).length,
      })
      setRecentIOCs(iocs)
      setRecentRecon(recon)
      setThreatFeeds(threats)
    } catch { /* empty tables fine */ }
  }

  async function loadActivity() {
    try {
      const { data } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(20)
      setActivityLogs((data as ActivityLog[]) || [])
    } catch { /* fine */ }
  }

  const threatLevel = stats.activeThreats >= 10 ? { label: 'CRITICAL', color: 'var(--red)' } : stats.activeThreats >= 5 ? { label: 'ELEVATED', color: 'var(--orange)' } : stats.activeThreats >= 1 ? { label: 'GUARDED', color: 'var(--yellow)' } : { label: 'LOW', color: 'var(--green)' }
  const iocTypeBreakdown = recentIOCs.reduce<Record<string, number>>((acc, ioc) => { acc[ioc.ioc_type] = (acc[ioc.ioc_type] || 0) + 1; return acc }, {})
  const maxTypeCount = Math.max(...Object.values(iocTypeBreakdown), 1)

  if (loading) return <div className="loading">Loading dashboard...</div>

  return (
    <>
      <div className="topbar">
        <h2>Dashboard</h2>
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <div className={`live-indicator ${livePulse ? 'pulse' : ''}`}><Radio size={12} /> LIVE</div>
          <div className="status"><span className="status-dot"></span>System Operational</div>
        </div>
      </div>
      <div className="content fade-in">
        <div className="grid grid-4 mb-24">
          <div className="stat">
            <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}><Crosshair size={20} color="var(--accent)" /></div>
            <div className="stat-label">IOCs Analyzed</div>
            <div className="stat-value blue">{stats.iocCount}</div>
          </div>
          <div className="stat">
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}><AlertTriangle size={20} color="var(--red)" /></div>
            <div className="stat-label">High Risk Threats</div>
            <div className="stat-value red">{stats.highRiskCount}</div>
          </div>
          <div className="stat">
            <div className="stat-icon" style={{ background: 'rgba(168,85,247,0.15)' }}><Shield size={20} color="var(--purple)" /></div>
            <div className="stat-label">Active Threats</div>
            <div className="stat-value purple">{stats.activeThreats}</div>
          </div>
          <div className="stat">
            <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)' }}><FileCode2 size={20} color="var(--green)" /></div>
            <div className="stat-label">Detection Rules</div>
            <div className="stat-value green">{stats.rulesCount}</div>
          </div>
        </div>

        <div className="grid grid-2 mb-24">
          <div className="card threat-level-card" style={{ borderColor: threatLevel.color }}>
            <div className="card-header"><h3>Threat Level</h3><Activity size={16} color={threatLevel.color} /></div>
            <div className="threat-level-display">
              <div className="threat-level-ring" style={{ borderColor: threatLevel.color }}>
                <span style={{ color: threatLevel.color, fontSize: 22, fontWeight: 800 }}>{threatLevel.label}</span>
              </div>
              <div className="threat-level-details">
                <div className="threat-level-row"><Globe size={14} color="var(--text-muted)" /><span>{stats.threatCount} total indicators</span></div>
                <div className="threat-level-row"><Zap size={14} color="var(--red)" /><span>{stats.activeThreats} active threats</span></div>
                <div className="threat-level-row"><Server size={14} color="var(--accent)" /><span>{stats.reconCount} recon operations</span></div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>IOC Type Distribution</h3><Crosshair size={16} color="var(--text-muted)" /></div>
            {Object.keys(iocTypeBreakdown).length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><Crosshair /><h4>No IOCs Yet</h4></div>
            ) : (
              <div className="flex gap-16" style={{ flexDirection: 'column' }}>
                {Object.entries(iocTypeBreakdown).map(([type, count]) => (
                  <div key={type}>
                    <div className="flex-between mb-16"><span className="mono">{type.toUpperCase()}</span><span className="text-muted text-sm">{count}</span></div>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(count / maxTypeCount) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-2 mb-24">
          <div className="card">
            <div className="card-header"><h3>Recent IOC Submissions</h3><TrendingUp size={16} color="var(--text-muted)" /></div>
            {recentIOCs.length === 0 ? (
              <div className="empty-state"><Crosshair /><h4>No IOCs Yet</h4><p>Submit an indicator from the IOC Analyzer</p></div>
            ) : (
              <table>
                <thead><tr><th>Value</th><th>Type</th><th>Risk</th><th>Date</th></tr></thead>
                <tbody>
                  {recentIOCs.map((ioc) => (
                    <tr key={ioc.id}>
                      <td className="mono">{ioc.ioc_value.length > 30 ? ioc.ioc_value.slice(0, 30) + '...' : ioc.ioc_value}</td>
                      <td><span className="badge badge-info">{ioc.ioc_type}</span></td>
                      <td><span className={`badge ${ioc.risk_score >= 70 ? 'badge-critical' : ioc.risk_score >= 40 ? 'badge-medium' : 'badge-low'}`}>{ioc.risk_score}</span></td>
                      <td className="text-muted">{new Date(ioc.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <div className="card-header"><h3>Recent Recon Tasks</h3><Search size={16} color="var(--text-muted)" /></div>
            {recentRecon.length === 0 ? (
              <div className="empty-state"><Search /><h4>No Recon Tasks</h4><p>Start reconnaissance from Attack Surface</p></div>
            ) : (
              <table>
                <thead><tr><th>Target</th><th>Modules</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {recentRecon.map((task) => (
                    <tr key={task.id}>
                      <td className="mono">{task.target}</td>
                      <td className="text-muted">{task.modules.join(', ')}</td>
                      <td><span className="badge badge-neutral">{task.status}</span></td>
                      <td className="text-muted">{new Date(task.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card" ref={activityRef}>
          <div className="card-header">
            <h3>Live Activity Feed</h3>
            <div className="flex gap-8" style={{ alignItems: 'center' }}>
              <span className={`live-dot ${livePulse ? 'pulse' : ''}`}></span>
              <span className="text-muted text-sm">Real-time</span>
            </div>
          </div>
          {activityLogs.length === 0 ? (
            <div className="empty-state"><Activity /><h4>No Activity Yet</h4><p>Security events will appear here in real-time</p></div>
          ) : (
            <div className="activity-feed">
              {activityLogs.map((log) => (
                <div key={log.id} className="activity-item">
                  <div className="activity-dot" style={{ background: severityDotColors[log.severity] || 'var(--accent)' }}></div>
                  <div className="activity-content">
                    <div className="flex-between">
                      <div className="flex gap-8" style={{ alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{log.title}</span>
                        <span className={`badge ${severityColors[log.severity] || 'badge-info'}`}>{log.severity}</span>
                      </div>
                      <span className="text-muted text-sm">{new Date(log.created_at).toLocaleTimeString()}</span>
                    </div>
                    {log.description && <p className="text-secondary text-sm" style={{ marginTop: 4 }}>{log.description}</p>}
                    <div className="text-muted text-sm" style={{ marginTop: 4, fontSize: 11 }}>Source: {log.source}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
