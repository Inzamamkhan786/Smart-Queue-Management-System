import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Clock3, GripVertical,
  LogOut, Plus, Search, Settings, Trash2, Users, UserRound, X
} from 'lucide-react';
import api from './api.js';
import { useApp } from './context.jsx';
import { AuthLayout, Button, EmptyState, IconButton, MetricCard, Notice, PageHeader, StatusBadge } from './components.jsx';

const LazyAnalyticsPanel = lazy(() => import('./AnalyticsPanel.jsx'));

const dateLabel = (value) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
const shortTime = (date) => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
const duration = (seconds) => {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const mins = Math.max(0, Math.round(Number(seconds) / 60));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

function AuthForm({ mode }) {
  const { setManager } = useApp();
  const navigate = useNavigate();
  const registering = mode === 'register';
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, values);
      setManager(data.manager);
      navigate('/');
    } catch (requestError) {
      setError(requestError.userMessage);
    } finally { setLoading(false); }
  }
  return <AuthLayout title={registering ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'} subtitle={registering ? 'Make room for better service.' : 'Good to have you back.'}>
    <p className="auth-hint">{registering ? 'Set up your manager workspace in just a moment.' : 'Sign in to pick up right where you left off.'}</p>
    <Notice>{error}</Notice>
    <form className="form-stack" onSubmit={submit}>
      {registering && <label className="field"><span>Your name</span><input autoComplete="name" required minLength="2" maxLength="100" placeholder="e.g. Alex Morgan" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} /></label>}
      <label className="field"><span>Email address</span><input type="email" autoComplete="email" required maxLength="254" placeholder="you@company.com" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} /></label>
      <label className="field"><span>Password</span><input type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength="8" maxLength="72" placeholder="At least 8 characters" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} /></label>
      <Button type="submit" disabled={loading} className="full-button">{loading ? 'Please wait…' : registering ? 'Create account' : 'Sign in'} <ArrowRight size={17} /></Button>
    </form>
    <div className="auth-switch">{registering ? 'Already have a workspace?' : 'New to QueueFlow?'} <Link to={registering ? '/login' : '/register'}>{registering ? 'Sign in' : 'Create an account'}</Link></div>
  </AuthLayout>;
}

export function Login() { return <AuthForm mode="login" />; }
export function Register() { return <AuthForm mode="register" />; }

function useQueueList() {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try { const { data } = await api.get('/queues'); setQueues(data.queues); }
    catch (requestError) { setError(requestError.userMessage); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { queues, setQueues, loading, error, reload };
}

function QueueDialog({ queue, onClose, onSaved }) {
  const [name, setName] = useState(queue?.name || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) return setError('Enter a queue name.');
    setSaving(true); setError('');
    try {
      if (queue) await api.put(`/queues/${queue.id}`, { name: name.trim() });
      else await api.post('/queues', { name: name.trim() });
      onSaved();
    } catch (requestError) { setError(requestError.userMessage); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="queue-modal-title">
      <div className="modal-heading"><div><p className="eyebrow">{queue ? 'QUEUE SETTINGS' : 'NEW QUEUE'}</p><h2 id="queue-modal-title">{queue ? 'Rename queue' : 'Create a queue'}</h2></div><IconButton icon={X} label="Close" onClick={onClose} /></div>
      <form className="form-stack" onSubmit={submit}><Notice>{error}</Notice><label className="field"><span>Queue name</span><input autoFocus required maxLength="80" placeholder="e.g. Customer service" value={name} onChange={(e) => setName(e.target.value)} /></label><div className="modal-actions"><Button type="button" variant="subtle" onClick={onClose}>Cancel</Button><Button disabled={saving}>{saving ? 'Saving…' : queue ? 'Save changes' : 'Create queue'}</Button></div></form>
    </div>
  </div>;
}

function QueueGrid({ queues, loading, onEdit, onDelete }) {
  if (loading) return <div className="loading-panel"><span className="spinner" /> Loading queues…</div>;
  if (!queues.length) return <EmptyState title="Your queues start here" text="Create a queue and add your first person to get the line moving." action={<Button onClick={onEdit}><Plus size={16} /> Create a queue</Button>} />;
  return <div className="queue-grid">{queues.map((queue, index) => <article className="queue-card" key={queue.id}>
    <div className="queue-card-head"><span className="queue-index">{String(index + 1).padStart(2, '0')}</span><div className="queue-actions"><button title="Rename queue" onClick={() => onEdit(queue)}><Settings size={16} /></button><button title="Delete queue" onClick={() => onDelete(queue)}><Trash2 size={16} /></button></div></div>
    <Link to={`/queues/${queue.id}`} className="queue-card-title">{queue.name}<ArrowRight size={17} /></Link>
    <p className="queue-meta">Created {dateLabel(String(queue.created_at).slice(0, 10))}</p>
    <div className="queue-stats"><div><strong>{queue.waiting}</strong><span>Waiting</span></div><div><strong>{queue.serving}</strong><span>Serving</span></div><div><strong>{queue.completed}</strong><span>Completed</span></div></div>
    <Link to={`/queues/${queue.id}`} className="queue-open">Open queue <ArrowRight size={14} /></Link>
  </article>)}</div>;
}

export function Queues() {
  const { queues, loading, error, reload } = useQueueList();
  const [dialog, setDialog] = useState(null);
  const [search, setSearch] = useState('');
  const filtered = queues.filter((queue) => queue.name.toLowerCase().includes(search.toLowerCase()));
  async function removeQueue(queue) {
    if (!window.confirm(`Delete “${queue.name}” and its token history? This cannot be undone.`)) return;
    try { await api.delete(`/queues/${queue.id}`); reload(); }
    catch (requestError) { window.alert(requestError.userMessage); }
  }
  return <><PageHeader eyebrow="YOUR WORKSPACE" title="My queues" description="Keep every line organized, all in one place." action={<Button onClick={() => setDialog({})}><Plus size={17} /> Create queue</Button>} />
    <div className="toolbar"><div className="search-box"><Search size={17} /><input placeholder="Find a queue…" value={search} onChange={(e) => setSearch(e.target.value)} /></div><span className="toolbar-count">{queues.length} {queues.length === 1 ? 'queue' : 'queues'}</span></div>
    <Notice>{error}</Notice>
    {filtered.length || loading ? <QueueGrid queues={filtered} loading={loading} onEdit={(queue) => setDialog(queue || {})} onDelete={removeQueue} /> : <EmptyState title={queues.length ? 'No matching queues' : 'Your queues start here'} text={queues.length ? 'Try another search.' : 'Create your first queue to start managing arrivals.'} action={!queues.length && <Button onClick={() => setDialog({})}><Plus size={16} /> Create a queue</Button>} />}
    {dialog && <QueueDialog queue={dialog.id ? dialog : null} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); reload(); }} />}
  </>;
}

function AnalyticsContent({ queueId, days }) {
  return <Suspense fallback={<div className="loading-panel"><span className="spinner" /> Gathering your numbers…</div>}>
    <LazyAnalyticsPanel queueId={queueId} days={days} />
  </Suspense>;
}

function DateFilter({ days, setDays }) {
  return <div className="segmented-control" aria-label="Select date range">{[1, 7, 30].map((value) => <button key={value} onClick={() => setDays(value)} className={days === value ? 'selected' : ''}>{value === 1 ? 'Today' : `${value} days`}</button>)}</div>;
}

function QueueSelector({ queues, value, onChange }) {
  return <select className="filter-select" value={value} onChange={(e) => onChange(e.target.value)}><option value="">All queues</option>{queues.map((queue) => <option value={queue.id} key={queue.id}>{queue.name}</option>)}</select>;
}

export function Analytics() {
  const { queues } = useQueueList();
  const [queueId, setQueueId] = useState('');
  const [days, setDays] = useState(7);
  return <><PageHeader eyebrow="MEASURE WHAT MATTERS" title="Analytics" description="A clearer picture of how your service is moving." action={<div className="filter-group"><QueueSelector queues={queues} value={queueId} onChange={setQueueId} /><DateFilter days={days} setDays={setDays} /></div>} />
    <AnalyticsContent queueId={queueId} days={days} />
  </>;
}

function TokensTable({ tokens, busy, onMove, onComplete, onCancel }) {
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const active = tokens.filter((token) => ['WAITING', 'SERVING'].includes(token.status)).sort((a, b) => a.position - b.position);
  const canMove = (token, direction) => {
    const index = active.findIndex((item) => item.id === token.id);
    return token.status === 'WAITING' && (direction === 'up' ? index > 0 && active[index - 1].status === 'WAITING' : index < active.length - 1 && active[index + 1].status === 'WAITING');
  };
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Token</th><th>Name</th><th>Joined at</th><th>Wait time</th><th>Status</th><th className="align-right">Actions</th></tr></thead>
    <tbody>{tokens.map((token) => <tr key={token.id}
      draggable={token.status === 'WAITING' && !busy}
      className={`${token.status === 'WAITING' ? 'token-row-draggable' : ''} ${draggedId === token.id ? 'token-row-dragging' : ''} ${dragOverId === token.id ? 'token-row-drag-over' : ''}`}
      onDragStart={(event) => {
        if (token.status !== 'WAITING' || busy) { event.preventDefault(); return; }
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', token.id);
        setDraggedId(token.id);
      }}
      onDragOver={(event) => {
        if (!draggedId || draggedId === token.id || token.status !== 'WAITING') return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOverId(token.id);
      }}
      onDragLeave={() => setDragOverId(null)}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData('text/plain') || draggedId;
        setDragOverId(null);
        setDraggedId(null);
        if (!sourceId || sourceId === token.id || token.status !== 'WAITING') return;
        const rect = event.currentTarget.getBoundingClientRect();
        const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
        const source = tokens.find((item) => item.id === sourceId);
        if (source?.status === 'WAITING') onMove(source, { targetTokenId: token.id, placement });
      }}
      onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}>
      <td><span className="token-number-wrap">{token.status === 'WAITING' && <GripVertical className="drag-handle" size={14} aria-hidden="true" />}<span className="token-number">#{String(token.token_number).padStart(3, '0')}</span></span></td><td><strong className="person-name">{token.person_name}</strong>{token.phone && <small className="person-phone">{token.phone}</small>}</td>
      <td>{shortTime(token.created_at)}</td><td>{duration(token.wait_seconds)}</td><td><StatusBadge status={token.status} /></td>
      <td><div className="row-actions">{token.status === 'WAITING' && <>
        <IconButton icon={ArrowUp} label="Move up" disabled={!canMove(token, 'up') || busy} onClick={() => onMove(token, 'up')} />
        <IconButton icon={ArrowDown} label="Move down" disabled={!canMove(token, 'down') || busy} onClick={() => onMove(token, 'down')} />
        <IconButton icon={X} label="Cancel token" disabled={busy} onClick={() => onCancel(token)} />
      </>}{token.status === 'SERVING' && <Button variant="subtle" className="complete-button" disabled={busy} onClick={() => onComplete(token)}><Check size={15} /> Complete</Button>}</div></td>
    </tr>)}</tbody></table>
    {!tokens.length && <EmptyState title="No tokens yet" text="Add someone to this queue and they will show up here." />}
  </div>;
}

export function QueueDetail() {
  const { id } = useParams();
  const [queue, setQueue] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = useCallback(async () => {
    setError('');
    try {
      const [queueResponse, tokenResponse] = await Promise.all([api.get(`/queues/${id}`), api.get(`/queues/${id}/tokens`)]);
      setQueue(queueResponse.data.queue); setTokens(tokenResponse.data.tokens);
    } catch (requestError) { setError(requestError.userMessage); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  async function action(operation, message) {
    setSaving(true); setError(''); setSuccess('');
    try { await operation(); setSuccess(message); await load(); }
    catch (requestError) { setError(requestError.userMessage); }
    finally { setSaving(false); }
  }
  async function addToken(event) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.post(`/queues/${id}/tokens`, { personName: name.trim(), phone: phone.trim() || null });
      setName(''); setPhone(''); setSuccess('Token added to the queue.'); await load();
    } catch (requestError) { setError(requestError.userMessage); }
    finally { setSaving(false); }
  }
  if (loading) return <div className="loading-panel"><span className="spinner" /> Loading queue…</div>;
  if (!queue) return <><PageHeader eyebrow="QUEUE" title="Queue unavailable" /><Notice>{error || 'This queue could not be found.'}</Notice><Link className="back-link" to="/queues"><ArrowLeft size={16} /> All queues</Link></>;
  const serving = tokens.find((token) => token.status === 'SERVING');
  const waiting = tokens.filter((token) => token.status === 'WAITING');
  const todayTokens = tokens.filter((token) => new Date(token.created_at).toDateString() === new Date().toDateString()).length;
  return <>
    <Link className="back-link" to="/queues"><ArrowLeft size={16} /> All queues</Link>
    <PageHeader eyebrow="QUEUE MANAGEMENT" title={queue.name} description="Add arrivals, keep the line in order, and serve the next person." action={<Button onClick={() => action(() => api.patch(`/queues/${id}/serve-next`), 'Next person is now being served.')} disabled={saving || !waiting.length || !!serving}><ArrowRight size={17} /> Serve next</Button>} />
    <Notice>{error}</Notice><Notice type="success">{success}</Notice>
    <div className="queue-detail-metrics"><MetricCard label="Waiting" value={queue.waiting} note="In the line" icon={Clock3} accent="accent-amber" /><MetricCard label="Serving" value={queue.serving} note="Being helped now" icon={Activity} accent="accent-green" /><MetricCard label="Completed" value={queue.completed} note="All time" icon={Check} /><MetricCard label="Today’s arrivals" value={todayTokens} note={`${queue.total} total tokens`} icon={Users} /></div>
    <div className="token-workspace">
      <section className="add-token-panel"><div className="section-title"><span className="panel-icon"><Plus size={17} /></span><div><h3>Add someone</h3><p>Create the next token in this queue.</p></div></div>
        <form className="add-token-form" onSubmit={addToken}><label className="field"><span>Person’s name</span><input required maxLength="100" placeholder="e.g. Jordan Lee" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Phone number <small>Optional</small></span><input type="tel" maxLength="30" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} /></label><Button disabled={saving || !name.trim()}><Plus size={16} /> Add to queue</Button>
        </form>
      </section>
      <section className="serving-panel"><div className="section-title"><span className="panel-icon serving-icon"><Activity size={17} /></span><div><h3>Now serving</h3><p>{serving ? 'Currently at the front of the line.' : 'No one is being served right now.'}</p></div></div>
        {serving ? <div className="serving-person"><span className="serving-ticket">#{String(serving.token_number).padStart(3, '0')}</span><div><strong>{serving.person_name}</strong><small>Started at {shortTime(serving.service_started_at)}</small></div><Button variant="subtle" disabled={saving} onClick={() => action(() => api.patch(`/tokens/${serving.id}/complete`), 'Token marked complete.')}><Check size={16} /> Complete</Button></div> : <div className="no-serving">Serve the next person when you’re ready.</div>}
      </section>
    </div>
    <section className="tokens-panel"><div className="tokens-heading"><div><h3>Queue activity</h3><p>{waiting.length} waiting · {queue.total} total tokens</p></div><span className="history-note">Token history is preserved</span></div>
      <TokensTable tokens={tokens} busy={saving} onMove={(token, move) => action(() => api.patch(`/tokens/${token.id}/move`, typeof move === 'string' ? { direction: move } : move), 'Queue order updated.')} onComplete={(token) => action(() => api.patch(`/tokens/${token.id}/complete`), 'Token marked complete.')} onCancel={(token) => action(() => api.patch(`/tokens/${token.id}/cancel`), 'Token cancelled.')} />
    </section>
  </>;
}

export function Dashboard() {
  const { manager } = useApp();
  const { queues, loading, error } = useQueueList();
  const [analyticsQueue, setAnalyticsQueue] = useState('');
  const [days, setDays] = useState(7);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const waitingTotal = queues.reduce((sum, item) => sum + Number(item.waiting), 0);
  const servingTotal = queues.reduce((sum, item) => sum + Number(item.serving), 0);
  const completedTotal = queues.reduce((sum, item) => sum + Number(item.completed), 0);
  return <>
    <div className="welcome-strip"><div><p className="eyebrow">OVERVIEW</p><h1>{greeting}, {manager?.name?.split(' ')[0]}.</h1><p>Here’s how things are moving across your workspace.</p></div><div className="welcome-date"><span className="live-dot" /> Everything in its place</div></div>
    <Notice>{error}</Notice>
    <div className="metric-grid overview-metrics">
      <MetricCard label="Total queues" value={loading ? '—' : queues.length} note="Ready to serve" icon={Users} />
      <MetricCard label="Currently waiting" value={loading ? '—' : waitingTotal} note="Across all queues" icon={Clock3} accent="accent-amber" />
      <MetricCard label="Currently serving" value={loading ? '—' : servingTotal} note="Being helped now" icon={Activity} accent="accent-green" />
      <MetricCard label="Completed" value={loading ? '—' : completedTotal} note="All time" icon={Check} />
    </div>
    <section className="dashboard-queues"><div className="section-heading"><div><p className="eyebrow">YOUR WORKSPACE</p><h2>Queues at a glance</h2></div><Link className="text-link" to="/queues">View all queues <ArrowRight size={15} /></Link></div>
      {!loading && queues.length === 0 ? <EmptyState title="Start with a queue" text="Create a space for your next line and start welcoming people." action={<Link className="button button-primary" to="/queues"><Plus size={16} /> Create your first queue</Link>} /> :
        <div className="overview-list">{queues.slice(0, 4).map((queue) => <Link to={`/queues/${queue.id}`} className="overview-queue" key={queue.id}><span className="overview-queue-icon"><Users size={18} /></span><span className="overview-queue-name"><strong>{queue.name}</strong><small>{queue.total} people added</small></span><span className="overview-wait"><b>{queue.waiting}</b><small>waiting</small></span><span className="overview-serving"><b>{queue.serving}</b><small>serving</small></span><ArrowRight className="overview-arrow" size={17} /></Link>)}</div>}
    </section>
    <div className="dashboard-analytics-heading"><div><p className="eyebrow">LIVE PICTURE</p><h2>Service activity</h2></div><div className="filter-group"><QueueSelector queues={queues} value={analyticsQueue} onChange={setAnalyticsQueue} /><DateFilter days={days} setDays={setDays} /></div></div>
    <AnalyticsContent queueId={analyticsQueue} days={days} />
  </>;
}

export function SettingsPage() {
  const { manager, setManager, signOut } = useApp();
  const [name, setName] = useState(manager?.name || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try { const { data } = await api.patch('/auth/me', { name: name.trim() }); setManager(data.manager); setSuccess('Your profile was updated.'); }
    catch (requestError) { setError(requestError.userMessage); }
    finally { setSaving(false); }
  }
  return <><PageHeader eyebrow="YOUR ACCOUNT" title="Settings" description="Manage your profile and QueueFlow preferences." />
    <Notice>{error}</Notice><Notice type="success">{success}</Notice>
    <section className="settings-card"><div className="section-title"><span className="panel-icon"><UserRound size={17} /></span><div><h3>Manager profile</h3><p>Your details used across this workspace.</p></div></div>
      <form className="settings-form" onSubmit={submit}><label className="field"><span>Full name</span><input required minLength="2" maxLength="100" value={name} onChange={(e) => setName(e.target.value)} /></label><label className="field"><span>Email address</span><input disabled value={manager?.email || ''} /><small className="field-help">Email address cannot be changed here.</small></label><div><Button disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div></form>
    </section>
    <section className="settings-card account-card"><div><h3>Sign out</h3><p>End your current manager session on this device.</p></div><Button variant="subtle" onClick={async () => { try { await signOut(); window.location.assign('/login'); } catch (requestError) { setError(requestError.userMessage); } }}><LogOut size={16} /> Sign out</Button></section>
  </>;
}
