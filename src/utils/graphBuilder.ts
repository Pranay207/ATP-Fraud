import type { Transaction } from '../services/dataService';
import type { ScoredAccount } from './fraudDetection';

export interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  account: ScoredAccount;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  label: string;
  amount: number;
  transaction: Transaction;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export const buildGraphData = (accounts: ScoredAccount[], transactions: Transaction[]): GraphData => {
  if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
    return { nodes: [], links: [] };
  }

  const nodes = accounts
    .filter((account) => account && account.AccountNumber)
    .map((account) => {
      try {
        const balance = typeof account.CurrentBalance === 'number' && account.CurrentBalance > 0 ? account.CurrentBalance : 1;
        const nodeSize = Math.max(3, Math.min(10, Math.log10(Math.max(1, balance))));
        return {
          id: account.AccountNumber,
          name: account.AccountHolder || 'Unknown',
          val: nodeSize,
          color: account.isMule ? '#ef4444' : account.riskScore > 50 ? '#f59e0b' : account.legitimacyScore > 70 ? '#10b981' : '#3b82f6',
          account
        };
      } catch (error) {
        console.error('Node creation error', error);
        return {
          id: account.AccountNumber,
          name: account.AccountHolder || 'Unknown',
          val: 5,
          color: '#3b82f6',
          account
        };
      }
    });

  const links = transactions
    .filter((transaction) => transaction && transaction.SenderAccount && transaction.ReceiverAccount && typeof transaction.Amount === 'number')
    .map((transaction) => ({
      source: transaction.SenderAccount,
      target: transaction.ReceiverAccount,
      label: `Rs. ${(transaction.Amount || 0).toLocaleString('en-IN')}`,
      amount: transaction.Amount || 0,
      transaction
    }));

  return { nodes, links };
};
