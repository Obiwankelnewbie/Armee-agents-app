'use client';

// ═══════════════════════════════════════════════════════════════
//   SWARM OS — DASHBOARD PRIVÉ
//   Placer dans : frontend/src/components/SwarmDashboard.tsx
//   (ou remplacer DashboardCRM.tsx)
//
//   Appelle le backend Express sur process.env.NEXT_PUBLIC_API_URL
//   + Supabase Realtime pour les mises à jour en temps réel
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type AgentStatus = 'offline' | 'booting' | 'online' | 'busy' | 'error' | 'manual';

interface Agent {
  id:        string;
  name:      string;
  role:      string;
  script:    string;
  critical:  boolean;
  order:     number;
  manual:    boolean;
  status:    AgentStatus;
  task:      string;
  uptime?:   number;
  memoryMb?: number;
  lastPing?: string;
}

interface FeedItem {
  id:         string;
  type:       string;
  message:    string;
  created_at: string;
}

interface TraderSignal {
  id:            number;
  asset:         string;
  verdict:       string;
  confidence:    string;
  risk_level:    string;
  opportunity:   string;
  original_score: number;
  scanned_at:    string;
}

interface MirrorMemory {
  etat_swarm:       string;
  message_dragon:   string;
  niches_chaudes:   string[];
  niches_mortes:    string[];
  prediction_48h:   string;
  action_critique:  string;
  pattern_dominant: string;
  version:          number;
  updated_at:       string;
}

interface ContentReady {
  id:              number;
  domain:          string;
  angle_nexo:      string;
  posts:           any;
  meilleur_moment: string;
  longevite:       string;
  status:          string;
  created_at:      string;
}

interface KPIs {
  signals:  number;
  contents: number;
  leads:    number;
  trades:   number;
}

// ═══════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════

const AGENTS_DEF: Omit<Agent, 'status' | 'task' | 'uptime' | 'memoryMb' | 'lastPing'>[] = [
  { id: 'AGENT-ANCALAGONE-01', name: 'Ancalagone',  role: 'Mémoire · CRM · conseil',     script: 'ancalagone.js',  critical: true,  order: 1, manual: false },
  { id: 'AGENT-ARGUS-01',      name: 'Argus',        role: 'Scraping · détection',        script: 'argus.js',       critical: true,  order: 2, manual: false },
  { id: 'AGENT-GENERAL-01',    name: 'Le Général',   role: 'Supervision · filtrage',      script: 'le_general.js',  critical: true,  order: 3, manual: false },
  { id: 'AGENT-STRATEGE-01',   name: 'Le Stratège',  role: 'Growth · War Room · contenu', script: 'le_stratege.js', critical: false, order: 4, manual: false },
  { id: 'AGENT-NEXO-01',       name: 'Nexo',         role: 'Influenceur · leads',         script: 'nexo.js',        critical: false, order: 5, manual: false },
  { id: 'AGENT-TRADER-01',     name: 'Le Trader',    role: 'Analyse · BUY/WAIT/SKIP',     script: 'le_trader.js',   critical: false, order: 6, manual: false },
  { id: 'AGENT-EXECUTOR-01',   name: "L'Executor",   role: 'Actions · DM · trades',       script: 'le_executor.js', critical: false, order: 7, manual: false },
];

// ═══════════════════════════════════════════════════════════════
// COMPOSANTS
// ═══════════════════════════════════════════════════════════════

function StatusDot({ status }: { status: AgentStatus }) {
  const cls: Record<AgentStatus, string> = {
    offline: 'bg-[#1e2028]',
    booting: 'bg-amber-500 animate-pulse',
    online:  'bg-emerald-500 shadow-[0_0_6px_rgba(45,202,114,0.5)]',
    busy:    'bg-amber-400 shadow-[0_0_6px_rgba(239,159,39,0.5)] animate-pulse',
    error:   'bg-red-500 shadow-[0_0_6px_rgba(226,75,74,0.5)]',
    manual:  'bg-blue-400 shadow-[0_0_6px_rgba(55,138,221,0.5)]',
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-all duration-500 ${cls[status]}`} />;
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const cfg: Record<AgentStatus, { label: string; cls: string }> = {
    offline: { label: 'Offline',    cls: 'bg-[#14161c] text-[#3a3f4a] border border-[#1e2028]' },
    booting: { label: 'Démarrage',  cls: 'bg-[#1a1108] text-amber-400 border border-[#2a1e0a]' },
    online:  { label: 'En ligne',   cls: 'bg-[#0a1f14] text-emerald-400 border border-[#0d2b1a]' },
    busy:    { label: 'Actif',      cls: 'bg-[#1a1408] text-amber-400 border border-[#2a1e0a]' },
    error:   { label: 'Erreur',     cls: 'bg-[#1a0d0d] text-red-400 border border-[#2a1010]' },
    manual:  { label: 'Manuel',     cls: 'bg-[#0a1428] text-blue-400 border border-[#0d1e38]' },
  };
  const { label, cls } = cfg[status];
  return <span className={`font-mono text-[9px] tracking-widest px-2 py-1 rounded uppercase ${cls}`}>{label}</span>;
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={`w-9 h-5 rounded-full border cursor-pointer relative transition-all duration-300 flex-shrink-0
        ${on ? 'bg-[#0d2b1a] border-[#1a4a2a]' : 'bg-[#1a1d24] border-[#24282f]'}`}
    >
      <div className={`absolute top-[3px] left-[3px] w-[13px] h-[13px] rounded-full transition-all duration-300
        ${on ? 'translate-x-4 bg-emerald-400' : 'bg-[#3a3f4a]'}`} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export default function SwarmDashboard() {
  const [agents,     setAgents]     = useState<Agent[]>(AGENTS_DEF.map(a => ({ ...a, status: 'offline' as AgentStatus, task: '' })));
  const [feedItems,  setFeedItems]  = useState<FeedItem[]>([]);
  const [traderSigs, setTraderSigs] = useState<TraderSignal[]>([]);
  const [mirror,     setMirror]     = useState<MirrorMemory | null>(null);
  const [contents,   setContents]   = useState<ContentReady[]>([]);
  const [kpis,       setKpis]       = useState<KPIs>({ signals: 0, contents: 0, leads: 0, trades: 0 });
  const [clock,      setClock]      = useState('');
  const [bootActive, setBootActive] = useState(false);
  const [bootDone,   setBootDone]   = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newScript,  setNewScript]  = useState('');

  const channelsRef = useRef<RealtimeChannel[]>([]);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('fr-FR'));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.allSettled([loadStatuses(), loadFeed(), loadSignals(), loadMirror(), loadKpis(), loadContents()]);
  }, []);

  useEffect(() => {
    loadAll();
    setupRealtime();
    return () => { channelsRef.current.forEach(c => supabase.removeChannel(c)); };
  }, [loadAll]);

  // ── Chargement via backend Express ────────────────────────

  async function loadStatuses() {
    try {
      const res  = await fetch(`${API}/api/swarm/status`);
      const data = await res.json() as any[];
      if (!Array.isArray(data)) return;
      setAgents(prev => prev.map(a => {
        const row = data.find((r: any) => r.agent_id === a.id);
        if (!row) return a;
        return { ...a, status: mapStatus(row.status), task: row.current_task ?? '', uptime: row.uptime_seconds, memoryMb: row.memory_mb, lastPing: row.last_ping };
      }));
    } catch { /* backend offline */ }
  }

  async function loadFeed() {
    try {
      const res  = await fetch(`${API}/api/feed?limit=40`);
      const data = await res.json();
      if (Array.isArray(data)) setFeedItems(data);
    } catch {}
  }

  async function loadSignals() {
    try {
      const res  = await fetch(`${API}/api/signals`);
      const data = await res.json();
      if (Array.isArray(data)) setTraderSigs(data);
    } catch {}
  }

  async function loadMirror() {
    try {
      const res  = await fetch(`${API}/api/mirror`);
      const data = await res.json();
      if (data?.message_dragon) setMirror(data);
    } catch {}
  }

  async function loadKpis() {
    try {
      const res  = await fetch(`${API}/api/kpis`);
      const data = await res.json();
      setKpis(data);
    } catch {}
  }

  async function loadContents() {
    try {
      const res  = await fetch(`${API}/api/contents`);
      const data = await res.json();
      if (Array.isArray(data)) setContents(data);
    } catch {}
  }

  async function markPosted(id: number) {
    try {
      await fetch(`${API}/api/contents/${id}/posted`, { method: 'POST' });
      setContents(prev => prev.filter(c => c.id !== id));
      setKpis(prev => ({ ...prev, contents: Math.max(0, prev.contents - 1) }));
    } catch {}
  }

  // ── Realtime Supabase ─────────────────────────────────────

  function setupRealtime() {
    const feedCh = supabase.channel('dash-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_feed_events' },
        p => setFeedItems(prev => [p.new as FeedItem, ...prev.slice(0, 39)])
      ).subscribe();

    const statusCh = supabase.channel('dash-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status' },
        p => {
          const r = p.new as any;
          setAgents(prev => prev.map(a =>
            a.id === r.agent_id
              ? { ...a, status: mapStatus(r.status), task: r.current_task ?? '', uptime: r.uptime_seconds, memoryMb: r.memory_mb }
              : a
          ));
        }
      ).subscribe();

    const traderCh = supabase.channel('dash-trader')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_trader_signals' },
        p => {
          setTraderSigs(prev => [p.new as TraderSignal, ...prev.slice(0, 9)]);
          if ((p.new as TraderSignal).verdict === 'BUY') setKpis(prev => ({ ...prev, trades: prev.trades + 1 }));
        }
      ).subscribe();

    const mirrorCh = supabase.channel('dash-mirror')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ancalagone_mirror' },
        () => loadMirror()
      ).subscribe();

    const contentCh = supabase.channel('dash-content')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'generated_contents' },
        p => {
          setContents(prev => [p.new as ContentReady, ...prev.slice(0, 9)]);
          setKpis(prev => ({ ...prev, contents: prev.contents + 1 }));
        }
      ).subscribe();

    channelsRef.current = [feedCh, statusCh, traderCh, mirrorCh, contentCh];
  }

  // ── Contrôle du swarm ─────────────────────────────────────

  async function startBoot() {
    if (bootActive || bootDone) return;
    setBootActive(true);

    try {
      await fetch(`${API}/api/swarm/boot`, { method: 'POST' });
    } catch {
      console.warn('Boot via API non disponible — démarrage UI uniquement');
    }

    // Animation UI pendant le boot (le vrai statut viendra via Realtime)
    for (let i = 0; i < AGENTS_DEF.length; i++) {
      await new Promise(r => setTimeout(r, [0,2000,2500,2000,1800,2200,1500][i] || 1500));
      setAgents(prev => prev.map((a, idx) => idx === i ? { ...a, status: 'booting', task: 'Initialisation...' } : a));
      await new Promise(r => setTimeout(r, 1200));
    }

    setBootActive(false);
    setBootDone(true);
  }

  async function stopAll() {
    try {
      await fetch(`${API}/api/swarm/stop-all`, { method: 'POST' });
    } catch {}
    setAgents(prev => prev.map(a => a.manual ? a : { ...a, status: 'offline', task: '' }));
    setBootDone(false);
    setBootActive(false);
  }

  async function manualToggle(idx: number) {
    const agent = agents[idx];
    const newStatus = agent.status === 'offline' ? 'manual' : 'offline';

    if (newStatus === 'manual') {
      try {
        await fetch(`${API}/api/swarm/start`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ script: agent.script, name: agent.id }),
        });
      } catch {}
    } else {
      try {
        await fetch(`${API}/api/swarm/stop-one`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ name: agent.id }),
        });
      } catch {}
    }

    setAgents(prev => prev.map((a, i) =>
      i === idx ? { ...a, status: newStatus, task: newStatus === 'manual' ? 'Mode test actif' : '' } : a
    ));
  }

  function addAgent() {
    if (!newName.trim()) return;
    setAgents(prev => [...prev, {
      id:      'AGENT-TEST-' + Date.now(),
      name:    newName.trim(),
      role:    'Agent expérimental',
      script:  newScript.trim() || newName.toLowerCase().replace(/\s+/g, '_') + '.js',
      critical: false,
      order:   prev.length + 1,
      manual:  true,
      status:  'offline',
      task:    '',
    }]);
    setShowModal(false);
    setNewName('');
    setNewScript('');
  }

  // ── Helpers ───────────────────────────────────────────────

  function mapStatus(s: string): AgentStatus {
    return ({ ONLINE:'online', BUSY:'busy', IDLE:'online', ERROR:'error', OFFLINE:'offline', WORKING:'busy' } as any)[s?.toUpperCase()] ?? 'offline';
  }

  function formatUptime(s?: number) {
    if (!s) return '—';
    return `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2,'0')}`;
  }

  function feedClass(type: string) {
    if (type.includes('ERROR')) return 'border-l-red-500/40';
    if (type.includes('WARN'))  return 'border-l-amber-500/30';
    if (type === 'RUPTURE')     return 'border-l-amber-500/30';
    if (type.includes('INFO'))  return 'border-l-blue-400/30';
    return 'border-l-emerald-500/30';
  }

  function verdictStyle(v: string) {
    if (v === 'BUY')  return 'bg-[#0a1f14] text-emerald-400 border border-[#0d2b1a]';
    if (v === 'WAIT') return 'bg-[#1a1408] text-amber-400 border border-[#2a1e0a]';
    return 'bg-[#14161c] text-[#3a3f4a] border border-[#1e2028]';
  }

  const aliveCount = agents.filter(a => ['online','busy'].includes(a.status)).length;

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#08090c] text-[#e8e9ec]" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <header className="border-b border-[#1a1d24] px-7 py-4 flex items-center justify-between bg-[#08090c] sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 border border-[#2a4a3a] rounded-xl flex items-center justify-center bg-[#0d1f18]">
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
              <path d="M9 2L14 5.5V12.5L9 16L4 12.5V5.5L9 2Z" stroke="#2dca72" strokeWidth="1" fill="none"/>
              <circle cx="9" cy="9" r="2" fill="#2dca72"/>
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-medium tracking-[0.12em] uppercase">
              Swarm <span className="text-emerald-400">OS</span>
            </div>
            <div className="font-mono text-[9px] text-[#3a3f4a] tracking-widest mt-0.5">Dashboard v2.0 · Privé · {API}</div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-[#3a3f4a]">{aliveCount}/{AGENTS_DEF.length} agents</span>
            <div className="w-16 h-1 bg-[#1a1d24] rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${(aliveCount / AGENTS_DEF.length) * 100}%` }} />
            </div>
          </div>
          <div className="font-mono text-[11px] text-[#4a5060]">{clock}</div>
          <div className={`w-1.5 h-1.5 rounded-full transition-all ${aliveCount > 0 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(45,202,114,0.5)] animate-pulse' : 'bg-[#1e2028]'}`} />
        </div>
      </header>

      <div className="px-7 py-6 grid grid-cols-12 gap-4">

        {/* Colonne gauche */}
        <div className="col-span-7 flex flex-col gap-4">

          {/* Agents */}
          <div className="bg-[#0d0f14] border border-[#1a1d24] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3a3f4a]">Agents du swarm</div>
              <div className="flex gap-2">
                <button onClick={startBoot} disabled={bootActive || bootDone}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-medium tracking-wider transition-all
                    ${bootDone ? 'bg-[#0a1f14] border border-[#1a3020] text-emerald-500 cursor-default'
                    : bootActive ? 'bg-[#1a1a0d] border border-[#2a2a10] text-amber-400 cursor-not-allowed'
                    : 'bg-[#0d2b1a] border border-[#1a4a2a] text-emerald-400 hover:bg-[#0f3320] active:scale-[0.97]'}`}>
                  {bootDone ? '✓ Swarm actif' : bootActive ? '⟳ Démarrage...' : '⏻ Démarrage séquentiel'}
                </button>
                <button onClick={stopAll} className="px-4 py-2 rounded-lg text-[11px] font-medium tracking-wider border border-[#2a1010] text-red-400 hover:bg-[#1a0d0d] transition-all">
                  Tout arrêter
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {agents.map((agent, i) => (
                <div key={agent.id}
                  className="flex items-center justify-between px-4 py-3 bg-[#0a0c11] border border-[#1a1d24] rounded-xl hover:border-[#2a3040] hover:bg-[#0d0f14] transition-all cursor-pointer relative overflow-hidden"
                  onClick={() => !agent.manual && agent.status === 'offline' && !bootActive &&
                    setAgents(prev => prev.map((a, idx) => idx === i ? {...a, status:'booting', task:'Démarrage manuel...'} : a))
                  }>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] text-[#2a3040] w-4 text-right flex-shrink-0">{String(agent.order).padStart(2,'0')}</span>
                    <StatusDot status={agent.status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#d0d2d8]">{agent.name}</span>
                        {agent.manual && <span className="font-mono text-[8px] text-blue-400 border border-[#0d1e38] bg-[#0a1428] px-1.5 py-0.5 rounded">TEST</span>}
                        {agent.critical && agent.status === 'offline' && <span className="font-mono text-[8px] text-red-400/50">critique</span>}
                      </div>
                      <div className="font-mono text-[10px] text-[#3a4050] mt-0.5 max-w-[240px] truncate">
                        {agent.status === 'offline' ? agent.role : (agent.task || agent.role)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {agent.uptime && agent.status !== 'offline' && <span className="font-mono text-[9px] text-[#2a3040]">{formatUptime(agent.uptime)}</span>}
                    {agent.memoryMb && agent.status !== 'offline' && <span className="font-mono text-[9px] text-[#2a3040]">{agent.memoryMb}MB</span>}
                    <StatusBadge status={agent.status} />
                    {agent.manual && <Toggle on={agent.status !== 'offline'} onChange={() => manualToggle(i)} />}
                  </div>
                </div>
              ))}

              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-3 border border-dashed border-[#1e2028] rounded-xl text-[#3a3f4a] text-[12px] hover:border-[#2a3040] hover:bg-[#0a0c11] hover:text-[#5a6070] transition-all mt-1 w-full">
                + Ajouter un agent pour test
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Signaux filtrés', val: kpis.signals,  sub: '24h', color: 'text-emerald-400' },
              { label: 'Contenus prêts',  val: kpis.contents, sub: 'Nexo', color: 'text-[#d0d2d8]' },
              { label: 'Leads CRM',       val: kpis.leads,    sub: '24h',  color: 'text-emerald-400' },
              { label: 'Trades BUY',      val: kpis.trades,   sub: 'privé', color: 'text-amber-400' },
            ].map((k, i) => (
              <div key={i} className="bg-[#0a0c11] border border-[#1a1d24] rounded-xl p-4">
                <div className="font-mono text-[9px] tracking-widest text-[#3a3f4a] uppercase mb-2">{k.label}</div>
                <div className={`text-2xl font-medium ${k.color} leading-none tracking-tight`}>{k.val}</div>
                <div className="font-mono text-[9px] text-[#2a3040] mt-1">{k.sub}</div>
              </div>
            ))}
          </div>

          {/* Trader privé */}
          <div className="bg-[#0d0f14] border border-[#1a1d24] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3a3f4a]">Trader · privé</div>
              <span className="font-mono text-[9px] text-[#2a3040]">{traderSigs.length} signal{traderSigs.length !== 1 ? 's' : ''}</span>
            </div>
            {traderSigs.length === 0
              ? <div className="font-mono text-[11px] text-[#2a3040] italic py-3">En attente du Trader...</div>
              : <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {traderSigs.map((sig, i) => (
                    <div key={sig.id ?? i} className="flex items-center justify-between px-3 py-2.5 bg-[#0a0c11] border border-[#1a1d24] rounded-xl hover:border-[#2a3040] transition-all">
                      <div className="flex items-center gap-3">
                        <span className="text-[13px] font-medium text-[#d0d2d8] w-12">{sig.asset}</span>
                        <span className="font-mono text-[10px] text-[#4a5060] max-w-[180px] truncate">{sig.opportunity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {sig.original_score && <span className="font-mono text-[9px] text-[#2a3040]">{sig.original_score.toFixed(2)}</span>}
                        <span className={`font-mono text-[10px] px-2.5 py-1 rounded-lg ${verdictStyle(sig.verdict)}`}>{sig.verdict}</span>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>

        {/* Colonne droite */}
        <div className="col-span-5 flex flex-col gap-4">

          {/* Mirror Memory */}
          <div className="bg-[#0d0f14] border border-[#1a1d24] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3a3f4a]">Mirror Memory · Ancalagone</div>
              {mirror && <span className="font-mono text-[9px] text-[#2a3040]">v{mirror.version}</span>}
            </div>
            {!mirror
              ? <div className="font-mono text-[11px] text-[#2a3040] italic py-2">En attente d'Ancalagone...</div>
              : <>
                  <div className="bg-[#080a0f] border-l-2 border-[#534AB720] rounded-lg p-3.5 mb-3">
                    <p className="text-[12px] text-[#5a6070] italic leading-relaxed">
                      <span className="text-[#AFA9EC] not-italic font-medium">Ancalagone</span> — "{mirror.message_dragon}"
                    </p>
                  </div>
                  {mirror.prediction_48h && (
                    <div className="bg-[#080a0f] rounded-lg p-3 mb-3">
                      <div className="font-mono text-[9px] text-[#2a3040] uppercase tracking-widest mb-1.5">Prédiction 48h</div>
                      <p className="text-[11px] text-[#4a5060] leading-relaxed">{mirror.prediction_48h}</p>
                    </div>
                  )}
                  {mirror.action_critique && (
                    <div className="bg-[#0a1408] border border-[#1a2a10] rounded-lg p-3 mb-3">
                      <div className="font-mono text-[9px] text-emerald-600 uppercase tracking-widest mb-1">Action critique</div>
                      <p className="text-[11px] text-emerald-400/70">{mirror.action_critique}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(mirror.niches_chaudes ?? []).slice(0,3).map((n,i) => (
                      <span key={i} className="font-mono text-[9px] px-2 py-1 rounded bg-[#1a0d0d] text-red-400 border border-[#2a1010]">{n}</span>
                    ))}
                    {(mirror.niches_mortes ?? []).slice(0,2).map((n,i) => (
                      <span key={i} className="font-mono text-[9px] px-2 py-1 rounded bg-[#0a1428] text-blue-400 border border-[#0d1e38]">{n} ✗</span>
                    ))}
                    <span className="font-mono text-[9px] px-2 py-1 rounded bg-[#14101a] text-[#AFA9EC] border border-[#201828]">{mirror.etat_swarm}</span>
                  </div>
                </>
            }
          </div>

          {/* Contenus Nexo prêts */}
          {contents.length > 0 && (
            <div className="bg-[#0d0f14] border border-[#1a1d24] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3a3f4a]">Nexo · contenus prêts</div>
                <button onClick={() => setShowContent(!showContent)} className="font-mono text-[9px] text-[#3a3f4a] hover:text-[#5a6070]">
                  {showContent ? 'réduire' : `voir ${contents.length}`}
                </button>
              </div>
              {showContent && (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                  {contents.map(c => (
                    <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-[#0a0c11] border border-[#1a1d24] rounded-xl">
                      <div>
                        <div className="text-[11px] text-[#d0d2d8] max-w-[220px] truncate">{c.angle_nexo}</div>
                        <div className="font-mono text-[9px] text-[#2a3040] mt-0.5">{c.domain} · {c.meilleur_moment}</div>
                      </div>
                      <button onClick={() => markPosted(c.id)}
                        className="font-mono text-[9px] px-2.5 py-1 bg-[#0a1f14] border border-[#0d2b1a] text-emerald-400 rounded-lg hover:bg-[#0f3320] transition-all flex-shrink-0">
                        Posté ✓
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live feed */}
          <div className="bg-[#0d0f14] border border-[#1a1d24] rounded-2xl p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] font-medium tracking-[0.14em] uppercase text-[#3a3f4a]">Live feed</div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${feedItems.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-[#1e2028]'}`} />
                <span className="font-mono text-[9px] text-[#2a3040]">{feedItems.length} événements</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto pr-1">
              {feedItems.length === 0
                ? <div className="font-mono text-[11px] text-[#2a3040] italic py-4">Feed vide — démarrer le swarm.</div>
                : feedItems.map((item, i) => (
                    <div key={item.id ?? i} className={`flex items-start gap-3 px-3 py-2 bg-[#0a0c11] rounded-lg border-l-2 ${feedClass(item.type)}`}>
                      <span className="font-mono text-[9px] text-[#2a3040] whitespace-nowrap mt-0.5 flex-shrink-0">
                        {new Date(item.created_at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                      </span>
                      <span className="text-[11px] text-[#5a6070] leading-relaxed">
                        {item.message.replace(/^\[.*?\]\s*\d{2}:\d{2}:\d{2}\s*→\s*/, '')}
                      </span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>
      </div>

      {/* Modal ajouter agent */}
      {showModal && (
        <div className="fixed inset-0 bg-[#08090c]/90 flex items-center justify-center z-50">
          <div className="bg-[#0d0f14] border border-[#2a2d34] rounded-2xl p-6 w-80">
            <h3 className="text-[14px] font-medium text-[#d0d2d8] mb-1">Nouvel agent</h3>
            <p className="text-[12px] text-[#4a5060] mb-4 leading-relaxed">Agent expérimental — contrôle manuel via toggle.</p>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nom de l'agent"
              className="w-full bg-[#0a0c11] border border-[#2a2d34] rounded-xl px-3 py-2 text-[12px] font-mono text-[#d0d2d8] placeholder-[#2a3040] outline-none focus:border-[#2dca7240] mb-2" />
            <input value={newScript} onChange={e => setNewScript(e.target.value)} placeholder="Script (ex: mon_agent.js)"
              className="w-full bg-[#0a0c11] border border-[#2a2d34] rounded-xl px-3 py-2 text-[12px] font-mono text-[#d0d2d8] placeholder-[#2a3040] outline-none focus:border-[#2dca7240] mb-4" />
            <div className="flex gap-2">
              <button onClick={addAgent} className="flex-1 py-2 bg-[#0d2b1a] border border-[#1a4a2a] rounded-xl text-emerald-400 text-[12px] hover:bg-[#0f3320] transition-all">Ajouter</button>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-[#2a2d34] rounded-xl text-[#4a5060] text-[12px] hover:border-[#3a3f4a] transition-all">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}