import Papa from 'papaparse';
import { strFromU8, unzipSync } from 'fflate';

export interface Transaction {
  TxID: string;
  SenderAccount: string;
  ReceiverAccount: string;
  Amount: number;
  Timestamp: string;
  Type: string;
  UTR: string;
  Status: string;
}

export interface Account {
  AccountNumber: string;
  AccountHolder: string;
  Mobile: string;
  EmailID: string;
  KYCID: string;
  BankName: string;
  CreationDate: string;
  CurrentBalance: number;
  LastWithdrawalAmount: number;
  WithdrawalTimestamp: string;
  AccountStatus: string;
  IPAddress: string;
  DeviceID: string;
  Location: string;
  LoginTimestamp: string;
}

export interface CaseInfo {
  ComplaintID: string;
  VictimAccount: string;
  FraudAmount: number;
  FraudTimestamp: string;
  FraudType: string;
}

export interface InvestigationData {
  transactions: Transaction[];
  accounts: Account[];
  caseInfo: CaseInfo | null;
}

interface TrailRow extends Record<string, string> {
  __sheetName: string;
  __sourceFile: string;
}

interface CaseHints {
  complaintId?: string;
  evidenceLabel?: string;
}

const IMPORT_STORAGE_KEY = 'ftm-imported-investigation-data';

const parseCsvText = <T>(csvText: string): T[] => {
  const parsed = Papa.parse<T>(csvText, {
    header: true,
    dynamicTyping: false,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  return (parsed.data || []).filter(Boolean) as T[];
};

const normalizeKey = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const safeNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (!value) {
    return 0;
  }

  const normalized = String(value).replace(/[^0-9.-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDate = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  return parsed.toISOString();
};

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const buildIpAddress = (seed: string): string => {
  const hash = hashString(seed);
  return `10.${(hash >>> 16) % 255}.${(hash >>> 8) % 255}.${hash % 255}`;
};

const normalizeNumericLikeText = (value: string): string => {
  const scientificMatch = value.trim().match(/^([+-]?\d+(?:\.\d+)?)E([+-]?\d+)$/i);
  if (scientificMatch) {
    const mantissa = scientificMatch[1];
    const exponent = Number(scientificMatch[2]);
    const negative = mantissa.startsWith('-');
    const unsigned = mantissa.replace('-', '');
    const decimalIndex = unsigned.indexOf('.');
    const decimalPlaces = decimalIndex >= 0 ? unsigned.length - decimalIndex - 1 : 0;
    const digits = unsigned.replace('.', '');
    const scale = exponent - decimalPlaces;

    if (scale >= 0) {
      return `${negative ? '-' : ''}${digits}${'0'.repeat(scale)}`;
    }

    const insertIndex = digits.length + scale;
    if (insertIndex <= 0) {
      return `${negative ? '-' : ''}0.${'0'.repeat(Math.abs(insertIndex))}${digits}`;
    }

    return `${negative ? '-' : ''}${digits.slice(0, insertIndex)}.${digits.slice(insertIndex)}`;
  }

  return value.trim().replace(/\.0+$/, '');
};

const getField = (row: TrailRow, candidates: string[]): string => {
  const lookup = new Map<string, string>();
  Object.entries(row).forEach(([key, value]) => {
    lookup.set(normalizeKey(key), value);
  });

  for (const candidate of candidates) {
    const value = lookup.get(normalizeKey(candidate));
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return '';
};

const getPdfCaseHints = (fileName: string): CaseHints => {
  const complaintMatch = fileName.match(/\d{8,}/);
  return {
    complaintId: complaintMatch?.[0],
    evidenceLabel: fileName,
  };
};

const parseWorkbookSharedStrings = (sharedStringsXml: string): string[] => {
  const parser = new DOMParser();
  const document = parser.parseFromString(sharedStringsXml, 'application/xml');
  return Array.from(document.getElementsByTagName('si')).map((item) =>
    Array.from(item.getElementsByTagName('t')).map((part) => part.textContent || '').join(''),
  );
};

const parseWorkbookRows = (worksheetXml: string, sharedStrings: string[], sheetName: string, sourceFile: string): TrailRow[] => {
  const parser = new DOMParser();
  const document = parser.parseFromString(worksheetXml, 'application/xml');
  const rowNodes = Array.from(document.getElementsByTagName('row'));
  if (rowNodes.length === 0) {
    return [];
  }

  const readCellValue = (cell: Element): string => {
    const type = cell.getAttribute('t');
    const valueNode = cell.getElementsByTagName('v')[0];
    const inlineNode = cell.getElementsByTagName('t')[0];
    const rawValue = valueNode?.textContent || inlineNode?.textContent || '';

    if (type === 's') {
      const index = Number(rawValue);
      return sharedStrings[index] || '';
    }

    return normalizeNumericLikeText(rawValue);
  };

  const columnRef = (reference: string): string => reference.replace(/\d+/g, '');
  const headerRow = rowNodes[0];
  const headerMap = new Map<string, string>();

  Array.from(headerRow.getElementsByTagName('c')).forEach((cell) => {
    const reference = cell.getAttribute('r') || '';
    headerMap.set(columnRef(reference), readCellValue(cell));
  });

  return rowNodes.slice(1).map((rowNode) => {
    const row: TrailRow = {
      __sheetName: sheetName,
      __sourceFile: sourceFile,
    };

    Array.from(rowNode.getElementsByTagName('c')).forEach((cell) => {
      const reference = cell.getAttribute('r') || '';
      const header = headerMap.get(columnRef(reference));
      if (header) {
        row[header] = readCellValue(cell);
      }
    });

    return row;
  }).filter((row) => Object.keys(row).length > 2);
};

const parseWorkbook = async (file: File | Blob, sourceFile: string): Promise<TrailRow[]> => {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const archive = unzipSync(buffer);
  const workbookXml = archive['xl/workbook.xml'];
  const relsXml = archive['xl/_rels/workbook.xml.rels'];
  const sharedStringsXml = archive['xl/sharedStrings.xml'];

  if (!workbookXml || !relsXml) {
    throw new Error('Workbook structure is invalid');
  }

  const parser = new DOMParser();
  const workbookDoc = parser.parseFromString(strFromU8(workbookXml), 'application/xml');
  const relsDoc = parser.parseFromString(strFromU8(relsXml), 'application/xml');
  const relationshipMap = new Map<string, string>();

  Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((relationship) => {
    const id = relationship.getAttribute('Id');
    const target = relationship.getAttribute('Target');
    if (id && target) {
      relationshipMap.set(id, target);
    }
  });

  const sharedStrings = sharedStringsXml ? parseWorkbookSharedStrings(strFromU8(sharedStringsXml)) : [];
  const rows: TrailRow[] = [];

  Array.from(workbookDoc.getElementsByTagName('sheet')).forEach((sheet) => {
    const relationshipId = sheet.getAttribute('r:id') || sheet.getAttribute('id');
    const sheetName = sheet.getAttribute('name') || 'Sheet';
    const target = relationshipId ? relationshipMap.get(relationshipId) : null;
    if (!target) {
      return;
    }

    const worksheetPath = `xl/${target}`;
    const worksheetXml = archive[worksheetPath];
    if (!worksheetXml) {
      return;
    }

    rows.push(...parseWorkbookRows(strFromU8(worksheetXml), sharedStrings, sheetName, sourceFile));
  });

  return rows;
};

const parseCsvFile = async (file: File): Promise<TrailRow[]> => {
  const text = await file.text();
  const rows = parseCsvText<Record<string, string>>(text);
  const sheetName = file.name.replace(/\.[^.]+$/, '') || 'CSV Trail';
  return rows.map((row) => ({
    ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? '').trim()])),
    __sheetName: sheetName,
    __sourceFile: file.name,
  }));
};

const buildDerivedAccount = (
  accountNumber: string,
  role: 'origin' | 'beneficiary',
  bankName: string,
  location: string,
  deviceId: string,
  referenceDate: string,
  currentBalance: number,
  lastWithdrawalAmount: number,
  withdrawalTimestamp: string,
  status: string,
): Account => {
  const hash = hashString(`${role}-${accountNumber}-${bankName}-${deviceId}`);
  const baseDate = normalizeDate(referenceDate) || new Date('2026-03-01T00:00:00.000Z').toISOString();
  const creationDate = new Date(new Date(baseDate).getTime() - ((30 + (hash % 365)) * 24 * 60 * 60 * 1000)).toISOString();
  const loginTimestamp = new Date(new Date(baseDate).getTime() - ((hash % 12) * 60 * 60 * 1000)).toISOString();

  return {
    AccountNumber: accountNumber,
    AccountHolder: role === 'beneficiary' ? `Beneficiary ${accountNumber}` : `Origin ${accountNumber}`,
    Mobile: `9${String(hash % 1_000_000_000).padStart(9, '0')}`,
    EmailID: `${accountNumber.toLowerCase()}@trail.local`,
    KYCID: `TRAIL-${accountNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
    BankName: bankName || 'Unknown Bank',
    CreationDate: creationDate,
    CurrentBalance: Math.max(0, Number(currentBalance.toFixed(2))),
    LastWithdrawalAmount: Math.max(0, Number(lastWithdrawalAmount.toFixed(2))),
    WithdrawalTimestamp: withdrawalTimestamp,
    AccountStatus: status,
    IPAddress: buildIpAddress(accountNumber),
    DeviceID: deviceId,
    Location: location || 'Bank Action Trail',
    LoginTimestamp: loginTimestamp,
  };
};

const normalizeBankActionTrail = (rows: TrailRow[], caseHints?: CaseHints): InvestigationData => {
  const validRows = rows.map((row) => {
    const acknowledgement = getField(row, ['Acknowledgement No.']);
    const senderAccount = getField(row, ['Account No./Wallet/PG/PA Id', 'Account No./ (Wallet /PG/PA) Id']);
    const receiverAccount = getField(row, ['Account No', 'paccountno']);
    const transactionDate = getField(row, ['Transaction Date', 'Withdrawal Date & Time', 'Withdrawal Date', 'Date']);
    const dateOfAction = getField(row, ['Date of Action', 'Put on hold Date']);
    const amount = safeNumber(getField(row, ['Disputed Amount', 'Put on hold Amount', 'Withdrawal Amount'])) ||
      safeNumber(getField(row, ['Transaction Amount']));
    const bankName = getField(row, ['Bank/FIs']);
    const ifscCode = getField(row, ['IFSC Code', 'Ifsc Code', 'pifsc_code']);
    const layer = getField(row, ['Layer', 'players']) || row.__sheetName;
    const actionTaken = getField(row, ['Action Taken By Bank', 'Action Taken By bank']);
    const nodal = getField(row, ['PIS Nodal', 'pisnodal']);
    const utr = getField(row, ['Transaction Id / UTR Number', 'Transaction ID / UTR Number2', 'ptrans', 'Reference No']);

    return {
      row,
      acknowledgement,
      senderAccount,
      receiverAccount,
      timestamp: normalizeDate(transactionDate) || normalizeDate(dateOfAction),
      amount,
      bankName,
      ifscCode,
      layer,
      actionTaken,
      nodal,
      utr,
    };
  }).filter((item) => item.senderAccount && item.receiverAccount && item.timestamp && item.amount > 0);

  const transactions: Transaction[] = validRows.map((item, index) => ({
    TxID: item.acknowledgement || `TX-${index + 1}`,
    SenderAccount: item.senderAccount,
    ReceiverAccount: item.receiverAccount,
    Amount: item.amount,
    Timestamp: item.timestamp,
    Type: item.layer ? `Trail - ${item.layer}` : 'Trail Transaction',
    UTR: item.utr || item.acknowledgement || `REF-${index + 1}`,
    Status: item.nodal ? `${item.actionTaken || 'Pending'} (${item.nodal})` : (item.actionTaken || 'Pending'),
  }));

  const originStats = new Map<string, { bankName: string; location: string; referenceDate: string; lastWithdrawalAmount: number; withdrawalTimestamp: string; status: string; }>();
  const beneficiaryStats = new Map<string, { bankName: string; location: string; referenceDate: string; currentBalance: number; status: string; deviceId: string; }>();

  validRows.forEach((item) => {
    const beneficiaryStatus = /hold|freeze|lien/i.test(item.actionTaken)
      ? 'Restricted'
      : item.nodal.toUpperCase() === 'YES'
        ? 'Actioned'
        : 'Under Review';
    const originStatus = item.nodal.toUpperCase() === 'YES' ? 'Actioned' : 'Under Review';

    const currentOrigin = originStats.get(item.senderAccount);
    if (currentOrigin) {
      if (item.amount > currentOrigin.lastWithdrawalAmount) {
        currentOrigin.lastWithdrawalAmount = item.amount;
        currentOrigin.withdrawalTimestamp = item.timestamp;
      }
      if (item.timestamp > currentOrigin.referenceDate) {
        currentOrigin.referenceDate = item.timestamp;
      }
    } else {
      originStats.set(item.senderAccount, {
        bankName: item.bankName || 'Origin Network',
        location: item.layer,
        referenceDate: item.timestamp,
        lastWithdrawalAmount: item.amount,
        withdrawalTimestamp: item.timestamp,
        status: originStatus,
      });
    }

    const currentBeneficiary = beneficiaryStats.get(item.receiverAccount);
    if (currentBeneficiary) {
      currentBeneficiary.currentBalance += item.amount;
      if (item.timestamp > currentBeneficiary.referenceDate) {
        currentBeneficiary.referenceDate = item.timestamp;
      }
      if (beneficiaryStatus === 'Restricted') {
        currentBeneficiary.status = beneficiaryStatus;
      }
    } else {
      beneficiaryStats.set(item.receiverAccount, {
        bankName: item.bankName || 'Unknown Bank',
        location: item.layer,
        referenceDate: item.timestamp,
        currentBalance: item.amount,
        status: beneficiaryStatus,
        deviceId: item.ifscCode || `BEN-${item.receiverAccount}`,
      });
    }
  });

  const accounts: Account[] = [
    ...Array.from(originStats.entries()).map(([accountNumber, stat]) =>
      buildDerivedAccount(
        accountNumber,
        'origin',
        stat.bankName,
        stat.location,
        `SRC-${accountNumber}`,
        stat.referenceDate,
        0,
        stat.lastWithdrawalAmount,
        stat.withdrawalTimestamp,
        stat.status,
      ),
    ),
    ...Array.from(beneficiaryStats.entries()).map(([accountNumber, stat]) =>
      buildDerivedAccount(
        accountNumber,
        'beneficiary',
        stat.bankName,
        stat.location,
        stat.deviceId,
        stat.referenceDate,
        stat.currentBalance,
        0,
        '',
        stat.status,
      ),
    ),
  ];

  const fraudAmount = transactions.reduce((sum, transaction) => sum + transaction.Amount, 0);
  const timestamps = transactions.map((transaction) => new Date(transaction.Timestamp).getTime()).filter((value) => !Number.isNaN(value));
  const earliestTimestamp = timestamps.length > 0 ? new Date(Math.min(...timestamps)).toISOString() : new Date().toISOString();
  const distinctAcknowledgements = Array.from(new Set(validRows.map((item) => item.acknowledgement).filter(Boolean)));
  const distinctOrigins = Array.from(new Set(validRows.map((item) => item.senderAccount)));
  const sheetLabels = Array.from(new Set(validRows.map((item) => item.layer).filter(Boolean)));

  const caseInfo: CaseInfo | null = transactions.length > 0 ? {
    ComplaintID: caseHints?.complaintId || distinctAcknowledgements[0] || 'BANK-ACTION-TRAIL',
    VictimAccount: distinctOrigins.length === 1 ? distinctOrigins[0] : `Multiple impacted accounts (${distinctOrigins.length})`,
    FraudAmount: Number(fraudAmount.toFixed(2)),
    FraudTimestamp: earliestTimestamp,
    FraudType: `Bank action trail across ${sheetLabels.length} categories`,
  } : null;

  return { transactions, accounts, caseInfo };
};

const isInvestigationData = (value: unknown): value is InvestigationData => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as InvestigationData;
  return Array.isArray(candidate.accounts) && Array.isArray(candidate.transactions);
};

export const saveImportedData = (data: InvestigationData): void => {
  localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(data));
};

export const clearImportedData = (): void => {
  localStorage.removeItem(IMPORT_STORAGE_KEY);
};

const getStoredImportedData = (): InvestigationData | null => {
  try {
    const raw = localStorage.getItem(IMPORT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    return isInvestigationData(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const importInvestigationFiles = async (files: File[]): Promise<InvestigationData> => {
  const trailRows: TrailRow[] = [];
  let caseHints: CaseHints = {};

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xlsx')) {
      trailRows.push(...await parseWorkbook(file, file.name));
    } else if (lowerName.endsWith('.csv')) {
      trailRows.push(...await parseCsvFile(file));
    } else if (lowerName.endsWith('.pdf')) {
      caseHints = { ...caseHints, ...getPdfCaseHints(file.name) };
    }
  }

  if (trailRows.length === 0) {
    throw new Error('Upload at least one supported CSV or XLSX bank-action trail file');
  }

  const normalized = normalizeBankActionTrail(trailRows, caseHints);
  if (normalized.accounts.length === 0) {
    throw new Error('Could not derive portal data from the uploaded dataset');
  }

  return normalized;
};

const loadBundledDataset = async (): Promise<InvestigationData> => {
  const [xlsxResponse, csvResponse, pdfResponse] = await Promise.all([
    fetch('/data/bank_action_complete_trail.xlsx'),
    fetch('/data/bank_action_monthly_transfer.csv'),
    fetch('/data/case_document_20202260010111.pdf'),
  ]);

  const trailRows: TrailRow[] = [];
  const caseHints = pdfResponse.ok ? getPdfCaseHints('20202260010111.pdf') : {};

  if (xlsxResponse.ok) {
    const workbookBlob = await xlsxResponse.blob();
    trailRows.push(...await parseWorkbook(workbookBlob, 'bank_action_complete_trail.xlsx'));
  } else if (csvResponse.ok) {
    const csvText = await csvResponse.text();
    const rows = parseCsvText<Record<string, string>>(csvText);
    trailRows.push(...rows.map((row) => ({
      ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key.trim(), String(value ?? '').trim()])),
      __sheetName: 'Monthly Transfer to',
      __sourceFile: 'bank_action_monthly_transfer.csv',
    })));
  }

  if (trailRows.length === 0) {
    throw new Error('No bundled dataset files were found');
  }

  return normalizeBankActionTrail(trailRows, caseHints);
};

export const loadData = async (): Promise<InvestigationData> => {
  try {
    const stored = getStoredImportedData();
    if (stored) {
      return stored;
    }

    return await loadBundledDataset();
  } catch (error) {
    console.error('Data loading error:', error);
    throw error;
  }
};
