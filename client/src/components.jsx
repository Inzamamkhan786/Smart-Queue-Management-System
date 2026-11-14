import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, CircleHelp,
  Clock3, LayoutDashboard, LogOut, Menu, Moon, Plus, Search, Settings, Sun, Users, X
} from 'lucide-react';
import { useApp } from './context.jsx';

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{children}</button>;
}

export function PageHeader({ eyebrow, title, description, action }) {
  return <div className="page-header">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
    {action && <div className="header-action">{action}</div>}
  </div>;
}

export function EmptyState({ title, text, action }) {
  return <div className="empty-state"><div className="empty-icon"><Users size={20} /></div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function Notice({ children, type = 'error' }) {
  if (!children) return null;
  return <div className={`notice notice-${type}`} role="alert">{children}</div>;
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  return <button className="icon-button" onClick={toggleTheme} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} aria-label="Toggle color theme">
    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
  </button>;
}

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/queues', label: 'My queues', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export function Shell({ children }) {
  const { manager, signOut } = useApp();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  async function logout() {
    try { await signOut(); navigate('/login'); } catch (error) { window.alert(error.userMessage); }
  }
  return <div className="app-shell">
    {open && <button aria-label="Close navigation" className="mobile-backdrop" onClick={() => setOpen(false)} />}
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <Link to="/" className="brand"><span className="brand-mark">q.</span><span>queueflow</span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list">{navItems.map(({ to, label, icon: Icon, end }) =>
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
        </NavLink>)}</nav>
      <div className="sidebar-bottom">
        <div className="help-card"><CircleHelp size={17} /><span>Keep your line moving.</span></div>
        <button className="profile-link" onClick={() => navigate('/settings')}>
          <span className="avatar">{manager?.name?.slice(0, 1).toUpperCase() || 'M'}</span>
          <span className="profile-name"><strong>{manager?.name}</strong><small>Manager account</small></span>
          <ChevronDown size={16} />
        </button>
      </div>
    </aside>
    <main className="main-content">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
        <div className="breadcrumb">Workspace <span>/</span> <b>Manager</b></div>
        <div className="topbar-right"><span className="today-date">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><ThemeToggle /><button className="icon-button" onClick={logout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button></div>
      </header>
      <div className="content-wrap">{children}</div>
    </main>
  </div>;
}

export function AuthLayout({ children, title, subtitle, aside = true }) {
  const { theme, toggleTheme } = useApp();
  return <div className="auth-page">
    {aside && <section className="auth-aside">
      <Link to="/login" className="brand"><span className="brand-mark">q.</span><span>queueflow</span></Link>
      <div className="auth-message"><span className="auth-kicker"><span className="live-dot" /> A calmer way to manage the line</span><h1>Good service<br />starts <em>in line.</em></h1><p>One clear view of every queue, every token, and the next person who needs you.</p>
        <div className="auth-preview"><div className="preview-top"><span>A simple flow</span><span className="preview-live"><i /> QueueFlow</span></div><div className="preview-number">One line, <small>clear at every step</small></div><div className="preview-queue"><span className="preview-token">01</span><span>Arrive<small>Join the right queue</small></span><b>WAITING</b></div><div className="preview-queue"><span className="preview-token">02</span><span>Get served<small>Call the next person</small></span><b>IN SERVICE</b></div><div className="preview-queue"><span className="preview-token">03</span><span>Move on<small>Complete and continue</small></span><b>DONE</b></div></div>
      </div>
      <div className="auth-footer"><span>QUEUEFLOW · MADE FOR BETTER WAITING</span><span>© {new Date().getFullYear()}</span></div>
    </section>}
    <section className="auth-main"><button className="theme-auth" onClick={toggleTheme} title="Toggle color theme" aria-label="Toggle color theme">{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</button>
      {!aside && <Link to="/login" className="brand auth-mobile-brand"><span className="brand-mark">q.</span><span>queueflow</span></Link>}
      <div className="auth-form-wrap"><p className="eyebrow">{title}</p><h2>{subtitle}</h2>{children}</div>
      <div className="auth-main-footer"><span>QueueFlow is a management tool; no customer account needed.</span><Link to="/login"><ArrowLeft size={14} /> Back to sign in</Link></div>
    </section>
  </div>;
}

export function MetricCard({ label, value, note, icon: Icon, accent }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon ${accent || ''}`}><Icon size={17} /></span></div><div className="metric-value">{value ?? '—'}</div>{note && <div className="metric-note">{note}</div>}</div>;
}

export function StatusBadge({ status }) {
  return <span className={`status-badge status-${status?.toLowerCase()}`}><i />{status}</span>;
}

export function IconButton({ icon: Icon, label, ...props }) {
  return <button className="icon-button table-icon" aria-label={label} title={label} {...props}><Icon size={16} /></button>;
}

export const Icons = { ArrowDown, ArrowRight, ArrowUp, Check, Clock3, Plus, Search, X };
