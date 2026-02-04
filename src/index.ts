import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer } from 'ws';
import { config } from './config';
import { initDatabase, saveDatabase } from './db';
import { setupApi } from './api';
import { priceMonitor } from './core/price-monitor';
import { ruleEngine } from './core/rule-engine';
import { addClient, removeClient, broadcast } from './core/websocket';

async function main() {
  const app = express();
  const server = http.createServer(app);

  // Setup WebSocket server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    addClient(ws);

    // Send current price immediately
    const price = priceMonitor.getCurrentPrice('btcusdt');
    if (price) {
      ws.send(JSON.stringify({ type: 'price', price }));
    }

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      removeClient(ws);
    });

    ws.on('error', (err) => {
      console.error('[WS] Client error:', err.message);
      removeClient(ws);
    });
  });

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Initialize database
  await initDatabase();

  // Setup API routes
  setupApi(app);

  // Start price monitor
  priceMonitor.start();

  // Forward price updates to clients
  priceMonitor.on('price', (data) => {
    broadcast({ type: 'price', price: data.price, symbol: data.symbol });
  });

  // Start rule engine
  ruleEngine.start();

  // Start server
  server.listen(config.port, () => {
    console.log(`[Server] Running on http://localhost:${config.port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    priceMonitor.stop();
    ruleEngine.stop();
    saveDatabase();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
