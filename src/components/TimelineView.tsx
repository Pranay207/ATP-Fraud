import React, { useMemo } from 'react';
import { Clock, TrendingDown, TrendingUp } from 'lucide-react';
import type { Transaction } from '../services/dataService';
import type { ScoredAccount } from '../utils/fraudDetection';

interface TimelineViewProps {
  transactions: Transaction[];
  accounts: ScoredAccount[];
}

const TimelineView: React.FC<TimelineViewProps> = ({ transactions, accounts }) => {
  const accountMap = useMemo(() => {
    const map: Record<string, ScoredAccount> = {};
    accounts.forEach((account) => {
      map[account.AccountNumber] = account;
    });
    return map;
  }, [accounts]);

  const timeline = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    return [...transactions]
      .filter((transaction) => transaction && transaction.Timestamp)
      .sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime())
      .slice(0, 50);
  }, [transactions]);

  const timelineSummary = useMemo(() => {
    if (timeline.length === 0) {
      return {
        earliest: null,
        latest: null,
        highRiskCount: 0,
        largestTransfer: 0
      };
    }

    const orderedAsc = [...timeline].sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());
    const highRiskCount = timeline.filter((transaction) => {
      const senderRisk = accountMap[transaction.SenderAccount || '']?.riskScore ?? 0;
      const receiverRisk = accountMap[transaction.ReceiverAccount || '']?.riskScore ?? 0;
      return Math.max(senderRisk, receiverRisk) > 70;
    }).length;

    return {
      earliest: orderedAsc[0]?.Timestamp || null,
      latest: timeline[0]?.Timestamp || null,
      highRiskCount,
      largestTransfer: Math.max(...timeline.map((transaction) => transaction.Amount || 0))
    };
  }, [timeline, accountMap]);

  const getRiskColor = (score: number) => {
    if (score > 70) return '#ef4444';
    if (score > 40) return '#f59e0b';
    return '#10b981';
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.trim().toLowerCase();
    if (normalizedStatus === 'success' || normalizedStatus === 'successful') return 'var(--success)';
    if (normalizedStatus === 'failed' || normalizedStatus === 'failure') return 'var(--danger)';
    return 'var(--warning)';
  };

  return (
    <div className="card glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div className="section-kicker">Fund Movement Sequence</div>
          <h3 style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} color="var(--primary)" /> Investigative Timeline
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '760px' }}>
            Read this from top to bottom. Each event shows who sent funds, who received them, how much moved, and why the movement matters.
          </p>
        </div>
        <div className="info-box" style={{ minWidth: '260px', marginBottom: 0 }}>
          <strong>How to read it</strong>
          Red markers indicate highly suspicious movement, amber indicates review-worthy activity, and green indicates lower immediate concern.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="professional-card" style={{ padding: '1rem' }}>
          <div className="section-kicker">First Recorded Event</div>
          <strong>{timelineSummary.earliest ? new Date(timelineSummary.earliest).toLocaleString() : 'Not available'}</strong>
        </div>
        <div className="professional-card" style={{ padding: '1rem' }}>
          <div className="section-kicker">Latest Recorded Event</div>
          <strong>{timelineSummary.latest ? new Date(timelineSummary.latest).toLocaleString() : 'Not available'}</strong>
        </div>
        <div className="professional-card" style={{ padding: '1rem' }}>
          <div className="section-kicker">High-Risk Events</div>
          <strong>{timelineSummary.highRiskCount}</strong>
        </div>
        <div className="professional-card" style={{ padding: '1rem' }}>
          <div className="section-kicker">Largest Transfer</div>
          <strong>Rs. {timelineSummary.largestTransfer.toLocaleString('en-IN')}</strong>
        </div>
      </div>

      <div style={{ position: 'relative', paddingLeft: '2rem' }}>
        <div
          style={{
            position: 'absolute',
            left: '8px',
            top: 0,
            bottom: 0,
            width: '2px',
            background: 'linear-gradient(180deg, var(--primary) 0%, var(--danger) 100%)'
          }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {timeline.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
              No transactions found. Timeline will display here when transactions are available.
            </div>
          )}

          {timeline.map((transaction, index) => {
            const senderRisk = accountMap[transaction.SenderAccount || '']?.riskScore ?? 0;
            const receiverRisk = accountMap[transaction.ReceiverAccount || '']?.riskScore ?? 0;
            const maxRisk = Math.max(senderRisk, receiverRisk);
            const timestamp = transaction.Timestamp ? new Date(transaction.Timestamp).toLocaleString() : 'Unknown';
            const senderDisplay = transaction.SenderAccount ? transaction.SenderAccount.substring(0, 8) : 'Unknown';
            const receiverDisplay = transaction.ReceiverAccount ? transaction.ReceiverAccount.substring(0, 8) : 'Unknown';
            const narrative =
              maxRisk > 70
                ? 'This movement touches a high-risk account and should be reviewed for immediate freeze or escalation.'
                : maxRisk > 40
                  ? 'This event has moderate risk exposure and should be interpreted with linked transactions nearby.'
                  : 'This transfer appears lower risk in isolation but is retained to preserve the movement chain.';

            return (
              <div key={transaction.TxID} style={{ display: 'flex', gap: '1rem', position: 'relative', paddingLeft: '0.5rem' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '-1.5rem',
                    top: '1rem',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: getRiskColor(maxRisk),
                    border: '3px solid rgba(248, 250, 252, 1)',
                    boxShadow: `0 0 8px ${getRiskColor(maxRisk)}`
                  }}
                />

                <div className="professional-card" style={{ flex: 1, paddingTop: '1rem', paddingBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-warning">Event {timeline.length - index}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>{timestamp}</span>
                    </div>
                    {senderRisk > receiverRisk ? <TrendingDown size={14} color="var(--danger)" /> : <TrendingUp size={14} color="var(--warning)" />}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div className="section-kicker" style={{ marginBottom: '0.25rem' }}>Sender</div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{senderDisplay}...</div>
                      <div style={{ fontSize: '0.65rem', color: getRiskColor(senderRisk) }}>Risk score: {senderRisk.toFixed(0)}</div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                      <div className="section-kicker">Amount</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--primary)' }}>Rs. {(transaction.Amount || 0).toLocaleString('en-IN')}</div>
                    </div>

                    <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div className="section-kicker" style={{ marginBottom: '0.25rem' }}>Receiver</div>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-main)' }}>{receiverDisplay}...</div>
                      <div style={{ fontSize: '0.65rem', color: getRiskColor(receiverRisk) }}>Risk score: {receiverRisk.toFixed(0)}</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(220px, 1fr)', gap: '1rem', marginTop: '0.9rem' }}>
                    <div>
                      <div className="section-kicker">Investigator Note</div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.6, marginTop: '0.35rem' }}>{narrative}</p>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'grid', gap: '0.35rem' }}>
                      <div><strong>Transaction type:</strong> {transaction.Type || 'Transaction'}</div>
                      <div><strong>UTR:</strong> {transaction.UTR || 'N/A'}</div>
                      <div><strong>Status:</strong> <span style={{ color: getStatusColor(transaction.Status || '') }}>{transaction.Status || 'Pending'}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
