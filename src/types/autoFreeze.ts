export type FreezeSource = 'manual' | 'auto';

export interface AutoFreezeSettings {
  enabled: boolean;
  threshold: number;
}

export interface FreezeRecord {
  accountNumber: string;
  accountHolder: string;
  bankName: string;
  source: FreezeSource;
  riskScore: number;
  balance: number;
  frozenAt: string;
  reason: string;
}
