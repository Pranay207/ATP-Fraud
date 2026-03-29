import type { ScoredAccount } from './fraudDetection';
import type { Transaction } from '../services/dataService';

export interface SearchFilters {
  searchTerm: string;
  riskRange: [number, number];
  bankFilter: string[];
  locationFilter: string[];
  isMuleOnly: boolean;
  innocentOnly: boolean;
  dateRange: [Date | null, Date | null];
}

export const performSearch = (
  accounts: ScoredAccount[],
  _transactions: Transaction[],
  filters: Partial<SearchFilters>
): ScoredAccount[] => {
  try {
    if (!accounts || !Array.isArray(accounts)) return [];
    if (!filters || typeof filters !== 'object') filters = {};

    return accounts.filter(account => {
      try {
        if (!account) return false;

        // Search term - searches account number, holder name, email, mobile
        if (filters.searchTerm) {
          try {
            const term = String(filters.searchTerm).toLowerCase();
            if (!term) return true; // Empty search string matches all
            
            const matches =
              (account.AccountNumber && String(account.AccountNumber).toLowerCase().includes(term)) ||
              (account.AccountHolder && String(account.AccountHolder).toLowerCase().includes(term)) ||
              (account.EmailID && String(account.EmailID).toLowerCase().includes(term)) ||
              (account.Mobile && String(account.Mobile).toLowerCase().includes(term)) ||
              (account.IPAddress && String(account.IPAddress).includes(term));
            if (!matches) return false;
          } catch (err) {
            console.error('Search term filter error', err);
          }
        }

        // Risk range filter
        if (filters.riskRange && Array.isArray(filters.riskRange) && filters.riskRange.length === 2) {
          try {
            const [min, max] = filters.riskRange;
            const score = typeof account.riskScore === 'number' ? account.riskScore : 50;
            if (score < min || score > max) return false;
          } catch (err) {
            console.error('Risk range filter error', err);
          }
        }

        // Bank filter
        if (filters.bankFilter && Array.isArray(filters.bankFilter) && filters.bankFilter.length > 0) {
          if (!account.BankName || !filters.bankFilter.includes(account.BankName)) return false;
        }

        // Location filter
        if (filters.locationFilter && Array.isArray(filters.locationFilter) && filters.locationFilter.length > 0) {
          if (!account.Location || !filters.locationFilter.includes(account.Location)) return false;
        }

        // Mule filter
        if (filters.isMuleOnly && !account.isMule) return false;
        if (filters.innocentOnly && (typeof account.legitimacyScore !== 'number' || account.legitimacyScore < 70)) return false;

        // Date range - based on account creation
        if (filters.dateRange && Array.isArray(filters.dateRange) && (filters.dateRange[0] || filters.dateRange[1])) {
          try {
            const creationDate = new Date(account.CreationDate || '');
            if (isNaN(creationDate.getTime())) return true; // Invalid date passes filter
            
            if (filters.dateRange[0] && creationDate < filters.dateRange[0]) return false;
            if (filters.dateRange[1] && creationDate > filters.dateRange[1]) return false;
          } catch (err) {
            console.error('Date range filter error', err);
          }
        }

        return true;
      } catch (err) {
        console.error('Account filter error', err);
        return true; // Include account on error
      }
    });
  } catch (err) {
    console.error('Search failed', err);
    return accounts || [];
  }
};

export const getAvailableFilters = (accounts: ScoredAccount[]) => {
  const banks: string[] = [];
  const locations: string[] = [];
  let minDate = new Date();
  let maxDate = new Date();

  try {
    if (accounts && Array.isArray(accounts) && accounts.length > 0) {
      const bankSet = new Set<string>();
      const locationSet = new Set<string>();
      const dates: number[] = [];

      accounts.forEach(a => {
        try {
          if (a.BankName) bankSet.add(a.BankName);
          if (a.Location) locationSet.add(a.Location);
          if (a.CreationDate) {
            const d = new Date(a.CreationDate).getTime();
            if (!isNaN(d)) dates.push(d);
          }
        } catch (err) {
          console.error('Error processing account filter', err);
        }
      });

      banks.push(...Array.from(bankSet).sort());
      locations.push(...Array.from(locationSet).sort());

      if (dates.length > 0) {
        minDate = new Date(Math.min(...dates));
        maxDate = new Date(Math.max(...dates));
      }
    }
  } catch (err) {
    console.error('Error getting available filters', err);
  }

  return {
    banks,
    locations,
    dateRange: {
      min: minDate,
      max: maxDate
    }
  };
};

export const performAdvancedSearch = (
  accounts: ScoredAccount[],
  query: {
    linkedAccounts?: string;
    deviceId?: string;
    deviceFingerprint?: string;
  }
): ScoredAccount[] => {
  try {
    if (!accounts || !Array.isArray(accounts)) return [];
    if (!query || typeof query !== 'object') return [];

    const results: ScoredAccount[] = [];

    if (query.linkedAccounts) {
      const linkedAcct = String(query.linkedAccounts).trim();
      results.push(...accounts.filter(a => 
        a && (a.AccountNumber === linkedAcct || a.DeviceID === linkedAcct)
      ));
    }
    
    if (query.deviceId) {
      const deviceId = String(query.deviceId).trim();
      results.push(...accounts.filter(a => 
        a && a.DeviceID && a.DeviceID === deviceId
      ));
    }
    
    if (query.deviceFingerprint) {
      const fingerprint = String(query.deviceFingerprint).trim();
      results.push(...accounts.filter(a =>
        a && a.IPAddress && a.IPAddress === fingerprint
      ));
    }

    // Remove duplicates
    const uniqueMap = new Map<string, ScoredAccount>();
    results.forEach(a => {
      if (a && a.AccountNumber) {
        uniqueMap.set(a.AccountNumber, a);
      }
    });

    return Array.from(uniqueMap.values());
  } catch (err) {
    console.error('Advanced search error', err);
    return [];
  }
};
