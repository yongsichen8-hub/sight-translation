import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { config } from './config';
import { SourceRegistryService } from './services/SourceRegistryService';
import { TopicMatcher } from './services/Matcher';
import { NewsRanker } from './services/NewsRanker';
import { NewsStorageService } from './services/NewsStorageService';
import { NewsDomain } from './types';

const app = express();
app.use(cors());
app.use(express.json());

// Services
const storage = new NewsStorageService();
const registry = new SourceRegistryService();
const matcher = new TopicMatcher();
const ranker = new NewsRanker(registry);

const VALID_DOMAINS: NewsDomain[] = ['ai-tech', 'finance', 'geopolitics', 'automotive'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// --- API Routes ---

app.get('/api/news/daily', async (req, res) => {
  try {
    const dateParam = req.query.date as string | undefined;
    const domainParam = req.query.domain as string | undefined;
    const date = dateParam || new Date().toISOString().slice(0, 10);

    if (!DATE_REGEX.test(date) || isNaN(Date.parse(date))) {
      res.status(400).json({ success: false, error: { message: '日期格式无效' } });
      return;
    }
    if (domainParam && !VALID_DOMAINS.includes(domainParam as NewsDomain)) {
      res.status(400).json({ success: false, error: { message: '无效的领域' } });
      return;
    }

    const daily = await storage.getDailyNews(date);
    if (!daily) {
      // Try latest
      const latest = await storage.getLatestDailyNews();
      if (!latest) {
        res.status(404).json({ success: false, error: { message: '暂无新闻数据，请先触发抓取' } });
        return;
      }
      let items = latest.items;
      if (domainParam) {
        const d = domainParam as NewsDomain;
        items = items.filter((i) => i.domain === d || i.secondaryDomains.includes(d));
      }
      res.json({ success: true, data: { date: latest.date, items, generatedAt: latest.generatedAt } });
      return;
    }

    let items = daily.items;
    if (domainParam) {
      const d = domainParam as NewsDomain;
      items = items.filter((i) => i.domain === d || i.secondaryDomains.includes(d));
    }
    res.json({ success: true, data: { date: daily.date, items, generatedAt: daily.generatedAt } });
  } catch {
    res.status(500).json({ success: false, error: { message: '服务器错误' } });
  }
});

app.get('/api/news/sources', (_req, res) => {
  res.json({ success: true, data: registry.getSources() });
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const item = await storage.getNewsItemById(date, req.params.id);
    if (!item) { res.status(404).json({ success: false, error: { message: '未找到' } }); return; }
    res.json({ success: true, data: item });
  } catch {
    res.status(500).json({ success: false, error: { message: '服务器错误' } });
  }
});

app.post('/api/news/trigger', async (_req, res) => {
  try {
    console.log('📰 RSS驱动模式：抓取实时新闻 → LLM筛选 → 搜索中英文配对...');
    const matched = await matcher.matchArticles();
    const pairedCount = matched.filter(m => m.pairingStatus === 'paired').length;

    // rankAndSelect will filter to paired only and sort
    const ranked = ranker.rankAndSelect(matched);
    console.log(`  ✅ 最终 ${ranked.length} 条双语新闻 (${pairedCount} 对配对)`);

    const now = new Date();
    const result = {
      success: true, completedAt: now.toISOString(),
      articlesFetched: 0, newsItemsGenerated: ranked.length,
      retryCount: 0, errors: [] as string[],
    };
    await storage.saveDailyNews({
      date: now.toISOString().slice(0, 10), items: ranked,
      generatedAt: now.toISOString(), updateResult: result,
    });
    console.log('✅ 新闻更新完成');
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ 新闻更新失败:', err instanceof Error ? err.message : err);
    res.status(500).json({ success: false, error: { message: err instanceof Error ? err.message : '更新失败' } });
  }
});

// --- Serve frontend (no cache for HTML) ---
app.use(express.static(path.join(__dirname, '..', 'public'), {
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(config.port, () => {
  console.log(`🚀 双语新闻平台运行在 http://localhost:${config.port}`);
});
