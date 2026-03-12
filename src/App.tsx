import { useEffect, useCallback } from 'react';
import { AppProvider, useAppState } from './context/AppContext';
import { useAppActions } from './context/useAppActions';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProjectManager } from './components/ProjectManager';
import { PracticeView } from './components/PracticeView';
import { GlossaryManager } from './components/GlossaryManager';
import { FlashcardReview } from './components/FlashcardReview';
import { NotebookListPage } from './components/Notebook/NotebookListPage';
import { NotebookWorkspace } from './components/Notebook/NotebookWorkspace';
import { UserMenu } from './components/UserMenu/UserMenu';
import { MigrationDialog } from './components/MigrationDialog/MigrationDialog';
import { Toast, Button } from './components/common';
import { initializeDatabase } from './db';
import './App.css';

/**
 * 应用导航栏
 */
function AppNav() {
  const { currentView } = useAppState();
  const { goToProjects, goToGlossary, goToFlashcards, goToNotebooks } = useAppActions();
  const { isAuthenticated, login } = useAuth();

  return (
    <nav className="app-nav">
      <div className="app-nav__brand">
        <h1 className="app-nav__title">视译练习</h1>
      </div>
      <div className="app-nav__links">
        <button
          className={`app-nav__link ${currentView === 'projects' ? 'app-nav__link--active' : ''}`}
          onClick={goToProjects}
        >
          项目
        </button>
        <button
          className={`app-nav__link ${currentView === 'glossary' ? 'app-nav__link--active' : ''}`}
          onClick={goToGlossary}
        >
          术语库
        </button>
        <button
          className={`app-nav__link ${currentView === 'flashcards' ? 'app-nav__link--active' : ''}`}
          onClick={goToFlashcards}
        >
          复习
        </button>
        <button
          className={`app-nav__link ${(currentView === 'notebooks' || currentView === 'notebook-workspace') ? 'app-nav__link--active' : ''}`}
          onClick={goToNotebooks}
        >
          笔记本
        </button>
      </div>
      <div className="app-nav__user">
        {isAuthenticated ? (
          <UserMenu />
        ) : (
          <button className="app-nav__login-btn" onClick={login}>
            飞书登录
          </button>
        )}
      </div>
    </nav>
  );
}

/**
 * 应用主内容区
 */
function AppContent() {
  const { currentView, dataLoadStatus, error } = useAppState();
  const { setDataLoadStatus, setError, useEmptyData, retryDataLoad } = useAppActions();
  const { isFirstLogin, setFirstLoginComplete } = useAuth();

  const initializeDb = useCallback(async () => {
    try {
      setDataLoadStatus('loading');
      await initializeDatabase();
      setDataLoadStatus('success');
    } catch (err) {
      console.error('Database initialization failed:', err);
      setError('数据库初始化失败，请检查浏览器是否支持 IndexedDB');
      setDataLoadStatus('error');
    }
  }, [setDataLoadStatus, setError]);

  useEffect(() => {
    initializeDb();
  }, [initializeDb]);

  const handleRetry = useCallback(() => {
    retryDataLoad();
    initializeDb();
  }, [retryDataLoad, initializeDb]);

  const handleUseEmptyData = useCallback(() => {
    useEmptyData();
  }, [useEmptyData]);

  if (dataLoadStatus === 'loading') {
    return (
      <main className="app-main">
        <div className="app-loading">
          <div className="app-loading__spinner" />
          <p className="app-loading__text">正在初始化应用...</p>
        </div>
      </main>
    );
  }

  if (dataLoadStatus === 'error') {
    return (
      <main className="app-main">
        <div className="app-error">
          <div className="app-error__icon">⚠️</div>
          <h2 className="app-error__title">数据加载失败</h2>
          <p className="app-error__message">{error || '无法连接到本地数据库'}</p>
          <div className="app-error__actions">
            <Button onClick={handleRetry}>重试</Button>
            <Button variant="secondary" onClick={handleUseEmptyData}>
              使用空数据开始
            </Button>
          </div>
          <p className="app-error__hint">
            提示：选择"使用空数据开始"将创建新的数据库，之前的数据可能无法恢复。
          </p>
        </div>
      </main>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'projects':
        return <ProjectManager />;
      case 'practice':
        return <PracticeView />;
      case 'align-editor':
        return <PracticeView />;
      case 'glossary':
        return <GlossaryManager />;
      case 'flashcards':
        return <FlashcardReview />;
      case 'notebooks':
        return <NotebookListPage />;
      case 'notebook-workspace':
        return <NotebookWorkspace />;
      default:
        return <ProjectManager />;
    }
  };

  return (
    <>
      <main className="app-main">{renderView()}</main>
      <MigrationDialog
        visible={isFirstLogin}
        onClose={setFirstLoginComplete}
        onComplete={setFirstLoginComplete}
      />
    </>
  );
}

/**
 * 全局 Toast 组件
 */
function GlobalToast() {
  const { toast } = useAppState();
  const { hideToast } = useAppActions();

  if (!toast) return null;

  return (
    <Toast
      key={toast.id}
      visible={true}
      message={toast.message}
      type={toast.type}
      onClose={hideToast}
      duration={3000}
    />
  );
}

/**
 * 应用根组件
 */
function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <div className="app">
          <AppNav />
          <AppContent />
          <GlobalToast />
        </div>
      </AppProvider>
    </AuthProvider>
  );
}

export default App;
