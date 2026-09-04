import { useState, useEffect } from 'react'
import { FileCode2, Plus, Trash2, CircleAlert as AlertCircle, Save, Radio } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

interface DetectionRule { id: string; title: string; description: string | null; rule_format: string; rule_content: string; severity: 'low' | 'medium' | 'high' | 'critical'; status: 'test' | 'stable' | 'deprecated'; author: string; created_at: string; updated_at: string }

export default function RuleStudio() {
  const [rules, setRules] = useState<DetectionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [selectedRule, setSelectedRule] = useState<DetectionRule | null>(null)
  const [formData, setFormData] = useState({ title: '', description: '', rule_format: 'sigma', rule_content: '', severity: 'medium' as 'low' | 'medium' | 'high' | 'critical', status: 'test' as 'test' | 'stable' | 'deprecated', author: 'CTIAS Lab' })
  const [livePulse, setLivePulse] = useState(false)

  useEffect(() => {
    loadRules()
    const channel = supabase
      .channel('rules-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'detection_rules' }, (payload) => {
        setRules((prev) => [payload.new as DetectionRule, ...prev])
        setLivePulse(true); setTimeout(() => setLivePulse(false), 1000)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'detection_rules' }, (payload) => {
        setRules((prev) => prev.filter((r) => r.id !== payload.old.id))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'detection_rules' }, (payload) => {
        setRules((prev) => prev.map((r) => r.id === payload.new.id ? payload.new as DetectionRule : r))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadRules() {
    try { const { data } = await supabase.from('detection_rules').select('*').order('created_at', { ascending: false }); setRules((data as DetectionRule[]) || []) } catch { /**/ } finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!formData.title.trim() || !formData.rule_content.trim()) { setError('Title and rule content are required.'); return }
    try {
      const { error: insertError } = await supabase.from('detection_rules').insert({ title: formData.title, description: formData.description, rule_format: formData.rule_format, rule_content: formData.rule_content, severity: formData.severity, status: formData.status, author: formData.author })
      if (insertError) throw insertError
      await supabase.from('activity_logs').insert({
        event_type: 'rule_created',
        severity: formData.severity === 'critical' ? 'high' : 'medium',
        title: `New Rule: ${formData.title}`,
        description: `Format: ${formData.rule_format}, Severity: ${formData.severity}`,
        source: 'Rule Studio',
        metadata: { rule_format: formData.rule_format, severity: formData.severity, status: formData.status } as Record<string, unknown>,
      })
      setFormData({ title: '', description: '', rule_format: 'sigma', rule_content: '', severity: 'medium', status: 'test', author: 'CTIAS Lab' }); setShowForm(false)
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save rule.') }
  }

  async function handleDelete(id: string) { try { await supabase.from('detection_rules').delete().eq('id', id); setSelectedRule(null) } catch { /**/ } }

  return (
    <>
      <div className="topbar">
        <h2>Rule Studio</h2>
        <div className="flex gap-12" style={{ alignItems: 'center' }}>
          <div className={`live-indicator ${livePulse ? 'pulse' : ''}`}><Radio size={12} /> LIVE</div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}><Plus size={16} />{showForm ? 'Cancel' : 'New Rule'}</button>
        </div>
      </div>
      <div className="content fade-in">
        {showForm && (
          <div className="card mb-24 fade-in">
            <div className="card-header"><h3>Create Detection Rule</h3></div>
            {error && <div className="alert alert-error"><AlertCircle size={14} /> {error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="grid grid-2">
                <div className="form-group"><label>Rule Title</label><input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Suspicious PowerShell Execution" /></div>
                <div className="form-group"><label>Description</label><input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What this rule detects" /></div>
                <div className="form-group"><label>Rule Format</label><select value={formData.rule_format} onChange={(e) => setFormData({ ...formData, rule_format: e.target.value })}><option value="sigma">Sigma</option><option value="yara">YARA</option><option value="suricata">Suricata</option><option value="snort">Snort</option><option value="custom">Custom</option></select></div>
                <div className="form-group"><label>Severity</label><select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value as typeof formData.severity })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                <div className="form-group"><label>Status</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as typeof formData.status })}><option value="test">Test</option><option value="stable">Stable</option><option value="deprecated">Deprecated</option></select></div>
                <div className="form-group"><label>Author</label><input type="text" value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} /></div>
              </div>
              <div className="form-group"><label>Rule Content</label><textarea value={formData.rule_content} onChange={(e) => setFormData({ ...formData, rule_content: e.target.value })} placeholder="Write your detection rule here..." style={{ minHeight: 200 }} /></div>
              <button type="submit" className="btn btn-primary"><Save size={16} />Save Rule</button>
            </form>
          </div>
        )}
        {selectedRule && (
          <div className="card mb-24 fade-in">
            <div className="card-header">
              <div className="flex gap-12" style={{ alignItems: 'center' }}><h3>{selectedRule.title}</h3><span className={`badge badge-${selectedRule.severity}`}>{selectedRule.severity}</span><span className="badge badge-neutral">{selectedRule.rule_format}</span><span className="badge badge-info">{selectedRule.status}</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRule(null)}>Back</button>
            </div>
            {selectedRule.description && <p className="text-secondary text-sm mb-16">{selectedRule.description}</p>}
            <div className="result-box" style={{ minHeight: 200 }}>{selectedRule.rule_content}</div>
            <div className="flex gap-12 mt-16">
              <span className="text-muted text-sm">Author: {selectedRule.author}</span>
              <span className="text-muted text-sm">Created: {new Date(selectedRule.created_at).toLocaleString()}</span>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(selectedRule.id)}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        )}
        <div className="card">
          <div className="card-header"><h3>Detection Rules</h3><FileCode2 size={16} color="var(--text-muted)" /></div>
          {loading ? <div className="loading">Loading...</div> : rules.length === 0 ? (
            <div className="empty-state"><FileCode2 /><h4>No Rules Yet</h4><p>Create your first detection rule to get started</p></div>
          ) : (
            <table>
              <thead><tr><th>Title</th><th>Format</th><th>Severity</th><th>Status</th><th>Author</th><th></th></tr></thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} onClick={() => setSelectedRule(rule)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{rule.title}</td>
                    <td><span className="badge badge-neutral">{rule.rule_format}</span></td>
                    <td><span className={`badge badge-${rule.severity}`}>{rule.severity}</span></td>
                    <td><span className="badge badge-info">{rule.status}</span></td>
                    <td className="text-muted">{rule.author}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDelete(rule.id) }}><Trash2 size={14} /></button></td>
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
