// src/hooks/useBackend.ts
// ─────────────────────────────────────────────────────────
// Hook React qui expose toutes les fonctions backend
// avec état de chargement, cache et polling automatique.
// ─────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getBackendStatus,
  getAgentStats,
  getAgentHistory,
  getTopSignals,
  scanProduct,
  triggerAgent,
  startVeille,
  isBackendAlive,
  type BackendStatus,
  type AgentStats,
  type AgentPing,
  type TopSignal,
  type ScanResult,
  type VeilleResult,
  type VeilleComplete,
  type AgentUnit,
} from '../services/backendService';

// ─────────────────────────────────────────────────────────
// useBackendStatus — Statut backend + polling 30s
// ─────────────────────────────────────────────────────────

export function useBackendStatus() {
  const [status, setStatus]     = useState<BackendStatus | null>(null);
  const [alive, setAlive]       = useState(false);
  const [loading, setLoading]   = useState(true);

  const check = useCallback(async () => {
    try {
      const s = await getBackendStatus();
      setStatus(s);
      setAlive(true);
    } catch {
      setAlive(false);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    check();
    const iv = setInterval(check, 30_000);
    return () => clearInterval(iv);
  }, [check]);

  return { status, alive, loading, refresh: check };
}

// ─────────────────────────────────────────────────────────
// useAgentFeed — Signaux de l'agent influenceur
//               Polling toutes les 8 secondes
// ─────────────────────────────────────────────────────────

export function useAgentFeed() {
  const [stats, setStats]           = useState<AgentStats | null>(null);
  const [history, setHistory]       = useState<AgentPing[]>([]);
  const [topSignals, setTopSignals] = useState<TopSignal[]>([]);
  const [agentOnline, setAgentOnline] = useState(false);
  const [loading, setLoading]       = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [s, h, t] = await Promise.all([
        getAgentStats(),
        getAgentHistory(10),
        getTopSignals(5),
      ]);

      if (!mountedRef.current) return;

      setStats(s);
      setHistory(h);
      setTopSignals(t);

      // Agent online = ping reçu dans les 2 dernières minutes
      if (h.length > 0) {
        const lastPingAge = Date.now() - new Date(h[0].received_at).getTime();
        setAgentOnline(lastPingAge < 2 * 60 * 1000);
      } else {
        setAgentOnline(false);
      }
    } catch {
      if (mountedRef.current) setAgentOnline(false);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 8_000);
    return () => clearInterval(iv);
  }, [refresh]);

  return { stats, history, topSignals, agentOnline, loading, refresh };
}

// ─────────────────────────────────────────────────────────
// useScan — Analyse produit avec Claude
// ─────────────────────────────────────────────────────────

export function useScan() {
  const [result, setResult]       = useState<ScanResult | null>(null);
  const [quality, setQuality]     = useState<'real' | 'estimated'>('estimated');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const scan = useCallback(async (productName: string) => {
    if (!productName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await scanProduct(productName);
      setResult(res.scan);
      setQuality(res.data_quality);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur scan');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { result, quality, loading, error, scan, reset };
}

// ─────────────────────────────────────────────────────────
// useAgent — Mission agent IA (Claude)
// ─────────────────────────────────────────────────────────

export function useAgent() {
  const [output, setOutput]   = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const run = useCallback(async (
    unit: AgentUnit,
    prompt: string,
    extra?: string
  ) => {
    setLoading(true);
    setError(null);
    setOutput('');

    try {
      const text = await triggerAgent(unit, prompt, extra);
      setOutput(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur agent');
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setOutput('');
    setError(null);
  }, []);

  return { output, loading, error, run, reset };
}

// ─────────────────────────────────────────────────────────
// useVeille — Radar de viralité en streaming
// ─────────────────────────────────────────────────────────

const ALL_CATEGORIES = ['beaute', 'mode', 'tech', 'food', 'sport', 'maison', 'sante'];

export function useVeille() {
  const [results, setResults]         = useState<VeilleResult[]>([]);
  const [scanning, setScanning]       = useState<string | null>(null);
  const [summary, setSummary]         = useState<VeilleComplete | null>(null);
  const [running, setRunning]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const start = useCallback((
    categories: string[] = ALL_CATEGORIES,
    options: { maxPerCategory?: number; minScore?: number } = {}
  ) => {
    if (running) return;

    setRunning(true);
    setResults([]);
    setSummary(null);
    setError(null);
    setScanning(null);

    cancelRef.current = startVeille(categories, {
      ...options,
      onScanning: (keyword) => setScanning(keyword),
      onResult: (result) => {
        setResults(prev => {
          // Dédupliquer par keyword
          const exists = prev.find(r => r.keyword === result.keyword);
          if (exists) return prev.map(r => r.keyword === result.keyword ? result : r);
          return [result, ...prev].sort((a, b) => b.cross_score - a.cross_score);
        });
      },
      onComplete: (s) => {
        setSummary(s);
        setRunning(false);
        setScanning(null);
      },
      onError: (msg) => {
        setError(msg);
        setRunning(false);
        setScanning(null);
      },
    });
  }, [running]);

  const stop = useCallback(() => {
    cancelRef.current?.();
    setRunning(false);
    setScanning(null);
  }, []);

  const reset = useCallback(() => {
    stop();
    setResults([]);
    setSummary(null);
    setError(null);
  }, [stop]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => cancelRef.current?.();
  }, []);

  return { results, scanning, summary, running, error, start, stop, reset };
}