// 测试各个RSS源和新闻网站从当前网络的可达性
const sources = [
  // 中文RSS源（国内肯定能访问）
  { name: '36氪', url: 'https://36kr.com/feed', type: 'rss' },
  { name: '澎湃新闻', url: 'https://www.thepaper.cn/', type: 'web' },
  { name: '新浪科技', url: 'https://feed.mix.sina.com.cn/api/v3/feed/jsonp_callback/key_cate_tech', type: 'api' },
  { name: '虎嗅', url: 'https://www.huxiu.com/', type: 'web' },
  // 英文RSS源（可能被墙）
  { name: 'TechCrunch', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', type: 'rss' },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', type: 'rss' },
  { name: 'Reuters', url: 'https://www.reuters.com/', type: 'web' },
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', type: 'rss' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', type: 'rss' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', type: 'rss' },
  { name: 'Electrek', url: 'https://electrek.co/feed/', type: 'rss' },
  { name: 'NYT', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', type: 'rss' },
  { name: 'Guardian', url: 'https://www.theguardian.com/world/rss', type: 'rss' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', type: 'rss' },
  // API类
  { name: 'Hacker News API', url: 'https://hacker-news.firebaseio.com/v0/topstories.json', type: 'api' },
  { name: 'Reddit JSON', url: 'https://www.reddit.com/r/technology/top.json?limit=5&t=day', type: 'api' },
  // 百度新闻搜索
  { name: '百度新闻', url: 'https://news.baidu.com/ns?word=AI&tn=news&from=news&cl=2&rn=5', type: 'web' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function testSource(s) {
  const start = Date.now();
  try {
    const resp = await fetch(s.url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000),
      redirect: 'follow',
    });
    const elapsed = Date.now() - start;
    const body = await resp.text();
    const preview = body.slice(0, 200).replace(/\n/g, ' ');
    console.log(`✅ ${s.name.padEnd(18)} ${resp.status} ${elapsed}ms ${body.length}字 | ${preview.slice(0, 80)}...`);
    return true;
  } catch (err) {
    const elapsed = Date.now() - start;
    console.log(`❌ ${s.name.padEnd(18)} ${elapsed}ms | ${err.message}`);
    return false;
  }
}

console.log('🔍 测试各新闻源可达性...\n');
let ok = 0, fail = 0;
for (const s of sources) {
  const result = await testSource(s);
  if (result) ok++; else fail++;
}
console.log(`\n📊 结果: ${ok} 可达, ${fail} 不可达`);
