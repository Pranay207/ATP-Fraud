export interface AuditLog {
  id: string;
  timestamp: Date;
  action: 'freeze' | 'verify' | 'export' | 'search' | 'upload' | 'alert';
  actor: string;
  target: string;
  details: string;
  status: 'success' | 'failed';
}

class AuditTrailManager {
  private logs: AuditLog[] = [];

  log(action: AuditLog['action'], target: string, details: string, status: 'success' | 'failed' = 'success') {
    const log: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      actor: 'Officer_System',
      target,
      details,
      status
    };
    this.logs.push(log);
    return log;
  }

  getLogs(filter?: { action?: AuditLog['action']; startDate?: Date; endDate?: Date }): AuditLog[] {
    return this.logs.filter(log => {
      if (filter?.action && log.action !== filter.action) return false;
      if (filter?.startDate && log.timestamp < filter.startDate) return false;
      if (filter?.endDate && log.timestamp > filter.endDate) return false;
      return true;
    });
  }

  exportLogs(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    }
    const csv = [
      ['Timestamp', 'Action', 'Target', 'Details', 'Status'].join(','),
      ...this.logs.map(log => 
        [
          log.timestamp.toISOString(),
          log.action,
          log.target,
          `"${log.details}"`,
          log.status
        ].join(',')
      )
    ].join('\n');
    return csv;
  }

  clearLogs() {
    this.logs = [];
  }
}

export const auditTrail = new AuditTrailManager();
