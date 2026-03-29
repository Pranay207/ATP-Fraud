import React, { useState } from 'react';
import { History, Download, Trash2 } from 'lucide-react';
import type { AuditLog } from '../utils/auditTrail';
import { auditTrail } from '../utils/auditTrail';
import { notificationManager } from '../utils/notificationManager';

const AuditLogComponent: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>(() => auditTrail.getLogs());
  const [filter, setFilter] = useState<'all' | AuditLog['action']>('all');

  const refreshLogs = (nextFilter: 'all' | AuditLog['action'] = filter) => {
    const actionFilter = nextFilter === 'all' ? undefined : nextFilter;

    try {
      const nextLogs = auditTrail.getLogs(actionFilter ? { action: actionFilter } : undefined);
      setLogs(nextLogs || []);
    } catch (error) {
      console.error('Failed to refresh audit logs', error);
      if (nextFilter === 'all') {
        setLogs([]);
      }
    }
  };

  const handleRefresh = () => {
    refreshLogs();
  };

  const handleExport = () => {
    try {
      const csv = auditTrail.exportLogs('csv');
      if (!csv) {
        notificationManager.add({
          type: 'alert',
          title: 'Nothing to Export',
          message: 'No audit logs available'
        });
        return;
      }
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      notificationManager.add({
        type: 'success',
        title: 'Export Successful',
        message: `Exported ${logs.length} audit records`
      });
    } catch (error) {
      console.error('Export failed', error);
      notificationManager.add({
        type: 'alert',
        title: 'Export Failed',
        message: 'Error exporting audit logs'
      });
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) {
      try {
        auditTrail.clearLogs();
        setLogs([]);
        notificationManager.add({
          type: 'success',
          title: 'Cleared',
          message: 'All audit logs have been cleared'
        });
      } catch (error) {
        console.error('Clear failed', error);
        notificationManager.add({
          type: 'alert',
          title: 'Clear Failed',
          message: 'Error clearing audit logs'
        });
      }
    }
  };

  const getActionColor = (action: AuditLog['action']) => {
    switch (action) {
      case 'freeze':
        return 'var(--danger)';
      case 'verify':
        return 'var(--success)';
      case 'export':
        return 'var(--primary)';
      case 'search':
        return 'var(--warning)';
      default:
        return 'var(--primary)';
    }
  };

  const getStatusColor = (status: AuditLog['status']) => {
    return status === 'success' ? 'var(--success)' : 'var(--danger)';
  };

  return (
    <div className="card glass-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <History size={18} color="var(--primary)" /> Audit Trail
        </h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleRefresh} className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem' }}>
            Refresh
          </button>
          <button onClick={handleExport} className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Download size={12} /> Export
          </button>
          <button onClick={handleClear} className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.4rem 0.8rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', flexWrap: 'wrap' }}>
        {(['all', 'freeze', 'verify', 'export', 'search'] as const).map(action => (
          <button
            key={action}
            onClick={() => {
              setFilter(action);
              refreshLogs(action);
            }}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '4px',
              border: 'none',
              background: filter === action ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
              color: filter === action ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              transition: 'all 0.2s'
            }}
          >
            {action}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'rgba(255, 255, 255, 0.92)' }}>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Timestamp
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Action
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Target
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Details
              </th>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No audit logs
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid rgba(6, 182, 212, 0.1)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'N/A'}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '3px',
                        background: `${getActionColor(log.action)}20`,
                        color: getActionColor(log.action),
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        fontSize: '0.7rem'
                      }}
                    >
                      {log.action || 'unknown'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: 'var(--text-main)', fontSize: '0.85rem' }}>
                    {log.target && log.target.length > 16 ? log.target.substring(0, 16) + '...' : log.target || 'N/A'}
                  </td>
                  <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {log.details && log.details.length > 30 ? log.details.substring(0, 30) + '...' : log.details || ''}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ color: getStatusColor(log.status), fontWeight: '600', textTransform: 'uppercase', fontSize: '0.7rem' }}>
                      {log.status && log.status.toUpperCase && log.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Showing {logs.length} {filter === 'all' ? 'records' : `${filter} records`}
      </div>
    </div>
  );
};

export default AuditLogComponent;
