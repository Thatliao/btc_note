import axios from 'axios';

export interface FearGreedIndex {
  value: number;
  classification: string;
  timestamp: number;
}

export interface GlobalMarketData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
}

export interface SentimentSnapshot {
  fearGreed: FearGreedIndex | null;
  globalMarket: GlobalMarketData | null;
  collectedAt: string;
}

async function getFearGreedIndex(): Promise<FearGreedIndex | null> {
  try {
    const { data } = await axios.get('https://api.alternative.me/fng/?limit=1');
    if (data.data?.length > 0) {
      const item = data.data[0];
      return {
        value: parseInt(item.value),
        classification: item.value_classification,
        timestamp: parseInt(item.timestamp) * 1000,
      };
    }
    return null;
  } catch (e: any) {
    console.error('[Sentiment] getFearGreedIndex:', e.message);
    return null;
  }
}

async function getGlobalMarketData(): Promise<GlobalMarketData | null> {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/global');
    const d = data.data;
    return {
      totalMarketCap: d.total_market_cap?.usd || 0,
      totalVolume24h: d.total_volume?.usd || 0,
      btcDominance: d.market_cap_percentage?.btc || 0,
      ethDominance: d.market_cap_percentage?.eth || 0,
      activeCryptocurrencies: d.active_cryptocurrencies || 0,
    };
  } catch (e: any) {
    console.error('[Sentiment] getGlobalMarketData:', e.message);
    return null;
  }
}

export async function collectSentiment(): Promise<SentimentSnapshot> {
  console.log('[Sentiment] Collecting sentiment data...');
  const [fearGreed, globalMarket] = await Promise.all([
    getFearGreedIndex(),
    getGlobalMarketData(),
  ]);

  console.log('[Sentiment] Collection complete');
  return {
    fearGreed,
    globalMarket,
    collectedAt: new Date().toISOString(),
  };
}
