// src/services/backendService.ts
// ─────────────────────────────────────────────────────────
// Pont entre le frontend React et le backend Node.js (swarm-server.js)
// Tous les appels vers /api/* passent ici.
// ─────────────────────────────────────────────────────────

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

// Helper fetch avec timeout et gestion erreur uniforme
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: { ...HEADERS, ...(options?.headers || {}) },
      signal: controller.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Erreur ${res.status}`);
    }

    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────

export interface BackendStatus {
  status: 'online' | 'offline';
  version: string;
  ai: {
    claude: string;
    gemini: string;
    strategy: string;
  };
  sources: Record<string, string>;
  storage: { supabase: string };
  keywords_total: number;
  timestamp: string;
}

export interface ScanResult {
  product_name: string;
  category: string;
  global_score: number;
  tiktok_score: number;
  youtube_score: number;
  reddit_score: number;
  trends_score: number;
  pinterest_score: number;
  verdict: 'FONCER' | 'ATTENDRE' | 'RISQUÉ';
  verdict_detail: string;
  hook_suggestion: string;
  window: string;
  opportunity_level: 'HIGH' | 'MEDIUM' | 'LOW';
  insights: string[];
  agents: string[];
  sources?: {
    tiktok?: unknown;
    google_trends?: unknown;
    youtube?: unknown;
    reddit?: unknown;
  };
}

export interface ScanResponse {
  success: boolean;
  scan: ScanResult;
  data_quality: 'real' | 'estimated';
  timestamp: string;
}

export interface TriggerResponse {
  content: { type: string; text: string }[];
}

export interface AgentStats {
  total_pings: number;
  active_agents: number;
  niches_tracked: number;
  avg_score: number;
  best_score: number;
  last_ping: string;
  foncer_count: number;
}

export interface AgentPing {
  id: number;
  agent_id: string;
  status: string;
  run: number;
  niche: string | null;
  score: number | null;
  verdict: string | null;
  views_est: number | null;
  received_at: string;
}

export interface TopSignal {
  id: number;
  niche: string;
  best_score: number;
  total_hits: number;
  last_seen: string;
  verdict: string;
}

export type AgentUnit =
  | 'hunter'    // Extraction B2B
  | 'clone'     // Contenu multi-canal
  | 'spy'       // Veille concurrentielle
  | 'hook'      // Hook Generator TikTok
  | 'script'    // Script Engine
  | 'pipeline'; // Pipeline complet

// ─────────────────────────────────────────────────────────
// /api/status — Statut du backend
// ─────────────────────────────────────────────────────────

export async function getBackendStatus(): Promise<BackendStatus> {
  return apiFetch<BackendStatus>('/api/status');
}

// ─────────────────────────────────────────────────────────
// /api/scan — Analyse produit/niche avec Claude + sources
// ─────────────────────────────────────────────────────────

export async function scanProduct(productName: string): Promise<ScanResponse> {
  return apiFetch<ScanResponse>('/api/scan', {
    method: 'POST',
    body: JSON.stringify({ product_name: productName }),
  });
}

// ─────────────────────────────────────────────────────────
// /api/trigger — Mission agent IA (Claude)
// ─────────────────────────────────────────────────────────

export async function triggerAgent(
  agentUnit: AgentUnit,
  prompt: string,
  extraContext?: string
): Promise<string> {
  const content = prompt + (extraContext ? `\n${extraContext}` : '');

  const res = await apiFetch<TriggerResponse>('/api/trigger', {
    method: 'POST',
    body: JSON.stringify({
      agentUnit,
      product: content,
      messages: [{ role: 'user', content }],
    }),
  });

  return res.content?.[0]?.text || '[Réponse vide]';
}

// ─────────────────────────────────────────────────────────
// /api/agent/* — Données de l'agent influenceur (SQLite)
// ─────────────────────────────────────────────────────────

export async function getAgentStats(): Promise<AgentStats> {
  const res = await apiFetch<{ stats: AgentStats }>('/api/agent/stats');
  return res.stats;
}

export async function getAgentHistory(limit = 20): Promise<AgentPing[]> {
  const res = await apiFetch<{ history: AgentPing[] }>(`/api/agent/history?limit=${limit}`);
  return res.history;
}

export async function getTopSignals(limit = 10): Promise<TopSignal[]> {
  const res = await apiFetch<{ top_signals: TopSignal[] }>(`/api/agent/top?limit=${limit}`);
  return res.top_signals;
}

// ─────────────────────────────────────────────────────────
// /api/veille — Radar de viralité (SSE streaming)
// ─────────────────────────────────────────────────────────

export interface VeilleResult {
  keyword: string;
  category: string;
  cross_score: number;
  is_viral: boolean;
  signal_count: number;
  signals: string[];
  verdict: 'VIRAL' | 'MONTANT' | 'STABLE';
  hook_suggestion: string | null;
  scraped_at: string;
}

export interface VeilleComplete {
  total_scanned: number;
  total_results: number;
  viral_count: number;
  cross_hits: number;
  top_results: VeilleResult[];
}

/**
 * Lance la veille en streaming SSE.
 * onResult : appelé pour chaque signal trouvé
 * onComplete : appelé à la fin avec le résumé
 * onError : appelé en cas d'erreur
 */
export function startVeille(
  categories: string[],
  options: {
    maxPerCategory?: number;
    minScore?: number;
    onResult?: (result: VeilleResult) => void;
    onComplete?: (summary: VeilleComplete) => void;
    onError?: (error: string) => void;
    onScanning?: (keyword: string, category: string) => void;
  } = {}
): () => void {
  const { maxPerCategory = 2, minScore = 50, onResult, onComplete, onError, onScanning } = options;

  // AbortController pour pouvoir annuler
  const controller = new AbortController();

  fetch(`${BACKEND_URL}/api/veille`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ categories, max_per_category: maxPerCategory, min_score: minScore }),
    signal: controller.signal,
  }).then(async (res) => {
    if (!res.ok) {
      onError?.(`Erreur ${res.status}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { onError?.('Stream non disponible'); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) continue;
        if (!line.startsWith('data: ')) continue;

        try {
          const payload = JSON.parse(line.slice(6));
          const event = line.includes('result') ? 'result'
            : line.includes('complete') ? 'complete'
            : line.includes('scanning') ? 'scanning'
            : 'unknown';

          // Lire l'event depuis la ligne précédente dans le buffer SSE
          if (payload.keyword && payload.category && payload.cross_score !== undefined) {
            onResult?.(payload as VeilleResult);
          } else if (payload.total_scanned !== undefined) {
            onComplete?.(payload as VeilleComplete);
          } else if (payload.keyword && !payload.cross_score) {
            onScanning?.(payload.keyword, payload.category);
          }
        } catch { /* ligne incomplète */ }
      }
    }
  }).catch((err) => {
    if (err.name !== 'AbortError') onError?.(err.message);
  });

  // Retourne une fonction d'annulation
  return () => controller.abort();
}

// ─────────────────────────────────────────────────────────
// HEALTH CHECK — vérifie si le backend est joignable
// ─────────────────────────────────────────────────────────

export async function isBackendAlive(): Promise<boolean> {
  try {
    const status = await getBackendStatus();
    return status.status === 'online';
  } catch {
    return false;
  }
}