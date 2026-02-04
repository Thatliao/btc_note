import express from 'express';
import path from 'path';
import { config } from './config';
import { initDatabase, saveDatabase } from './db';
import { setupApi } from './api';
import { priceMonitor } from './core/price-monitor';
import { ruleEngine } from './core/rule-engine';

async function main() {
  const app = express();

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Initialize database
  await initDatabase();

  // Setup API routes
  setupApi(app);

  // Start price monitor
  priceMonitor.start();

  // Start rule engine
  ruleEngine.start();

  // Start server
  app.listen(config.port, () => {
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
