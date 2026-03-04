/**
 * 错误类型定义
 * 视译练习软件的自定义错误类
 */

/**
 * 文件解析错误原因
 */
export type FileParseErrorReason =
  | 'unsupported_format'
  | 'empty_content'
  | 'parse_failed';

/**
 * 文件解析错误
 * 当文件格式不支持或解析失败时抛出
 */
export class FileParseError extends Error {
  public readonly name = 'FileParseError';

  constructor(
    public readonly fileName: string,
    public readonly reason: FileParseErrorReason,
    message: string
  ) {
    super(message);
    // 确保原型链正确（TypeScript 编译到 ES5 时需要）
    Object.setPrototypeOf(this, FileParseError.prototype);
  }
}

/**
 * 数据验证错误
 * 当数据不符合验证规则时抛出
 */
export class ValidationError extends Error {
  public readonly name = 'ValidationError';

  constructor(
    public readonly field: string,
    public readonly constraint: string
  ) {
    super(`Validation failed: ${field} - ${constraint}`);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * 实体类型
 */
export type EntityType = 'project' | 'expression';

/**
 * 重复错误
 * 当尝试创建已存在的实体时抛出
 */
export class DuplicateError extends Error {
  public readonly name = 'DuplicateError';

  constructor(
    public readonly entityType: EntityType,
    public readonly identifier: string
  ) {
    super(`${entityType} already exists: ${identifier}`);
    Object.setPrototypeOf(this, DuplicateError.prototype);
  }
}

/**
 * 数据库操作类型
 */
export type DatabaseOperation = 'read' | 'write' | 'delete';

/**
 * 数据库错误
 * 当数据库操作失败时抛出
 */
export class DatabaseError extends Error {
  public readonly name = 'DatabaseError';

  constructor(
    public readonly operation: DatabaseOperation,
    public readonly entity: string,
    public readonly cause?: Error
  ) {
    const causeMessage = cause?.message ? `: ${cause.message}` : '';
    super(`Database ${operation} failed for ${entity}${causeMessage}`);
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

/**
 * 获取文件解析错误的用户友好消息
 */
export const getFileParseErrorMessage = (error: FileParseError): string => {
  switch (error.reason) {
    case 'unsupported_format':
      return `不支持的文件格式: ${error.fileName}。请上传 TXT、PDF 或 Word 文件。`;
    case 'empty_content':
      return `文件内容为空: ${error.fileName}。请上传包含文本内容的文件。`;
    case 'parse_failed':
      return `文件解析失败: ${error.fileName}。请检查文件是否损坏。`;
  }
};
