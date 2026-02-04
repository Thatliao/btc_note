import { Router, Request, Response } from 'express';
import { priceMonitor } from '../../core/price-monitor';

const router = Router();

// Get current price
router.get('/current/:symbol?', (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol || 'btcusdt';
    const price = priceMonitor.getCurrentPrice(symbol);

    if (price === undefined) {
      return res.status(404).json({ error: 'Price not available yet' });
    }

    res.json({
      symbol: symbol.toUpperCase(),
      price,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get price history
router.get('/history/:symbol?', (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol || 'btcusdt';
    const minutes = parseInt(req.query.minutes as string) || 10;
    const history = priceMonitor.getPriceHistory(symbol, minutes);

    res.json({
      symbol: symbol.toUpperCase(),
      windowMinutes: minutes,
      dataPoints: history.length,
      history,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
