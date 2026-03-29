import type { ScoredAccount } from './fraudDetection';
import type { Transaction } from '../services/dataService';
import type { CaseMatch, CaseSignature } from './caseReuseDetection';

export interface SuspiciousPattern {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedAccounts: string[];
  affectedTransactions: string[];
  evidence: string[];
  confidence: number;
  recommendation: string;
  relatedCases?: CaseMatch[];
  signature?: CaseSignature;
}

export const detectSuspiciousPatterns = (
  accounts: ScoredAccount[],
  transactions: Transaction[]
): SuspiciousPattern[] => {
  const patterns: SuspiciousPattern[] = [];

  const circularPattern = detectCircularTransfers(transactions);
  if (circularPattern) patterns.push(circularPattern);

  const layeringPattern = detectRapidLayering(transactions);
  if (layeringPattern) patterns.push(layeringPattern);

  const structuringPattern = detectStructuring(transactions);
  if (structuringPattern) patterns.push(structuringPattern);

  const timingPattern = detectUnusualTiming(transactions);
  if (timingPattern) patterns.push(timingPattern);

  const passThroughPattern = detectPassThroughAccounts(transactions);
  if (passThroughPattern) patterns.push(passThroughPattern);

  const consolidationPattern = detectCrossBankConsolidation(accounts, transactions);
  if (consolidationPattern) patterns.push(consolidationPattern);

  const devicePattern = detectDeviceAnomalies(accounts, transactions);
  if (devicePattern) patterns.push(devicePattern);

  const geoPattern = detectGeographicAnomalies(accounts, transactions);
  if (geoPattern) patterns.push(geoPattern);

  return patterns.sort((left, right) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[left.severity] - severityOrder[right.severity];
  });
};

const detectCircularTransfers = (transactions: Transaction[]): SuspiciousPattern | null => {
  const cycles: string[][] = [];
  const visited = new Set<string>();

  const dfs = (start: string, current: string, path: string[]): boolean => {
    if (current === start && path.length > 2) {
      cycles.push([...path, start]);
      return true;
    }

    if (visited.has(current) || path.length > 6) return false;
    if (path.includes(current)) return false;

    visited.add(current);
    path.push(current);

    const nextTransactions = transactions.filter((transaction) => transaction.SenderAccount === current);
    for (const transaction of nextTransactions) {
      if (dfs(start, transaction.ReceiverAccount, path)) {
        path.pop();
        visited.delete(current);
        return true;
      }
    }

    path.pop();
    visited.delete(current);
    return false;
  };

  const startAccounts = new Set(transactions.map((transaction) => transaction.SenderAccount));
  for (const account of startAccounts) {
    dfs(account, account, []);
  }

  if (cycles.length === 0) {
    return null;
  }

  const affectedTransactions = cycles.flatMap((cycle) => {
    const transactionIds: string[] = [];
    for (let index = 0; index < cycle.length - 1; index += 1) {
      const transaction = transactions.find(
        (item) => item.SenderAccount === cycle[index] && item.ReceiverAccount === cycle[index + 1]
      );
      if (transaction) transactionIds.push(transaction.TxID);
    }
    return transactionIds;
  });

  const totalAmount = affectedTransactions.reduce((sum, transactionId) => {
    const transaction = transactions.find((item) => item.TxID === transactionId);
    return sum + (transaction?.Amount || 0);
  }, 0);

  return {
    id: 'circular_transfers',
    name: 'Circular Transfer Ring',
    description: `Detected ${cycles.length} circular transfer patterns - money being recycled through multiple accounts`,
    severity: 'critical',
    affectedAccounts: Array.from(new Set(cycles.flat().slice(0, -1))),
    affectedTransactions,
    evidence: [
      `${cycles.length} circular cycles detected`,
      `Total amount in cycle: Rs. ${totalAmount.toLocaleString('en-IN')}`,
      `Average cycle length: ${(cycles.reduce((sum, cycle) => sum + cycle.length, 0) / cycles.length).toFixed(1)} hops`
    ],
    confidence: 98,
    recommendation: 'Immediately freeze all accounts in the circular chain. This is a classic money laundering technique.'
  };
};

const detectRapidLayering = (transactions: Transaction[]): SuspiciousPattern | null => {
  const layeringClusters: Map<string, Transaction[]> = new Map();

  transactions.forEach((transaction) => {
    const timeWindow = new Date(transaction.Timestamp);
    timeWindow.setHours(timeWindow.getHours() - 1);

    const related = transactions.filter((item) =>
      new Date(item.Timestamp) >= timeWindow &&
      new Date(item.Timestamp) <= new Date(transaction.Timestamp) &&
      (item.SenderAccount === transaction.SenderAccount || item.ReceiverAccount === transaction.ReceiverAccount)
    );

    if (related.length > 5) {
      layeringClusters.set(transaction.TxID, related);
    }
  });

  if (layeringClusters.size === 0) {
    return null;
  }

  const affectedAccounts = new Set<string>();
  const clusters = Array.from(layeringClusters.values());
  let totalAmount = 0;

  clusters.forEach((cluster) => {
    cluster.forEach((transaction) => {
      affectedAccounts.add(transaction.SenderAccount);
      affectedAccounts.add(transaction.ReceiverAccount);
      totalAmount += transaction.Amount || 0;
    });
  });

  return {
    id: 'rapid_layering',
    name: 'Rapid Layering Pattern',
    description: 'Multiple transactions in rapid succession through the network - characteristic of money laundering layering phase',
    severity: 'high',
    affectedAccounts: Array.from(affectedAccounts),
    affectedTransactions: Array.from(layeringClusters.keys()),
    evidence: [
      `${clusters.length} rapid transaction clusters identified`,
      `Total amount layered: Rs. ${totalAmount.toLocaleString('en-IN')}`,
      `Average transactions per cluster: ${(clusters.reduce((sum, cluster) => sum + cluster.length, 0) / clusters.length).toFixed(1)}`
    ],
    confidence: 92,
    recommendation: 'Flag for manual review. Monitor transaction timing and amounts. Consider velocity-based freezing.'
  };
};

const detectStructuring = (transactions: Transaction[]): SuspiciousPattern | null => {
  const structuringThreshold = 100000; // Rs. 1 Lakh
  const structuringAccounts: Record<string, Transaction[]> = {};

  transactions.forEach((transaction) => {
    if (transaction.Amount && transaction.Amount > 50000 && transaction.Amount < structuringThreshold) {
      if (!structuringAccounts[transaction.SenderAccount]) {
        structuringAccounts[transaction.SenderAccount] = [];
      }
      structuringAccounts[transaction.SenderAccount].push(transaction);
    }
  });

  const suspiciousStructurers = Object.entries(structuringAccounts).filter(([, accountTransactions]) => accountTransactions.length >= 3);

  if (suspiciousStructurers.length === 0) {
    return null;
  }

  const affectedAccounts = suspiciousStructurers.map(([account]) => account);
  const totalAmount = suspiciousStructurers.reduce((sum, [, accountTransactions]) => (
    sum + accountTransactions.reduce((running, transaction) => running + (transaction.Amount || 0), 0)
  ), 0);
  const totalTransactions = suspiciousStructurers.reduce((sum, [, accountTransactions]) => sum + accountTransactions.length, 0);

  return {
    id: 'structuring',
    name: 'Structuring Pattern (Below Threshold Transfers)',
    description: 'Multiple transfers just below detection thresholds - classic structuring to avoid regulatory scrutiny',
    severity: 'high',
    affectedAccounts,
    affectedTransactions: suspiciousStructurers.flatMap(([, accountTransactions]) => accountTransactions.map((transaction) => transaction.TxID)),
    evidence: [
      `${suspiciousStructurers.length} accounts with structuring behavior`,
      `Total structured amount: Rs. ${totalAmount.toLocaleString('en-IN')}`,
      `Average structuring amount: Rs. ${(totalAmount / Math.max(totalTransactions, 1)).toLocaleString('en-IN')}`
    ],
    confidence: 88,
    recommendation: 'Immediate action required. Structuring is deliberate regulatory evasion. Initiate freezing protocols.'
  };
};

const detectUnusualTiming = (transactions: Transaction[]): SuspiciousPattern | null => {
  const nightTimePattern: Record<string, number> = {};
  const totalByAccount: Record<string, number> = {};

  transactions.forEach((transaction) => {
    const hour = new Date(transaction.Timestamp).getHours();
    if (hour < 6 || hour > 23) {
      nightTimePattern[transaction.SenderAccount] = (nightTimePattern[transaction.SenderAccount] || 0) + 1;
    }
    totalByAccount[transaction.SenderAccount] = (totalByAccount[transaction.SenderAccount] || 0) + 1;
  });

  const unusualTimingAccounts = Object.entries(nightTimePattern).filter(
    ([account, count]) => (count / (totalByAccount[account] || 1)) > 0.6 && count > 3
  );

  if (unusualTimingAccounts.length === 0) {
    return null;
  }

  return {
    id: 'unusual_timing',
    name: 'Unusual Transaction Timing',
    description: 'Heavy transaction activity during late night hours - often indicates fraudster activity to avoid detection',
    severity: 'medium',
    affectedAccounts: unusualTimingAccounts.map(([account]) => account),
    affectedTransactions: transactions
      .filter((transaction) =>
        (new Date(transaction.Timestamp).getHours() < 6 || new Date(transaction.Timestamp).getHours() > 23) &&
        unusualTimingAccounts.some(([account]) => account === transaction.SenderAccount)
      )
      .map((transaction) => transaction.TxID),
    evidence: [
      `${unusualTimingAccounts.length} accounts with unusual timing patterns`,
      'Peak activity: Late night/Early morning (11 PM - 6 AM)',
      'Average night-time transaction rate: 70%+'
    ],
    confidence: 76,
    recommendation: 'Monitor these accounts closely. Manual review of timing correlations recommended.'
  };
};

const detectPassThroughAccounts = (transactions: Transaction[]): SuspiciousPattern | null => {
  const passThroughCandidates: Record<string, { in: number; out: number }> = {};

  transactions.forEach((transaction) => {
    passThroughCandidates[transaction.ReceiverAccount] = passThroughCandidates[transaction.ReceiverAccount] || { in: 0, out: 0 };
    passThroughCandidates[transaction.SenderAccount] = passThroughCandidates[transaction.SenderAccount] || { in: 0, out: 0 };
    passThroughCandidates[transaction.ReceiverAccount].in += 1;
    passThroughCandidates[transaction.SenderAccount].out += 1;
  });

  const highVelocityPassThrough = Object.entries(passThroughCandidates)
    .filter(([, counts]) => counts.in > 10 && counts.out > 10 && Math.abs(counts.in - counts.out) < 3)
    .map(([account]) => account);

  if (highVelocityPassThrough.length === 0) {
    return null;
  }

  const affectedTransactionCount = transactions.filter(
    (transaction) => highVelocityPassThrough.includes(transaction.SenderAccount) || highVelocityPassThrough.includes(transaction.ReceiverAccount)
  ).length;

  return {
    id: 'pass_through',
    name: 'High-Velocity Pass-Through Accounts',
    description: 'Accounts with balanced incoming and outgoing high transaction counts - classic mule account behavior',
    severity: 'critical',
    affectedAccounts: highVelocityPassThrough,
    affectedTransactions: transactions
      .filter((transaction) => highVelocityPassThrough.includes(transaction.SenderAccount) || highVelocityPassThrough.includes(transaction.ReceiverAccount))
      .map((transaction) => transaction.TxID),
    evidence: [
      `${highVelocityPassThrough.length} mule accounts detected`,
      'Average balance: In/Out ratio very close (near 1.0)',
      `Total transactions through mules: ${affectedTransactionCount}`
    ],
    confidence: 95,
    recommendation: 'Freeze all identified mule accounts immediately. These are intermediary accounts used to obscure fund origin.'
  };
};

const detectCrossBankConsolidation = (
  accounts: ScoredAccount[],
  transactions: Transaction[]
): SuspiciousPattern | null => {
  const bankConsolidation: Record<string, Set<string>> = {};

  transactions.forEach((transaction) => {
    const receiver = accounts.find((account) => account.AccountNumber === transaction.ReceiverAccount);
    const sender = accounts.find((account) => account.AccountNumber === transaction.SenderAccount);

    if (receiver && sender && receiver.BankName !== sender.BankName) {
      if (!bankConsolidation[transaction.ReceiverAccount]) {
        bankConsolidation[transaction.ReceiverAccount] = new Set();
      }
      bankConsolidation[transaction.ReceiverAccount].add(sender.BankName);
    }
  });

  const consolidationAccounts = Object.entries(bankConsolidation)
    .filter(([, banks]) => banks.size >= 3)
    .map(([account, banks]) => ({ account, bankCount: banks.size }));

  if (consolidationAccounts.length === 0) {
    return null;
  }

  const totalTransactionCount = transactions.filter(
    (transaction) => consolidationAccounts.some((candidate) => candidate.account === transaction.ReceiverAccount)
  ).length;

  return {
    id: 'cross_bank_consolidation',
    name: 'Cross-Bank Consolidation',
    description: 'Funds from multiple banks consolidated into single accounts - funds cleanup phase characteristic',
    severity: 'high',
    affectedAccounts: consolidationAccounts.map((candidate) => candidate.account),
    affectedTransactions: transactions
      .filter((transaction) => consolidationAccounts.some((candidate) => candidate.account === transaction.ReceiverAccount))
      .map((transaction) => transaction.TxID),
    evidence: [
      `${consolidationAccounts.length} consolidation accounts`,
      `Average sources per account: ${(consolidationAccounts.reduce((sum, candidate) => sum + candidate.bankCount, 0) / consolidationAccounts.length).toFixed(1)} banks`,
      `Total transactions: ${totalTransactionCount}`
    ],
    confidence: 85,
    recommendation: 'These accounts appear to be collection points. High risk of being final destinations for stolen money.'
  };
};

const detectDeviceAnomalies = (
  accounts: ScoredAccount[],
  transactions: Transaction[]
): SuspiciousPattern | null => {
  const deviceAccounts: Record<string, string[]> = {};

  accounts.filter((account) => account.DeviceID).forEach((account) => {
    if (!deviceAccounts[account.DeviceID]) {
      deviceAccounts[account.DeviceID] = [];
    }
    deviceAccounts[account.DeviceID].push(account.AccountNumber);
  });

  const multiAccountDevices = Object.entries(deviceAccounts)
    .filter(([, linkedAccounts]) => linkedAccounts.length > 2);

  if (multiAccountDevices.length === 0) {
    return null;
  }

  const allAffectedAccounts = multiAccountDevices.flatMap(([, linkedAccounts]) => linkedAccounts);

  return {
    id: 'device_anomalies',
    name: 'Device Anomalies (Multiple Accounts)',
    description: 'Single device ID accessing multiple accounts - strong indicator of coordinated fraud',
    severity: 'critical',
    affectedAccounts: allAffectedAccounts,
    affectedTransactions: transactions
      .filter((transaction) => allAffectedAccounts.includes(transaction.SenderAccount) || allAffectedAccounts.includes(transaction.ReceiverAccount))
      .map((transaction) => transaction.TxID),
    evidence: [
      `${multiAccountDevices.length} devices managing multiple accounts`,
      `Average accounts per device: ${(multiAccountDevices.reduce((sum, [, linkedAccounts]) => sum + linkedAccounts.length, 0) / multiAccountDevices.length).toFixed(1)}`,
      'Coordinated fraud network detected'
    ],
    confidence: 98,
    recommendation: 'Critical alert! Same device controlling multiple accounts is near-certain fraud. Escalate to law enforcement immediately.'
  };
};

const detectGeographicAnomalies = (
  accounts: ScoredAccount[],
  transactions: Transaction[]
): SuspiciousPattern | null => {
  const spreadPatterns = accounts
    .filter((account) => account.riskScore > 70 && account.isMule)
    .reduce((current, account) => {
      current[account.Location || 'unknown'] = (current[account.Location || 'unknown'] || 0) + 1;
      return current;
    }, {} as Record<string, number>);

  if (Object.keys(spreadPatterns).length <= 3) {
    return null;
  }

  return {
    id: 'geographic_spread',
    name: 'Geographic Spread Pattern',
    description: 'High-risk accounts distributed across multiple locations - indicates organized fraud ring',
    severity: 'high',
    affectedAccounts: accounts.filter((account) => account.riskScore > 70 && account.isMule).map((account) => account.AccountNumber),
    affectedTransactions: transactions.map((transaction) => transaction.TxID),
    evidence: [
      `High-risk accounts in ${Object.keys(spreadPatterns).length} locations`,
      `Primary locations: ${Object.entries(spreadPatterns)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 3)
        .map(([location, count]) => `${location} (${count})`)
        .join(', ')}`,
      'Pattern suggests organized fraud network'
    ],
    confidence: 82,
    recommendation: 'Coordinate with regional law enforcement. This suggests organized criminal activity across multiple jurisdictions.'
  };
};
