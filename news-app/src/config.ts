import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  dataDir: process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  news: {
    similarityThreshold: parseFloat(process.env.NEWS_SIMILARITY_THRESHOLD || '0.75'),
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    chatModel: process.env.CHAT_MODEL || 'gpt-4o-mini',
  },
};
