'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';

export default function DashboardCRM() {
  // 1. ÉTATS POUR LA DYNAMISATION (Pour que les chiffres bougent !)
  const [stats, setStats] = useState({ gmv: 2711, vues: 43000, scripts: 194 });
  const [liveRuns, setLiveRuns] = useState<any[]>([]);

  // 2. RÉCUPÉRATION DES DONNÉES RÉELLES
  useEffect(() => {
    const fetchStats = async () => {
      // Compte les scripts dans ta table generated_assets
      const { count } = await supabase.from('generated_assets').select('*', { count: 'exact', head: true });
      if (count) setStats(prev => ({ ...prev, scripts: count }));

      // Récupère les derniers logs (Runs)
      const { data: logs } = await supabase
        .from('live_feed_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (logs) setLiveRuns(logs);
    };

    fetchStats();

    // 3. REALTIME : Si un agent logue un truc, le dashboard s'actualise
    const channel = supabase
      .channel('live-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_feed_events' }, (payload) => {
        setLiveRuns(prev => [payload.new, ...prev.slice(0, 2)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* Header TikTok avec vibe fun */}
      <div className="flex items-center justify-between bg-zinc-900 rounded-[35px] p-8 border border-emerald-500/20 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="text-5xl animate-bounce">🚀</div>
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic leading-none">TikTok Shop Pipeline</h2>
            <p className="text-emerald-400 text-xs font-mono tracking-[0.3em] uppercase mt-2">Mode Virality Activé • 3 agents en feu</p>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-emerald-400 text-3xl font-black font-mono tracking-tighter italic">{stats.gmv.toLocaleString()} €</div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">GMV cette semaine</div>
          </div>
          <button 
            onClick={() => alert('🔥 SYSTÈME : Scan Viral déployé !')}
            className="bg-emerald-500 hover:bg-emerald-400 text-black px-10 py-5 rounded-[22px] font-black uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
          >
            <span>🔥</span> LANCER SCAN VIRAL
          </button>
        </div>
      </div>

      {/* Stats TikTok fun & high-tech */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center md:text-left">
        {[
          { label: 'GMV SEMAINE', val: `${stats.gmv}€`, sub: '+13,7% vs hier', color: 'emerald' },
          { label: 'VUES TOTALES', val: `${(stats.vues/1000).toFixed(0)}k`, sub: '+8.2k stable', color: 'emerald' },
          { label: 'TAUX CONVERSION', val: '0.0%', sub: 'Warm-up phase', color: 'amber' },
          { label: 'TEMPS MOYEN', val: '15 min', sub: 'Scan → Post', color: 'emerald' }
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900 rounded-3xl p-8 border border-emerald-500/10 hover:border-emerald-500/40 transition-all group">
            <div className="text-zinc-500 text-[10px] tracking-[0.2em] font-black uppercase">{s.label}</div>
            <div className="text-5xl font-black mt-3 text-white tracking-tighter group-hover:scale-105 transition-transform italic">{s.val}</div>
            <div className={`text-${s.color}-400 text-[10px] mt-2 font-bold uppercase tracking-widest`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline Steps avec vibe fun */}
      <div className="bg-zinc-900 rounded-[40px] p-10 border border-zinc-800">
        <div className="flex justify-between mb-10">
          <h3 className="text-2xl font-black italic uppercase tracking-tighter">Workflow Stratégique</h3>
          <div className="text-emerald-400 text-[10px] font-mono tracking-widest uppercase">Automatisation 100% Active</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-zinc-950 p-8 rounded-[30px] border border-emerald-500/20 group hover:border-emerald-500 transition-all">
            <div className="text-3xl mb-4">🔍</div>
            <div className="font-black text-xl uppercase italic mb-2">Détection</div>
            <div className="text-emerald-400 font-mono text-xs">+18,43€ GMV estimé / h</div>
          </div>
          <div className="bg-zinc-950 p-8 rounded-[30px] border border-amber-500/20 group hover:border-amber-500 transition-all">
            <div className="text-3xl mb-4">✍️</div>
            <div className="font-black text-xl uppercase italic mb-2">Scripts</div>
            <div className="text-amber-400 font-mono text-xs">{stats.scripts} scripts générés</div>
          </div>
          <div className="bg-zinc-950 p-8 rounded-[30px] border border-cyan-500/20 group hover:border-cyan-500 transition-all">
            <div className="text-3xl mb-4">📤</div>
            <div className="font-black text-xl uppercase italic mb-2">Publication</div>
            <div className="text-cyan-400 font-mono text-xs">~12 min temps moyen</div>
          </div>
        </div>
      </div>

      {/* Derniers runs avec vibe fun */}
      <div className="bg-zinc-900 rounded-[40px] p-10 border border-zinc-800">
        <h3 className="text-xl font-black mb-8 flex items-center gap-3 italic uppercase">
          <span>🔥</span> Journal des Opérations
        </h3>
        <div className="space-y-4">
          {liveRuns.length > 0 ? liveRuns.map((run, i) => (
            <div key={i} className="flex justify-between items-center bg-zinc-950 p-6 rounded-2xl border-l-4 border-emerald-500">
              <div>
                <div className="font-black text-emerald-400 uppercase text-sm tracking-widest">{run.type}</div>
                <div className="text-[10px] text-zinc-400 mt-1 uppercase font-bold">{run.message}</div>
              </div>
              <div className="text-right">
                <div className="text-white font-mono text-xs">{new Date(run.created_at).toLocaleTimeString()}</div>
              </div>
            </div>
          )) : (
            <div className="text-zinc-600 font-mono text-xs italic text-center py-10 border-2 border-dashed border-zinc-800 rounded-3xl">
              Attente du prochain Run des agents...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}