'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AgentStatusPanel from '../components/AgentStatusPanel';
import { motion } from 'framer-motion';

export default function OptimusPrimeDashboard() {
  const [activeTab, setActiveTab] = useState<'crm' | 'agents' | 'growth' | 'trader'>('crm');
  const [traderSignals, setTraderSignals] = useState<any[]>([]);

  const fetchSignals = async () => {
    const { data, error } = await supabase
      .from('private_trader_signals')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) setTraderSignals(data);
  };

  useEffect(() => {
    fetchSignals();
    const channel = supabase
      .channel('trader-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'private_trader_signals' }, 
        (payload) => { setTraderSignals((prev) => [payload.new, ...prev]); }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-zinc-100 font-sans selection:bg-emerald-500/30">
      
      {/* --- HEADER DE COMMANDEMENT --- */}
      <header className="sticky top-0 z-50 border-b border-zinc-800/50 bg-[#0A0A0F]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5 group">
            <div className="w-14 h-14 bg-gradient-to-br from-emerald-400 via-cyan-400 to-purple-600 rounded-[20px] flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(52,211,153,0.2)] group-hover:scale-105 transition-transform duration-500">
              ⚔️
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic font-display leading-none">
                Swarm <span className="text-emerald-500">OS</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono font-bold tracking-[0.3em] uppercase mt-1">
                Optimus Prime <span className="text-emerald-500/50">v2.7 Master</span>
              </p>
            </div>
          </div>

          <nav className="flex bg-zinc-900/40 p-1.5 rounded-[22px] border border-zinc-800/50 backdrop-blur-md">
            {[
              { id: 'crm', label: 'Pipeline' },
              { id: 'agents', label: 'Swarm' },
              { id: 'growth', label: 'Growth' },
              { id: 'trader', label: 'Trader' }
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)} 
                className={`px-8 py-3 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all duration-500 ${
                  activeTab === tab.id 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' 
                  : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* --- CONTENU PRINCIPAL --- */}
      <main className="max-w-7xl mx-auto px-8 py-10">
        
        {/* ONGLET : PIPELINE TIKTOK SHOP (Fusionné) */}
        {activeTab === 'crm' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header TikTok avec vibe fun */}
            <div className="flex items-center justify-between bg-zinc-900 rounded-[35px] p-8 border border-emerald-500/20 shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="text-4xl">🚀</div>
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-white uppercase italic">TikTok Shop Pipeline</h2>
                  <p className="text-emerald-400 text-sm font-mono tracking-widest">Mode Virality Activé • 3 agents en feu</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-emerald-400 text-2xl font-mono font-bold tracking-tighter">2 711,55 €</div>
                  <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">GMV cette semaine</div>
                </div>
                <button 
                  onClick={() => alert('Scan TikTok lancé ! 🔥')}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black px-8 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <span>🔥</span> LANCER SCAN VIRAL
                </button>
              </div>
            </div>

            {/* Stats TikTok fun & high-tech */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: 'GMV SEMAINE', val: '2 711€', sub: '+13,7% vs dernière semaine', color: 'emerald' },
                { label: 'VUES TOTALES', val: '43k', sub: '+8.2k cette semaine', color: 'emerald' },
                { label: 'TAUX CONVERSION', val: '0.0%', sub: 'En attente de data', color: 'amber' },
                { label: 'TEMPS MOYEN', val: '15 min', sub: 'Scan → Publication', color: 'emerald' }
              ].map((stat, i) => (
                <div key={i} className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 hover:border-emerald-500/30 transition-all group">
                  <div className="text-zinc-500 text-[10px] tracking-widest font-bold uppercase">{stat.label}</div>
                  <div className="text-5xl font-black mt-3 text-white tracking-tighter group-hover:text-emerald-400 transition-colors">{stat.val}</div>
                  <div className={`text-${stat.color}-400 text-[10px] mt-1 font-bold italic tracking-wide`}>{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Pipeline Steps */}
            <div className="bg-zinc-900 rounded-[40px] p-10 border border-zinc-800">
              <div className="flex justify-between mb-8">
                <h3 className="text-2xl font-black italic uppercase tracking-tight">Flux de Production</h3>
                <div className="text-emerald-400 text-[10px] font-mono tracking-widest uppercase">3 étapes actives • Virality ON</div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-950 p-8 rounded-3xl border border-emerald-500/40 hover:border-emerald-400 transition-all">
                  <div className="flex items-center gap-4 mb-6 text-2xl">🔍 <span className="font-black text-lg text-white italic uppercase">Détection</span></div>
                  <div className="text-emerald-400 font-mono text-xs tracking-tighter">+18,43€ GMV estimé / h</div>
                </div>
                <div className="bg-zinc-950 p-8 rounded-3xl border border-amber-500/30 hover:border-amber-400 transition-all">
                  <div className="flex items-center gap-4 mb-6 text-2xl">✍️ <span className="font-black text-lg text-white italic uppercase">Scripts</span></div>
                  <div className="text-amber-400 font-mono text-xs tracking-tighter">194 diaporamas prêts</div>
                </div>
                <div className="bg-zinc-950 p-8 rounded-3xl border border-cyan-500/30 hover:border-cyan-400 transition-all">
                  <div className="flex items-center gap-4 mb-6 text-2xl">📤 <span className="font-black text-lg text-white italic uppercase">Post</span></div>
                  <div className="text-cyan-400 font-mono text-xs tracking-tighter">~12 min cadence moyenne</div>
                </div>
              </div>
            </div>

            {/* Derniers runs */}
            <div className="bg-zinc-900 rounded-[40px] p-10 border border-zinc-800">
              <h3 className="text-xl font-black mb-6 flex items-center gap-3 italic uppercase">
                <span>🔥</span> Activité Swarm Live
              </h3>
              <div className="space-y-4 font-mono">
                <div className="flex justify-between items-center bg-zinc-950 p-6 rounded-2xl border-l-4 border-emerald-500 hover:bg-zinc-900 transition-all">
                  <div>
                    <div className="font-black text-emerald-400 uppercase text-sm">Run #11 • Slide Generator</div>
                    <div className="text-[10px] text-zinc-500 mt-1 uppercase font-bold tracking-widest">Niche Beauté · Sérum Vitamine C · 4.3k vues est.</div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-black">+347,15€ GMV</div>
                    <div className="text-[10px] text-zinc-600 mt-1">IL Y A 43 MIN</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ONGLET : STATUS AGENTS */}
        {activeTab === 'agents' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <AgentStatusPanel />
          </div>
        )}

        {/* ONGLET : GROWTH HACKER */}
        {activeTab === 'growth' && (
           <div className="text-center py-40 bg-zinc-900/20 rounded-[40px] border-2 border-dashed border-zinc-800 animate-pulse">
             <div className="text-7xl mb-8">🧠</div>
             <h2 className="text-3xl font-black italic uppercase font-display tracking-tight text-zinc-400">Analyse Stratégique en cours...</h2>
             <p className="text-zinc-600 mt-4 font-mono text-xs uppercase tracking-widest italic">Swarm Intelligence : CONNECTED</p>
           </div>
        )}

        {/* ONGLET : TRADER PRIVÉ */}
        {activeTab === 'trader' && (
          <div className="animate-in fade-in slide-in-from-bottom-6 duration-1000">
             <h2 className="text-6xl font-black tracking-tighter italic uppercase font-display mb-10">
               Trader <span className="text-emerald-500">Privé</span>
             </h2>
             <div className="grid gap-6">
                {traderSignals.map((signal, index) => (
                  <div key={index} className="bg-zinc-900/30 p-10 rounded-[35px] border border-zinc-800 hover:border-emerald-500/40 transition-all">
                    <div className="flex justify-between items-start">
                      <h3 className="text-3xl font-black italic uppercase">{signal.opportunity}</h3>
                      <span className="bg-emerald-500 text-black px-6 py-2 rounded-xl text-xs font-black uppercase tracking-tighter">{signal.action}</span>
                    </div>
                    <p className="mt-4 text-zinc-400 italic text-lg">{signal.analysis}</p>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      <div className="fixed -bottom-20 -left-20 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px]