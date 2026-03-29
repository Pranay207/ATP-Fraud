import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods, LinkObject, NodeObject } from 'react-force-graph-2d';
import type { GraphData, GraphLink, GraphNode } from '../utils/graphBuilder';
import type { ScoredAccount } from '../utils/fraudDetection';

interface TransactionGraphProps {
  data: GraphData | null;
  onNodeClick: (node: GraphNode['account']) => void;
  onMarkInnocent?: (account: ScoredAccount) => void;
  onMarkSuspect?: (account: ScoredAccount) => void;
  onFreeze?: (account: ScoredAccount) => void;
  onGenerateInnocentNotice?: (account: ScoredAccount) => void;
  frozenAccounts?: Set<string>;
}

const TransactionGraph: React.FC<TransactionGraphProps> = ({
  data,
  onNodeClick,
  onMarkInnocent,
  onMarkSuspect,
  onFreeze,
  onGenerateInnocentNotice,
  frozenAccounts = new Set()
}) => {
  const fgRef = useRef<ForceGraphMethods<NodeObject<GraphNode>, LinkObject<GraphNode, GraphLink>> | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [markedDecisions, setMarkedDecisions] = useState<Record<string, 'innocent' | 'suspect'>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    }

    if (fgRef.current && data) {
      setTimeout(() => fgRef.current?.zoomToFit(400, 50), 500);
    }
  }, [data]);

  const connectedNodeIds = useMemo(() => {
    if (!data) return new Set<string>();

    const activeNodeId = hoveredNodeId ?? focusedNodeId;
    if (!activeNodeId) return new Set<string>();

    const connected = new Set<string>([activeNodeId]);
    data.links.forEach((link) => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (sourceId === activeNodeId) connected.add(targetId);
      if (targetId === activeNodeId) connected.add(sourceId);
    });

    return connected;
  }, [data, focusedNodeId, hoveredNodeId]);

  const activeNode = useMemo(() => {
    if (!data) return null;
    const activeNodeId = hoveredNodeId ?? focusedNodeId;
    return data.nodes.find((node) => node.id === activeNodeId) ?? null;
  }, [data, focusedNodeId, hoveredNodeId]);

  const handleNodeClick = useCallback((node: NodeObject<GraphNode>) => {
    setFocusedNodeId(node.id);
    onNodeClick(node.account);
    if (fgRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(6, 1500);
    }
  }, [onNodeClick]);

  if (!data) {
    return (
      <div className="card glass-panel" style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading Graph...
      </div>
    );
  }

  return (
    <div className="card glass-panel" ref={containerRef} style={{ padding: 0, overflow: 'hidden', height: '600px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10, width: '320px', background: 'rgba(255, 255, 255, 0.96)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(148, 163, 184, 0.16)', backdropFilter: 'blur(8px)', maxHeight: '570px', overflowY: 'auto' }}>
        {activeNode ? (
          <>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
              Account Details
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', fontWeight: 600 }}>{activeNode.account.AccountHolder}</h4>
              {markedDecisions[activeNode.account.AccountNumber] === 'innocent' && (
                <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Innocent
                </span>
              )}
              {markedDecisions[activeNode.account.AccountNumber] === 'suspect' && (
                <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Suspect
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Bank</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{activeNode.account.BankName}</div>
              </div>

              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Account Number</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{activeNode.account.AccountNumber}</div>
              </div>

              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Phone</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{activeNode.account.Mobile || 'Not available'}</div>
              </div>

              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Email</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 500, wordBreak: 'break-all' }}>{activeNode.account.EmailID || 'Not available'}</div>
              </div>

              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Current Balance</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>Rs. {(activeNode.account.CurrentBalance || 0).toLocaleString('en-IN')}</div>
              </div>

              <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Risk Score</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: activeNode.account.riskScore > 70 ? 'var(--danger)' : activeNode.account.riskScore > 50 ? 'var(--warning)' : 'var(--text-main)' }}>
                  {activeNode.account.riskScore.toFixed(0)}/100
                </div>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Status</div>
                <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>{activeNode.account.AccountStatus || 'Unreviewed'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {onMarkInnocent && (
                <button
                  onClick={() => {
                    onMarkInnocent(activeNode.account);
                    setMarkedDecisions((current) => ({ ...current, [activeNode.account.AccountNumber]: 'innocent' }));
                  }}
                  disabled={markedDecisions[activeNode.account.AccountNumber] !== undefined}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#10b981',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: markedDecisions[activeNode.account.AccountNumber] !== undefined ? 'not-allowed' : 'pointer',
                    opacity: markedDecisions[activeNode.account.AccountNumber] !== undefined ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(event) => {
                    if (markedDecisions[activeNode.account.AccountNumber] === undefined) event.currentTarget.style.background = '#059669';
                  }}
                  onMouseLeave={(event) => {
                    if (markedDecisions[activeNode.account.AccountNumber] === undefined) event.currentTarget.style.background = '#10b981';
                  }}
                >
                  {markedDecisions[activeNode.account.AccountNumber] === 'innocent' ? 'Marked Innocent' : 'Mark Innocent'}
                </button>
              )}
              {onMarkSuspect && (
                <button
                  onClick={() => {
                    onMarkSuspect(activeNode.account);
                    setMarkedDecisions((current) => ({ ...current, [activeNode.account.AccountNumber]: 'suspect' }));
                  }}
                  disabled={markedDecisions[activeNode.account.AccountNumber] !== undefined}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#ef4444',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: markedDecisions[activeNode.account.AccountNumber] !== undefined ? 'not-allowed' : 'pointer',
                    opacity: markedDecisions[activeNode.account.AccountNumber] !== undefined ? 0.6 : 1,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(event) => {
                    if (markedDecisions[activeNode.account.AccountNumber] === undefined) event.currentTarget.style.background = '#dc2626';
                  }}
                  onMouseLeave={(event) => {
                    if (markedDecisions[activeNode.account.AccountNumber] === undefined) event.currentTarget.style.background = '#ef4444';
                  }}
                >
                  {markedDecisions[activeNode.account.AccountNumber] === 'suspect' ? 'Marked Suspect' : 'Mark Suspect'}
                </button>
              )}
              {frozenAccounts.has(activeNode.account.AccountNumber) && (
                <div style={{ padding: '0.65rem 1rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>
                  Account Frozen
                </div>
              )}
              {onFreeze && !frozenAccounts.has(activeNode.account.AccountNumber) && (
                <button
                  onClick={() => onFreeze(activeNode.account)}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '6px',
                    border: '2px solid #ef4444',
                    background: 'white',
                    color: '#ef4444',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
                  onMouseLeave={(event) => { event.currentTarget.style.background = 'white'; }}
                >
                  Freeze Bank Account
                </button>
              )}
              {onGenerateInnocentNotice && markedDecisions[activeNode.account.AccountNumber] === 'innocent' && (
                <button
                  onClick={() => onGenerateInnocentNotice(activeNode.account)}
                  style={{
                    padding: '0.65rem 1rem',
                    borderRadius: '6px',
                    border: '2px solid #10b981',
                    background: 'white',
                    color: '#10b981',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(event) => { event.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'; }}
                  onMouseLeave={(event) => { event.currentTarget.style.background = 'white'; }}
                >
                  Generate Clearance Notice
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', paddingTop: '2rem' }}>
            Click on a node to see account details
          </div>
        )}
      </div>

      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeRelSize={6}
        nodeVal="val"
        nodeLabel={(node) => `${node.account.AccountHolder} (${node.account.AccountNumber})`}
        linkLabel={(link) => `${link.transaction.SenderAccount} -> ${link.transaction.ReceiverAccount}: ${link.label}`}
        linkColor={(link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          if (connectedNodeIds.size > 0 && connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
            return 'rgba(15, 118, 110, 0.55)';
          }
          return 'rgba(148, 163, 184, 0.25)';
        }}
        linkWidth={(link) => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          return connectedNodeIds.size > 0 && connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId) ? 2.5 : 1;
        }}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={0}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={2}
        nodeCanvasObject={(node: NodeObject<GraphNode>, ctx: CanvasRenderingContext2D) => {
          if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
          const isActive = node.id === hoveredNodeId || node.id === focusedNodeId;
          const isConnected = connectedNodeIds.has(node.id);
          const isReviewed = markedDecisions[node.account?.AccountNumber || ''];
          const radius = node.val + (isActive ? 2 : 0);

          if (isReviewed) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 7, 0, 2 * Math.PI, false);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2.5;
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          }

          if (node.account?.isMule || node.account?.riskScore > 50) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI, false);
            ctx.fillStyle = node.account.isMule ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)';
            ctx.fill();
          }

          if (isActive || (connectedNodeIds.size > 0 && isConnected)) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI, false);
            ctx.fillStyle = isActive ? 'rgba(15, 118, 110, 0.14)' : 'rgba(59, 130, 246, 0.08)';
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color;
          ctx.globalAlpha = isReviewed ? 1.0 : 0.7;
          ctx.fill();
          ctx.globalAlpha = 1.0;

          if (isReviewed) {
            const reviewColor = isReviewed === 'innocent' ? '#10b981' : '#ef4444';
            ctx.lineWidth = isActive ? 2.5 : 2;
            ctx.strokeStyle = reviewColor;
            ctx.globalAlpha = 0.9;
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
          } else {
            ctx.lineWidth = isActive ? 1.5 : 0.5;
            ctx.strokeStyle = '#cbd5e1';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => {
          setHoveredNodeId(node?.id ?? null);
        }}
        backgroundColor="#f8fafc"
      />
    </div>
  );
};

export default TransactionGraph;
