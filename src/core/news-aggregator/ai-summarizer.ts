import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../config';
import { ReportType } from './templates';

const getClient = (() => {
  let client: Anthropic | null = null;
  return () => {
    if (!client) {
      client = new Anthropic({
        baseURL: config.anthropic.baseURL,
        apiKey: config.anthropic.apiKey,
      });
    }
    return client;
  };
})();

function getModel(type: ReportType): string {
  return type === 'weekly'
    ? 'claude-sonnet-4-5-20250929'
    : 'claude-haiku-4-5-20251001';
}

export interface SummaryResult {
  content: string;
  model: string;
}

export async function summarize(prompt: string, type: ReportType): Promise<SummaryResult> {
  if (!config.anthropic.apiKey) {
    console.warn('[AISummarizer] No API key configured, returning raw data');
    return { content: '⚠️ AI 摘要未配置，请设置 ANTHROPIC_AUTH_TOKEN', model: 'none' };
  }

  const model = getModel(type);
  console.log(`[AISummarizer] Generating ${type} summary with ${model}...`);

  try {
    const client = getClient();
    const message = await client.messages.create({
      model,
      max_tokens: type === 'weekly' ? 2048 : 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    console.log(`[AISummarizer] Summary generated (${text.length} chars)`);
    return { content: text, model };
  } catch (e: any) {
    console.error('[AISummarizer] Error:', e.message);
    return { content: `⚠️ AI 摘要生成失败: ${e.message}`, model };
  }
}
