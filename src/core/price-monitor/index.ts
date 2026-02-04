import WebSocket from 'ws';
import axios from 'axios';
import { config } from '../../config';
import { EventEmitter } from 'events';

interface PricePoint {
  price: number;
  timestamp: number;
}

export interface PriceData {
  symbol: string;
  price: number;
  timestamp: number;
}

class PriceMonitor extends EventEmitter {
  private ws: WebSocket | null = null;
  private priceCache: Map<string, PricePoint[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private symbols: Set<string> = new Set(['btcusdt']);
  private currentPrices: Map<string, number> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private usePolling = false;

  constructor() {
    super();
  }

  start() {
    this.connect();
  }

  private connect() {
    const streams = Array.from(this.symbols).map(s => `${s}@aggTrade`).join('/');
    const url = `wss://fstream.binance.com/stream?streams=${streams}`;

    console.log(`[WS] Connecting to Binance...`);

    try {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[WS] Connected to Binance');
        this.reconnectAttempts = 0;
        this.usePolling = false;
        this.stopPolling();
        this.emit('connected');
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          // Combined stream format wraps data in { stream, data }
          const tradeData = msg.data || msg;
          this.handleTrade(tradeData);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      });

      this.ws.on('close', () => {
        console.log('[WS] Connection closed');
        this.emit('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[WS] Error:', err.message);
      });
    } catch (err: any) {
      console.error('[WS] Connection failed:', err.message);
      this.scheduleReconnect();
    }
  }

  private handleTrade(msg: any) {
    const symbol = msg.s?.toLowerCase() || 'btcusdt';
    const price = parseFloat(msg.p);
    const timestamp = msg.T || Date.now();

    if (isNaN(price)) return;

    this.updatePrice(symbol, price, timestamp);
  }

  private updatePrice(symbol: string, price: number, timestamp: number) {
    this.currentPrices.set(symbol, price);

    // Update price cache
    if (!this.priceCache.has(symbol)) {
      this.priceCache.set(symbol, []);
    }
    const cache = this.priceCache.get(symbol)!;
    cache.push({ price, timestamp });

    // Clean old entries (keep last 10 minutes)
    const cutoff = Date.now() - config.priceCache.maxAgeMinutes * 60 * 1000;
    while (cache.length > 0 && cache[0].timestamp < cutoff) {
      cache.shift();
    }

    const priceData: PriceData = { symbol: symbol.toUpperCase(), price, timestamp };
    this.emit('price', priceData);
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached, switching to REST API polling');
      this.usePolling = true;
      this.startPolling();
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  private startPolling() {
    if (this.pollingInterval) return;

    console.log('[Polling] Starting REST API polling (every 2s)');
    this.pollPrice();
    this.pollingInterval = setInterval(() => this.pollPrice(), 2000);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private async pollPrice() {
    try {
      const response = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price', {
        params: { symbol: 'BTCUSDT' },
        timeout: 5000,
      });

      const price = parseFloat(response.data.price);
      if (!isNaN(price)) {
        this.updatePrice('btcusdt', price, Date.now());
      }
    } catch (err: any) {
      console.error('[Polling] Error:', err.message);
    }
  }

  getCurrentPrice(symbol: string): number | undefined {
    return this.currentPrices.get(symbol.toLowerCase());
  }

  getPriceHistory(symbol: string, windowMinutes: number): PricePoint[] {
    const cache = this.priceCache.get(symbol.toLowerCase()) || [];
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return cache.filter(p => p.timestamp >= cutoff);
  }

  addSymbol(symbol: string) {
    const s = symbol.toLowerCase();
    if (!this.symbols.has(s)) {
      this.symbols.add(s);
      if (!this.usePolling) {
        this.reconnect();
      }
    }
  }

  private reconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }

  stop() {
    this.stopPolling();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const priceMonitor = new PriceMonitor();
