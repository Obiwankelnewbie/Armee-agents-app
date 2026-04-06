'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * DASHBOARD TIKTOK SHOP PIPELINE - UNIT CONTROL
 * Version: 2.8 "On Fire"
 */
export default function DashboardCRM() {
  // 1. ÉTATS DES DONNÉES
  const [stats, setStats] = useState({
    gmv: 2711.55,
    vues: 43000,
    scripts: 194,
    conversion: 0.0
  });
  const [liveRuns, setLiveRuns] = useState<any[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // 2. RÉCUPÉRATION INITIALE ET TEMPS RÉEL
  useEffect(() => {
    const fetchData = async () => {
      // Compte des scripts générés (Forge)
      const { count } = await supabase
        .from('generated_assets')
        .select('*', { count: 'exact', head: true });
      
      if (count !== null) setStats(prev => ({ ...prev, scripts: count }));

      // Récupération des derniers événements (Live Feed)
      const { data: logs } = await supabase
        .from('live_feed_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (logs) setLiveRuns(logs);
    };

    fetchData();

    // Abonnement Realtime aux logs des agents
    const channel = supabase
      .channel('pipeline-realtime')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'live_feed_events' }, 
        (payload) => {
          setLiveRuns(prev => [payload.new, ...prev.slice(0, 3)]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 3. HANDLER POUR LE SCAN VIRAL
  const handleScanViral = () => {
    setIsScanning(true);
    // Simulation d'appel API Agent Supervisor
    setTimeout(() => setIsScanning(false), 3000);
    alert('🚀 SIGNAL TRANSMIS : Agent Supervisor activé pour le Scan Viral.');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20"
    >
      
      {/* --- HEADER STRATÉGIQUE --- */}
      <div className="flex flex-col md:flex-row items-center justify-between bg-zinc-900 rounded-[40px] p-8 border border-emerald-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6 mb-6 md:mb-0">
          <div className={`text-6xl ${isScanning ? 'animate-spin' : 'animate-bounce'}`}>
            {isScanning ? '🌀' : '🚀'}
          </div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter text-white uppercase italic leading-none">
              TikTok Shop <span className="text-emerald-500">Pipeline</span>
            </h2>
            <p className="text-emerald-400 text-[10px] font-mono tracking-[0.4em] uppercase mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              Mode Virality Activé • Swarm OS v2.8
            </p>
          </div>
        </div>

        <div className="flex items-center gap-10">
          <div className="text-right">
            <div className="text-emerald-400 text-4xl font-black font-mono tracking-tighter italic">
              {stats.gmv.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
            </div>
            <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mt-1">GMV Estimé Semaine</div>
          </div>
          
          <button 
            onClick={handleScanViral}
            disabled={isScanning}
            className="group relative bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-black px-10 py-5 rounded-[25px] font-black uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
          >
            <span className="text-xl group-hover:rotate-12 transition-transform">🔥</span>
            {isScanning ? 'SCAN EN COURS...' : 'LANCER SCAN VIRAL'}
          </button>
        </div>
      </div>

      {/* --- STATS GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'PERFORMANCE', val: stats.gmv.toFixed(0) + '€', sub: '+13.7% vs hier', color: 'emerald', icon: '📈' },
          { label: 'VUES TOTALES', val: (stats.vues / 1000).toFixed(0) + 'k', sub: '+8.2k captées', color: 'emerald', icon: '👁️' },
          { label: 'CONVERSION', val: stats.conversion.toFixed(1) + '%', sub: 'Phase Warm-up', color: 'amber', icon: '🎯' },
          { label: 'DÉLAI MOYEN', val: '15 min', sub: 'Scan to Post', color: 'emerald', icon: '⏱️' }
        ].map((s, i) => (
          <div key={i} className="bg-zinc-900/50 backdrop-blur-md rounded-[35px] p-8 border border-zinc-800 hover:border-emerald-500/30 transition-all group overflow-hidden relative">
            <div className="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:opacity-10 transition-opacity">{s.icon}</div>
            <div className="text-zinc-500 text-[10px] tracking-[0.3em] font-black uppercase">{s.label}</div>
            <div className="text-5xl font-black mt-4 text-white tracking-tighter italic group-hover:text-emerald-400 transition-colors">
              {s.val}
            </div>
            <div className={`text-${s.color}-400 text-[10px] mt-2 font-bold uppercase tracking-widest`}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* --- WORKFLOW VISUEL --- */}
      <div className="bg-zinc-900/80 rounded-[45px] p-12 border border-zinc-800 relative">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h3 className="text-3xl font-black italic uppercase tracking-tighter text-white">Workflow Stratégique</h3>
            <p className="text-zinc-500 text-xs mt-2 font-mono uppercase tracking-widest">
              Status: <span className="text-emerald-500 font-bold">Full Automation Active</span>
            </p>
          </div>
          <div className="text-zinc-700 font-black text-6xl opacity-20 italic">01001</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Étape 1 */}
          <div className="bg-zinc-950 p-10 rounded-[35px] border border-emerald-500/10 group hover:border-emerald-500/50 transition-all relative">
            <div className="text-4xl mb-6 bg-emerald-500/10 w-16 h-16 rounded-2xl flex items-center justify-center">🔍</div>
            <h4 className="font-black text-xl uppercase italic text-white mb-3">Analyse & Détection</h4>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">Le Swarm identifie les produits à haut potentiel viral sur TikTok.</p>
            <div className="text-emerald-400 font-mono text-xs tracking-tighter bg-emerald-500/5 py-2 px-4 rounded-lg inline-block">
              +18,43€ GMV estimé / h
            </div>
          </div>

          {/* Étape 2 */}
          <div className="bg-zinc-950 p-10 rounded-[35px] border border-amber-500/10 group hover:border-amber-400/50 transition-all relative">
            <div className="text-4xl mb-6 bg-amber-500/10 w-16 h-16 rounded-2xl flex items-center justify-center">✍️</div>
            <h4 className="font-black text-xl uppercase italic text-white mb-3">Forge de Scripts</h4>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">Génération automatique de hooks psychologiques et CTA.</p>
            <div className="text-amber-400 font-mono text-xs tracking-tighter bg-amber-500/5 py-2 px-4 rounded-lg inline-block">
              {stats.scripts} actifs en base
            </div>
          </div>

          {/* Étape 3 */}
          <div className="bg-zinc-950 p-10 rounded-[35px] border border-cyan-500/10 group hover:border-cyan-400/50 transition-all relative">
            <div className="text-4xl mb-6 bg-cyan-500/10 w-16 h-16 rounded-2xl flex items-center justify-center">📤</div>
            <h4 className="font-black text-xl uppercase italic text-white mb-3">Multi-Posting</h4>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">Publication synchronisée sur les comptes du Swarm.</p>
            <div className="text-cyan-400 font-mono text-xs tracking-tighter bg-cyan-500/5 py-2 px-4 rounded-lg inline-block">
              Cadence: 1 post / 12 min
            </div>
          </div>
        </div>
      </div>

      {/* --- LIVE FEED --- */}
      <div className="bg-zinc-900 rounded-[45px] p-10 border border-zinc-800">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-black italic uppercase tracking-[0.2em] flex items-center gap-3">
            <span className="animate-pulse text-emerald-500 text-2xl">●</span> Journal des Opérations Live
          </h3>
          <span className="text-zinc-600 font-mono text-[10px] uppercase font-bold tracking-widest">Temps Réel Connecté</span>
        </div>

        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {liveRuns.length > 0 ? liveRuns.map((run, i) => (
              <motion.div 
                key={run.id || i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col md:flex-row justify-between items-start md:items-center bg-zinc-950/50 p-6 rounded-[25px] border-l-4 border-emerald-500 hover:bg-zinc-900 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className="bg-zinc-900 p-3 rounded-xl font-mono text-[10px] text-zinc-500">
                    {new Date(run.created_at).toLocaleTimeString()}
                  </div>
                  <div>
                    <div className="font-black text-emerald-400 uppercase text-sm tracking-widest group-hover:text-white transition-colors">
                      UNIT-{run.type || 'AGENT'} • EXECUTION
                    </div>
                    <div className="text-xs text-zinc-400 mt-1 uppercase font-bold tracking-tight">
                      {run.message}
                    </div>
                  </div>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                  <div className="text-white font-mono text-[10px] bg-zinc-900 px-4 py-2 rounded-lg border border-zinc-800">
                    ID_RUN: <span className="text-emerald-500">#{run.run_id?.slice(-4) || '74HC'}</span>
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="text-zinc-700 font-mono text-xs italic text-center py-20 border-2 border-dashed border-zinc-800 rounded-[35px]">
                Attente de synchronisation avec le Swarm Supervisor...
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}