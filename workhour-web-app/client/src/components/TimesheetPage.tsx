import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getProjects, submitTimeRecords, Project, TimeRecordEntry } from '../services/api';
import './TimesheetPage.css';

interface SectionState {
  projectId: string;
  projectName: string;
  time: string;
}

interface SectionErrors {
  project?: string;
  time?: string;
}

interface FormErrors {
  interpretation: SectionErrors;
  translation: SectionErrors;
  form?: string;
}

function isPositiveInteger(value: string): boolean {
  if (!value || value.trim() === '') return false;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  const num = parseInt(trimmed, 10);
  return num > 0 && Number.isFinite(num);
}

function validateSection(
  section: SectionState,
  type: 'interpretation' | 'translation'
): SectionErrors {
  const errors: SectionErrors = {};
  const hasProject = section.projectId.trim() !== '';
  const hasTime = section.time.trim() !== '';
  const label = type === 'interpretation' ? '口译' : '笔译';

  if (hasProject && !hasTime) {
    errors.time = `请填写${label}工时`;
  }
  if (hasTime && !hasProject) {
    errors.project = `请选择${label}项目`;
  }
  if (hasProject && hasTime && !isPositiveInteger(section.time)) {
    errors.time = `${label}工时必须为正整数`;
  }
  return errors;
}

export default function TimesheetPage() {
  const { user } = useAuth();

  // Project data
  const [interpProjects, setInterpProjects] = useState<Project[]>([]);
  const [transProjects, setTransProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState('');

  // Form state
  const [interpretation, setInterpretation] = useState<SectionState>({
    projectId: '', projectName: '', time: '',
  });
  const [translation, setTranslation] = useState<SectionState>({
    projectId: '', projectName: '', time: '',
  });

  // Validation & submission state
  const [errors, setErrors] = useState<FormErrors>({ interpretation: {}, translation: {} });
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [syncWarning, setSyncWarning] = useState('');

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError('');
    try {
      const data = await getProjects();
      setInterpProjects(data.interpretation || []);
      setTransProjects(data.translation || []);
    } catch {
      setProjectsError('加载项目列表失败，请重试');
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleProjectChange = (
    type: 'interpretation' | 'translation',
    projectId: string,
    projects: Project[]
  ) => {
    const project = projects.find((p) => p.recordId === projectId);
    const setter = type === 'interpretation' ? setInterpretation : setTranslation;
    setter((prev) => ({
      ...prev,
      projectId,
      projectName: project?.name || '',
    }));
    // Clear section errors on change
    setErrors((prev) => ({ ...prev, [type]: {} }));
    setSuccessMsg('');
  };

  const handleTimeChange = (type: 'interpretation' | 'translation', value: string) => {
    const setter = type === 'interpretation' ? setInterpretation : setTranslation;
    setter((prev) => ({ ...prev, time: value }));
    setErrors((prev) => ({ ...prev, [type]: {} }));
    setSuccessMsg('');
  };

  const validate = (): boolean => {
    const interpErrors = validateSection(interpretation, 'interpretation');
    const transErrors = validateSection(translation, 'translation');
    const newErrors: FormErrors = {
      interpretation: interpErrors,
      translation: transErrors,
    };

    // Check at least one entry if no pair errors
    const hasInterpEntry = interpretation.projectId.trim() !== '' && interpretation.time.trim() !== '';
    const hasTransEntry = translation.projectId.trim() !== '' && translation.time.trim() !== '';

    if (
      Object.keys(interpErrors).length === 0 &&
      Object.keys(transErrors).length === 0 &&
      !hasInterpEntry &&
      !hasTransEntry
    ) {
      newErrors.form = '请至少填写口译或笔译工时中的一项';
    }

    setErrors(newErrors);
    return (
      Object.keys(interpErrors).length === 0 &&
      Object.keys(transErrors).length === 0 &&
      !newErrors.form
    );
  };

  const handleSubmit = async () => {
    setSuccessMsg('');
    setSubmitError('');
    setSyncWarning('');

    if (!validate()) return;

    const entries: TimeRecordEntry[] = [];
    if (interpretation.projectId && interpretation.time) {
      entries.push({
        projectId: interpretation.projectId,
        projectName: interpretation.projectName,
        type: 'interpretation',
        time: parseInt(interpretation.time, 10),
      });
    }
    if (translation.projectId && translation.time) {
      entries.push({
        projectId: translation.projectId,
        projectName: translation.projectName,
        type: 'translation',
        time: parseInt(translation.time, 10),
      });
    }

    setSubmitting(true);
    try {
      const result = await submitTimeRecords(entries);
      if (result.syncStatus === 'partial') {
        setSyncWarning('本地记录已保存，但飞书表格同步失败');
      }
      setSuccessMsg('工时提交成功！');
      // Clear form
      setInterpretation({ projectId: '', projectName: '', time: '' });
      setTranslation({ projectId: '', projectName: '', time: '' });
      setErrors({ interpretation: {}, translation: {} });
    } catch {
      setSubmitError('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  const renderSection = (
    type: 'interpretation' | 'translation',
    label: string,
    projects: Project[],
    state: SectionState,
    sectionErrors: SectionErrors
  ) => (
    <div className="ts-section">
      <h3 className="ts-section-title">{label}</h3>
      {projects.length === 0 && !projectsLoading ? (
        <p className="ts-empty">暂无进行中的项目</p>
      ) : (
        <div className="ts-fields">
          <div className="ts-field">
            <label className="ts-label">项目</label>
            <select
              className={`ts-select ${sectionErrors.project ? 'ts-input-error' : ''}`}
              value={state.projectId}
              onChange={(e) => handleProjectChange(type, e.target.value, projects)}
            >
              <option value="">请选择项目</option>
              {projects.map((p) => (
                <option key={p.recordId} value={p.recordId}>
                  {p.name}
                </option>
              ))}
            </select>
            {sectionErrors.project && (
              <span className="ts-error-text">{sectionErrors.project}</span>
            )}
          </div>
          <div className="ts-field">
            <label className="ts-label">工时（分钟）</label>
            <input
              type="text"
              className={`ts-input ${sectionErrors.time ? 'ts-input-error' : ''}`}
              placeholder="请输入正整数"
              value={state.time}
              onChange={(e) => handleTimeChange(type, e.target.value)}
            />
            {sectionErrors.time && (
              <span className="ts-error-text">{sectionErrors.time}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (projectsLoading) {
    return <div className="loading">加载项目列表中...</div>;
  }

  if (projectsError) {
    return (
      <div className="ts-error-container">
        <p className="ts-error-msg">{projectsError}</p>
        <button className="ts-retry-btn" onClick={loadProjects}>
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="ts-page">
      <div className="ts-header">
        {user?.avatar && <img src={user.avatar} alt="" className="ts-avatar" />}
        <span className="ts-username">{user?.name}</span>
      </div>

      {renderSection('interpretation', '口译', interpProjects, interpretation, errors.interpretation)}
      {renderSection('translation', '笔译', transProjects, translation, errors.translation)}

      {errors.form && <p className="ts-form-error">{errors.form}</p>}
      {successMsg && <p className="ts-success">{successMsg}</p>}
      {submitError && <p className="ts-form-error">{submitError}</p>}
      {syncWarning && <p className="ts-warning">{syncWarning}</p>}

      <button
        className="ts-submit-btn"
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? '提交中...' : '提交工时'}
      </button>
    </div>
  );
}
