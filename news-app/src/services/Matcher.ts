import Parser from 'rss-parser';
import { extract } from '@extractus/article-extractor';
import { randomUUID } from 'crypto';
import { config } from '../config';
import { NewsItem, NewsDomain } from '../types';

const CANDIDATES_PER_DOMAIN = 6;
const FINAL_PER_DOMAIN = 3;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const FETCH_TIMEOUT = 15000;

interface DomainDef { label: string; description: string; feeds: string[]; }
interface RssArticle { title: string; url: string; publishedAt: string; source: string; }
interface SelectedArticle extends RssArticle { zhQuery: string; }

const DOMAINS: Record<NewsDomain, DomainDef> = {
  'ai-tech': {
    label: 'AI科技',
    description: '人工智能、大模型、芯片、机器人、科技公司',
    feeds: [
      'https://techcrunch.com/category/artificial-intelligence/feed/',
      'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
      'https://feeds.arstechnica.com/arstechnica/technology-lab',
      'https://www.wired.com/feed/tag/ai/latest/rss',
    ],
  },
  'finance': {
    label: '金融经济',
    description: '股市、央行、利率、GDP、贸易、加密货币、经济政策',
    feeds: [
      'https://feeds.bbci.co.uk/news/business/rss.xml',
      'https://www.cnbc.com/id/100003114/device/rss/rss.html',
      'https://www.ft.com/?format=rss',
      'https://feeds.marketwatch.com/marketwatch/topstories/',
    ],
  },
  'geopolitics': {
    label: '国际政治',
    description: '国际关系、战争冲突、外交、制裁、联合国、NATO',
    feeds: [
      'https://feeds.bbci.co.uk/news/world/rss.xml',
      'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
      'https://www.aljazeera.com/xml/rss/all.xml',
      'https://www.theguardian.com/world/rss',
    ],
  },
  'automotive': {
    label: '汽车',
    description: '汽车行业、电动车、自动驾驶、车企、新能源',
    feeds: [
      'https://www.autoblog.com/rss.xml',
      'https://electrek.co/feed/',
      'https://insideevs.com/rss/news/all/',
      'https://www.thedrive.com/feed',
    ],
  },
};

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}

async function callLLM(sys: string, user: string): Promise<string> {
  const resp = await fetch(`${config.news.openaiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.news.openaiApiKey}` },
    body: JSON.stringify({ model: config.news.chatModel, messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.1 }),
  });
  if (!resp.ok) throw new Error(`LLM API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json() as any;
  return (data.choices?.[0]?.message?.content || '').trim();
}

export class TopicMatcher {
  private parser: Parser;
  constructor() {
    this.parser = new Parser({ customFields: { item: [] }, timeout: FETCH_TIMEOUT } as any);
  }

  private async fetchRssArticles(domain: NewsDomain): Promise<RssArticle[]> {
    const def = DOMAINS[domain];
    const articles: RssArticle[] = [];
    for (const feedUrl of def.feeds) {
      try {
        const feed = await this.parser.parseURL(feedUrl);
        for (const item of feed.items) {
          if (!item.title || !item.link) continue;
          articles.push({ title: item.title, url: item.link, publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(), source: item.creator || feed.title || 'Unknown' });
        }
      } catch (err) { console.warn(`  ⚠️ RSS失败 [${def.label}]: ${err instanceof Error ? err.message : err}`); }
    }
    const seen = new Set<string>();
    return articles.filter(a => { const k = a.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  private async selectTopArticles(domain: NewsDomain, articles: RssArticle[]): Promise<SelectedArticle[]> {
    if (!articles.length) return [];
    const def = DOMAINS[domain];
    const list = articles.slice(0, 30).map((a, i) => `${i + 1}. ${a.title}`).join('\n');
    const sys = `你是新闻编辑。选出最重要的${CANDIDATES_PER_DOMAIN}条，并生成百度搜索中文关键词。\n严格领域过滤：当前领域"${def.label}"(${def.description})。只选严格属于该领域的新闻。比亚迪属于汽车不属于国际政治，美联储属于金融不属于国际政治。`;
    const usr = `候选:\n${list}\n\n返回严格JSON数组，无其他文字:\n[{"index":1,"zhQuery":"中文搜索词"}]`;
    try {
      const raw = await callLLM(sys, usr);
      const parsed = JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) as Array<{ index: number; zhQuery: string }>;
      return parsed.filter(p => p.index >= 1 && p.index <= articles.length).map(p => ({ ...articles[p.index - 1], zhQuery: p.zhQuery }));
    } catch (err) {
      console.warn(`  ⚠️ LLM选择失败 [${def.label}]: ${err instanceof Error ? err.message : err}`);
      return articles.slice(0, CANDIDATES_PER_DOMAIN).map(a => ({ ...a, zhQuery: a.title }));
    }
  }

  private async extractArticle(url: string): Promise<string> {
    try {
      console.log(`      📎 URL: ${url.slice(0, 100)}`);
      const article = await extract(url, { headers: { 'User-Agent': UA } } as any);
      if (!article || !article.content) {
        console.warn(`      ⚠️ article-extractor返回空 (title=${article?.title || 'null'})`);
        return '';
      }
      const text = stripHtml(article.content);
      console.log(`      📄 提取到 ${text.length} 字`);
      return text;
    } catch (err) {
      console.warn(`      ❌ 提取异常: ${err instanceof Error ? err.message : err}`);
      return '';
    }
  }

  private async searchBaiduNews(query: string): Promise<Array<{ title: string; url: string }>> {
    const results: Array<{ title: string; url: string }> = [];
    try {
      const searchUrl = `https://news.baidu.com/ns?word=${encodeURIComponent(query)}&tn=news&from=news&cl=2&rn=10`;
      const resp = await fetch(searchUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      const html = await resp.text();
      let match;
      const r1 = /<h3[^>]*class="news-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      while ((match = r1.exec(html)) !== null) { const u = match[1], t = stripHtml(match[2]); if (u && t) results.push({ title: t, url: u }); }
      if (!results.length) {
        const r2 = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*data-click[^>]*>([\s\S]*?)<\/a>/gi;
        while ((match = r2.exec(html)) !== null) { const u = match[1], t = stripHtml(match[2]); if (u && t && t.length > 5 && !u.includes('baidu.com')) results.push({ title: t, url: u }); }
      }
      if (!results.length) {
        const resp2 = await fetch(`https://www.baidu.com/s?wd=${encodeURIComponent(query + ' 新闻')}&rn=10`, { headers: { 'User-Agent': UA }, redirect: 'follow' });
        const html2 = await resp2.text();
        const r3 = /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*data-click[^>]*>([\s\S]*?)<\/a>/gi;
        while ((match = r3.exec(html2)) !== null) { const u = match[1], t = stripHtml(match[2]); if (u && t && t.length > 5 && !u.includes('baidu.com')) results.push({ title: t, url: u }); }
      }
    } catch (err) { console.warn(`  ⚠️ 百度搜索失败: ${query} - ${err instanceof Error ? err.message : err}`); }
    return results.slice(0, 10);
  }

  private async pickBestMatch(candidates: Array<{ title: string; url: string }>, enTitle: string, zhQuery: string): Promise<{ title: string; url: string } | null> {
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    const list = candidates.map((c, i) => `${i + 1}. ${c.title}`).join('\n');
    try {
      const raw = await callLLM('你是新闻匹配专家。从中文新闻列表中选出与英文新闻报道同一事件的那条。只返回序号数字。如果没有匹配返回0。', `英文标题: ${enTitle}\n搜索词: ${zhQuery}\n\n中文候选:\n${list}`);
      const idx = parseInt(raw.replace(/\D/g, ''), 10);
      if (idx >= 1 && idx <= candidates.length) return candidates[idx - 1];
    } catch {}
    return candidates[0];
  }

  async matchArticles(): Promise<NewsItem[]> {
    const allItems: NewsItem[] = [];
    for (const domain of Object.keys(DOMAINS) as NewsDomain[]) {
      const def = DOMAINS[domain];
      console.log(`\n📂 [${def.label}] 开始处理...`);
      console.log(`  📡 抓取RSS...`);
      const rssArticles = await this.fetchRssArticles(domain);
      console.log(`  📋 RSS获取 ${rssArticles.length} 篇候选`);
      if (!rssArticles.length) continue;
      console.log(`  🤖 LLM筛选最重要的${CANDIDATES_PER_DOMAIN}条...`);
      const selected = await this.selectTopArticles(domain, rssArticles);
      console.log(`  ✅ 选出 ${selected.length} 条`);
      let paired = 0;
      for (const article of selected) {
        if (paired >= FINAL_PER_DOMAIN) break;
        console.log(`  📰 处理: ${article.title.slice(0, 60)}...`);
        console.log(`    🔍 提取英文正文...`);
        const enContent = await this.extractArticle(article.url);
        if (!enContent || enContent.length < 100) { console.log(`    ⚠️ 英文正文太短(${enContent.length}字)，跳过`); continue; }
        console.log(`    ✅ 英文正文 ${enContent.length} 字`);
        console.log(`    🔍 搜索百度: "${article.zhQuery}"`);
        const baiduResults = await this.searchBaiduNews(article.zhQuery);
        if (!baiduResults.length) { console.log(`    ⚠️ 百度无结果，跳过`); continue; }
        console.log(`    📋 百度返回 ${baiduResults.length} 条`);
        const bestMatch = await this.pickBestMatch(baiduResults, article.title, article.zhQuery);
        if (!bestMatch) { console.log(`    ⚠️ 无匹配，跳过`); continue; }
        console.log(`    🎯 匹配: ${bestMatch.title.slice(0, 40)}...`);
        console.log(`    🔍 提取中文正文...`);
        const zhContent = await this.extractArticle(bestMatch.url);
        if (!zhContent || zhContent.length < 50) { console.log(`    ⚠️ 中文正文太短(${zhContent.length}字)，跳过`); continue; }
        console.log(`    ✅ 中文正文 ${zhContent.length} 字`);
        const now = new Date().toISOString();
        allItems.push({
          id: randomUUID(), topicSummary: article.title, domain, secondaryDomains: [],
          englishArticle: { articleId: randomUUID(), sourceId: 'rss-feed', sourceName: article.source, title: article.title, summary: enContent.slice(0, 200), content: enContent, url: article.url, publishedAt: article.publishedAt },
          chineseArticle: { articleId: randomUUID(), sourceId: 'baidu-news', sourceName: '百度新闻', title: bestMatch.title, summary: zhContent.slice(0, 200), content: zhContent, url: bestMatch.url, publishedAt: now },
          pairingStatus: 'paired', importanceScore: 0, rank: 0, createdAt: now,
        });
        paired++;
        console.log(`    ✅ 配对成功 (${paired}/${FINAL_PER_DOMAIN})`);
      }
      console.log(`  📊 [${def.label}] 完成: ${paired} 条双语新闻`);
    }
    console.log(`\n📊 总计: ${allItems.length} 条双语新闻`);
    return allItems;
  }
}
