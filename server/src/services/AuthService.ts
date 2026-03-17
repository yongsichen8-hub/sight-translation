import * as bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, AuthResult, JWTPayload } from '../types';
import { fileStorageService } from './FileStorageService';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

const SALT_ROUNDS = 10;

/**
 * 用户索引文件：username -> feishuUserId (数据目录名)
 * 存储在 dataDir/users-index.json
 */
interface UsersIndex {
  [username: string]: string; // username -> dataDir userId (feishuUserId)
}

/**
 * 认证服务 - 用户名密码登录 + JWT
 */
export class AuthService {
  private indexPath: string;

  constructor() {
    this.indexPath = path.join(config.dataDir, 'users-index.json');
  }

  /**
   * 读取用户索引
   */
  private async readIndex(): Promise<UsersIndex> {
    try {
      const content = await fs.readFile(this.indexPath, 'utf-8');
      return JSON.parse(content) as UsersIndex;
    } catch {
      return {};
    }
  }

  /**
   * 写入用户索引
   */
  private async writeIndex(index: UsersIndex): Promise<void> {
    await fs.mkdir(path.dirname(this.indexPath), { recursive: true });
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }

  /**
   * 注册新用户
   */
  async register(username: string, password: string): Promise<AuthResult> {
    if (!username || username.trim().length < 2 || username.trim().length > 30) {
      throw new Error('VALIDATION_ERROR: 用户名长度必须为 2-30 个字符');
    }
    if (!password || password.length < 6 || password.length > 50) {
      throw new Error('VALIDATION_ERROR: 密码长度必须为 6-50 个字符');
    }

    const trimmedUsername = username.trim();
    const index = await this.readIndex();

    if (index[trimmedUsername]) {
      throw new Error('DUPLICATE_USER: 用户名已存在');
    }

    // 生成数据目录 ID（保持与原飞书用户目录兼容的格式）
    const dataDirId = uuidv4();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    const user: User = {
      id: uuidv4(),
      username: trimmedUsername,
      passwordHash,
      feishuUserId: dataDirId,
      name: trimmedUsername,
      avatar: '',
      createdAt: now,
      updatedAt: now,
    };

    // 创建用户数据目录和文件
    await fileStorageService.ensureUserDir(dataDirId);
    await fileStorageService.writeJson(dataDirId, 'user.json', user);

    // 更新索引
    index[trimmedUsername] = dataDirId;
    await this.writeIndex(index);

    const jwtToken = this.generateToken(user);

    return {
      user,
      jwt: jwtToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * 用户名密码登录
   */
  async login(username: string, password: string): Promise<AuthResult> {
    if (!username || !password) {
      throw new Error('VALIDATION_ERROR: 请输入用户名和密码');
    }

    const trimmedUsername = username.trim();
    const index = await this.readIndex();
    const dataDirId = index[trimmedUsername];

    if (!dataDirId) {
      throw new Error('AUTH_FAILED: 用户名或密码错误');
    }

    const user = await fileStorageService.readJson<User | null>(dataDirId, 'user.json');
    if (!user) {
      throw new Error('AUTH_FAILED: 用户名或密码错误');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new Error('AUTH_FAILED: 用户名或密码错误');
    }

    const jwtToken = this.generateToken(user);

    return {
      user,
      jwt: jwtToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * 迁移飞书用户：将现有飞书用户目录关联到新的用户名
   */
  async migrateFeishuUser(feishuUserId: string, username: string, password: string): Promise<AuthResult> {
    if (!username || username.trim().length < 2) {
      throw new Error('VALIDATION_ERROR: 用户名长度必须为 2-30 个字符');
    }
    if (!password || password.length < 6) {
      throw new Error('VALIDATION_ERROR: 密码长度必须为 6-50 个字符');
    }

    const trimmedUsername = username.trim();
    const index = await this.readIndex();

    if (index[trimmedUsername]) {
      throw new Error('DUPLICATE_USER: 用户名已存在');
    }

    // 检查飞书用户目录是否存在
    const existingUser = await fileStorageService.readJson<User | null>(feishuUserId, 'user.json');
    if (!existingUser) {
      throw new Error('NOT_FOUND: 飞书用户数据不存在');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const now = new Date().toISOString();

    // 更新用户信息，保留原有数据目录
    const updatedUser: User = {
      ...existingUser,
      username: trimmedUsername,
      passwordHash,
      updatedAt: now,
    };

    await fileStorageService.writeJson(feishuUserId, 'user.json', updatedUser);

    // 更新索引
    index[trimmedUsername] = feishuUserId;
    await this.writeIndex(index);

    const jwtToken = this.generateToken(updatedUser);

    return {
      user: updatedUser,
      jwt: jwtToken,
      expiresIn: 7 * 24 * 60 * 60,
    };
  }

  /**
   * 生成 JWT 令牌
   */
  generateToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      feishuUserId: user.feishuUserId,
      username: user.username || user.name,
      name: user.name,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: 7 * 24 * 60 * 60,
    });
  }

  /**
   * 验证 JWT 令牌
   */
  verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED: JWT 令牌已过期');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('TOKEN_INVALID: JWT 令牌无效');
      }
      throw error;
    }
  }
}

// 导出单例
export const authService = new AuthService();
