// src/hooks/useSwarm.ts
// ─────────────────────────────────────────────────────────
// ✅ Mode dégradé si Supabase non configuré → pas de crash
// ✅ 404 /api/stats /api/alerts /api/history → silencieux si serveur éteint
// ✅ Données mock en mode démo pour que l'UI s'affiche
// ─────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, CHANNELS, supabaseConfigured } from '../lib/supabase';
import { fetchAgents, fetchActiveJobs, computeSwarmStats } from '../services/dataService';
import { swarmFetch } from '../lib/auth';
import type { Agent, VideoJob, SwarmStats } from '../types';

const DEFAULT_STATS: SwarmStats = {
  totalAgents: 0, activeAgents: 0, idleAgents: 0, errorAgents: 0,
  videosToday: 0, totalGMV: 0, totalCost: 0, netMargin: 0, roi: 0,
};

// Données démo affichées quand Supabase n'est pas configuré
const DEMO_AGENTS: Agent[] = [
  { id: 'demo-1', name: 'Agent-Yas',  status: 'publishing', unit: 'tiktok_shop',  videos_produced_today: 3 },
  { id: 'demo-2', name: 'Agent-Bas',  status: 'scripting',  unit: 'tiktok_shop',  videos_produced_today: 1 },
  { id: 'demo-3', name: 'Agent-Chi',  status: 'idle',       unit: 'affiliation',  videos_produced_today: 0 },
  { id: 'demo-4', name: 'Agent-San',  status: 'rendering',  unit: 'media_buzz',   videos_produced_today: 2 },
  { id: 'demo-5', name: 'Agent-Thé',  status: 'idle',       unit: 'forum',        videos_produced_today: 0 },
  { id: 'demo-6', name: 'Agent-Cas',  status: 'scripting',  unit: 'redacteur',    videos_produced_today: 1 },
];

const DEMO_STATS: SwarmStats = {
  totalAgents:  6,
  activeAgents: 4,
  idleAgents:   2,
  errorAgents:  0,
  videosToday:  7,
  totalGMV:     1240,
  totalCost:    14,
  netMargin:    88.7,
  roi:          88,
};

export function useSwarm() {
  const [agents, setAgents]           = useState<Agent[]>([]);
  const [jobs, setJobs]               = useState<VideoJob[]>([]);
  const [stats, setStats]             = useState<SwarmStats>(DEFAULT_STATS);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading]     = useState(true);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const [error, setError]             = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    // ── Mode démo : Supabase non configuré ──
    if (!supabaseConfigured) {
      if (!mountedRef.current) return;
      setAgents(DEMO_AGENTS);
      setJobs([]);
      setStats(DEMO_STATS);
      setIsConnected(false);
      setLastUpdate(new Date());
      setError(null);
      setIsLoading(false);
      return;
    }

    // ── Mode réel : Supabase configuré ──
    try {
      const [agentsData, jobsData] = await Promise.all([
        fetchAgents(),
        fetchActiveJobs(),
      ]);

      if (!mountedRef.current) return;

      const statsData = await computeSwarmStats(agentsData, jobsData);
      if (!mountedRef.current) return;

      setAgents(agentsData);
      setJobs(jobsData);
      setStats(statsData);
      setLastUpdate(new Date());
      setError(null);

    } catch (err) {
      console.error('[useSwarm] erreur:', err);
      if (!mountedRef.current) return;

      // Affiche les données démo en cas d'erreur — pas de crash
      setAgents(DEMO_AGENTS);
      setStats(DEMO_STATS);
      setError(null); // Silencieux — mode démo auto
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Souscriptions Realtime — seulement si Supabase est configuré
    if (!supabaseConfigured) return;

    const agentChannel = supabase
      .channel(CHANNELS.AGENTS)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, () => {
        if (mountedRef.current) refresh();
      })
      .subscribe((status) => {
        if (mountedRef.current) setIsConnected(status === 'SUBSCRIBED');
      });

    const jobChannel = supabase
      .channel(CHANNELS.JOBS)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_jobs' }, () => {
        if (mountedRef.current) refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(agentChannel);
      supabase.removeChannel(jobChannel);
    };
  }, [refresh]);

  return { agents, jobs, stats, isConnected, isLoading, lastUpdate, error, refresh };
}