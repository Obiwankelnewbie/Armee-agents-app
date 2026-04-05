// src/lib/auth.ts
// ─────────────────────────────────────────────────────────
// Helper fetch centralisé vers le backend Node.js
// Toute l'app passe par swarmFetch — une seule URL à changer
// ─────────────────────────────────────────────────────────

export const SWARM_URL =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_SWARM_URL ||
  'http://localhost:3000';

const BASE_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true', // ← débloque ngrok
};

/**
 * Fetch vers le backend Swarm Node.js.
 * Gère les erreurs HTTP, retourne le JSON parsé.
 */
export async function swarmFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${SWARM_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...BASE_HEADERS,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const e = await res.json(); msg = e.error || msg; } catch {}
    throw new Error(msg);
  }

  return res.json();
}