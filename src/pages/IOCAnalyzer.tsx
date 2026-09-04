import { useState, useEffect } from 'react'
import { Crosshair, Send, Trash2, CircleAlert as AlertCircle, Radio, Copy, Check } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

interface IOCRecord { id: string; ioc_value: string; ioc_type: string; risk_score: number; metadata: Record<string, unknown>; tags: string[]; status: string; created_at: string; updated_at: string }
interface ThreatIntel { id: string; feed_name: string; indicator_value: string; indicator_type: string; threat_type: string | null; confidence: number; description: string | null; metadata: Record<string, unknown>; first_seen: string; last_seen: string; is_active: boolean }

function identifyIOCType(value: string): string {
  const trimmed = value.trim()
  const patterns: Record<string, RegExp> = {
    ip: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/,
    md5: /^[a-fA-F0-9]{32}$/,
    sha1: /^[a-fA-F0-9]{40}$/,
    sha256: /^[a-fA-F0-9]{64}$/,
    url: /^https?:\/\/[^\s]+$/i,
    domain: /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  }
  for (const [type, pattern] of Object.entries(patterns)) { if (pattern.test(trimmed)) return type }
  return 'unknown'
}

function calculateRiskScore(value: string, type: string, threatIntels: { indicator_value: string; confidence: number }[]): number {
  let score = 30
  const matches = threatIntels.filter((ti) => ti.indicator_value === value.trim())
  if (matches.length > 0) { score = Math.max(score, Math.max(...matches.map((m) => m.confidence))) }
  if (type === 'sha256' || type === 'sha1' || type === 'md5') score += 15
  if (type === 'url') score += 10
  if (type === 'ip') score += 5
  if (type === 'unknown') return 0
  return Math.min(score, 100)
}

function getMetadata(value: string, type: string): Record<string, unknown> {
  const metadata: Record<string, unknown> = { analyzed: true }
  if (['md5', 'sha1', 'sha256'].includes(type)) {
    metadata.hash_algorithm = type.toUpperCase()
    metadata.hash_length = value.trim().length
  } else if (type === 'ip') {
    const parts = value.trim().split('.')
    const first = parseInt(parts[0], 10)
    metadata.ip_version = 'IPv4'
    metadata.is_private = first === 10 || (first === 172 && parseInt(parts[1], 10) >= 16 && parseInt(parts[1], 10) <= 31) || (first === 192 && parts[1] === '168')
  } else if (type === 'domain') {
    metadata.tld = value.trim().split('.').pop()
  } else if (type === 'url') {
    try { const u = new URL(value.trim()); metadata.protocol = u.protocol; metadata.hostname = u.hostname; metadata.path = u.pathname } catch { /* invalid */ }
  } else if (type === 'email') {
    metadata.domain = value.trim().split('@')[1]
  }
  return metadata
}

export default function IOCAnalyzer() {
  const [iocValue, setIocValue] = useState('')
  const [tags, setTags] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [records, setRecords] = useState<IOCRecord[]>([])
  const [threatIntels, setThreatIntels] = useState<ThreatIntel[]>([])
  const [loading, setLoading] = useState(true)
  const [lastResult, setLastResult] = useState<IOCRecord | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [filterType, setFilterType] = useState('all')
  const [livePulse, setLivePulse] = useState(false)

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('ioc-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ioc_records' }, (payload) => {
        setRecords((prev) => [payload.new as IOCRecord, ...prev].slice(0, 50))
        setLivePulse(true); setTimeout(() => setLivePulse(false), 1000)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'ioc_records' }, (payload) => {
        setRecords((prev) => prev.filter((r) => r.id !== payload.old.id))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'threat_intelligence' }, () => { loadData() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadData() {
    try {
      const [iocRes, tiRes] = await Promise.all([
        supabase.from('ioc_records').select('*').order('created_at', { ascending: false }).limit(50),
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
      const newRecord = data as IOCRecord
      setLastResult(newRecord)
      await supabase.from('activity_logs').insert({
        event_type: 'ioc_submitted',
        severity: riskScore >= 80 ? 'critical' : riskScore >= 60 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
        title: matchedThreats.length > 0 ? `Threat Match: ${iocValue.trim().slice(0, 40)}` : `IOC Analyzed: ${iocValue.trim().slice(0, 40)}`,
        description: `Type: ${iocType}, Risk Score: ${riskScore}/100${matchedThreats.length > 0 ? `, Matched ${matchedThreats.length} threat feed(s)` : ''}`,
        source: 'IOC Analyzer',
        metadata: { ioc_type: iocType, risk_score: riskScore, matched_threats: matchedThreats.length } as Record<string, unknown>,
      })
      setIocValue(''); setTags('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze IOC.')
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) {
    try { await supabase.from('ioc_records').delete().eq('id', id) } catch { /* ignore */ }
  }

  function copyValue(value: string) {
    navigator.clipboard.writeText(value)
    setCopied(value); setTimeout(() => setCopied(null), 1500)
  }

  const filteredRecords = filterType === 'all' ? records : records.filter((r) => r.ioc_type === filterType)
  const typeOptions = ['all', ...Array.from(new Set(records.map((r) => r.ioc_type)))]

  return (
    <>
      <div className="topbar">
        <h2>IOC Analyzer</h2>
        <div className={`live-indicator ${livePulse ? 'pulse' : ''}`}><Radio size={12} /> LIVE</div>
      </div>
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
              <div className="mt-16" style={{ padding: 12, borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <Radio size={14} color="var(--accent)" />
                  <span className="text-sm">Real-time threat cross-referencing against {threatIntels.length} active indicators</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3>Analysis History</h3>
            <div className="flex gap-8">
              {typeOptions.map((type) => (
                <button key={type} className={`btn btn-sm ${filterType === type ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilterType(type)}>{type}</button>
              ))}
            </div>
          </div>
          {loading ? <div className="loading">Loading...</div> : filteredRecords.length === 0 ? (
            <div className="empty-state"><Crosshair /><h4>No IOCs Analyzed Yet</h4><p>Submit an indicator above to get started</p></div>
          ) : (
            <table>
              <thead><tr><th>IOC Value</th><th>Type</th><th>Risk Score</th><th>Tags</th><th>Date</th><th></th></tr></thead>
              <tbody>
                {filteredRecords.map((ioc) => (
                  <tr key={ioc.id}>
                    <td className="mono" style={{ cursor: 'pointer' }} onClick={() => copyValue(ioc.ioc_value)}>
                      {ioc.ioc_value.length > 40 ? ioc.ioc_value.slice(0, 40) + '...' : ioc.ioc_value}
                      {copied === ioc.ioc_value ? <Check size={12} color="var(--green)" style={{ display: 'inline', marginLeft: 4 }} /> : <Copy size={12} color="var(--text-muted)" style={{ display: 'inline', marginLeft: 4 }} />}
                    </td>
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
