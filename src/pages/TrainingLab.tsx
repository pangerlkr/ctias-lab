import { useState, useEffect } from 'react'
import { GraduationCap, ArrowLeft, CircleCheck as CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { TrainingScenario } from '../lib/types'

export default function TrainingLab() {
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<TrainingScenario | null>(null)
  const [completedObjectives, setCompletedObjectives] = useState<Set<number>>(new Set())

  useEffect(() => { loadScenarios() }, [])

  async function loadScenarios() {
    try { const { data } = await supabase.from('training_scenarios').select('*').order('created_at', { ascending: false }); setScenarios((data as TrainingScenario[]) || []) } catch { /**/ } finally { setLoading(false) }
  }

  function toggleObjective(index: number) {
    setCompletedObjectives((prev) => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next })
  }

  if (selected) {
    const objectives: string[] = Array.isArray(selected.objectives) ? selected.objectives : []
    const allDone = completedObjectives.size === objectives.length && objectives.length > 0
    return (
      <>
        <div className="topbar">
          <h2>{selected.title}</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSelected(null); setCompletedObjectives(new Set()) }}><ArrowLeft size={16} /> Back</button>
        </div>
        <div className="content fade-in">
          <div className="card mb-24">
            <div className="flex gap-12 mb-16"><span className={`badge badge-${selected.difficulty}`}>{selected.difficulty}</span><span className="badge badge-info">{selected.category}</span></div>
            <p className="text-secondary">{selected.description}</p>
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-header"><h3>Scenario Briefing</h3><GraduationCap size={16} color="var(--text-muted)" /></div>
              <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.content}</p>
            </div>
            <div className="card">
              <div className="card-header"><h3>Learning Objectives</h3>{allDone && <CheckCircle size={18} color="var(--green)" />}</div>
              {objectives.length === 0 ? <p className="text-muted">No specific objectives defined.</p> : (
                <div className="flex gap-12" style={{ flexDirection: 'column' }}>
                  {objectives.map((obj, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 8, cursor: 'pointer', background: completedObjectives.has(i) ? 'rgba(34,197,94,0.08)' : 'transparent', border: `1px solid ${completedObjectives.has(i) ? 'var(--green)' : 'var(--border)'}`, fontSize: 13 }}>
                      <input type="checkbox" checked={completedObjectives.has(i)} onChange={() => toggleObjective(i)} style={{ width: 'auto', margin: 0, marginTop: 2 }} />
                      <span style={{ textDecoration: completedObjectives.has(i) ? 'line-through' : 'none', color: completedObjectives.has(i) ? 'var(--text-muted)' : 'var(--text-primary)' }}>{obj}</span>
                    </label>
                  ))}
                </div>
              )}
              {allDone && <div className="alert alert-success mt-16"><CheckCircle size={14} /> All objectives completed! Great work.</div>}
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="topbar"><h2>Training Lab</h2></div>
      <div className="content fade-in">
        {loading ? <div className="loading">Loading...</div> : scenarios.length === 0 ? (
          <div className="card"><div className="empty-state"><GraduationCap /><h4>No Training Scenarios</h4><p>Training scenarios will appear here</p></div></div>
        ) : (
          <div className="grid grid-3">
            {scenarios.map((scenario) => (
              <div key={scenario.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(scenario)}>
                <div className="flex gap-8 mb-16"><span className={`badge badge-${scenario.difficulty}`}>{scenario.difficulty}</span><span className="badge badge-info">{scenario.category}</span></div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>{scenario.title}</h3>
                <p className="text-secondary text-sm" style={{ marginBottom: 12 }}>{scenario.description}</p>
                <div className="text-muted text-sm">{Array.isArray(scenario.objectives) ? scenario.objectives.length : 0} objectives</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
