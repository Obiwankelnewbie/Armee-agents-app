// ============================================================
// SWARM-CREATOR AI — App.tsx v7.0
// ✅ Onglet Analyse — données scraper stockées + visualisation + IA
// ✅ Cloche alertes temps réel (/api/alerts)
// ✅ Historique latéral gauche (/api/history)
// ✅ Jauge consommation forfait (/api/stats)
// ✅ Barre de commande rapide (Cmd+K)
// ✅ Radar hexagonal multi-sources
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSwarm } from './hooks/useSwarm';
import { AddProductForm } from './components/AddProductForm';
import { generateScript, scriptToSEOArticle, generateForumPost } from './services/scriptService';
import { fetchProducts } from './services/dataService';
import { supabase } from './lib/supabase';
import type { Agent, VideoJob, Product, AgentUnit } from './types';
import { swarmFetch } from './lib/auth';
import { VeillePanel } from './components/VeillePanel'
import { AgentsPanel } from './components/AgentsPanel'
// ── Types ─────────────────────────────────────────────────────
interface ScanResult {
  product_name: string; global_score: number;
  tiktok_score: number; youtube_score: number;
  reddit_score: number; trends_score: number; pinterest_score: number;
  verdict: 'FONCER'|'ATTENDRE'|'RISQUÉ';
  verdict_detail: string; hook_suggestion: string;
  window: string; opportunity_level: 'HIGH'|'MEDIUM'|'LOW';
  tiktok_weekly: string; tiktok_views_est: string;
  insights: string[]; scanned_at: string; data_quality?: string;
  agents?: string[];
}

interface Alert {
  id: string; product_name: string; global_score: number;
  verdict: string; hook_suggestion: string; window_days: string;
  is_read: boolean; created_at: string;
}

interface HistoryItem {
  id: string; keyword: string; global_score: number;
  verdict: string; opportunity_level: string;
  data_quality: string; scanned_at: string;
}

interface ClientStats {
  plan: string; scans_count: number; products_count: number;
  scripts_count: number; total_gmv: number; total_commission: number;
}

interface LiveEvent {
  id: number; time: string; product: string;
  score: number; verdict: string; color: string; icon: string;
}

interface RawScrapeRow {
  id: string; keyword: string; source: string;
  scraped_at: string; items_count: number;
  top_score: number; trend_direction: string;
  total_views: number; summary: string;
  raw_data: any;
}

type Tab = 'swarm'|'analyse'|'pipeline'|'produits'|'redacteur'|'forum';

const PLAN_LIMITS: Record<string, number> = {
  free:10, starter:100, pro:500, enterprise:9999
};

const STATUS_COLOR: Record<string,string> = {
  scripting:'#3b82f6', rendering:'#f59e0b', publishing:'#00e5a0',
  idle:'#334155', error:'#ef4444', offline:'#1e2035',
};
const STATUS_ICON: Record<string,string> = {
  scripting:'✍️', rendering:'🎬', publishing:'📲', idle:'😴', error:'⚠️', offline:'⛔',
};
const AGENT_COLS = [
  { unit:'tiktok_shop',  label:'TikTok Shop',  color:'#00c8ff', icon:'🛒', desc:'Hook-Body-CTA' },
  { unit:'affiliation',  label:'Affiliation',   color:'#f59e0b', icon:'🔗', desc:'Liens & parrainage' },
  { unit:'media_buzz',   label:'Media & Buzz',  color:'#3b82f6', icon:'🛰️', desc:'Scripts viraux' },
  { unit:'forum',        label:'Forum',         color:'#fb923c', icon:'💬', desc:'Community' },
  { unit:'redacteur',    label:'Rédacteur SEO', color:'#a78bfa', icon:'✍️', desc:'Articles' },
  { unit:'market_intel', label:'Market Intel',  color:'#00e5a0', icon:'📡', desc:'Radar Trends' },
];

const vc = (v: string) => v==='FONCER'?'#00e5a0':v==='ATTENDRE'?'#f59e0b':'#ef4444';
const gc = (s: number) => s>=75?'#00e5a0':s>=55?'#f59e0b':'#ef4444';

// ── API helpers ───────────────────────────────────────────────
async function callScanAPI(productName: string): Promise<ScanResult> {
  const data = await swarmFetch('/api/scan', {
    method:'POST', body:JSON.stringify({ product_name:productName }),
  });
  if (!data.scan) throw new Error('Réponse invalide');
  return { ...data.scan, scanned_at:new Date().toISOString(), data_quality:data.data_quality };
}

// Sauvegarde les données brutes Apify dans Supabase
async function saveRawScrapeData(keyword: string, source: string, items: any[], meta: any) {
  if (!items?.length) return;
  try {
    await supabase.from('raw_scrape_data').insert({
      client_id:   '00000000-0000-0000-0000-000000000001',
      keyword,
      source,
      items_count: items.length,
      top_score:   meta.score || 0,
      trend_direction: meta.trend || null,
      total_views: meta.total_views || 0,
      raw_data:    items,
    });
  } catch (e) { console.warn('saveRawScrapeData:', e); }
}

// ── Composant : Cloche Alertes ────────────────────────────────
function AlertBell() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const unread = alerts.filter(a => !a.is_read).length;
  const ref    = useRef<HTMLDivElement>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try { const d = await swarmFetch('/api/alerts'); setAlerts(d.alerts||[]); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const t = setInterval(fetchAlerts, 30000);
    return () => clearInterval(t);
  }, [fetchAlerts]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => { setOpen(o=>!o); if (!open) fetchAlerts(); }} style={{
        position:'relative', background:'none', border:'1px solid #1e2035',
        borderRadius:8, padding:'6px 10px', cursor:'pointer',
        color:unread>0?'#f59e0b':'#64748b', fontSize:16, transition:'all .2s',
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position:'absolute', top:-4, right:-4, width:16, height:16,
            borderRadius:'50%', background:'#ef4444', color:'white',
            fontSize:9, fontWeight:900, display:'flex', alignItems:'center', justifyContent:'center',
            animation:'blink 1.5s infinite',
          }}>{unread}</span>
        )}
      </button>
      {open && (
        <div style={{
          position:'absolute', top:40, right:0, width:320, zIndex:1000,
          background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12,
          boxShadow:'0 20px 60px rgba(0,0,0,0.5)', animation:'slideIn .2s ease',
        }}>
          <div style={{ padding:'12px 14px', borderBottom:'1px solid #1e2035', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#00e5a0', letterSpacing:'.1em' }}>🎯 OPPORTUNITÉS DÉTECTÉES</span>
            <span style={{ fontSize:9, color:'#64748b' }}>{alerts.length} alertes</span>
          </div>
          {loading && <div style={{ padding:20, textAlign:'center', color:'#334155', fontSize:11 }}>Chargement...</div>}
          {!loading && alerts.length===0 && <div style={{ padding:20, textAlign:'center', color:'#334155', fontSize:11 }}>Aucune opportunité HIGH pour l'instant</div>}
          <div style={{ maxHeight:320, overflowY:'auto' }}>
            {alerts.map(a => (
              <div key={a.id} style={{ padding:'10px 14px', borderBottom:'1px solid #0f1120', borderLeft:`3px solid ${vc(a.verdict)}`, cursor:'pointer' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:'#e2e8f0', fontWeight:600 }}>{a.product_name}</span>
                  <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                    <span style={{ fontSize:14, fontWeight:900, color:vc(a.verdict), fontFamily:'monospace' }}>{a.global_score}</span>
                    <span style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background:vc(a.verdict)+'20', color:vc(a.verdict), fontWeight:700 }}>{a.verdict}</span>
                  </div>
                </div>
                <div style={{ fontSize:9, color:'#64748b', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>"{a.hook_suggestion}"</div>
                <div style={{ fontSize:8, color:'#334155', marginTop:3 }}>Fenêtre: {a.window_days} · {new Date(a.created_at).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
              </div>
            ))}
          </div>
          <div style={{ padding:'8px 14px', borderTop:'1px solid #1e2035', textAlign:'center' }}>
            <span style={{ fontSize:9, color:'#334155' }}>Mis à jour toutes les 30s</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Composant : Jauge Consommation ────────────────────────────
function ConsumptionGauge() {
  const [stats, setStats] = useState<ClientStats|null>(null);
  const [open, setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    swarmFetch('/api/stats').then(d=>setStats(d.stats)).catch(()=>{});
    const t = setInterval(() => swarmFetch('/api/stats').then(d=>setStats(d.stats)).catch(()=>{}), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (!stats) return null;
  const plan = stats.plan||'free', limit = PLAN_LIMITS[plan]||10;
  const used = stats.scans_count||0, remaining = Math.max(0,limit-used);
  const pct  = Math.min(100,Math.round((used/limit)*100));
  const color = pct>=90?'#ef4444':pct>=70?'#f59e0b':'#00e5a0';
  const planColor = plan==='enterprise'?'#a78bfa':plan==='pro'?'#00c8ff':plan==='starter'?'#f59e0b':'#64748b';

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        display:'flex', alignItems:'center', gap:8, background:'#0f1120',
        border:'1px solid #1e2035', borderRadius:8, padding:'6px 12px', cursor:'pointer', transition:'all .2s',
      }}>
        <div style={{ display:'flex', flexDirection:'column', gap:3, alignItems:'flex-start' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:8, color:planColor, fontWeight:700, letterSpacing:'.08em', textTransform:'uppercase' as const, fontFamily:'monospace' }}>{plan.toUpperCase()}</span>
            <span style={{ fontSize:9, color, fontWeight:700, fontFamily:'monospace' }}>{remaining}/{limit}</span>
          </div>
          <div style={{ width:80, height:3, background:'#1e2035', borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', background:color, width:`${100-pct}%`, borderRadius:3, transition:'width .5s ease' }}/>
          </div>
        </div>
        <span style={{ fontSize:10, color:'#64748b' }}>⚡</span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:44, right:0, width:260, zIndex:1000,
          background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12,
          padding:16, boxShadow:'0 20px 60px rgba(0,0,0,0.5)', animation:'slideIn .2s ease',
        }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#64748b', letterSpacing:'.1em', marginBottom:12 }}>⚡ CONSOMMATION FORFAIT</div>
          <div style={{ textAlign:'center', marginBottom:14 }}>
            <div style={{ position:'relative', width:80, height:80, margin:'0 auto' }}>
              <svg width="80" height="80" style={{ transform:'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="32" fill="none" stroke="#1e2035" strokeWidth={6}/>
                <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth={6}
                  strokeLinecap="round" strokeDasharray={`${2*Math.PI*32}`}
                  strokeDashoffset={`${2*Math.PI*32*(1-(100-pct)/100)}`}
                  style={{ transition:'stroke-dashoffset 1s ease' }}/>
              </svg>
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:16, fontWeight:900, color, fontFamily:'monospace' }}>{100-pct}%</span>
                <span style={{ fontSize:7, color:'#64748b' }}>restant</span>
              </div>
            </div>
          </div>
          {[
            { l:'Scans utilisés', v:used, c:'#e2e8f0' },
            { l:'Scans restants', v:remaining, c:color },
            { l:'Limite mensuelle', v:limit, c:'#64748b' },
            { l:'GMV total', v:`${(stats.total_gmv||0).toFixed(2)} €`, c:'#00e5a0' },
          ].map(({l,v,c}) => (
            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #0f1120' }}>
              <span style={{ fontSize:10, color:'#64748b' }}>{l}</span>
              <span style={{ fontSize:10, fontWeight:700, color:c, fontFamily:'monospace' }}>{v}</span>
            </div>
          ))}
          <button style={{ width:'100%', marginTop:10, padding:'8px', background:'linear-gradient(135deg,#00e5a0,#00c8ff)', border:'none', borderRadius:8, color:'#030810', fontFamily:'monospace', fontSize:10, fontWeight:700, cursor:'pointer' }}>
            ⚡ UPGRADER MON PLAN
          </button>
        </div>
      )}
    </div>
  );
}

// ── Composant : Historique Latéral ────────────────────────────
function HistorySidebar({ onSelect }: { onSelect: (item: HistoryItem) => void }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string|null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try { const d = await swarmFetch('/api/history?limit=15'); setHistory(d.history||[]); }
    catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return (
    <div style={{ width:200, flexShrink:0, background:'#07090f', borderRight:'1px solid #1e2035', display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      <div style={{ padding:'10px 12px', borderBottom:'1px solid #1e2035', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.1em' }}>📋 HISTORIQUE</span>
        <button onClick={fetchHistory} style={{ background:'none', border:'none', color:'#334155', cursor:'pointer', fontSize:12 }}>↺</button>
      </div>
      {loading && <div style={{ padding:16, color:'#334155', fontSize:10, textAlign:'center' }}>Chargement...</div>}
      <div style={{ flex:1, overflowY:'auto' }}>
        {history.map(item => (
          <div key={item.id} onClick={() => { setSelected(item.id); onSelect(item); }} style={{
            padding:'8px 12px', cursor:'pointer',
            background:selected===item.id?'rgba(0,229,160,0.06)':'transparent',
            borderLeft:`2px solid ${selected===item.id?vc(item.verdict):'transparent'}`,
            borderBottom:'1px solid #0f1120', transition:'all .15s',
          }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
              <span style={{ fontSize:10, color:'#e2e8f0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:6 }}>{item.keyword}</span>
              <span style={{ fontSize:11, fontWeight:900, color:gc(item.global_score), fontFamily:'monospace', flexShrink:0 }}>{item.global_score}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:vc(item.verdict)+'18', color:vc(item.verdict), fontWeight:700 }}>{item.verdict}</span>
              {item.data_quality==='real' && <span style={{ fontSize:7, color:'#00e5a0', border:'1px solid rgba(0,229,160,0.3)', borderRadius:3, padding:'1px 4px' }}>RÉEL</span>}
              <span style={{ fontSize:7, color:'#334155', marginLeft:'auto' }}>{new Date(item.scanned_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span>
            </div>
          </div>
        ))}
        {!loading && history.length===0 && <div style={{ padding:20, color:'#334155', fontSize:10, textAlign:'center', lineHeight:1.6 }}>Lance ton premier scan pour voir l'historique ici</div>}
      </div>
    </div>
  );
}

// ── Composant : Radar Hexagonal ───────────────────────────────
function HexRadar({ scores }: { scores: { tiktok:number; youtube:number; reddit:number; trends:number; pinterest:number } }) {
  const cx=80, cy=80, r=60;
  const labels = ['TikTok','YouTube','Reddit','Trends','Pinterest','—'];
  const values = [scores.tiktok,scores.youtube,scores.reddit,scores.trends,scores.pinterest,0].map(v=>v/100);
  const hexPoints = (radius: number) => Array.from({length:6},(_,i) => { const a=(Math.PI/3)*i-Math.PI/2; return [cx+radius*Math.cos(a),cy+radius*Math.sin(a)]; });
  const dataPoints = values.map((v,i) => { const a=(Math.PI/3)*i-Math.PI/2; return [cx+r*v*Math.cos(a),cy+r*v*Math.sin(a)]; });
  return (
    <svg width={160} height={160} style={{ overflow:'visible' }}>
      {[0.25,0.5,0.75,1].map(f => <polygon key={f} points={hexPoints(r*f).map(p=>p.join(',')).join(' ')} fill="none" stroke="#1e2035" strokeWidth={f===1?1:0.5}/>)}
      {hexPoints(r).map(([x,y],i) => <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#1e2035" strokeWidth={0.5}/>)}
      <polygon points={dataPoints.map(p=>p.join(',')).join(' ')} fill="rgba(0,229,160,0.15)" stroke="#00e5a0" strokeWidth={1.5}/>
      {dataPoints.map(([x,y],i) => <circle key={i} cx={x} cy={y} r={3} fill="#00e5a0" style={{ filter:'drop-shadow(0 0 3px #00e5a0)' }}/>)}
      {hexPoints(r+16).map(([x,y],i) => <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ fontSize:7, fill:'#64748b', fontFamily:'monospace' }}>{labels[i]}</text>)}
    </svg>
  );
}

// ── Composant : Barre de Commande Rapide ─────────────────────
function CommandPalette({ products, onScan }: { products:Product[]; onScan:(name:string)=>void }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState('');
  const inputRef          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey||e.ctrlKey)&&e.key==='k') { e.preventDefault(); setOpen(o=>!o); setQuery(''); }
      if (e.key==='Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => { if (open) setTimeout(()=>inputRef.current?.focus(),50); }, [open]);

  const filtered = query ? products.filter(p=>p.product_name.toLowerCase().includes(query.toLowerCase())||p.brand_name.toLowerCase().includes(query.toLowerCase())) : products.slice(0,6);

  if (!open) return (
    <button onClick={()=>setOpen(true)} style={{ display:'flex', alignItems:'center', gap:6, background:'#0f1120', border:'1px solid #1e2035', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'#64748b' }}>
      <span style={{ fontSize:11 }}>⌘K</span>
      <span style={{ fontSize:9, fontFamily:'monospace' }}>Scan rapide</span>
    </button>
  );

  return (
    <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)', display:'flex', alignItems:'flex-start', justifyContent:'center', paddingTop:80 }} onClick={()=>setOpen(false)}>
      <div onClick={e=>e.stopPropagation()} style={{ width:480, background:'#0b0d1a', border:'1px solid #00c8ff40', borderRadius:16, overflow:'hidden', boxShadow:'0 40px 100px rgba(0,200,255,0.1)', animation:'popIn .2s cubic-bezier(.34,1.56,.64,1)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderBottom:'1px solid #1e2035' }}>
          <span style={{ fontSize:16, color:'#00c8ff' }}>⚡</span>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher un produit à scanner..." style={{ flex:1, background:'none', border:'none', outline:'none', color:'#e2e8f0', fontSize:14, fontFamily:'monospace' }}/>
          <span style={{ fontSize:9, color:'#334155', fontFamily:'monospace' }}>ESC pour fermer</span>
        </div>
        <div style={{ maxHeight:300, overflowY:'auto' }}>
          {filtered.map(p => (
            <div key={p.id} onClick={()=>{ onScan(p.product_name); setOpen(false); }} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', borderBottom:'1px solid #0f1120', transition:'background .1s' }}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(0,200,255,0.05)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
              <span style={{ fontSize:16 }}>📦</span>
              <div>
                <div style={{ fontSize:12, color:'#e2e8f0', fontWeight:600 }}>{p.product_name}</div>
                <div style={{ fontSize:10, color:'#64748b' }}>{p.brand_name} · {p.category} · {p.price} €</div>
              </div>
              <span style={{ marginLeft:'auto', fontSize:9, color:'#00c8ff', fontFamily:'monospace' }}>→ SCANNER</span>
            </div>
          ))}
          {filtered.length===0 && <div style={{ padding:20, color:'#334155', fontSize:11, textAlign:'center' }}>Aucun produit trouvé</div>}
        </div>
      </div>
    </div>
  );
}

// ── Composant : Live Feed ─────────────────────────────────────
function LiveFeed({ events }: { events:LiveEvent[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events]);
  return (
    <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12, padding:12, marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:'#00e5a0', boxShadow:'0 0 6px #00e5a0', animation:'blink 1.5s infinite' }}/>
        <span style={{ fontSize:9, fontWeight:700, color:'#00e5a0', letterSpacing:'.1em' }}>LIVE INTEL FEED</span>
        <span style={{ fontSize:8, color:'#334155', marginLeft:'auto' }}>auto-scan 90s</span>
      </div>
      <div ref={ref} style={{ height:110, overflowY:'auto', display:'flex', flexDirection:'column', gap:3 }}>
        {events.length===0 && <div style={{ color:'#334155', fontSize:10, textAlign:'center', paddingTop:36 }}>En attente du premier scan...</div>}
        {events.map(ev => (
          <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'3px 7px', borderRadius:5, background:'#0f1120', borderLeft:`2px solid ${ev.color}` }}>
            <span style={{ fontSize:10 }}>{ev.icon}</span>
            <span style={{ fontFamily:'monospace', fontSize:7, color:'#334155', flexShrink:0 }}>{ev.time}</span>
            <span style={{ fontSize:9, color:'#e2e8f0', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.product}</span>
            <span style={{ fontSize:11, fontWeight:900, color:ev.color, fontFamily:'monospace' }}>{ev.score}</span>
            <span style={{ fontSize:7, padding:'1px 4px', borderRadius:3, background:ev.color+'20', color:ev.color, fontWeight:700 }}>{ev.verdict}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Composant : Score Circle ──────────────────────────────────
function ScoreCircle({ score, label, size=140 }: { score:number; label:string; size?:number }) {
  const r=size/2-10, circ=2*Math.PI*r, offset=circ-(score/100)*circ;
  const color=score>=75?'#00e5a0':score>=55?'#f59e0b':'#ef4444';
  return (
    <div style={{ position:'relative', width:size, height:size, margin:'0 auto' }}>
      <svg width={size} height={size} style={{ transform:'rotate(-90deg)', filter:`drop-shadow(0 0 10px ${color}60)` }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e2035" strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition:'stroke-dashoffset 1.2s ease' }}/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:size*0.22, fontWeight:900, color, lineHeight:1, fontFamily:'monospace' }}>{score}%</span>
        <span style={{ fontSize:size*0.08, color:'#64748b', letterSpacing:'.05em' }}>{label}</span>
      </div>
    </div>
  );
}

// ── Composant : Scanner Panel ─────────────────────────────────
function ScannerPanel({ products, onNewEvent, autoScanKeyword }: { products:Product[]; onNewEvent:(ev:LiveEvent)=>void; autoScanKeyword?:string }) {
  const [scanning, setScanning]       = useState(false);
  const [results, setResults]         = useState<ScanResult[]>([]);
  const [current, setCurrent]         = useState<ScanResult|null>(null);
  const [currentProd, setCurrentProd] = useState('');
  const [autoMode, setAutoMode]       = useState(false);
  const [nextIn, setNextIn]           = useState(90);
  const autoRef  = useRef<any>(null);
  const countRef = useRef<any>(null);
  const eid      = useRef(0);

  const makeEvent = (r: ScanResult): LiveEvent => ({
    id:++eid.current,
    time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),
    product:r.product_name, score:r.global_score, verdict:r.verdict,
    color:vc(r.verdict), icon:r.verdict==='FONCER'?'🎯':r.verdict==='ATTENDRE'?'⏳':'⚠️'
  });

  const scanOne = useCallback(async (name: string) => {
    setCurrentProd(name);
    try {
      const result = await callScanAPI(name);
      setCurrent(result);
      setResults(prev => { const f=prev.filter(r=>r.product_name!==result.product_name); return [...f,result]; });
      onNewEvent(makeEvent(result));
      // Sauvegarde les données brutes si disponibles
      if (result.data_quality==='real') {
        const src = result as any;
        if (src.sources?.tiktok)  saveRawScrapeData(name,'tiktok', src.sources.tiktok.top_videos||[], { score:src.tiktok_score, total_views:src.sources.tiktok.total_views });
        if (src.sources?.google_trends) saveRawScrapeData(name,'trends',[src.sources.google_trends],{ score:src.trends_score, trend:src.sources.google_trends.trend });
        if (src.sources?.youtube) saveRawScrapeData(name,'youtube',src.sources.youtube.top_videos||[],{ score:src.youtube_score, total_views:src.sources.youtube.total_views });
        if (src.sources?.reddit)  saveRawScrapeData(name,'reddit', src.sources.reddit.top_posts||[], { score:src.reddit_score });
      }
    } catch {
      onNewEvent({ id:++eid.current, time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), product:name, score:0, verdict:'ERREUR', color:'#ef4444', icon:'❌' });
    }
    setCurrentProd('');
  }, [onNewEvent]);

  useEffect(() => { if (autoScanKeyword) scanOne(autoScanKeyword); }, [autoScanKeyword]);

  const runBatch = useCallback(async () => {
    if (!products.length||scanning) return;
    setScanning(true);
    for (const p of products.slice(0,5)) { await scanOne(p.product_name); await new Promise(r=>setTimeout(r,500)); }
    setScanning(false); setNextIn(90);
  }, [products, scanning, scanOne]);

  useEffect(() => {
    if (autoMode&&products.length>0) {
      runBatch();
      autoRef.current  = setInterval(runBatch, 90000);
      countRef.current = setInterval(()=>setNextIn(n=>n<=1?90:n-1), 1000);
    }
    return () => { clearInterval(autoRef.current); clearInterval(countRef.current); };
  }, [autoMode]);

  const sorted = [...results].sort((a,b)=>b.global_score-a.global_score);
  const opportunities = sorted.filter(r=>r.opportunity_level==='HIGH');
  const topResult = current||sorted[0]||null;
  const hasScores = topResult&&(topResult.tiktok_score||topResult.youtube_score);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      <div style={{ background:'#0b0d1a', border:'1px solid #00c8ff30', borderRadius:16, padding:18 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:'50%', border:'2px solid #00c8ff', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:'#00c8ff', boxShadow:'0 0 6px #00c8ff', animation:'blink 1.5s infinite' }}/>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:900, color:'#00c8ff', letterSpacing:2, fontFamily:'monospace' }}>SWARM SCAN</div>
              <div style={{ fontSize:8, color:'#64748b' }}>V2.0 · ANALYSEUR MULTI-SOURCE</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button onClick={()=>setAutoMode(m=>!m)} style={{ background:autoMode?'rgba(0,200,255,0.1)':'#0f1120', color:autoMode?'#00c8ff':'#64748b', border:`1px solid ${autoMode?'#00c8ff':'#1e2035'}`, borderRadius:7, padding:'5px 10px', fontFamily:'monospace', fontSize:9, fontWeight:700, cursor:'pointer' }}>
              {autoMode?`⚡ AUTO — ${nextIn}s`:'⚡ AUTO'}
            </button>
            <button onClick={runBatch} disabled={scanning||!products.length} style={{ background:scanning?'#1e2035':'linear-gradient(135deg,#00e5a0,#00c8ff)', color:scanning?'#64748b':'#030810', border:'none', borderRadius:7, padding:'5px 14px', fontFamily:'monospace', fontSize:9, fontWeight:900, cursor:scanning?'not-allowed':'pointer' }}>
              {scanning?`📡 ${currentProd.slice(0,12)}...`:'🚀 SCANNER'}
            </button>
          </div>
        </div>

        {scanning && <div style={{ height:2, background:'#1e2035', borderRadius:2, overflow:'hidden', marginBottom:14 }}><div style={{ height:'100%', background:'linear-gradient(90deg,#00e5a0,#00c8ff)', width:'100%', animation:'blink 1s infinite' }}/></div>}

        {topResult && (
          <div style={{ display:'flex', gap:16, alignItems:'center', justifyContent:'center', marginBottom:14, flexWrap:'wrap' }}>
            <div style={{ textAlign:'center' }}>
              <ScoreCircle score={topResult.global_score} label="POTENTIEL" size={140}/>
              <div style={{ marginTop:10 }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:8, border:`1px solid ${vc(topResult.verdict)}`, borderRadius:30, padding:'7px 18px', background:`${vc(topResult.verdict)}10` }}>
                  <div style={{ width:6, height:6, borderRadius:'50%', background:vc(topResult.verdict), animation:'blink 1.5s infinite' }}/>
                  <span style={{ fontSize:13, fontWeight:900, color:vc(topResult.verdict), letterSpacing:2, fontFamily:'monospace' }}>VERDICT · {topResult.verdict}</span>
                </div>
              </div>
              <div style={{ fontSize:10, color:'#64748b', marginTop:6 }}>{topResult.verdict_detail}</div>
              {topResult.data_quality==='real' && <div style={{ fontSize:8, color:'#00e5a0', marginTop:3 }}>✅ Données réelles Apify</div>}
            </div>
            {hasScores && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                <HexRadar scores={{ tiktok:topResult.tiktok_score||0, youtube:topResult.youtube_score||0, reddit:topResult.reddit_score||0, trends:topResult.trends_score||0, pinterest:topResult.pinterest_score||0 }}/>
                <span style={{ fontSize:8, color:'#334155' }}>Radar multi-sources</span>
              </div>
            )}
          </div>
        )}

        {topResult && (
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            {[
              { icon:'🎵', label:'TIKTOK',  score:topResult.tiktok_score,  sub:topResult.tiktok_weekly,     sub2:topResult.tiktok_views_est, color:'#ff2d55' },
              { icon:'📊', label:'TRENDS',  score:topResult.trends_score,  sub:topResult.data_quality==='real'?'Données réelles':'Estimation', sub2:'France', color:'#00e5a0' },
              { icon:'▶️', label:'YOUTUBE', score:topResult.youtube_score, sub:(topResult as any).youtube_views_est||'—', sub2:'vues', color:'#ef4444' },
            ].map(({icon,label,score,sub,sub2,color}) => (
              <div key={label} style={{ flex:1, background:`linear-gradient(135deg,${color}10,${color}05)`, border:`1px solid ${color}30`, borderRadius:12, padding:'12px 10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <span style={{ fontSize:12 }}>{icon}</span>
                  <span style={{ fontSize:8, fontWeight:700, color:'#64748b', letterSpacing:'.08em' }}>{label}</span>
                </div>
                <div style={{ fontSize:28, fontWeight:900, color, lineHeight:1, fontFamily:'monospace', marginBottom:3 }}>{score||0}%</div>
                {sub && <div style={{ fontSize:8, color, fontWeight:600 }}>{sub}</div>}
                {sub2 && <div style={{ fontSize:8, color:'#64748b' }}>{sub2}</div>}
                <div style={{ height:2, background:'#1e2035', borderRadius:2, marginTop:6, overflow:'hidden' }}>
                  <div style={{ height:'100%', background:color, width:`${score||0}%`, transition:'width 1s ease' }}/>
                </div>
              </div>
            ))}
          </div>
        )}

        {topResult && (
          <div style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:10, padding:12, marginBottom:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
              <div style={{ width:5, height:5, borderRadius:'50%', background:'#00c8ff', animation:'blink 1.5s infinite' }}/>
              <span style={{ fontSize:9, fontWeight:700, color:'#00c8ff', letterSpacing:'.1em' }}>RECOMMANDATIONS SWARM</span>
            </div>
            {[
              { n:1, label:'Hook viral', val:`"${topResult.hook_suggestion}"` },
              { n:2, label:"Fenêtre d'opportunité", val:`${topResult.window} — agissez maintenant` },
              { n:3, label:'Agents recommandés', val:topResult.agents?.join(' · ')||'Script Master · Créateur Hook · Pipeline Swarm' },
            ].map(({n,label,val}) => (
              <div key={n} style={{ display:'flex', gap:8, marginBottom:5, alignItems:'flex-start' }}>
                <div style={{ width:14, height:14, borderRadius:4, background:'#1e2035', display:'flex', alignItems:'center', justifyContent:'center', fontSize:7, color:'#64748b', flexShrink:0, marginTop:1 }}>{n}</div>
                <div style={{ fontSize:10, color:'#e2e8f0', lineHeight:1.5 }}><span style={{ color:'#00c8ff', fontWeight:700 }}>{label} : </span>{val}</div>
              </div>
            ))}
          </div>
        )}

        {topResult && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button style={{ background:'transparent', border:'1px solid #00e5a0', color:'#00e5a0', borderRadius:10, padding:10, fontFamily:'monospace', fontSize:11, fontWeight:900, cursor:'pointer' }}>🎬 GÉNÉRER SCRIPT</button>
            <button style={{ background:'linear-gradient(135deg,#1a1f3a,#0f1428)', border:'1px solid #334155', color:'#e2e8f0', borderRadius:10, padding:10, fontFamily:'monospace', fontSize:11, fontWeight:900, cursor:'pointer' }}>⚔️ DÉPLOYER SWARM</button>
          </div>
        )}

        {!topResult&&!scanning && (
          <div style={{ textAlign:'center', padding:'24px 0', color:'#334155', fontSize:11 }}>
            {products.length===0?'Ajoute des produits pour commencer':'Lance le scan ou active AUTO'}
          </div>
        )}
      </div>

      {sorted.length>1 && (
        <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12, padding:14 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.1em', marginBottom:10 }}>📊 COMPARATIF PRODUITS</div>
          {sorted.map((r,i) => (
            <div key={r.product_name} onClick={()=>setCurrent(r)} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:8, marginBottom:5, cursor:'pointer', background:current?.product_name===r.product_name?'#0f1428':'#05060f', border:`1px solid ${current?.product_name===r.product_name?'#00c8ff30':'#1e2035'}`, transition:'all .15s' }}>
              <span style={{ fontSize:10, fontWeight:700, color:'#334155', width:14 }}>{i+1}</span>
              <span style={{ flex:1, fontSize:11, color:'#e2e8f0', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.product_name}</span>
              <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                {[{v:r.tiktok_score,c:'#ff2d55'},{v:r.youtube_score,c:'#ef4444'},{v:r.trends_score,c:'#00e5a0'},{v:r.reddit_score,c:'#fb923c'}].map((s,j)=>(
                  <span key={j} style={{ fontSize:7, color:s.c, fontFamily:'monospace' }}>{s.v}</span>
                ))}
              </div>
              <span style={{ fontSize:16, fontWeight:900, color:gc(r.global_score), fontFamily:'monospace', minWidth:24, textAlign:'right' }}>{r.global_score}</span>
              <span style={{ fontSize:8, padding:'1px 5px', borderRadius:4, background:vc(r.verdict)+'18', color:vc(r.verdict), fontWeight:700 }}>{r.verdict}</span>
            </div>
          ))}
        </div>
      )}

      {opportunities.length>0 && (
        <div style={{ background:'rgba(0,229,160,0.04)', border:'1px solid rgba(0,229,160,0.15)', borderRadius:12, padding:12 }}>
          <div style={{ fontSize:9, fontWeight:700, color:'#00e5a0', letterSpacing:'.1em', marginBottom:8 }}>🎯 {opportunities.length} OPPORTUNITÉ{opportunities.length>1?'S':''} HAUTE PRIORITÉ</div>
          {opportunities.map((r,i)=>(
            <div key={i} onClick={()=>setCurrent(r)} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 0', borderBottom:i<opportunities.length-1?'1px solid rgba(0,229,160,0.08)':'none', cursor:'pointer' }}>
              <span style={{ fontSize:18, fontWeight:900, color:'#00e5a0', fontFamily:'monospace', minWidth:26 }}>{r.global_score}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, color:'#e2e8f0', fontWeight:700 }}>{r.product_name}</div>
                <div style={{ fontSize:9, color:'#64748b', fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>"{r.hook_suggestion}"</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:8, fontWeight:700, padding:'2px 6px', borderRadius:4, background:'rgba(0,229,160,0.1)', color:'#00e5a0' }}>FONCER</div>
                <div style={{ fontSize:8, color:'#64748b' }}>{r.window}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant : Agents Column ─────────────────────────────────
function AgentsColumn({ agents }: { agents: Agent[] }) {
  const byUnit = agents.reduce((acc,a)=>{ const u=a.unit??'tiktok_shop'; if(!acc[u])acc[u]=[]; acc[u].push(a); return acc; }, {} as Record<string,Agent[]>);
  return (
    <div style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:9, fontWeight:700, color:'#64748b', letterSpacing:'.1em', textTransform:'uppercase' as const }}>Agents IA</div>
      {AGENT_COLS.map(({unit,label,color,icon,desc}) => {
        const ua = byUnit[unit]||[];
        return (
          <div key={unit} style={{ background:'#0b0d1a', border:`1px solid ${color}25`, borderRadius:12, padding:12, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,${color},transparent)` }}/>
            <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:ua.length?8:0 }}>
              <span style={{ fontSize:18 }}>{icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:800, color }}>{label}</div>
                <div style={{ fontSize:8, color:'#334155' }}>{desc}</div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:color+'18', color, border:`1px solid ${color}30` }}>{ua.length}</div>
            </div>
            {ua.length>0 && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:5 }}>
                {ua.map(agent => {
                  const sc = STATUS_COLOR[agent.status]??'#334155';
                  return (
                    <div key={agent.id} style={{ background:'#05060f', border:`1px solid ${sc}33`, borderRadius:7, padding:'7px 6px', textAlign:'center', position:'relative' }}>
                      <div style={{ position:'absolute', top:3, right:3, width:4, height:4, borderRadius:'50%', background:sc, boxShadow:['publishing','rendering'].includes(agent.status)?`0 0 4px ${sc}`:'none' }}/>
                      <div style={{ fontSize:16, marginBottom:3 }}>{STATUS_ICON[agent.status]??'🤖'}</div>
                      <div style={{ fontSize:8, color:'#e2e8f0', fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{agent.name}</div>
                      <div style={{ fontSize:7, color:sc, marginTop:1 }}>{agent.status}</div>
                      <div style={{ fontSize:7, color:'#334155' }}>{agent.videos_produced_today??0} vidéos</div>
                    </div>
                  );
                })}
              </div>
            )}
            {ua.length===0 && <div style={{ fontSize:9, color:'#334155', textAlign:'center' }}>Aucun agent</div>}
          </div>
        );
      })}
    </div>
  );
}

// ── Composant : Onglet Analyse ────────────────────────────────
function AnalyseTab() {
  const [rows, setRows]           = useState<RawScrapeRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<RawScrapeRow|null>(null);
  const [filterSource, setFilter] = useState<string>('all');
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('raw_scrape_data')
        .select('*')
        .order('scraped_at', { ascending:false })
        .limit(100);
      if (filterSource !== 'all') query = query.eq('source', filterSource);
      const { data, error } = await query;
      if (error) throw error;
      setRows(data || []);
    } catch (e) { console.error('loadData:', e); }
    finally { setLoading(false); }
  }, [filterSource]);

  useEffect(() => { loadData(); }, [loadData]);

  // Analyse IA d'un produit
  const analyseWithAI = async (keyword: string) => {
    setAiLoading(true);
    setAiAnalysis('');
    try {
      // Récupère toutes les données pour ce keyword
      const { data } = await supabase
        .from('raw_scrape_data')
        .select('*')
        .eq('keyword', keyword)
        .order('scraped_at', { ascending:false });

      const context = (data||[]).map(r =>
        `Source: ${r.source} | Score: ${r.top_score} | Vues: ${r.total_views?.toLocaleString('fr-FR')||0} | Tendance: ${r.trend_direction||'?'} | Items: ${r.items_count}`
      ).join('\n');

      const result = await swarmFetch('/api/trigger', {
        method: 'POST',
        body: JSON.stringify({
          agentUnit: 'pipeline',
          product: keyword,
          messages: [{
            role: 'user',
            content: `Analyse ces données scraper pour le produit "${keyword}" et donne une recommandation détaillée pour TikTok Shop :\n\n${context}\n\nFournis :\n1. Évaluation du potentiel viral\n2. Meilleure stratégie de contenu\n3. Timing idéal de lancement\n4. Hook suggéré\n5. Verdict final : FONCER / ATTENDRE / RISQUÉ`
          }]
        })
      });
      setAiAnalysis(result.content?.[0]?.text || 'Analyse indisponible');
    } catch (e: any) {
      setAiAnalysis('❌ Erreur : ' + e.message);
    } finally { setAiLoading(false); }
  };

  // Stats par source
  const statsBySource = rows.reduce((acc, r) => {
    if (!acc[r.source]) acc[r.source] = { count:0, totalViews:0, avgScore:0, scores:[] };
    acc[r.source].count++;
    acc[r.source].totalViews += r.total_views||0;
    acc[r.source].scores.push(r.top_score||0);
    return acc;
  }, {} as Record<string,any>);

  Object.values(statsBySource).forEach((s:any) => {
    s.avgScore = s.scores.length ? Math.round(s.scores.reduce((a:number,b:number)=>a+b,0)/s.scores.length) : 0;
  });

  // Keywords uniques
  const keywords = [...new Set(rows.map(r => r.keyword))];
  const filtered = rows.filter(r =>
    (filterSource==='all'||r.source===filterSource) &&
    (!searchTerm||r.keyword.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sourceColors: Record<string,string> = {
    tiktok:'#ff2d55', trends:'#00e5a0', youtube:'#ef4444', reddit:'#fb923c', pinterest:'#e60023'
  };
  const sourceIcons: Record<string,string> = {
    tiktok:'🎵', trends:'📊', youtube:'▶️', reddit:'🤖', pinterest:'📌'
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:900, color:'#e2e8f0', fontFamily:'monospace' }}>📊 Analyse des données scraper</div>
          <div style={{ fontSize:10, color:'#64748b', marginTop:3 }}>{rows.length} entrées · stockées dans Supabase</div>
        </div>
        <button onClick={loadData} style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:8, padding:'7px 14px', color:'#00e5a0', fontFamily:'monospace', fontSize:11, fontWeight:700, cursor:'pointer' }}>
          ↺ Actualiser
        </button>
      </div>

      {/* Stats par source */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
        {['tiktok','trends','youtube','reddit','pinterest'].map(src => {
          const s = statsBySource[src];
          const c = sourceColors[src]||'#64748b';
          return (
            <div key={src} onClick={()=>setFilter(filterSource===src?'all':src)} style={{
              background: filterSource===src?`${c}12`:'#0b0d1a',
              border:`1px solid ${filterSource===src?c:'#1e2035'}`,
              borderRadius:10, padding:10, cursor:'pointer', transition:'all .2s', textAlign:'center'
            }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{sourceIcons[src]}</div>
              <div style={{ fontSize:11, fontWeight:700, color:c, fontFamily:'monospace' }}>{s?.count||0}</div>
              <div style={{ fontSize:8, color:'#64748b', marginTop:2 }}>{src}</div>
              {s && <div style={{ fontSize:9, color:c, marginTop:2, fontWeight:700 }}>score moy. {s.avgScore}</div>}
            </div>
          );
        })}
      </div>

      {/* Filtres + Recherche */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input
          value={searchTerm}
          onChange={e=>setSearchTerm(e.target.value)}
          placeholder="🔍 Filtrer par produit..."
          style={{ flex:1, background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:8, padding:'8px 12px', color:'#e2e8f0', fontFamily:'monospace', fontSize:11, outline:'none' }}
        />
        <button onClick={()=>{setFilter('all');setSearchTerm('');}} style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:8, padding:'8px 12px', color:'#64748b', fontFamily:'monospace', fontSize:10, cursor:'pointer' }}>
          Tout afficher
        </button>
      </div>

      {/* Layout : Table + Détail */}
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>

        {/* Table des données */}
        <div style={{ flex:1, background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid #1e2035', display:'grid', gridTemplateColumns:'1fr 70px 60px 80px 80px', gap:8, fontSize:8, fontWeight:700, color:'#334155', letterSpacing:'.1em', textTransform:'uppercase' as const }}>
            <span>Produit</span><span>Source</span><span>Score</span><span>Vues</span><span>Date</span>
          </div>
          {loading && <div style={{ padding:24, textAlign:'center', color:'#334155', fontSize:11 }}>Chargement...</div>}
          {!loading && filtered.length===0 && (
            <div style={{ padding:32, textAlign:'center', color:'#334155', fontSize:11, lineHeight:1.8 }}>
              📊 Aucune donnée scraper<br/>
              Lance un scan pour commencer à stocker des données !
            </div>
          )}
          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {filtered.map(row => {
              const c = sourceColors[row.source]||'#64748b';
              return (
                <div key={row.id} onClick={()=>setSelected(row)} style={{
                  display:'grid', gridTemplateColumns:'1fr 70px 60px 80px 80px', gap:8,
                  padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid #0f1120',
                  background:selected?.id===row.id?'rgba(0,229,160,0.04)':'transparent',
                  borderLeft:`2px solid ${selected?.id===row.id?'#00e5a0':'transparent'}`,
                  transition:'all .1s',
                }}>
                  <span style={{ fontSize:11, color:'#e2e8f0', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.keyword}</span>
                  <span style={{ fontSize:9, padding:'2px 6px', borderRadius:4, background:c+'18', color:c, fontWeight:700, textAlign:'center', alignSelf:'center', height:'fit-content' }}>
                    {sourceIcons[row.source]} {row.source}
                  </span>
                  <span style={{ fontSize:12, fontWeight:900, color:gc(row.top_score), fontFamily:'monospace', alignSelf:'center' }}>{row.top_score||0}</span>
                  <span style={{ fontSize:9, color:'#64748b', fontFamily:'monospace', alignSelf:'center' }}>
                    {row.total_views > 999999 ? (row.total_views/1000000).toFixed(1)+'M' : row.total_views > 999 ? Math.round(row.total_views/1000)+'k' : row.total_views||0}
                  </span>
                  <span style={{ fontSize:8, color:'#334155', alignSelf:'center' }}>
                    {new Date(row.scraped_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panneau détail + IA */}
        <div style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', gap:10 }}>

          {/* Analyse IA par keyword */}
          <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:12, padding:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#a78bfa', letterSpacing:'.1em', marginBottom:10 }}>🤖 ANALYSE IA PAR PRODUIT</div>
            <select
              onChange={e=>e.target.value&&analyseWithAI(e.target.value)}
              style={{ width:'100%', background:'#0f1120', border:'1px solid #1e2035', borderRadius:8, padding:'8px 10px', color:'#e2e8f0', fontFamily:'monospace', fontSize:10, outline:'none', marginBottom:8, cursor:'pointer' }}
            >
              <option value="">— Choisir un produit —</option>
              {keywords.map(k => <option key={k} value={k}>{k}</option>)}
            </select>

            {aiLoading && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 0', color:'#64748b', fontSize:10 }}>
                <div style={{ width:4, height:4, borderRadius:'50%', background:'#a78bfa', animation:'blink .8s infinite' }}/>
                <div style={{ width:4, height:4, borderRadius:'50%', background:'#a78bfa', animation:'blink .8s .15s infinite' }}/>
                <div style={{ width:4, height:4, borderRadius:'50%', background:'#a78bfa', animation:'blink .8s .3s infinite' }}/>
                <span>Analyse en cours...</span>
              </div>
            )}

            {aiAnalysis && !aiLoading && (
              <div style={{ background:'#05060f', borderRadius:8, padding:12, fontSize:10, color:'#e2e8f0', lineHeight:1.8, whiteSpace:'pre-wrap', maxHeight:300, overflowY:'auto', borderLeft:'3px solid #a78bfa' }}>
                {aiAnalysis}
              </div>
            )}

            {!aiAnalysis && !aiLoading && (
              <div style={{ textAlign:'center', padding:16, color:'#334155', fontSize:10, lineHeight:1.6 }}>
                Sélectionne un produit pour obtenir une analyse IA complète basée sur les données réelles scrapées
              </div>
            )}
          </div>

          {/* Détail ligne sélectionnée */}
          {selected && (
            <div style={{ background:'#0b0d1a', border:`1px solid ${sourceColors[selected.source]||'#1e2035'}30`, borderRadius:12, padding:14 }}>
              <div style={{ fontSize:10, fontWeight:700, color:sourceColors[selected.source]||'#64748b', letterSpacing:'.1em', marginBottom:10 }}>
                {sourceIcons[selected.source]} DONNÉES BRUTES — {selected.source.toUpperCase()}
              </div>
              <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0', marginBottom:8 }}>{selected.keyword}</div>
              {[
                { l:'Items scrapés', v:selected.items_count },
                { l:'Score top', v:selected.top_score },
                { l:'Vues totales', v:(selected.total_views||0).toLocaleString('fr-FR') },
                { l:'Tendance', v:selected.trend_direction||'—' },
                { l:'Scraped le', v:new Date(selected.scraped_at).toLocaleString('fr-FR') },
              ].map(({l,v}) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid #0f1120' }}>
                  <span style={{ fontSize:9, color:'#64748b' }}>{l}</span>
                  <span style={{ fontSize:9, fontWeight:700, color:'#e2e8f0', fontFamily:'monospace' }}>{v}</span>
                </div>
              ))}
              {selected.raw_data && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:8, color:'#334155', letterSpacing:'.1em', marginBottom:5 }}>JSON BRUT</div>
                  <pre style={{ background:'#05060f', borderRadius:6, padding:8, fontSize:8, color:'#64748b', lineHeight:1.6, overflow:'auto', maxHeight:150, whiteSpace:'pre-wrap' }}>
                    {JSON.stringify(selected.raw_data, null, 2).slice(0, 500)}...
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── APP PRINCIPAL ─────────────────────────────────────────────
export default function App() {
  const { agents, jobs, stats, isConnected, lastUpdate, error, refresh } = useSwarm();
  const [tab, setTab]                         = useState<Tab>('swarm');
  const [showAddProduct, setShowAddProduct]   = useState(false);
  const [products, setProducts]               = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product|null>(null);
  const [scriptStyle, setScriptStyle]         = useState<'ugc'|'temoignage'|'defi'|'hack'|'review'>('ugc');
  const [generatedScript, setGeneratedScript] = useState<ReturnType<typeof generateScript>|null>(null);
  const [seoArticle, setSeoArticle]           = useState<string|null>(null);
  const [forumPost, setForumPost]             = useState<string|null>(null);
  const [liveEvents, setLiveEvents]           = useState<LiveEvent[]>([]);
  const [autoScanKeyword, setAutoScanKeyword] = useState<string|undefined>();

  useEffect(() => {
    setProductsLoading(true);
    fetchProducts().then(setProducts).catch(console.error).finally(()=>setProductsLoading(false));
  }, []);

  const handleNewEvent = useCallback((ev: LiveEvent) => {
    setLiveEvents(prev => [...prev.slice(-49), ev]);
  }, []);

  const handleHistorySelect = useCallback((item: HistoryItem) => {
    setTab('swarm');
    setAutoScanKeyword(item.keyword);
    setTimeout(()=>setAutoScanKeyword(undefined), 500);
  }, []);

  const sendToN8n = async () => {
    if (!generatedScript) return alert("Génère un script d'abord !");
    try {
      const r = await fetch("http://localhost:5678/webhook-test/ba4d1d0e-998f-4568-9733-f0e2e8c2314b", {
        method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ produit:selectedProduct?.product_name, category:selectedProduct?.category, price:selectedProduct?.price, brand:selectedProduct?.brand_name, hook:generatedScript.hook, body:generatedScript.body, cta:generatedScript.cta }),
      });
      if (r.ok) alert('🚀 Envoyé à n8n !');
    } catch { alert('❌ Vérifie ta connexion'); }
  };

  if (error) return (
    <div style={{ background:'#05060f', color:'#ef4444', fontFamily:'monospace', display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:24 }}>⚠️</div><div>{error}</div>
      <button onClick={refresh} style={{ background:'#00e5a0', color:'#05060f', border:'none', padding:'8px 20px', borderRadius:6, cursor:'pointer', fontWeight:700 }}>Réessayer</button>
    </div>
  );

  const TAB_CONFIG = [
    { id:'swarm',    label:'⬡ Essaim' },
    { id:'agents',   label:'🤖 Agents' },
    { id:'analyse',  label:'📊 Analyse' },
    { id:'pipeline', label:'🎬 Pipeline' },
    { id:'produits', label:'📦 Produits' },
    { id:'redacteur',label:'✍️ Rédacteur' },
    { id:'forum',    label:'💬 Forum' },
  ];

  return (
    <div style={{ background:'#05060f', color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:13, minHeight:'100vh', display:'flex', flexDirection:'column' }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes slideIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn { from{opacity:0;transform:scale(.9)} to{opacity:1;transform:scale(1)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:3px; height:3px; }
        ::-webkit-scrollbar-track { background:#0f1120; }
        ::-webkit-scrollbar-thumb { background:#1e2035; border-radius:3px; }
      `}</style>

      {/* HEADER */}
      <header style={{ background:'#0b0d1a', borderBottom:'1px solid #1e2035', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:30, height:30, background:'#00e5a0', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#05060f" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, color:'#00e5a0', letterSpacing:'.05em' }}>SWARM-CREATOR AI</div>
            <div style={{ fontSize:9, color:'#64748b', letterSpacing:'.1em' }}>TIKTOK SHOP FACTORY · v9.0</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:isConnected?'#00e5a0':'#ef4444', boxShadow:isConnected?'0 0 8px #00e5a0':'none' }}/>
            <span style={{ fontSize:10, color:isConnected?'#00e5a0':'#ef4444' }}>{isConnected?'LIVE':'OFFLINE'}</span>
          </div>
          {[
            { l:'GMV', v:`${stats.totalGMV.toLocaleString('fr-FR')} €`, a:true },
            { l:'ROI', v:`+${stats.roi} %`, a:true },
            { l:'Actifs', v:`${stats.activeAgents}/${stats.totalAgents}`, a:false },
          ].map(({l,v,a}) => (
            <div key={l} style={{ textAlign:'center' }}>
              <div style={{ fontSize:14, fontWeight:700, color:a?'#00e5a0':'#e2e8f0' }}>{v}</div>
              <div style={{ fontSize:9, color:'#64748b' }}>{l}</div>
            </div>
          ))}
          {lastUpdate && <span style={{ fontSize:9, color:'#334155' }}>{lastUpdate.toLocaleTimeString('fr-FR')}</span>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <CommandPalette products={products} onScan={(name)=>{ setTab('swarm'); setAutoScanKeyword(name); setTimeout(()=>setAutoScanKeyword(undefined),500); }}/>
          <ConsumptionGauge/>
          <AlertBell/>
        </div>
      </header>

      {/* TABS */}
      <nav style={{ background:'#0b0d1a', borderBottom:'1px solid #1e2035', display:'flex', padding:'0 16px', overflowX:'auto', flexShrink:0 }}>
        {TAB_CONFIG.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id as Tab)} style={{
            background:'none', border:'none', borderBottom:`2px solid ${tab===t.id?'#00e5a0':'transparent'}`,
            color:tab===t.id?'#00e5a0':'#64748b', cursor:'pointer',
            fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'10px 16px', whiteSpace:'nowrap', transition:'color .2s',
          }}>{t.label}</button>
        ))}
      </nav>

      {/* LAYOUT */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <HistorySidebar onSelect={handleHistorySelect}/>
        <main style={{ flex:1, overflowY:'auto', padding:14 }}>

         {tab === 'swarm' && (
  <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
    <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:10 }}>
      {/* KPI Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
        {[
          { l:'Vidéos/jour', v:stats.videosToday, a:false, d:false },
          { l:'GMV généré',  v:`${stats.totalGMV.toLocaleString('fr-FR')} €`, a:true, d:false },
          { l:'Marge nette', v:`${stats.netMargin} %`, a:true, d:false },
          { l:'Coût prod.',  v:`${stats.totalCost.toLocaleString('fr-FR')} €`, a:false, d:false },
          { l:'Actifs',      v:stats.activeAgents, a:false, d:false },
          { l:'En erreur',   v:stats.errorAgents,  a:false, d:stats.errorAgents>0 },
        ].map(({l,v,a,d}) => (
          <div key={l} style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:10, padding:10 }}>
            <div style={{ fontSize:18, fontWeight:700, color:d?'#ef4444':a?'#00e5a0':'#e2e8f0', lineHeight:1 }}>{v}</div>
            <div style={{ fontSize:9, color:'#64748b', marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>
      {/* 🔭 Radar Viralité */}
      <VeillePanel />
    </div>
    <AgentsColumn agents={agents}/>
  </div>
)}

          {tab === 'agents' && (
  <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
    {/* Panel agents principal */}
    <div style={{ flex:1, minWidth:0 }}>
      <AgentsPanel onScanNiche={(niche) => {
        setTab('swarm');
        setAutoScanKeyword(niche);
        setTimeout(() => setAutoScanKeyword(undefined), 500);
      }}/>
    </div>
    {/* Colonne agents Supabase à droite */}
    <AgentsColumn agents={agents}/>
  </div>
)}

          {tab==='analyse' && <AnalyseTab/>}

          {tab==='pipeline' && (
            <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:10, padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'.1em', textTransform:'uppercase' as const }}>🎬 Pipeline Vidéo</span>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:20, background:'rgba(245,158,11,.15)', color:'#f59e0b', border:'1px solid rgba(245,158,11,.3)', fontWeight:700 }}>{jobs.length} jobs</span>
              </div>
              {jobs.length===0 ? <div style={{ textAlign:'center', padding:'32px 0', color:'#334155' }}>🎬<br/>Aucun job en cours</div> : jobs.map(job=><JobRow key={job.id} job={job}/>)}
            </div>
          )}

          {tab==='produits' && (
            <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:10, padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <span style={{ fontSize:11, fontWeight:700, color:'#64748b', letterSpacing:'.1em', textTransform:'uppercase' as const }}>📦 Catalogue Produits</span>
                <button onClick={()=>setShowAddProduct(true)} style={{ background:'#00e5a0', color:'#05060f', border:'none', borderRadius:6, padding:'7px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer' }}>➕ Ajouter</button>
              </div>
              <div style={{ background:'#10122a', borderRadius:8, padding:14, marginBottom:14 }}>
                <div style={{ fontSize:10, color:'#64748b', marginBottom:10, fontWeight:700 }}>⚡ GÉNÉRATEUR HOOK-BODY-CTA</div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                  <select style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:6, color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'7px 10px', flex:1, minWidth:140, outline:'none' }}
                    value={selectedProduct?.id??''} onChange={e=>{setSelectedProduct(products.find(p=>p.id===e.target.value)??null);setGeneratedScript(null);}}>
                    <option value="">— Choisir un produit —</option>
                    {products.map(p=><option key={p.id} value={p.id}>{p.brand_name} — {p.product_name}</option>)}
                  </select>
                  <select style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:6, color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'7px 10px', outline:'none' }}
                    value={scriptStyle} onChange={e=>setScriptStyle(e.target.value as typeof scriptStyle)}>
                    <option value="ugc">UGC Natif</option><option value="temoignage">Témoignage</option>
                    <option value="defi">Défi 7j</option><option value="hack">Life Hack</option><option value="review">Review</option>
                  </select>
                  <button style={{ background:'#00e5a0', color:'#05060f', border:'none', borderRadius:6, padding:'7px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer' }}
                    disabled={!selectedProduct} onClick={()=>{ if(!selectedProduct)return; setGeneratedScript(generateScript({product:selectedProduct,style:scriptStyle,agentUnit:'tiktok_shop'})); }}>
                    ⚡ Générer
                  </button>
                </div>
                {generatedScript && (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {[{label:'🎣 HOOK (0-3s)',content:generatedScript.hook,color:'#ef4444'},{label:'🎬 BODY (3-25s)',content:generatedScript.body,color:'#f59e0b'},{label:'🛒 CTA (25-30s)',content:generatedScript.cta,color:'#00e5a0'}].map(s=>(
                      <div key={s.label} style={{ background:'#05060f', borderRadius:6, padding:10, borderLeft:`3px solid ${s.color}` }}>
                        <div style={{ fontSize:9, color:s.color, fontWeight:700, marginBottom:5 }}>{s.label}</div>
                        <div style={{ fontSize:12, color:'#e2e8f0', lineHeight:1.6 }}>{s.content}</div>
                      </div>
                    ))}
                    <button onClick={sendToN8n} style={{ padding:10, backgroundColor:'#f97316', color:'white', border:'none', borderRadius:7, fontWeight:'bold', cursor:'pointer', fontSize:13, fontFamily:'monospace' }}>
                      🚀 LANCER LA PRODUCTION VIDÉO
                    </button>
                  </div>
                )}
              </div>
              {productsLoading ? <div style={{ textAlign:'center', padding:20, color:'#64748b' }}>⏳ Chargement...</div>
                : products.length===0 ? <div style={{ textAlign:'center', padding:32, color:'#334155' }}>📦<br/>Aucun produit. Clique sur Ajouter.</div>
                : products.map(p=><ProductRow key={p.id} product={p}/>)}
            </div>
          )}

          {tab==='redacteur' && (
            <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:10, padding:16 }}>
              <div style={{ marginBottom:14 }}><span style={{ fontSize:11, fontWeight:700, color:'#a78bfa', letterSpacing:'.1em' }}>✍️ RÉDACTEUR SEO</span></div>
              <div style={{ background:'#10122a', borderRadius:8, padding:14 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                  <select style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:6, color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'7px 10px', flex:1, outline:'none' }}
                    value={selectedProduct?.id??''} onChange={e=>setSelectedProduct(products.find(p=>p.id===e.target.value)??null)}>
                    <option value="">— Choisir un produit —</option>{products.map(p=><option key={p.id} value={p.id}>{p.brand_name} — {p.product_name}</option>)}
                  </select>
                  <button style={{ background:'#a78bfa', color:'#05060f', border:'none', borderRadius:6, padding:'7px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer' }}
                    disabled={!selectedProduct} onClick={()=>{ if(!selectedProduct)return; const s=generateScript({product:selectedProduct,style:'review',agentUnit:'redacteur'}); setGeneratedScript(s); setSeoArticle(scriptToSEOArticle(s,selectedProduct)); }}>
                    ✍️ Générer Article
                  </button>
                </div>
                {seoArticle ? <pre style={{ background:'#05060f', borderRadius:6, padding:14, fontSize:11, color:'#e2e8f0', lineHeight:1.7, whiteSpace:'pre-wrap', overflow:'auto', maxHeight:400 }}>{seoArticle}</pre>
                  : <div style={{ textAlign:'center', padding:32, color:'#334155' }}>✍️<br/>Sélectionne un produit et génère l'article</div>}
              </div>
            </div>
          )}

          {tab==='forum' && (
            <div style={{ background:'#0b0d1a', border:'1px solid #1e2035', borderRadius:10, padding:16 }}>
              <div style={{ marginBottom:14 }}><span style={{ fontSize:11, fontWeight:700, color:'#fb923c', letterSpacing:'.1em' }}>💬 FORUM COMMUNITY</span></div>
              <div style={{ background:'#10122a', borderRadius:8, padding:14 }}>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                  <select style={{ background:'#0f1120', border:'1px solid #1e2035', borderRadius:6, color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:'7px 10px', flex:1, outline:'none' }}
                    value={selectedProduct?.id??''} onChange={e=>setSelectedProduct(products.find(p=>p.id===e.target.value)??null)}>
                    <option value="">— Choisir un produit —</option>{products.map(p=><option key={p.id} value={p.id}>{p.brand_name} — {p.product_name}</option>)}
                  </select>
                  <button style={{ background:'#fb923c', color:'#05060f', border:'none', borderRadius:6, padding:'7px 14px', fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, cursor:'pointer' }}
                    disabled={!selectedProduct} onClick={()=>{ if(!selectedProduct)return; setForumPost(generateForumPost(selectedProduct)); }}>
                    💬 Générer Post
                  </button>
                </div>
                {forumPost ? <pre style={{ background:'#05060f', borderRadius:6, padding:14, fontSize:11, color:'#e2e8f0', lineHeight:1.7, whiteSpace:'pre-wrap', overflow:'auto' }}>{forumPost}</pre>
                  : <div style={{ textAlign:'center', padding:32, color:'#334155' }}>💬<br/>Génère un post communautaire</div>}
              </div>
            </div>
          )}

        </main>
      </div>
      {showAddProduct && <AddProductForm onSuccess={p=>{setProducts(prev=>[p,...prev]);setShowAddProduct(false);}} onCancel={()=>setShowAddProduct(false)}/>}
    </div>
  );
}

// ── Utilitaires ───────────────────────────────────────────────
function JobRow({ job }: { job: VideoJob }) {
  const color = STATUS_COLOR[job.status]??'#334155';
  return (
    <div style={{ display:'grid', gridTemplateColumns:'70px 1fr 90px 50px', gap:8, alignItems:'center', padding:'7px 0', borderBottom:'1px solid #1e2035', fontSize:11 }}>
      <div style={{ color:'#64748b', fontSize:9 }}>{job.id.slice(-6)}</div>
      <div>
        <div style={{ color:'#e2e8f0', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{job.product?.product_name??job.product_name??'—'}</div>
        <div style={{ color:'#64748b', fontSize:9 }}>Agent: {job.agent?.name??'—'}</div>
      </div>
      <div>
        <div style={{ fontSize:9, color }}>{job.status}</div>
        <div style={{ height:2, background:'#1e2035', borderRadius:2, marginTop:3, overflow:'hidden' }}>
          <div style={{ height:'100%', background:color, borderRadius:2, width:'60%' }}/>
        </div>
      </div>
      <div style={{ color:'#64748b', fontSize:10, textAlign:'right' }}>{job.production_cost??'—'} €</div>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid #1e2035', gap:8 }}>
      <div>
        <div style={{ fontSize:12, fontWeight:500, color:'#e2e8f0' }}>{product.brand_name} — {product.product_name}</div>
        <div style={{ fontSize:9, color:'#64748b', marginTop:2 }}>{product.category} · Commission : {(product.commission_rate*100).toFixed(0)} %</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#00e5a0' }}>{product.price.toLocaleString('fr-FR')} €</div>
        <div style={{ fontSize:9, color:'#334155' }}>+{(product.price*product.commission_rate).toFixed(2)} €</div>
      </div>
    </div>
  );
}
