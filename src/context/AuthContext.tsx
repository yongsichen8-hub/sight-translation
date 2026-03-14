import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { apiClient, AuthUser } from '../services/ApiClient';
import { setAuthState } from '../services/DataService';
import { db } from '../db';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isFirstLogin: boolean;
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setFirstLoginComplete: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentUser = await apiClient.getCurrentUser();
      setUser(currentUser);
      setAuthState(!!currentUser); // 同步认证状态到数据服务
    } catch {
      setUser(null);
      setAuthState(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(() => {
    // 获取登录 URL 并跳转
    apiClient.getLoginUrl().then(url => {
      window.location.href = url;
    }).catch(error => {
      console.error('获取登录 URL 失败:', error);
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
      setUser(null);
      setAuthState(false); // 同步认证状态到数据服务
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  }, []);

  const setFirstLoginComplete = useCallback(() => {
    setIsFirstLogin(false);
  }, []);

  // 应用启动时检查登录状态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 处理 OAuth 回调
  useEffect(() => {
    const handleCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (code && state && window.location.pathname === '/sight-translation/auth/callback') {
        try {
          setIsLoading(true);
          const authUser = await apiClient.handleCallback(code, state);
          setUser(authUser);
          
          // 只有本地有数据时才触发迁移提醒
          const localProjects = await db.projects.count();
          const localExpressions = await db.expressions.count();
          const localFlashcards = await db.flashcards.count();
          const hasLocalData = localProjects > 0 || localExpressions > 0 || localFlashcards > 0;
          setIsFirstLogin(hasLocalData);
          
          // 清除 URL 参数
          window.history.replaceState({}, '', '/sight-translation/');
        } catch (error) {
          console.error('OAuth 回调处理失败:', error);
          window.history.replaceState({}, '', '/sight-translation/');
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleCallback();
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    isFirstLogin,
    login,
    logout,
    checkAuth,
    setFirstLoginComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
