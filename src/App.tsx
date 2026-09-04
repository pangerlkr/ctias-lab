import { Routes, Route, NavLink } from 'react-router-dom'
import { Shield, LayoutDashboard, Search, Crosshair, FileCode2, GraduationCap, Database } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import IOCAnalyzer from './pages/IOCAnalyzer'
import Recon from './pages/Recon'
import RuleStudio from './pages/RuleStudio'
import TrainingLab from './pages/TrainingLab'
import ThreatIntel from './pages/ThreatIntel'

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo"><Shield size={20} /></div>
          <div>
            <h1>CTIAS Lab</h1>
            <span>Threat Intelligence</span>
          </div>
        </div>
        <nav className="nav">
          <NavLink to="/" end className="nav-link"><LayoutDashboard size={18} />Dashboard</NavLink>
          <NavLink to="/ioc" className="nav-link"><Crosshair size={18} />IOC Analyzer</NavLink>
          <NavLink to="/recon" className="nav-link"><Search size={18} />Attack Surface</NavLink>
          <NavLink to="/threats" className="nav-link"><Database size={18} />Threat Intel</NavLink>
          <NavLink to="/rules" className="nav-link"><FileCode2 size={18} />Rule Studio</NavLink>
          <NavLink to="/training" className="nav-link"><GraduationCap size={18} />Training Lab</NavLink>
        </nav>
        <div className="sidebar-footer">CTIAS Lab v1.0.0<br />NEXUSCIPHERGUARD INDIA</div>
      </aside>
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ioc" element={<IOCAnalyzer />} />
          <Route path="/recon" element={<Recon />} />
          <Route path="/threats" element={<ThreatIntel />} />
          <Route path="/rules" element={<RuleStudio />} />
          <Route path="/training" element={<TrainingLab />} />
        </Routes>
      </div>
    </div>
  )
}
