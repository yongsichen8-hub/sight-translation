import { useState, useEffect, useMemo, useCallback } from 'react';
import { dataService } from '../../services/DataService';
import type { Expression } from '../../types';

interface UseProjectExpressionsResult {
  expressions: Expression[];
  refresh: () => Promise<void>;
  chineseKeywords: string[];
  englishKeywords: string[];
}

export function useProjectExpressions(
  projectId: string | undefined
): UseProjectExpressionsResult {
  const [expressions, setExpressions] = useState<Expression[]>([]);

  const loadExpressions = useCallback(async () => {
    if (!projectId) {
      setExpressions([]);
      return;
    }
    try {
      const all = await dataService.getExpressions();
      const filtered = all.filter((e) => e.projectId === projectId);
      setExpressions(filtered);
    } catch {
      // 静默降级：加载失败不阻塞练习功能
      setExpressions([]);
    }
  }, [projectId]);

  // 进入练习模式时自动加载
  useEffect(() => {
    loadExpressions();
  }, [loadExpressions]);

  const chineseKeywords = useMemo(
    () => expressions.map((e) => e.chinese).filter((s) => s !== ''),
    [expressions]
  );

  const englishKeywords = useMemo(
    () => expressions.map((e) => e.english).filter((s) => s !== ''),
    [expressions]
  );

  return { expressions, refresh: loadExpressions, chineseKeywords, englishKeywords };
}
