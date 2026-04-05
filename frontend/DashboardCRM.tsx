'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import AgentStatusPanel from '../components/AgentStatusPanel';
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function DashboardCRM() {
  const [leads, setLeads] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // Chargement initial + tri intelligent (BANT score prioritaire)
  useEffect(() => {
    const loadLeads = async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('bant_score', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) console.error('Erreur chargement leads:', error);
      else setLeads(data || []);
      setLoading(false);
    };

    loadLeads();
  }, []);

  // Realtime sur Live Feed + indicateur de connexion
  useEffect(() => {
    const channel = supabase
      .channel('crm-live')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'live_feed_events' 
        },
        (payload) => {
          setFeed((prev) => [payload.new, ...prev].slice(0, 40));
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Tri + memo pour performance
  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      if (b.bant_score !== a.bant_score) return b.bant_score - a.bant_score;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [leads]);

  return (
    <div className="p-8 bg-zinc-950 min-h-screen text-zinc-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h1 className="text-5xl font-bold tracking-tight">SWARM CRM</h1>
            <p className="text-emerald-400 text-xl mt-1">Pipeline B2B en temps réel • Closing Machine</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-900 border ${isRealtimeConnected ? 'border-emerald-500' : 'border-zinc-700'}`}>
              <div className={`w-3 h-3 rounded-full ${isRealtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span className={isRealtimeConnected ? 'text-emerald-400' : 'text-zinc-500'}>
                {isRealtimeConnected ? 'Realtime Connecté' : 'Déconnecté'}
              </span>
            </div>
          </div>
        </div>

       'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export default function AgentStatusPanel() {
  const [agents, setAgents] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('agent_status')
        .select('*')
        .order('last_ping', { ascending: false });
      setAgents(data || []);
      setLastUpdate(new Date());
    };

    fetchAgents();

    const channel = supabase
      .channel('agent-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agent_status' }, () => {
        fetchAgents();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const getStatusColor = (status: string) => {
    if (status === 'ONLINE') return 'bg-emerald-500';
    if (status === 'IDLE') return 'bg-amber-500';
    if (status === 'ERROR') return 'bg-red-500';
    return 'bg-zinc-500';
  };

  return (
    <div className="bg-zinc-900 rounded-3xl p-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">Agent Status Monitor</h2>
        <div className="text-sm text-zinc-500">Dernière mise à jour : {lastUpdate.toLocaleTimeString('fr-FR')}</div>
      </div>

      <div className="grid gap-4">
        {agents.map((agent) => (
          <div key={agent.agent_id} className="flex items-center justify-between bg-zinc-950 p-6 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="flex items-center gap-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor(agent.status)} animate-pulse`} />
              <div>
                <div className="font-semibold text-lg">{agent.agent_name}</div>
                <div className="text-xs text-zinc-500 font-mono">{agent.agent_id}</div>
              </div>
            </div>

            <div className="text-right">
              <div className={`inline-block px-6 py-2 rounded-2xl text-sm font-medium
                ${agent.status === 'ONLINE' ? 'bg-emerald-500/10 text-emerald-400' : 
                  agent.status === 'ERROR' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                {agent.status}
              </div>
              <div className="text-xs text-zinc-500 mt-2">
                {agent.current_task && `Task: ${agent.current_task}`} • 
                {agent.memory_mb && ` ${agent.memory_mb} MB`}
              </div>
            </div>
          </div>
        ))}

        {agents.length === 0 && (
          <div className="text-center py-12 text-zinc-600">Aucun agent détecté pour le moment...</div>
        )}
      </div>
    </div>
  );
}

            <div className="flex-1 overflow-y-auto space-y-4 pr-4 custom-scroll font-mono text-[15px]">
              {feed.length === 0 && (
                <div className="h-full flex items-center justify-center text-zinc-600 italic">
                  En attente d'événements CRM...
                </div>
              )}

              {feed.map((log, i) => (
                <div key={i} className="flex gap-5 group">
                  <span className="text-zinc-500 shrink-0 w-20 text-right pt-0.5">
                    {new Date(log.created_at).toLocaleTimeString('fr-FR')}
                  </span>
                  <span className="text-emerald-400 shrink-0 w-24 font-bold uppercase tracking-widest">
                    [{log.type}]
                  </span>
                  <span className="text-zinc-200 group-hover:text-white transition-colors leading-relaxed">
                    {log.message}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-[10px] text-zinc-600 mt-6 text-center font-mono">
              Realtime • Supabase • SWARM OS v2.5
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}