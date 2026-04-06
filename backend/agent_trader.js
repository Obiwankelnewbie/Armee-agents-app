// agents/agent_trader.js — AGENT TRADER POLYMARKET & CRYPTO v2.0 (Privé)
// Améliorations : retry/backoff, safe JSON parse, logToFeed hissée, pas de
//                 setInterval parasite si require() par le Supervisor,
//                 updateAgentStatus avec champ error, timestamp explicite.
'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID      = 'AGENT-TRADER-01';
const SCAN_INTERVAL = 30 * 60 * 1000; // 30 min — utilisé seulement en mode standalone

// ─────────────────────────────────────────────────────────────
// UTILITAIRES (définis EN PREMIER — pas de TDZ)
// ─────────────────────────────────────────────────────────────

/**
 * Retry exponentiel avec jitter.
 */
async function withRetry(fn, retries = 3, base = 800) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * 2 ** attempt + Math.random() * 400;
        console.warn(`⚠️  [TRADER] Retry ${attempt + 1}/${retries - 1} dans ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Parse JSON sans lever d'exception — retourne null si invalide.
 */
function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// TÉLÉMÉTRIE
// ─────────────────────────────────────────────────────────────

async function logToFeed(type, message, leadId = null) {
  try {
    await withRetry(() =>
      supabase.from('live_feed_events').insert([{
        type,
        message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })} → ${message}`,
        lead_id: leadId,
        run_id:  `TRADER-${Date.now()}`,
      }])
    );
  } catch (err) {
    console.error('❌ [TRADER] logToFeed failed (non-fatal):', err.message);
  }
}

async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await withRetry(() =>
      supabase.from('agent_status').upsert({
        agent_id:    AGENT_ID,
        agent_name:  'Trader (Polymarket & Crypto)',
        status,
        last_ping:   new Date().toISOString(),
        current_task: currentTask,
        last_error:  error ? String(error).slice(0, 500) : null,
        version:     'v2.0 Private',
      }, { onConflict: 'agent_id' })
    );
  } catch (err) {
    console.error('❌ [TRADER] updateAgentStatus failed (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────

const TRADER_PROMPT = `Tu es l'Agent Trader privé de Swarm OS.
Ton rôle : analyser les opportunités sur Polymarket, crypto et marchés prédictifs.
Donne des insights clairs, des positions potentielles et des alertes.

Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte avant ou après :
{
  "market": "Polymarket | Crypto | Prediction",
  "opportunity": "Titre court",
  "analysis": "Analyse détaillée",
  "recommended_action": "BUY | SELL | HOLD | MONITOR",
  "confidence": "HIGH | MEDIUM | LOW",
  "risk_level": "LOW | MEDIUM | HIGH"
}`;

// ─────────────────────────────────────────────────────────────
// SCAN PRINCIPAL
// ─────────────────────────────────────────────────────────────

async function runTraderScan() {
  console.log(`📈 [TRADER] Scan démarré — ${new Date().toLocaleTimeString('fr-FR')}`);
  await updateAgentStatus('ONLINE', 'Scanning Polymarket & Crypto');

  const signal = {
    current_markets: 'Polymarket election, BTC dominance, ETH ETF flows',
    focus:           'Opportunités à court/moyen terme avec risque contrôlé',
  };

  // 1. Appel API avec retry
  let data;
  try {
    const res = await withRetry(() =>
      fetch(`${process.env.SERVER_URL}/api/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agent_id:     AGENT_ID,
          prompt:       TRADER_PROMPT,
          user_message: JSON.stringify(signal),
        }),
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.json();
      })
    );
    data = res;
  } catch (err) {
    console.error('❌ [TRADER] Fetch API failed:', err.message);
    await updateAgentStatus('ERROR', 'API fetch failed', err.message);
    await logToFeed('TRADER_ERROR', `Fetch échoué: ${err.message}`);
    return null;
  }

  // 2. Parse JSON sécurisé
  const result = safeJsonParse(data?.text ?? '');
  if (!result || !result.market) {
    const raw = String(data?.text ?? '').slice(0, 200);
    console.error('❌ [TRADER] Réponse JSON invalide ou incomplète:', raw);
    await updateAgentStatus('ERROR', 'Invalid JSON response', `Reçu: ${raw}`);
    await logToFeed('TRADER_ERROR', `JSON invalide reçu de l\'API`);
    return null;
  }

  // 3. Validation des champs attendus
  const VALID_ACTIONS     = new Set(['BUY', 'SELL', 'HOLD', 'MONITOR']);
  const VALID_CONFIDENCE  = new Set(['HIGH', 'MEDIUM', 'LOW']);
  const VALID_RISK        = new Set(['LOW', 'MEDIUM', 'HIGH']);

  if (!VALID_ACTIONS.has(result.recommended_action)) {
    console.warn(`⚠️  [TRADER] Action inattendue: ${result.recommended_action} — forcé à MONITOR`);
    result.recommended_action = 'MONITOR';
  }
  if (!VALID_CONFIDENCE.has(result.confidence))  result.confidence  = 'LOW';
  if (!VALID_RISK.has(result.risk_level))         result.risk_level  = 'HIGH';

  // 4. Log feed
  await logToFeed(
    'TRADER',
    `${result.market} : ${result.opportunity} → ${result.recommended_action} (conf: ${result.confidence}, risk: ${result.risk_level})`
  );

  // 5. Persistance avec timestamp explicite (ne pas dépendre du default DB seul)
  try {
    await withRetry(() =>
      supabase.from('private_trader_signals').insert([{
        agent_id:           AGENT_ID,
        market:             result.market,
        opportunity:        result.opportunity,
        analysis:           result.analysis,
        action:             result.recommended_action,
        confidence:         result.confidence,
        risk_level:         result.risk_level,
        scanned_at:         new Date().toISOString(), // tri chronologique fiable
      }])
    );
  } catch (err) {
    console.error('❌ [TRADER] Insert Supabase failed:', err.message);
    await logToFeed('TRADER_ERROR', `Insert échoué: ${err.message}`);
    // On ne stoppe pas — le résultat est quand même retourné au Supervisor
  }

  await updateAgentStatus('IDLE', `Scan terminé : ${result.market}`);
  console.log(`✅ [TRADER] ${result.market} — ${result.recommended_action} (${result.confidence})`);
  return result;
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE STANDALONE (node agent_trader.js directement)
// Désactivé quand require()-é par le Supervisor pour éviter
// une double boucle de scan.
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('📈 AGENT TRADER v2.0 — Mode standalone activé');
  updateAgentStatus('ONLINE', 'Starting standalone');
  runTraderScan();
  setInterval(runTraderScan, SCAN_INTERVAL);
}

module.exports = { runTraderScan };