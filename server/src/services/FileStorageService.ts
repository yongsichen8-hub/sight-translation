import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';

/**
 * 文件存储服务 - 管理用户数据的 JSON 文件存储
 * 每个用户有独立的目录，包含多个 JSON 文件
 */
export class FileStorageService {
  private dataDir: string;
  private locks: Map<string, Promise<void>> = new Map();

  constructor(dataDir?: string) {
    this.dataDir = dataDir || config.dataDir;
  }

  /**
   * 验证路径安全性，防止目录遍历攻击
   */
  private validatePath(input: string): void {
    // 检查空值
    if (!input || input.trim() === '') {
      throw new Error('PATH_SECURITY_ERROR: 路径不能为空');
    }

    // 检查目录遍历
    if (input.includes('..')) {
      throw new Error('PATH_SECURITY_ERROR: 路径不能包含 ".."');
    }

    // 检查绝对路径
    if (path.isAbsolute(input)) {
      throw new Error('PATH_SECURITY_ERROR: 不允许使用绝对路径');
    }

    // 检查特殊字符
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    if (invalidChars.test(input)) {
      throw new Error('PATH_SECURITY_ERROR: 路径包含非法字符');
    }

    // 检查路径分隔符（只允许正斜杠或无分隔符）
    if (input.includes('\\')) {
      throw new Error('PATH_SECURITY_ERROR: 路径不能包含反斜杠');
    }
  }

  /**
   * 获取用户数据目录路径
   */
  getUserDir(userId: string): string {
    this.validatePath(userId);
    return path.join(this.dataDir, userId);
  }

  /**
   * 确保用户目录存在
   */
  async ensureUserDir(userId: string): Promise<void> {
    const userDir = this.getUserDir(userId);
    await fs.mkdir(userDir, { recursive: true });
  }


  /**
   * 获取文件完整路径
   */
  private getFilePath(userId: string, filename: string): string {
    this.validatePath(userId);
    this.validatePath(filename);
    return path.join(this.dataDir, userId, filename);
  }

  /**
   * 获取备份文件路径
   */
  private getBackupPath(filePath: string): string {
    return `${filePath}.backup`;
  }

  /**
   * 读取 JSON 文件
   */
  async readJson<T>(userId: string, filename: string): Promise<T> {
    const filePath = this.getFilePath(userId, filename);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在，返回默认值
        return this.getDefaultValue<T>(filename);
      }
      throw new Error(`FILE_READ_ERROR: 读取文件失败 - ${(error as Error).message}`);
    }
  }

  /**
   * 获取文件默认值
   */
  private getDefaultValue<T>(filename: string): T {
    const defaults: Record<string, unknown> = {
      'user.json': null,
      'projects.json': { version: 1, projects: [] },
      'expressions.json': { version: 1, expressions: [] },
      'flashcards.json': { version: 1, flashcards: [] },
      'review-records.json': { version: 1, records: [] },
      'notebooks.json': { version: 1, notebooks: [] },
      'notebook-ai-settings.json': { apiKey: '', baseUrl: 'https://api.openai.com/v1', model: '' },
    };
    return (defaults[filename] ?? null) as T;
  }

  /**
   * 写入 JSON 文件（带备份和锁）
   */
  async writeJson<T>(userId: string, filename: string, data: T): Promise<void> {
    const filePath = this.getFilePath(userId, filename);
    const lockKey = filePath;

    // 等待之前的写入完成
    const existingLock = this.locks.get(lockKey);
    if (existingLock) {
      await existingLock;
    }

    // 创建新的锁
    const writePromise = this.performWrite(filePath, data);
    this.locks.set(lockKey, writePromise.then(() => {}).catch(() => {}));

    try {
      await writePromise;
    } finally {
      this.locks.delete(lockKey);
    }
  }

  /**
   * 执行实际的写入操作
   */
  private async performWrite<T>(filePath: string, data: T): Promise<void> {
    const backupPath = this.getBackupPath(filePath);
    const dir = path.dirname(filePath);
    
    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });

    // 如果文件存在，先创建备份
    let hasBackup = false;
    try {
      await fs.access(filePath);
      await fs.copyFile(filePath, backupPath);
      hasBackup = true;
    } catch {
      // 文件不存在，无需备份
    }

    try {
      // 写入新数据
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
      
      // 写入成功，删除备份
      if (hasBackup) {
        await fs.unlink(backupPath).catch(() => {});
      }
    } catch (error) {
      // 写入失败，尝试从备份恢复
      if (hasBackup) {
        try {
          await fs.copyFile(backupPath, filePath);
        } catch {
          // 恢复也失败了
        }
      }
      throw new Error(`FILE_WRITE_ERROR: 写入文件失败 - ${(error as Error).message}`);
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(userId: string, filename: string): Promise<boolean> {
    const filePath = this.getFilePath(userId, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(userId: string, filename: string): Promise<void> {
    const filePath = this.getFilePath(userId, filename);
    try {
      await fs.unlink(filePath);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw new Error(`FILE_DELETE_ERROR: 删除文件失败 - ${(error as Error).message}`);
      }
    }
  }
}

// 导出单例
export const fileStorageService = new FileStorageService();
