import { config } from '../../config';
import {
  collectMarketData,
  collectOnchainData,
  collectNewsFeed,
  collectSentiment,
  AllDataSnapshot,
} from './collectors';
import { summarize } from './ai-summarizer';
import {
  buildMorningPrompt,
  buildEveningPrompt,
  buildBreakingPrompt,
  buildWeeklyPrompt,
  ReportType,
} from './templates';
import { schedule, stopAll } from './scheduler';
import { notificationService } from '../notification';
import {
  newsCacheRepository,
  pushHistoryRepository,
  marketSnapshotRepository,
} from '../../db/repository';

async function collectAllData(): Promise<AllDataSnapshot> {
  const [market, onchain, news, sentiment] = await Promise.all([
    collectMarketData(),
    collectOnchainData(),
    collectNewsFeed(),
    collectSentiment(),
  ]);

  // 保存市场快照
  marketSnapshotRepository.create({
    snapshot_type: 'hourly',
    data: JSON.stringify(market),
  });

  // 缓存新闻
  for (const article of news.articles) {
    if (!newsCacheRepository.existsByTitle(article.title)) {
      newsCacheRepository.create({
        source: 'cryptocompare',
        category: 'news',
        title: article.title,
        content: article.body,
        url: article.url,
        importance: 3,
        published_at: new Date(article.publishedAt).toISOString(),
      });
    }
  }

  return {
    market,
    onchain,
    news,
    sentiment,
    collectedAt: new Date().toISOString(),
  };
}

export async function generateReport(type: ReportType): Promise<string> {
  console.log(`[NewsAggregator] Generating ${type} report...`);

  const data = await collectAllData();
  let prompt: string;

  switch (type) {
    case 'morning':
      prompt = buildMorningPrompt(data);
      break;
    case 'evening':
      prompt = buildEveningPrompt(data);
      break;
    case 'weekly': {
      const snapshots = marketSnapshotRepository.findRecent('hourly', 168);
      prompt = buildWeeklyPrompt(data, snapshots.map(s => JSON.parse(s.data)));
      break;
    }
    default:
      prompt = buildMorningPrompt(data);
  }

  const result = await summarize(prompt, type);
  return result.content;
}

async function pushReport(type: ReportType): Promise<void> {
  try {
    const content = await generateReport(type);

    const titleMap: Record<ReportType, string> = {
      morning: '📰 加密货币早报',
      evening: '🌙 加密货币晚报',
      breaking: '⚡ 快讯',
      weekly: '📊 加密货币周报',
    };

    await notificationService.send(titleMap[type], content);

    pushHistoryRepository.create({
      type,
      content,
      ai_model: type === 'weekly' ? 'claude-sonnet' : 'claude-haiku',
      data_sources: JSON.stringify(['binance', 'cryptocompare', 'alternative.me', 'coingecko', 'mempool.space']),
      status: 'success',
    });

    console.log(`[NewsAggregator] ${type} report pushed`);
  } catch (e: any) {
    console.error(`[NewsAggregator] Failed to push ${type}:`, e.message);
    pushHistoryRepository.create({
      type,
      content: e.message,
      ai_model: 'none',
      data_sources: '[]',
      status: 'failed',
    });
  }
}

async function checkBreakingNews(): Promise<void> {
  try {
    const news = await collectNewsFeed();
    for (const article of news.articles.slice(0, 5)) {
      if (newsCacheRepository.existsByTitle(article.title)) continue;

      newsCacheRepository.create({
        source: 'cryptocompare',
        category: 'breaking',
        title: article.title,
        content: article.body,
        url: article.url,
        importance: 4,
        published_at: new Date(article.publishedAt).toISOString(),
      });

      // 检查是否为重要新闻（简单关键词匹配）
      const keywords = ['hack', 'SEC', 'ETF', 'ban', 'crash', 'surge', 'regulation', 'Fed'];
      const isImportant = keywords.some(k =>
        article.title.toLowerCase().includes(k.toLowerCase())
      );

      if (isImportant) {
        const prompt = buildBreakingPrompt(article.title, article.body);
        const result = await summarize(prompt, 'breaking');
        await notificationService.send('⚡ 快讯', result.content);
      }
    }
  } catch (e: any) {
    console.error('[NewsAggregator] Breaking news check failed:', e.message);
  }
}

export function startAggregator(): void {
  if (!config.news.enabled) {
    console.log('[NewsAggregator] Disabled by config');
    return;
  }

  console.log('[NewsAggregator] Starting...');

  // 早报
  schedule('morning-report', config.news.morningCron, () => {
    pushReport('morning');
  });

  // 晚报
  schedule('evening-report', config.news.eveningCron, () => {
    pushReport('evening');
  });

  // 周报
  schedule('weekly-report', config.news.weeklyCron, () => {
    pushReport('weekly');
  });

  // 定时数据采集
  const collectCron = `*/${config.news.collectInterval} * * * *`;
  schedule('data-collect', collectCron, () => {
    collectAllData().catch(e =>
      console.error('[NewsAggregator] Data collection failed:', e.message)
    );
  });

  // 快讯检测
  const breakingCron = `*/${config.news.breakingCheckInterval} * * * *`;
  schedule('breaking-check', breakingCron, () => {
    checkBreakingNews();
  });

  console.log('[NewsAggregator] All tasks scheduled');
}

export function stopAggregator(): void {
  stopAll();
  console.log('[NewsAggregator] Stopped');
}
