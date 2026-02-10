import cron from 'node-cron';
import { config } from '../../config';

export interface ScheduledTask {
  name: string;
  cronExpression: string;
  task: ReturnType<typeof cron.schedule> | null;
  enabled: boolean;
}

const tasks: Map<string, ScheduledTask> = new Map();

export function schedule(name: string, cronExpr: string, callback: () => void): void {
  if (!cron.validate(cronExpr)) {
    console.error(`[Scheduler] Invalid cron: ${cronExpr} for ${name}`);
    return;
  }

  const existing = tasks.get(name);
  if (existing?.task) {
    existing.task.stop();
  }

  const task = cron.schedule(cronExpr, () => {
    console.log(`[Scheduler] Running: ${name}`);
    callback();
  }, { timezone: 'Asia/Shanghai' });

  tasks.set(name, { name, cronExpression: cronExpr, task, enabled: true });
  console.log(`[Scheduler] Registered: ${name} (${cronExpr})`);
}

export function stopTask(name: string): void {
  const t = tasks.get(name);
  if (t?.task) {
    t.task.stop();
    t.enabled = false;
    console.log(`[Scheduler] Stopped: ${name}`);
  }
}

export function getScheduleConfig(): Record<string, { cron: string; enabled: boolean }> {
  const result: Record<string, { cron: string; enabled: boolean }> = {};
  for (const [name, t] of tasks) {
    result[name] = { cron: t.cronExpression, enabled: t.enabled };
  }
  return result;
}

export function stopAll(): void {
  for (const [name, t] of tasks) {
    if (t.task) {
      t.task.stop();
      t.enabled = false;
    }
  }
  tasks.clear();
  console.log('[Scheduler] All tasks stopped');
}
