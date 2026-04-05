'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Log = {
  id: string;
  created_at: string;
  type: string;
  message: string;
  metadata?: any;
  run_id?: string;
};

const filterOptions = [
  { value: 'ALL', label: 'Tout' },
  { value: 'EXTRACTION', label: 'Extraction' },
  { value: 'SCORING', label: 'Scoring BANT' },
  { value: 'VOCAL', label: 'Vocal' },
  { value: 'CRM', label: 'CRM' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
];

export default function B2BLiveFeed() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const feedRef = useRef<HTMLDivElement>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Charger les logs initiaux (derniers 100)
  useEffect(() => {
    const fetchInitialLogs = async () => {
      const { data, error } = await supabase
        .from('live_feed_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Erreur chargement logs initiaux:', error);
        return;
      }

      if (data) {
        setLogs(data.reverse());
      }
    };

    fetchInitialLogs();
  }, []);

  // Abonnement Realtime Supabase
  useEffect(() => {
    const channel = supabase
      .channel('b2b_live_feed')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'live_feed_events' 
        },
        (payload) => {
          const newLog = payload.new as Log;
          
          setLogs((prev) => [...prev, newLog]);

          // Scroll automatique vers le bas
          setTimeout(() => {
            if (feedRef.current) {
              feedRef.current.scrollTo({
                top: feedRef.current.scrollHeight,
                behavior: 'smooth',
              });
            }
          }, 80);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filtrage des logs
  const filteredLogs = useMemo(() => {
    if (activeFilter === 'ALL') return logs;
    return logs.filter((log) => log.type === activeFilter);
  }, [logs, activeFilter]);

  // Calcul du nombre pour chaque filtre
  const getCount = (type: string) => {
    if (type === 'ALL') return logs.length;
    return logs.filter((log) => log.type === type).length;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 h-[580px] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-emerald-400 font-semibold text-xl tracking-tight">
            B2B Live Feed — Supervisor
          </span>
        </div>
        <div className="text-xs font-mono text-zinc-500">
          {isConnected ? '● LIVE' : '○ Déconnecté'}
        </div>
      </div>

      {/* Filtres avec compteurs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterOptions.map((filter) => {
          const count = getCount(filter.value);
          return (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`px-5 py-2 text-sm rounded-xl transition-all flex items-center gap-2 font-medium ${
                activeFilter === filter.value
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {filter.label}
              <span className={`text-xs font-mono opacity-75 ${
                activeFilter === filter.value ? 'text-black' : 'text-zinc-500'
              }`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Terminal Feed */}
      <div
        ref={feedRef}
        className="font-mono text-[15px] text-zinc-300 overflow-y-auto flex-1 space-y-3 pr-4 custom-scroll"
      >
        {filteredLogs.length === 0 && (
          <div className="h-full flex items-center justify-center text-zinc-500 italic">
            Aucun événement pour ce filtre...
          </div>
        )}

        {filteredLogs.map((log, index) => {
          const date = new Date(log.created_at).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          const typeColor =
            log.type === 'EXTRACTION' ? 'text-blue-400' :
            log.type === 'SCORING' ? 'text-purple-400' :
            log.type === 'VOCAL' ? 'text-amber-400' :
            log.type === 'CRM' ? 'text-cyan-400' :
            log.type === 'SUPERVISOR' ? 'text-red-400' :
            'text-emerald-400';

          return (
            <div
              key={index}
              className="flex gap-4 hover:bg-zinc-900/60 p-3 rounded-xl transition-all group border-l-2 border-transparent hover:border-zinc-700"
            >
              {/* Heure */}
              <span className="text-zinc-500 font-mono shrink-0 w-20 text-right select-none pt-0.5">
                {date}
              </span>

              {/* Type */}
              <span className={`${typeColor} font-bold shrink-0 w-32 uppercase tracking-widest pt-0.5`}>
                [{log.type}]
              </span>

              {/* Message */}
              <span className="text-zinc-200 group-hover:text-white transition-colors flex-1 leading-relaxed">
                {log.message}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="text-[10px] text-zinc-600 mt-4 text-center font-mono flex items-center justify-center gap-2">
        <span>{logs.length} événements</span>
        <span className="text-zinc-700">•</span>
        <span>Dernière mise à jour : {new Date().toLocaleTimeString('fr-FR')}</span>
      </div>
    </div>
  );
}