import React from 'react';
import type { ScoredAccount } from '../utils/fraudDetection';
import type { CaseInfo } from '../services/dataService';
import { IndianRupee, Link2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { AutoFreezeSettings } from '../types/autoFreeze';

const formatAmount = (amount: number): string => {
  if (amount >= 10000000) return `${(amount / 10000000).toFixed(0)} Cr`;
  if (amount >= 100000) return `${(amount / 100000).toFixed(0)} L`;
  return `${(amount / 1000).toFixed(0)}K`;
};

interface DashboardProps {
  caseInfo: CaseInfo | null;
  accounts: ScoredAccount[];
  frozenAccounts: Set<string>;
  autoFreezeSettings: AutoFreezeSettings;
  autoFrozenCount: number;
}

const Dashboard: React.FC<DashboardProps> = ({
  caseInfo,
  accounts,
  frozenAccounts,
  autoFreezeSettings,
  autoFrozenCount
}) => {
  const totalFraud = caseInfo?.FraudAmount || 0;
  const highRiskAccounts = accounts.filter((account) => account && account.riskScore >= autoFreezeSettings.threshold);
  const frozenTrackedAccounts = accounts.filter((account) => account && frozenAccounts.has(account.AccountNumber));
  const frozenAmount = frozenTrackedAccounts.reduce((sum, account) => sum + (account?.CurrentBalance || 0), 0);
  const recoveryPercent = totalFraud > 0 ? Math.min(100, Math.round((frozenAmount / totalFraud) * 100)) : 0;
  const muleAccounts = accounts.filter((account) => account && account.isMule);
  const armedCoverage = highRiskAccounts.length > 0
    ? Math.round((frozenTrackedAccounts.filter((account) => account.riskScore >= autoFreezeSettings.threshold).length / highRiskAccounts.length) * 100)
    : 0;

  if (!accounts || accounts.length === 0) {
    return (
      <div className="grid-dashboard">
        <div className="card glass-panel stat-card" style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No account data loaded. Import data from the Data Management tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-dashboard">
      <div className="card glass-panel stat-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ShieldAlert size={16} style={{ color: 'var(--danger)' }} /> Total Fraud Amount
          </div>
          <span style={{ fontSize: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
            CRITICAL
          </span>
        </div>
        <div className="stat-value cyber-value text-danger">{formatAmount(totalFraud)}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {accounts.length} impacted accounts
        </div>
      </div>

      <div className="card glass-panel stat-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <IndianRupee size={16} style={{ color: 'var(--success)' }} /> Protected Balance
          </div>
          <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
            LOCKED
          </span>
        </div>
        <div className="stat-value cyber-value text-success">{formatAmount(frozenAmount)}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {recoveryPercent}% recovery rate from frozen accounts
        </div>
      </div>

      <div className="card glass-panel stat-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ShieldCheck size={16} style={{ color: autoFreezeSettings.enabled ? 'var(--danger)' : 'var(--warning)' }} /> Auto Freeze Engine
          </div>
          <span style={{ fontSize: '0.7rem', background: autoFreezeSettings.enabled ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: autoFreezeSettings.enabled ? 'var(--danger)' : 'var(--warning)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
            {autoFreezeSettings.enabled ? 'ARMED' : 'PAUSED'}
          </span>
        </div>
        <div className="stat-value" style={{ color: autoFreezeSettings.enabled ? 'var(--danger)' : 'var(--warning)' }}>
          {autoFreezeSettings.threshold}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
          Threshold score | {autoFrozenCount} auto-frozen | {armedCoverage}% of risky accounts contained
        </div>
      </div>

      <div className="card glass-panel stat-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div className="stat-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Link2 size={16} style={{ color: 'var(--danger)' }} /> Accounts Over Threshold
          </div>
          <span style={{ fontSize: '0.7rem', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--warning)', padding: '0.25rem 0.5rem', borderRadius: '4px', fontWeight: '600' }}>
            LIVE RISK
          </span>
        </div>
        <div className="stat-value text-danger">{highRiskAccounts.length}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {muleAccounts.length} mule accounts detected in the network
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
