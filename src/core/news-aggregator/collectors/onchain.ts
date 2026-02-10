import axios from 'axios';

export interface WhaleTransaction {
  hash: string;
  amount: number;
  from: string;
  to: string;
  time: number;
}

export interface NetworkFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
}

export interface MempoolInfo {
  count: number;
  vsize: number;
}

export interface OnchainSnapshot {
  whaleTransactions: WhaleTransaction[];
  networkFees: NetworkFees | null;
  mempoolInfo: MempoolInfo | null;
  collectedAt: string;
}

async function getWhaleTransactions(): Promise<WhaleTransaction[]> {
  try {
    const { data } = await axios.get('https://blockchain.info/unconfirmed-transactions?format=json');
    const largeTxs = (data.txs || [])
      .filter((tx: any) => {
        const totalOut = tx.out.reduce((sum: number, o: any) => sum + o.value, 0);
        return totalOut >= 100 * 1e8; // >= 100 BTC
      })
      .slice(0, 10)
      .map((tx: any) => ({
        hash: tx.hash,
        amount: tx.out.reduce((sum: number, o: any) => sum + o.value, 0) / 1e8,
        from: tx.inputs?.[0]?.prev_out?.addr || 'unknown',
        to: tx.out?.[0]?.addr || 'unknown',
        time: tx.time * 1000,
      }));
    return largeTxs;
  } catch (e: any) {
    console.error('[Onchain] getWhaleTransactions:', e.message);
    return [];
  }
}

async function getNetworkFees(): Promise<NetworkFees | null> {
  try {
    const { data } = await axios.get('https://mempool.space/api/v1/fees/recommended');
    return {
      fastestFee: data.fastestFee,
      halfHourFee: data.halfHourFee,
      hourFee: data.hourFee,
      economyFee: data.economyFee,
    };
  } catch (e: any) {
    console.error('[Onchain] getNetworkFees:', e.message);
    return null;
  }
}

async function getMempoolInfo(): Promise<MempoolInfo | null> {
  try {
    const { data } = await axios.get('https://mempool.space/api/mempool');
    return {
      count: data.count,
      vsize: data.vsize,
    };
  } catch (e: any) {
    console.error('[Onchain] getMempoolInfo:', e.message);
    return null;
  }
}

export async function collectOnchainData(): Promise<OnchainSnapshot> {
  console.log('[Onchain] Collecting onchain data...');
  const [whaleTransactions, networkFees, mempoolInfo] = await Promise.all([
    getWhaleTransactions(),
    getNetworkFees(),
    getMempoolInfo(),
  ]);

  console.log('[Onchain] Collection complete');
  return {
    whaleTransactions,
    networkFees,
    mempoolInfo,
    collectedAt: new Date().toISOString(),
  };
}
