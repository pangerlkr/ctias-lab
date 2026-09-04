import { useState, useEffect } from 'react'
import { Database, Trash2, AlertCircle, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ThreatIntel } from '../lib/types'

export default function ThreatIntel() {
  const [records, setRecords] = useState<ThreatIntel[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({ feed_name: 'CTIAS Internal Feed', indicator_value: '', indicator_type: 'ip', threat_type: 'malware', confidence: 50, description: '' })

  useEffect(() => { loadRecords() }, [])

  async function loadRecords() {
    try { const { data } = await supabase.from('threat_intelligence').select('*').order('first_seen', { ascending: false }); setRecords((data as ThreatIntel[]) || []) } catch { /* */ } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!formData.indicator_value.trim()) { setError('Indicator value is required.'); return }
    try {
      const { error: insertError } = await supabase.from('threat_intelligence').insert({ feed_name: formData.feed_name, indicator_value: formData.indicator_value.trim(), indicator_type: formData.indicator_type, threat_type: formData.threat_type, confidence: formData.confidence, description: formData.description })
      if (insertError) throw insertError
      setFormData({ ...formData, indicator_value: '', description: '' }); setShowForm(false); await loadRecords()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to add threat intel.') }
  }

  async function handleDelete(id: string) { try { await supabase.from('threat_intelligence').delete().eq('id', id); await loadRecords() } catch { /**/ } }

  return (
    <>
      <div className="topbar">
        <h2>Threat Intelligence</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={16} />{showForm ? 'Cancel' : 'Add Indicator'}</button>
      </div>
      <div className="content fade-in">
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
        <div className="card">
          <div className="card-header"><h3>Threat Intelligence Feed</h3><Database size={16} color="var(--text-muted)" /></div>
          {loading ? <div className="loading">Loading...</div> : records.length === 0 ? (
            <div className="empty-state"><Database /><h4>No Threat Intel Entries</h4><p>Add indicators to build your threat intelligence database</p></div>
          ) : (
            <table>
              <thead><tr><th>Indicator</th><th>Type</th><th>Threat Type</th><th>Confidence</th><th>Feed</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {records.map((ti) => (
                  <tr key={ti.id}>
                    <td className="mono">{ti.indicator_value.length > 25 ? ti.indicator_value.slice(0, 25) + '...' : ti.indicator_value}</td>
                    <td><span className="badge badge-info">{ti.indicator_type}</span></td>
                    <td><span className="badge badge-neutral">{ti.threat_type || '-'}</span></td>
                    <td><span className={`badge ${ti.confidence >= 80 ? 'badge-critical' : ti.confidence >= 60 ? 'badge-high' : ti.confidence >= 40 ? 'badge-medium' : 'badge-low'}`}>{ti.confidence}%</span></td>
                    <td className="text-muted">{ti.feed_name}</td>
                    <td className="text-muted">{ti.description ? (ti.description.length > 40 ? ti.description.slice(0, 40) + '...' : ti.description) : '-'}</td>
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
