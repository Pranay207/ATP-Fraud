import React, { useMemo, useState } from 'react';
import type { CaseInfo, Transaction } from '../services/dataService';
import type { ScoredAccount } from '../utils/fraudDetection';

export type ReviewDecision = 'innocent' | 'suspect';
export type ReviewFilter = 'all' | 'suspect' | 'innocent' | 'unreviewed';

interface InvestigationTreeProps {
  accounts: ScoredAccount[];
  transactions: Transaction[];
  caseInfo: CaseInfo | null;
  rootAccountId: string | null;
  selectedAccountId: string | null;
  decisions: Record<string, ReviewDecision | undefined>;
  reviewFilter: ReviewFilter;
  onSelectAccount: (account: ScoredAccount) => void;
  onSetRoot: (accountId: string) => void;
}

interface TreeNode {
  account: ScoredAccount;
  children: TreeNode[];
  isLeaf: boolean;
}

const getNodePalette = (decision: ReviewDecision | undefined, isLeaf: boolean) => {
  if (decision === 'innocent') {
    return { border: '#16a34a', background: 'rgba(22, 163, 74, 0.10)', text: '#166534', badge: 'INNOCENT' };
  }

  if (decision === 'suspect') {
    return { border: '#dc2626', background: 'rgba(220, 38, 38, 0.10)', text: '#991b1b', badge: 'SUSPECT' };
  }

  if (isLeaf) {
    return { border: '#2563eb', background: 'rgba(37, 99, 235, 0.08)', text: '#1d4ed8', badge: 'FINAL NODE' };
  }

  return { border: '#94a3b8', background: 'rgba(148, 163, 184, 0.08)', text: '#475569', badge: 'PATH NODE' };
};

const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN')}`;

const InvestigationTree: React.FC<InvestigationTreeProps> = ({
  accounts,
  transactions,
  caseInfo,
  rootAccountId,
  selectedAccountId,
  decisions,
  reviewFilter,
  onSelectAccount,
  onSetRoot
}) => {
  const [zoom, setZoom] = useState(1);
  const accountMap = useMemo(() => {
    const map = new Map<string, ScoredAccount>();
    accounts.forEach((account) => map.set(account.AccountNumber, account));
    return map;
  }, [accounts]);

  const outgoingMap = useMemo(() => {
    const map = new Map<string, string[]>();
    transactions.forEach((transaction) => {
      const current = map.get(transaction.SenderAccount) || [];
      if (!current.includes(transaction.ReceiverAccount)) {
        current.push(transaction.ReceiverAccount);
      }
      map.set(transaction.SenderAccount, current);
    });
    return map;
  }, [transactions]);

  const effectiveRootId = useMemo(() => {
    if (rootAccountId && accountMap.has(rootAccountId)) {
      return rootAccountId;
    }

    if (caseInfo?.VictimAccount && accountMap.has(caseInfo.VictimAccount)) {
      return caseInfo.VictimAccount;
    }

    return transactions[0]?.SenderAccount || accounts[0]?.AccountNumber || null;
  }, [accountMap, accounts, caseInfo, rootAccountId, transactions]);

  const tree = useMemo(() => {
    if (!effectiveRootId || !accountMap.has(effectiveRootId)) {
      return null as TreeNode | null;
    }

    const buildNode = (accountId: string, branchVisited: Set<string>): TreeNode | null => {
      const account = accountMap.get(accountId);
      if (!account) {
        return null;
      }

      const nextVisited = new Set(branchVisited);
      nextVisited.add(accountId);
      const childIds = (outgoingMap.get(accountId) || []).filter((childId) => !nextVisited.has(childId));
      const children = childIds
        .map((childId) => buildNode(childId, nextVisited))
        .filter((node): node is TreeNode => Boolean(node));

      return {
        account,
        children,
        isLeaf: children.length === 0
      };
    };

    return buildNode(effectiveRootId, new Set());
  }, [accountMap, effectiveRootId, outgoingMap]);

  const filteredTree = useMemo(() => {
    if (!tree) {
      return null as TreeNode | null;
    }

    const matchesFilter = (accountId: string) => {
      const decision = decisions[accountId];
      if (reviewFilter === 'all') return true;
      if (reviewFilter === 'suspect') return decision === 'suspect';
      if (reviewFilter === 'innocent') return decision === 'innocent';
      return !decision;
    };

    const filterNode = (node: TreeNode): TreeNode | null => {
      const nextChildren = node.children
        .map((child) => filterNode(child))
        .filter((child): child is TreeNode => Boolean(child));

      if (node.isLeaf) {
        return matchesFilter(node.account.AccountNumber) ? { ...node, children: [] } : null;
      }

      if (nextChildren.length > 0 || reviewFilter === 'all') {
        return { ...node, children: nextChildren, isLeaf: nextChildren.length === 0 };
      }

      return null;
    };

    return filterNode(tree);
  }, [decisions, reviewFilter, tree]);

  const revealTree = useMemo(() => {
    if (!filteredTree) {
      return null as TreeNode | null;
    }

    const isSubtreeReviewed = (node: TreeNode): boolean => {
      if (node.children.length === 0) {
        return Boolean(decisions[node.account.AccountNumber]);
      }

      return node.children.every((child) => isSubtreeReviewed(child));
    };

    const revealNode = (node: TreeNode): TreeNode => {
      if (node.children.length === 0) {
        return node;
      }

      const nextChildren: TreeNode[] = [];
      for (const child of node.children) {
        const revealedChild = revealNode(child);
        nextChildren.push(revealedChild);

        if (!isSubtreeReviewed(revealedChild)) {
          break;
        }
      }

      return {
        ...node,
        children: nextChildren,
        isLeaf: nextChildren.length === 0
      };
    };

    return revealNode(filteredTree);
  }, [decisions, filteredTree]);

  const summary = useMemo(() => {
    if (!revealTree) {
      return { nodes: 0, leaves: 0, depth: 0 };
    }

    const walk = (node: TreeNode, depth: number): { nodes: number; leaves: number; depth: number } => {
      if (!node.children.length) {
        return { nodes: 1, leaves: 1, depth };
      }

      return node.children.reduce((acc, child) => {
        const childStats = walk(child, depth + 1);
        return {
          nodes: acc.nodes + childStats.nodes,
          leaves: acc.leaves + childStats.leaves,
          depth: Math.max(acc.depth, childStats.depth)
        };
      }, { nodes: 1, leaves: 0, depth });
    };

    return walk(revealTree, 1);
  }, [revealTree]);

  const visibleTrees = useMemo(() => {
    if (!revealTree) {
      return [] as TreeNode[];
    }

    return revealTree.children.length > 0 ? revealTree.children : [revealTree];
  }, [revealTree]);

  const topLayerDepth = revealTree?.children.length ? 1 : 0;

  const renderNode = (node: TreeNode, depth = 0) => {
    const decision = decisions[node.account.AccountNumber];
    const palette = getNodePalette(decision, node.isLeaf);
    const isSelected = selectedAccountId === node.account.AccountNumber;
    const canStartHere = depth > 0;
    const exposureAmount = Math.max(node.account.CurrentBalance, node.account.LastWithdrawalAmount, 0);

    return (
      <div
        key={node.account.AccountNumber}
        className={`tree-node-shell ${node.children.length > 0 ? 'has-children' : ''}`}
      >
        <button
          type="button"
          onClick={() => onSelectAccount(node.account)}
          className={`tree-node-card ${isSelected ? 'selected' : ''}`}
          style={
            {
              '--tree-border': palette.border,
              '--tree-background': palette.background,
              '--tree-text': palette.text,
              '--tree-ring': `${palette.border}22`
            } as React.CSSProperties
          }
        >
          <div className="tree-node-head">
            <div className="tree-node-title-block">
              <div className="tree-node-name">{node.account.AccountHolder}</div>
              <div className="tree-node-bank">{node.account.BankName}</div>
            </div>
            <span className="tree-node-badge">{palette.badge}</span>
          </div>

          <div className="tree-node-account">{node.account.AccountNumber}</div>

          <div className="tree-node-metrics">
            <div>
              <span>Risk</span>
              <strong>{node.account.riskScore.toFixed(0)}</strong>
            </div>
            <div>
              <span>Exposure</span>
              <strong>{formatCurrency(exposureAmount)}</strong>
            </div>
          </div>

          <div className="tree-node-footer">
            <span className="tree-node-location">{node.account.Location}</span>
            {canStartHere && (
              <button
                type="button"
                className="tree-start-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  onSetRoot(node.account.AccountNumber);
                }}
              >
                Start Here
              </button>
            )}
          </div>
        </button>

        {node.children.length > 0 && (
          <>
            <div className="tree-parent-link" />
            <div className={`tree-children ${node.children.length === 1 ? 'single-child' : ''}`}>
              {node.children.map((child) => (
                <div key={child.account.AccountNumber} className="tree-branch">
                  <div className="tree-branch-link" />
                  {renderNode(child, depth + 1)}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  if (!revealTree) {
    return (
      <div className="card glass-panel">
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
          No final child nodes match the selected filter.
        </div>
      </div>
    );
  }

  return (
    <div className="card glass-panel">
      <div className="tree-header">
        <div>
          <div className="section-kicker">Visual Tree</div>
          <h3 style={{ margin: '0.25rem 0 0.35rem' }}>Investigation Flow Tree</h3>
          <div className="tree-subtitle">
            Click any visible node card to open the person details on the right. Finish one visible branch and the next branch will unlock automatically.
          </div>
        </div>
        <div className="tree-toolbar">
          <div className="tree-stat-chip">
            <div className="section-kicker">Depth</div>
            <strong>{summary.depth}</strong>
          </div>
          <div className="tree-stat-chip">
            <div className="section-kicker">Nodes</div>
            <strong>{summary.nodes}</strong>
          </div>
          <div className="tree-stat-chip">
            <div className="section-kicker">Final Nodes</div>
            <strong>{summary.leaves}</strong>
          </div>
          <div className="tree-zoom-box">
            <button className="tree-zoom-btn" onClick={() => setZoom((current) => Math.max(0.6, Number((current - 0.1).toFixed(2))))}>-</button>
            <strong>{Math.round(zoom * 100)}%</strong>
            <button className="tree-zoom-btn" onClick={() => setZoom((current) => Math.min(1.8, Number((current + 0.1).toFixed(2))))}>+</button>
          </div>
        </div>
      </div>

      <div className="tree-frame">
        <div className="tree-canvas" style={{ transform: `scale(${zoom})` }}>
          <div className="tree-root forest">
            {visibleTrees.map((node) => renderNode(node, topLayerDepth))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvestigationTree;
