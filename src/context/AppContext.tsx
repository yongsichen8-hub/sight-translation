/**
 * 应用状态管理
 * 使用 React Context + useReducer 实现全局状态管理
 */

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { Project, OpenAIConfig } from '../types';
import type { NewsEntry } from '../types/briefing';

/**
 * 应用视图类型
 */
export type AppView = 'projects' | 'practice' | 'glossary' | 'flashcards' | 'align-editor' | 'briefing' | 'study-session' | 'term-library' | 'notebooks' | 'notebook-workspace';

/**
 * 练习模式类型
 */
export type PracticeMode = 'zh-to-en' | 'en-to-zh';

/**
 * Toast 类型
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast 消息
 */
export interface ToastMessage {
  /** 消息内容 */
  message: string;
  /** Toast 类型 */
  type: ToastType;
  /** 唯一标识 */
  id: string;
}

/**
 * 数据加载状态
 */
export type DataLoadStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * 应用全局状态
 */
export interface AppState {
  /** 当前视图 */
  currentView: AppView;
  /** 当前项目 */
  currentProject: Project | null;
  /** 练习模式 */
  practiceMode: PracticeMode;
  /** 显示翻译的段落索引集合 */
  visibleTranslations: Set<number>;
  /** 加载状态 */
  isLoading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 全局 Toast 消息 */
  toast: ToastMessage | null;
  /** 数据加载状态 */
  dataLoadStatus: DataLoadStatus;
  /** 是否使用空数据模式 */
  useEmptyData: boolean;
  /** OpenAI 配置 */
  openAIConfig: OpenAIConfig | null;
  /** 当前研习的新闻条目（从简报页面传入） */
  studyNewsEntry: NewsEntry | null;
  /** 当前选中的笔记本项目 ID */
  selectedNotebookId: string | null;
}

/**
 * Action 类型定义
 */
export type AppAction =
  | { type: 'SET_VIEW'; payload: AppView }
  | { type: 'SET_PROJECT'; payload: Project | null }
  | { type: 'SET_PRACTICE_MODE'; payload: PracticeMode }
  | { type: 'TOGGLE_TRANSLATION'; payload: number }
  | { type: 'SHOW_TRANSLATION'; payload: number }
  | { type: 'HIDE_TRANSLATION'; payload: number }
  | { type: 'SHOW_ALL_TRANSLATIONS'; payload: number[] }
  | { type: 'HIDE_ALL_TRANSLATIONS' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_ERROR' }
  | { type: 'START_PRACTICE'; payload: { project: Project; mode: PracticeMode } }
  | { type: 'EXIT_PRACTICE' }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: ToastType } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_DATA_LOAD_STATUS'; payload: DataLoadStatus }
  | { type: 'USE_EMPTY_DATA' }
  | { type: 'RETRY_DATA_LOAD' }
  | { type: 'SET_OPENAI_CONFIG'; payload: OpenAIConfig | null }
  | { type: 'START_ALIGN_EDITOR'; payload: { project: Project; mode: PracticeMode } }
  | { type: 'START_STUDY_SESSION'; payload: NewsEntry }
  | { type: 'EXIT_STUDY_SESSION' }
  | { type: 'GO_TO_NOTEBOOK_WORKSPACE'; payload: string };

/**
 * 初始状态
 */
export const initialState: AppState = {
  currentView: 'projects',
  currentProject: null,
  practiceMode: 'zh-to-en',
  visibleTranslations: new Set<number>(),
  isLoading: false,
  error: null,
  toast: null,
  dataLoadStatus: 'idle',
  useEmptyData: false,
  openAIConfig: null,
  studyNewsEntry: null,
  selectedNotebookId: null,
};

/**
 * 生成唯一 ID
 */
function generateToastId(): string {
  return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reducer 函数
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return {
        ...state,
        currentView: action.payload,
        // 切换视图时清除错误
        error: null,
      };

    case 'SET_PROJECT':
      return {
        ...state,
        currentProject: action.payload,
        // 切换项目时重置翻译显示状态
        visibleTranslations: new Set<number>(),
      };

    case 'SET_PRACTICE_MODE':
      return {
        ...state,
        practiceMode: action.payload,
        // 切换模式时重置翻译显示状态
        visibleTranslations: new Set<number>(),
      };

    case 'TOGGLE_TRANSLATION': {
      const newSet = new Set(state.visibleTranslations);
      if (newSet.has(action.payload)) {
        newSet.delete(action.payload);
      } else {
        newSet.add(action.payload);
      }
      return {
        ...state,
        visibleTranslations: newSet,
      };
    }

    case 'SHOW_TRANSLATION': {
      const newSet = new Set(state.visibleTranslations);
      newSet.add(action.payload);
      return {
        ...state,
        visibleTranslations: newSet,
      };
    }

    case 'HIDE_TRANSLATION': {
      const newSet = new Set(state.visibleTranslations);
      newSet.delete(action.payload);
      return {
        ...state,
        visibleTranslations: newSet,
      };
    }

    case 'SHOW_ALL_TRANSLATIONS':
      return {
        ...state,
        visibleTranslations: new Set(action.payload),
      };

    case 'HIDE_ALL_TRANSLATIONS':
      return {
        ...state,
        visibleTranslations: new Set<number>(),
      };

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'START_PRACTICE':
      return {
        ...state,
        currentView: 'practice',
        currentProject: action.payload.project,
        practiceMode: action.payload.mode,
        visibleTranslations: new Set<number>(),
        error: null,
      };

    case 'EXIT_PRACTICE':
      return {
        ...state,
        currentView: 'projects',
        currentProject: null,
        visibleTranslations: new Set<number>(),
      };

    case 'SHOW_TOAST':
      return {
        ...state,
        toast: {
          message: action.payload.message,
          type: action.payload.type,
          id: generateToastId(),
        },
      };

    case 'HIDE_TOAST':
      return {
        ...state,
        toast: null,
      };

    case 'SET_DATA_LOAD_STATUS':
      return {
        ...state,
        dataLoadStatus: action.payload,
        // 加载成功时清除错误
        error: action.payload === 'success' ? null : state.error,
      };

    case 'USE_EMPTY_DATA':
      return {
        ...state,
        useEmptyData: true,
        dataLoadStatus: 'success',
        error: null,
      };

    case 'RETRY_DATA_LOAD':
      return {
        ...state,
        useEmptyData: false,
        dataLoadStatus: 'loading',
        error: null,
      };

    case 'SET_OPENAI_CONFIG':
      return {
        ...state,
        openAIConfig: action.payload,
      };

    case 'START_ALIGN_EDITOR':
      return {
        ...state,
        currentView: 'align-editor',
        currentProject: action.payload.project,
        practiceMode: action.payload.mode,
        visibleTranslations: new Set<number>(),
        error: null,
      };

    case 'START_STUDY_SESSION':
      return {
        ...state,
        currentView: 'study-session',
        studyNewsEntry: action.payload,
        error: null,
      };

    case 'EXIT_STUDY_SESSION':
      return {
        ...state,
        currentView: 'briefing',
        studyNewsEntry: null,
      };

    case 'GO_TO_NOTEBOOK_WORKSPACE':
      return {
        ...state,
        currentView: 'notebook-workspace',
        selectedNotebookId: action.payload,
        error: null,
      };

    default:
      return state;
  }
}

/**
 * Context 类型
 */
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

/**
 * 创建 Context
 */
const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Provider 组件 Props
 */
interface AppProviderProps {
  children: ReactNode;
  /** 可选的初始状态，用于测试 */
  initialState?: AppState | undefined;
}

/**
 * AppProvider 组件
 * 提供全局状态管理
 */
export function AppProvider({ children, initialState: customInitialState }: AppProviderProps) {
  const [state, dispatch] = useReducer(
    appReducer,
    customInitialState ?? initialState
  );

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * useAppContext Hook
 * 获取应用状态和 dispatch 函数
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

/**
 * useAppState Hook
 * 仅获取应用状态
 */
export function useAppState(): AppState {
  const { state } = useAppContext();
  return state;
}

/**
 * useAppDispatch Hook
 * 仅获取 dispatch 函数
 */
export function useAppDispatch(): React.Dispatch<AppAction> {
  const { dispatch } = useAppContext();
  return dispatch;
}

export default AppContext;
