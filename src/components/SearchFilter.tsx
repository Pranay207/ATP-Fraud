import React, { useMemo, useState } from 'react';
import { Search, Filter, X } from 'lucide-react';
import type { ScoredAccount } from '../utils/fraudDetection';
import type { SearchFilters } from '../utils/searchFilter';
import { getAvailableFilters, performSearch } from '../utils/searchFilter';

interface SearchFilterComponentProps {
  accounts: ScoredAccount[];
  onFilterChange: (filtered: ScoredAccount[]) => void;
}

const defaultFilters: Partial<SearchFilters> = {
  searchTerm: '',
  riskRange: [0, 100],
  bankFilter: [],
  locationFilter: [],
  isMuleOnly: false,
  innocentOnly: false,
  dateRange: [null, null]
};

const SearchFilterComponent: React.FC<SearchFilterComponentProps> = ({ accounts, onFilterChange }) => {
  const [filters, setFilters] = useState<Partial<SearchFilters>>(defaultFilters);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const availableFilters = useMemo(() => getAvailableFilters(accounts), [accounts]);

  const hasActiveFilters =
    Boolean(filters.searchTerm?.trim()) ||
    (filters.bankFilter?.length ?? 0) > 0 ||
    (filters.locationFilter?.length ?? 0) > 0 ||
    Boolean(filters.isMuleOnly) ||
    Boolean(filters.innocentOnly) ||
    (filters.riskRange?.[0] ?? 0) !== 0 ||
    (filters.riskRange?.[1] ?? 100) !== 100;

  const applyFilters = (nextFilters: Partial<SearchFilters>) => {
    const results = performSearch(accounts, [], nextFilters);
    onFilterChange(results);
  };

  const updateFilters = (nextFilters: Partial<SearchFilters>) => {
    setFilters(nextFilters);
    applyFilters(nextFilters);
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    onFilterChange(accounts);
  };

  return (
    <div className="card glass-panel" style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Search size={20} color="var(--primary)" /> Advanced Search and Filters
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Find accounts using multiple criteria</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '250px', display: 'flex', alignItems: 'center', background: 'rgba(6, 182, 212, 0.1)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1.5px solid var(--border)' }}>
          <Search size={18} color="var(--primary)" style={{ marginRight: '0.5rem' }} />
          <input
            type="search"
            placeholder="Search by account, holder, email, mobile, or IP"
            value={filters.searchTerm || ''}
            onChange={(event) => updateFilters({ ...filters, searchTerm: event.target.value })}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', flex: 1, outline: 'none', fontSize: '0.875rem', width: '100%' }}
          />
        </div>
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={16} /> {showAdvanced ? 'Hide' : 'Show'} Filters
        </button>
        {hasActiveFilters && (
          <button onClick={resetFilters} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <X size={16} /> Clear All
          </button>
        )}
      </div>

      {showAdvanced && (
        <div style={{ borderTop: '1.5px solid var(--border)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label>Risk Score Range</label>
              <div style={{ background: 'rgba(6, 182, 212, 0.05)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--primary)' }}>{filters.riskRange?.[0]}% - {filters.riskRange?.[1]}%</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Min to Max</span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <input type="range" min="0" max="100" value={filters.riskRange?.[0] || 0} onChange={(event) => updateFilters({ ...filters, riskRange: [Number(event.target.value), filters.riskRange?.[1] || 100] })} style={{ flex: 1 }} />
                  <input type="range" min="0" max="100" value={filters.riskRange?.[1] || 100} onChange={(event) => updateFilters({ ...filters, riskRange: [filters.riskRange?.[0] || 0, Number(event.target.value)] })} style={{ flex: 1 }} />
                </div>
              </div>
            </div>

            <div>
              <label>Bank Filters ({filters.bankFilter?.length || 0} selected)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(6, 182, 212, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {availableFilters.banks.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No banks available</span> : availableFilters.banks.map((bank) => {
                  const selected = filters.bankFilter?.includes(bank) || false;
                  const next = selected ? (filters.bankFilter || []).filter((value) => value !== bank) : [...(filters.bankFilter || []), bank];
                  return (
                    <button key={bank} onClick={() => updateFilters({ ...filters, bankFilter: next })} style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: selected ? '1.5px solid var(--primary)' : '1px solid var(--border)', background: selected ? 'rgba(6, 182, 212, 0.2)' : 'transparent', color: selected ? 'var(--primary)' : 'var(--text-main)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500' }}>
                      {bank}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label>Location Filters ({filters.locationFilter?.length || 0} selected)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', background: 'rgba(6, 182, 212, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {availableFilters.locations.length === 0 ? <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No locations available</span> : availableFilters.locations.map((location) => {
                  const selected = filters.locationFilter?.includes(location) || false;
                  const next = selected ? (filters.locationFilter || []).filter((value) => value !== location) : [...(filters.locationFilter || []), location];
                  return (
                    <button key={location} onClick={() => updateFilters({ ...filters, locationFilter: next })} style={{ padding: '0.5rem 0.75rem', borderRadius: '4px', border: selected ? '1.5px solid var(--warning)' : '1px solid var(--border)', background: selected ? 'rgba(245, 158, 11, 0.2)' : 'transparent', color: selected ? 'var(--warning)' : 'var(--text-main)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500' }}>
                      {location}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1.5rem', padding: '1rem', background: 'rgba(6, 182, 212, 0.05)', borderRadius: '6px', border: '1px solid var(--border)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={filters.isMuleOnly || false} onChange={(event) => updateFilters({ ...filters, isMuleOnly: event.target.checked })} />
              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Mule Accounts Only</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
              <input type="checkbox" checked={filters.innocentOnly || false} onChange={(event) => updateFilters({ ...filters, innocentOnly: event.target.checked })} />
              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Verified Innocent</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchFilterComponent;
