import { AllDataSnapshot } from './collectors';
import { NewsItem } from './collectors/news-feed';

export type ReportType = 'morning' | 'evening' | 'breaking' | 'weekly';

export function buildMorningPrompt(data: AllDataSnapshot): string {
  return `你是一位专业的加密货币分析师，请根据以下数据生成一份简洁的中文早报摘要。

要求：
- 使用 Markdown 格式
- 重点关注：BTC/ETH 价格变动、资金费率、多空比、市场情绪
- 给出今日关注要点
- 语言简洁专业，适合快速阅读
- 总字数控制在 500 字以内

━━━━━━ 市场数据 ━━━━━━
${JSON.stringify(data.market, null, 2)}

━━━━━━ 链上数据 ━━━━━━
${JSON.stringify(data.onchain, null, 2)}

━━━━━━ 市场情绪 ━━━━━━
${JSON.stringify(data.sentiment, null, 2)}

━━━━━━ 最新新闻 ━━━━━━
${JSON.stringify(data.news.articles.slice(0, 5).map((a: NewsItem) => ({ title: a.title, source: a.source })), null, 2)}`;
}

export function buildEveningPrompt(data: AllDataSnapshot): string {
  return `你是一位专业的加密货币分析师，请根据以下数据生成一份简洁的中文晚报摘要。

要求：
- 使用 Markdown 格式
- 总结当日市场表现、重要事件
- 分析资金流向和情绪变化
- 给出明日展望
- 总字数控制在 500 字以内

━━━━━━ 市场数据 ━━━━━━
${JSON.stringify(data.market, null, 2)}

━━━━━━ 链上数据 ━━━━━━
${JSON.stringify(data.onchain, null, 2)}

━━━━━━ 市场情绪 ━━━━━━
${JSON.stringify(data.sentiment, null, 2)}

━━━━━━ 今日新闻 ━━━━━━
${JSON.stringify(data.news.articles.slice(0, 10).map((a: NewsItem) => ({ title: a.title, source: a.source })), null, 2)}`;
}

export function buildBreakingPrompt(newsTitle: string, newsBody: string): string {
  return `你是一位专业的加密货币分析师，请对以下突发新闻进行快速分析。

要求：
- 使用 Markdown 格式
- 简要说明事件内容
- 分析对市场可能的影响
- 给出操作建议
- 总字数控制在 200 字以内

新闻标题：${newsTitle}
新闻内容：${newsBody}`;
}

export function buildWeeklyPrompt(data: AllDataSnapshot, weekSnapshots: any[]): string {
  return `你是一位资深的加密货币分析师，请根据以下一周数据生成深度周报。

要求：
- 使用 Markdown 格式
- 回顾本周市场走势和关键事件
- 分析链上数据趋势
- 总结市场情绪变化
- 给出下周展望和关注要点
- 总字数控制在 1000 字以内

━━━━━━ 本周最新数据 ━━━━━━
${JSON.stringify(data.market, null, 2)}

━━━━━━ 本周历史快照 ━━━━━━
${JSON.stringify(weekSnapshots.slice(0, 7), null, 2)}

━━━━━━ 链上数据 ━━━━━━
${JSON.stringify(data.onchain, null, 2)}

━━━━━━ 市场情绪 ━━━━━━
${JSON.stringify(data.sentiment, null, 2)}

━━━━━━ 本周重要新闻 ━━━━━━
${JSON.stringify(data.news.articles.slice(0, 15).map((a: NewsItem) => ({ title: a.title, source: a.source })), null, 2)}`;
}
