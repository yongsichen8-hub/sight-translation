/**
 * ProjectCreateForm 组件
 * 项目创建表单，支持多种输入方式
 */

import { useState, useCallback, useId } from 'react';
import { Button, Toast } from '../../common';
import { FileUpload } from '../FileUpload';
import { projectManager } from '../../../services/ProjectManager';
import { getFileParseErrorMessage, API_PROVIDERS } from '../../../types';
import type { ProjectInput, APIProvider, OpenAIConfig } from '../../../types';
import { useAppState } from '../../../context/AppContext';
import { useAppActions } from '../../../context/useAppActions';
import './ProjectCreateForm.css';

type InputMode = 'dual-file' | 'single-file' | 'text' | 'image';

interface FormErrors {
  name?: string | undefined;
  file?: string | undefined;
  chineseFile?: string | undefined;
  englishFile?: string | undefined;
  text?: string | undefined;
  images?: string | undefined;
  apiKey?: string | undefined;
  global?: string | undefined;
}

export interface ProjectCreateFormProps {
  onBack: () => void;
  onSuccess: () => void;
}

export function ProjectCreateForm({ onBack, onSuccess }: ProjectCreateFormProps) {
  const { openAIConfig } = useAppState();
  const { setOpenAIConfig } = useAppActions();

  const [mode, setMode] = useState<InputMode>('dual-file');
  const [name, setName] = useState('');
  const [chineseFile, setChineseFile] = useState<File | null>(null);
  const [englishFile, setEnglishFile] = useState<File | null>(null);
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState('');
  const [images, setImages] = useState<File[]>([]);
  
  // API 配置
  const [apiProvider, setApiProvider] = useState<APIProvider>(
    openAIConfig?.baseUrl?.includes('bigmodel.cn') ? 'zhipu' :
    openAIConfig?.baseUrl?.includes('deepseek.com') ? 'deepseek' :
    openAIConfig?.baseUrl?.includes('dashscope') ? 'qwen' :
    openAIConfig?.baseUrl && !openAIConfig.baseUrl.includes('openai.com') ? 'custom' : 'openai'
  );
  const [apiKey, setApiKey] = useState(openAIConfig?.apiKey || '');
  const [customBaseUrl, setCustomBaseUrl] = useState(openAIConfig?.baseUrl || '');
  const [customModel, setCustomModel] = useState(openAIConfig?.model || '');
  
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const nameInputId = useId();
  const apiKeyInputId = useId();

  const handleModeChange = useCallback((newMode: InputMode) => {
    setMode(newMode);
    setErrors({});
  }, []);

  const buildApiConfig = useCallback((): OpenAIConfig | undefined => {
    if (!apiKey.trim()) return undefined;
    
    const provider = API_PROVIDERS[apiProvider];
    return {
      apiKey: apiKey.trim(),
      baseUrl: apiProvider === 'custom' ? customBaseUrl : provider.baseUrl,
      model: apiProvider === 'custom' ? customModel : provider.defaultModel,
    };
  }, [apiKey, apiProvider, customBaseUrl, customModel]);

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    const newErrors: FormErrors = {};
    if (!name.trim()) {
      newErrors.name = '请输入项目名称';
    }

    // 只有图片模式需要 API KEY
    const needsApiKey = mode === 'image';
    if (needsApiKey && !apiKey.trim()) {
      newErrors.apiKey = '图片识别需要 AI API Key';
    }

    if (apiProvider === 'custom' && apiKey.trim() && !customBaseUrl.trim()) {
      newErrors.apiKey = '自定义模式需要填写 API 地址';
    }

    switch (mode) {
      case 'dual-file':
        if (!chineseFile) newErrors.chineseFile = '请上传中文文件';
        if (!englishFile) newErrors.englishFile = '请上传英文文件';
        break;
      case 'single-file':
        if (!singleFile) newErrors.file = '请上传文件';
        break;
      case 'text':
        if (!textInput.trim()) newErrors.text = '请输入文本内容';
        break;
      case 'image':
        if (images.length === 0) newErrors.images = '请上传图片';
        break;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setSubmitting(true);

      const config = buildApiConfig();
      if (config) {
        setOpenAIConfig(config);
      }

      let input: ProjectInput;
      switch (mode) {
        case 'dual-file':
          input = { mode: 'dual-file', name: name.trim(), chineseFile: chineseFile!, englishFile: englishFile! };
          break;
        case 'single-file':
          input = { mode: 'single-file', name: name.trim(), file: singleFile! };
          break;
        case 'text':
          input = { mode: 'text', name: name.trim(), text: textInput };
          break;
        case 'image':
          input = { mode: 'image', name: name.trim(), images };
          break;
      }

      await projectManager.createProject(input, config);
      setToast({ message: '项目创建成功！', type: 'success' });
      setTimeout(onSuccess, 1000);
    } catch (error) {
      console.error('Failed to create project:', error);
      if (error instanceof Error) {
        if (error.name === 'DuplicateError') {
          setErrors({ name: '项目名称已存在' });
        } else if (error.name === 'FileParseError') {
          setErrors({ global: getFileParseErrorMessage(error as any) });
        } else if (error.name === 'ValidationError') {
          const ve = error as any;
          setErrors({ [ve.field]: ve.constraint });
        } else {
          setErrors({ global: error.message || '创建失败，请重试' });
        }
      } else {
        setErrors({ global: '创建失败，请重试' });
      }
    } finally {
      setSubmitting(false);
    }
  }, [name, mode, chineseFile, englishFile, singleFile, textInput, images, apiKey, apiProvider, customBaseUrl, buildApiConfig, onSuccess, setOpenAIConfig]);

  const handleImageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setImages(files);
    if (errors.images) {
      setErrors(prev => ({ ...prev, images: undefined }));
    }
  }, [errors.images]);

  return (
    <div className="project-create-form">
      <div className="project-create-form__header">
        <button type="button" className="project-create-form__back" onClick={onBack} disabled={submitting}>←</button>
        <h1 className="project-create-form__title">创建新项目</h1>
      </div>

      <form className="project-create-form__form" onSubmit={handleSubmit}>
        {errors.global && (
          <div className="project-create-form__global-error" role="alert">
            <div className="project-create-form__global-error-title">创建失败</div>
            <div className="project-create-form__global-error-message">{errors.global}</div>
          </div>
        )}

        {/* 项目名称 */}
        <div className="project-create-form__field">
          <label className="project-create-form__label" htmlFor={nameInputId}>
            项目名称<span className="project-create-form__required">*</span>
          </label>
          <input
            id={nameInputId}
            type="text"
            className={`project-create-form__input ${errors.name ? 'project-create-form__input--error' : ''}`}
            value={name}
            onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
            placeholder="请输入项目名称"
            disabled={submitting}
          />
          {errors.name && <div className="project-create-form__error">⚠️ {errors.name}</div>}
        </div>

        {/* 输入模式选择 */}
        <div className="project-create-form__field">
          <label className="project-create-form__label">输入方式</label>
          <div className="project-create-form__mode-tabs">
            <button type="button" className={`project-create-form__mode-tab ${mode === 'dual-file' ? 'project-create-form__mode-tab--active' : ''}`} onClick={() => handleModeChange('dual-file')} disabled={submitting}>
              双文件上传
            </button>
            <button type="button" className={`project-create-form__mode-tab ${mode === 'single-file' ? 'project-create-form__mode-tab--active' : ''}`} onClick={() => handleModeChange('single-file')} disabled={submitting}>
              单文件上传
            </button>
            <button type="button" className={`project-create-form__mode-tab ${mode === 'text' ? 'project-create-form__mode-tab--active' : ''}`} onClick={() => handleModeChange('text')} disabled={submitting}>
              直接输入
            </button>
            <button type="button" className={`project-create-form__mode-tab ${mode === 'image' ? 'project-create-form__mode-tab--active' : ''}`} onClick={() => handleModeChange('image')} disabled={submitting}>
              图片识别
            </button>
          </div>
        </div>

        {/* 双文件上传 */}
        {mode === 'dual-file' && (
          <div className="project-create-form__files">
            <FileUpload label="中文文本文件" file={chineseFile} onChange={setChineseFile} error={errors.chineseFile ?? null} required disabled={submitting} />
            <FileUpload label="英文文本文件" file={englishFile} onChange={setEnglishFile} error={errors.englishFile ?? null} required disabled={submitting} />
          </div>
        )}

        {/* 单文件上传 */}
        {mode === 'single-file' && (
          <div className="project-create-form__field">
            <FileUpload label="包含中英文的文件" file={singleFile} onChange={setSingleFile} error={errors.file ?? null} required disabled={submitting} />
            <p className="project-create-form__hint">系统将自动识别并分离中英文内容</p>
          </div>
        )}

        {/* 直接输入文本 */}
        {mode === 'text' && (
          <div className="project-create-form__field">
            <label className="project-create-form__label">
              文本内容<span className="project-create-form__required">*</span>
            </label>
            <textarea
              className={`project-create-form__textarea ${errors.text ? 'project-create-form__input--error' : ''}`}
              value={textInput}
              onChange={(e) => { setTextInput(e.target.value); if (errors.text) setErrors(prev => ({ ...prev, text: undefined })); }}
              placeholder="粘贴包含中英文的文本内容..."
              rows={10}
              disabled={submitting}
            />
            {errors.text && <div className="project-create-form__error">⚠️ {errors.text}</div>}
            <p className="project-create-form__hint">系统将自动识别并分离中英文内容</p>
          </div>
        )}

        {/* 图片上传 */}
        {mode === 'image' && (
          <div className="project-create-form__field">
            <label className="project-create-form__label">
              上传图片<span className="project-create-form__required">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={submitting}
              className="project-create-form__file-input"
            />
            {images.length > 0 && (
              <p className="project-create-form__hint">已选择 {images.length} 张图片</p>
            )}
            {errors.images && <div className="project-create-form__error">⚠️ {errors.images}</div>}
            <p className="project-create-form__hint">支持 JPG、PNG 等常见图片格式，将使用 AI 识别文字</p>
          </div>
        )}

        {/* AI API 配置 - 只有图片模式必须 */}
        <div className="project-create-form__api-section">
          <div className="project-create-form__field">
            <label className="project-create-form__label">
              AI 服务商
              {mode === 'image' && <span className="project-create-form__required">*</span>}
              {mode !== 'image' && <span className="project-create-form__optional">（可选）</span>}
            </label>
            <select
              className="project-create-form__select"
              value={apiProvider}
              onChange={(e) => setApiProvider(e.target.value as APIProvider)}
              disabled={submitting}
            >
              <option value="openai">OpenAI</option>
              <option value="zhipu">智谱 AI (GLM)</option>
              <option value="deepseek">DeepSeek</option>
              <option value="qwen">通义千问</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          {apiProvider === 'custom' && (
            <>
              <div className="project-create-form__field">
                <label className="project-create-form__label">
                  API 地址<span className="project-create-form__required">*</span>
                </label>
                <input
                  type="text"
                  className="project-create-form__input"
                  value={customBaseUrl}
                  onChange={(e) => setCustomBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  disabled={submitting}
                />
              </div>
              <div className="project-create-form__field">
                <label className="project-create-form__label">模型名称</label>
                <input
                  type="text"
                  className="project-create-form__input"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="gpt-4o-mini"
                  disabled={submitting}
                />
              </div>
            </>
          )}

          <div className="project-create-form__field">
            <label className="project-create-form__label" htmlFor={apiKeyInputId}>
              API Key
              {mode === 'image' && <span className="project-create-form__required">*</span>}
            </label>
            <input
              id={apiKeyInputId}
              type="password"
              className={`project-create-form__input ${errors.apiKey ? 'project-create-form__input--error' : ''}`}
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); if (errors.apiKey) setErrors(prev => ({ ...prev, apiKey: undefined })); }}
              placeholder={apiProvider === 'openai' ? 'sk-...' : '请输入 API Key'}
              disabled={submitting}
            />
            {errors.apiKey && <div className="project-create-form__error project-create-form__error--warning">⚠️ {errors.apiKey}</div>}
            {mode === 'dual-file' && <p className="project-create-form__hint">不填写则按顺序匹配中英文段落</p>}
            {(mode === 'single-file' || mode === 'text') && <p className="project-create-form__hint">不填写将使用本地算法分离中英文</p>}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="project-create-form__actions">
          <Button type="button" variant="secondary" onClick={onBack} disabled={submitting}>取消</Button>
          <Button type="submit" loading={submitting}>创建项目</Button>
        </div>
      </form>

      {toast && <Toast visible={true} message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

export default ProjectCreateForm;
