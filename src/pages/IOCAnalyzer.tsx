import { useState, useEffect } from 'react'
import { Crosshair, Send, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { IOCRecord, ThreatIntel } from '../lib/types'
import { identifyIOCType, calculateRiskScore, getMetadata } from '../lib/iocUtils'

export default function IOCAnalyzer() {
  const [iocValue, setIocValue] = useState('')
  const [tags, setTags] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [records, setRecords] = useState<IOCRecord[]>([])
  const [threatIntels, setThreatIntels] = useState<ThreatIntel[]>([])
  const [loading, setLoading] = useState(true)
  const [lastResult, setLastResult] = useState<IOCRecord | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    try {
      const [iocRes, tiRes] = await Promise.all([
        supabase.from('ioc_records').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('threat_intelligence').select('*').eq('is_active', true),
      ])
      setRecords((iocRes.data as IOCRecord[]) || [])
      setThreatIntels((tiRes.data as ThreatIntel[]) || [])
    } catch { /* fine */ } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!iocValue.trim()) { setError('Please enter an IOC value to analyze.'); return }
    setSubmitting(true)
    try {
      const iocType = identifyIOCType(iocValue)
      if (iocType === 'unknown') {
        setError('Could not identify IOC type. Please enter a valid IP, domain, URL, email, or file hash.')
        setSubmitting(false); return
      }
      const riskScore = calculateRiskScore(iocValue, iocType, threatIntels)
      const metadata = getMetadata(iocValue, iocType)
      const tagArray = tags.split(',').map((t) => t.trim()).filter(Boolean)
      const matchedThreats = threatIntels.filter((ti) => ti.indicator_value === iocValue.trim())
      if (matchedThreats.length > 0) {
        metadata.threat_matches = matchedThreats.map((t) => ({ feed: t.feed_name, type: t.threat_type, confidence: t.confidence, description: t.description }))
      }
      const { data, error: insertError } = await supabase.from('ioc_records').insert({
        ioc_value: iocValue.trim(), ioc_type: iocType, risk_score: riskScore, metadata, tags: tagArray, status: 'analyzed',
      }).select().single()
      if (insertError) throw insertError
      setLastResult(data as IOCRecord)
      setIocValue(''); setTags('')
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze IOC.')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    try { await supabase.from('ioc_records').delete().eq('id', id); await loadData() } catch { /* ignore */ }
  }

  return (
    <>
      <div className="topbar"><h2>IOC Analyzer</h2></div>
      <div className="content fade-in">
        <div className="grid grid-2 mb-24">
          <div className="card">
            <div className="card-header"><h3>Submit Indicator</h3><Crosshair size={16} color="var(--text-muted)" /></div>
            {error && <div className="alert alert-error"><AlertCircle size={14} /> {error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>IOC Value (IP, Domain, URL, Email, Hash)</label>
                <input type="text" value={iocValue} onChange={(e) => setIocValue(e.target.value)} placeholder="e.g. 8.8.8.8, example.com, https://suspicious.url" disabled={submitting} />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated, optional)</label>
                <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. suspicious, apt29, phishing" disabled={submitting} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Send size={16} />{submitting ? 'Analyzing...' : 'Analyze IOC'}
              </button>
            </form>
            {lastResult && (
              <div className="mt-24 fade-in">
                <h4 className="text-sm text-secondary mb-16">Last Analysis Result</h4>
                <div className="result-box">{`IOC Value:   ${lastResult.ioc_value}\nType:        ${lastResult.ioc_type}\nRisk Score:  ${lastResult.risk_score}/100\nStatus:      ${lastResult.status}\nTags:        ${lastResult.tags.join(', ') || 'none'}\n\nMetadata:\n${JSON.stringify(lastResult.metadata, null, 2)}`}</div>
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-header"><h3>Detection Summary</h3></div>
            <div className="text-sm text-secondary">
              <p>The IOC Analyzer identifies the type of indicator (IP, domain, URL, email, file hash) and calculates a risk score based on:</p>
              <ul style={{ marginLeft: 20, marginTop: 12, marginBottom: 12, lineHeight: 1.8 }}>
                <li>Type-based baseline scoring</li><li>Cross-referencing against threat intelligence feeds</li>
                <li>Hash-based risk elevation for file indicators</li><li>URL and IP reputation factors</li>
              </ul>
              <p>Results are stored and can be reviewed in the history below.</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Analysis History</h3></div>
          {loading ? <div className="loading">Loading...</div> : records.length === 0 ? (
            <div className="empty-state"><Crosshair /><h4>No IOCs Analyzed Yet</h4><p>Submit an indicator above to get started</p></div>
          ) : (
            <table>
              <thead><tr><th>IOC Value</th><th>Type</th><th>Risk Score</th><th>Tags</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {records.map((ioc) => (
                  <tr key={ioc.id}>
                    <td className="mono">{ioc.ioc_value.length > 40 ? ioc.ioc_value.slice(0, 40) + '...' : ioc.ioc_value}</td>
                    <td><span className="badge badge-info">{ioc.ioc_type}</span></td>
                    <td><span className={`badge ${ioc.risk_score >= 70 ? 'badge-critical' : ioc.risk_score >= 40 ? 'badge-medium' : ioc.risk_score > 0 ? 'badge-low' : 'badge-neutral'}`}>{ioc.risk_score}</span></td>
                    <td className="text-muted">{ioc.tags.length > 0 ? ioc.tags.join(', ') : '-'}</td>
                    <td className="text-muted">{new Date(ioc.created_at).toLocaleString()}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => handleDelete(ioc.id)}><Trash2 size={14} /></button></td>
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
