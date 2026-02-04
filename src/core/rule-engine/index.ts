import { AlertRule } from '../../db';
import { ruleRepository, historyRepository } from '../../db/repository';
import { priceMonitor, PriceData } from '../price-monitor';
import { notificationService } from '../notification';

class RuleEngine {
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    priceMonitor.on('price', (data: PriceData) => {
      this.evaluateRules(data);
    });
    console.log('[RuleEngine] Started');
  }

  private evaluateRules(priceData: PriceData) {
    const rules = ruleRepository.findActive();

    for (const rule of rules) {
      if (rule.symbol.toUpperCase() !== priceData.symbol.toUpperCase()) continue;
      if (this.isInCooldown(rule)) continue;

      let triggered = false;
      let message = '';

      switch (rule.type) {
        case 'threshold_above':
          if (rule.threshold && priceData.price >= rule.threshold) {
            triggered = true;
            message = `📈 ${rule.symbol} 价格突破 ${rule.threshold}\n当前价格: ${priceData.price.toFixed(2)}`;
          }
          break;

        case 'threshold_below':
          if (rule.threshold && priceData.price <= rule.threshold) {
            triggered = true;
            message = `📉 ${rule.symbol} 价格跌破 ${rule.threshold}\n当前价格: ${priceData.price.toFixed(2)}`;
          }
          break;

        case 'volatility':
          const result = this.checkVolatility(rule, priceData);
          if (result.triggered) {
            triggered = true;
            message = result.message;
          }
          break;
      }

      if (triggered) {
        this.triggerAlert(rule, priceData.price, message);
      }
    }
  }

  private checkVolatility(rule: AlertRule, priceData: PriceData): { triggered: boolean; message: string } {
    if (!rule.volatility_window || !rule.volatility_percent) {
      return { triggered: false, message: '' };
    }

    const history = priceMonitor.getPriceHistory(rule.symbol, rule.volatility_window);
    if (history.length < 2) {
      return { triggered: false, message: '' };
    }

    const oldestPrice = history[0].price;
    const currentPrice = priceData.price;
    const changePercent = ((currentPrice - oldestPrice) / oldestPrice) * 100;

    if (Math.abs(changePercent) >= rule.volatility_percent) {
      const direction = changePercent > 0 ? '上涨' : '下跌';
      const emoji = changePercent > 0 ? '🚀' : '💥';
      return {
        triggered: true,
        message: `${emoji} ${rule.symbol} ${rule.volatility_window}分钟内${direction} ${Math.abs(changePercent).toFixed(2)}%\n` +
                 `起始价格: ${oldestPrice.toFixed(2)}\n当前价格: ${currentPrice.toFixed(2)}`,
      };
    }

    return { triggered: false, message: '' };
  }

  private isInCooldown(rule: AlertRule): boolean {
    if (!rule.last_triggered_at) return false;

    const lastTriggered = new Date(rule.last_triggered_at).getTime();
    const cooldownMs = rule.cooldown_minutes * 60 * 1000;
    return Date.now() - lastTriggered < cooldownMs;
  }

  private async triggerAlert(rule: AlertRule, currentPrice: number, message: string) {
    console.log(`[RuleEngine] Alert triggered: ${rule.name}`);

    // Update last triggered time
    ruleRepository.updateLastTriggered(rule.id);

    // Save to history
    historyRepository.create({
      rule_id: rule.id,
      rule_name: rule.name,
      symbol: rule.symbol,
      type: rule.type,
      current_price: currentPrice,
      message,
    });

    // Send notification
    await notificationService.send(`${rule.name}`, message);

    // Disable one-time rules
    if (rule.is_one_time) {
      ruleRepository.update(rule.id, { status: 'paused' });
      console.log(`[RuleEngine] One-time rule ${rule.name} disabled`);
    }
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}

export const ruleEngine = new RuleEngine();
