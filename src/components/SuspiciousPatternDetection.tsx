import React, { useEffect, useMemo } from 'react';
import { AlertTriangle, AlertCircle, Info, CheckCircle, Zap, Fingerprint, Network } from 'lucide-react';
import { detectSuspiciousPatterns } from '../utils/suspiciousPatterns';
import type { ScoredAccount } from '../utils/fraudDetection';
import type { CaseInfo, Transaction } from '../services/dataService';
import {
  buildCaseSignature,
  findSimilarHistoricalCases,
  storeObservedCaseSignature
} from '../utils/caseReuseDetection';
import type { SuspiciousPattern } from '../utils/suspiciousPatterns';

interface SuspiciousPatternDetectionProps {
  accounts: ScoredAccount[];
  transactions: Transaction[];
  caseInfo: CaseInfo | null;
}

const SuspiciousPatternDetection: React.FC<SuspiciousPatternDetectionProps> = ({
  accounts,
  transactions,
  caseInfo
}) => {
  const currentSignature = useMemo(
    () => buildCaseSignature(accounts, transactions, caseInfo),
    [accounts, transactions, caseInfo]
  );

  const caseMatches = useMemo(
    () => findSimilarHistoricalCases(currentSignature),
    [currentSignature]
  );

  useEffect(() => {
    if (accounts.length === 0 && transactions.length === 0) {
      return;
    }

    storeObservedCaseSignature(currentSignature);
  }, [accounts.length, currentSignature, transactions.length]);

  const patterns = useMemo(() => {
    const detectedPatterns = detectSuspiciousPatterns(accounts, transactions);
    if (caseMatches.length === 0) {
      return detectedPatterns;
    }

    const reusePattern: SuspiciousPattern = {
      id: 'fraud_pattern_reuse',
      name: 'Fraud Pattern Reuse Detected',
      description: `Current case matches ${caseMatches.length} prior fraud signature${caseMatches.length > 1 ? 's' : ''}, suggesting repeat gang behavior with only minor variations.`,
      severity: caseMatches[0].similarity >= 80 ? 'critical' : 'high',
      affectedAccounts: accounts
        .filter((account) => account.riskScore >= 70 || account.isMule)
        .map((account) => account.AccountNumber),
      affectedTransactions: transactions.slice(0, Math.min(transactions.length, 12)).map((transaction) => transaction.TxID),
      evidence: [
        `Top case match: ${caseMatches[0].caseSignature.label} (${caseMatches[0].similarity}% similarity)`,
        `Shared fraud markers: ${caseMatches[0].matchingSignals.join('; ')}`,
        `Current signature tags: ${currentSignature.tags.length > 0 ? currentSignature.tags.join(', ') : 'general fraud flow resemblance'}`
      ],
      confidence: caseMatches[0].gangConfidence,
      recommendation: 'Escalate as organized repeat fraud. Reuse the linked prior case intelligence, freeze lookalike accounts faster, and cross-check the same device, bank, and timing clusters.',
      relatedCases: caseMatches,
      signature: currentSignature
    };

    return [reusePattern, ...detectedPatterns];
  }, [accounts, caseMatches, currentSignature, transactions]);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical':
        return 'var(--danger)';
      case 'high':
        return '#ff9800';
      case 'medium':
        return '#2196f3';
      default:
        return 'var(--success)';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Zap size={20} />;
      case 'high':
        return <AlertTriangle size={20} />;
      case 'medium':
        return <AlertCircle size={20} />;
      default:
        return <Info size={20} />;
    }
  };

  if (patterns.length === 0) {
    return (
      <div className="card glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <CheckCircle color="var(--success)" size={32} style={{ marginBottom: '0.5rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          No suspicious patterns detected in the current dataset. The transaction network appears clean.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      <div>
        <div className="section-kicker">Pattern Analysis</div>
        <h2 style={{ fontSize: '1.3rem', marginBottom: '0.5rem' }}>
          Suspicious Pattern Detection ({patterns.length} detected)
        </h2>
      </div>

      <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card glass-panel stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Critical Patterns</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>{patterns.filter((pattern) => pattern.severity === 'critical').length}</div>
        </div>
        <div className="card glass-panel stat-card" style={{ borderLeft: '4px solid #ff9800' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>High Risk Patterns</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>{patterns.filter((pattern) => pattern.severity === 'high').length}</div>
        </div>
        <div className="card glass-panel stat-card" style={{ borderLeft: '4px solid #2196f3' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Affected Accounts</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>
            {new Set(patterns.flatMap((pattern) => pattern.affectedAccounts)).size}
          </div>
        </div>
        <div className="card glass-panel stat-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Historical Case Matches</div>
          <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>{caseMatches.length}</div>
        </div>
      </div>

      <div className="card glass-panel" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Fingerprint size={20} color="var(--danger)" />
          <div>
            <div className="section-kicker">Fraud Signature</div>
            <strong>{currentSignature.label}</strong>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem' }}>
          <div className="professional-card" style={{ display: 'grid', gap: '0.3rem' }}>
            <span className="section-kicker">Case Amount</span>
            <strong>Rs. {Math.round(currentSignature.totalAmount).toLocaleString('en-IN')}</strong>
          </div>
          <div className="professional-card" style={{ display: 'grid', gap: '0.3rem' }}>
            <span className="section-kicker">Transactions</span>
            <strong>{currentSignature.txCount}</strong>
          </div>
          <div className="professional-card" style={{ display: 'grid', gap: '0.3rem' }}>
            <span className="section-kicker">High-Risk Ratio</span>
            <strong>{Math.round(currentSignature.highRiskRatio * 100)}%</strong>
          </div>
          <div className="professional-card" style={{ display: 'grid', gap: '0.3rem' }}>
            <span className="section-kicker">Reuse Tags</span>
            <strong>{currentSignature.tags.length > 0 ? currentSignature.tags.length : 0}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {currentSignature.tags.length > 0 ? currentSignature.tags.map((tag) => (
            <span key={tag} className="badge" style={{ background: 'rgba(15, 118, 110, 0.12)', color: 'var(--primary)' }}>
              {tag.replace(/_/g, ' ')}
            </span>
          )) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              No strong signature tags yet. Load more cases to improve historical matching.
            </span>
          )}
        </div>
      </div>

      {caseMatches.length > 0 && (
        <div className="card glass-panel" style={{ display: 'grid', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Network size={20} color="var(--danger)" />
            <div>
              <div className="section-kicker">Pattern Reuse</div>
              <strong>Similar past cases detected</strong>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {caseMatches.map((match) => (
              <div
                key={match.caseSignature.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  gap: '1rem',
                  alignItems: 'start',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.05), rgba(255, 255, 255, 0.82))'
                }}
              >
                <div style={{ display: 'grid', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    <strong>{match.caseSignature.label}</strong>
                    <span className={`badge ${match.caseSignature.source === 'reference' ? 'badge-warning' : 'badge-success'}`}>
                      {match.caseSignature.source === 'reference' ? 'Reference Case' : 'Observed Case'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                    {match.caseSignature.complaintId} | {match.caseSignature.fraudType}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {match.matchingSignals.map((signal) => (
                      <span key={signal} className="badge" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)' }}>
                        {signal}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ minWidth: '140px', textAlign: 'right', display: 'grid', gap: '0.25rem' }}>
                  <strong style={{ fontSize: '1.2rem', color: 'var(--danger)' }}>{match.similarity}%</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Similarity</span>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--warning)' }}>{match.gangConfidence}%</strong>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Gang confidence</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {patterns.map((pattern) => (
          <div key={pattern.id} className="card glass-panel" style={{ borderLeft: `4px solid ${getSeverityColor(pattern.severity)}`, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ color: getSeverityColor(pattern.severity) }}>
                    {getSeverityIcon(pattern.severity)}
                  </div>
                  <h3 style={{ margin: '0', fontSize: '1.05rem', fontWeight: '600' }}>
                    {pattern.name}
                  </h3>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: getSeverityColor(pattern.severity),
                      color: '#fff',
                      textTransform: 'uppercase',
                      fontWeight: '600',
                      marginLeft: 'auto'
                    }}
                  >
                    {pattern.severity}
                  </div>
                </div>

                <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0', fontSize: '0.9rem' }}>
                  {pattern.description}
                </p>

                <div style={{ marginTop: '1rem ' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    Evidence
                  </div>
                  <ul style={{ margin: '0', paddingLeft: '1.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {pattern.evidence.map((evidenceLine, index) => (
                      <li key={index} style={{ marginBottom: '0.25rem' }}>
                        {evidenceLine}
                      </li>
                    ))}
                  </ul>
                </div>

                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255,152,0,0.1)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ff9800', marginBottom: '0.5rem' }}>
                    Recommendation
                  </div>
                  <p style={{ margin: '0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {pattern.recommendation}
                  </p>
                </div>

                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Affected Accounts
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {pattern.affectedAccounts.length}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Confidence Level
                    </div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                      <span style={{ color: getSeverityColor(pattern.severity) }}>
                        {pattern.confidence}%
                      </span>
                    </div>
                  </div>
                </div>

                {pattern.affectedAccounts.length > 0 && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Involved Accounts
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {pattern.affectedAccounts.slice(0, 10).map((accountNumber) => (
                        <div
                          key={accountNumber}
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: getSeverityColor(pattern.severity),
                            color: '#fff',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            fontFamily: 'monospace'
                          }}
                        >
                          {accountNumber}
                        </div>
                      ))}
                      {pattern.affectedAccounts.length > 10 && (
                        <div
                          style={{
                            padding: '0.35rem 0.75rem',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            color: 'var(--text-secondary)',
                            borderRadius: '4px',
                            fontSize: '0.8rem'
                          }}
                        >
                          +{pattern.affectedAccounts.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuspiciousPatternDetection;
