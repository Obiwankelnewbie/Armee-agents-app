// backend/agents/agent_influenceur.js — AGENT INFLUENCEUR v3.0 — SWARM OS
// Fixes : NICHES définie, CHECK_INTERVAL déclaré, anti-redondance Supabase,
//         safeJsonParse robuste, signature logToFeed corrigée, retry/backoff,
//         require.main guard, SIGTERM, agent_name statique.
'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERVER_URL     = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID       = 'AGENT-INFLUENCEUR-v3.0';
const AGENT_NAME     = 'Influenceur (TikTok & B2B)'; // statique — plus de string replace fragile
const SCAN_INTERVAL  = 5  * 60 * 1000;  // 5 min  — intervalle entre deux scans
const CHECK_INTERVAL = 4  * 60 * 1000;  // 4 min  — utilisé pour le metadata status (cohérent Supervisor)
const MEMORY_DAYS    = 15;              // fenêtre d'anti-redondance en base
const MAX_LOCAL_MEM  = 8;              // fallback mémoire locale (si Supabase flap)

// ─────────────────────────────────────────────────────────────
// NICHES — rotation intelligente
// ─────────────────────────────────────────────────────────────

const NICHES = [
  'SaaS B2B Suisse-Romande',
  'Automatisation PME France',
  'IA pour comptables indépendants',
  'TikTok Shop Bien-être Femmes 35-50',
  'Micro-logiciels niche e-commerce',
  'Personal Branding Consultants IT',
  'Dropshipping Accessoires Bureau',
  'Formation No-Code Freelances',
  'Newsletters B2B Tech',
  'Outils IA Juristes indépendants',
];

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

async function withRetry(fn, retries = 3, base = 800) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * 2 ** attempt + Math.random() * 400;
        console.warn(`⚠️  [INFLUENCEUR] Retry ${attempt + 1}/${retries - 1} dans ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Parse JSON robuste : strip markdown, locate {…}, throw si invalide.
 */
function safeJsonParse(raw) {
  try {
    const clean = String(raw ?? '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const start = clean.indexOf('{');
    const end   = clean.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('Aucun objet JSON trouvé');
    return JSON.parse(clean.slice(start, end + 1));
  } catch (err) {
    throw new Error(`safeJsonParse: ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// TÉLÉMÉTRIE
// ─────────────────────────────────────────────────────────────

async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await withRetry(() =>
      supabase.from('agent_status').upsert({
        agent_id:      AGENT_ID,
        agent_name:    AGENT_NAME,
        status,
        last_ping:     new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb:     Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        current_task:  currentTask,
        last_error:    error ? String(error).slice(0, 500) : null,
        version:       'v3.0',
        metadata:      { interval_minutes: Math.round(CHECK_INTERVAL / 60_000) },
      }, { onConflict: 'agent_id' })
    );
  } catch (err) {
    console.error('❌ [INFLUENCEUR] updateAgentStatus failed (non-fatal):', err.message);
  }
}

/**
 * Log vers live_feed_events.
 * @param {string} type
 * @param {string} message
 * @param {string|null} leadId   — UUID du lead lié (optionnel)
 * @param {object} metadata      — payload additionnel (optionnel)
 */
async function logToFeed(type, message, leadId = null, metadata = {}) {
  try {
    await withRetry(() =>
      supabase.from('live_feed_events').insert([{
        type,
        message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })} → ${message}`,
        lead_id:  leadId,   // correctement mappé sur la colonne lead_id
        metadata,
        run_id:   `INF-${Date.now()}`,
      }])
    );
  } catch (err) {
    console.error('❌ [INFLUENCEUR] logToFeed failed (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// ANTI-REDONDANCE SUPABASE (persistant entre restarts)
// ─────────────────────────────────────────────────────────────

/**
 * Vérifie si la niche a déjà été traitée dans les MEMORY_DAYS derniers jours.
 * Retourne true si doublon détecté.
 */
async function isNicheRecente(niche) {
  try {
    const since = new Date(Date.now() - MEMORY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await withRetry(() =>
      supabase
        .from('leads')
        .select('id')
        .eq('source', 'TIKTOK_SHOP_SCAN')
        .ilike('name', niche)  // insensible à la casse
        .gt('created_at', since)
        .limit(1)
    );
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.warn('⚠️  [INFLUENCEUR] isNicheRecente Supabase failed, fallback mémoire locale:', err.message);
    return false; // en cas de flap, on laisse passer plutôt que bloquer
  }
}

// ─────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Tu es l'Agent Influenceur de SWARM OS — ultra-spécialisé dans la détection de niches virales et rentables pour TikTok Shop, B2B et personal branding.

Ton rôle :
- Analyser les tendances multi-sources (TikTok, Pinterest, Google Trends, YouTube).
- Détecter des niches ultra-spécifiques et rentables (produits, sous-niches, angles créatifs).
- Générer des insights actionnables pour les agents Extraction, Pipeline TikTok, Contenu et Supervisor.

Règles strictes :
1. Anti-redondance : si la niche ressemble à une niche récente (similarité > 0.78), propose une variation ou sous-niche nouvelle et marque exploitation_recente: true.
2. Réalisme : chiffres jamais trop ronds (ex: 24,67€, 338,45€). Toujours des comparaisons temporelles ("+17,5% vs hier").
3. Angle de conversion pour chaque niche : app (swarm.core-ia.fr), média (core-ia.fr), forum (thread communautaire).
4. Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte avant ou après.

Format de réponse :
{
  "niche_globale": "string",
  "sous_niches_detectees": ["string"],
  "produits_associes": ["string"],
  "potentiel_revenu_estime": "XX,XX€",
  "score_global": number,
  "exploitation_recente": boolean,
  "similarite_trouvee": number,
  "hooks_tiktok": ["string"],
  "verdict": "FONCER|SURVEILLER|ATTENDRE",
  "angle_conversion": { "app": "string", "media": "string", "forum": "string" },
  "insights_cles": ["string"],
  "comparaison_temporelle": "string",
  "run_id": "string",
  "timestamp": "ISO string"
}`;

// ─────────────────────────────────────────────────────────────
// SCAN PRINCIPAL
// ─────────────────────────────────────────────────────────────

async function runAgentScan(niche, runCount) {
  const userMessage = [
    `Run #${runCount} — Agent Influenceur SWARM OS`,
    `Niche à analyser : "${niche}"`,
    `Timestamp : ${new Date().toISOString()}`,
    `Analyse cette niche en profondeur. Génère le JSON structuré complet.`,
  ].join('\n');

  let data;
  try {
    data = await withRetry(() =>
      fetch(`${SERVER_URL}/api/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agentUnit:        'influenceur',
          product:          niche,
          messages:         [{ role: 'user', content: userMessage }],
          _system_override: SYSTEM_PROMPT,
        }),
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.json();
      })
    );
  } catch (err) {
    throw new Error(`API fetch failed: ${err.message}`);
  }

  const raw = data?.content?.[0]?.text ?? data?.text ?? '';
  return safeJsonParse(raw); // throw si JSON invalide
}

// ─────────────────────────────────────────────────────────────
// BOUCLE PRINCIPALE
// ─────────────────────────────────────────────────────────────

let runCount   = 0;
let localMem   = []; // fallback mémoire locale (si Supabase flap sur isNicheRecente)

async function mainLoop() {
  runCount++;
  const niche = NICHES[runCount % NICHES.length]; // rotation circulaire

  console.log(`\n🔍 [INFLUENCEUR v3.0] Run #${runCount} — Niche : "${niche}"`);
  await updateAgentStatus('WORKING', `Scan niche : ${niche}`);

  // 1. Anti-redondance persistante (Supabase) + fallback locale
  const dejaTraiteeSupabase = await isNicheRecente(niche);
  const dejaTraiteeLocale   = localMem.includes(niche);

  if (dejaTraiteeSupabase || dejaTraiteeLocale) {
    console.log(`   ⏭️  Niche "${niche}" déjà traitée — skip.`);
    await logToFeed('INFLUENCEUR', `Niche "${niche}" ignorée (anti-redondance).`);
    await updateAgentStatus('IDLE', 'Niche skippée — déjà traitée');
    return;
  }

  // 2. Scan IA
  let result;
  try {
    result = await runAgentScan(niche, runCount);
  } catch (err) {
    console.error(`❌ [INFLUENCEUR] Scan échoué pour "${niche}":`, err.message);
    await logToFeed('INFLUENCEUR_ERROR', `Scan échoué (${niche}): ${err.message}`);
    await updateAgentStatus('ERROR', `Scan failed: ${niche}`, err.message);
    return;
  }

  // 3. Validation minimale du résultat
  if (!result?.niche_globale || typeof result.score_global !== 'number') {
    console.error('❌ [INFLUENCEUR] Résultat incomplet:', JSON.stringify(result).slice(0, 200));
    await logToFeed('INFLUENCEUR_ERROR', `Résultat invalide pour "${niche}" — champs manquants`);
    await updateAgentStatus('ERROR', 'Résultat invalide', 'niche_globale ou score_global manquant');
    return;
  }

  // 4. Insertion CRM si niche exploitable
  if (!result.exploitation_recente && result.score_global >= 50) {
    try {
      const { data: newLeads, error: crmError } = await withRetry(() =>
        supabase
          .from('leads')
          .insert([{
            name:      result.niche_globale,
            job_title: result.sous_niches_detectees?.[0] ?? 'Niche Trend',
            source:    'TIKTOK_SHOP_SCAN',
            bant_score: Math.min(10, Math.floor(result.score_global / 10)),
            priority:  result.score_global > 80 ? 'HIGH' : 'MEDIUM',
            status:    'NEW',
            created_at: new Date().toISOString(),
            metadata:  {
              hooks:             result.hooks_tiktok,
              potential_revenue: result.potentiel_revenu_estime,
              verdict:           result.verdict,
              angle_conversion:  result.angle_conversion,
              run_id:            `INF-${Date.now()}`,
            },
          }])
          .select()
      );

      if (crmError) throw new Error(crmError.message);

      const leadId = newLeads[0]?.id ?? null;
      await logToFeed(
        'INFLUENCEUR',
        `Nouveau lead : "${result.niche_globale}" — Score ${result.score_global} — ${result.verdict}`,
        leadId,                        // lead_id correctement passé
        { score: result.score_global, verdict: result.verdict }
      );
      console.log(`   ✅ CRM : Lead créé (ID: ${leadId}) — ${result.verdict}`);

    } catch (err) {
      console.error('❌ [INFLUENCEUR] Insert CRM failed:', err.message);
      await logToFeed('INFLUENCEUR_ERROR', `Insert CRM échoué pour "${niche}": ${err.message}`);
      // On continue — la mémoire locale est quand même mise à jour
    }
  } else {
    const reason = result.exploitation_recente
      ? 'exploitation récente signalée par le LLM'
      : `score trop faible (${result.score_global})`;
    console.log(`   ⚠️  Niche ignorée — ${reason}`);
    await logToFeed('INFLUENCEUR', `"${niche}" non insérée — ${reason}`);
  }

  // 5. Mise à jour mémoire locale (fallback)
  localMem.push(niche);
  if (localMem.length > MAX_LOCAL_MEM) localMem.shift();

  await updateAgentStatus('IDLE', `Run #${runCount} terminé — ${result.verdict}`);
  console.log(`✅ [INFLUENCEUR] Run #${runCount} terminé — ${result.niche_globale} (${result.verdict})`);
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE STANDALONE uniquement
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   AGENT INFLUENCEUR v3.0 — SWARM OS                      ║
╠══════════════════════════════════════════════════════════╣
║  Intervalle : 5 min · Anti-redondance : Supabase 15j     ║
║  Niches     : ${String(NICHES.length).padEnd(2)} entrées · Mode : Production             ║
╚══════════════════════════════════════════════════════════╝
`);

  updateAgentStatus('ONLINE', 'Démarrage standalone');
  logToFeed('INFLUENCEUR', 'Agent Influenceur v3.0 démarré — Détection B2B + TikTok active.');

  mainLoop();
  setInterval(mainLoop, SCAN_INTERVAL);
}

// ─────────────────────────────────────────────────────────────
// ARRÊT PROPRE (SIGINT + SIGTERM pour Docker/PM2)
// ─────────────────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  console.log(`\n🛑 [INFLUENCEUR] Signal ${signal} — arrêt après ${runCount} runs.`);
  await updateAgentStatus('OFFLINE', `Shutdown via ${signal}`);
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = { mainLoop, runAgentScan };