import type { CaseInfo, Transaction } from '../services/dataService';
import type { ScoredAccount } from './fraudDetection';

const CASE_HISTORY_STORAGE_KEY = 'ftm-case-reuse-history';

export interface CaseSignature {
  key: string;
  complaintId: string;
  label: string;
  fraudType: string;
  source: 'reference' | 'observed';
  lastSeen: string;
  totalAmount: number;
  averageAmount: number;
  maxAmount: number;
  txCount: number;
  uniqueAccounts: number;
  uniqueBanks: number;
  uniqueLocations: number;
  uniqueDevices: number;
  highRiskRatio: number;
  muleRatio: number;
  newAccountRatio: number;
  offHoursRatio: number;
  rapidHopRatio: number;
  roundAmountRatio: number;
  sharedDeviceRatio: number;
  tags: string[];
}

export interface CaseMatch {
  caseSignature: CaseSignature;
  similarity: number;
  gangConfidence: number;
  matchingSignals: string[];
}

const REFERENCE_CASEBOOK: CaseSignature[] = [
  {
    key: 'ref-hyd-2025-014',
    complaintId: 'HYD-2025-014',
    label: 'South Corridor Mule Cell',
    fraudType: 'UPI mule cash-out ring',
    source: 'reference',
    lastSeen: '2025-10-17T06:30:00.000Z',
    totalAmount: 1850000,
    averageAmount: 46250,
    maxAmount: 98500,
    txCount: 40,
    uniqueAccounts: 18,
    uniqueBanks: 6,
    uniqueLocations: 4,
    uniqueDevices: 5,
    highRiskRatio: 0.66,
    muleRatio: 0.44,
    newAccountRatio: 0.39,
    offHoursRatio: 0.52,
    rapidHopRatio: 0.61,
    roundAmountRatio: 0.48,
    sharedDeviceRatio: 0.42,
    tags: ['mule_network', 'rapid_layering', 'cross_bank', 'shared_device', 'night_activity']
  },
  {
    key: 'ref-blr-2025-221',
    complaintId: 'BLR-2025-221',
    label: 'Investment Cleanup Cluster',
    fraudType: 'investment fraud collection network',
    source: 'reference',
    lastSeen: '2025-11-02T11:20:00.000Z',
    totalAmount: 4200000,
    averageAmount: 84000,
    maxAmount: 199000,
    txCount: 50,
    uniqueAccounts: 21,
    uniqueBanks: 8,
    uniqueLocations: 6,
    uniqueDevices: 8,
    highRiskRatio: 0.58,
    muleRatio: 0.31,
    newAccountRatio: 0.29,
    offHoursRatio: 0.18,
    rapidHopRatio: 0.56,
    roundAmountRatio: 0.74,
    sharedDeviceRatio: 0.19,
    tags: ['cross_bank', 'high_velocity', 'round_amounts', 'collector_account', 'fund_fragmentation']
  },
  {
    key: 'ref-vja-2024-087',
    complaintId: 'VJA-2024-087',
    label: 'Shared Device Wallet Farm',
    fraudType: 'wallet dispersal fraud chain',
    source: 'reference',
    lastSeen: '2024-12-09T09:15:00.000Z',
    totalAmount: 910000,
    averageAmount: 22750,
    maxAmount: 74000,
    txCount: 40,
    uniqueAccounts: 16,
    uniqueBanks: 4,
    uniqueLocations: 3,
    uniqueDevices: 3,
    highRiskRatio: 0.71,
    muleRatio: 0.52,
    newAccountRatio: 0.46,
    offHoursRatio: 0.34,
    rapidHopRatio: 0.67,
    roundAmountRatio: 0.29,
    sharedDeviceRatio: 0.58,
    tags: ['shared_device', 'mule_network', 'rapid_layering', 'fresh_accounts']
  },
  {
    key: 'ref-che-2025-144',
    complaintId: 'CHE-2025-144',
    label: 'Night Shift Structuring Crew',
    fraudType: 'threshold evasion structuring network',
    source: 'reference',
    lastSeen: '2025-08-23T22:10:00.000Z',
    totalAmount: 2600000,
    averageAmount: 56521,
    maxAmount: 99000,
    txCount: 46,
    uniqueAccounts: 20,
    uniqueBanks: 5,
    uniqueLocations: 5,
    uniqueDevices: 7,
    highRiskRatio: 0.51,
    muleRatio: 0.27,
    newAccountRatio: 0.21,
    offHoursRatio: 0.63,
    rapidHopRatio: 0.49,
    roundAmountRatio: 0.68,
    sharedDeviceRatio: 0.17,
    tags: ['structuring', 'night_activity', 'round_amounts', 'cross_bank']
  }
];

const clampRatio = (value: number): number => Math.max(0, Math.min(1, value));

const safeStorageRead = (): CaseSignature[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CASE_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CaseSignature[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeStorageWrite = (history: CaseSignature[]): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CASE_HISTORY_STORAGE_KEY, JSON.stringify(history));
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
};

const computeSharedDeviceRatio = (accounts: ScoredAccount[]): number => {
  const deviceCounts = new Map<string, number>();
  accounts.forEach((account) => {
    if (!account.DeviceID) {
      return;
    }
    deviceCounts.set(account.DeviceID, (deviceCounts.get(account.DeviceID) || 0) + 1);
  });

  const accountsOnSharedDevices = Array.from(deviceCounts.values()).reduce((sum, count) => (
    count > 1 ? sum + count : sum
  ), 0);

  return accounts.length > 0 ? clampRatio(accountsOnSharedDevices / accounts.length) : 0;
};

const computeRapidHopRatio = (transactions: Transaction[]): number => {
  if (transactions.length <= 1) {
    return 0;
  }

  const timestampsByAccount = new Map<string, number[]>();
  transactions.forEach((transaction) => {
    const timestamp = new Date(transaction.Timestamp).getTime();
    if (Number.isNaN(timestamp)) {
      return;
    }

    const senderTimeline = timestampsByAccount.get(transaction.SenderAccount) || [];
    senderTimeline.push(timestamp);
    timestampsByAccount.set(transaction.SenderAccount, senderTimeline);

    const receiverTimeline = timestampsByAccount.get(transaction.ReceiverAccount) || [];
    receiverTimeline.push(timestamp);
    timestampsByAccount.set(transaction.ReceiverAccount, receiverTimeline);
  });

  let rapidEvents = 0;
  timestampsByAccount.forEach((timeline) => {
    timeline.sort((left, right) => left - right);
    for (let index = 1; index < timeline.length; index += 1) {
      if (timeline[index] - timeline[index - 1] <= 60 * 60 * 1000) {
        rapidEvents += 1;
      }
    }
  });

  return clampRatio(rapidEvents / Math.max(transactions.length, 1));
};

const computeRoundAmountRatio = (transactions: Transaction[]): number => {
  if (transactions.length === 0) {
    return 0;
  }

  const roundAmounts = transactions.filter((transaction) => {
    const amount = Math.round(transaction.Amount || 0);
    return amount > 0 && (amount % 1000 === 0 || amount % 5000 === 0 || amount % 10000 === 0);
  }).length;

  return clampRatio(roundAmounts / transactions.length);
};

const computeOffHoursRatio = (transactions: Transaction[]): number => {
  if (transactions.length === 0) {
    return 0;
  }

  const offHourTransactions = transactions.filter((transaction) => {
    const hour = new Date(transaction.Timestamp).getHours();
    return hour < 6 || hour >= 23;
  }).length;

  return clampRatio(offHourTransactions / transactions.length);
};

const computeNewAccountRatio = (accounts: ScoredAccount[], transactions: Transaction[]): number => {
  if (accounts.length === 0) {
    return 0;
  }

  const referenceTime = transactions
    .map((transaction) => new Date(transaction.Timestamp).getTime())
    .filter((value) => !Number.isNaN(value))
    .reduce((latest, value) => Math.max(latest, value), 0) || Date.now();

  const newAccounts = accounts.filter((account) => {
    const createdAt = new Date(account.CreationDate).getTime();
    if (Number.isNaN(createdAt)) {
      return false;
    }
    return (referenceTime - createdAt) / (1000 * 60 * 60 * 24) <= 45;
  }).length;

  return clampRatio(newAccounts / accounts.length);
};

const deriveTags = (signature: Omit<CaseSignature, 'tags'>): string[] => {
  const tags: string[] = [];

  if (signature.muleRatio >= 0.3 || signature.highRiskRatio >= 0.55) tags.push('mule_network');
  if (signature.rapidHopRatio >= 0.45) tags.push('rapid_layering');
  if (signature.uniqueBanks >= 4) tags.push('cross_bank');
  if (signature.sharedDeviceRatio >= 0.25) tags.push('shared_device');
  if (signature.offHoursRatio >= 0.4) tags.push('night_activity');
  if (signature.roundAmountRatio >= 0.45) tags.push('round_amounts');
  if (signature.newAccountRatio >= 0.25) tags.push('fresh_accounts');
  if (signature.txCount >= Math.max(18, signature.uniqueAccounts * 2)) tags.push('high_velocity');
  if (signature.uniqueAccounts >= 10 && signature.averageAmount < signature.maxAmount * 0.55) tags.push('fund_fragmentation');
  if (signature.uniqueBanks >= 5 && signature.averageAmount >= 50000) tags.push('collector_account');
  if (signature.roundAmountRatio >= 0.55 && signature.averageAmount < 100000) tags.push('structuring');

  return tags;
};

export const buildCaseSignature = (
  accounts: ScoredAccount[],
  transactions: Transaction[],
  caseInfo: CaseInfo | null
): CaseSignature => {
  const totalAmount = transactions.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);
  const uniqueAccounts = new Set([
    ...accounts.map((account) => account.AccountNumber),
    ...transactions.map((transaction) => transaction.SenderAccount),
    ...transactions.map((transaction) => transaction.ReceiverAccount)
  ]).size;
  const uniqueBanks = new Set(accounts.map((account) => account.BankName).filter(Boolean)).size;
  const uniqueLocations = new Set(accounts.map((account) => account.Location).filter(Boolean)).size;
  const uniqueDevices = new Set(accounts.map((account) => account.DeviceID).filter(Boolean)).size;
  const highRiskRatio = accounts.length > 0
    ? clampRatio(accounts.filter((account) => account.riskScore >= 70).length / accounts.length)
    : 0;
  const muleRatio = accounts.length > 0
    ? clampRatio(accounts.filter((account) => account.isMule).length / accounts.length)
    : 0;
  const averageAmount = transactions.length > 0 ? totalAmount / transactions.length : 0;
  const maxAmount = transactions.reduce((max, transaction) => Math.max(max, transaction.Amount || 0), 0);
  const baseSignature = {
    key: `${caseInfo?.ComplaintID || 'CASE'}-${hashString([
      caseInfo?.ComplaintID || '',
      transactions.length,
      totalAmount.toFixed(0),
      uniqueAccounts
    ].join('|'))}`,
    complaintId: caseInfo?.ComplaintID || 'UNSPECIFIED',
    label: caseInfo?.ComplaintID ? `Complaint ${caseInfo.ComplaintID}` : 'Observed Investigation Case',
    fraudType: caseInfo?.FraudType || 'Unknown fraud type',
    source: 'observed' as const,
    lastSeen: new Date().toISOString(),
    totalAmount,
    averageAmount,
    maxAmount,
    txCount: transactions.length,
    uniqueAccounts,
    uniqueBanks,
    uniqueLocations,
    uniqueDevices,
    highRiskRatio,
    muleRatio,
    newAccountRatio: computeNewAccountRatio(accounts, transactions),
    offHoursRatio: computeOffHoursRatio(transactions),
    rapidHopRatio: computeRapidHopRatio(transactions),
    roundAmountRatio: computeRoundAmountRatio(transactions),
    sharedDeviceRatio: computeSharedDeviceRatio(accounts)
  };

  return {
    ...baseSignature,
    tags: deriveTags(baseSignature)
  };
};

const ratioSimilarity = (left: number, right: number): number => clampRatio(1 - Math.abs(left - right));

const amountSimilarity = (left: number, right: number): number => {
  const max = Math.max(left, right, 1);
  return clampRatio(1 - Math.abs(left - right) / max);
};

const countSimilarity = (left: number, right: number): number => {
  const max = Math.max(left, right, 1);
  return clampRatio(1 - Math.abs(left - right) / max);
};

const getTagOverlap = (left: string[], right: string[]): number => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (union.size === 0) {
    return 0;
  }

  let overlap = 0;
  union.forEach((tag) => {
    if (leftSet.has(tag) && rightSet.has(tag)) {
      overlap += 1;
    }
  });

  return overlap / union.size;
};

const describeSignals = (current: CaseSignature, historical: CaseSignature): string[] => {
  const signals: string[] = [];
  const sharedTags = current.tags.filter((tag) => historical.tags.includes(tag));

  if (sharedTags.length > 0) {
    signals.push(`Shared fraud markers: ${sharedTags.slice(0, 3).join(', ')}`);
  }
  if (amountSimilarity(current.totalAmount, historical.totalAmount) >= 0.7) {
    signals.push('Total siphoned amount is in a similar band');
  }
  if (countSimilarity(current.txCount, historical.txCount) >= 0.7) {
    signals.push('Transaction volume is close to the earlier case');
  }
  if (ratioSimilarity(current.sharedDeviceRatio, historical.sharedDeviceRatio) >= 0.7 && current.sharedDeviceRatio > 0.1) {
    signals.push('Multi-account device reuse resembles the older case');
  }
  if (ratioSimilarity(current.rapidHopRatio, historical.rapidHopRatio) >= 0.7 && current.rapidHopRatio > 0.2) {
    signals.push('Funds are moving with a similar rapid layering cadence');
  }
  if (ratioSimilarity(current.offHoursRatio, historical.offHoursRatio) >= 0.7 && current.offHoursRatio > 0.2) {
    signals.push('Off-hours transaction behavior lines up with the prior case');
  }
  if (ratioSimilarity(current.muleRatio, historical.muleRatio) >= 0.7 && current.muleRatio > 0.15) {
    signals.push('Mule-account concentration is close to the historical case');
  }

  return signals.slice(0, 4);
};

export const findSimilarHistoricalCases = (current: CaseSignature): CaseMatch[] => {
  const observedCases = safeStorageRead();
  const candidates = [...REFERENCE_CASEBOOK, ...observedCases].filter((candidate) => (
    candidate.key !== current.key && candidate.complaintId !== current.complaintId
  ));

  return candidates
    .map((candidate) => {
      const similarity = (
        getTagOverlap(current.tags, candidate.tags) * 0.32 +
        amountSimilarity(current.totalAmount, candidate.totalAmount) * 0.16 +
        countSimilarity(current.txCount, candidate.txCount) * 0.12 +
        countSimilarity(current.uniqueBanks, candidate.uniqueBanks) * 0.08 +
        ratioSimilarity(current.muleRatio, candidate.muleRatio) * 0.11 +
        ratioSimilarity(current.highRiskRatio, candidate.highRiskRatio) * 0.08 +
        ratioSimilarity(current.rapidHopRatio, candidate.rapidHopRatio) * 0.07 +
        ratioSimilarity(current.offHoursRatio, candidate.offHoursRatio) * 0.04 +
        ratioSimilarity(current.sharedDeviceRatio, candidate.sharedDeviceRatio) * 0.02
      ) * 100;

      return {
        caseSignature: candidate,
        similarity: Math.round(similarity),
        gangConfidence: Math.max(0, Math.min(100, Math.round(similarity + (getTagOverlap(current.tags, candidate.tags) * 15)))),
        matchingSignals: describeSignals(current, candidate)
      };
    })
    .filter((match) => match.similarity >= 60)
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, 3);
};

export const storeObservedCaseSignature = (signature: CaseSignature): void => {
  const currentHistory = safeStorageRead();
  const nextHistory = [
    signature,
    ...currentHistory.filter((caseItem) => caseItem.key !== signature.key)
  ]
    .sort((left, right) => new Date(right.lastSeen).getTime() - new Date(left.lastSeen).getTime())
    .slice(0, 25);

  safeStorageWrite(nextHistory);
};
