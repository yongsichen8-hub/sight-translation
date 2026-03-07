import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量 - 使用 __dirname 确保找到正确的 .env 文件
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const config = {
  // 服务器配置
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // 数据存储目录
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  
  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // 飞书 OAuth 配置
  feishu: {
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    redirectUri: process.env.FEISHU_REDIRECT_URI || 'http://localhost:5173/auth/callback',
  },
  
  // 新闻配置
  news: {
    similarityThreshold: parseFloat(process.env.NEWS_SIMILARITY_THRESHOLD || '0.75'),
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    chatModel: process.env.CHAT_MODEL || 'gpt-4o-mini',
  },

  // CORS 配置
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  
  // 频率限制配置
  rateLimit: {
    windowMs: 60 * 1000, // 1 分钟
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  // Cookie 配置
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
    sameSite: (process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true') ? 'none' as const : 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
  },
};
