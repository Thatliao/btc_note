import { Router, Request, Response } from 'express';
import { ruleRepository } from '../../db/repository';

const router = Router();

// Get all rules
router.get('/', (req: Request, res: Response) => {
  try {
    const rules = ruleRepository.findAll();
    res.json(rules);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single rule
router.get('/:id', (req: Request, res: Response) => {
  try {
    const rule = ruleRepository.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create rule
router.post('/', (req: Request, res: Response) => {
  try {
    const { name, symbol, type, threshold, volatility_window, volatility_percent, cooldown_minutes, is_one_time } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    if ((type === 'threshold_above' || type === 'threshold_below') && !threshold) {
      return res.status(400).json({ error: 'threshold is required for threshold rules' });
    }

    if (type === 'volatility' && (!volatility_window || !volatility_percent)) {
      return res.status(400).json({ error: 'volatility_window and volatility_percent are required for volatility rules' });
    }

    const rule = ruleRepository.create({
      name,
      symbol: symbol || 'BTCUSDT',
      type,
      status: 'active',
      threshold: threshold || null,
      volatility_window: volatility_window || null,
      volatility_percent: volatility_percent || null,
      cooldown_minutes: cooldown_minutes || 5,
      is_one_time: is_one_time ? 1 : 0,
    });

    res.status(201).json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update rule
router.put('/:id', (req: Request, res: Response) => {
  try {
    const rule = ruleRepository.update(req.params.id, req.body);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json(rule);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete rule
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = ruleRepository.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle rule status
router.post('/:id/toggle', (req: Request, res: Response) => {
  try {
    const rule = ruleRepository.findById(req.params.id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    const newStatus = rule.status === 'active' ? 'paused' : 'active';
    const updated = ruleRepository.update(req.params.id, { status: newStatus });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
