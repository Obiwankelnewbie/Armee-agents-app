// backend/agent_superviseur.js — SUPERVISOR v3.0 — MASTER BRIDGE
// Améliorations : retry/backoff, circuit-breaker, jitter anti-ban,
//                 pagination, import statique, idempotence des WON
'use strict';
require('dotenv').config();

const { createClient }     = require('@supabase/supabase-js');
const { executeNextAction } = require('./agent_executor');
const { rewriteForMedia }  = require('./agents/agent_media');
const { rewriteForForum }  = require('./agents/agent_forum');
const { runTraderScan }    = require('./agents/agent_trader');
const { sendTelegramAlert } = require('./telegram/bot'); // ← import statique, hors cycle

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const AGENT_ID       = 'SUPERVISOR-v3.0';
const CHECK_INTERVAL = 4 * 60 * 1000;   // 4 min
const CYCLE_TIMEOUT  = 3 * 60 * 1000;   // 3 min max par cycle (circuit-breaker)
const LEADS_PAGE     = 10;               // leads traités par cycle
const WON_WINDOW_MS  = CHECK_INTERVAL + 30_000; // fenêtre WON légèrement > intervalle

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

/**
 * Pause aléatoire entre [min, max] ms — jitter humain anti-ban
 */
const jitter = (min = 1500, max = 4000) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

/**
 * Retry exponentiel avec jitter sur une fn async.
 * @param {Function} fn       Fonction à réessayer
 * @param {number}   retries  Nombre de tentatives max
 * @param {number}   base     Délai de base en ms
 */
async function withRetry(fn, retries = 3, base = 800) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * 2 ** attempt + Math.random() * 500;
        console.warn(`⚠️  Retry ${attempt + 1}/${retries - 1} dans ${Math.round(delay)}ms — ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Race un Promise contre un timeout — circuit-breaker simple.
 * Lance une erreur si la fn dépasse `ms` ms.
 */
function withTimeout(fn, ms, label = 'Operation') {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT — ${label} a dépassé ${ms}ms`)), ms)
    ),
  ]);
}

// ─────────────────────────────────────────────────────────────
// TÉLÉMÉTRIE
// ─────────────────────────────────────────────────────────────

async function logToFeed(type, message, leadId = null) {
  try {
    await withRetry(() =>
      supabase.from('live_feed_events').insert([{
        type,
        message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
        lead_id: leadId,
        run_id: `SUP-${Date.now()}`,
      }])
    );
  } catch (err) {
    console.error('❌ logToFeed failed (non-fatal):', err.message);
  }
}

async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await withRetry(() =>
      supabase.from('agent_status').upsert({
        agent_id:      AGENT_ID,
        agent_name:    'Supervisor (Central)',
        status,
        last_ping:     new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        memory_mb:     Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        current_task:  currentTask,
        last_error:    error ? String(error).slice(0, 500) : null,
        version:       'v3.0 Master',
      }, { onConflict: 'agent_id' })
    );
  } catch (e) {
    console.error('❌ updateAgentStatus failed (non-fatal):', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// RECYCLAGE CONTENU
// ─────────────────────────────────────────────────────────────

async function recycleSuccessToContent(lead) {
  await updateAgentStatus('WORKING', `Recycling: ${lead.name}`);

  const rawContent = [
    `Succès Client : ${lead.name} a rejoint Swarm OS`,
    `dans le secteur ${lead.niche}.`,
    `Qualification BANT validée à ${lead.bant_score}%.`,
  ].join(' ');

  const results = await Promise.allSettled([
    withRetry(() => rewriteForMedia(rawContent, lead.niche)),
    withRetry(() => rewriteForForum(rawContent, lead.niche)),
  ]);

  const ok  = results.filter(r => r.status === 'fulfilled').length;
  const ko  = results.filter(r => r.status === 'rejected');

  ko.forEach((r, i) =>
    console.error(`❌ Content agent ${i} failed:`, r.reason?.message)
  );

  await logToFeed(
    'SUPERVISOR',
    `BRIDGE CONTENT : ${ok}/2 actifs générés pour la niche ${lead.niche}`,
    lead.id
  );
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 1 — SCAN FINANCIER
// ─────────────────────────────────────────────────────────────

async function stepTraderScan() {
  console.log('  [1/3] Financial scan…');
  await updateAgentStatus('ONLINE', 'Financial Market Scan');
  await withTimeout(
    () => withRetry(runTraderScan),
    60_000,
    'TraderScan'
  );
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 2 — ORCHESTRATION CRM
// ─────────────────────────────────────────────────────────────

async function stepCrmOrchestration() {
  console.log('  [2/3] CRM orchestration…');
  await updateAgentStatus('ONLINE', 'Orchestrating CRM');

  const { data: leads, error } = await withRetry(() =>
    supabase
      .from('leads')
      .select('*')
      .in('status', ['QUALIFIED', 'CONTACTED', 'NEGOTIATION'])
      .order('updated_at', { ascending: true }) // les plus anciens en priorité
      .limit(LEADS_PAGE)
  );

  if (error) throw new Error(`CRM query failed: ${error.message}`);

  for (const lead of leads ?? []) {
    const task = lead.status === 'NEGOTIATION' ? 'SEND_PROPOSAL' : 'SEND_LINKEDIN_DM';
    try {
      await withRetry(() => executeNextAction(lead, task));
    } catch (err) {
      // Un lead qui échoue ne bloque pas les suivants
      console.error(`❌ Lead ${lead.id} action failed:`, err.message);
      await logToFeed('ERROR', `Action ${task} échouée pour ${lead.name}: ${err.message}`, lead.id);
    }
    await jitter(1500, 4500); // délai variable, moins détectable
  }
}

// ─────────────────────────────────────────────────────────────
// ÉTAPE 3 — DÉTECTION DES VICTOIRES (WON)
// ─────────────────────────────────────────────────────────────

async function stepWonLeads() {
  console.log('  [3/3] WON leads detection…');

  const windowStart = new Date(Date.now() - WON_WINDOW_MS).toISOString();

  const { data: wonLeads, error } = await withRetry(() =>
    supabase
      .from('leads')
      .select('*')
      .eq('status', 'WON')
      .eq('content_recycled', false)   // ← idempotence : ne traiter qu'une fois
      .gt('updated_at', windowStart)
      .limit(LEADS_PAGE)
  );

  if (error) throw new Error(`WON query failed: ${error.message}`);

  for (const lead of wonLeads ?? []) {
    try {
      // Alerte Telegram (non-bloquante)
      sendTelegramAlert(`<b>💰 CASH COLLECTED : ${lead.name}</b>`, { emoji: '🎉' })
        .catch(e => console.warn('⚠️ Telegram non joignable:', e.message));

      await recycleSuccessToContent(lead);

      // Marquer comme traité — évite le retraitement au prochain cycle
      await withRetry(() =>
        supabase
          .from('leads')
          .update({ content_recycled: true })
          .eq('id', lead.id)
      );
    } catch (err) {
      console.error(`❌ WON processing failed pour ${lead.id}:`, err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CYCLE PRINCIPAL
// ─────────────────────────────────────────────────────────────

let cycleRunning = false; // guard contre l'empilement de cycles

async function mainCycle() {
  if (cycleRunning) {
    console.warn('⚠️  Cycle précédent toujours actif — skip.');
    return;
  }
  cycleRunning = true;
  const start = Date.now();
  console.log(`\n👁  [SUPERVISOR] Cycle Master — ${new Date().toLocaleTimeString('fr-FR')}`);

  try {
    await withTimeout(
      async () => {
        await stepTraderScan();
        await stepCrmOrchestration();
        await stepWonLeads();
      },
      CYCLE_TIMEOUT,
      'MainCycle'
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`✅ Cycle v3.0 terminé en ${elapsed}s.`);
    await updateAgentStatus('IDLE', 'Cycle complete — monitoring markets');

  } catch (err) {
    console.error('❌ CYCLE CRITICAL ERROR:', err.message);
    await updateAgentStatus('ERROR', 'Main Cycle Failure', err.message);
    await logToFeed('ERROR', `Cycle critique: ${err.message}`);
  } finally {
    cycleRunning = false;
  }
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════════════════╗
║   SUPERVISOR v3.0 — MASTER BRIDGE ACTIVATED          ║
╚══════════════════════════════════════════════════════╝
`);

setTimeout(async () => {
  await logToFeed('SUPERVISOR', 'Master Supervisor Online — Bridge, Content & Trading synchronisés.');
  await mainCycle();
  setInterval(mainCycle, CHECK_INTERVAL);
}, 5_000);

// ─────────────────────────────────────────────────────────────
// ARRÊT PROPRE
// ─────────────────────────────────────────────────────────────

async function gracefulShutdown(signal) {
  console.log(`\n🛑 Signal ${signal} reçu — arrêt propre…`);
  await updateAgentStatus('OFFLINE', 'Graceful Shutdown');
  await logToFeed('SUPERVISOR', `Shutdown propre via ${signal}.`);
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // requis pour Docker/PM2