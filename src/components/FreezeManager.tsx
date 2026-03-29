import React from 'react';
import type { ScoredAccount } from '../utils/fraudDetection';
import type { CaseInfo } from '../services/dataService';
import { Download, ShieldAlert } from 'lucide-react';
import type { AutoFreezeSettings, FreezeRecord, FreezeSource } from '../types/autoFreeze';

interface FreezeManagerProps {
  accounts: ScoredAccount[];
  caseInfo: CaseInfo | null;
  frozenAccounts: Set<string>;
  freezeHistory: FreezeRecord[];
  autoFreezeSettings: AutoFreezeSettings;
  protectedAmount: number;
  onFreezeAccount: (account: ScoredAccount, options?: { source?: FreezeSource; silent?: boolean; reason?: string }) => boolean;
  onFreezeAllHighRisk: () => void;
  onAutoFreezeSettingsChange: (settings: AutoFreezeSettings) => void;
}

const loadPdfModules = async () => {
  const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable')
  ]);

  return {
    doc: new JsPdf(),
    autoTable
  };
};

const FreezeManager: React.FC<FreezeManagerProps> = ({
  accounts,
  caseInfo,
  frozenAccounts,
  freezeHistory,
  autoFreezeSettings,
  protectedAmount,
  onFreezeAccount,
  onFreezeAllHighRisk,
  onAutoFreezeSettingsChange
}) => {
  const highRisk = accounts
    .filter((account) => account.riskScore >= autoFreezeSettings.threshold)
    .sort((left, right) => right.CurrentBalance - left.CurrentBalance);
  const autoFrozenCount = freezeHistory.filter((record) => record.source === 'auto').length;
  const protectedCoverage = highRisk.length > 0
    ? Math.round((highRisk.filter((account) => frozenAccounts.has(account.AccountNumber)).length / highRisk.length) * 100)
    : 0;

  const generatePDF = async () => {
    if (!caseInfo) return;
    const { doc, autoTable } = await loadPdfModules();

    doc.setFontSize(16);
    doc.text('Anantapur Police Cyber Crime Cell', 105, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Emergency Account Freeze Request', 105, 22, { align: 'center' });

    doc.text(`Complaint ID: ${caseInfo.ComplaintID}`, 14, 35);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 42);
    doc.text(`Auto-freeze threshold: ${autoFreezeSettings.threshold}`, 14, 49);

    doc.text('To: The Nodal Officers (Respective Banks)', 14, 62);
    doc.text('Subject: Request to immediately freeze accounts involved in fraud chain.', 14, 69);

    doc.text('The following accounts have been identified in a suspected fraud money trail.', 14, 82);
    doc.text('You are instructed to freeze all associated debits immediately under Section 91 CrPC.', 14, 89);

    const tableData = highRisk.map((account) => [
      account.AccountNumber,
      account.BankName,
      account.AccountHolder,
      `Rs. ${(account.CurrentBalance || 0).toLocaleString('en-IN')}`,
      account.riskScore.toFixed(0),
      frozenAccounts.has(account.AccountNumber) ? 'Frozen' : 'Pending'
    ]);

    autoTable(doc, {
      startY: 97,
      head: [['Account Number', 'Bank', 'Account Holder', 'Traceable Balance', 'Risk', 'Status']],
      body: tableData
    });

    doc.save(`Freeze_Packet_${caseInfo.ComplaintID}.pdf`);
  };

  return (
    <div className="card glass-panel h-full" style={{ minHeight: '600px', display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <ShieldAlert className="text-danger" /> Real-Time Auto Freeze Engine
          </h2>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button className="btn btn-danger" onClick={onFreezeAllHighRisk} disabled={highRisk.length === 0}>
              Freeze All {'>='} {autoFreezeSettings.threshold}
            </button>
            <button className="btn btn-primary" onClick={() => void generatePDF()} disabled={!caseInfo}>
              <Download size={16} /> Generate Freeze Packet
            </button>
          </div>
        </div>

        <div className="info-box" style={{ marginBottom: 0 }}>
          <strong>Why this matters</strong>
          Money mule accounts drain balances in minutes. This engine locks high-risk accounts immediately when the score crosses the live threshold instead of waiting for manual review.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div className="professional-card" style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
              <div>
                <div className="section-kicker">Engine State</div>
                <strong>{autoFreezeSettings.enabled ? 'Armed for instant containment' : 'Paused for manual-only mode'}</strong>
              </div>
              <span className={`badge ${autoFreezeSettings.enabled ? 'badge-danger' : 'badge-warning'}`}>
                {autoFreezeSettings.enabled ? 'Armed' : 'Paused'}
              </span>
            </div>
            <label style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.65rem', textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <input
                type="checkbox"
                checked={autoFreezeSettings.enabled}
                onChange={(event) => onAutoFreezeSettingsChange({
                  ...autoFreezeSettings,
                  enabled: event.target.checked
                })}
              />
              Enable live auto-freeze when risk reaches the threshold
            </label>
          </div>

          <div className="professional-card" style={{ display: 'grid', gap: '0.7rem' }}>
            <div className="section-kicker">Threshold</div>
            <strong style={{ fontSize: '1.4rem', color: 'var(--danger)' }}>{autoFreezeSettings.threshold}</strong>
            <input
              type="range"
              min="40"
              max="100"
              step="1"
              value={autoFreezeSettings.threshold}
              onChange={(event) => onAutoFreezeSettingsChange({
                ...autoFreezeSettings,
                threshold: Number(event.target.value)
              })}
            />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Freeze as soon as any account reaches this score.
            </div>
          </div>

          <div className="professional-card" style={{ display: 'grid', gap: '0.35rem' }}>
            <div className="section-kicker">Protected Balance</div>
            <strong style={{ fontSize: '1.35rem', color: 'var(--success)' }}>
              Rs. {protectedAmount.toLocaleString('en-IN')}
            </strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {protectedCoverage}% of threshold-risk accounts contained
            </span>
          </div>

          <div className="professional-card" style={{ display: 'grid', gap: '0.35rem' }}>
            <div className="section-kicker">Auto Actions</div>
            <strong style={{ fontSize: '1.35rem', color: 'var(--danger)' }}>{autoFrozenCount}</strong>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {highRisk.length} accounts currently at or above threshold
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.9fr)', gap: '1rem' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.75rem', fontWeight: 500 }}>Account No</th>
                <th style={{ padding: '0.75rem', fontWeight: 500 }}>Holder</th>
                <th style={{ padding: '0.75rem', fontWeight: 500 }}>Bank</th>
                <th style={{ padding: '0.75rem', fontWeight: 500 }}>Risk</th>
                <th style={{ padding: '0.75rem', fontWeight: 500 }}>Balance</th>
                <th style={{ padding: '0.75rem', fontWeight: 500 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {highRisk.map((account) => (
                <tr key={account.AccountNumber} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '0.75rem' }}>{account.AccountNumber}</td>
                  <td style={{ padding: '0.75rem' }}>{account.AccountHolder}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>{account.BankName}</span>
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 700, color: account.riskScore >= 85 ? 'var(--danger)' : 'var(--warning)' }}>
                    {account.riskScore.toFixed(0)}
                  </td>
                  <td style={{ padding: '0.75rem', fontWeight: 'bold' }}>Rs. {(account.CurrentBalance || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '0.75rem' }}>
                    {frozenAccounts.has(account.AccountNumber) ? (
                      <span className="badge badge-success">Frozen</span>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onFreezeAccount(account, {
                          source: 'manual',
                          reason: `Manual freeze triggered from freeze queue at risk ${account.riskScore.toFixed(0)}`
                        })}
                      >
                        Immediate Freeze
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="professional-card" style={{ display: 'grid', gap: '0.9rem', alignContent: 'start' }}>
          <div>
            <div className="section-kicker">Freeze Ledger</div>
            <strong>Latest containment events</strong>
          </div>
          {freezeHistory.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.5 }}>
              No freeze events yet. Once the engine or an officer freezes an account, the action timeline will appear here.
            </div>
          ) : (
            freezeHistory.slice(0, 6).map((record) => (
              <div
                key={`${record.accountNumber}-${record.frozenAt}`}
                style={{
                  padding: '0.9rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  background: record.source === 'auto' ? 'rgba(239, 68, 68, 0.05)' : 'rgba(15, 118, 110, 0.06)',
                  display: 'grid',
                  gap: '0.3rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.92rem' }}>{record.accountHolder}</strong>
                  <span className={`badge ${record.source === 'auto' ? 'badge-danger' : 'badge-success'}`}>
                    {record.source === 'auto' ? 'Auto' : 'Manual'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                  {record.accountNumber} | {record.bankName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.45 }}>
                  {record.reason}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                  <span>Risk {record.riskScore.toFixed(0)}</span>
                  <span>{new Date(record.frozenAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default FreezeManager;
