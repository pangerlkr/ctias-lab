import { useState, useEffect } from 'react'
import { Search, Play, Trash2, CircleAlert as AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ReconTask } from '../lib/types'

const AVAILABLE_MODULES = [
  { id: 'dns', label: 'DNS Resolution' }, { id: 'whois', label: 'WHOIS Lookup' },
  { id: 'ssl', label: 'SSL/TLS Info' }, { id: 'ports', label: 'Port Scan' },
  { id: 'headers', label: 'HTTP Headers' }, { id: 'certificates', label: 'Certificate Analysis' },
]

export default function Recon() {
  const [target, setTarget] = useState('')
  const [selectedModules, setSelectedModules] = useState<string[]>(['dns', 'whois', 'ssl'])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tasks, setTasks] = useState<ReconTask[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    try { const { data } = await supabase.from('recon_tasks').select('*').order('created_at', { ascending: false }).limit(20); setTasks((data as ReconTask[]) || []) } catch { /* */ } finally { setLoading(false) }
  }

  function toggleModule(id: string) {
    setSelectedModules((prev) => prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!target.trim()) { setError('Please enter a target domain or IP.'); return }
    if (selectedModules.length === 0) { setError('Select at least one recon module.'); return }
    setSubmitting(true)
    try {
      const taskId = `recon_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
      const mockResults: Record<string, unknown> = {}
      for (const mod of selectedModules) mockResults[mod] = generateMockResult(mod, target.trim())
      const { error: insertError } = await supabase.from('recon_tasks').insert({
        task_id: taskId, target: target.trim(), modules: selectedModules, status: 'completed', progress: 100, results: mockResults, completed_at: new Date().toISOString(),
      })
      if (insertError) throw insertError
      setTarget(''); await loadTasks()
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to start recon task.') } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) { try { await supabase.from('recon_tasks').delete().eq('id', id); await loadTasks() } catch { /* */ } }

  return (
    <>
      <div className="topbar"><h2>Attack Surface Recon</h2></div>
      <div className="content fade-in">
        <div className="grid grid-2 mb-24">
          <div className="card">
            <div className="card-header"><h3>New Recon Task</h3><Search size={16} color="var(--text-muted)" /></div>
            {error && <div className="alert alert-error"><AlertCircle size={14} /> {error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group"><label>Target (Domain or IP)</label><input type="text" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="e.g. example.com or 192.168.1.1" disabled={submitting} /></div>
              <div className="form-group"><label>Recon Modules</label>
                <div className="flex gap-12" style={{ flexWrap: 'wrap' }}>
                  {AVAILABLE_MODULES.map((mod) => (
                    <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '6px 12px', border: `1px solid ${selectedModules.includes(mod.id) ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, background: selectedModules.includes(mod.id) ? 'rgba(59,130,246,0.1)' : 'transparent' }}>
                      <input type="checkbox" checked={selectedModules.includes(mod.id)} onChange={() => toggleModule(mod.id)} style={{ width: 'auto', margin: 0 }} />{mod.label}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}><Play size={16} />{submitting ? 'Running...' : 'Start Recon'}</button>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><h3>How It Works</h3></div>
            <div className="text-sm text-secondary">
              <p>Attack Surface Reconnaissance discovers and maps information about a target:</p>
              <ul style={{ marginLeft: 20, marginTop: 12, marginBottom: 12, lineHeight: 1.8 }}>
                <li><strong>DNS</strong> - Resolve A, MX, TXT, NS records</li><li><strong>WHOIS</strong> - Registration and ownership data</li>
                <li><strong>SSL/TLS</strong> - Certificate details and validity</li><li><strong>Ports</strong> - Common open ports and services</li>
                <li><strong>Headers</strong> - HTTP response headers</li><li><strong>Certificates</strong> - Deep certificate analysis</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3>Recon Task History</h3></div>
          {loading ? <div className="loading">Loading...</div> : tasks.length === 0 ? (
            <div className="empty-state"><Search /><h4>No Recon Tasks Yet</h4><p>Start a recon task above to get started</p></div>
          ) : (
            <div className="flex gap-16" style={{ flexWrap: 'wrap' }}>
              {tasks.map((task) => (
                <div key={task.id} className="card" style={{ flex: '1 1 400px', minWidth: 300 }}>
                  <div className="flex-between mb-16">
                    <div><div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{task.target}</div><div className="text-muted text-sm">{new Date(task.created_at).toLocaleString()}</div></div>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}>
                      <span className={`badge ${task.status === 'completed' ? 'badge-low' : 'badge-neutral'}`}>{task.status}</span>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(task.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>{task.modules.map((m) => <span key={m} className="badge badge-info">{m}</span>)}</div>
                  <div className="result-box">{JSON.stringify(task.results, null, 2)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function generateMockResult(module: string, target: string): Record<string, unknown> {
  const results: Record<string, Record<string, unknown>> = {
    dns: { records: { A: ['93.184.216.34'], MX: ['mail.example.com'], TXT: ['v=spf1 include:_spf.example.com ~all'], NS: ['ns1.example.com', 'ns2.example.com'] }, resolved: true },
    whois: { registrar: 'ICANN', created: '1995-08-14', expires: '2025-08-13', nameServers: ['a.iana-servers.net', 'b.iana-servers.net'], status: 'active' },
    ssl: { issuer: 'DigiCert TLS RSA SHA256 2020 CA1', validFrom: '2024-01-15', validTo: '2025-01-15', protocol: 'TLS 1.3', keySize: 2048 },
    ports: { openPorts: [{ port: 80, service: 'HTTP' }, { port: 443, service: 'HTTPS' }, { port: 22, service: 'SSH' }], scanned: true },
    headers: { Server: 'nginx/1.21.6', 'Content-Type': 'text/html; charset=UTF-8', 'X-Frame-Options': 'SAMEORIGIN', 'X-Content-Type-Options': 'nosniff', 'Strict-Transport-Security': 'max-age=31536000' },
    certificates: { subject: `CN=${target}`, issuer: 'DigiCert', serialNumber: '0F:1A:2B:3C:4D:5E:6F', signatureAlgorithm: 'SHA256-RSA', valid: true },
  }
  return results[module] || { status: 'no data' }
}
