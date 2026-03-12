/**
 * AiSettingsPanel 组件
 * AI 设置面板，配置 API Key、Base URL 和模型名称
 */

import { useState, useEffect, useCallback, useId } from 'react';
import { Modal, Button, Toast } from '../common';
import { apiClient } from '../../services/ApiClient';

interface AiSettingsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function AiSettingsPanel({ visible, onClose }: AiSettingsPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const apiKeyId = useId();
  const baseUrlId = useId();
  const modelId = useId();

  const loadSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const settings = await apiClient.getAiSettings();
      setApiKey(settings.apiKey || '');
      setBaseUrl(settings.baseUrl || 'https://api.openai.com/v1');
      setModel(settings.model || '');
    } catch {
      // 加载失败使用默认值
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadSettings();
  }, [visible, loadSettings]);

  const handleSave = useCallback(async () => {
    if (!apiKey.trim() || !baseUrl.trim() || !model.trim()) {
      setToast({ message: '所有字段均不能为空', type: 'error' });
      return;
    }
    try {
      setSaving(true);
      await apiClient.saveAiSettings({
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim(),
        model: model.trim(),
      });
      setToast({ message: '设置已保存', type: 'success' });
      setTimeout(onClose, 800);
    } catch {
      setToast({ message: '保存失败，请重试', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [apiKey, baseUrl, model, onClose]);

  return (
    <>
      <Modal
        visible={visible}
        title="AI 设置"
        onClose={onClose}
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose} disabled={saving}>取消</Button>
            <Button onClick={handleSave} loading={saving}>保存</Button>
          </div>
        }
      >
        {loadingSettings ? (
          <p style={{ textAlign: 'center', color: '#888', padding: '16px 0' }}>加载设置中...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor={apiKeyId} style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                API Key
              </label>
              <input
                id={apiKeyId}
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="请输入 API Key"
                disabled={saving}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d0d0d0', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor={baseUrlId} style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Base URL
              </label>
              <input
                id={baseUrlId}
                type="text"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                disabled={saving}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d0d0d0', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label htmlFor={modelId} style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                模型名称
              </label>
              <input
                id={modelId}
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="如 gpt-4o-mini、deepseek-chat"
                disabled={saving}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d0d0d0', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        )}
      </Modal>
      {toast && (
        <Toast visible message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </>
  );
}

export default AiSettingsPanel;
