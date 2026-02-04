import { Router, Request, Response } from 'express';
import { historyRepository } from '../../db/repository';

const router = Router();

// Get all alerts history
router.get('/', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = historyRepository.findAll(limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts by rule ID
router.get('/rule/:ruleId', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = historyRepository.findByRuleId(req.params.ruleId, limit);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Clean old history
router.delete('/cleanup/:days', (req: Request, res: Response) => {
  try {
    const days = parseInt(req.params.days) || 30;
    const deleted = historyRepository.deleteOlderThan(days);
    res.json({ deleted });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
