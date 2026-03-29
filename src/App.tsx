import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Clock, Database, GitBranch, History, LayoutDashboard, ShieldAlert, Zap } from 'lucide-react';
import { loadData } from './services/dataService';
import type { InvestigationData } from './services/dataService';
import { scoreAccounts } from './utils/fraudDetection';
import type { ScoredAccount } from './utils/fraudDetection';
import { auditTrail } from './utils/auditTrail';
import { notificationManager } from './utils/notificationManager';
import NotificationPanel from './components/NotificationPanel';
import { buildGraphData } from './utils/graphBuilder';
import { generateBankLetter, generateInnocentNotice } from './utils/bankLetter';
import policeLogo from './assets/anantapur-police-logo.svg';
import type { AutoFreezeSettings, FreezeRecord, FreezeSource } from './types/autoFreeze';
import type { ReviewDecision, ReviewFilter } from './components/InvestigationTree';

type AppTab = 'dashboard' | 'review' | 'timeline' | 'freeze' | 'patterns' | 'data' | 'audit';

const AUTO_FREEZE_SETTINGS_KEY = 'ftm-auto-freeze-settings';
const DEFAULT_AUTO_FREEZE_SETTINGS: AutoFreezeSettings = { enabled: true, threshold: 70 };

const AuditLogComponent = lazy(() => import('./components/AuditLog'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const TransactionGraph = lazy(() => import('./components/TransactionGraph'));
const FreezeManager = lazy(() => import('./components/FreezeManager'));
const SuspiciousPatternDetection = lazy(() => import('./components/SuspiciousPatternDetection'));
const NetworkStats = lazy(() => import('./components/NetworkStats'));
const TimelineView = lazy(() => import('./components/TimelineView'));
const DataManagement = lazy(() => import('./components/DataManagement'));
const BulkOperations = lazy(() => import('./components/BulkOperations'));
const VerifyModule = lazy(() => import('./components/VerifyModule'));
const SearchFilterComponent = lazy(() => import('./components/SearchFilter'));
const InvestigationTree = lazy(() => import('./components/InvestigationTree'));

const contentLoader = <div style={{ color: 'var(--text-muted)' }}>Loading module...</div>;
const reviewFilters: ReviewFilter[] = ['all', 'suspect', 'innocent', 'unreviewed'];

const loadAutoFreezeSettings = (): AutoFreezeSettings => {
  try {
    const raw = localStorage.getItem(AUTO_FREEZE_SETTINGS_KEY);
    if (!raw) return DEFAULT_AUTO_FREEZE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AutoFreezeSettings>;
    const threshold = Number(parsed.threshold);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT_AUTO_FREEZE_SETTINGS.enabled,
      threshold: Number.isFinite(threshold) ? Math.min(100, Math.max(40, Math.round(threshold))) : DEFAULT_AUTO_FREEZE_SETTINGS.threshold
    };
  } catch {
    return DEFAULT_AUTO_FREEZE_SETTINGS;
  }
};

const App = () => {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [frozenAccounts, setFrozenAccounts] = useState<Set<string>>(new Set());
  const [freezeHistory, setFreezeHistory] = useState<FreezeRecord[]>([]);
  const [autoFreezeSettings, setAutoFreezeSettings] = useState<AutoFreezeSettings>(() => loadAutoFreezeSettings());
  const [filteredAccounts, setFilteredAccounts] = useState<ScoredAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [treeRootId, setTreeRootId] = useState<string | null>(null);
  const [reviewDecisions, setReviewDecisions] = useState<Record<string, ReviewDecision | undefined>>({});
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [data, setData] = useState<{ accounts: ScoredAccount[]; transactions: InvestigationData['transactions']; caseInfo: InvestigationData['caseInfo'] }>({
    accounts: [],
    transactions: [],
    caseInfo: null
  });
  const frozenAccountsRef = useRef(frozenAccounts);

  useEffect(() => { frozenAccountsRef.current = frozenAccounts; }, [frozenAccounts]);
  useEffect(() => { localStorage.setItem(AUTO_FREEZE_SETTINGS_KEY, JSON.stringify(autoFreezeSettings)); }, [autoFreezeSettings]);

  const applyInvestigationData = useCallback((result: InvestigationData, options?: { toastTitle?: string; logLabel?: string }) => {
    const scored = scoreAccounts(result.accounts, result.transactions);
    const firstAccountId = scored[0]?.AccountNumber ?? null;
    const clearedFrozenAccounts = new Set<string>();
    frozenAccountsRef.current = clearedFrozenAccounts;
    setFrozenAccounts(clearedFrozenAccounts);
    setFreezeHistory([]);
    setReviewDecisions({});
    setReviewFilter('all');
    setSelectedAccounts(new Set());
    setFilteredAccounts(scored);
    setSelectedAccountId(firstAccountId);
    setTreeRootId(result.caseInfo?.VictimAccount || firstAccountId);
    setData({ accounts: scored, transactions: result.transactions, caseInfo: result.caseInfo });
    auditTrail.log('search', options?.logLabel || 'dataset_load', `Portal loaded with ${result.transactions.length} transactions`);
    notificationManager.add({ type: 'success', title: options?.toastTitle || 'Investigation Ready', message: `${scored.length} accounts ready for review` });
  }, []);

  const refreshPortal = useCallback(async (options?: { toastTitle?: string; logLabel?: string }) => {
    try {
      setLoading(true);
      applyInvestigationData(await loadData(), options);
    } catch (error) {
      notificationManager.add({ type: 'alert', title: 'Load Failed', message: error instanceof Error ? error.message : 'Failed to load dataset' });
    } finally {
      setLoading(false);
    }
  }, [applyInvestigationData]);

  useEffect(() => { void refreshPortal(); }, [refreshPortal]);

  const graphData = useMemo(() => buildGraphData(data.accounts, data.transactions), [data.accounts, data.transactions]);
  const reviewAccounts = useMemo(() => [...filteredAccounts].sort((a, b) => b.riskScore - a.riskScore), [filteredAccounts]);
  const selectedAccount = useMemo(() => data.accounts.find((account) => account.AccountNumber === selectedAccountId) ?? null, [data.accounts, selectedAccountId]);
  const reviewSummary = useMemo(() => {
    const values = Object.values(reviewDecisions);
    return {
      innocent: values.filter((value) => value === 'innocent').length,
      suspect: values.filter((value) => value === 'suspect').length,
      unreviewed: Math.max(0, data.accounts.length - values.filter(Boolean).length)
    };
  }, [data.accounts.length, reviewDecisions]);
  const protectedAmount = useMemo(() => data.accounts.reduce((sum, account) => frozenAccounts.has(account.AccountNumber) ? sum + (account.CurrentBalance || 0) : sum, 0), [data.accounts, frozenAccounts]);
  const autoFrozenCount = useMemo(() => freezeHistory.filter((record) => record.source === 'auto').length, [freezeHistory]);
  const allFilteredSelected = reviewAccounts.length > 0 && reviewAccounts.every((account) => selectedAccounts.has(account.AccountNumber));

  const setAccountDecision = useCallback((account: ScoredAccount, decision: ReviewDecision) => {
    setReviewDecisions((current) => ({ ...current, [account.AccountNumber]: decision }));
    setSelectedAccountId(account.AccountNumber);
  }, []);

  const freezeAccount = useCallback((account: ScoredAccount, options?: { source?: FreezeSource; silent?: boolean; reason?: string }): boolean => {
    if (frozenAccountsRef.current.has(account.AccountNumber)) return false;
    const nextFrozen = new Set(frozenAccountsRef.current);
    nextFrozen.add(account.AccountNumber);
    frozenAccountsRef.current = nextFrozen;
    setFrozenAccounts(nextFrozen);
    const source = options?.source || 'manual';
    const reason = options?.reason || (source === 'auto' ? `Risk score ${account.riskScore.toFixed(0)} crossed auto-freeze threshold ${autoFreezeSettings.threshold}` : `Officer initiated freeze for ${account.AccountHolder}`);
    setFreezeHistory((current) => [{
      accountNumber: account.AccountNumber,
      accountHolder: account.AccountHolder,
      bankName: account.BankName,
      source,
      riskScore: account.riskScore,
      balance: account.CurrentBalance || 0,
      frozenAt: new Date().toISOString(),
      reason
    }, ...current]);
    auditTrail.log('freeze', account.AccountNumber, `${source === 'auto' ? 'AUTO-FREEZE' : 'MANUAL FREEZE'}: ${account.AccountHolder} (${account.BankName}) at risk score ${account.riskScore.toFixed(0)}. ${reason}`);
    if (!options?.silent) {
      notificationManager.add({ type: source === 'auto' ? 'alert' : 'success', title: source === 'auto' ? 'Auto Freeze Triggered' : 'Account Frozen', message: `${account.AccountHolder} has been frozen and queued for bank action.` });
    }
    return true;
  }, [autoFreezeSettings.threshold]);

  const generateInnocentClearance = useCallback((account: ScoredAccount) => {
    void generateInnocentNotice(account, data.caseInfo);
    auditTrail.log('export', account.AccountNumber, `Innocent clearance notice generated for ${account.AccountHolder}`);
    notificationManager.add({ type: 'success', title: 'Clearance Notice Generated', message: `Clearance notice generated for ${account.AccountHolder}` });
  }, [data.caseInfo]);

  const markAccountInnocent = useCallback((account: ScoredAccount) => {
    setAccountDecision(account, 'innocent');
    auditTrail.log('verify', account.AccountNumber, `${account.AccountHolder} marked as innocent`);
    notificationManager.add({ type: 'success', title: 'Marked Innocent', message: `${account.AccountHolder} moved to cleared review.` });
  }, [setAccountDecision]);

  const markAccountSuspect = useCallback((account: ScoredAccount, options?: { generateLetter?: boolean }) => {
    setAccountDecision(account, 'suspect');
    auditTrail.log('freeze', account.AccountNumber, `${account.AccountHolder} marked as suspect`);
    if (options?.generateLetter !== false) void generateBankLetter(account, data.caseInfo);
    notificationManager.add({ type: 'alert', title: 'Marked Suspect', message: `${account.AccountHolder} flagged for escalation.` });
  }, [data.caseInfo, setAccountDecision]);

  useEffect(() => {
    if (!autoFreezeSettings.enabled || data.accounts.length === 0) return;
    const candidates = data.accounts.filter((account) => account.riskScore >= autoFreezeSettings.threshold && !frozenAccountsRef.current.has(account.AccountNumber));
    const newlyFrozen = candidates.filter((account) => freezeAccount(account, { source: 'auto', silent: true, reason: `Risk score ${account.riskScore.toFixed(0)} crossed threshold ${autoFreezeSettings.threshold}` }));
    if (newlyFrozen.length === 0) return;
    const protectedBalance = newlyFrozen.reduce((sum, account) => sum + (account.CurrentBalance || 0), 0);
    notificationManager.add({ type: 'alert', title: 'Auto Freeze Engine Activated', message: `${newlyFrozen.length} account(s) auto-frozen. Protected balance Rs. ${protectedBalance.toLocaleString('en-IN')}.` });
  }, [autoFreezeSettings.enabled, autoFreezeSettings.threshold, data.accounts, freezeAccount]);

  const toggleAccountSelection = useCallback((accountNumber: string) => {
    setSelectedAccounts((current) => {
      const next = new Set(current);
      if (next.has(accountNumber)) next.delete(accountNumber); else next.add(accountNumber);
      return next;
    });
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedAccounts((current) => {
      if (allFilteredSelected) return new Set([...current].filter((id) => !reviewAccounts.some((account) => account.AccountNumber === id)));
      const next = new Set(current);
      reviewAccounts.forEach((account) => next.add(account.AccountNumber));
      return next;
    });
  }, [allFilteredSelected, reviewAccounts]);

  const navItems: Array<{ id: AppTab; label: string; icon: ReactNode }> = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'review', label: 'Review Hub', icon: <GitBranch size={20} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={20} /> },
    { id: 'freeze', label: 'Freeze', icon: <AlertTriangle size={20} /> },
    { id: 'patterns', label: 'Patterns', icon: <Zap size={20} /> },
    { id: 'data', label: 'Data', icon: <Database size={20} /> },
    { id: 'audit', label: 'Audit', icon: <History size={20} /> }
  ];

  const reviewPanel = (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <SearchFilterComponent accounts={data.accounts} onFilterChange={setFilteredAccounts} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        <div className="professional-card"><div className="section-kicker">Visible</div><strong>{reviewAccounts.length}</strong></div>
        <div className="professional-card"><div className="section-kicker">Selected</div><strong>{selectedAccounts.size}</strong></div>
        <div className="professional-card"><div className="section-kicker">Suspect</div><strong style={{ color: 'var(--danger)' }}>{reviewSummary.suspect}</strong></div>
        <div className="professional-card"><div className="section-kicker">Innocent</div><strong style={{ color: 'var(--success)' }}>{reviewSummary.innocent}</strong></div>
      </div>
      <div className="card glass-panel" style={{ display: 'grid', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div><div className="section-kicker">Tree Review</div><strong>Progressive money trail view</strong></div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {reviewFilters.map((filter) => <button key={filter} className={`btn ${reviewFilter === filter ? 'btn-primary' : 'btn-outline'}`} onClick={() => setReviewFilter(filter)}>{filter}</button>)}
          </div>
        </div>
        <InvestigationTree accounts={data.accounts} transactions={data.transactions} caseInfo={data.caseInfo} rootAccountId={treeRootId} selectedAccountId={selectedAccountId} decisions={reviewDecisions} reviewFilter={reviewFilter} onSelectAccount={(account) => setSelectedAccountId(account.AccountNumber)} onSetRoot={setTreeRootId} />
      </div>
      <BulkOperations
        accounts={data.accounts}
        caseInfo={data.caseInfo}
        selectedAccounts={selectedAccounts}
        onVerify={(ids) => data.accounts.filter((account) => ids.includes(account.AccountNumber)).forEach(markAccountInnocent)}
        onFreeze={(ids) => data.accounts.filter((account) => ids.includes(account.AccountNumber)).forEach((account) => { setAccountDecision(account, 'suspect'); freezeAccount(account, { source: 'manual', reason: `Bulk containment triggered during review at risk ${account.riskScore.toFixed(0)}` }); })}
      />
      <div className="card glass-panel" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1rem 0.5rem', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div><div className="section-kicker">Work Queue</div><strong>Review visible accounts</strong></div>
          <button className="btn btn-outline" onClick={toggleSelectAllFiltered} disabled={reviewAccounts.length === 0}>{allFilteredSelected ? 'Clear Visible Selection' : 'Select Visible Accounts'}</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead><tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}><th style={{ padding: '0.75rem 1rem' }}>Select</th><th style={{ padding: '0.75rem 1rem' }}>Holder</th><th style={{ padding: '0.75rem 1rem' }}>Account</th><th style={{ padding: '0.75rem 1rem' }}>Risk</th><th style={{ padding: '0.75rem 1rem' }}>Decision</th><th style={{ padding: '0.75rem 1rem' }}>Actions</th></tr></thead>
          <tbody>
            {reviewAccounts.map((account) => (
              <tr key={account.AccountNumber} style={{ borderBottom: '1px solid rgba(148, 163, 184, 0.12)', background: selectedAccount?.AccountNumber === account.AccountNumber ? 'rgba(15, 118, 110, 0.04)' : 'transparent' }}>
                <td style={{ padding: '0.75rem 1rem' }}><input type="checkbox" checked={selectedAccounts.has(account.AccountNumber)} onChange={() => toggleAccountSelection(account.AccountNumber)} /></td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 600, cursor: 'pointer' }} onClick={() => setSelectedAccountId(account.AccountNumber)}>{account.AccountHolder}</td>
                <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{account.AccountNumber}</td>
                <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: account.riskScore >= 70 ? 'var(--danger)' : account.riskScore >= 40 ? 'var(--warning)' : 'var(--success)' }}>{account.riskScore.toFixed(0)}</td>
                <td style={{ padding: '0.75rem 1rem' }}><span className={`badge ${reviewDecisions[account.AccountNumber] === 'suspect' ? 'badge-danger' : reviewDecisions[account.AccountNumber] === 'innocent' ? 'badge-success' : 'badge-warning'}`}>{reviewDecisions[account.AccountNumber] || 'unreviewed'}</span></td>
                <td style={{ padding: '0.75rem 1rem' }}><div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}><button className="btn btn-outline btn-sm" onClick={() => markAccountInnocent(account)}>Innocent</button><button className="btn btn-outline btn-sm" onClick={() => markAccountSuspect(account, { generateLetter: false })}>Suspect</button><button className="btn btn-danger btn-sm" onClick={() => { setAccountDecision(account, 'suspect'); freezeAccount(account, { source: 'manual', reason: `Immediate freeze triggered from review queue at risk ${account.riskScore.toFixed(0)}` }); }}>Freeze</button></div></td>
              </tr>
            ))}
            {reviewAccounts.length === 0 && <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No accounts match the current filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <VerifyModule accounts={data.accounts} />
    </div>
  );

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <div className="portal-brand">
            <img src={policeLogo} alt="Anantapur Police logo" className="portal-logo" />
            <div><h1><ShieldAlert color="var(--danger)" /> FTM</h1><div className="portal-brand-subtitle">Investigation Tree Portal</div></div>
          </div>
        </div>
        <div className="sidebar-nav">{navItems.map((item) => <div key={item.id} className={`nav-item ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>{item.icon} {item.label}</div>)}</div>
      </nav>
      <main className="main-content">
        <header className="top-bar">
          <div className="official-header"><div className="official-title-block"><h2 style={{ fontSize: '1.4rem', margin: '0 0 0.25rem', fontWeight: '700' }}>Anantapur Cyber Fraud Intelligence System</h2></div></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginLeft: 'auto' }}>
            <div style={{ padding: '0.7rem 0.95rem', borderRadius: '999px', border: `1px solid ${autoFreezeSettings.enabled ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`, background: autoFreezeSettings.enabled ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.1)', color: autoFreezeSettings.enabled ? 'var(--danger)' : 'var(--warning)', display: 'grid', gap: '0.1rem', minWidth: '220px' }}>
              <strong style={{ fontSize: '0.82rem', lineHeight: 1.2 }}>{autoFreezeSettings.enabled ? 'Auto-Freeze Armed' : 'Auto-Freeze Paused'}</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Threshold {autoFreezeSettings.threshold} | Protected {`Rs. ${protectedAmount.toLocaleString('en-IN')}`}</span>
            </div>
            <NotificationPanel />
          </div>
        </header>
        <div className="content-area">
          {loading ? <div style={{ color: 'var(--text-muted)' }}>Loading investigation data...</div> : (
            activeTab === 'dashboard' ? <Suspense fallback={contentLoader}><div style={{ display: 'grid', gap: '1.25rem' }}><Dashboard caseInfo={data.caseInfo} accounts={data.accounts} frozenAccounts={frozenAccounts} autoFreezeSettings={autoFreezeSettings} autoFrozenCount={autoFrozenCount} /><TransactionGraph data={graphData} onNodeClick={(account) => setSelectedAccountId(account.AccountNumber)} onMarkInnocent={markAccountInnocent} onMarkSuspect={(account) => markAccountSuspect(account)} onFreeze={(account) => { setAccountDecision(account, 'suspect'); freezeAccount(account, { source: 'manual', reason: `Immediate freeze triggered from graph review at risk ${account.riskScore.toFixed(0)}` }); }} onGenerateInnocentNotice={generateInnocentClearance} frozenAccounts={frozenAccounts} /></div></Suspense>
            : activeTab === 'review' ? <Suspense fallback={contentLoader}>{reviewPanel}</Suspense>
            : activeTab === 'timeline' ? <Suspense fallback={contentLoader}><TimelineView transactions={data.transactions} accounts={data.accounts} /></Suspense>
            : activeTab === 'freeze' ? <Suspense fallback={contentLoader}><FreezeManager accounts={data.accounts} caseInfo={data.caseInfo} frozenAccounts={frozenAccounts} freezeHistory={freezeHistory} autoFreezeSettings={autoFreezeSettings} protectedAmount={protectedAmount} onFreezeAccount={freezeAccount} onAutoFreezeSettingsChange={setAutoFreezeSettings} onFreezeAllHighRisk={() => data.accounts.filter((account) => account.riskScore >= autoFreezeSettings.threshold).forEach((account) => { setAccountDecision(account, 'suspect'); freezeAccount(account, { source: 'manual', reason: `Bulk freeze on accounts at or above threshold ${autoFreezeSettings.threshold}` }); })} /></Suspense>
            : activeTab === 'patterns' ? <Suspense fallback={contentLoader}><div style={{ display: 'grid', gap: '1.25rem' }}><NetworkStats accounts={data.accounts} transactions={data.transactions} /><SuspiciousPatternDetection accounts={data.accounts} transactions={data.transactions} caseInfo={data.caseInfo} /></div></Suspense>
            : activeTab === 'data' ? <Suspense fallback={contentLoader}><DataManagement onDataImported={(dataset) => { applyInvestigationData(dataset, { toastTitle: 'Imported Investigation Ready', logLabel: 'dataset_import' }); setActiveTab('dashboard'); }} onResetToBundled={() => { void refreshPortal({ toastTitle: 'Bundled Dataset Ready', logLabel: 'bundled_dataset_restore' }); setActiveTab('dashboard'); }} /></Suspense>
            : <Suspense fallback={contentLoader}><AuditLogComponent /></Suspense>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
