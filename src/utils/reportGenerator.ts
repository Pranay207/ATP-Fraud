import type { jsPDF } from 'jspdf';
import type { ScoredAccount } from './fraudDetection';
import type { CaseInfo } from '../services/dataService';

export interface ReportOptions {
  format: 'pdf' | 'json' | 'csv' | 'excel';
  includeAnalysis: boolean;
  includeTimeline: boolean;
  includeNetwork: boolean;
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

export const generateReport = async (
  accounts: ScoredAccount[],
  caseInfo: CaseInfo | null,
  options: ReportOptions
): Promise<string | Blob> => {
  if (options.format === 'pdf') {
    return generatePDFReport(accounts, caseInfo);
  }
  if (options.format === 'json') {
    return JSON.stringify({ caseInfo, accounts, generatedAt: new Date() }, null, 2);
  }
  if (options.format === 'csv') {
    return generateCSVReport(accounts);
  }
  if (options.format === 'excel') {
    return generateExcelReport(accounts, caseInfo);
  }
  return '';
};

const generatePDFReport = async (accounts: ScoredAccount[], caseInfo: CaseInfo | null): Promise<Blob> => {
  const { doc, autoTable } = await loadPdfModules();
  const docWithTable = doc as jsPDF & {
    lastAutoTable?: {
      finalY: number;
    };
  };

  doc.setFontSize(18);
  doc.text('FRAUD INTELLIGENCE REPORT', 105, 15, { align: 'center' });

  if (caseInfo) {
    doc.setFontSize(10);
    doc.text(`Case ID: ${caseInfo.ComplaintID}`, 14, 30);
    doc.text(`Fraud Amount: Rs. ${caseInfo.FraudAmount.toLocaleString('en-IN')}`, 14, 37);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 44);
  }

  const highRisk = accounts.filter((account) => account.riskScore > 70);
  const tableData = highRisk.map((account) => [
    account.AccountNumber,
    account.BankName,
    `${account.riskScore}%`,
    `Rs. ${(account.CurrentBalance || 0).toLocaleString('en-IN')}`,
    account.isMule ? 'Confirmed' : 'Suspected'
  ]);

  autoTable(doc, {
    startY: 55,
    head: [['Account', 'Bank', 'Risk', 'Balance', 'Status']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [50, 50, 100] }
  });

  const finalY = (docWithTable.lastAutoTable?.finalY ?? 55) + 10;
  doc.text(`Total High-Risk Accounts: ${highRisk.length}`, 14, finalY);

  return doc.output('blob');
};

const generateCSVReport = (accounts: ScoredAccount[]): string => {
  const headers = ['AccountNumber', 'AccountHolder', 'BankName', 'RiskScore', 'LegitimacyScore', 'IsMule', 'CurrentBalance', 'Reasons'];
  const rows = accounts.map((account) => [
    account.AccountNumber,
    account.AccountHolder,
    account.BankName,
    account.riskScore,
    account.legitimacyScore,
    account.isMule ? 'Yes' : 'No',
    account.CurrentBalance,
    `"${account.reasons.join('; ')}"`
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
};

const generateExcelReport = (accounts: ScoredAccount[], caseInfo: CaseInfo | null): string => {
  const metadata = caseInfo
    ? `Case ID,${caseInfo.ComplaintID}\nFraud Amount,${caseInfo.FraudAmount}\nGenerated At,${new Date().toISOString()}\n\n`
    : '';
  return `${metadata}${generateCSVReport(accounts)}`;
};

export const downloadReport = (content: string | Blob, filename: string, format: string) => {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
