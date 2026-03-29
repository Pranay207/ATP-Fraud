import Papa from 'papaparse';
import type { ParseResult } from 'papaparse';

export interface ImportResult {
  success: boolean;
  rowsImported: number;
  errors: string[];
  data?: Record<string, unknown>[];
}

export const importCSV = (file: File): Promise<ImportResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: ParseResult<Record<string, unknown>>) => {
        const errors: string[] = [];

        if (!results.data || results.data.length === 0) {
          errors.push('No data found in file');
        }

        resolve({
          success: errors.length === 0,
          rowsImported: results.data?.length || 0,
          errors,
          data: results.data
        });
      },
      error: (error: Error) => {
        resolve({
          success: false,
          rowsImported: 0,
          errors: [`Parse error: ${error.message}`]
        });
      }
    });
  });
};

export const validateAccountsData = (data: Record<string, unknown>[]): {
  valid: boolean;
  errors: string[];
} => {
  const requiredFields = ['AccountNumber', 'AccountHolder', 'BankName', 'CurrentBalance'];
  const errors: string[] = [];

  data.forEach((row, index) => {
    requiredFields.forEach(field => {
      if (!row[field]) {
        errors.push(`Row ${index + 1}: Missing ${field}`);
      }
    });

    if (row.CurrentBalance && isNaN(Number(row.CurrentBalance))) {
      errors.push(`Row ${index + 1}: Invalid balance amount`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

export const validateTransactionsData = (data: Record<string, unknown>[]): {
  valid: boolean;
  errors: string[];
} => {
  const requiredFields = ['TxID', 'SenderAccount', 'ReceiverAccount', 'Amount', 'Timestamp'];
  const errors: string[] = [];

  data.forEach((row, index) => {
    requiredFields.forEach(field => {
      if (!row[field]) {
        errors.push(`Row ${index + 1}: Missing ${field}`);
      }
    });

    if (row.Amount && isNaN(Number(row.Amount))) {
      errors.push(`Row ${index + 1}: Invalid amount`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
};

export const downloadTemplate = (dataType: 'accounts' | 'transactions') => {
  const template = [
    ['S No.', 'Acknowledgement No.', 'Account No./Wallet/PG/PA Id', 'Transaction Id / UTR Number', 'Bank/FIs', 'Layer', 'Account No', 'IFSC Code', 'Transaction Date', 'Transaction ID / UTR Number2', 'Transaction Amount', 'Disputed Amount', 'Reference No', 'Remarks', 'Action Taken By Bank', 'Date of Action', 'PIS Nodal'],
    ['1', 'ACK2026001', 'WAL12345678', 'UTR9876543210', 'SBI', 'L1', '12345678901', 'SBIN0001234', '2026-03-01', 'UTR1122334455', '5000', '5000', 'REF001', 'Fraud suspected', 'Amount frozen', '2026-03-02', 'YES']
  ];

  const csv = template.map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bank_action_${dataType}_template.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
