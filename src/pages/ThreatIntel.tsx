import { useState, useEffect } from 'react'
import { Database, Trash2, CircleAlert as AlertCircle, Plus, Radio, Search, Activity, Globe, Zap } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

interface ThreatIntel { id: string; feed_name: string; indicator_value: string; indicator_type: string; threat_type: string | null; confidence: number; description: string | null; metadata: Record<string, unknown>; first_seen: string; last_seen: string; is_active: boolean }

const threatTypeColors: Record<string, string> = { 'c2-server': 'badge-critical', 'malware': 'badge-critical', 'phishing': 'badge-high', 'botnet': 'badge-high', 'apt': 'badge-critical', 'ransomware': 'badge-critical', 'scanner': 'badge-medium', 'malware-distribution': 'badge-high' }

export default function ThreatIntel() {
  const [records, setRecords] = useState<ThreatIntel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ feed_name: 'CTIAS Internal Feed', indicator_value: '', indicator_type: 'ip', threat_type: 'malware', confidence: 50, description: '' })
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [livePulse, setLivePulse] = useState(false)

  useEffect(() => {
    loadRecords()
    const channel = supabase
      .channel('threatintel-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'threat_intelligence' }, (payload) => {
        setRecords((prev) => [payload.new as ThreatIntel, ...prev])
        setLivePulse(true); setTimeout(() => setLivePulse(false), 1000)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'threat_intelligence' }, (payload) => {
        setRecords((prev) => prev.filter((r) => r.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'threat_intelligence' }, (payload) => {
        setRecords((prev) => prev.map((r) => r.id === payload.new.id ? payload.new as ThreatIntel : r))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadRecords() {
    try { const { data } = await supabase.from('threat_intelligence').select('*').order('first_seen', { ascending: false }); setRecords((data as ThreatIntel[]) || []) } catch { /* */ } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!formData.indicator_value.trim()) { setError('Indicator value is required.'); return }
    try {
      const { error: insertError } = await supabase.from('threat_intelligence').insert({ feed_name: formData.feed_name, indicator_value: formData.indicator_value.trim(), indicator_type: formData.indicator_type, threat_type: formData.threat_type, confidence: formData.confidence, description: formData.description })
      if (insertError) throw insertError
      await supabase.from('activity_logs').insert({
        event_type: 'threat_detected',
        severity: formData.confidence >= 80 ? 'critical' : formData.confidence >= 60 ? 'high' : 'medium',
        title: `New Threat: ${formData.indicator_value.trim().slice(0, 40)}`,
        description: `Type: ${formData.threat_type}, Confidence: ${formData.confidence}%, Feed: ${formData.feed_name}`,
        source: 'Threat Intel',
        metadata: { indicator_type: formData.indicator_type, threat_type: formData.threat_type, confidence: formData.confidence } as Record<string, unknown>,
      })
      setFormData({ ...formData, indicator_value: '', description: '' }); setShowForm(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add threat intel.') }
  }

  async function handleDelete(id: string) { try { await supabase.from('threat_intelligence').delete().eq('id', id) } catch { /**/ } }

  async function toggleActive(ti: ThreatIntel) {
    try { await supabase.from('threat_intelligence').update({ is_active: !ti.is_active }).eq('id', ti.id) } catch { /**/ }
  }

  const filtered = records.filter((r) => {
    const matchesSearch = !search || r.indicator_value.includes(search) || r.feed_name.includes(search) || (r.description && r.description.includes(search))
    const matchesType = filterType === 'all' || r.indicator_type === filterType
    return matchesSearch && matchesType
  })

  const activeCount = records.filter((r) => r.is_active).length
  const criticalCount = records.filter((r) => r.confidence >= 80).length
  const feedCount = new Set(records.map((r) => r.feed_name)).size

  return (
    <>
      <div className="topbar">
        <h2>Threat Intelligence</h2>
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <div className={`live-indicator ${livePulse ? 'pulse' : ''}`}><Radio size={12} /> LIVE</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={16} />{showForm ? 'Cancel' : 'Add Indicator'}</button>
        </div>
      </div>
      <div className="content fade-in">
        <div className="grid grid-3 mb-24">
          <div className="stat"><div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)' }}><Zap size={20} color="var(--red)" /></div><div className="stat-label">Active Threats</div><div className="stat-value red">{activeCount}</div></div>
          <div className="stat"><div className="stat-icon" style={{ background: 'rgba(249,115,22,0.15)' }}><Globe size={20} color="var(--orange)" /></div><div className="stat-label">Total Indicators</div><div className="stat-value" style={{ color: 'var(--orange)' }}>{records.length}</div></div>
          <div className="stat"><div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)' }}><Activity size={20} color="var(--accent)" /></div><div className="stat-label">Threat Feeds</div><div className="stat-value blue">{feedCount}</div></div>
        </div>
        {showForm && (
          <div className="card mb-24 fade-in">
            <div className="card-header"><h3>Add Threat Intelligence Entry</h3></div>
            {error && <div className="alert alert-error"><AlertCircle size={14} /> {error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-2">
                <div className="form-group"><label>Feed Name</label><input type="text" value={formData.feed_name} onChange={(e) => setFormData({ ...formData, feed_name: e.target.value })} /></div>
                <div className="form-group"><label>Indicator Value</label><input type="text" value={formData.indicator_value} onChange={(e) => setFormData({ ...formData, indicator_value: e.target.value })} placeholder="e.g. 185.220.101.45" /></div>
                <div className="form-group"><label>Indicator Type</label><select value={formData.indicator_type} onChange={(e) => setFormData({ ...formData, indicator_type: e.target.value })}><option value="ip">IP</option><option value="domain">Domain</option><option value="url">URL</option><option value="md5">MD5</option><option value="sha1">SHA1</option><option value="sha256">SHA256</option><option value="email">Email</option></select></div>
                <div className="form-group"><label>Threat Type</label><select value={formData.threat_type} onChange={(e) => setFormData({ ...formData, threat_type: e.target.value })}><option value="malware">Malware</option><option value="c2-server">C2 Server</option><option value="phishing">Phishing</option><option value="scanner">Scanner</option><option value="malware-distribution">Malware Distribution</option><option value="apt">APT</option><option value="botnet">Botnet</option><option value="ransomware">Ransomware</option></select></div>
                <div className="form-group"><label>Confidence (0-100)</label><input type="number" min={0} max={100} value={formData.confidence} onChange={(e) => setFormData({ ...formData, confidence: parseInt(e.target.value) || 0 })} /></div>
                <div className="form-group"><label>Description</label><input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description" /></div>
              </div>
              <button type="submit" className="btn btn-primary">Add Entry</button>
            </form>
          </div>
        )}
        <div className="card threat-feed-card">
          <div className="card-header">
            <h3>Threat Intelligence Feed</h3>
            <div className="flex gap-8">
              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: 10 }} />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ paddingLeft: 32, width: 200, height: 34 }} />
              </div>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ width: 'auto', height: 34 }}>
                <option value="all">All Types</option>
                <option value="ip">IP</option><option value="domain">Domain</option><option value="url">URL</option>
                <option value="md5">MD5</option><option value="sha1">SHA1</option><option value="sha256">SHA256</option><option value="email">Email</option>
              </select>
            </div>
          </div>
          {loading ? <div className="loading">Loading...</div> : filtered.length === 0 ? (
            <div className="empty-state"><Database /><h4>No Threat Intel Entries</h4><p>Add indicators to build your threat intelligence database</p></div>
          ) : (
            <table>
              <thead><tr><th>Indicator</th><th>Type</th><th>Threat Type</th><th>Confidence</th><th>Feed</th><th>Description</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {filtered.map((ti) => (
                  <tr key={ti.id}>
                    <td className="mono">{ti.indicator_value.length > 25 ? ti.indicator_value.slice(0, 25) + '...' : ti.indicator_value}</td>
                    <td><span className="badge badge-info">{ti.indicator_type}</span></td>
                    <td><span className={`badge ${threatTypeColors[ti.threat_type || ''] || 'badge-neutral'}`}>{ti.threat_type || '-'}</span></td>
                    <td><span className={`badge ${ti.confidence >= 80 ? 'badge-critical' : ti.confidence >= 60 ? 'badge-high' : ti.confidence >= 40 ? 'badge-medium' : 'badge-low'}`}>{ti.confidence}%</span></td>
                    <td className="text-muted">{ti.feed_name}</td>
                    <td className="text-muted">{ti.description ? (ti.description.length > 40 ? ti.description.slice(0, 40) + '...' : ti.description) : '-'}</td>
                    <td><button className={`badge ${ti.is_active ? 'badge-critical' : 'badge-neutral'}`} onClick={() => toggleActive(ti)} style={{ cursor: 'pointer', border: 'none' }}>{ti.is_active ? 'Active' : 'Inactive'}</button></td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(ti.id)}><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
