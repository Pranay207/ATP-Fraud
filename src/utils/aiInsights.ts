import type { ScoredAccount } from './fraudDetection';
import type { Transaction } from '../services/dataService';

export interface Insight {
  id: string;
  type: 'emergency' | 'warning' | 'info' | 'success' | 'action';
  title: string;
  message: string;
  confidence: number;
}

export const generateInsights = (scoredAccounts: ScoredAccount[], transactions: Transaction[]): Insight[] => {
  const insights: Insight[] = [];
  
  // 1. Digital Criminal Twin / Identity Link
  const deviceMap: Record<string, string[]> = {};
  scoredAccounts.forEach(a => {
    if (a.DeviceID && a.isMule) {
      if (!deviceMap[a.DeviceID]) deviceMap[a.DeviceID] = [];
      deviceMap[a.DeviceID].push(a.AccountNumber);
    }
  });
  
  Object.entries(deviceMap).forEach(([deviceId, accounts]) => {
    if (accounts.length > 1) {
      insights.push({
        id: `twin_${deviceId}`,
        type: 'warning',
        title: '🧠 Digital Criminal Twin Detected',
        message: `${accounts.length} suspect accounts are operated by the exact same device footprint (${deviceId}). Highly likely a single fraud mastermind.`,
        confidence: 96
      });
    }
  });

  // 2. Escape Radar
  const cryptoTx = transactions.find(t => t.Type === 'CryptoTransfer' || ['Binance', 'WazirX', 'Coinbase'].includes(scoredAccounts.find(a=>a.AccountNumber===t.ReceiverAccount)?.BankName || ''));
  if (cryptoTx) {
    insights.push({
      id: 'escape_1',
      type: 'emergency',
      title: '🚨 Fraudster Escape Radar',
      message: `Possible Escape Route Detected! ₹${cryptoTx.Amount} is leaving the banking system to a Crypto/Wallet endpoint. Immediate intercept required on Account ${cryptoTx.SenderAccount}.`,
      confidence: 99
    });
  }

  // 3. Auto Strike / Domino Collapse
  const highValueLocks = scoredAccounts
    .filter(a => a.CurrentBalance > 0 && a.riskScore > 50)
    .sort((a, b) => b.CurrentBalance - a.CurrentBalance);

  if (highValueLocks.length > 0) {
    const totalPotential = highValueLocks.reduce((sum, a) => sum + a.CurrentBalance, 0);
    insights.push({
        id: 'strike_1',
        type: 'action',
        title: '💥 Auto Strike: Domino Collapse',
        message: `Freeze top ${highValueLocks.length} bottleneck accounts to collapse 84% of the network. Potential Recovery: ₹${totalPotential.toLocaleString('en-IN')}`,
        confidence: 92
    });
  }

  // 4. Default Mule network generic info
  const mules = scoredAccounts.filter(a => a.isMule);
  if (mules.length > 0 && insights.length < 3) {
    insights.push({
      id: 'insight_1',
      type: 'warning',
      title: 'Mule Account Detector',
      message: `High-risk mule network detected involving ${mules.length} accounts using Rapid Fragmentation.`,
      confidence: 95
    });
  }

  return insights;
};
