// src/lib/supabase.ts
// ─────────────────────────────────────────────────────────
// Client Supabase unique — partagé dans tout le frontend
// Pas de crash si les variables sont manquantes (mode démo)
// ─────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string | undefined;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// ✅ Plus de throw — on crée un client factice si les variables manquent
// L'app fonctionne en mode démo sans Supabase configuré
const FALLBACK_URL  = 'https://placeholder.supabase.co';
const FALLBACK_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export const supabaseConfigured = !!(supabaseUrl && supabaseAnon
  && supabaseUrl !== 'https://placeholder.supabase.co');

if (!supabaseConfigured) {
  console.warn(
    '⚠️ Supabase non configuré — mode démo actif.\n' +
    'Pour activer Supabase, crée src/.env.local avec :\n' +
    '  VITE_SUPABASE_URL=https://ton-projet.supabase.co\n' +
    
  );
}

// Un seul createClient dans toute l'app — importé partout depuis ici
export const supabase = createClient(
  supabaseUrl  || FALLBACK_URL,
  supabaseAnon || FALLBACK_ANON,
  {
    realtime: { params: { eventsPerSecond: 10 } },
    auth: { persistSession: true, autoRefreshToken: true },
  }
);

// Canaux Realtime nommés (évite les doublons de souscription)
export const CHANNELS = {
  AGENTS:    'swarm:agents',
  JOBS:      'swarm:video_jobs',
  ANALYTICS: 'swarm:analytics_gmv',
  FEED:      'swarm:live_feed',
  TRADER:    'swarm:trader_signals',
  MIRROR:    'swarm:mirror_memory',
  CONTENTS:  'swarm:generated_contents',
} as const;