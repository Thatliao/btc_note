import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || './data/alerts.db',
  serverChan: {
    sendKey: process.env.SERVERCHAN_SENDKEY || '',
    apiUrl: 'https://sctapi.ftqq.com',
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
};
