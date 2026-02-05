import initSqlJs, { Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

let db: Database;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs();

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(config.dbPath)) {
    const buffer = fs.readFileSync(config.dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL DEFAULT 'BTCUSDT',
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      threshold REAL,
      volatility_window INTEGER,
      volatility_percent REAL,
      cooldown_minutes INTEGER NOT NULL DEFAULT 5,
      is_one_time INTEGER NOT NULL DEFAULT 0,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      start_price REAL,
      end_price REAL,
      upper_price REAL,
      lower_price REAL,
      range_mode TEXT,
      confirm_percent REAL,
      with_volume INTEGER,
      alert_distance REAL
    )
  `);

  // Add new columns for existing databases (migrations)
  const columns = ['start_price', 'end_price', 'upper_price', 'lower_price', 'range_mode', 'confirm_percent', 'with_volume', 'alert_distance'];
  for (const col of columns) {
    try {
      db.run(`ALTER TABLE alert_rules ADD COLUMN ${col} ${col === 'range_mode' ? 'TEXT' : col === 'with_volume' ? 'INTEGER' : 'REAL'}`);
    } catch (e) {
      // Column already exists
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS alert_history (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      type TEXT NOT NULL,
      current_price REAL NOT NULL,
      message TEXT NOT NULL,
      triggered_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_alert_rules_status ON alert_rules(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_alert_history_triggered_at ON alert_history(triggered_at)`);

  saveDatabase();
  console.log('[DB] Database initialized');

  return db;
}

export function getDb(): Database {
  return db;
}

export function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.dbPath, buffer);
  }
}

// Auto-save every 30 seconds
setInterval(() => {
  saveDatabase();
}, 30000);

export interface AlertRule {
  id: string;
  name: string;
  symbol: string;
  type: 'threshold_above' | 'threshold_below' | 'volatility' | 'fibonacci' | 'range';
  status: 'active' | 'paused';
  threshold: number | null;
  volatility_window: number | null;
  volatility_percent: number | null;
  cooldown_minutes: number;
  is_one_time: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
  // Fibonacci fields
  start_price: number | null;
  end_price: number | null;
  // Range fields
  upper_price: number | null;
  lower_price: number | null;
  range_mode: 'touch' | 'breakout' | null;
  confirm_percent: number | null;
  // Volume option
  with_volume: number | null;
  // Alert distance (percentage to trigger early warning)
  alert_distance: number | null;
}

export interface AlertHistory {
  id: string;
  rule_id: string;
  rule_name: string;
  symbol: string;
  type: string;
  current_price: number;
  message: string;
  triggered_at: string;
}
