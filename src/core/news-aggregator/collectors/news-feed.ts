import axios from 'axios';
import { config } from '../../../config';

export interface NewsItem {
  id: string;
  title: string;
  body: string;
  url: string;
  source: string;
  categories: string;
  publishedAt: number;
}

export interface NewsFeedSnapshot {
  articles: NewsItem[];
  collectedAt: string;
}

export async function collectNewsFeed(): Promise<NewsFeedSnapshot> {
  console.log('[NewsFeed] Collecting news...');
  const articles: NewsItem[] = [];

  try {
    const params: any = { lang: 'EN' };
    if (config.news.cryptoCompareApiKey) {
      params.api_key = config.news.cryptoCompareApiKey;
    }

    const { data } = await axios.get(
      'https://min-api.cryptocompare.com/data/v2/news/',
      { params },
    );

    if (data.Data) {
      for (const item of data.Data.slice(0, 20)) {
        articles.push({
          id: String(item.id),
          title: item.title,
          body: item.body?.slice(0, 500) || '',
          url: item.url,
          source: item.source,
          categories: item.categories,
          publishedAt: item.published_on * 1000,
        });
      }
    }
  } catch (e: any) {
    console.error('[NewsFeed] collectNewsFeed:', e.message);
  }

  console.log(`[NewsFeed] Collected ${articles.length} articles`);
  return {
    articles,
    collectedAt: new Date().toISOString(),
  };
}
