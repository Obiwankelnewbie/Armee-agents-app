'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialisation du client Supabase (Vérifie bien tes variables d'env)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function AgentStatusPanel() {
  const [agents, setAgents] = useState<any[]>([]);

  // 1. Récupération initiale et Souscription Realtime
  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('agent_status')
        .select('*')
        .order('agent_name', { ascending: true }); // Tri par nom pour éviter que les lignes sautent
      setAgents(data || []);
    };

    fetchAgents();

    // Souscription aux changements de la table agent_status
    const channel = supabase
      .channel('agent-status-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_status' },
        () => {
          fetchAgents(); // On rafraîchit dès qu'un agent bouge
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 2. Helper pour les couleurs de statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE': return 'bg-emerald-500 animate-pulse';
      case 'IDLE':   return 'bg-amber-500';
      case 'ERROR':  return 'bg-red-500 animate-pulse';
      case 'OFFLINE': return 'bg-zinc-600';
      default:       return 'bg-zinc-500';
    }
  };

  return (
    <div className="bg-zinc-900 rounded-3xl p-8 border border-zinc-800 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold tracking-tight">Agent Status</h2>
        <span className="text-xs font-mono text-zinc-500 bg-zinc-800 px-3 py-1 rounded-full border border-zinc-700">
          REALTIME ON
        </span>
      </div>
      
      <div className="grid gap-4">
        {agents.map((agent) => (
          <div 
            key={agent.agent_id} 
            className="flex items-center justify-between bg-zinc-950 p-6 rounded-2xl border border-zinc-800 transition-all hover:border-zinc-600"
          >
            {/* Infos Agent */}
            <div className="flex items-center gap-5">
              <div className={`w-4 h-4 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] ${getStatusColor(agent.status)}`} />
              <div>
                <div className="font-bold text-lg text-zinc-100">{agent.agent_name}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest italic">
                  {agent.agent_id}
                </div>
              </div>
            </div>

            {/* Statut et Tâche */}
            <div className="text-right">
              <div className={`inline-block px-4 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${
                agent.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' :
                agent.status === 'IDLE' ? 'bg-amber-500/10 text-amber-400' :
                agent.status === 'ERROR' ? 'bg-red-500/10 text-red-400' :
                'bg-zinc-800 text-zinc-500'
              }`}>
                {agent.status}
              </div>
              
              <div className="mt-2 text-[11px] font-medium text-zinc-400 max-w-[150px] truncate">
                {agent.current_task ? (
                   <span className="opacity-80">🛰️ {agent.current_task}</span>
                ) : (
                   <span className="text-zinc-600 italic">En attente...</span>
                )}
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 italic">
            Initialisation de la flotte d'agents...
          </div>
        )}
      </div>

      {/* Footer / Stats Rapides */}
      <div className="mt-8 pt-6 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-600 font-mono uppercase">
        <div>Swarm OS v2.5</div>
        <div>{agents.filter(a => a.status === 'ONLINE').length} Active Units</div>
      </div>
    </div>
  );
}