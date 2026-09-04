import { useState, useEffect } from 'react'
import { Search, Play, Trash2, CircleAlert as AlertCircle, Radio, ChevronDown, ChevronRight, Loader } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

interface ReconTask { id: string; task_id: string; target: string; modules: string[]; status: string; progress: number; results: Record<string, unknown>; error: string | null; created_at: string; updated_at: string; completed_at: string | null }

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
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [livePulse, setLivePulse] = useState(false)

  useEffect(() => {
    loadTasks()
    const channel = supabase
      .channel('recon-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recon_tasks' }, (payload) => {
        setTasks((prev) => [payload.new as ReconTask, ...prev].slice(0, 50))
        setLivePulse(true); setTimeout(() => setLivePulse(false), 1000)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'recon_tasks' }, (payload) => {
        setTasks((prev) => prev.filter((t) => t.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recon_tasks' }, (payload) => {
        setTasks((prev) => prev.map((t) => t.id === payload.new.id ? payload.new as ReconTask : t))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadTasks() {
    try { const { data } = await supabase.from('recon_tasks').select('*').order('created_at', { ascending: false }).limit(50); setTasks((data as ReconTask[]) || []) } catch { /* */ } finally { setLoading(false) }
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

      const { error: insertError } = await supabase.from('recon_tasks').insert({
        task_id: taskId, target: target.trim(), modules: selectedModules, status: 'running', progress: 0, results: {}, error: null,
      })
      if (insertError) throw insertError

      const apiUrl = `${supabaseUrl}/functions/v1/recon`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ target: target.trim(), modules: selectedModules }),
      })

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}))
        throw new Error(errBody.error || `Recon failed (HTTP ${response.status})`)
      }

      const data = await response.json() as { results: Record<string, unknown> }
      const reconResults = data.results || {}

      const { error: updateError } = await supabase.from('recon_tasks').update({
        status: 'completed', progress: 100, results: reconResults, completed_at: new Date().toISOString(),
      }).eq('task_id', taskId)

      if (updateError) throw updateError

      await supabase.from('activity_logs').insert({
        event_type: 'recon_completed',
        severity: 'info',
        title: `Recon Completed: ${target.trim()}`,
        description: `Modules: ${selectedModules.join(', ')}`,
        source: 'Attack Surface',
        metadata: { target: target.trim(), modules: selectedModules } as Record<string, unknown>,
      })
      setTarget('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start recon task.'
      await supabase.from('recon_tasks').update({
        status: 'failed', error: msg, completed_at: new Date().toISOString(),
      }).eq('task_id', `recon_${target.trim()}`)
      setError(msg)
    } finally { setSubmitting(false) }
  }

  async function handleDelete(id: string) { try { await supabase.from('recon_tasks').delete().eq('id', id) } catch { /* */ } }

  return (
    <>
      <div className="topbar">
        <h2>Attack Surface Recon</h2>
        <div className={`live-indicator ${livePulse ? 'pulse' : ''}`}><Radio size={12} /> LIVE</div>
      </div>
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
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><Loader size={16} className="spin" /> Running...</> : <><Play size={16} /> Start Recon</>}
              </button>
            </form>
          </div>
          <div className="card">
            <div className="card-header"><h3>How It Works</h3></div>
            <div className="text-sm text-secondary">
              <p>Attack Surface Reconnaissance performs real-time lookups against your target using public APIs:</p>
              <ul style={{ marginLeft: 20, marginTop: 12, marginBottom: 12, lineHeight: 1.8 }}>
                <li><strong>DNS</strong> - Live A, AAAA, MX, TXT, NS, CNAME records via Google DNS-over-HTTPS</li>
                <li><strong>WHOIS</strong> - Registration data via RDAP protocol</li>
                <li><strong>SSL/TLS</strong> - Certificate transparency logs via CertSpotter</li>
                <li><strong>Ports</strong> - HTTP/HTTPS reachability check</li>
                <li><strong>Headers</strong> - Live HTTP response headers</li>
                <li><strong>Certificates</strong> - Deep certificate analysis from CT logs</li>
              </ul>
              <div className="mt-16" style={{ padding: 12, borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <Radio size={14} color="var(--accent)" />
                  <span className="text-sm">All lookups use live public APIs — no mock or simulated data</span>
                </div>
              </div>
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
                      <span className={`badge ${task.status === 'completed' ? 'badge-low' : task.status === 'failed' ? 'badge-critical' : task.status === 'running' ? 'badge-medium' : 'badge-neutral'}`}>
                        {task.status === 'running' && <Loader size={10} className="spin" style={{ display: 'inline', marginRight: 4 }} />}
                        {task.status}
                      </span>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(task.id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <div className="flex gap-8 mb-16" style={{ flexWrap: 'wrap' }}>{task.modules.map((m) => <span key={m} className="badge badge-info">{m}</span>)}</div>
                  {task.error ? (
                    <div className="alert alert-error" style={{ margin: 0 }}><AlertCircle size={14} /> {task.error}</div>
                  ) : task.status === 'running' ? (
                    <div className="flex gap-8" style={{ alignItems: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      <Loader size={16} className="spin" /> Running live lookups...
                    </div>
                  ) : Object.keys(task.results).length > 0 ? (
                    <>
                      <div className="result-box" style={{ maxHeight: expandedTask === task.id ? '600px' : '120px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                        {JSON.stringify(task.results, null, 2)}
                      </div>
                      <button className="btn btn-ghost btn-sm mt-16" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}>
                        {expandedTask === task.id ? <><ChevronDown size={14} /> Collapse</> : <><ChevronRight size={14} /> Expand Details</>}
                      </button>
                    </>
                  ) : (
                    <div className="text-muted text-sm">No results</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
