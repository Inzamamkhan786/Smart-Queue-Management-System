import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Activity, Check, Clock3, Hash, Users, X } from 'lucide-react';
import api from './api.js';
import { MetricCard, Notice } from './components.jsx';

const dateLabel = (value) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
const duration = (seconds) => {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const mins = Math.max(0, Math.round(Number(seconds) / 60));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

function ChartPanel({ title, subtitle, children, className = '' }) {
  return <section className={`chart-panel ${className}`}><div className="chart-heading"><div><h3>{title}</h3><p>{subtitle}</p></div></div>{children}</section>;
}

const chartTooltip = { contentStyle: { borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: 12 }, labelStyle: { color: 'var(--muted)' } };
const COLORS = ['#b77844', '#6e9a80', '#6e82a2', '#b96b5d'];

export default function AnalyticsPanel({ queueId, days }) {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [distribution, setDistribution] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams({ days: String(days) });
    if (queueId) query.set('queueId', queueId);
    Promise.all([api.get(`/analytics/overview?${query}`), api.get(`/analytics/trends?${query}`)])
      .then(([overviewResponse, trendResponse]) => {
        if (!active) return;
        setOverview(overviewResponse.data.overview);
        setTrends(trendResponse.data.trends);
        setDistribution(trendResponse.data.distribution);
      })
      .catch((requestError) => { if (active) setError(requestError.userMessage); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queueId, days]);
  const chartData = useMemo(() => trends.map((item) => ({
    ...item, dayLabel: dateLabel(String(item.day).slice(0, 10)), average_wait_minutes: item.average_wait_seconds == null ? null : Math.round(item.average_wait_seconds / 60)
  })), [trends]);
  const statusData = ['WAITING', 'SERVING', 'COMPLETED', 'CANCELLED'].map((status) => ({
    name: status.charAt(0) + status.slice(1).toLowerCase(),
    value: Number(distribution.find((item) => item.status === status)?.count || 0)
  }));
  const metrics = [
    { label: 'Total queues', value: overview?.total_queues, note: 'In your workspace', icon: Users },
    { label: 'Total tokens', value: overview?.total_tokens, note: 'All time', icon: Hash },
    { label: 'Currently waiting', value: overview?.waiting, note: 'Across active queues', icon: Clock3 },
    { label: 'Currently serving', value: overview?.serving, note: 'Being helped now', icon: Activity },
    { label: 'Completed today', value: overview?.completed_today, note: 'Since midnight', icon: Check },
    { label: 'Cancelled today', value: overview?.cancelled_today, note: 'Since midnight', icon: X },
    { label: 'Average wait', value: duration(overview?.average_wait_seconds), note: `Last ${days} days · started service`, icon: Clock3 }
  ];
  return <>
    <Notice>{error}</Notice>
    {loading && !overview ? <div className="loading-panel"><span className="spinner" /> Gathering your numbers…</div> : <>
      <div className="metric-grid">{metrics.map((metric, i) => <MetricCard key={metric.label} {...metric} accent={i === 2 ? 'accent-amber' : i === 3 ? 'accent-green' : ''} />)}</div>
      <div className="charts-grid">
        <ChartPanel title="Queue length trend" subtitle="People waiting, across your queues" className="chart-wide">
          {chartData.length ? <ResponsiveContainer width="100%" height={250}><AreaChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="dayLabel" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip {...chartTooltip} /><Area type="monotone" dataKey="waiting" name="Waiting" stroke="#b77844" strokeWidth={2} fill="#b77844" fillOpacity={0.11} /></AreaChart></ResponsiveContainer> : <div className="chart-empty">Queue data will appear here as you serve people.</div>}
        </ChartPanel>
        <ChartPanel title="Daily token volume" subtitle="New arrivals each day">
          {chartData.some((item) => item.volume) ? <ResponsiveContainer width="100%" height={250}><BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="dayLabel" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip {...chartTooltip} /><Bar dataKey="volume" name="Tokens" fill="#6e9a80" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">New token activity will show here.</div>}
        </ChartPanel>
        <ChartPanel title="Average waiting time" subtitle="Time from joining to service">
          {chartData.some((item) => item.average_wait_minutes !== null) ? <ResponsiveContainer width="100%" height={250}><LineChart data={chartData} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="dayLabel" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip {...chartTooltip} /><Line type="monotone" dataKey="average_wait_minutes" name="Minutes" stroke="#6e82a2" strokeWidth={2} dot={{ r: 3, fill: '#6e82a2' }} connectNulls /></LineChart></ResponsiveContainer> : <div className="chart-empty">Waiting time is available once a token enters service.</div>}
        </ChartPanel>
        <ChartPanel title="Token status" subtitle="All-time distribution">
          {statusData.some((item) => item.value) ? <div className="donut-wrap"><ResponsiveContainer width="100%" height={210}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={83} paddingAngle={3} stroke="none">{statusData.map((item, index) => <Cell key={item.name} fill={COLORS[index]} />)}</Pie><Tooltip {...chartTooltip} /></PieChart></ResponsiveContainer><div className="donut-legend">{statusData.map((item, i) => <div key={item.name}><i style={{ background: COLORS[i] }} /><span>{item.name}</span><b>{item.value}</b></div>)}</div></div> : <div className="chart-empty">Status distribution will appear once tokens are created.</div>}
        </ChartPanel>
      </div>
    </>}
  </>;
}
