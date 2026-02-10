import { Router } from 'express';
import { generateReport } from '../../core/news-aggregator';
import { getScheduleConfig } from '../../core/news-aggregator/scheduler';
import { newsCacheRepository, pushHistoryRepository } from '../../db/repository';
import { ReportType } from '../../core/news-aggregator/templates';

const router = Router();

// GET /api/news/latest - 获取最新采集的资讯
router.get('/latest', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const category = req.query.category as string;
    const items = category
      ? newsCacheRepository.findByCategory(category, limit)
      : newsCacheRepository.findRecent(limit);
    res.json({ data: items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/news/history - 推送历史记录
router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const type = req.query.type as string;
    const items = type
      ? pushHistoryRepository.findByType(type, limit)
      : pushHistoryRepository.findAll(limit);
    res.json({ data: items });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/news/trigger/:type - 手动触发推送
router.post('/trigger/:type', async (req, res) => {
  const type = req.params.type as ReportType;
  const validTypes = ['morning', 'evening', 'breaking', 'weekly'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Use: ${validTypes.join(', ')}` });
  }

  try {
    const content = await generateReport(type);
    res.json({ data: { type, content } });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/news/config - 获取调度配置
router.get('/config', (req, res) => {
  try {
    const scheduleConfig = getScheduleConfig();
    res.json({ data: scheduleConfig });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
