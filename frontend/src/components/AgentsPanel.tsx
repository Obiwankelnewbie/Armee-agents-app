// src/components/AgentsPanel.tsx
// ─────────────────────────────────────────────────────────────
// Panel de supervision des agents SWARM OS
// Affiche : statuts, stats, top signaux, logs, décisions Superviseur
// Se met à jour toutes les 8 secondes via polling
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { swarmFetch, SWARM_URL } from '../lib/auth';

// ── Types ──────────────────────────────────────────────────────
interface AgentStats {
  total_pings:    number;
  active_agents:  number;
  niches_tracked: number;
  avg_score:      number;
  best_score:     number;
  last_ping:      string;
  foncer_count:   number;
}

interface AgentPing {
  id:          number;
  agent_id:    string;
  status:      string;
  run:         number;
  niche:       string | null;
  score:       number | null;
  verdict:     string | null;
  received_at: string;
  raw_data:    string;
}

interface TopSignal {
  id:         number;
  niche:      string;
  best_score: number;
  total_hits: number;
  last_seen:  string;
  verdict:    string;
}

// ── Helpers ────────────────────────────────────────────────────
const gc  = (s: number) => s >= 75 ? '#00e5a0' : s >= 55 ? '#f59e0b' : '#ef4444';
const vc  = (v: string) =>
  v === 'FONCER'   ? '#00e5a0' :
  v === 'APPROVED' ? '#00e5a0' :
  v === 'SURVEILLER' || v === 'NEEDS_REVISION' ? '#f59e0b' :
  v === 'REJECTED' ? '#ef4444' : '#64748b';

const agentLabel: Record<string, { icon: string; name: string; color: string }> = {
  'AGENT-INFLUENCEUR-01': { icon: '📡', name: 'Influenceur', color: '#00e5a0' },
  'AGENT-CONTENU-01':     { icon: '✍️', name: 'Contenu',     color: '#00c8ff' },
  'AGENT-SUPERVISEUR-01': { icon: '👁',  name: 'Superviseur', color: '#a78bfa' },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

function isOnline(lastPing: string | null): boolean {
  if (!lastPing) return false;
  return Date.now() - new Date(lastPing).getTime() < 3 * 60 * 1000;
}

// ── Composant : Dot pulsant ────────────────────────────────────
function PulseDot({ online }: { online: boolean }) {
  return (
    <div style={{ position: 'relative', width: 8, height: 8, flexShrink: 0 }}>
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: online ? '#00e5a0' : '#334155',
        boxShadow: online ? '0 0 5px #00e5a0' : 'none',
        position: 'absolute',
      }}/>
      {online && (
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          border: '2px solid #00e5a0',
          position: 'absolute', top: 0, left: 0,
          animation: 'pulseRing 1.8s ease-out infinite',
        }}/>
      )}
    </div>
  );
}

// ── Composant : Carte Agent ────────────────────────────────────
function AgentCard({
  agentId, lastPing, lastNiche, lastScore, lastVerdict, runCount, status
}: {
  agentId: string; lastPing: string | null; lastNiche: string | null;
  lastScore: number | null; lastVerdict: string | null;
  runCount: number; status: string;
}) {
  const cfg     = agentLabel[agentId] || { icon: '🤖', name: agentId, color: '#64748b' };
  const online  = isOnline(lastPing);
  const vcolor  = lastVerdict ? vc(lastVerdict) : '#64748b';
  const scolor  = lastScore   ? gc(lastScore)   : '#64748b';

  return (
    <div style={{
      background: '#0b0d1a',
      border: `1px solid ${online ? cfg.color + '30' : '#1e2035'}`,
      borderRadius: 10, padding: '11px 13px',
      position: 'relative', overflow: 'hidden',
      transition: 'border-color .3s',
    }}>
      {/* Accent top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: online
          ? `linear-gradient(90deg,transparent,${cfg.color},transparent)`
          : 'transparent',
        transition: 'background .3s',
      }}/>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, flexShrink: 0,
          background: online ? cfg.color + '12' : '#0f1120',
          border: `1px solid ${online ? cfg.color + '25' : '#1e2035'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, transition: 'all .3s',
        }}>
          {cfg.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
            fontWeight: 700, color: online ? cfg.color : '#64748b',
          }}>
            {cfg.name}
          </div>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#334155', marginTop: 1 }}>
            Run #{runCount} · {status}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PulseDot online={online}/>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 7,
            color: online ? '#00e5a0' : '#334155',
          }}>
            {online ? 'En ligne' : lastPing ? timeAgo(lastPing) : 'Hors ligne'}
          </span>
        </div>
      </div>

      {/* Stats */}
      {lastNiche && (
        <div style={{
          background: '#07090f', borderRadius: 6, padding: '7px 9px',
          border: '1px solid #1e2035',
        }}>
          <div style={{
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
            color: '#e2e8f0', fontWeight: 600, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {lastNiche}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {lastScore && (
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                fontWeight: 700, color: scolor,
              }}>
                {lastScore}%
              </span>
            )}
            {lastVerdict && (
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 7,
                padding: '1px 6px', borderRadius: 4,
                background: vcolor + '18', color: vcolor, fontWeight: 700,
              }}>
                {lastVerdict}
              </span>
            )}
            {lastPing && (
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#334155', marginLeft: 'auto' }}>
                {timeAgo(lastPing)}
              </span>
            )}
          </div>
        </div>
      )}

      {!lastNiche && (
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 8, color: '#334155', textAlign: 'center', padding: '6px 0' }}>
          En attente du premier run…
        </div>
      )}
    </div>
  );
}

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────
export function AgentsPanel({ onScanNiche }: { onScanNiche?: (niche: string) => void }) {
  const [stats, setStats]           = useState<AgentStats | null>(null);
  const [history, setHistory]       = useState<AgentPing[]>([]);
  const [topSignals, setTopSignals] = useState<TopSignal[]>([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'agents'|'signaux'|'logs'>('agents');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [sRes, hRes, tRes] = await Promise.all([
        swarmFetch('/api/agent/stats'),
        swarmFetch('/api/agent/history?limit=30'),
        swarmFetch('/api/agent/top?limit=10'),
      ]);
      if (!mountedRef.current) return;
      setStats(sRes.stats);
      setHistory(hRes.history || []);
      setTopSignals(tRes.top_signals || []);
    } catch {
      // Backend hors ligne — silencieux
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 8000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Construire l'état de chaque agent depuis l'historique
  const agentStates = ['AGENT-INFLUENCEUR-01', 'AGENT-CONTENU-01', 'AGENT-SUPERVISEUR-01'].map(agentId => {
    const pings = history.filter(h => h.agent_id === agentId);
    const last  = pings[0];
    return {
      agentId,
      lastPing:    last?.received_at || null,
      lastNiche:   last?.niche || null,
      lastScore:   last?.score || null,
      lastVerdict: last?.verdict || null,
      runCount:    last?.run || 0,
      status:      last?.status || 'inactif',
    };
  });

  const anyOnline = agentStates.some(a => isOnline(a.lastPing));

  return (
    <div style={{ background: '#0b0d1a', border: '1px solid #1e2035', borderRadius: 12, overflow: 'hidden' }}>
      <style>{`
        @keyframes pulseRing {
          0%   { transform: scale(.8); opacity: .8; }
          70%  { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #1e2035',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PulseDot online={anyOnline}/>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>
            SWARM AGENTS
          </span>
          {stats && (
            <span style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 8,
              padding: '1px 7px', borderRadius: 10,
              background: 'rgba(0,229,160,0.1)', color: '#00e5a0',
            }}>
              {stats.total_pings} pings
            </span>
          )}
        </div>

        {/* KPIs inline */}
        {stats && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {[
              { l: 'Niches',  v: stats.niches_tracked, c: '#e2e8f0' },
              { l: 'Moy.',    v: stats.avg_score + '%', c: gc(stats.avg_score) },
              { l: 'Best',    v: stats.best_score + '%', c: gc(stats.best_score) },
              { l: 'FONCER',  v: stats.foncer_count, c: '#00e5a0' },
            ].map(({ l, v, c }) => (
              <div key={l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 700, color: c, lineHeight: 1 }}>{v}</div>
                <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#334155', marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e2035' }}>
        {[
          { id: 'agents',  label: '🤖 Agents' },
          { id: 'signaux', label: '📡 Signaux' },
          { id: 'logs',    label: '📋 Logs' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)} style={{
            flex: 1, padding: '8px 0', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? '#00e5a0' : 'transparent'}`,
            background: 'transparent',
            color: tab === t.id ? '#00e5a0' : '#64748b',
            fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
            fontWeight: 700, cursor: 'pointer', transition: 'all .2s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 12 }}>

        {/* TAB : AGENTS */}
        {tab === 'agents' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: 24, color: '#334155', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
                Connexion au backend…
              </div>
            )}
            {!loading && agentStates.map(a => (
              <AgentCard key={a.agentId} {...a}/>
            ))}
            {stats?.last_ping && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#1e2035', textAlign: 'right', marginTop: 2 }}>
                Dernier ping : {new Date(stats.last_ping).toLocaleTimeString('fr-FR')}
              </div>
            )}
          </div>
        )}

        {/* TAB : SIGNAUX */}
        {tab === 'signaux' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {topSignals.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#334155', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
                Lance node agent_influenceur.js pour détecter des signaux
              </div>
            )}
            {topSignals.map((s, i) => (
              <div
                key={s.id}
                onClick={() => onScanNiche?.(s.niche)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 11px', borderRadius: 8, cursor: 'pointer',
                  background: '#07090f', border: '1px solid #1e2035',
                  transition: 'all .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(0,229,160,.2)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2035')}
              >
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#334155', width: 16 }}>
                  #{i + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
                    color: '#e2e8f0', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.niche}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#334155', marginTop: 2 }}>
                    {s.total_hits} détections · {timeAgo(s.last_seen)}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 14,
                    fontWeight: 700, color: gc(s.best_score), lineHeight: 1,
                  }}>
                    {s.best_score}%
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 7,
                    padding: '1px 5px', borderRadius: 4, marginTop: 2,
                    background: vc(s.verdict) + '18', color: vc(s.verdict), fontWeight: 700,
                  }}>
                    {s.verdict}
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, color: '#00c8ff', flexShrink: 0 }}>
                  → Scan
                </span>
              </div>
            ))}
            {topSignals.length > 0 && (
              <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#334155', textAlign: 'center', marginTop: 4 }}>
                Clique sur une niche pour lancer un scan Claude + Apify
              </div>
            )}
          </div>
        )}

        {/* TAB : LOGS */}
        {tab === 'logs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {history.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#334155', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
                Aucun log disponible
              </div>
            )}
            {history.slice(0, 20).map((h, i) => {
              const cfg = agentLabel[h.agent_id] || { icon: '🤖', name: h.agent_id, color: '#64748b' };
              const vcolor = h.verdict ? vc(h.verdict) : '#64748b';
              const d    = new Date(h.received_at);
              const ts   = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 7px', borderRadius: 5,
                  background: i === 0 ? 'rgba(0,229,160,.04)' : 'transparent',
                  borderLeft: `2px solid ${i === 0 ? '#00e5a0' : '#1e2035'}`,
                  transition: 'all .2s',
                }}>
                  <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 7, color: '#334155', flexShrink: 0, width: 56 }}>
                    {ts}
                  </span>
                  <span style={{ fontSize: 10, flexShrink: 0 }}>{cfg.icon}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 7,
                    color: cfg.color, flexShrink: 0, width: 70,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {cfg.name}
                  </span>
                  <span style={{
                    fontFamily: "'JetBrains Mono',monospace", fontSize: 8,
                    color: '#8a9ab5', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {h.niche || h.status}
                  </span>
                  {h.score && (
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
                      fontWeight: 700, color: gc(h.score), flexShrink: 0,
                    }}>
                      {h.score}%
                    </span>
                  )}
                  {h.verdict && (
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 7,
                      padding: '1px 5px', borderRadius: 3,
                      background: vcolor + '18', color: vcolor,
                      fontWeight: 700, flexShrink: 0,
                    }}>
                      {h.verdict}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}