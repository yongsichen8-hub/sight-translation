/**
 * ProjectList 组件
 * 显示所有项目列表，支持删除和开始练习
 */

import { useState, useEffect, useCallback } from 'react';
import { Button, Modal, Loading, Toast } from '../../common';
import { projectManager } from '../../../services/ProjectManager';
import { useAppActions } from '../../../context/useAppActions';
import type { Project } from '../../../types';
import './ProjectList.css';

/**
 * ProjectList Props 接口
 */
export interface ProjectListProps {
  /** 点击创建项目按钮的回调 */
  onCreateClick: () => void;
}

/**
 * ProjectList 组件
 * 显示项目列表，支持删除项目和开始练习
 */
export function ProjectList({ onCreateClick }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { startPractice } = useAppActions();

  /**
   * 加载项目列表
   */
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await projectManager.getProjects();
      setProjects(data);
    } catch (err) {
      setError('加载项目列表失败，请刷新页面重试');
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  /**
   * 打开删除确认对话框
   */
  const handleDeleteClick = useCallback((project: Project) => {
    setDeleteTarget(project);
  }, []);

  /**
   * 关闭删除确认对话框
   */
  const handleDeleteCancel = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  /**
   * 确认删除项目
   */
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      setDeleting(true);
      await projectManager.deleteProject(deleteTarget.id);
      setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setToast({ message: `项目 "${deleteTarget.name}" 已删除`, type: 'success' });
      setDeleteTarget(null);
    } catch (err) {
      setToast({ message: '删除项目失败，请重试', type: 'error' });
      console.error('Failed to delete project:', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget]);

  /**
   * 开始中译英练习
   */
  const handlePracticeZhToEn = useCallback((project: Project) => {
    startPractice(project, 'zh-to-en');
  }, [startPractice]);

  /**
   * 开始英译中练习
   */
  const handlePracticeEnToZh = useCallback((project: Project) => {
    startPractice(project, 'en-to-zh');
  }, [startPractice]);

  /**
   * 格式化日期
   */
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  /**
   * 关闭 Toast
   */
  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  // 加载中状态
  if (loading) {
    return <Loading text="加载项目列表..." />;
  }

  // 错误状态
  if (error) {
    return (
      <div className="project-list">
        <div className="project-list__empty">
          <div className="project-list__empty-icon">⚠️</div>
          <p className="project-list__empty-text">{error}</p>
          <Button onClick={loadProjects}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="project-list">
      <div className="project-list__header">
        <h1 className="project-list__title">我的项目</h1>
        <Button onClick={onCreateClick}>创建项目</Button>
      </div>

      {projects.length === 0 ? (
        <div className="project-list__empty">
          <div className="project-list__empty-icon">📁</div>
          <p className="project-list__empty-text">
            还没有任何项目，点击上方按钮创建第一个项目
          </p>
          <Button onClick={onCreateClick}>创建项目</Button>
        </div>
      ) : (
        <div className="project-list__items">
          {projects.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-card__header">
                <h2 className="project-card__name">{project.name}</h2>
                <div className="project-card__actions">
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => handleDeleteClick(project)}
                    aria-label={`删除项目 ${project.name}`}
                  >
                    删除
                  </Button>
                </div>
              </div>

              <div className="project-card__info">
                <span className="project-card__stat">
                  <span className="project-card__stat-icon">🇨🇳</span>
                  {project.chineseParagraphs?.length || project.paragraphPairs?.length || 0} 段
                </span>
                <span className="project-card__stat">
                  <span className="project-card__stat-icon">🇬🇧</span>
                  {project.englishParagraphs?.length || project.paragraphPairs?.length || 0} 段
                </span>
                <span className="project-card__date">
                  创建于 {formatDate(project.createdAt)}
                </span>
              </div>

              <div className="project-card__practice-buttons">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePracticeZhToEn(project)}
                >
                  中译英练习
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => handlePracticeEnToZh(project)}
                >
                  英译中练习
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认对话框 */}
      <Modal
        visible={deleteTarget !== null}
        title="确认删除"
        onClose={handleDeleteCancel}
        footer={
          <div className="delete-confirm__actions">
            <Button variant="secondary" onClick={handleDeleteCancel} disabled={deleting}>
              取消
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} loading={deleting}>
              确认删除
            </Button>
          </div>
        }
      >
        <div className="delete-confirm__message">
          确定要删除项目{' '}
          <span className="delete-confirm__project-name">
            "{deleteTarget?.name}"
          </span>{' '}
          吗？
          <p className="delete-confirm__warning">
            此操作不可撤销，项目关联的所有表达收藏也将被删除。
          </p>
        </div>
      </Modal>

      {/* Toast 提示 */}
      {toast && (
        <Toast
          visible={true}
          message={toast.message}
          type={toast.type}
          onClose={handleToastClose}
        />
      )}
    </div>
  );
}

export default ProjectList;
