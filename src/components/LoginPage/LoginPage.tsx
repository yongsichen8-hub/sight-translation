import React, { useState, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import './LoginPage.css';

type AuthMode = 'login' | 'register';

export const LoginPage: React.FC = () => {
  const { login, register, isLoading, authError, clearError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setLocalError('');
    clearError();
    setUsername('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!username.trim() || !password) {
      setLocalError('请输入用户名和密码');
      return;
    }

    if (mode === 'register') {
      if (username.trim().length < 2 || username.trim().length > 30) {
        setLocalError('用户名长度必须为 2-30 个字符');
        return;
      }
      if (password.length < 6) {
        setLocalError('密码长度至少 6 个字符');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('两次密码输入不一致');
        return;
      }
    }

    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch {
      // error is handled by AuthContext
    }
  };

  const displayError = localError || authError;

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>视译练习平台</h1>
          <p>Sight Translation Trainer</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'login' ? 'login-tab--active' : ''}`}
            onClick={() => switchMode('login')}
            type="button"
          >
            登录
          </button>
          <button
            className={`login-tab ${mode === 'register' ? 'login-tab--active' : ''}`}
            onClick={() => switchMode('register')}
            type="button"
          >
            注册
          </button>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="username">用户名</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === 'register' ? '2-30 个字符' : '请输入用户名'}
              autoComplete="username"
              required
              disabled={isLoading}
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">密码</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 个字符' : '请输入密码'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              required
              disabled={isLoading}
            />
          </div>

          {mode === 'register' && (
            <div className="login-field">
              <label htmlFor="confirmPassword">确认密码</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                autoComplete="new-password"
                required
                disabled={isLoading}
              />
            </div>
          )}

          {displayError && (
            <p className="login-error" role="alert">{displayError}</p>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={isLoading}
          >
            {isLoading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
          </button>
        </form>

        <div className="login-footer">
          <p>
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              className="login-switch-btn"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              type="button"
            >
              {mode === 'login' ? '去注册' : '去登录'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
