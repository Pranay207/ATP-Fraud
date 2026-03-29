import React, { useState } from 'react';
import { Download, Copy, Trash2, CheckCheck, Users } from 'lucide-react';
import type { ScoredAccount } from '../utils/fraudDetection';
import type { CaseInfo } from '../services/dataService';
import type { ReportOptions } from '../utils/reportGenerator';
import { generateReport, downloadReport } from '../utils/reportGenerator';
import { auditTrail } from '../utils/auditTrail';
import { notificationManager } from '../utils/notificationManager';

interface BulkOperationsProps {
  accounts: ScoredAccount[];
  caseInfo: CaseInfo | null;
  selectedAccounts: Set<string>;
  onVerify: (accounts: string[]) => void;
  onFreeze: (accounts: string[]) => void;
}

const BulkOperations: React.FC<BulkOperationsProps> = ({
  accounts,
  caseInfo,
  selectedAccounts,
  onVerify,
  onFreeze
}) => {
  const [reportFormat, setReportFormat] = useState<ReportOptions['format']>('pdf');

  const handleBulkFreeze = () => {
    if (selectedAccounts.size === 0) {
      notificationManager.add({
        type: 'alert',
        title: 'No Selection',
        message: 'Please select accounts first'
      });
      return;
    }
    const accountsList = Array.from(selectedAccounts);
    onFreeze(accountsList);
    auditTrail.log('freeze', `${accountsList.length} accounts`, 'Bulk freeze initiated');
    notificationManager.add({
      type: 'success',
      title: 'Freeze Request Submitted',
      message: `${selectedAccounts.size} accounts queued for freezing`
    });
  };

  const handleBulkVerify = () => {
    if (selectedAccounts.size === 0) {
      notificationManager.add({
        type: 'alert',
        title: 'No Selection',
        message: 'Please select accounts first'
      });
      return;
    }
    const accountsList = Array.from(selectedAccounts);
    onVerify(accountsList);
    auditTrail.log('verify', `${accountsList.length} accounts`, 'Bulk verification initiated');
    notificationManager.add({
      type: 'success',
      title: 'Verification Submitted',
      message: `${selectedAccounts.size} accounts marked for verification`
    });
  };

  const handleExport = async () => {
    if (selectedAccounts.size === 0) {
      notificationManager.add({
        type: 'alert',
        title: 'No Selection',
        message: 'Please select accounts first'
      });
      return;
    }
    if (!accounts || accounts.length === 0) {
      notificationManager.add({
        type: 'alert',
        title: 'No Data',
        message: 'No accounts available to export'
      });
      return;
    }

    try {
      const selectedData = accounts.filter((account) => selectedAccounts.has(account.AccountNumber));
      if (selectedData.length === 0) {
        notificationManager.add({
          type: 'alert',
          title: 'No Selection',
          message: 'Selected accounts not found in data'
        });
        return;
      }

      const report = await generateReport(selectedData, caseInfo, {
        format: reportFormat,
        includeAnalysis: true,
        includeTimeline: true,
        includeNetwork: true
      });

      const fileExtension = reportFormat === 'excel' ? 'csv' : reportFormat;
      downloadReport(report, `fraud_report_${selectedAccounts.size}_accounts`, fileExtension);
      auditTrail.log('export', `${selectedAccounts.size} accounts`, `Data exported as ${reportFormat}`);
    } catch (error) {
      notificationManager.add({
        type: 'alert',
        title: 'Export Failed',
        message: 'Error during report generation'
      });
      auditTrail.log('export', `${selectedAccounts.size} accounts`, `Export failed: ${String(error).substring(0, 50)}`, 'failed');
    }
  };

  const handleCopyList = () => {
    if (selectedAccounts.size === 0) return;
    const list = Array.from(selectedAccounts).join('\n');
    navigator.clipboard.writeText(list).then(() => {
      notificationManager.add({
        type: 'info',
        title: 'Copied',
        message: `${selectedAccounts.size} account numbers copied to clipboard`
      });
    }).catch((error) => {
      console.error('Clipboard write failed', error);
      notificationManager.add({
        type: 'alert',
        title: 'Copy Failed',
        message: 'Could not copy to clipboard'
      });
    });
  };

  return (
    <div className="card glass-panel" style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="var(--primary)" /> Bulk Operations Panel
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Select accounts below to perform batch actions</p>
      </div>

      <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)', padding: '1.25rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.2rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              Selected Accounts
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--primary)', fontFamily: 'monospace' }}>
              {selectedAccounts.size}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>of {accounts.length} total</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              Selection Rate
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--warning)' }}>
              {accounts.length > 0 ? ((selectedAccounts.size / accounts.length) * 100).toFixed(0) : 0}%
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>accounts selected</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: '700', color: selectedAccounts.size > 0 ? 'var(--success)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
              Status
            </div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: selectedAccounts.size > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {selectedAccounts.size > 0 ? 'Ready' : 'Waiting'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>for bulk actions</div>
          </div>
        </div>
      </div>

      {selectedAccounts.size > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.8rem' }}>
            Bulk Actions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Export
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                <select
                  value={reportFormat}
                  onChange={(event) => setReportFormat(event.target.value as ReportOptions['format'])}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  <option value="pdf">PDF Report</option>
                  <option value="json">JSON Export</option>
                  <option value="csv">CSV Export</option>
                  <option value="excel">Excel-Friendly CSV</option>
                </select>
              </div>
              <button onClick={() => void handleExport()} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                <Download size={14} /> Export
              </button>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--success)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Verification
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Mark {selectedAccounts.size} {selectedAccounts.size === 1 ? 'account' : 'accounts'} as verified
              </p>
              <button onClick={handleBulkVerify} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', borderColor: 'var(--success)' }}>
                <CheckCheck size={14} /> Verify
              </button>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--danger)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                Account Freeze
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                Freeze {selectedAccounts.size} {selectedAccounts.size === 1 ? 'account' : 'accounts'} immediately
              </p>
              <button onClick={handleBulkFreeze} className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }}>
                <Trash2 size={14} /> Freeze Now
              </button>
            </div>
          </div>

          <button onClick={handleCopyList} className="btn btn-outline" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center', gap: '0.5rem' }}>
            <Copy size={14} /> Copy Account List ({selectedAccounts.size})
          </button>
        </div>
      )}

      {selectedAccounts.size === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', background: 'rgba(6, 182, 212, 0.03)', borderRadius: '6px', border: '1px dashed var(--border)' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.75rem', color: 'var(--primary)' }}>Selection Needed</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Select accounts above to perform bulk operations
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Use the table checkboxes or select all to batch freeze, verify, or export accounts
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkOperations;
