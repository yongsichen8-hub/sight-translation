import { BrowserRouter, Routes, Route, Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { handleAuthCallback } from './services/api';
import { useEffect, useState } from 'react';
import TimesheetPage from './components/TimesheetPage';
import AdminPage from './components/AdminPage';
import AnalyticsPage from './components/AnalyticsPage';
import LoginPage from './components/LoginPage';
import './App.css';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// OAuth callback handler
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      handleAuthCallback(code, state)
        .then(() => {
          // Force reload to update auth state
          window.location.href = '/';
        })
        .catch(() => {
          setError('登录失败，请重试');
          setTimeout(() => navigate('/login?error=登录失败，请重试'), 2000);
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate]);

  if (error) return <div className="error-page">{error}</div>;
  return <div className="loading">正在登录...</div>;
}

// Navigation bar
function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="nav-left">
        <Link to="/" className="nav-link">工时填写</Link>
        <Link to="/admin" className="nav-link">管理</Link>
        <Link to="/analytics" className="nav-link">数据分析</Link>
      </div>
      <div className="nav-right">
        {user.avatar && <img src={user.avatar} alt="" className="nav-avatar" />}
        <span className="nav-username">{user.name}</span>
        <button onClick={handleLogout} className="nav-logout">退出</button>
      </div>
    </nav>
  );
}

function AppContent() {
  return (
    <>
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/" element={<ProtectedRoute><TimesheetPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
