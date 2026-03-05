import React, { useState, useEffect } from 'react';
import { Modal, Button } from '../common';
import { apiClient, MigrationResult } from '../../services/ApiClient';
import { db } from '../../db';
import './MigrationDialog.css';

interface MigrationDialogProps {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type MigrationStatus = 'checking' | 'ready' | 'migrating' | 'success' | 'error';

interface LocalDataStats {
  projects: number;
  expressions: number;
  flashcards: number;
  reviewRecords: number;
}

export const MigrationDialog: React.FC<MigrationDialogProps> = ({
  visible,
  onClose,
  onComplete,
}) => {
  const [status, setStatus] = useState<MigrationStatus>('checking');
  const [localStats, setLocalStats] = useState<LocalDataStats | null>(null);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 检查本地数据
  useEffect(() => {
    if (visible) {
      checkLocalData();
    }
  }, [visible]);

  const checkLocalData = async () => {
    setStatus('checking');
    setError(null);

    try {
      const projects = await db.projects.toArray();
      const expressions = await db.expressions.toArray();
      const flashcards = await db.flashcards.toArray();
      const reviewRecords = await db.reviewRecords.toArray();

      const stats: LocalDataStats = {
        projects: projects.length,
        expressions: expressions.length,
        flashcards: flashcards.length,
        reviewRecords: reviewRecords.length,
      };

      setLocalStats(stats);

      // 没有本地数据时直接关闭，不显示弹窗
      const hasData = stats.projects > 0 || stats.expressions > 0 || stats.flashcards > 0 || stats.reviewRecords > 0;
      if (!hasData) {
        onClose();
        return;
      }

      setStatus('ready');
    } catch (err) {
      console.error('检查本地数据失败:', err);
      setError('无法读取本地数据');
      setStatus('error');
    }
  };

  const handleMigrate = async () => {
    setStatus('migrating');
    setError(null);

    try {
      // 读取所有本地数据
      const localProjects = await db.projects.toArray();
      const localExpressions = await db.expressions.toArray();
      const localFlashcards = await db.flashcards.toArray();
      const localReviewRecords = await db.reviewRecords.toArray();

      // 转换日期类型为字符串
      const projects = localProjects.map(p => ({
        ...p,
        createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
        updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
      }));

      const expressions = localExpressions.map(e => ({
        ...e,
        createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
        updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : String(e.updatedAt),
      }));

      const flashcards = localFlashcards.map(f => ({
        ...f,
        nextReviewDate: f.nextReviewDate instanceof Date ? f.nextReviewDate.toISOString() : String(f.nextReviewDate),
        lastReviewDate: f.lastReviewDate instanceof Date ? f.lastReviewDate.toISOString() : f.lastReviewDate ? String(f.lastReviewDate) : null,
        createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
      }));

      const reviewRecords = localReviewRecords.map(r => ({
        ...r,
        reviewedAt: r.reviewedAt instanceof Date ? r.reviewedAt.toISOString() : String(r.reviewedAt),
      }));

      // 调用 API 迁移数据
      const migrationResult = await apiClient.migrateLocalData({
        projects,
        expressions,
        flashcards,
        reviewRecords,
      });

      setResult(migrationResult);
      setStatus('success');
    } catch (err) {
      console.error('数据迁移失败:', err);
      setError((err as Error).message || '数据迁移失败');
      setStatus('error');
    }
  };

  const handleClearLocalData = async () => {
    try {
      // 清除所有本地数据
      await db.projects.clear();
      await db.expressions.clear();
      await db.flashcards.clear();
      await db.reviewRecords.clear();

      onComplete();
    } catch (err) {
      console.error('清除本地数据失败:', err);
      setError('清除本地数据失败');
    }
  };

  const hasLocalData = localStats && (
    localStats.projects > 0 ||
    localStats.expressions > 0 ||
    localStats.flashcards > 0 ||
    localStats.reviewRecords > 0
  );

  const renderContent = () => {
    switch (status) {
      case 'checking':
        return (
          <div className="migration-loading">
            <div className="migration-spinner" />
            <p>正在检查本地数据...</p>
          </div>
        );

      case 'ready':
        if (!hasLocalData) {
          return (
            <div className="migration-empty">
              <p>没有检测到本地数据，无需迁移。</p>
              <Button onClick={onClose}>关闭</Button>
            </div>
          );
        }

        return (
          <div className="migration-ready">
            <p className="migration-description">
              检测到您的浏览器中有以下本地数据，是否要迁移到云端？
            </p>
            <div className="migration-stats">
              <div className="migration-stat">
                <span className="migration-stat-label">项目</span>
                <span className="migration-stat-value">{localStats?.projects || 0}</span>
              </div>
              <div className="migration-stat">
                <span className="migration-stat-label">表达</span>
                <span className="migration-stat-value">{localStats?.expressions || 0}</span>
              </div>
              <div className="migration-stat">
                <span className="migration-stat-label">闪卡</span>
                <span className="migration-stat-value">{localStats?.flashcards || 0}</span>
              </div>
              <div className="migration-stat">
                <span className="migration-stat-label">复习记录</span>
                <span className="migration-stat-value">{localStats?.reviewRecords || 0}</span>
              </div>
            </div>
            <div className="migration-actions">
              <Button onClick={handleMigrate}>开始迁移</Button>
              <Button variant="secondary" onClick={onClose}>稍后再说</Button>
            </div>
          </div>
        );

      case 'migrating':
        return (
          <div className="migration-loading">
            <div className="migration-spinner" />
            <p>正在迁移数据，请稍候...</p>
          </div>
        );

      case 'success':
        return (
          <div className="migration-success">
            <div className="migration-success-icon">✓</div>
            <h3>迁移完成</h3>
            <div className="migration-result">
              <p>已成功迁移：</p>
              <ul>
                <li>项目：{result?.imported.projects || 0} 个</li>
                <li>表达：{result?.imported.expressions || 0} 条</li>
                <li>闪卡：{result?.imported.flashcards || 0} 张</li>
                <li>复习记录：{result?.imported.reviewRecords || 0} 条</li>
              </ul>
            </div>
            <p className="migration-question">是否清除本地数据？</p>
            <div className="migration-actions">
              <Button onClick={handleClearLocalData}>清除本地数据</Button>
              <Button variant="secondary" onClick={onComplete}>保留本地数据</Button>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="migration-error">
            <div className="migration-error-icon">✕</div>
            <h3>迁移失败</h3>
            <p className="migration-error-message">{error}</p>
            <div className="migration-actions">
              <Button onClick={checkLocalData}>重试</Button>
              <Button variant="secondary" onClick={onClose}>关闭</Button>
            </div>
          </div>
        );
    }
  };

  return (
    <Modal
      visible={visible}
      title="数据迁移"
      onClose={status === 'migrating' ? () => {} : onClose}
    >
      <div className="migration-dialog">
        {renderContent()}
      </div>
    </Modal>
  );
};
