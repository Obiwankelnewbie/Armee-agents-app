import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import DashboardCRM from './components/DashboardCRM';
import AgentStatusPanel from './components/AgentStatusPanel';
import StrategicIntelligence from './components/StrategicIntelligence';

// Initialisation Supabase (Vite style)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'crm' | 'agents' | 'strategy'>('crm');

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-[#1F1F1F] font-sans">
      
      {/* 🇨🇭 BARRE DE NAVIGATION PREMIUM */}
      <header className="bg-white/90 backdrop-blur-md border-b border-[#E5E5E5] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-[#1A3C34] rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
              S
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#1A3C34]">Swarm Intelligence</h1>
              <p className="text-[10px] uppercase tracking-[2.5px] text-[#00A386] font-bold">Enterprise v2.8 • Swiss Edition</p>
            </div>
          </div>

          <nav className="flex gap-1 bg-[#F1F1F1] p-1 rounded-2xl border border-[#E5E5E5]">
            {[
              { id: 'crm', label: 'Revenue Pipeline' },
              { id: 'agents', label: 'Network Monitor' },
              { id: 'strategy', label: 'Strategic AI' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === tab.id 
                  ? 'bg-white text-[#1A3C34] shadow-sm scale-105' 
                  : 'text-[#555555] hover:text-[#1A3C34]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-3 px-4 py-2 bg-[#F8F8F8] border border-[#E5E5E5] rounded-full">
            <div className="w-2 h-2 bg-[#00A386] rounded-full animate-pulse shadow-[0_0_8px_#00A386]"></div>
            <span className="text-[10px] font-bold text-[#1A3C34] uppercase tracking-widest">Active Ops</span>
          </div>
        </div>
      </header>

      {/* 🚀 CONTENU PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-8 py-12 w-full">
        {activeTab === 'crm' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <header className="mb-10">
              <h2 className="text-4xl font-extrabold text-[#1A3C34] tracking-tight italic">Revenue Flow</h2>
              <p className="text-[#555555] mt-2 text-lg">Gestion autonome des flux de prospection et conversion.</p>
            </header>
            <DashboardCRM />
          </div>
        )}

        {activeTab === 'agents' && (
          <div className="animate-in fade-in zoom-in-95 duration-500">
            <header className="mb-10">
              <h2 className="text-4xl font-extrabold text-[#1A3C34] tracking-tight">Agent Network</h2>
              <p className="text-[#555555] mt-2 text-lg">Surveillance en temps réel des unités d'intelligence.</p>
            </header>
            <AgentStatusPanel />
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-700">
            <header className="mb-10 text-center">
              <h2 className="text-4xl font-extrabold text-[#1A3C34] tracking-tight">Business Intelligence</h2>
              <p className="text-[#555555] mt-2 text-lg">Analyses prédictives et opportunités de croissance.</p>
            </header>
            <StrategicIntelligence />
          </div>
        )}
      </main>

      <footer className="py-12 border-t border-[#E5E5E5] text-center opacity-30">
        <p className="text-[9px] font-bold uppercase tracking-[5px] text-[#1A3C34]">
          Swarm Intelligence • Autonomous Enterprise System • Build 2026.04
        </p>
      </footer>
    </div>
  );
}