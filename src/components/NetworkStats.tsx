import React, { useMemo } from 'react';
import { Network, Users, Zap, Fingerprint, Router } from 'lucide-react';
import type { ScoredAccount } from '../utils/fraudDetection';
import type { Transaction } from '../services/dataService';
import { analyzeNetwork, getTopInfluencers } from '../utils/networkAnalysis';

interface NetworkStatsProps {
  accounts: ScoredAccount[];
  transactions: Transaction[];
}

const NetworkStats: React.FC<NetworkStatsProps> = ({ accounts, transactions }) => {
  const accountMap = useMemo(() => {
    const map = new Map<string, ScoredAccount>();
    accounts.forEach((account) => map.set(account.AccountNumber, account));
    return map;
  }, [accounts]);

  const stats = useMemo(() => {
    if (!accounts.length || !transactions.length) {
      return {
        totalNodes: 0,
        totalEdges: 0,
        averageNodeDegree: 0,
        densityScore: 0,
        clusters: [],
        centralityMetrics: {},
        hiddenLinks: [],
        hiddenLinkClusters: []
      };
    }

    return analyzeNetwork(accounts, transactions);
  }, [accounts, transactions]);

  const topInfluencers = useMemo(() => getTopInfluencers(stats, 5), [stats]);

  const insightSummary = useMemo(() => {
    const highRiskAccounts = accounts.filter((account) => account.riskScore > 70);
    const largestCluster = [...stats.clusters].sort((left, right) => right.size - left.size)[0];
    const topHiddenCluster = stats.hiddenLinkClusters[0];

    const reusedDevices = new Map<string, string[]>();
    const reusedIps = new Map<string, string[]>();
    accounts.forEach((account) => {
      if (account.DeviceID) {
        const devices = reusedDevices.get(account.DeviceID) || [];
        devices.push(account.AccountNumber);
        reusedDevices.set(account.DeviceID, devices);
      }

      if (account.IPAddress) {
        const ips = reusedIps.get(account.IPAddress) || [];
        ips.push(account.AccountNumber);
        reusedIps.set(account.IPAddress, ips);
      }
    });

    const topSharedDevices = [...reusedDevices.entries()]
      .filter(([, members]) => members.length > 1)
      .sort((left, right) => right[1].length - left[1].length)
      .slice(0, 3)
      .map(([deviceId, members]) => ({ deviceId, members }));

    const topSharedIps = [...reusedIps.entries()]
      .filter(([, members]) => members.length > 1)
      .sort((left, right) => right[1].length - left[1].length)
      .slice(0, 3)
      .map(([ipAddress, members]) => ({ ipAddress, members }));

    return {
      highRiskAccounts,
      largestCluster,
      topHiddenCluster,
      topSharedDevices,
      topSharedIps
    };
  }, [accounts, stats]);

  const ringAccounts = useMemo(() => {
    return new Set(stats.hiddenLinkClusters.flatMap((cluster) => cluster.members)).size;
  }, [stats.hiddenLinkClusters]);

  return (
    <div className="card glass-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <div className="section-kicker">Hidden Link Detection</div>
          <h3 style={{ marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Network size={18} color="var(--danger)" /> Same Fraudster, Multiple Accounts
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '760px' }}>
            This engine links accounts that may belong to the same controller using shared device fingerprints, shared IPs, and matching transaction behavior.
          </p>
        </div>
        <div className="info-box" style={{ minWidth: '280px', marginBottom: 0 }}>
          <strong>Operational reading</strong>
          Start with the strongest hidden-link cluster, then freeze the suspected controller and adjacent linked accounts before the ring shifts to fresh mule accounts.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hidden Clusters</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--danger)' }}>{stats.hiddenLinkClusters.length}</div>
        </div>
        <div style={{ background: 'rgba(15, 118, 110, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Linked Accounts</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--primary)' }}>{ringAccounts}</div>
        </div>
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Hidden Links</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--warning)' }}>{stats.hiddenLinks.length}</div>
        </div>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Top Ring Confidence</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--success)' }}>{insightSummary.topHiddenCluster?.confidence || 0}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.95fr)', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="professional-card">
          <div className="section-kicker">Command Summary</div>
          <h4 style={{ margin: '0.35rem 0 1rem' }}>What the link detector is showing</h4>
          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <div><strong>Strongest hidden ring:</strong> <span>{insightSummary.topHiddenCluster ? `${insightSummary.topHiddenCluster.size} linked accounts at ${insightSummary.topHiddenCluster.confidence}% confidence` : 'No same-controller ring detected yet'}</span></div>
            <div><strong>Likely controller:</strong> <span>{insightSummary.topHiddenCluster?.suspectedController || 'Not identified yet'}</span></div>
            <div><strong>Largest money-flow group:</strong> <span>{insightSummary.largestCluster ? `${insightSummary.largestCluster.size} accounts in one transaction cluster` : 'Not available'}</span></div>
            <div><strong>High-risk accounts:</strong> <span>{insightSummary.highRiskAccounts.length} accounts currently exceed the fraud threshold</span></div>
          </div>
        </div>

        <div className="professional-card">
          <div className="section-kicker">Primary Signals</div>
          <h4 style={{ margin: '0.35rem 0 1rem' }}>How the link was inferred</h4>
          <div style={{ display: 'grid', gap: '0.8rem' }}>
            {[
              { label: 'Device-linked', count: stats.hiddenLinks.filter((link) => link.signals.includes('device')).length, color: 'var(--danger)' },
              { label: 'IP-linked', count: stats.hiddenLinks.filter((link) => link.signals.includes('ip')).length, color: 'var(--warning)' },
              { label: 'Behavior-linked', count: stats.hiddenLinks.filter((link) => link.signals.includes('behavior')).length, color: 'var(--primary)' }
            ].map((signal) => (
              <div key={signal.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.3rem' }}>
                  <span>{signal.label}</span>
                  <strong>{signal.count}</strong>
                </div>
                <div className="meter-track">
                  <div className="meter-fill" style={{ width: `${stats.hiddenLinks.length > 0 ? (signal.count / stats.hiddenLinks.length) * 100 : 0}%`, background: signal.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Router size={16} color="var(--danger)" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Hidden Link Clusters</h4>
          <span className="badge badge-danger">{stats.hiddenLinkClusters.length}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '0.75rem' }}>
          {stats.hiddenLinkClusters.length > 0 ? (
            stats.hiddenLinkClusters.map((cluster) => (
              <div key={cluster.id} className="professional-card" style={{ borderColor: 'rgba(239, 68, 68, 0.28)' }}>
                <div className="section-kicker">{cluster.id}</div>
                <h4 style={{ margin: '0.35rem 0 0.65rem' }}>{cluster.size} linked accounts</h4>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'grid', gap: '0.35rem' }}>
                  <div>Confidence: <span style={{ color: 'var(--danger)', fontWeight: 700 }}>{cluster.confidence}%</span></div>
                  <div>Controller candidate: {cluster.suspectedController || 'Not ranked'}</div>
                  <div>Signals: {cluster.dominantSignals.join(', ') || 'general network match'}</div>
                  <div>Members: {cluster.members.slice(0, 4).join(', ')}{cluster.members.length > 4 ? '...' : ''}</div>
                </div>
                {cluster.reasons.length > 0 && (
                  <div style={{ marginTop: '0.8rem', display: 'grid', gap: '0.35rem' }}>
                    {cluster.reasons.map((reason) => (
                      <span key={reason} className="badge" style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--danger)', justifyContent: 'flex-start', whiteSpace: 'normal' }}>
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '1rem' }}>No hidden same-controller ring detected yet.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Fingerprint size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Shared Devices</h4>
            </div>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {insightSummary.topSharedDevices.length > 0 ? (
                insightSummary.topSharedDevices.map((device) => (
                  <div key={device.deviceId} className="professional-card" style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '0.3rem' }}>{device.deviceId}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Shared by {device.members.length} accounts: {device.members.slice(0, 4).join(', ')}{device.members.length > 4 ? '...' : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No shared-device pattern detected.</div>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Users size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Top Influencers</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topInfluencers.length > 0 ? (
                topInfluencers.map((influencer, index) => {
                  const account = accountMap.get(influencer.account);
                  return (
                    <div key={influencer.account} className="professional-card" style={{ padding: '0.9rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--primary)', minWidth: '20px' }}>#{index + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{influencer.account}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            {account?.AccountHolder || 'Unknown holder'} | Risk {account?.riskScore.toFixed(0) || '0'}
                          </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--primary)' }}>{((influencer.score || 0) * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '1rem' }}>No influencers detected.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Fingerprint size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Shared IP Addresses</h4>
            </div>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {insightSummary.topSharedIps.length > 0 ? (
                insightSummary.topSharedIps.map((ip) => (
                  <div key={ip.ipAddress} className="professional-card" style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '0.3rem' }}>{ip.ipAddress}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      Shared by {ip.members.length} accounts: {ip.members.slice(0, 4).join(', ')}{ip.members.length > 4 ? '...' : ''}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No shared-IP pattern detected.</div>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <Zap size={16} color="var(--primary)" />
              <h4 style={{ fontSize: '0.95rem', fontWeight: '600' }}>Strongest Hidden Links</h4>
            </div>
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {stats.hiddenLinks.length > 0 ? (
                stats.hiddenLinks.slice(0, 5).map((link) => (
                  <div key={`${link.source}-${link.target}`} className="professional-card" style={{ padding: '0.9rem 1rem' }}>
                    <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', marginBottom: '0.3rem' }}>{link.source} {'<->'} {link.target}</div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                      Confidence {link.confidence}% | Linked by {link.signals.join(', ')}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                      {link.reasons.slice(0, 2).map((reason) => (
                        <span key={reason} className="badge" style={{ background: 'rgba(15, 118, 110, 0.08)', color: 'var(--primary)' }}>
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No hidden pairwise links detected.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkStats;
