import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || './data/alerts.db',
  serverChan: {
    uid: process.env.SERVERCHAN_UID || '',
    sendKey: process.env.SERVERCHAN_SENDKEY || '',
  },
  binance: {
    wsUrl: 'wss://fstream.binance.com/ws',
    defaultSymbol: 'btcusdt',
  },
  priceCache: {
    maxAgeMinutes: 10,
  },
  notification: {
    maxPerMinute: 5,
  },
  // AI 摘要配置
  anthropic: {
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    apiKey: process.env.ANTHROPIC_AUTH_TOKEN || '',
  },
  // 资讯聚合配置
  news: {
    enabled: process.env.NEWS_ENABLED !== 'false',
    morningCron: process.env.NEWS_MORNING_CRON || '0 8 * * *',
    eveningCron: process.env.NEWS_EVENING_CRON || '0 22 * * *',
    weeklyCron: process.env.NEWS_WEEKLY_CRON || '0 9 * * 1',
    collectInterval: parseInt(process.env.NEWS_COLLECT_INTERVAL || '30', 10),
    breakingCheckInterval: parseInt(process.env.NEWS_BREAKING_CHECK_INTERVAL || '5', 10),
    whaleAlertApiKey: process.env.WHALE_ALERT_API_KEY || '',
    cryptoCompareApiKey: process.env.CRYPTOCOMPARE_API_KEY || '',
  },
};
