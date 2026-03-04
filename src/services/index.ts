/**
 * 服务层统一导出
 */

export { FileParser, fileParser } from './FileParser';
export type { IFileParser } from './FileParser';

export { SentenceSplitter, sentenceSplitter } from './SentenceSplitter';
export type { ISentenceSplitter } from './SentenceSplitter';

export { ParagraphSplitter, paragraphSplitter } from './ParagraphSplitter';
export type { IParagraphSplitter } from './ParagraphSplitter';

export { ParagraphMatcher, createParagraphMatcher } from './ParagraphMatcher';
export type { IParagraphMatcher } from './ParagraphMatcher';

export { TextSeparator, createTextSeparator } from './TextSeparator';
export type { ITextSeparator, SeparatedText } from './TextSeparator';

export { ImageOCR, createImageOCR } from './ImageOCR';
export type { IOcrService } from './ImageOCR';

export { ProjectManager, projectManager } from './ProjectManager';
export type { IProjectManager } from './ProjectManager';

export { ExpressionCollector, expressionCollector } from './ExpressionCollector';
export type { IExpressionCollector } from './ExpressionCollector';

export { FlashcardGenerator, flashcardGenerator } from './FlashcardGenerator';
export type { IFlashcardGenerator } from './FlashcardGenerator';

export { 
  hasTraditionalChinese, 
  convertToSimplified, 
  smartConvert 
} from './ChineseConverter';
