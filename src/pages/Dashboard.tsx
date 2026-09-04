import { useState, useEffect } from 'react'
import { Shield, TriangleAlert as AlertTriangle, Crosshair, FileCode2, TrendingUp, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { IOCRecord, ReconTask, DetectionRule } from '../lib/types'

export default function Dashboard() {
  const [stats, setStats] = useState({ iocCount: 0, highRiskCount: 0, reconCount: 0, rulesCount: 0 })
  const [recentIOCs, setRecentIOCs] = useState<IOCRecord[]>([])
  const [recentRecon, setRecentRecon] = useState<ReconTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    try {
      const [iocRes, reconRes, rulesRes] = await Promise.all([
        supabase.from('ioc_records').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('recon_tasks').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('detection_rules').select('*').order('created_at', { ascending: false }).limit(5),
      ])
      const iocs = (iocRes.data as IOCRecord[]) || []
      const recon = (reconRes.data as ReconTask[]) || []
      const rules = (rulesRes.data as DetectionRule[]) || []
      setStats({
        iocCount: iocs.length,
        highRiskCount: iocs.filter((i) => i.risk_score >= 70).length,
        reconCount: recon.length,
        rulesCount: rules.length,
      })
      setRecentIOCs(iocs)
      setRecentRecon(recon)
    } catch { /* empty tables fine */ } finally { setLoading(false) }
  }

  if (loading) return <div className="loading">Loading dashboard...</div>

  return (
    <>
      <div className="topbar">
        <h2>Dashboard</h2>
        <div className="status"><span className="status-dot"></span>System Operational</div>
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
            <div className="stat-label">Recon Tasks</div>
            <div className="stat-value purple">{stats.reconCount}</div>
          </div>
          <div className="stat">
            <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)' }}><FileCode2 size={20} color="var(--green)" /></div>
            <div className="stat-label">Detection Rules</div>
            <div className="stat-value green">{stats.rulesCount}</div>
          </div>
        </div>
        <div className="grid grid-2">
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
      </div>
    </>
  )
}
