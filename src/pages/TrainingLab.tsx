import { useState, useEffect } from 'react'
import { GraduationCap, ArrowLeft, CircleCheck as CheckCircle, Radio, Clock, Target, BookOpen, Award } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })

interface TrainingEvidence { label: string; type: string; content: string }
interface TrainingScenario { id: string; title: string; description: string; difficulty: 'beginner' | 'intermediate' | 'advanced'; category: string; content: string; objectives: string[]; evidence: TrainingEvidence[]; created_at: string; updated_at: string }
interface TrainingProgress { id: string; scenario_id: string; completed_objectives: number[]; completed_at: string | null }

export default function TrainingLab() {
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([])
  const [progress, setProgress] = useState<Record<string, TrainingProgress>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TrainingScenario | null>(null)
  const [completedObjectives, setCompletedObjectives] = useState<Set<number>>(new Set())
  const [livePulse, setLivePulse] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('training-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_scenarios' }, (payload) => {
        if (payload.eventType === 'INSERT') setScenarios((prev) => [payload.new as TrainingScenario, ...prev])
        else if (payload.eventType === 'DELETE') setScenarios((prev) => prev.filter((s) => s.id !== payload.old.id))
        else if (payload.eventType === 'UPDATE') setScenarios((prev) => prev.map((s) => s.id === payload.new.id ? payload.new as TrainingScenario : s))
        setLivePulse(true); setTimeout(() => setLivePulse(false), 1000)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'training_progress' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as TrainingProgress
          setProgress((prev) => { const next = { ...prev }; delete next[old.scenario_id]; return next })
        } else {
          const row = payload.new as TrainingProgress
          setProgress((prev) => ({ ...prev, [row.scenario_id]: row }))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function loadData() {
    try {
      const [scenRes, progRes] = await Promise.all([
        supabase.from('training_scenarios').select('*').order('created_at', { ascending: false }),
        supabase.from('training_progress').select('*'),
      ])
      setScenarios((scenRes.data as TrainingScenario[]) || [])
      const progMap: Record<string, TrainingProgress> = {}
      for (const p of (progRes.data as TrainingProgress[]) || []) { progMap[p.scenario_id] = p }
      setProgress(progMap)
    } catch { /**/ } finally { setLoading(false) }
  }

  function openScenario(scenario: TrainingScenario) {
    const existing = progress[scenario.id]
    setCompletedObjectives(new Set(existing?.completed_objectives || []))
    setSelected(scenario)
  }

  async function toggleObjective(index: number) {
    if (!selected) return
    const objectives: string[] = Array.isArray(selected.objectives) ? selected.objectives : []
    const nextSet = new Set(completedObjectives)
    if (nextSet.has(index)) nextSet.delete(index); else nextSet.add(index)
    setCompletedObjectives(nextSet)
    setSaving(true)
    try {
      const completedArr = Array.from(nextSet).sort((a, b) => a - b)
      const allDone = completedArr.length === objectives.length && objectives.length > 0
      const existing = progress[selected.id]
      if (existing) {
        await supabase.from('training_progress').update({
          completed_objectives: completedArr,
          completed_at: allDone ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id)
      } else {
        await supabase.from('training_progress').insert({
          scenario_id: selected.id,
          completed_objectives: completedArr,
          completed_at: allDone ? new Date().toISOString() : null,
        })
      }
      await supabase.from('activity_logs').insert({
        event_type: 'training_progress',
        severity: allDone ? 'info' : 'info',
        title: allDone ? `Training Completed: ${selected.title}` : `Training Progress: ${selected.title}`,
        description: allDone ? `All ${objectives.length} objectives completed` : `${completedArr.length}/${objectives.length} objectives completed`,
        source: 'Training Lab',
        metadata: { scenario_id: selected.id, completed: completedArr.length, total: objectives.length } as Record<string, unknown>,
      })
    } catch { /**/ } finally { setSaving(false) }
  }

  const totalScenarios = scenarios.length
  const completedScenarios = Object.values(progress).filter((p) => p.completed_at !== null).length
  const inProgressScenarios = Object.values(progress).filter((p) => p.completed_at === null && p.completed_objectives.length > 0).length

  if (selected) {
    const objectives: string[] = Array.isArray(selected.objectives) ? selected.objectives : []
    const allDone = completedObjectives.size === objectives.length && objectives.length > 0
    const scenarioProgress = progress[selected.id]
    return (
      <>
        <div className="topbar">
          <h2>{selected.title}</h2>
          <div className="flex gap-12" style={{ alignItems: 'center' }}>
            {saving && <span className="text-muted text-sm">Saving...</span>}
            <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setCompletedObjectives(new Set()) }}><ArrowLeft size={16} /> Back</button>
          </div>
        </div>
        <div className="content fade-in">
          <div className="card mb-24">
            <div className="flex gap-12 mb-16"><span className={`badge badge-${selected.difficulty}`}>{selected.difficulty}</span><span className="badge badge-info">{selected.category}</span></div>
            <p className="text-secondary">{selected.description}</p>
            <div className="flex gap-16 mt-16">
              <div className="flex gap-8" style={{ alignItems: 'center' }}><Target size={14} color="var(--text-muted)" /><span className="text-muted text-sm">{objectives.length} objectives</span></div>
              <div className="flex gap-8" style={{ alignItems: 'center' }}><BookOpen size={14} color="var(--text-muted)" /><span className="text-muted text-sm">{selected.content.split('\n').length} sections</span></div>
              {scenarioProgress?.completed_at && <div className="flex gap-8" style={{ alignItems: 'center' }}><Award size={14} color="var(--green)" /><span className="text-sm" style={{ color: 'var(--green)' }}>Completed {new Date(scenarioProgress.completed_at).toLocaleDateString()}</span></div>}
            </div>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-header"><h3>Scenario Briefing</h3><GraduationCap size={16} color="var(--text-muted)" /></div>
              <div className="scenario-content">{selected.content}</div>
              {Array.isArray(selected.evidence) && selected.evidence.length > 0 && (
                <div className="evidence-pack">
                  <div className="evidence-pack-header">
                    <div><h4>Evidence Pack</h4><p className="text-muted text-sm">Inspect these synthetic artifacts before checking your objectives.</p></div>
                    <span className="badge badge-info">{selected.evidence.length} artifacts</span>
                  </div>
                  <div className="evidence-list">
                    {selected.evidence.map((artifact, index) => (
                      <div key={`${artifact.label}-${index}`} className="evidence-item">
                        <div className="flex-between mb-8"><strong>{artifact.label}</strong><span className="text-muted text-sm">{artifact.type}</span></div>
                        <pre>{artifact.content}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-header">
                <h3>Learning Objectives</h3>
                <div className="flex gap-8" style={{ alignItems: 'center' }}>
                  <span className="text-muted text-sm">{completedObjectives.size}/{objectives.length}</span>
                  {allDone && <CheckCircle size={18} color="var(--green)" />}
                </div>
              </div>
              {objectives.length === 0 ? <p className="text-muted">No specific objectives defined.</p> : (
                <div className="flex gap-12" style={{ flexDirection: 'column' }}>
                  {objectives.map((obj, i) => (
                    <label key={i} className={`objective-item ${completedObjectives.has(i) ? 'completed' : ''}`}>
                      <input type="checkbox" checked={completedObjectives.has(i)} onChange={() => toggleObjective(i)} style={{ width: 'auto', margin: 0, marginTop: 2 }} />
                      <span className="objective-text">{obj}</span>
                    </label>
                  ))}
                </div>
              )}
              {allDone && <div className="alert alert-success mt-16"><CheckCircle size={14} /> All objectives completed! This exercise is marked as done.</div>}
              <div className="mt-16" style={{ padding: 12, borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <p className="text-muted text-sm">Progress is saved automatically and persists across sessions. Uncheck an objective to revise your work.</p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="topbar">
        <h2>Training Lab</h2>
        <div className={`live-indicator ${livePulse ? 'pulse' : ''}`}><Radio size={12} /> LIVE</div>
      </div>
      <div className="content fade-in">
        <div className="grid grid-3 mb-24">
          <div className="stat"><div className="stat-icon" style={{ background: 'rgba(168,85,247,0.15)' }}><GraduationCap size={20} color="var(--purple)" /></div><div className="stat-label">Total Exercises</div><div className="stat-value purple">{totalScenarios}</div></div>
          <div className="stat"><div className="stat-icon" style={{ background: 'rgba(234,179,8,0.15)' }}><Clock size={20} color="var(--yellow)" /></div><div className="stat-label">In Progress</div><div className="stat-value yellow">{inProgressScenarios}</div></div>
          <div className="stat"><div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)' }}><Award size={20} color="var(--green)" /></div><div className="stat-label">Completed</div><div className="stat-value green">{completedScenarios}</div></div>
        </div>
        {loading ? <div className="loading">Loading...</div> : scenarios.length === 0 ? (
          <div className="card"><div className="empty-state"><GraduationCap /><h4>No Training Scenarios</h4><p>Training scenarios will appear here</p></div></div>
        ) : (
          <div className="grid grid-3">
            {scenarios.map((scenario) => {
              const objectives: string[] = Array.isArray(scenario.objectives) ? scenario.objectives : []
              const prog = progress[scenario.id]
              const doneCount = prog?.completed_objectives?.length || 0
              const isComplete = prog?.completed_at !== null && prog?.completed_at !== undefined
              const pct = objectives.length > 0 ? Math.round((doneCount / objectives.length) * 100) : 0
              return (
                <div key={scenario.id} className="card training-card" style={{ cursor: 'pointer' }} onClick={() => openScenario(scenario)}>
                  <div className="flex gap-8 mb-16">
                    <span className={`badge badge-${scenario.difficulty}`}>{scenario.difficulty}</span>
                    <span className="badge badge-info">{scenario.category}</span>
                    {isComplete && <span className="badge badge-low"><CheckCircle size={10} style={{ display: 'inline', marginRight: 2 }} /> done</span>}
                  </div>
                  <h3 style={{ fontSize: 15, marginBottom: 8 }}>{scenario.title}</h3>
                  <p className="text-secondary text-sm" style={{ marginBottom: 12 }}>{scenario.description}</p>
                  <div className="flex gap-16 mb-16">
                    <div className="flex gap-8" style={{ alignItems: 'center' }}><Target size={12} color="var(--text-muted)" /><span className="text-muted text-sm">{objectives.length} objectives</span></div>
                    <div className="flex gap-8" style={{ alignItems: 'center' }}><BookOpen size={12} color="var(--text-muted)" /><span className="text-muted text-sm">{scenario.content.split('\n').length} sections</span></div>
                  </div>
                  {doneCount > 0 && (
                    <div>
                      <div className="flex-between mb-16"><span className="text-muted text-sm">Progress</span><span className="text-muted text-sm">{pct}%</span></div>
                      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
