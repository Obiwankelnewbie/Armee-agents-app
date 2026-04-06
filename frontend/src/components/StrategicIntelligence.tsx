'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { swarmFetch, SWARM_URL } from '../lib/auth';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface YouTubeVideo  { title: string; channel: string; videoId: string; url: string; thumbnail?: string; viewCount: number; likeCount: number; }
interface TikTokVideo   { views: number; likes?: number; desc: string; url?: string; }
interface SourceResult  {
  score?: number; total_views?: number; video_count?: number; trend?: string;
  avg_interest?: number; upvotes?: number; sentiment?: string; pin_count?: number;
  top_videos?: (YouTubeVideo | TikTokVideo)[];
  top_posts?: { title: string; upvotes: number; url?: string }[];
}
interface VeilleResult  {
  id?: string; keyword: string; category: string; cross_score: number;
  is_viral: boolean; signal_count: number; signals: string[];
  verdict: 'VIRAL' | 'MONTANT' | 'STABLE';
  hook_suggestion: string | null; scraped_at: string;
  sources: { tiktok?: SourceResult; trends?: SourceResult; youtube?: SourceResult; reddit?: SourceResult; pinterest?: SourceResult; };
}
interface SourceEvent   { keyword: string; source: string; status: 'launching' | 'done' | 'skip' | 'waiting'; score?: number; }

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const CATEGORIES    = ['beaute','mode','tech','food','sport','maison','sante','musique'];
const CAT_ICONS:   Record<string,string> = { beaute:'💄',mode:'👗',tech:'📱',food:'🍜',sport:'💪',maison:'🏠',sante:'💊',musique:'🎵' };
const CAT_COLORS:  Record<string,string> = { beaute:'#ff6b9d',mode:'#a78bfa',tech:'#00c8ff',food:'#f59e0b',sport:'#00e5a0',maison:'#fb923c',sante:'#34d399',musique:'#ff2d55' };
const SRC_ICONS:   Record<string,string> = { tiktok:'🎵',trends:'📊',youtube:'▶',reddit:'🤖',pinterest:'📌' };
const SRC_COLORS:  Record<string,string> = { tiktok:'#ff2d55',trends:'#00e5a0',youtube:'#ef4444',reddit:'#fb923c',pinterest:'#e60023' };
const VERDICT_COLOR: Record<string,string> = { VIRAL:'#00e5a0',MONTANT:'#f59e0b',STABLE:'#64748b' };
const VERDICT_ICON:  Record<string,string> = { VIRAL:'🔥',MONTANT:'📈',STABLE:'💤' };

function fmtViews(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + ' k';
  return String(v);
}

// ─────────────────────────────────────────────────────────────
// SOUS-COMPOSANTS
// ─────────────────────────────────────────────────────────────

function SourceBadge({ source, score, status }: { source: string; score?: number; status: string }) {
  return (
    <div style={{ borderColor: status === 'done' ? SRC_COLORS[source] + '55' : '#27272a' }}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-all duration-300 ${status === 'done' ? 'bg-zinc-900' : 'bg-transparent'}`}>
      <span className="text-[11px]">{SRC_ICONS[source]}</span>
      {status === 'launching' && <div className="w-2 h-2 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />}
      {status === 'done'      && <span className="text-[10px] font-bold font-mono" style={{ color: SRC_COLORS[source] }}>{score}%</span>}
      {status === 'skip'      && <span className="text-[10px] font-mono text-zinc-600">—</span>}
    </div>
  );
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 font-mono">
      <span>⚠ {message}</span>
      <button onClick={onDismiss} className="ml-4 text-red-400/60 hover:text-red-400 transition-colors">✕</button>
    </div>
  );
}

/** Panneau de détail d'un signal sélectionné */
function DetailPanel({ res }: { res: VeilleResult }) {
  const srcEntries = Object.entries(res.sources).filter(([, v]) => v !== undefined);

  return (
    <div className="space-y-5">
      {/* Titre + verdict */}
      <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-lg font-black italic text-zinc-100">{res.keyword}</h3>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{res.category}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black font-mono" style={{ color: VERDICT_COLOR[res.verdict] }}>
            {res.cross_score}
          </div>
          <div className="text-[9px] font-bold tracking-widest" style={{ color: VERDICT_COLOR[res.verdict] }}>
            {VERDICT_ICON[res.verdict]} {res.verdict}
          </div>
        </div>
      </div>

      {/* Hook */}
      {res.hook_suggestion && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl">
          <span className="text-emerald-500 font-bold text-[9px] uppercase tracking-widest block mb-1">Hook Swarm Engine</span>
          <p className="italic text-sm text-zinc-300">"{res.hook_suggestion}"</p>
        </div>
      )}

      {/* Sources détaillées */}
      {srcEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Sources</p>
          <div className="grid grid-cols-1 gap-2">
            {srcEntries.map(([src, data]) => (
              <div key={src} className="flex items-center justify-between px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{SRC_ICONS[src]}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: SRC_COLORS[src] }}>{src}</span>
                </div>
                <div className="text-right text-[10px] font-mono text-zinc-400 space-x-3">
                  {data?.score       !== undefined && <span className="text-emerald-400 font-bold">{data.score}%</span>}
                  {data?.total_views !== undefined && <span>{fmtViews(data.total_views)} vues</span>}
                  {data?.avg_interest !== undefined && <span>intérêt {data.avg_interest}</span>}
                  {data?.upvotes     !== undefined && <span>↑{fmtViews(data.upvotes)}</span>}
                  {data?.pin_count   !== undefined && <span>{fmtViews(data.pin_count)} pins</span>}
                  {data?.sentiment   !== undefined && <span className="capitalize">{data.sentiment}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signaux */}
      {res.signals.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {res.signals.map(s => (
            <span key={s} className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded-md border border-zinc-700">#{s}</span>
          ))}
        </div>
      )}

      {/* Top vidéos YouTube */}
      {res.sources.youtube?.top_videos && res.sources.youtube.top_videos.length > 0 && (
        <div className="space-y-1">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest font-bold">Top YouTube</p>
          {(res.sources.youtube.top_videos as YouTubeVideo[]).slice(0, 3).map((v, i) => (
            <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 bg-zinc-900 rounded-lg hover:border-red-500/30 border border-zinc-800 transition-all">
              <span className="text-[10px] text-zinc-300 truncate max-w-[70%]">{v.title}</span>
              <span className="text-[10px] font-mono text-zinc-500">{fmtViews(v.viewCount)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

/** Carte résumé d'un signal dans la liste */
function ResultCard({ res, selected, onClick, sourceEvents }: {
  res: VeilleResult; selected: boolean; onClick: () => void; sourceEvents: SourceEvent[];
}) {
  return (
    <div onClick={onClick} style={{ borderColor: selected ? VERDICT_COLOR[res.verdict] + '60' : '' }}
      className={`p-4 rounded-2xl border cursor-pointer transition-all ${selected ? 'bg-emerald-500/5' : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{CAT_ICONS[res.category]}</span>
          <div>
            <h4 className="font-bold text-sm text-zinc-200">{res.keyword}</h4>
            <span className="text-[10px] text-zinc-500 uppercase">{res.category}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-black font-mono" style={{ color: VERDICT_COLOR[res.verdict] }}>{res.cross_score}</div>
          <div className="text-[9px] font-bold" style={{ color: VERDICT_COLOR[res.verdict] }}>
            {VERDICT_ICON[res.verdict]} {res.verdict}
          </div>
        </div>
      </div>
      {sourceEvents.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {sourceEvents.map(se => <SourceBadge key={se.source} source={se.source} score={se.score} status={se.status} />)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPOSANT PRINCIPAL
// ─────────────────────────────────────────────────────────────

export default function StrategicIntelligence() {
  const [running,      setRunning]      = useState(false);
  const [results,      setResults]      = useState<VeilleResult[]>([]);
  const [history,      setHistory]      = useState<VeilleResult[]>([]);
  const [selected,     setSelected]     = useState<VeilleResult | null>(null);
  const [sources,      setSources]      = useState<Record<string, SourceEvent[]>>({});
  const [scanning,     setScanning]     = useState<{ keyword: string; category: string } | null>(null);
  const [progress,     setProgress]     = useState({ done: 0, total: 0 });
  const [tab,          setTab]          = useState<'live' | 'history'>('live');
  const [maxPerCat,    setMaxPerCat]    = useState(3);
  const [selectedCats, setSelectedCats] = useState<string[]>(CATEGORIES);
  const [error,        setError]        = useState<string | null>(null);

  // Ref pour cleanup SSE en cas d'unmount pendant un scan
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const d = await swarmFetch('/api/veille/history?limit=30');
      if (d?.results) setHistory(d.results);
    } catch (e: any) {
      console.error('Erreur historique:', e);
      setError('Impossible de charger l\'historique.');
    }
  }, []);

  useEffect(() => {
    loadHistory();
    return () => {
      // Cleanup SSE si unmount pendant scan
      readerRef.current?.cancel().catch(() => {});
    };
  }, [loadHistory]);

  const toggleCat = (cat: string) => {
    setSelectedCats(prev =>
      prev.includes(cat) ? (prev.length > 1 ? prev.filter(c => c !== cat) : prev) : [...prev, cat]
    );
  };

  const handleSSEEvent = useCallback((event: string, data: any) => {
    switch (event) {
      case 'start':
        setProgress({ done: 0, total: data.total_keywords ?? 0 });
        break;
      case 'scanning':
        setScanning({ keyword: data.keyword, category: data.category });
        setProgress(p => ({ ...p, done: data.processed ?? p.done }));
        break;
      case 'source':
        setSources(prev => {
          const list = prev[data.keyword] ?? [];
          return { ...prev, [data.keyword]: [...list.filter(s => s.source !== data.source), data] };
        });
        break;
      case 'result':
        // Sort uniquement ici (résultat final) — pas sur chaque event source
        setResults(prev =>
          [data, ...prev.filter(r => r.keyword !== data.keyword)]
            .sort((a, b) => b.cross_score - a.cross_score)
        );
        break;
      case 'complete':
        setRunning(false);
        setScanning(null);
        readerRef.current = null;
        loadHistory();
        break;
    }
  }, [loadHistory]);

  const startVeille = async () => {
    if (running) return;
    setRunning(true);
    setResults([]);
    setSources({});
    setSelected(null);
    setError(null);
    setTab('live');

    try {
      const response = await fetch(`${SWARM_URL}/api/veille`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body:    JSON.stringify({ categories: selectedCats, max_per_category: maxPerCat }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status} — ${response.statusText}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Pas de stream disponible');
      readerRef.current = reader;

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event:'))      currentEvent = line.replace('event:', '').trim();
          else if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.replace('data:', '').trim());
              handleSSEEvent(currentEvent, data);
            } catch { /* ligne SSE incomplète — ignorée */ }
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Erreur inconnue';
      console.error('Erreur veille:', msg);
      setError(`Scan interrompu : ${msg}`);
      setRunning(false);
      readerRef.current = null;
    }
  };

  const displayedList = tab === 'live' ? results : history;

  return (
    <div className="flex flex-col gap-4 p-4 bg-black border border-zinc-800 rounded-3xl min-h-[600px]">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-xl font-black italic tracking-tighter text-white">🔭 RADAR DE VIRALITÉ</h2>
          <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Cross-Platform Signal Detection v3.0</p>
        </div>
        <button
          onClick={startVeille}
          disabled={running}
          className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${
            running ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-emerald-500 text-black hover:scale-105 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
          }`}
        >
          {running ? 'VEILLE EN COURS…' : 'LANCER LE SCAN'}
        </button>
      </div>

      {/* ── ERREUR ── */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* ── FILTRES CATÉGORIES + maxPerCat ── */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => toggleCat(cat)}
            disabled={running}
            style={{ borderColor: selectedCats.includes(cat) ? CAT_COLORS[cat] + '80' : '#27272a', color: selectedCats.includes(cat) ? CAT_COLORS[cat] : '#52525b' }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase transition-all disabled:opacity-40">
            {CAT_ICONS[cat]} {cat}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
          <span>Max/cat</span>
          {[2, 3, 5].map(n => (
            <button key={n}
              onClick={() => setMaxPerCat(n)}
              disabled={running}
              className={`w-6 h-6 rounded-md border transition-all text-[10px] font-bold disabled:opacity-40 ${maxPerCat === n ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-zinc-700 text-zinc-500'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── BARRE DE PROGRESSION ── */}
      {running && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono text-emerald-400">
            <span>{scanning?.keyword ? `↳ ${scanning.keyword}` : 'Initialisation…'}</span>
            <span>{progress.done} / {progress.total}</span>
          </div>
          <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* ── TABS LIVE / HISTORIQUE ── */}
      <div className="flex gap-1 border-b border-zinc-800 pb-0">
        {(['live', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest rounded-t-lg transition-all ${
              tab === t ? 'text-emerald-400 border-b-2 border-emerald-500' : 'text-zinc-600 hover:text-zinc-400'
            }`}>
            {t === 'live' ? `Live (${results.length})` : `Historique (${history.length})`}
          </button>
        ))}
      </div>

      {/* ── LISTE + PANNEAU DÉTAIL ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">

        {/* Liste */}
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {displayedList.length > 0 ? displayedList.map(res => (
            <ResultCard
              key={res.keyword}
              res={res}
              selected={selected?.keyword === res.keyword}
              onClick={() => setSelected(res)}
              sourceEvents={sources[res.keyword] ?? []}
            />
          )) : (
            <div className="text-center py-20 text-zinc-600 font-mono text-xs italic">
              {tab === 'live' ? (running ? 'Scan en cours…' : 'En attente de lancement…') : 'Aucun historique disponible.'}
            </div>
          )}
        </div>

        {/* Panneau détail */}
        <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl p-5 max-h-[520px] overflow-y-auto">
          {selected ? (
            <DetailPanel res={selected} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-zinc-700 gap-3 opacity-50">
              <span className="text-4xl">🔭</span>
              <p className="text-[10px] font-mono uppercase tracking-[0.3em]">Sélectionner un signal</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}