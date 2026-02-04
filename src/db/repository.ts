import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDatabase, AlertRule, AlertHistory } from './index';

export const ruleRepository = {
  findAll(): AlertRule[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM alert_rules ORDER BY created_at DESC');
    const results: AlertRule[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as AlertRule);
    }
    stmt.free();
    return results;
  },

  findActive(): AlertRule[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM alert_rules WHERE status = ?');
    stmt.bind(['active']);
    const results: AlertRule[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as AlertRule);
    }
    stmt.free();
    return results;
  },

  findById(id: string): AlertRule | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM alert_rules WHERE id = ?');
    stmt.bind([id]);
    let result: AlertRule | undefined;
    if (stmt.step()) {
      result = stmt.getAsObject() as unknown as AlertRule;
    }
    stmt.free();
    return result;
  },

  create(rule: Omit<AlertRule, 'id' | 'created_at' | 'updated_at' | 'last_triggered_at'>): AlertRule {
    const db = getDb();
    const id = uuidv4();
    db.run(`
      INSERT INTO alert_rules (id, name, symbol, type, status, threshold, volatility_window, volatility_percent, cooldown_minutes, is_one_time, start_price, end_price, upper_price, lower_price, range_mode, confirm_percent, with_volume)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, rule.name, rule.symbol, rule.type, rule.status, rule.threshold, rule.volatility_window, rule.volatility_percent, rule.cooldown_minutes, rule.is_one_time, rule.start_price || null, rule.end_price || null, rule.upper_price || null, rule.lower_price || null, rule.range_mode || null, rule.confirm_percent || null, rule.with_volume || null]);
    saveDatabase();
    return this.findById(id)!;
  },

  update(id: string, updates: Partial<AlertRule>): AlertRule | undefined {
    const rule = this.findById(id);
    if (!rule) return undefined;

    const db = getDb();
    const fields: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'created_at') {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length > 0) {
      fields.push("updated_at = datetime('now')");
      values.push(id);
      db.run(`UPDATE alert_rules SET ${fields.join(', ')} WHERE id = ?`, values);
      saveDatabase();
    }

    return this.findById(id);
  },

  updateLastTriggered(id: string): void {
    const db = getDb();
    db.run("UPDATE alert_rules SET last_triggered_at = datetime('now'), updated_at = datetime('now') WHERE id = ?", [id]);
    saveDatabase();
  },

  delete(id: string): boolean {
    const db = getDb();
    const before = db.getRowsModified();
    db.run('DELETE FROM alert_rules WHERE id = ?', [id]);
    const after = db.getRowsModified();
    saveDatabase();
    return after > before;
  },
};

export const historyRepository = {
  findAll(limit = 100): AlertHistory[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM alert_history ORDER BY triggered_at DESC LIMIT ?');
    stmt.bind([limit]);
    const results: AlertHistory[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as AlertHistory);
    }
    stmt.free();
    return results;
  },

  findByRuleId(ruleId: string, limit = 50): AlertHistory[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM alert_history WHERE rule_id = ? ORDER BY triggered_at DESC LIMIT ?');
    stmt.bind([ruleId, limit]);
    const results: AlertHistory[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject() as unknown as AlertHistory);
    }
    stmt.free();
    return results;
  },

  create(history: Omit<AlertHistory, 'id' | 'triggered_at'>): AlertHistory {
    const db = getDb();
    const id = uuidv4();
    db.run(`
      INSERT INTO alert_history (id, rule_id, rule_name, symbol, type, current_price, message)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, history.rule_id, history.rule_name, history.symbol, history.type, history.current_price, history.message]);
    saveDatabase();

    const stmt = db.prepare('SELECT * FROM alert_history WHERE id = ?');
    stmt.bind([id]);
    let result: AlertHistory | undefined;
    if (stmt.step()) {
      result = stmt.getAsObject() as unknown as AlertHistory;
    }
    stmt.free();
    return result!;
  },

  deleteOlderThan(days: number): number {
    const db = getDb();
    const before = db.getRowsModified();
    db.run("DELETE FROM alert_history WHERE triggered_at < datetime('now', ?)", [`-${days} days`]);
    const after = db.getRowsModified();
    saveDatabase();
    return after - before;
  },
};
