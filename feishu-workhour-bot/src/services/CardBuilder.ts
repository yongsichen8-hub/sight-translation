/**
 * 卡片构建器
 * 构建飞书互动卡片 JSON
 * 
 * 验证: 需求 3.1 - Card 包含口译项目单选、口译工时输入框、笔译项目单选、笔译工时输入框
 * 验证: 需求 3.6 - Card 在提交按钮旁显示"取消"按钮
 */

import { Project, SubmitSummary } from '../types';
import {
  InteractiveCard,
  CardElement,
  SelectOption,
  ActionElement,
  DivElement,
} from '../types/feishu';

/**
 * CardBuilder 接口
 */
export interface ICardBuilder {
  buildWorkhourCard(projects: Project[]): InteractiveCard;
  buildSuccessCard(summary: SubmitSummary): InteractiveCard;
  buildErrorCard(message: string): InteractiveCard;
}

/**
 * 卡片构建器实现
 */
export class CardBuilder implements ICardBuilder {
  /**
   * 构建工时填报互动卡片
   * 验证: 需求 3.1 - 包含口译项目单选、口译工时输入框、笔译项目单选、笔译工时输入框
   * 验证: 需求 3.6 - 在提交按钮旁显示"取消"按钮
   * 
   * @param projects 进行中的项目列表（包含项目类型）
   * @returns 飞书互动卡片
   */
  buildWorkhourCard(projects: Project[]): InteractiveCard {
    // 按项目类型分组
    const interpretationProjects = projects.filter(p => p.projectType === 'interpretation');
    const translationProjects = projects.filter(p => p.projectType === 'translation');

    // 将项目列表转换为选择项
    const interpretationOptions: SelectOption[] = interpretationProjects.map((project) => ({
      text: { tag: 'plain_text', content: project.name },
      value: project.recordId,
    }));

    const translationOptions: SelectOption[] = translationProjects.map((project) => ({
      text: { tag: 'plain_text', content: project.name },
      value: project.recordId,
    }));

    const elements: CardElement[] = [
      // 说明文本
      {
        tag: 'div',
        text: { tag: 'plain_text', content: '请填写本周工时：' },
      } as DivElement,

      // 口译项目标题
      {
        tag: 'div',
        text: { tag: 'lark_md', content: '**口译项目**' },
      } as DivElement,

      // 口译项目单选
      {
        tag: 'action',
        actions: [
          {
            tag: 'select_static',
            placeholder: { tag: 'plain_text', content: interpretationOptions.length > 0 ? '选择口译项目' : '暂无进行中的口译项目' },
            options: interpretationOptions.length > 0 ? interpretationOptions : [{ text: { tag: 'plain_text', content: '暂无项目' }, value: '' }],
            value: { key: 'interpretation_project' },
          },
        ],
      } as ActionElement,

      // 口译工时输入框
      {
        tag: 'action',
        actions: [
          {
            tag: 'input',
            name: 'interpretation_time',
            placeholder: { tag: 'plain_text', content: '输入口译工时（分钟）' },
          },
        ],
      } as ActionElement,

      // 笔译项目标题
      {
        tag: 'div',
        text: { tag: 'lark_md', content: '**笔译项目**' },
      } as DivElement,

      // 笔译项目单选
      {
        tag: 'action',
        actions: [
          {
            tag: 'select_static',
            placeholder: { tag: 'plain_text', content: translationOptions.length > 0 ? '选择笔译项目' : '暂无进行中的笔译项目' },
            options: translationOptions.length > 0 ? translationOptions : [{ text: { tag: 'plain_text', content: '暂无项目' }, value: '' }],
            value: { key: 'translation_project' },
          },
        ],
      } as ActionElement,

      // 笔译工时输入框
      {
        tag: 'action',
        actions: [
          {
            tag: 'input',
            name: 'translation_time',
            placeholder: { tag: 'plain_text', content: '输入笔译工时（分钟）' },
          },
        ],
      } as ActionElement,

      // 提交和取消按钮
      {
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '提交' },
            type: 'primary',
            value: { action: 'submit' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '取消' },
            type: 'default',
            value: { action: 'cancel' },
          },
        ],
      } as ActionElement,
    ];

    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '📝 工时填报' },
        template: 'blue',
      },
      elements,
    };
  }

  /**
   * 构建成功提示卡片
   * 
   * @param summary 提交摘要
   * @returns 飞书互动卡片
   */
  buildSuccessCard(summary: SubmitSummary): InteractiveCard {
    const elements: CardElement[] = [
      {
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `✅ **${summary.translatorName}**，您的工时已成功提交！`,
        },
      } as DivElement,
    ];

    // 添加口译工时信息
    if (summary.interpretationProject && summary.interpretationTime) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**口译项目**：${summary.interpretationProject}\n**口译工时**：${summary.interpretationTime} 分钟`,
        },
      } as DivElement);
    }

    // 添加笔译工时信息
    if (summary.translationProject && summary.translationTime) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `**笔译项目**：${summary.translationProject}\n**笔译工时**：${summary.translationTime} 分钟`,
        },
      } as DivElement);
    }

    // 添加提交时间
    elements.push({
      tag: 'note',
      elements: [
        {
          tag: 'plain_text',
          content: `提交时间：${summary.submitTime}`,
        },
      ],
    });

    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '✅ 提交成功' },
        template: 'green',
      },
      elements,
    };
  }

  /**
   * 构建错误提示卡片
   * 
   * @param message 错误消息
   * @returns 飞书互动卡片
   */
  buildErrorCard(message: string): InteractiveCard {
    return {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '❌ 操作失败' },
        template: 'red',
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**错误信息**：${message}`,
          },
        } as DivElement,
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '如有问题，请联系管理员或稍后重试。',
            },
          ],
        },
      ],
    };
  }
}

// 导出默认实例
export const cardBuilder = new CardBuilder();
