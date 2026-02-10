import axios from 'axios';

const BINANCE_FAPI = 'https://fapi.binance.com';

export interface FundingRateData {
  symbol: string;
  fundingRate: number;
  fundingTime: number;
}

export interface LongShortRatio {
  symbol: string;
  longShortRatio: number;
  longAccount: number;
  shortAccount: number;
  timestamp: number;
}

export interface ForceOrder {
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  time: number;
}

export interface OpenInterestData {
  symbol: string;
  openInterest: number;
  time: number;
}

export interface Ticker24h {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

export interface MarketDataSnapshot {
  fundingRates: FundingRateData[];
  longShortRatios: LongShortRatio[];
  forceOrders: ForceOrder[];
  openInterest: OpenInterestData[];
  tickers: Ticker24h[];
  collectedAt: string;
}

const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];

async function getFundingRates(): Promise<FundingRateData[]> {
  const results: FundingRateData[] = [];
  for (const symbol of SYMBOLS) {
    try {
      const { data } = await axios.get(`${BINANCE_FAPI}/fapi/v1/fundingRate`, {
        params: { symbol, limit: 1 },
      });
      if (data.length > 0) {
        results.push({
          symbol,
          fundingRate: parseFloat(data[0].fundingRate),
          fundingTime: data[0].fundingTime,
        });
      }
    } catch (e: any) {
      console.error(`[MarketData] getFundingRates ${symbol}:`, e.message);
    }
  }
  return results;
}

async function getLongShortRatios(): Promise<LongShortRatio[]> {
  const results: LongShortRatio[] = [];
  for (const symbol of SYMBOLS) {
    try {
      const { data } = await axios.get(`${BINANCE_FAPI}/futures/data/topLongShortAccountRatio`, {
        params: { symbol, period: '4h', limit: 1 },
      });
      if (data.length > 0) {
        results.push({
          symbol,
          longShortRatio: parseFloat(data[0].longShortRatio),
          longAccount: parseFloat(data[0].longAccount),
          shortAccount: parseFloat(data[0].shortAccount),
          timestamp: data[0].timestamp,
        });
      }
    } catch (e: any) {
      console.error(`[MarketData] getLongShortRatios ${symbol}:`, e.message);
    }
  }
  return results;
}

async function getForceOrders(): Promise<ForceOrder[]> {
  try {
    const { data } = await axios.get(`${BINANCE_FAPI}/fapi/v1/allForceOrders`, {
      params: { limit: 20 },
    });
    return data.map((o: any) => ({
      symbol: o.symbol,
      side: o.side,
      price: parseFloat(o.price),
      quantity: parseFloat(o.origQty),
      time: o.time,
    }));
  } catch (e: any) {
    console.error('[MarketData] getForceOrders:', e.message);
    return [];
  }
}

async function getOpenInterest(): Promise<OpenInterestData[]> {
  const results: OpenInterestData[] = [];
  for (const symbol of SYMBOLS) {
    try {
      const { data } = await axios.get(`${BINANCE_FAPI}/fapi/v1/openInterest`, {
        params: { symbol },
      });
      results.push({
        symbol,
        openInterest: parseFloat(data.openInterest),
        time: Date.now(),
      });
    } catch (e: any) {
      console.error(`[MarketData] getOpenInterest ${symbol}:`, e.message);
    }
  }
  return results;
}

async function get24hTickers(): Promise<Ticker24h[]> {
  const results: Ticker24h[] = [];
  for (const symbol of SYMBOLS) {
    try {
      const { data } = await axios.get(`${BINANCE_FAPI}/fapi/v1/ticker/24hr`, {
        params: { symbol },
      });
      results.push({
        symbol: data.symbol,
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        lastPrice: parseFloat(data.lastPrice),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
      });
    } catch (e: any) {
      console.error(`[MarketData] get24hTickers ${symbol}:`, e.message);
    }
  }
  return results;
}

export async function collectMarketData(): Promise<MarketDataSnapshot> {
  console.log('[MarketData] Collecting market data...');
  const [fundingRates, longShortRatios, forceOrders, openInterest, tickers] = await Promise.all([
    getFundingRates(),
    getLongShortRatios(),
    getForceOrders(),
    getOpenInterest(),
    get24hTickers(),
  ]);

  const snapshot: MarketDataSnapshot = {
    fundingRates,
    longShortRatios,
    forceOrders,
    openInterest,
    tickers,
    collectedAt: new Date().toISOString(),
  };

  console.log('[MarketData] Collection complete');
  return snapshot;
}
