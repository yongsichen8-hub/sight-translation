import dotenv from 'dotenv';
dotenv.config();

export interface Config {
  FEISHU_APP_ID: string;
  FEISHU_APP_SECRET: string;
  BITABLE_APP_TOKEN: string;
  INTERPRETATION_TABLE_ID: string;
  TRANSLATION_TABLE_ID: string;
  JWT_SECRET: string;
  PORT: string;
  CORS_ORIGIN: string;
  FEISHU_REDIRECT_URI: string;
  ADMIN_OPEN_IDS: string[];
}

const REQUIRED_VARS: (keyof Config)[] = [
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'BITABLE_APP_TOKEN',
  'INTERPRETATION_TABLE_ID',
  'TRANSLATION_TABLE_ID',
  'JWT_SECRET',
];

export function validateConfig(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export const config: Config = {
  FEISHU_APP_ID: process.env.FEISHU_APP_ID || '',
  FEISHU_APP_SECRET: process.env.FEISHU_APP_SECRET || '',
  BITABLE_APP_TOKEN: process.env.BITABLE_APP_TOKEN || '',
  INTERPRETATION_TABLE_ID: process.env.INTERPRETATION_TABLE_ID || '',
  TRANSLATION_TABLE_ID: process.env.TRANSLATION_TABLE_ID || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  PORT: process.env.PORT || '3002',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5174',
  FEISHU_REDIRECT_URI: process.env.FEISHU_REDIRECT_URI || 'http://localhost:5174/auth/callback',
  ADMIN_OPEN_IDS: (process.env.ADMIN_OPEN_IDS || '').split(',').map(s => s.trim()).filter(Boolean),
};
