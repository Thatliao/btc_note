import { MarketDataSnapshot } from './market-data';
import { OnchainSnapshot } from './onchain';
import { NewsFeedSnapshot } from './news-feed';
import { SentimentSnapshot } from './sentiment';

export { collectMarketData, MarketDataSnapshot } from './market-data';
export { collectOnchainData, OnchainSnapshot } from './onchain';
export { collectNewsFeed, NewsFeedSnapshot } from './news-feed';
export { collectSentiment, SentimentSnapshot } from './sentiment';

export interface AllDataSnapshot {
  market: MarketDataSnapshot;
  onchain: OnchainSnapshot;
  news: NewsFeedSnapshot;
  sentiment: SentimentSnapshot;
  collectedAt: string;
}
