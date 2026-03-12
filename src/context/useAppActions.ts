/**
 * 应用 Action Creators
 * 提供便捷的状态操作方法
 */

import { useCallback } from 'react';
import type { Project, OpenAIConfig } from '../types';
import { dataService } from '../services/DataService';
import { useAppDispatch } from './AppContext';
import type { AppView, PracticeMode, ToastType, DataLoadStatus } from './AppContext';

/**
 * useAppActions Hook
 * 提供封装好的状态操作方法
 */
export function useAppActions() {
  const dispatch = useAppDispatch();

  /**
   * 切换视图
   */
  const setView = useCallback(
    (view: AppView) => {
      dispatch({ type: 'SET_VIEW', payload: view });
    },
    [dispatch]
  );

  /**
   * 导航到项目列表
   */
  const goToProjects = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'projects' });
  }, [dispatch]);

  /**
   * 导航到术语库
   */
  const goToGlossary = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'glossary' });
  }, [dispatch]);

  /**
   * 导航到 Flashcard 复习
   */
  const goToFlashcards = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'flashcards' });
  }, [dispatch]);

  /**
   * 导航到笔记本列表
   */
  const goToNotebooks = useCallback(() => {
    dispatch({ type: 'SET_VIEW', payload: 'notebooks' });
  }, [dispatch]);

  /**
   * 导航到笔记本工作区
   */
  const goToNotebookWorkspace = useCallback(
    (notebookId: string) => {
      dispatch({ type: 'GO_TO_NOTEBOOK_WORKSPACE', payload: notebookId });
    },
    [dispatch]
  );

  /**
   * 设置当前项目
   */
  const setProject = useCallback(
    (project: Project | null) => {
      dispatch({ type: 'SET_PROJECT', payload: project });
    },
    [dispatch]
  );

  /**
   * 设置练习模式
   */
  const setPracticeMode = useCallback(
    (mode: PracticeMode) => {
      dispatch({ type: 'SET_PRACTICE_MODE', payload: mode });
    },
    [dispatch]
  );

  /**
   * 开始练习
   */
  const startPractice = useCallback(
    async (project: Project, mode: PracticeMode = 'zh-to-en') => {
      // 获取最新项目数据（含累计练习时间）
      const fresh = await dataService.getProject(project.id);
      dispatch({ type: 'START_PRACTICE', payload: { project: fresh ?? project, mode } });
    },
    [dispatch]
  );

  /**
   * 进入段落对齐编辑器
   */
  const startAlignEditor = useCallback(
    (project: Project, mode: PracticeMode = 'zh-to-en') => {
      dispatch({ type: 'START_ALIGN_EDITOR', payload: { project, mode } });
    },
    [dispatch]
  );

  /**
   * 退出练习
   */
  const exitPractice = useCallback(() => {
    dispatch({ type: 'EXIT_PRACTICE' });
  }, [dispatch]);

  /**
   * 切换翻译显示状态
   */
  const toggleTranslation = useCallback(
    (index: number) => {
      dispatch({ type: 'TOGGLE_TRANSLATION', payload: index });
    },
    [dispatch]
  );

  /**
   * 显示指定句子的翻译
   */
  const showTranslation = useCallback(
    (index: number) => {
      dispatch({ type: 'SHOW_TRANSLATION', payload: index });
    },
    [dispatch]
  );

  /**
   * 隐藏指定句子的翻译
   */
  const hideTranslation = useCallback(
    (index: number) => {
      dispatch({ type: 'HIDE_TRANSLATION', payload: index });
    },
    [dispatch]
  );

  /**
   * 显示所有翻译
   */
  const showAllTranslations = useCallback(
    (indices: number[]) => {
      dispatch({ type: 'SHOW_ALL_TRANSLATIONS', payload: indices });
    },
    [dispatch]
  );

  /**
   * 隐藏所有翻译
   */
  const hideAllTranslations = useCallback(() => {
    dispatch({ type: 'HIDE_ALL_TRANSLATIONS' });
  }, [dispatch]);

  /**
   * 设置加载状态
   */
  const setLoading = useCallback(
    (loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    },
    [dispatch]
  );

  /**
   * 设置错误信息
   */
  const setError = useCallback(
    (error: string | null) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    },
    [dispatch]
  );

  /**
   * 清除错误信息
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, [dispatch]);

  /**
   * 显示 Toast 消息
   */
  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    },
    [dispatch]
  );

  /**
   * 显示成功 Toast
   */
  const showSuccess = useCallback(
    (message: string) => {
      dispatch({ type: 'SHOW_TOAST', payload: { message, type: 'success' } });
    },
    [dispatch]
  );

  /**
   * 显示错误 Toast
   */
  const showError = useCallback(
    (message: string) => {
      dispatch({ type: 'SHOW_TOAST', payload: { message, type: 'error' } });
    },
    [dispatch]
  );

  /**
   * 隐藏 Toast
   */
  const hideToast = useCallback(() => {
    dispatch({ type: 'HIDE_TOAST' });
  }, [dispatch]);

  /**
   * 设置数据加载状态
   */
  const setDataLoadStatus = useCallback(
    (status: DataLoadStatus) => {
      dispatch({ type: 'SET_DATA_LOAD_STATUS', payload: status });
    },
    [dispatch]
  );

  /**
   * 使用空数据开始
   */
  const useEmptyData = useCallback(() => {
    dispatch({ type: 'USE_EMPTY_DATA' });
  }, [dispatch]);

  /**
   * 重试数据加载
   */
  const retryDataLoad = useCallback(() => {
    dispatch({ type: 'RETRY_DATA_LOAD' });
  }, [dispatch]);

  /**
   * 设置 OpenAI 配置
   */
  const setOpenAIConfig = useCallback(
    (config: OpenAIConfig | null) => {
      dispatch({ type: 'SET_OPENAI_CONFIG', payload: config });
    },
    [dispatch]
  );

  return {
    // 视图导航
    setView,
    goToProjects,
    goToGlossary,
    goToFlashcards,
    goToNotebooks,
    goToNotebookWorkspace,
    // 项目管理
    setProject,
    // 练习相关
    setPracticeMode,
    startPractice,
    startAlignEditor,
    exitPractice,
    // 翻译显示控制
    toggleTranslation,
    showTranslation,
    hideTranslation,
    showAllTranslations,
    hideAllTranslations,
    // 状态控制
    setLoading,
    setError,
    clearError,
    // Toast 消息
    showToast,
    showSuccess,
    showError,
    hideToast,
    // 数据加载
    setDataLoadStatus,
    useEmptyData,
    retryDataLoad,
    // OpenAI 配置
    setOpenAIConfig,
  };
}

export default useAppActions;
