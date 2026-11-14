import { Navigate, Route, Routes } from 'react-router-dom';
import { useApp } from './context.jsx';
import { Shell } from './components.jsx';
import { Analytics, Dashboard, Login, QueueDetail, Queues, Register, SettingsPage } from './pages.jsx';

function Protected({ children }) {
  const { manager, authLoading } = useApp();
  if (authLoading) return <div className="loading-screen"><span className="spinner" /> Loading QueueFlow</div>;
  return manager ? <Shell>{children}</Shell> : <Navigate to="/login" replace />;
}

export default function App() {
  const { manager, authLoading } = useApp();
  if (authLoading) return <div className="loading-screen"><span className="spinner" /> Loading QueueFlow</div>;
  return <Routes>
    <Route path="/login" element={manager ? <Navigate to="/" replace /> : <Login />} />
    <Route path="/register" element={manager ? <Navigate to="/" replace /> : <Register />} />
    <Route path="/" element={<Protected><Dashboard /></Protected>} />
    <Route path="/queues" element={<Protected><Queues /></Protected>} />
    <Route path="/queues/:id" element={<Protected><QueueDetail /></Protected>} />
    <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
    <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
    <Route path="*" element={<Navigate to={manager ? '/' : '/login'} replace />} />
  </Routes>;
}
