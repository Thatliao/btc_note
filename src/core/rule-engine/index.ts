import { AlertRule } from '../../db';
import { ruleRepository, historyRepository } from '../../db/repository';
import { priceMonitor, PriceData, VolumeInfo } from '../price-monitor';
import { notificationService } from '../notification';
import { broadcast } from '../websocket';

// Track last triggered fibonacci levels and range states per rule
const fibTriggeredLevels: Map<string, Set<number>> = new Map();
const rangeLastState: Map<string, 'inside' | 'above' | 'below'> = new Map();

const FIB_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786];

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
          const volResult = this.checkVolatility(rule, priceData);
          if (volResult.triggered) {
            triggered = true;
            message = volResult.message;
          }
          break;

        case 'fibonacci':
          const fibResult = this.checkFibonacci(rule, priceData);
          if (fibResult.triggered) {
            triggered = true;
            message = fibResult.message;
          }
          break;

        case 'range':
          const rangeResult = this.checkRange(rule, priceData);
          if (rangeResult.triggered) {
            triggered = true;
            message = rangeResult.message;
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

    const analysis = priceMonitor.getVolatilityAnalysis(rule.symbol, rule.volatility_window);
    if (!analysis || analysis.klineCount < 2) {
      return { triggered: false, message: '' };
    }

    if (Math.abs(analysis.changePercent) >= rule.volatility_percent) {
      const direction = analysis.direction === 'up' ? '上涨' : '下跌';
      const emoji = analysis.direction === 'up' ? '🚀' : '💥';

      // Volume analysis
      let volumeText = '';
      let volumeEmoji = '';
      if (rule.with_volume && analysis.volumeInfo) {
        const vol = analysis.volumeInfo;
        volumeText = `\n成交量: ${vol.label} (${vol.ratio.toFixed(1)}倍均量)`;
        volumeText += `\n参考K线: ${vol.klineCount}根`;
        if (vol.label === '放量') {
          volumeEmoji = '🔥 ';
        }
      }

      // Calculate amplitude
      const amplitude = ((analysis.highPrice - analysis.lowPrice) / analysis.lowPrice * 100).toFixed(2);

      const message = `${volumeEmoji}${emoji} BTC ${rule.volatility_window}分钟内${direction} ${Math.abs(analysis.changePercent).toFixed(2)}%
━━━━━━━━━━━━━━━━
起始价格: ${analysis.startPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
当前价格: ${analysis.endPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
最高价格: ${analysis.highPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
最低价格: ${analysis.lowPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
振幅: ${amplitude}%
速度: ${analysis.speed.toFixed(2)}%/分钟
K线数量: ${analysis.klineCount}根${volumeText}`;

      return { triggered: true, message };
    }

    return { triggered: false, message: '' };
  }

  private checkFibonacci(rule: AlertRule, priceData: PriceData): { triggered: boolean; message: string } {
    if (!rule.start_price || !rule.end_price) {
      return { triggered: false, message: '' };
    }

    const startPrice = rule.start_price;
    const endPrice = rule.end_price;
    const range = endPrice - startPrice;
    const currentPrice = priceData.price;

    // Initialize triggered levels for this rule
    if (!fibTriggeredLevels.has(rule.id)) {
      fibTriggeredLevels.set(rule.id, new Set());
    }
    const triggeredSet = fibTriggeredLevels.get(rule.id)!;

    // Check each fibonacci level
    for (let i = 0; i < FIB_LEVELS.length; i++) {
      const level = FIB_LEVELS[i];
      const levelPrice = endPrice - range * level; // Retracement from end
      const tolerance = Math.abs(range) * 0.005; // 0.5% tolerance (increased from 0.2%)

      // Check if price crossed the level (not just touched)
      const priceDiff = currentPrice - levelPrice;
      const crossedLevel = Math.abs(priceDiff) <= tolerance;

      if (crossedLevel && !triggeredSet.has(level)) {
        triggeredSet.add(level);

        // Find next support and resistance
        const levelPercent = (level * 100).toFixed(1);
        let nextSupport = '';
        let nextResistance = '';

        if (i < FIB_LEVELS.length - 1) {
          const nextLevel = FIB_LEVELS[i + 1];
          const nextLevelPrice = endPrice - range * nextLevel;
          if (range > 0) {
            nextSupport = `${(nextLevel * 100).toFixed(1)}% (${nextLevelPrice.toFixed(0)})`;
          } else {
            nextResistance = `${(nextLevel * 100).toFixed(1)}% (${nextLevelPrice.toFixed(0)})`;
          }
        }
        if (i > 0) {
          const prevLevel = FIB_LEVELS[i - 1];
          const prevLevelPrice = endPrice - range * prevLevel;
          if (range > 0) {
            nextResistance = `${(prevLevel * 100).toFixed(1)}% (${prevLevelPrice.toFixed(0)})`;
          } else {
            nextSupport = `${(prevLevel * 100).toFixed(1)}% (${prevLevelPrice.toFixed(0)})`;
          }
        }

        // Build volume info if enabled
        let volumeText = '';
        if (rule.with_volume) {
          const volInfo = priceMonitor.getVolumeInfo(rule.symbol);
          if (volInfo) {
            volumeText = `\n成交量: ${volInfo.label} (${volInfo.ratio.toFixed(1)}倍)`;
          }
        }

        const message = `📐 BTC 触及斐波那契 ${levelPercent}%
━━━━━━━━━━━━━━━━
当前价格: ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
触及位置: ${levelPercent}% (${levelPrice.toFixed(0)})
波段范围: ${startPrice.toLocaleString()} → ${endPrice.toLocaleString()}${volumeText}
━━━━━━━━━━━━━━━━
${nextSupport ? `下一支撑: ${nextSupport}` : ''}
${nextResistance ? `下一阻力: ${nextResistance}` : ''}`.trim();

        return { triggered: true, message };
      }
    }

    return { triggered: false, message: '' };
  }

  private checkRange(rule: AlertRule, priceData: PriceData): { triggered: boolean; message: string } {
    if (!rule.upper_price || !rule.lower_price) {
      return { triggered: false, message: '' };
    }

    const upperPrice = rule.upper_price;
    const lowerPrice = rule.lower_price;
    const currentPrice = priceData.price;
    const rangeWidth = ((upperPrice - lowerPrice) / lowerPrice * 100).toFixed(1);
    const confirmPercent = rule.confirm_percent || 0.3;
    const mode = rule.range_mode || 'touch';

    // Determine current position
    let currentState: 'inside' | 'above' | 'below' = 'inside';
    if (currentPrice > upperPrice) {
      currentState = 'above';
    } else if (currentPrice < lowerPrice) {
      currentState = 'below';
    }

    // Initialize state for this rule
    if (!rangeLastState.has(rule.id)) {
      rangeLastState.set(rule.id, currentState);
      // Don't return early - allow first check if near boundary
    }

    const lastState = rangeLastState.get(rule.id)!;
    let newState: 'inside' | 'above' | 'below' = 'inside';
    if (currentPrice > upperPrice) {
      newState = 'above';
    } else if (currentPrice < lowerPrice) {
      newState = 'below';
    }

    // Get volume info if enabled
    let volumeInfo: VolumeInfo | null = null;
    let volumeText = '';
    let volumeEmoji = '';
    if (rule.with_volume) {
      volumeInfo = priceMonitor.getVolumeInfo(rule.symbol);
      if (volumeInfo) {
        volumeText = `\n成交量: ${volumeInfo.label} (${volumeInfo.ratio.toFixed(1)}倍)`;
        if (volumeInfo.label === '放量') {
          volumeEmoji = '🔥 ';
        }
      }
    }

    if (mode === 'touch') {
      // Touch mode: trigger when price touches upper or lower from any direction
      const upperTolerance = upperPrice * 0.003; // 0.3% tolerance
      const lowerTolerance = lowerPrice * 0.003;

      // Trigger when approaching upper from inside or crossing from above
      const nearUpper = Math.abs(currentPrice - upperPrice) <= upperTolerance;
      const nearLower = Math.abs(currentPrice - lowerPrice) <= lowerTolerance;

      if (nearUpper && lastState !== 'above') {
        rangeLastState.set(rule.id, currentState);
        const distancePercent = ((upperPrice - currentPrice) / currentPrice * 100).toFixed(2);
        const message = `${volumeEmoji}📊 BTC 触及区间上轨
━━━━━━━━━━━━━━━━
当前价格: ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
上轨价格: ${upperPrice.toLocaleString()}
距离上轨: ${distancePercent}%
区间宽度: ${rangeWidth}%${volumeText}
━━━━━━━━━━━━━━━━
建议: 关注是否突破或回落`;
        return { triggered: true, message };
      }

      if (nearLower && lastState !== 'below') {
        rangeLastState.set(rule.id, currentState);
        const distancePercent = ((currentPrice - lowerPrice) / currentPrice * 100).toFixed(2);
        const message = `${volumeEmoji}📊 BTC 触及区间下轨
━━━━━━━━━━━━━━━━
当前价格: ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
下轨价格: ${lowerPrice.toLocaleString()}
距离下轨: ${distancePercent}%
区间宽度: ${rangeWidth}%${volumeText}
━━━━━━━━━━━━━━━━
建议: 关注是否跌破或反弹`;
        return { triggered: true, message };
      }
    } else if (mode === 'breakout') {
      // Breakout mode: trigger when price breaks through with confirmation
      const upperBreakout = upperPrice * (1 + confirmPercent / 100);
      const lowerBreakout = lowerPrice * (1 - confirmPercent / 100);

      if (currentPrice >= upperBreakout && lastState !== 'above') {
        rangeLastState.set(rule.id, 'above');
        const breakoutPercent = ((currentPrice - upperPrice) / upperPrice * 100).toFixed(2);
        const volumeAdvice = volumeInfo?.label === '放量' ? '放量突破，信号较强' : '关注回踩确认';
        const message = `${volumeEmoji}🚀 BTC 突破区间上轨
━━━━━━━━━━━━━━━━
当前价格: ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
上轨价格: ${upperPrice.toLocaleString()}
突破幅度: ${breakoutPercent}%
确认阈值: ${confirmPercent}%${volumeText}
━━━━━━━━━━━━━━━━
建议: ${volumeAdvice}`;
        return { triggered: true, message };
      }

      if (currentPrice <= lowerBreakout && lastState !== 'below') {
        rangeLastState.set(rule.id, 'below');
        const breakoutPercent = ((lowerPrice - currentPrice) / lowerPrice * 100).toFixed(2);
        const volumeAdvice = volumeInfo?.label === '放量' ? '放量跌破，信号较强' : '关注反抽确认';
        const message = `${volumeEmoji}💥 BTC 跌破区间下轨
━━━━━━━━━━━━━━━━
当前价格: ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
下轨价格: ${lowerPrice.toLocaleString()}
跌破幅度: ${breakoutPercent}%
确认阈值: ${confirmPercent}%${volumeText}
━━━━━━━━━━━━━━━━
建议: ${volumeAdvice}`;
        return { triggered: true, message };
      }
    }

    rangeLastState.set(rule.id, currentState);
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

    // Broadcast to WebSocket clients
    broadcast({
      type: 'alert',
      ruleName: rule.name,
      message,
      price: currentPrice,
      timestamp: Date.now(),
    });

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
