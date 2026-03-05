import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export default function LoginPage() {
  const { login } = useAuth();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(searchParams.get('error') || '');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await login();
    } catch {
      setError('授权请求失败，请稍后重试');
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">工时管理系统</h1>
        <p className="login-subtitle">使用飞书账号登录以继续</p>
        {error && <div className="login-error">{error}</div>}
        <button
          onClick={handleLogin}
          className="login-btn"
          disabled={loading}
        >
          {loading ? '跳转中...' : '飞书登录'}
        </button>
      </div>
    </div>
  );
}
