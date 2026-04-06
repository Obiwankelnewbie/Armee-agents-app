'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Power } from 'lucide-react';

// Initialisation Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

type Agent = {
  agent_id: string;
  agent_name: string;
  is_active: boolean; // La colonne vitale pour le bouton ON/OFF
  status: string;
};

export default function AgentControlPanel() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Récupération des agents
  const fetchAgents = async () => {
    const { data, error } = await supabase
      .from('agent_status')
      .select('*')
      .order('agent_name');
    
    if (!error && data) setAgents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAgents();
    
    // Écoute en temps réel si un agent s'ajoute ou change d'état
    const channel = supabase
      .channel('agent-status-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status' }, 
      () => { fetchAgents(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // 2. Action du Bouton (ON/OFF)
  const toggleAgent = async (agentId: string, currentActiveStatus: boolean) => {
    // Mise à jour optimiste (visuelle immédiate)
    setAgents(agents.map(a => a.agent_id === agentId ? { ...a, is_active: !currentActiveStatus } : a));

    // Envoi à la base de données
    await supabase
      .from('agent_status')
      .update({ is_active: !currentActiveStatus })
      .eq('agent_id', agentId);
  };

  if (loading) return <div className="text-zinc-500 font-mono text-sm p-4 animate-pulse">Chargement de l'arsenal...</div>;

  return (
    <div className="bg-[#0A0A0B] border border-zinc-800 rounded-[32px] p-6 shadow-2xl">
      <div className="flex items-center gap-3 mb-6 border-b border-zinc-900 pb-4">
        <Power size={16} className="text-emerald-500" />
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">Sélection Tactique</h2>
      </div>

      <div className="space-y-3">
        {agents.map((agent) => (
          <div key={agent.agent_id} className="flex items-center justify-between p-3 bg-zinc-900/40 rounded-2xl border border-zinc-800/50 hover:bg-zinc-900/80 transition-colors">
            
            {/* Nom & Statut */}
            <div className="flex flex-col">
              <span className="text-zinc-200 font-mono text-sm tracking-tighter">{agent.agent_name}</span>
              <span className={`text-[10px] font-bold uppercase ${agent.status === 'ERROR' ? 'text-red-500' : 'text-zinc-500'}`}>
                {agent.status}
              </span>
            </div>
            
            {/* Le Bouton Toggle */}
            <button 
              onClick={() => toggleAgent(agent.agent_id, agent.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-black ${
                agent.is_active ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <span 
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 ${
                  agent.is_active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            
          </div>
        ))}
        
        {agents.length === 0 && (
          <div className="text-zinc-500 text-xs italic text-center p-4">Aucun agent détecté dans la base.</div>
        )}
      </div>
    </div>
  );
}