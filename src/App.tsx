import { useEffect, useCallback } from 'react';
import { AppProvider, useAppState } from './context/AppContext';
import { useAppActions } from './context/useAppActions';
import { ProjectManager } from './components/ProjectManager';
import { PracticeView } from './components/PracticeView';
import { GlossaryManager } from './components/GlossaryManager';
import { FlashcardReview } from './components/FlashcardReview';
import { Toast, Button } from './components/common';
import { initializeDatabase } from './db';
import './App.css';

/**
 * 应用导航栏
 */
function AppNav() {
  const { currentView } = useAppState();
  const { goToProjects, goToGlossary, goToFlashcards } = useAppActions();

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
      </div>
      <div className="app-nav__user">
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

  /**
   * 初始化数据库连接
   */
  const initializeDb = useCallback(async () => {
    try {
      setDataLoadStatus('loading');
      // 尝试打开数据库连接
      await initializeDatabase();
      setDataLoadStatus('success');
    } catch (err) {
      console.error('Database initialization failed:', err);
      setError('数据库初始化失败，请检查浏览器是否支持 IndexedDB');
      setDataLoadStatus('error');
    }
  }, [setDataLoadStatus, setError]);

  // 初始化数据库
  useEffect(() => {
    initializeDb();
  }, [initializeDb]);

  /**
   * 处理重试
   */
  const handleRetry = useCallback(() => {
    retryDataLoad();
    initializeDb();
  }, [retryDataLoad, initializeDb]);

  /**
   * 处理使用空数据
   */
  const handleUseEmptyData = useCallback(() => {
    useEmptyData();
  }, [useEmptyData]);

  // 数据加载中
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

  // 数据加载失败
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
      default:
        return <ProjectManager />;
    }
  };

  return <main className="app-main">{renderView()}</main>;
}

/**
 * 全局 Toast 组件
 */
function GlobalToast() {
  const { toast } = useAppState();
  const { hideToast } = useAppActions();

  if (!toast) {
    return null;
  }

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
 * 应用根组件（无需登录）
 */
function App() {
  return (
    <AppProvider>
      <div className="app">
        <AppNav />
        <AppContent />
        <GlobalToast />
      </div>
    </AppProvider>
  );
}

export default App;
