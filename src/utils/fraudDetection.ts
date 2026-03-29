import type { Account, Transaction } from '../services/dataService';

export interface ScoredAccount extends Account {
  riskScore: number;
  legitimacyScore: number;
  isMule: boolean;
  reasons: string[];
}

const hasKeyword = (value: string | undefined, pattern: RegExp): boolean => pattern.test((value || '').toLowerCase());

export const scoreAccounts = (accounts: Account[], transactions: Transaction[]): ScoredAccount[] => {
  const transactionTimestamps = transactions
    .map((transaction) => new Date(transaction.Timestamp).getTime())
    .filter((timestamp) => !Number.isNaN(timestamp));
  const referenceTime = transactionTimestamps.length > 0
    ? Math.max(...transactionTimestamps)
    : Date.now();

  return accounts.map(acc => {
    let risk = 0;
    let legit = 50;
    const reasons: string[] = [];
    
    // 1. Account Age
    const creation = new Date(acc.CreationDate);
    const ageDays = (referenceTime - creation.getTime()) / (1000 * 3600 * 24);
    
    if (ageDays < 30) {
      risk += 35;
      legit -= 20;
      reasons.push("Newly created account (< 30 days)");
    } else {
      legit += 30;
    }

    // 2. Transaction Velocity & Pass-through Behavior
    const relatedTx = transactions.filter(t => t.ReceiverAccount === acc.AccountNumber || t.SenderAccount === acc.AccountNumber);
    const receivedTx = relatedTx.filter(t => t.ReceiverAccount === acc.AccountNumber);
    const sentTx = relatedTx.filter(t => t.SenderAccount === acc.AccountNumber);
    const totalExposure = relatedTx.reduce((sum, transaction) => sum + (transaction.Amount || 0), 0);
    const largestRelatedTx = relatedTx.reduce((max, transaction) => Math.max(max, transaction.Amount || 0), 0);
    const incomingCounterpartyCount = new Set(receivedTx.map((transaction) => transaction.SenderAccount)).size;
    const outgoingCounterpartyCount = new Set(sentTx.map((transaction) => transaction.ReceiverAccount)).size;
    const statusText = relatedTx.map((transaction) => transaction.Status || '').join(' | ');
    const typeText = relatedTx.map((transaction) => transaction.Type || '').join(' | ');
    const layerSpread = new Set(relatedTx.map((transaction) => transaction.Type || '').filter(Boolean)).size;

    if (receivedTx.length > 0 && sentTx.length > 0) {
      risk += 25;
      reasons.push("Rapid fund fragmentation (Acts as pass-through)");
    }

    // 3. Bank action trail indicators from the attached dataset
    if (hasKeyword(acc.AccountStatus, /restricted|actioned/) || hasKeyword(statusText, /frozen|freeze|held|hold|lien/)) {
      risk += 35;
      reasons.push("Bank action confirms hold/freeze/lien style intervention");
    }

    if (hasKeyword(statusText, /under investigation|investigation ongoing|processing|fraud|suspicious/)) {
      risk += 20;
      reasons.push("Bank response marks transaction as under investigation or suspicious");
    }

    if (hasKeyword(statusText, /\(yes\)/)) {
      risk += 15;
      reasons.push("Nodal confirmation received from bank action trail");
    }

    if (receivedTx.length >= 2 || incomingCounterpartyCount >= 2) {
      risk += 20;
      reasons.push("Multiple incoming disputed credits concentrated on the same endpoint");
    }

    if (layerSpread >= 2 || hasKeyword(typeText, /trail - l[123]/)) {
      risk += 10;
      reasons.push("Appears across layered trail categories used in the complaint flow");
    }

    if (largestRelatedTx >= 10000 || totalExposure >= 15000) {
      risk += 15;
      reasons.push("High disputed exposure amount in attached dataset");
    } else if (largestRelatedTx >= 5000 || totalExposure >= 7500) {
      risk += 10;
      reasons.push("Moderate disputed exposure requiring priority review");
    }

    // 4. Balance vs Withdrawal Patterns
    if (acc.CurrentBalance === 0 && acc.LastWithdrawalAmount > 10000) {
      risk += 30;
      reasons.push("High immediate withdrawal with zero current balance");
    }

    if (acc.CurrentBalance > 0 && hasKeyword(acc.AccountStatus, /restricted|actioned/)) {
      risk += 15;
      reasons.push("Disputed funds remain visible on an account already actioned by the bank");
    }

    if (outgoingCounterpartyCount >= 2) {
      risk += 10;
      reasons.push("Outflow disperses towards multiple counterparties");
    }

    // Determine Mule
    const isMule = risk >= 70;
    
    // Cap scores
    risk = Math.min(100, Math.max(0, risk));
    legit = Math.min(100, Math.max(0, legit));

    return {
      ...acc,
      riskScore: risk,
      legitimacyScore: legit,
      isMule,
      reasons
    };
  });
};
