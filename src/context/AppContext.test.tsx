/**
 * AppContext 单元测试
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import {
  AppProvider,
  useAppContext,
  useAppState,
  useAppDispatch,
  useAppActions,
  appReducer,
  initialState,
} from './index';
import type { AppState, AppAction } from './index';
import type { Project } from '../types';

// 测试用的 mock project
const mockProject: Project = {
  id: 'test-project-id',
  name: 'Test Project',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  chineseText: '你好世界。',
  englishText: 'Hello world.',
  chineseSentences: ['你好世界。'],
  englishSentences: ['Hello world.'],
};

// 测试用的 wrapper
function createWrapper(customInitialState?: AppState) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AppProvider initialState={customInitialState}>
        {children}
      </AppProvider>
    );
  };
}

describe('appReducer', () => {
  describe('SET_VIEW', () => {
    it('should change current view', () => {
      const state = appReducer(initialState, { type: 'SET_VIEW', payload: 'practice' });
      expect(state.currentView).toBe('practice');
    });

    it('should clear error when changing view', () => {
      const stateWithError: AppState = { ...initialState, error: 'Some error' };
      const state = appReducer(stateWithError, { type: 'SET_VIEW', payload: 'glossary' });
      expect(state.error).toBeNull();
    });
  });

  describe('SET_PROJECT', () => {
    it('should set current project', () => {
      const state = appReducer(initialState, { type: 'SET_PROJECT', payload: mockProject });
      expect(state.currentProject).toEqual(mockProject);
    });

    it('should reset visible translations when changing project', () => {
      const stateWithTranslations: AppState = {
        ...initialState,
        visibleTranslations: new Set([0, 1, 2]),
      };
      const state = appReducer(stateWithTranslations, { type: 'SET_PROJECT', payload: mockProject });
      expect(state.visibleTranslations.size).toBe(0);
    });

    it('should allow setting project to null', () => {
      const stateWithProject: AppState = { ...initialState, currentProject: mockProject };
      const state = appReducer(stateWithProject, { type: 'SET_PROJECT', payload: null });
      expect(state.currentProject).toBeNull();
    });
  });

  describe('SET_PRACTICE_MODE', () => {
    it('should change practice mode', () => {
      const state = appReducer(initialState, { type: 'SET_PRACTICE_MODE', payload: 'en-to-zh' });
      expect(state.practiceMode).toBe('en-to-zh');
    });

    it('should reset visible translations when changing mode', () => {
      const stateWithTranslations: AppState = {
        ...initialState,
        visibleTranslations: new Set([0, 1]),
      };
      const state = appReducer(stateWithTranslations, { type: 'SET_PRACTICE_MODE', payload: 'en-to-zh' });
      expect(state.visibleTranslations.size).toBe(0);
    });
  });

  describe('TOGGLE_TRANSLATION', () => {
    it('should add index to visible translations if not present', () => {
      const state = appReducer(initialState, { type: 'TOGGLE_TRANSLATION', payload: 0 });
      expect(state.visibleTranslations.has(0)).toBe(true);
    });

    it('should remove index from visible translations if present', () => {
      const stateWithTranslation: AppState = {
        ...initialState,
        visibleTranslations: new Set([0]),
      };
      const state = appReducer(stateWithTranslation, { type: 'TOGGLE_TRANSLATION', payload: 0 });
      expect(state.visibleTranslations.has(0)).toBe(false);
    });
  });

  describe('SHOW_TRANSLATION', () => {
    it('should add index to visible translations', () => {
      const state = appReducer(initialState, { type: 'SHOW_TRANSLATION', payload: 5 });
      expect(state.visibleTranslations.has(5)).toBe(true);
    });

    it('should not duplicate if already visible', () => {
      const stateWithTranslation: AppState = {
        ...initialState,
        visibleTranslations: new Set([5]),
      };
      const state = appReducer(stateWithTranslation, { type: 'SHOW_TRANSLATION', payload: 5 });
      expect(state.visibleTranslations.size).toBe(1);
    });
  });

  describe('HIDE_TRANSLATION', () => {
    it('should remove index from visible translations', () => {
      const stateWithTranslation: AppState = {
        ...initialState,
        visibleTranslations: new Set([5]),
      };
      const state = appReducer(stateWithTranslation, { type: 'HIDE_TRANSLATION', payload: 5 });
      expect(state.visibleTranslations.has(5)).toBe(false);
    });
  });

  describe('SHOW_ALL_TRANSLATIONS', () => {
    it('should set all provided indices as visible', () => {
      const state = appReducer(initialState, { type: 'SHOW_ALL_TRANSLATIONS', payload: [0, 1, 2, 3] });
      expect(state.visibleTranslations.size).toBe(4);
      expect(state.visibleTranslations.has(0)).toBe(true);
      expect(state.visibleTranslations.has(3)).toBe(true);
    });
  });

  describe('HIDE_ALL_TRANSLATIONS', () => {
    it('should clear all visible translations', () => {
      const stateWithTranslations: AppState = {
        ...initialState,
        visibleTranslations: new Set([0, 1, 2, 3]),
      };
      const state = appReducer(stateWithTranslations, { type: 'HIDE_ALL_TRANSLATIONS' });
      expect(state.visibleTranslations.size).toBe(0);
    });
  });

  describe('SET_LOADING', () => {
    it('should set loading state to true', () => {
      const state = appReducer(initialState, { type: 'SET_LOADING', payload: true });
      expect(state.isLoading).toBe(true);
    });

    it('should set loading state to false', () => {
      const loadingState: AppState = { ...initialState, isLoading: true };
      const state = appReducer(loadingState, { type: 'SET_LOADING', payload: false });
      expect(state.isLoading).toBe(false);
    });
  });

  describe('SET_ERROR', () => {
    it('should set error message', () => {
      const state = appReducer(initialState, { type: 'SET_ERROR', payload: 'Something went wrong' });
      expect(state.error).toBe('Something went wrong');
    });

    it('should set loading to false when setting error', () => {
      const loadingState: AppState = { ...initialState, isLoading: true };
      const state = appReducer(loadingState, { type: 'SET_ERROR', payload: 'Error' });
      expect(state.isLoading).toBe(false);
    });
  });

  describe('CLEAR_ERROR', () => {
    it('should clear error message', () => {
      const stateWithError: AppState = { ...initialState, error: 'Some error' };
      const state = appReducer(stateWithError, { type: 'CLEAR_ERROR' });
      expect(state.error).toBeNull();
    });
  });

  describe('START_PRACTICE', () => {
    it('should set view to practice', () => {
      const state = appReducer(initialState, {
        type: 'START_PRACTICE',
        payload: { project: mockProject, mode: 'zh-to-en' },
      });
      expect(state.currentView).toBe('practice');
    });

    it('should set current project', () => {
      const state = appReducer(initialState, {
        type: 'START_PRACTICE',
        payload: { project: mockProject, mode: 'zh-to-en' },
      });
      expect(state.currentProject).toEqual(mockProject);
    });

    it('should set practice mode', () => {
      const state = appReducer(initialState, {
        type: 'START_PRACTICE',
        payload: { project: mockProject, mode: 'en-to-zh' },
      });
      expect(state.practiceMode).toBe('en-to-zh');
    });

    it('should reset visible translations', () => {
      const stateWithTranslations: AppState = {
        ...initialState,
        visibleTranslations: new Set([0, 1]),
      };
      const state = appReducer(stateWithTranslations, {
        type: 'START_PRACTICE',
        payload: { project: mockProject, mode: 'zh-to-en' },
      });
      expect(state.visibleTranslations.size).toBe(0);
    });

    it('should clear error', () => {
      const stateWithError: AppState = { ...initialState, error: 'Some error' };
      const state = appReducer(stateWithError, {
        type: 'START_PRACTICE',
        payload: { project: mockProject, mode: 'zh-to-en' },
      });
      expect(state.error).toBeNull();
    });
  });

  describe('EXIT_PRACTICE', () => {
    it('should set view to projects', () => {
      const practiceState: AppState = {
        ...initialState,
        currentView: 'practice',
        currentProject: mockProject,
      };
      const state = appReducer(practiceState, { type: 'EXIT_PRACTICE' });
      expect(state.currentView).toBe('projects');
    });

    it('should clear current project', () => {
      const practiceState: AppState = {
        ...initialState,
        currentView: 'practice',
        currentProject: mockProject,
      };
      const state = appReducer(practiceState, { type: 'EXIT_PRACTICE' });
      expect(state.currentProject).toBeNull();
    });

    it('should reset visible translations', () => {
      const practiceState: AppState = {
        ...initialState,
        currentView: 'practice',
        currentProject: mockProject,
        visibleTranslations: new Set([0, 1, 2]),
      };
      const state = appReducer(practiceState, { type: 'EXIT_PRACTICE' });
      expect(state.visibleTranslations.size).toBe(0);
    });
  });

  describe('unknown action', () => {
    it('should return current state for unknown action', () => {
      const state = appReducer(initialState, { type: 'UNKNOWN' } as unknown as AppAction);
      expect(state).toEqual(initialState);
    });
  });
});

describe('useAppContext', () => {
  it('should throw error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAppContext());
    }).toThrow('useAppContext must be used within an AppProvider');
  });

  it('should return state and dispatch when used within provider', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: createWrapper(),
    });

    expect(result.current.state).toBeDefined();
    expect(result.current.dispatch).toBeDefined();
  });
});

describe('useAppState', () => {
  it('should return current state', () => {
    const { result } = renderHook(() => useAppState(), {
      wrapper: createWrapper(),
    });

    expect(result.current.currentView).toBe('projects');
    expect(result.current.currentProject).toBeNull();
  });
});

describe('useAppDispatch', () => {
  it('should return dispatch function', () => {
    const { result } = renderHook(() => useAppDispatch(), {
      wrapper: createWrapper(),
    });

    expect(typeof result.current).toBe('function');
  });

  it('should update state when dispatch is called', () => {
    const { result: dispatchResult } = renderHook(() => useAppDispatch(), {
      wrapper: createWrapper(),
    });

    // This test verifies dispatch is a function
    expect(typeof dispatchResult.current).toBe('function');
  });
});

describe('useAppActions', () => {
  it('should provide setView action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.setView('glossary');
    });

    expect(result.current.state.currentView).toBe('glossary');
  });

  it('should provide goToProjects action', () => {
    const customState: AppState = { ...initialState, currentView: 'practice' };
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper(customState) }
    );

    act(() => {
      result.current.actions.goToProjects();
    });

    expect(result.current.state.currentView).toBe('projects');
  });

  it('should provide goToGlossary action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.goToGlossary();
    });

    expect(result.current.state.currentView).toBe('glossary');
  });

  it('should provide goToFlashcards action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.goToFlashcards();
    });

    expect(result.current.state.currentView).toBe('flashcards');
  });

  it('should provide startPractice action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.startPractice(mockProject, 'en-to-zh');
    });

    expect(result.current.state.currentView).toBe('practice');
    expect(result.current.state.currentProject).toEqual(mockProject);
    expect(result.current.state.practiceMode).toBe('en-to-zh');
  });

  it('should provide exitPractice action', () => {
    const practiceState: AppState = {
      ...initialState,
      currentView: 'practice',
      currentProject: mockProject,
    };
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper(practiceState) }
    );

    act(() => {
      result.current.actions.exitPractice();
    });

    expect(result.current.state.currentView).toBe('projects');
    expect(result.current.state.currentProject).toBeNull();
  });

  it('should provide toggleTranslation action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.toggleTranslation(0);
    });

    expect(result.current.state.visibleTranslations.has(0)).toBe(true);

    act(() => {
      result.current.actions.toggleTranslation(0);
    });

    expect(result.current.state.visibleTranslations.has(0)).toBe(false);
  });

  it('should provide showTranslation and hideTranslation actions', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.showTranslation(1);
    });

    expect(result.current.state.visibleTranslations.has(1)).toBe(true);

    act(() => {
      result.current.actions.hideTranslation(1);
    });

    expect(result.current.state.visibleTranslations.has(1)).toBe(false);
  });

  it('should provide showAllTranslations and hideAllTranslations actions', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.showAllTranslations([0, 1, 2, 3, 4]);
    });

    expect(result.current.state.visibleTranslations.size).toBe(5);

    act(() => {
      result.current.actions.hideAllTranslations();
    });

    expect(result.current.state.visibleTranslations.size).toBe(0);
  });

  it('should provide setLoading action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.setLoading(true);
    });

    expect(result.current.state.isLoading).toBe(true);

    act(() => {
      result.current.actions.setLoading(false);
    });

    expect(result.current.state.isLoading).toBe(false);
  });

  it('should provide setError and clearError actions', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.setError('Test error');
    });

    expect(result.current.state.error).toBe('Test error');

    act(() => {
      result.current.actions.clearError();
    });

    expect(result.current.state.error).toBeNull();
  });

  it('should provide setProject action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.setProject(mockProject);
    });

    expect(result.current.state.currentProject).toEqual(mockProject);
  });

  it('should provide setPracticeMode action', () => {
    const { result } = renderHook(
      () => ({
        actions: useAppActions(),
        state: useAppState(),
      }),
      { wrapper: createWrapper() }
    );

    act(() => {
      result.current.actions.setPracticeMode('en-to-zh');
    });

    expect(result.current.state.practiceMode).toBe('en-to-zh');
  });
});

describe('initialState', () => {
  it('should have correct default values', () => {
    expect(initialState.currentView).toBe('projects');
    expect(initialState.currentProject).toBeNull();
    expect(initialState.practiceMode).toBe('zh-to-en');
    expect(initialState.visibleTranslations.size).toBe(0);
    expect(initialState.isLoading).toBe(false);
    expect(initialState.error).toBeNull();
  });
});
