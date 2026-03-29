import type { ScoredAccount } from './fraudDetection';
import type { Transaction } from '../services/dataService';

export interface NetworkStatistics {
  totalNodes: number;
  totalEdges: number;
  averageNodeDegree: number;
  clusters: Cluster[];
  densityScore: number;
  centralityMetrics: Record<string, number>;
  hiddenLinks: HiddenLink[];
  hiddenLinkClusters: HiddenLinkCluster[];
}

export interface Cluster {
  id: string;
  members: string[];
  size: number;
  cohesion: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface HiddenLink {
  source: string;
  target: string;
  confidence: number;
  signals: Array<'device' | 'ip' | 'behavior'>;
  reasons: string[];
}

export interface HiddenLinkCluster {
  id: string;
  members: string[];
  size: number;
  confidence: number;
  dominantSignals: Array<'device' | 'ip' | 'behavior'>;
  reasons: string[];
  suspectedController: string | null;
}

interface AccountBehaviorProfile {
  accountNumber: string;
  averageAmount: number;
  roundAmountRatio: number;
  offHoursRatio: number;
  counterparties: Set<string>;
  txCount: number;
}

const clampRatio = (value: number): number => Math.max(0, Math.min(1, value));

export const analyzeNetwork = (
  accounts: ScoredAccount[],
  transactions: Transaction[]
): NetworkStatistics => {
  const nodes = accounts.length;
  const edges = new Set(
    transactions.map((transaction) => `${transaction.SenderAccount}->${transaction.ReceiverAccount}`)
  ).size;

  const accountMap: Record<string, ScoredAccount> = {};
  accounts.forEach((account) => {
    accountMap[account.AccountNumber] = account;
  });

  const adjacency: Record<string, Set<string>> = {};
  accounts.forEach((account) => {
    adjacency[account.AccountNumber] = new Set();
  });

  transactions.forEach((transaction) => {
    if (adjacency[transaction.SenderAccount]) adjacency[transaction.SenderAccount].add(transaction.ReceiverAccount);
    if (adjacency[transaction.ReceiverAccount]) adjacency[transaction.ReceiverAccount].add(transaction.SenderAccount);
  });

  const degrees = Object.entries(adjacency).map(([account, connected]) => ({
    account,
    degree: connected.size
  }));

  const avgDegree = degrees.reduce((sum, item) => sum + item.degree, 0) / degrees.length || 0;
  const clusters = detectClusters(adjacency, accountMap);
  const possibleEdges = (nodes * (nodes - 1)) / 2;
  const density = possibleEdges > 0 ? edges / possibleEdges : 0;

  const centrality: Record<string, number> = {};
  degrees.forEach((item) => {
    centrality[item.account] = item.degree / (nodes - 1) || 0;
  });

  const hiddenLinks = detectHiddenLinks(accounts, transactions);
  const hiddenLinkClusters = buildHiddenLinkClusters(hiddenLinks, accountMap);

  return {
    totalNodes: nodes,
    totalEdges: edges,
    averageNodeDegree: avgDegree,
    clusters,
    densityScore: density,
    centralityMetrics: centrality,
    hiddenLinks,
    hiddenLinkClusters
  };
};

const detectClusters = (
  adjacency: Record<string, Set<string>>,
  accountMap: Record<string, ScoredAccount>
): Cluster[] => {
  const visited = new Set<string>();
  const clusters: Cluster[] = [];
  let clusterId = 0;

  const dfs = (node: string, cluster: Set<string>) => {
    if (visited.has(node)) return;
    visited.add(node);
    cluster.add(node);

    (adjacency[node] || new Set()).forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, cluster);
      }
    });
  };

  Object.keys(adjacency).forEach((node) => {
    if (!visited.has(node)) {
      const cluster = new Set<string>();
      dfs(node, cluster);

      const members = Array.from(cluster);
      const riskScores = members.map((member) => accountMap[member]?.riskScore || 0);
      const avgRisk = riskScores.reduce((left, right) => left + right, 0) / riskScores.length;

      clusters.push({
        id: `cluster_${clusterId++}`,
        members,
        size: members.length,
        cohesion: calculateCohesion(members, adjacency),
        riskLevel: avgRisk > 70 ? 'high' : avgRisk > 40 ? 'medium' : 'low'
      });
    }
  });

  return clusters;
};

const calculateCohesion = (members: string[], adjacency: Record<string, Set<string>>): number => {
  let internalEdges = 0;
  const possibleEdges = (members.length * (members.length - 1)) / 2;

  members.forEach((member) => {
    members.forEach((other) => {
      if (member !== other && adjacency[member]?.has(other)) {
        internalEdges++;
      }
    });
  });

  return possibleEdges > 0 ? (internalEdges / 2) / possibleEdges : 0;
};

const buildBehaviorProfiles = (accounts: ScoredAccount[], transactions: Transaction[]): Record<string, AccountBehaviorProfile> => {
  const profiles: Record<string, AccountBehaviorProfile> = {};
  accounts.forEach((account) => {
    profiles[account.AccountNumber] = {
      accountNumber: account.AccountNumber,
      averageAmount: 0,
      roundAmountRatio: 0,
      offHoursRatio: 0,
      counterparties: new Set<string>(),
      txCount: 0
    };
  });

  const amountSums: Record<string, number> = {};
  const roundCounts: Record<string, number> = {};
  const offHourCounts: Record<string, number> = {};

  transactions.forEach((transaction) => {
    const touchedAccounts = [transaction.SenderAccount, transaction.ReceiverAccount];
    touchedAccounts.forEach((accountNumber, index) => {
      const profile = profiles[accountNumber];
      if (!profile) {
        return;
      }

      const counterparty = touchedAccounts[index === 0 ? 1 : 0];
      profile.counterparties.add(counterparty);
      profile.txCount += 1;
      amountSums[accountNumber] = (amountSums[accountNumber] || 0) + (transaction.Amount || 0);

      const roundedAmount = Math.round(transaction.Amount || 0);
      if (roundedAmount > 0 && (roundedAmount % 1000 === 0 || roundedAmount % 5000 === 0)) {
        roundCounts[accountNumber] = (roundCounts[accountNumber] || 0) + 1;
      }

      const hour = new Date(transaction.Timestamp).getHours();
      if (hour < 6 || hour >= 23) {
        offHourCounts[accountNumber] = (offHourCounts[accountNumber] || 0) + 1;
      }
    });
  });

  Object.values(profiles).forEach((profile) => {
    const txCount = profile.txCount || 1;
    profile.averageAmount = amountSums[profile.accountNumber] ? amountSums[profile.accountNumber] / txCount : 0;
    profile.roundAmountRatio = clampRatio((roundCounts[profile.accountNumber] || 0) / txCount);
    profile.offHoursRatio = clampRatio((offHourCounts[profile.accountNumber] || 0) / txCount);
  });

  return profiles;
};

const similarityScore = (left: number, right: number): number => {
  const max = Math.max(left, right, 1);
  return clampRatio(1 - Math.abs(left - right) / max);
};

const detectHiddenLinks = (
  accounts: ScoredAccount[],
  transactions: Transaction[]
): HiddenLink[] => {
  const behaviorProfiles = buildBehaviorProfiles(accounts, transactions);
  const hiddenLinks: HiddenLink[] = [];

  for (let leftIndex = 0; leftIndex < accounts.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < accounts.length; rightIndex += 1) {
      const left = accounts[leftIndex];
      const right = accounts[rightIndex];
      const reasons: string[] = [];
      const signals: Array<'device' | 'ip' | 'behavior'> = [];
      let confidence = 0;

      if (left.DeviceID && right.DeviceID && left.DeviceID === right.DeviceID) {
        signals.push('device');
        confidence += 45;
        reasons.push(`Shared device fingerprint ${left.DeviceID}`);
      }

      if (left.IPAddress && right.IPAddress && left.IPAddress === right.IPAddress) {
        signals.push('ip');
        confidence += 35;
        reasons.push(`Shared IP address ${left.IPAddress}`);
      }

      const leftBehavior = behaviorProfiles[left.AccountNumber];
      const rightBehavior = behaviorProfiles[right.AccountNumber];
      const sharedCounterparties = [...leftBehavior.counterparties].filter((counterparty) => rightBehavior.counterparties.has(counterparty));
      const amountMatch = similarityScore(leftBehavior.averageAmount, rightBehavior.averageAmount);
      const offHoursMatch = similarityScore(leftBehavior.offHoursRatio, rightBehavior.offHoursRatio);
      const roundMatch = similarityScore(leftBehavior.roundAmountRatio, rightBehavior.roundAmountRatio);
      const riskMatch = similarityScore(left.riskScore, right.riskScore);

      let behaviorScore = 0;
      if (sharedCounterparties.length > 0) {
        behaviorScore += 15;
        reasons.push(`Shared counterparties: ${sharedCounterparties.slice(0, 3).join(', ')}`);
      }
      if (amountMatch >= 0.75) {
        behaviorScore += 10;
        reasons.push('Average transaction size pattern is closely aligned');
      }
      if (offHoursMatch >= 0.8 && (leftBehavior.offHoursRatio > 0.2 || rightBehavior.offHoursRatio > 0.2)) {
        behaviorScore += 8;
        reasons.push('Both accounts are active in the same off-hours window');
      }
      if (roundMatch >= 0.8 && (leftBehavior.roundAmountRatio > 0.25 || rightBehavior.roundAmountRatio > 0.25)) {
        behaviorScore += 7;
        reasons.push('Both accounts use similar rounded transfer values');
      }
      if (riskMatch >= 0.8 && left.riskScore >= 55 && right.riskScore >= 55) {
        behaviorScore += 5;
        reasons.push('Risk posture and cash-out behavior are closely matched');
      }

      if (behaviorScore >= 18) {
        signals.push('behavior');
        confidence += behaviorScore;
      }

      if (confidence >= 40 && signals.length > 0) {
        hiddenLinks.push({
          source: left.AccountNumber,
          target: right.AccountNumber,
          confidence: Math.min(99, confidence),
          signals,
          reasons
        });
      }
    }
  }

  return hiddenLinks.sort((left, right) => right.confidence - left.confidence);
};

const buildHiddenLinkClusters = (
  hiddenLinks: HiddenLink[],
  accountMap: Record<string, ScoredAccount>
): HiddenLinkCluster[] => {
  const adjacency = new Map<string, Set<string>>();

  hiddenLinks.forEach((link) => {
    const leftNeighbors = adjacency.get(link.source) || new Set<string>();
    leftNeighbors.add(link.target);
    adjacency.set(link.source, leftNeighbors);

    const rightNeighbors = adjacency.get(link.target) || new Set<string>();
    rightNeighbors.add(link.source);
    adjacency.set(link.target, rightNeighbors);
  });

  const visited = new Set<string>();
  const clusters: HiddenLinkCluster[] = [];
  let clusterIndex = 0;

  adjacency.forEach((_, accountNumber) => {
    if (visited.has(accountNumber)) {
      return;
    }

    const members: string[] = [];
    const stack = [accountNumber];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) {
        continue;
      }

      visited.add(current);
      members.push(current);
      (adjacency.get(current) || new Set<string>()).forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          stack.push(neighbor);
        }
      });
    }

    const clusterLinks = hiddenLinks.filter((link) => members.includes(link.source) && members.includes(link.target));
    const confidence = clusterLinks.length > 0
      ? Math.round(clusterLinks.reduce((sum, link) => sum + link.confidence, 0) / clusterLinks.length)
      : 0;
    const signalCounts = new Map<'device' | 'ip' | 'behavior', number>();
    const reasons = Array.from(new Set(clusterLinks.flatMap((link) => link.reasons))).slice(0, 4);
    clusterLinks.forEach((link) => {
      link.signals.forEach((signal) => {
        signalCounts.set(signal, (signalCounts.get(signal) || 0) + 1);
      });
    });

    const dominantSignals = Array.from(signalCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .map(([signal]) => signal)
      .slice(0, 3);

    const suspectedController = members
      .map((member) => accountMap[member])
      .filter((account): account is ScoredAccount => Boolean(account))
      .sort((left, right) => right.riskScore - left.riskScore)[0]?.AccountNumber || null;

    clusters.push({
      id: `hidden_link_cluster_${clusterIndex++}`,
      members,
      size: members.length,
      confidence,
      dominantSignals,
      reasons,
      suspectedController
    });
  });

  return clusters
    .filter((cluster) => cluster.size > 1)
    .sort((left, right) => right.confidence - left.confidence || right.size - left.size);
};

export const getTopInfluencers = (stats: NetworkStatistics, limit: number = 5) => {
  return Object.entries(stats.centralityMetrics)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([account, score]) => ({ account, score }));
};
