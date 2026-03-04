/**
 * FileParser 服务
 * 负责从不同格式文件中提取纯文本内容
 * 支持 TXT、PDF、Word (.doc, .docx) 格式
 * 自动将繁体中文转换为简体中文
 */

import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import { FileParseError, SupportedFileType } from '../types';
import { smartConvert } from './ChineseConverter';

// 配置 pdf.js worker
// 使用 unpkg CDN，确保版本匹配
const PDFJS_VERSION = pdfjsLib.version;
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

/**
 * 支持的 MIME 类型列表
 */
const SUPPORTED_MIME_TYPES: SupportedFileType[] = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * 文件扩展名到 MIME 类型的映射
 * 用于处理某些浏览器不正确设置 MIME 类型的情况
 */
const EXTENSION_TO_MIME: Record<string, SupportedFileType> = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/**
 * FileParser 接口
 */
export interface IFileParser {
  parseFile(file: File): Promise<string>;
  isSupportedFormat(file: File): boolean;
}

/**
 * 获取文件的有效 MIME 类型
 * 优先使用文件扩展名判断，因为某些浏览器的 MIME 类型不准确
 */
function getEffectiveMimeType(file: File): string {
  const fileName = file.name.toLowerCase();
  const extension = fileName.substring(fileName.lastIndexOf('.'));
  
  // 优先使用扩展名映射
  if (extension in EXTENSION_TO_MIME) {
    return EXTENSION_TO_MIME[extension];
  }
  
  // 回退到文件的 MIME 类型
  return file.type;
}

/**
 * 解析 TXT 文件
 */
async function parseTxtFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const text = reader.result as string;
      resolve(text);
    };
    
    reader.onerror = () => {
      reject(new FileParseError(file.name, 'parse_failed', `Failed to read TXT file: ${file.name}`));
    };
    
    reader.readAsText(file);
  });
}


/**
 * 解析 PDF 文件
 * 使用 pdf.js 提取文本内容
 * 改进版：更好地处理中文字体和编码
 */
async function parsePdfFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // 创建加载任务，使用更兼容的配置
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      // 启用 CMap 支持中文字符
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
      // 标准字体路径
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/standard_fonts/`,
      // 禁用字体渲染（只提取文本）
      disableFontFace: true,
      // 忽略错误继续解析
      ignoreErrors: true,
    });
    
    const pdf = await loadingTask.promise;
    
    const textParts: string[] = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent({
          // 包含标记内容
          includeMarkedContent: true,
          // 不合并相邻文本
          disableCombineTextItems: false,
        });
        
        // 更智能地组合文本项
        let pageText = '';
        let lastY: number | null = null;
        
        for (const item of textContent.items) {
          if ('str' in item && item.str) {
            // 检查是否换行（Y 坐标变化）
            if ('transform' in item && item.transform) {
              const currentY = item.transform[5];
              if (lastY !== null && Math.abs(currentY - lastY) > 5) {
                pageText += '\n';
              } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
                pageText += ' ';
              }
              lastY = currentY;
            }
            pageText += item.str;
          }
        }
        
        if (pageText.trim()) {
          textParts.push(pageText.trim());
        }
      } catch (pageError) {
        console.warn(`Failed to parse page ${i}:`, pageError);
        // 继续处理其他页面
      }
    }
    
    const result = textParts.join('\n\n');
    
    // 检查是否有乱码（大量连续的特殊字符）
    if (hasGarbledText(result)) {
      throw new FileParseError(
        file.name,
        'parse_failed',
        `PDF 文件可能使用了不支持的字体或编码，建议转换为 Word 或 TXT 格式后重试`
      );
    }
    
    return result;
  } catch (error) {
    if (error instanceof FileParseError) {
      throw error;
    }
    console.error('PDF parsing error:', error);
    throw new FileParseError(
      file.name,
      'parse_failed',
      `PDF 文件解析失败: ${file.name}。建议转换为 Word 或 TXT 格式后重试`
    );
  }
}

/**
 * 检测文本是否包含乱码
 * 通过检查特殊字符的比例来判断
 */
function hasGarbledText(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  // 统计可识别字符（中文、英文、数字、常见标点）
  const validChars = text.match(/[\u4e00-\u9fa5a-zA-Z0-9\s.,!?;:'"()（）。，！？；：""''、\-\n]/g) || [];
  const validRatio = validChars.length / text.length;
  
  // 如果可识别字符少于 60%，认为是乱码
  return validRatio < 0.6;
}

/**
 * 解析 Word 文件 (.doc, .docx)
 * 使用 mammoth.js 提取文本内容
 */
async function parseWordFile(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new FileParseError(
      file.name,
      'parse_failed',
      `Failed to parse Word file: ${file.name}. ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * 检查文本内容是否为空
 * 空白字符（空格、换行、制表符等）视为空内容
 */
function isEmptyContent(text: string): boolean {
  return text.trim().length === 0;
}

/**
 * FileParser 类
 * 实现文件解析功能
 */
export class FileParser implements IFileParser {
  /**
   * 检查文件格式是否支持
   * @param file 文件对象
   * @returns 是否支持该格式
   */
  isSupportedFormat(file: File): boolean {
    const mimeType = getEffectiveMimeType(file);
    return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedFileType);
  }

  /**
   * 解析文件并提取文本内容
   * @param file 上传的文件对象
   * @returns 提取的纯文本内容
   * @throws FileParseError 当文件格式不支持或解析失败时
   */
  async parseFile(file: File): Promise<string> {
    // 检查文件格式
    if (!this.isSupportedFormat(file)) {
      throw new FileParseError(
        file.name,
        'unsupported_format',
        `Unsupported file format: ${file.name}. Supported formats: TXT, PDF, DOC, DOCX`
      );
    }

    const mimeType = getEffectiveMimeType(file);
    let text: string;

    // 根据文件类型选择解析方法
    switch (mimeType) {
      case 'text/plain':
        text = await parseTxtFile(file);
        break;
      case 'application/pdf':
        text = await parsePdfFile(file);
        break;
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        text = await parseWordFile(file);
        break;
      default:
        throw new FileParseError(
          file.name,
          'unsupported_format',
          `Unsupported file format: ${file.name}`
        );
    }

    // 检查内容是否为空
    if (isEmptyContent(text)) {
      throw new FileParseError(
        file.name,
        'empty_content',
        `File contains no text content: ${file.name}`
      );
    }

    // 自动将繁体中文转换为简体中文
    return smartConvert(text);
  }
}

/**
 * 默认 FileParser 实例
 */
export const fileParser = new FileParser();
