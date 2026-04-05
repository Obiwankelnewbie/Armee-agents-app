// src/components/VeillePanel.tsx
// ─────────────────────────────────────────────────────────────
// 🔭 RADAR DE VIRALITÉ
// ✅ Liens YouTube cliquables
// ✅ Liens TikTok cliquables
// ✅ Top vidéos avec vues
// ✅ Streaming SSE temps réel
// ✅ Stockage Supabase automatique
// ✅ URL backend unifiée via SWARM_URL (auth.ts)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import { swarmFetch, SWARM_URL } from '../lib/auth';

// ── Types ──────────────────────────────────────────────────────
interface YouTubeVideo {
  title:     string;
  channel:   string;
  videoId:   string;
  url:       string;
  thumbnail?: string;
  viewCount: number;
  likeCount: number;
}

interface TikTokVideo {
  views: number;
  likes?: number;
  desc:  string;
  url?:  string;
}

interface SourceResult {
  score?:       number;
  total_views?: number;
  video_count?: number;
  trend?:       string;
  avg_interest?:number;
  upvotes?:     number;
  sentiment?:   string;
  pin_count?:   number;
  views_str?:   string;
  top_videos?:  (YouTubeVideo | TikTokVideo)[];
  top_posts?:   { title:string; upvotes:number; url?:string }[];
}

interface VeilleResult {
  id?:             string;
  keyword:         string;
  category:        string;
  cross_score:     number;
  is_viral:        boolean;
  signal_count:    number;
  signals:         string[];
  verdict:         'VIRAL' | 'MONTANT' | 'STABLE';
  hook_suggestion: string | null;
  scraped_at:      string;
  sources: {
    tiktok?:    SourceResult;
    trends?:    SourceResult;
    youtube?:   SourceResult;
    reddit?:    SourceResult;
    pinterest?: SourceResult;
  };
  raw_data?: any;
}

interface SourceEvent {
  keyword:    string;
  source:     string;
  status:     'launching' | 'done' | 'skip' | 'waiting';
  score?:     number;
  reason?:    string;
  views?:     string;
  trend?:     string;
  sentiment?: string;
}

const CATEGORIES = ['beaute','mode','tech','food','sport','maison','sante','musique'];
const CAT_ICONS:  Record<string,string> = { beaute:'💄', mode:'👗', tech:'📱', food:'🍜', sport:'💪', maison:'🏠', sante:'💊', musique:'🎵' };
const CAT_COLORS: Record<string,string> = { beaute:'#ff6b9d', mode:'#a78bfa', tech:'#00c8ff', food:'#f59e0b', sport:'#00e5a0', maison:'#fb923c', sante:'#34d399', musique:'#ff2d55' };
const SOURCE_ICONS:  Record<string,string> = { tiktok:'🎵', trends:'📊', youtube:'▶️', reddit:'🤖', pinterest:'📌' };
const SOURCE_COLORS: Record<string,string> = { tiktok:'#ff2d55', trends:'#00e5a0', youtube:'#ef4444', reddit:'#fb923c', pinterest:'#e60023' };
const VERDICT_COLOR: Record<string,string> = { VIRAL:'#00e5a0', MONTANT:'#f59e0b', STABLE:'#64748b' };
const VERDICT_ICON:  Record<string,string> = { VIRAL:'🔥', MONTANT:'📈', STABLE:'💤' };

function fmtViews(v: number): string {
  if (v >= 1_000_000) return (v/1_000_000).toFixed(1) + ' M';
  if (v >= 1_000)     return (v/1_000).toFixed(0) + ' k';
  return String(v);
}

// ── Composant Source Badge ─────────────────────────────────────
function SourceBadge({ source, score, status }: { source:string; score?:number; status:string }) {
  const c = SOURCE_COLORS[source]||'#64748b';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:6,
      background:status==='done'?`${c}18`:status==='launching'?'rgba(100,116,139,0.1)':'transparent',
      border:`1px solid ${status==='done'?c+'40':'#1e2035'}`, transition:'all .3s' }}>
      <span style={{ fontSize:11 }}>{SOURCE_ICONS[source]||'📡'}</span>
      {status==='launching' && <div style={{ width:8, height:8, borderRadius:'50%', border:`2px solid ${c}`, borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>}
      {status==='done'      && <span style={{ fontSize:10, fontWeight:700, color:c, fontFamily:'monospace' }}>{score}%</span>}
      {status==='skip'      && <span style={{ fontSize:8, color:'#334155' }}>—</span>}
    </div>
  );
}

// ── Composant Résultat Card ────────────────────────────────────
function ResultCard({ result, onClick, selected }: { result:VeilleResult; onClick:()=>void; selected:boolean }) {
  const vc = VERDICT_COLOR[result.verdict]||'#64748b';
  return (
    <div onClick={onClick} style={{ padding:'10px 14px', cursor:'pointer',
      background:selected?'rgba(0,229,160,0.05)':result.is_viral?'rgba(255,45,85,0.03)':'#07090f',
      borderLeft:`3px solid ${selected?'#00e5a0':result.is_viral?'#ff2d55':'#1e2035'}`,
      borderBottom:'1px solid #0f1120', transition:'all .15s', position:'relative' as const }}>
      {result.is_viral && (
        <div style={{ position:'absolute', top:6, right:8, fontSize:8, fontWeight:900, padding:'2px 6px',
          background:'rgba(255,45,85,.15)', color:'#ff2d55', border:'1px solid rgba(255,45,85,.3)',
          borderRadius:4, animation:'blink 1.5s infinite', letterSpacing:'.05em' }}>🔥 VIRAL</div>
      )}
      <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:6 }}>
        <span style={{ fontSize:14 }}>{CAT_ICONS[result.category]||'📦'}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{result.keyword}</div>
          <div style={{ fontSize:8, color:CAT_COLORS[result.category]||'#64748b', marginTop:1 }}>{result.category}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:20, fontWeight:900, color:vc, fontFamily:'monospace', lineHeight:1 }}>{result.cross_score}</div>
          <div style={{ fontSize:9, color:vc }}>{VERDICT_ICON[result.verdict]} {result.verdict}</div>
        </div>
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:result.hook_suggestion?5:0 }}>
        {result.signals.map((s,i) => (
          <span key={i} style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background:'rgba(0,229,160,0.1)', color:'#00e5a0', border:'1px solid rgba(0,229,160,0.2)' }}>{s}</span>
        ))}
      </div>
      {result.hook_suggestion && (
        <div style={{ fontSize:9, color:'#64748b', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:3 }}>
          "{result.hook_suggestion}"
        </div>
      )}
    </div>
  );
}

// ── Composant Détail Source ────────────────────────────────────
function SourceDetail({ source, data }: { source:string; data:SourceResult }) {
  const c     = SOURCE_COLORS[source]||'#64748b';
  const score = data.score||0;
  const ytVideos: YouTubeVideo[] = (data as any).items || (data.top_videos as YouTubeVideo[]) || [];
  const ttVideos: TikTokVideo[]  = source==='tiktok' ? (data.top_videos as TikTokVideo[])||[] : [];

  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
        <span style={{ fontSize:10, fontWeight:700, color:c }}>{SOURCE_ICONS[source]} {source.toUpperCase()}</span>
        <span style={{ fontSize:12, fontWeight:900, color:c, fontFamily:'monospace' }}>{score}%</span>
      </div>
      <div style={{ height:3, background:'#1e2035', borderRadius:3, overflow:'hidden', marginBottom:6 }}>
        <div style={{ height:'100%', background:c, width:`${score}%`, transition:'width 1s ease', borderRadius:3 }}/>
      </div>
      <div style={{ fontSize:9, color:'#64748b', marginBottom:6 }}>
        {source==='tiktok'   && data.total_views   && `${fmtViews(data.total_views)} vues · ${data.video_count||0} vidéos`}
        {source==='trends'   && data.avg_interest  && `Intérêt ${data.avg_interest}/100 · ${data.trend||''}`}
        {source==='youtube'  && data.total_views   && `${fmtViews(data.total_views)} vues · ${data.video_count||0} vidéos`}
        {source==='reddit'   && data.upvotes       && `${data.upvotes.toLocaleString('fr-FR')} upvotes · ${data.sentiment||''}`}
        {source==='pinterest'&& data.pin_count     && `${data.pin_count} pins`}
      </div>

      {source==='youtube' && ytVideos.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {ytVideos.slice(0,5).map((v, i) => (
            <a key={i} href={v.url||`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 9px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:8, textDecoration:'none', transition:'all .2s' }}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(239,68,68,0.12)')}
              onMouseLeave={e=>(e.currentTarget.style.background='rgba(239,68,68,0.06)')}>
              {v.thumbnail ? (
                <img src={v.thumbnail} alt="" style={{ width:48, height:32, borderRadius:4, objectFit:'cover', flexShrink:0 }}/>
              ) : (
                <div style={{ width:48, height:32, borderRadius:4, background:'rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:14 }}>▶️</div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:9, color:'#e2e8f0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:2 }}>{v.title}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:8, color:'#ef4444', fontFamily:'monospace' }}>👁 {fmtViews(v.viewCount)}</span>
                  {v.likeCount>0 && <span style={{ fontSize:8, color:'#64748b', fontFamily:'monospace' }}>👍 {fmtViews(v.likeCount)}</span>}
                  <span style={{ fontSize:8, color:'#334155', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.channel}</span>
                </div>
              </div>
              <span style={{ fontSize:9, color:'#ef4444', flexShrink:0 }}>→</span>
            </a>
          ))}
        </div>
      )}

      {source==='tiktok' && ttVideos.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {ttVideos.slice(0,3).map((v, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 9px', background:'rgba(255,45,85,0.06)', border:'1px solid rgba(255,45,85,0.15)', borderRadius:8 }}>
              <span style={{ fontSize:12, flexShrink:0 }}>🎵</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:9, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.desc||'Vidéo TikTok'}</div>
                <span style={{ fontSize:8, color:'#ff2d55', fontFamily:'monospace' }}>👁 {fmtViews(v.views)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {source==='reddit' && data.top_posts && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {data.top_posts.slice(0,3).map((p, i) => (
            <a key={i} href={p.url||'#'} target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 9px', background:'rgba(251,146,60,0.06)', border:'1px solid rgba(251,146,60,0.15)', borderRadius:8, textDecoration:'none' }}>
              <span style={{ fontSize:9, color:'#fb923c', fontFamily:'monospace', flexShrink:0 }}>↑{p.upvotes}</span>
              <span style={{ fontSize:9, color:'#e2e8f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────
export function VeillePanel() {
  const [running, setRunning]           = useState(false);
  const [results, setResults]           = useState<VeilleResult[]>([]);
  const [history, setHistory]           = useState<VeilleResult[]>([]);
  const [selected, setSelected]         = useState<VeilleResult|null>(null);
  const [sources, setSources]           = useState<Record<string,SourceEvent[]>>({});
  const [scanning, setScanning]         = useState<{keyword:string;category:string}|null>(null);
  const [progress, setProgress]         = useState({ done:0, total:0 });
  const [catFilter, setCatFilter]       = useState<string>('all');
  const [selectedCats, setSelectedCats] = useState<string[]>(CATEGORIES);
  const [showConfig, setShowConfig]     = useState(false);
  const [maxPerCat, setMaxPerCat]       = useState(3);
  const [tab, setTab]                   = useState<'live'|'history'|'cross'>('live');
  const [crossHits, setCrossHits]       = useState<VeilleResult[]>([]);
  const [detailTab, setDetailTab]       = useState<'sources'|'videos'>('sources');

  const loadHistory = useCallback(async () => {
    try {
      const d = await swarmFetch('/api/veille/history?limit=50');
      const formatted = (d.results||[]).map((r: any) => ({
        ...r,
        cross_score: r.score || 0,
        is_viral:    r.verdict === 'VIRAL',
        signal_count:r.raw_data?.signals?.length || 0,
        signals:     r.raw_data?.signals || [],
        sources:     r.raw_data?.sources || {},
      }));
      setHistory(formatted);
    } catch {}
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSSEEvent = useCallback((event: string, data: any) => {
    switch(event) {
      case 'start':
        setProgress({ done:0, total:data.total_keywords||0 });
        break;
      case 'scanning':
        setScanning({ keyword:data.keyword, category:data.category });
        setProgress(p=>({ ...p, done:data.processed||0 }));
        break;
      case 'source':
        setSources(prev => {
          const existing = prev[data.keyword]||[];
          return { ...prev, [data.keyword]: [...existing.filter(s=>s.source!==data.source), data] };
        });
        break;
      case 'result':
        setResults(prev => [...prev.filter(r=>r.keyword!==data.keyword), data].sort((a,b)=>b.cross_score-a.cross_score));
        break;
      case 'complete':
        setRunning(false); setScanning(null);
        setProgress(p=>({ ...p, done:data.total_scanned||p.total }));
        if (data.cross_hits_data) setCrossHits(data.cross_hits_data);
        loadHistory();
        break;
    }
  }, [loadHistory]);

  // ── CORRECTION CLÉ : utilise SWARM_URL depuis auth.ts ──
  const startVeille = useCallback(() => {
    if (running) return;
    setRunning(true);
    setResults([]); setSources({}); setCrossHits([]);
    setProgress({ done:0, total:0 }); setSelected(null);

    fetch(`${SWARM_URL}/api/veille`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true', // ← header ngrok
      },
      body: JSON.stringify({ categories:selectedCats, max_per_category:maxPerCat, min_score:50 }),
    }).then(async res => {
      const reader  = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'data';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream:true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try { handleSSEEvent(currentEvent, JSON.parse(line.slice(6))); } catch {}
            currentEvent = 'data';
          }
        }
      }
      setRunning(false);
      loadHistory();
    }).catch(() => setRunning(false));
  }, [running, selectedCats, maxPerCat, handleSSEEvent, loadHistory]);

  const stopVeille = () => { setRunning(false); setScanning(null); };

  const filtered    = results.filter(r=>catFilter==='all'||r.category===catFilter);
  const viralCount  = results.filter(r=>r.is_viral).length;
  const montantCount= results.filter(r=>r.verdict==='MONTANT').length;

  const getYTVideos = (r: VeilleResult): YouTubeVideo[] => {
    if (!r) return [];
    const raw = r.raw_data?.sources?.youtube || r.sources?.youtube;
    return (raw as any)?.items || (raw as any)?.top_videos || [];
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <style>{`
        @keyframes spin  { to { transform:rotate(360deg) } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:14, padding:14 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#e2e8f0', fontFamily:'monospace', letterSpacing:1 }}>🔭 RADAR DE VIRALITÉ</div>
            <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>
              Détecte ce qui monte — TikTok · Trends · YouTube · Reddit · Pinterest
              <span style={{ marginLeft:8, color:'#1e2035' }}>→ {SWARM_URL}</span>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>setShowConfig(c=>!c)} style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:8, padding:'7px 12px', color:'#64748b', fontFamily:'monospace', fontSize:10, cursor:'pointer' }}>⚙️ Config</button>
            {running ? (
              <button onClick={stopVeille} style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'8px 18px', color:'#ef4444', fontFamily:'monospace', fontSize:11, fontWeight:700, cursor:'pointer' }}>⏹ ARRÊTER</button>
            ) : (
              <button onClick={startVeille} style={{ background:'linear-gradient(135deg,#00e5a0,#00c8ff)', border:'none', borderRadius:8, padding:'9px 20px', color:'#030810', fontFamily:'monospace', fontSize:12, fontWeight:900, cursor:'pointer', boxShadow:'0 4px 16px rgba(0,229,160,0.25)' }}>🚀 LANCER LA VEILLE</button>
            )}
          </div>
        </div>

        {showConfig && (
          <div style={{ background:'#0f1120', borderRadius:10, padding:12, marginBottom:12, border:'1px solid #1e2035' }}>
            <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.1em', marginBottom:8 }}>⚙️ CONFIGURATION</div>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
              <span style={{ fontSize:10, color:'#64748b' }}>Keywords par catégorie :</span>
              {[2,3,5,10].map(n => (
                <button key={n} onClick={()=>setMaxPerCat(n)} style={{ background:maxPerCat===n?'rgba(0,229,160,0.15)':'#1e2035', border:`1px solid ${maxPerCat===n?'#00e5a0':'#334155'}`, borderRadius:6, padding:'3px 10px', color:maxPerCat===n?'#00e5a0':'#64748b', fontFamily:'monospace', fontSize:10, cursor:'pointer' }}>{n}</button>
              ))}
              <span style={{ fontSize:9, color:'#334155' }}>= ~{selectedCats.length*maxPerCat} keywords total</span>
            </div>
            <div style={{ fontSize:9, color:'#64748b', marginBottom:6 }}>Catégories :</div>
            <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
              {CATEGORIES.map(cat => (
                <button key={cat} onClick={()=>setSelectedCats(prev=>prev.includes(cat)?prev.filter(c=>c!==cat):[...prev,cat])} style={{ background:selectedCats.includes(cat)?`${CAT_COLORS[cat]}18`:'#1e2035', border:`1px solid ${selectedCats.includes(cat)?CAT_COLORS[cat]+'40':'#334155'}`, borderRadius:6, padding:'4px 10px', color:selectedCats.includes(cat)?CAT_COLORS[cat]:'#64748b', fontFamily:'monospace', fontSize:9, cursor:'pointer', transition:'all .2s' }}>
                  {CAT_ICONS[cat]} {cat}
                </button>
              ))}
            </div>
          </div>
        )}

        {running && (
          <div style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
              <span style={{ fontSize:9, color:'#00e5a0', fontFamily:'monospace' }}>{scanning?`📡 "${scanning.keyword}" (${scanning.category})`:'⏳ Initialisation...'}</span>
              <span style={{ fontSize:9, color:'#64748b', fontFamily:'monospace' }}>{progress.done}/{progress.total}</span>
            </div>
            <div style={{ height:4, background:'#1e2035', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:4, background:'linear-gradient(90deg,#00e5a0,#00c8ff)', width:`${progress.total>0?Math.round((progress.done/progress.total)*100):0}%`, transition:'width .5s ease', boxShadow:'0 0 8px rgba(0,229,160,0.4)' }}/>
            </div>
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
          {[
            { l:'Analysés',   v:results.length,   c:'#64748b' },
            { l:'🔥 Viraux',  v:viralCount,        c:'#ff2d55' },
            { l:'📈 Montants',v:montantCount,      c:'#f59e0b' },
            { l:'🔀 Croisés', v:crossHits.length,  c:'#00e5a0' },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:'#07090f', borderRadius:8, padding:'8px 10px', textAlign:'center', border:'1px solid #1e2035' }}>
              <div style={{ fontSize:18, fontWeight:900, color:c, fontFamily:'monospace', lineHeight:1 }}>{v}</div>
              <div style={{ fontSize:8, color:'#334155', marginTop:3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── LAYOUT ── */}
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>

        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8, minWidth:0 }}>
          <div style={{ display:'flex', gap:4, background:'#0b0d1a', borderRadius:10, padding:4, border:'1px solid #1e2035' }}>
            {[
              { id:'live',    label:'📡 Live',        count:filtered.length },
              { id:'cross',   label:'🔀 Croisements', count:crossHits.length },
              { id:'history', label:'📚 Historique',  count:history.length },
            ].map(t => (
              <button key={t.id} onClick={()=>setTab(t.id as any)} style={{ flex:1, padding:'7px 10px', border:'none', borderRadius:7, background:tab===t.id?'#1e2035':'transparent', color:tab===t.id?'#e2e8f0':'#64748b', fontFamily:'monospace', fontSize:9, fontWeight:700, cursor:'pointer', transition:'all .2s', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                {t.label}
                <span style={{ background:tab===t.id?'rgba(0,229,160,0.15)':'rgba(100,116,139,0.1)', color:tab===t.id?'#00e5a0':'#334155', borderRadius:10, padding:'1px 6px', fontSize:8, fontFamily:'monospace' }}>{t.count}</span>
              </button>
            ))}
          </div>

          <div style={{ display:'flex', gap:4, overflowX:'auto' }}>
            <button onClick={()=>setCatFilter('all')} style={{ flexShrink:0, padding:'3px 10px', borderRadius:6, border:`1px solid ${catFilter==='all'?'#00e5a0':'#1e2035'}`, background:catFilter==='all'?'rgba(0,229,160,0.1)':'transparent', color:catFilter==='all'?'#00e5a0':'#64748b', fontFamily:'monospace', fontSize:8, cursor:'pointer' }}>Tout</button>
            {CATEGORIES.map(cat => {
              const c = results.filter(r=>r.category===cat);
              if (!c.length) return null;
              return (
                <button key={cat} onClick={()=>setCatFilter(catFilter===cat?'all':cat)} style={{ flexShrink:0, padding:'3px 10px', borderRadius:6, border:`1px solid ${catFilter===cat?CAT_COLORS[cat]:'#1e2035'}`, background:catFilter===cat?`${CAT_COLORS[cat]}15`:'transparent', color:catFilter===cat?CAT_COLORS[cat]:'#64748b', fontFamily:'monospace', fontSize:8, cursor:'pointer' }}>
                  {CAT_ICONS[cat]} {cat} ({c.length})
                </button>
              );
            })}
          </div>

          <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12, overflow:'hidden' }}>
            <div style={{ maxHeight:500, overflowY:'auto' }}>
              {tab==='live' && (
                <>
                  {filtered.length===0 && !running && <div style={{ padding:40, textAlign:'center', color:'#334155', fontSize:11, lineHeight:1.8 }}>🔭 Lance la veille pour détecter<br/>ce qui est viral en ce moment</div>}
                  {filtered.length===0 && running  && <div style={{ padding:40, textAlign:'center', color:'#334155', fontSize:11, lineHeight:1.8 }}>📡 Scraping en cours...<br/><span style={{ color:'#00e5a0', fontSize:10 }}>{scanning?.keyword||'initialisation'}</span></div>}
                  {filtered.map(r => <ResultCard key={r.keyword} result={r} onClick={()=>setSelected(r)} selected={selected?.keyword===r.keyword}/>)}
                </>
              )}

              {tab==='cross' && (
                <>
                  {crossHits.length===0 && <div style={{ padding:40, textAlign:'center', color:'#334155', fontSize:11, lineHeight:1.8 }}>🔀 Les produits détectés sur 2+ sources apparaîtront ici</div>}
                  {crossHits.map(r => (
                    <div key={r.keyword} onClick={()=>setSelected(r)} style={{ padding:'12px 14px', borderBottom:'1px solid #0f1120', cursor:'pointer', transition:'background .1s' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='rgba(0,229,160,0.03)')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                        <span style={{ fontSize:18 }}>{CAT_ICONS[r.category]}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{r.keyword}</div>
                          <div style={{ fontSize:8, color:CAT_COLORS[r.category] }}>{r.category}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:22, fontWeight:900, color:VERDICT_COLOR[r.verdict], fontFamily:'monospace' }}>{r.cross_score}</div>
                          <div style={{ fontSize:8, color:VERDICT_COLOR[r.verdict] }}>{VERDICT_ICON[r.verdict]} {r.signal_count} sources</div>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                        {r.signals.map((s,i) => <span key={i} style={{ fontSize:9, padding:'2px 8px', borderRadius:5, background:'rgba(0,229,160,0.1)', color:'#00e5a0', border:'1px solid rgba(0,229,160,0.2)', fontWeight:700 }}>{s}</span>)}
                      </div>
                      {r.hook_suggestion && <div style={{ fontSize:10, color:'#64748b', fontStyle:'italic', marginTop:6, background:'#05060f', padding:'6px 10px', borderRadius:6, borderLeft:'2px solid #00e5a0' }}>"{r.hook_suggestion}"</div>}
                    </div>
                  ))}
                </>
              )}

              {tab==='history' && (
                <>
                  <div style={{ padding:'8px 14px', borderBottom:'1px solid #1e2035', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:9, color:'#64748b', letterSpacing:'.1em' }}>DERNIÈRES 24H — SUPABASE</span>
                    <button onClick={loadHistory} style={{ background:'none', border:'none', color:'#334155', cursor:'pointer', fontSize:12 }}>↺</button>
                  </div>
                  {history.length===0 && <div style={{ padding:32, textAlign:'center', color:'#334155', fontSize:11 }}>Lance la veille pour stocker des données</div>}
                  {history.map(r => <ResultCard key={r.id||r.keyword} result={r} onClick={()=>setSelected(r)} selected={selected?.keyword===r.keyword}/>)}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>
          {running && scanning && sources[scanning.keyword] && (
            <div style={{ background:'#0b0d1a', border:'1px solid #00c8ff30', borderRadius:12, padding:12 }}>
              <div style={{ fontSize:9, fontWeight:700, color:'#00c8ff', letterSpacing:'.1em', marginBottom:8 }}>📡 EN COURS — {scanning.keyword}</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {(['tiktok','trends','youtube','reddit','pinterest'] as string[]).map(src => {
                  const ev = sources[scanning.keyword]?.find(s=>s.source===src);
                  return <SourceBadge key={src} source={src} score={ev?.score} status={ev?.status||'waiting'}/>;
                })}
              </div>
            </div>
          )}

          {selected ? (
            <div style={{ background:'#0b0d1a', border:`1px solid ${VERDICT_COLOR[selected.verdict]}30`, borderRadius:12, padding:14, maxHeight:600, overflowY:'auto' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span style={{ fontSize:22 }}>{CAT_ICONS[selected.category]}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:'#e2e8f0' }}>{selected.keyword}</div>
                  <div style={{ fontSize:8, color:CAT_COLORS[selected.category] }}>{selected.category}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:28, fontWeight:900, color:VERDICT_COLOR[selected.verdict], fontFamily:'monospace', lineHeight:1 }}>{selected.cross_score}</div>
                  <div style={{ fontSize:10, color:VERDICT_COLOR[selected.verdict], fontWeight:700 }}>{VERDICT_ICON[selected.verdict]} {selected.verdict}</div>
                </div>
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:8, color:'#334155', letterSpacing:'.1em', marginBottom:5 }}>SIGNAUX DÉTECTÉS</div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {selected.signals.map((s,i) => <span key={i} style={{ fontSize:9, padding:'3px 8px', borderRadius:5, background:'rgba(0,229,160,0.1)', color:'#00e5a0', border:'1px solid rgba(0,229,160,0.2)', fontWeight:700 }}>{s}</span>)}
                </div>
              </div>

              <div style={{ display:'flex', gap:4, marginBottom:12, background:'#07090f', borderRadius:8, padding:3 }}>
                {[{id:'sources',label:'📊 Scores'},{id:'videos',label:'▶️ Vidéos'}].map(t => (
                  <button key={t.id} onClick={()=>setDetailTab(t.id as any)} style={{ flex:1, padding:'5px', border:'none', borderRadius:6, background:detailTab===t.id?'#1e2035':'transparent', color:detailTab===t.id?'#e2e8f0':'#64748b', fontFamily:'monospace', fontSize:9, cursor:'pointer' }}>{t.label}</button>
                ))}
              </div>

              {detailTab==='sources' && (
                <div>
                  {Object.entries(selected.sources).map(([src,data]) => data ? <SourceDetail key={src} source={src} data={data}/> : null)}
                </div>
              )}

              {detailTab==='videos' && (
                <div>
                  <div style={{ fontSize:9, color:'#64748b', letterSpacing:'.1em', marginBottom:8 }}>▶️ VIDÉOS YOUTUBE</div>
                  {getYTVideos(selected).length > 0 ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {getYTVideos(selected).map((v, i) => (
                        <a key={i} href={v.url||`https://youtube.com/watch?v=${v.videoId}`} target="_blank" rel="noopener noreferrer"
                          style={{ display:'flex', gap:8, padding:'8px 10px', background:'rgba(239,68,68,0.06)', border:'1px solid rgba(239,68,68,0.15)', borderRadius:9, textDecoration:'none', transition:'all .2s' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='rgba(239,68,68,0.12)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='rgba(239,68,68,0.06)')}>
                          {v.thumbnail ? (
                            <img src={v.thumbnail} alt="" style={{ width:72, height:48, borderRadius:5, objectFit:'cover', flexShrink:0 }}/>
                          ) : (
                            <div style={{ width:72, height:48, borderRadius:5, background:'rgba(239,68,68,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18 }}>▶️</div>
                          )}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:10, color:'#e2e8f0', fontWeight:600, lineHeight:1.4, marginBottom:4 }}>{v.title}</div>
                            <div style={{ display:'flex', gap:8 }}>
                              <span style={{ fontSize:9, color:'#ef4444', fontFamily:'monospace', fontWeight:700 }}>👁 {fmtViews(v.viewCount)}</span>
                              {v.likeCount>0 && <span style={{ fontSize:9, color:'#64748b', fontFamily:'monospace' }}>👍 {fmtViews(v.likeCount)}</span>}
                            </div>
                            <div style={{ fontSize:8, color:'#334155', marginTop:2 }}>{v.channel}</div>
                          </div>
                          <div style={{ alignSelf:'center', fontSize:12, color:'#ef4444' }}>→</div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding:20, textAlign:'center', color:'#334155', fontSize:10 }}>
                      Aucune vidéo YouTube disponible<br/>
                      <span style={{ fontSize:9, color:'#1e2035' }}>Ajoute YOUTUBE_API_KEY dans .env</span>
                    </div>
                  )}
                </div>
              )}

              {selected.hook_suggestion && (
                <div style={{ background:'rgba(0,229,160,0.05)', border:'1px solid rgba(0,229,160,0.15)', borderRadius:8, padding:'10px 12px', marginTop:12 }}>
                  <div style={{ fontSize:8, color:'#00e5a0', fontWeight:700, letterSpacing:'.1em', marginBottom:5 }}>🎬 HOOK SUGGÉRÉ</div>
                  <div style={{ fontSize:11, color:'#e2e8f0', lineHeight:1.6, fontStyle:'italic' }}>"{selected.hook_suggestion}"</div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:12 }}>
                <button style={{ padding:'8px', background:'transparent', border:'1px solid #00e5a0', color:'#00e5a0', borderRadius:8, fontFamily:'monospace', fontSize:9, fontWeight:700, cursor:'pointer' }}>🎬 Créer Script</button>
                <button style={{ padding:'8px', background:'transparent', border:'1px solid #1e2035', color:'#64748b', borderRadius:8, fontFamily:'monospace', fontSize:9, cursor:'pointer' }}>📊 Analyser</button>
              </div>
            </div>
          ) : (
            <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12, padding:24, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center', minHeight:200 }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔭</div>
              <div style={{ fontSize:11, color:'#334155', lineHeight:1.8 }}>
                Lance la veille pour détecter<br/>les produits viraux en temps réel<br/>
                <span style={{ fontSize:9, color:'#1e2035', marginTop:6, display:'block' }}>TikTok · Trends · YouTube<br/>Reddit · Pinterest</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}