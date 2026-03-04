/**
 * ProjectManager 组件
 * 项目管理主组件，整合项目列表和创建表单
 */

import React, { useState, useCallback } from 'react';
import { ProjectList } from './ProjectList';
import { ProjectCreateForm } from './ProjectCreateForm';

/**
 * 视图类型
 */
type ProjectManagerView = 'list' | 'create';

/**
 * ProjectManager 组件
 * 管理项目列表和创建表单的切换
 */
export function ProjectManager() {
  const [view, setView] = useState<ProjectManagerView>('list');

  /**
   * 切换到创建视图
   */
  const handleCreateClick = useCallback(() => {
    setView('create');
  }, []);

  /**
   * 返回列表视图
   */
  const handleBack = useCallback(() => {
    setView('list');
  }, []);

  /**
   * 创建成功后返回列表
   */
  const handleCreateSuccess = useCallback(() => {
    setView('list');
  }, []);

  if (view === 'create') {
    return (
      <ProjectCreateForm
        onBack={handleBack}
        onSuccess={handleCreateSuccess}
      />
    );
  }

  return <ProjectList onCreateClick={handleCreateClick} />;
}

export default ProjectManager;
