/**
 * SentenceSplitter 单元测试
 */

import { describe, it, expect } from 'vitest';
import { SentenceSplitter, sentenceSplitter } from './SentenceSplitter';
import { DEFAULT_SPLIT_CONFIG } from '../types/models';

describe('SentenceSplitter', () => {
  describe('中文句子切分', () => {
    it('应该按句号切分中文文本', () => {
      const text = '你好。世界。';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['你好。', '世界。']);
    });

    it('应该按感叹号切分中文文本', () => {
      const text = '太棒了！真厉害！';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['太棒了！', '真厉害！']);
    });

    it('应该按问号切分中文文本', () => {
      const text = '你好吗？今天怎么样？';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['你好吗？', '今天怎么样？']);
    });

    it('应该按分号切分中文文本', () => {
      const text = '第一点；第二点；';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['第一点；', '第二点；']);
    });

    it('应该处理混合标点的中文文本', () => {
      const text = '你好。世界！测试？完成；';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['你好。', '世界！', '测试？', '完成；']);
    });

    it('应该保持句子原始顺序', () => {
      const text = '第一句。第二句。第三句。';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['第一句。', '第二句。', '第三句。']);
    });

    it('应该处理无标点的中文文本', () => {
      const text = '没有标点的文本';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['没有标点的文本']);
    });
  });

  describe('英文句子切分', () => {
    it('应该按句号切分英文文本', () => {
      const text = 'Hello. World.';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['Hello.', 'World.']);
    });

    it('应该按感叹号切分英文文本', () => {
      const text = 'Amazing! Great!';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['Amazing!', 'Great!']);
    });

    it('应该按问号切分英文文本', () => {
      const text = 'How are you? What is this?';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['How are you?', 'What is this?']);
    });

    it('应该处理混合标点的英文文本', () => {
      const text = 'Hello. How are you? Great!';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['Hello.', 'How are you?', 'Great!']);
    });

    it('应该保持句子原始顺序', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['First sentence.', 'Second sentence.', 'Third sentence.']);
    });

    it('应该处理无标点的英文文本', () => {
      const text = 'Text without punctuation';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['Text without punctuation']);
    });

    it('应该正确处理常见缩写 Mr.', () => {
      const text = 'Mr. Smith is here. He is nice.';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['Mr. Smith is here.', 'He is nice.']);
    });

    it('应该正确处理常见缩写 Dr.', () => {
      const text = 'Dr. Jones arrived. She is a doctor.';
      const result = sentenceSplitter.split(text, 'en');
      expect(result).toEqual(['Dr. Jones arrived.', 'She is a doctor.']);
    });
  });

  describe('边界情况', () => {
    it('应该处理空字符串', () => {
      const result = sentenceSplitter.split('', 'zh');
      expect(result).toEqual([]);
    });

    it('应该处理仅空白的字符串', () => {
      const result = sentenceSplitter.split('   ', 'zh');
      expect(result).toEqual([]);
    });

    it('应该处理单个句子', () => {
      const result = sentenceSplitter.split('单个句子。', 'zh');
      expect(result).toEqual(['单个句子。']);
    });

    it('应该处理句子间有多余空格的情况', () => {
      const text = '第一句。   第二句。';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['第一句。', '第二句。']);
    });

    it('应该处理以空格开头的文本', () => {
      const text = '  开头有空格。结尾也有。';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result).toEqual(['开头有空格。', '结尾也有。']);
    });
  });

  describe('配置选项', () => {
    it('应该支持不保留标点的配置', () => {
      const splitter = new SentenceSplitter({
        ...DEFAULT_SPLIT_CONFIG,
        preservePunctuation: false,
      });
      const text = '你好。世界！';
      const result = splitter.split(text, 'zh');
      expect(result).toEqual(['你好', '世界']);
    });

    it('应该支持自定义终止符', () => {
      const splitter = new SentenceSplitter({
        zhTerminators: ['。'],
        enTerminators: ['.'],
        preservePunctuation: true,
      });
      const text = '你好。世界！测试？';
      const result = splitter.split(text, 'zh');
      // 只有句号会切分，感叹号和问号不会
      expect(result).toEqual(['你好。', '世界！测试？']);
    });

    it('应该处理空终止符配置', () => {
      const splitter = new SentenceSplitter({
        zhTerminators: [],
        enTerminators: [],
        preservePunctuation: true,
      });
      const text = '你好。世界！';
      const result = splitter.split(text, 'zh');
      expect(result).toEqual(['你好。世界！']);
    });
  });

  describe('默认实例', () => {
    it('应该导出默认实例', () => {
      expect(sentenceSplitter).toBeInstanceOf(SentenceSplitter);
    });

    it('默认实例应该使用默认配置', () => {
      const text = '你好。世界！测试？完成；';
      const result = sentenceSplitter.split(text, 'zh');
      expect(result.length).toBe(4);
    });
  });
});
