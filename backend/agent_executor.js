// backend/agent_executor.js — UNITÉ D'ACTION TACTIQUE v4.0
// Améliorations : audit log Supabase, retry/backoff, timeout par action,
//                 validation des champs lead, cohérence de signature,
//                 propagation d'erreur correcte, résultat structuré.
'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID = 'AGENT-EXECUTOR-01';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

async function withRetry(fn, retries = 3, base = 600) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * 2 ** attempt + Math.random() * 300;
        console.warn(`⚠️  [EXECUTOR] Retry ${attempt + 1}/${retries - 1} dans ${Math.round(delay)}ms — ${err.message}`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

/**
 * Race une fn async contre un timeout.
 */
function withTimeout(fn, ms, label) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT — ${label} (${ms}ms)`)), ms)
    ),
  ]);
}

/**
 * Valide les champs requis d'un lead.
 * @param {object}   lead
 * @param {string[]} fields
 * @throws {Error} si un champ est manquant ou vide
 */
function assertLeadFields(lead, fields) {
  const missing = fields.filter(f => !lead[f]);
  if (missing.length > 0) {
    throw new Error(`Lead ${lead.id ?? '?'} — champs manquants : ${missing.join(', ')}`);
  }
}

// ─────────────────────────────────────────────────────────────
// AUDIT LOG (table dédiée — traçabilité complète des actions)
// ─────────────────────────────────────────────────────────────

/**
 * Insère une ligne dans executor_audit_log.
 * Non-bloquant : une erreur d'audit ne doit jamais interrompre l'action.
 *
 * Schéma attendu :
 *   executor_audit_log(id, agent_id, task_type, lead_id, lead_name,
 *                      status, result_summary, error, executed_at)
 */
async function auditLog({ taskType, lead, status, resultSummary = null, error = null }) {
  try {
    await withRetry(() =>
      supabase.from('executor_audit_log').insert([{
        agent_id:       AGENT_ID,
        task_type:      taskType,
        lead_id:        lead?.id   ?? null,
        lead_name:      lead?.name ?? null,
        status,                                   // 'SUCCESS' | 'FAILURE' | 'SKIPPED'
        result_summary: resultSummary,
        error:          error ? String(error).slice(0, 500) : null,
        executed_at:    new Date().toISOString(),
      }])
    );
  } catch (err) {
    console.error('❌ [EXECUTOR] auditLog failed (non-fatal):', err.message);
  }
}

async function logToFeed(type, message, leadId = null) {
  try {
    await withRetry(() =>
      supabase.from('live_feed_events').insert([{
        type,
        message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })} → ${message}`,
        lead_id: leadId,
        run_id:  `EXEC-${Date.now()}`,
      }])
    );
  } catch (err) {
    console.error('❌ [EXECUTOR] logToFeed failed (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// ACTIONS (moteurs réels — brancher les API ici)
// ─────────────────────────────────────────────────────────────

/**
 * Envoie un DM LinkedIn via PhantomBuster / Waalaxy.
 * Retourne un résumé string en cas de succès, throw en cas d'échec.
 */
async function sendLinkedinDM(lead) {
  assertLeadFields(lead, ['name', 'linkedin_url', 'niche']);

  // ── Brancher ici : PhantomBuster, Waalaxy, HeyReach, etc. ──
  // Exemple PhantomBuster :
  // const res = await fetch('https://api.phantombuster.com/api/v2/agents/launch', {
  //   method: 'POST',
  //   headers: { 'X-Phantombuster-Key': process.env.PHANTOMBUSTER_KEY, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ id: process.env.PHANTOM_LINKEDIN_AGENT_ID, argument: { profileUrl: lead.linkedin_url, message: buildDMMessage(lead) } })
  // });
  // if (!res.ok) throw new Error(`PhantomBuster HTTP ${res.status}`);

  console.log(`📨 [EXECUTOR] DM LinkedIn → ${lead.name} (${lead.niche})`);

  // TODO: remplacer le return ci-dessous par la réponse API réelle
  return `DM envoyé à ${lead.name} via LinkedIn`;
}

/**
 * Envoie un email de proposition via Resend / SendGrid.
 */
async function sendProposalEmail(lead) {
  assertLeadFields(lead, ['name', 'email', 'niche']);

  // ── Brancher ici : Resend, SendGrid, Brevo, etc. ──
  // Exemple Resend :
  // const res = await fetch('https://api.resend.com/emails', {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ from: process.env.FROM_EMAIL, to: lead.email, subject: `Proposition Swarm OS — ${lead.niche}`, html: buildProposalHtml(lead) })
  // });
  // if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);

  console.log(`📧 [EXECUTOR] Email proposition → ${lead.email}`);

  // TODO: remplacer le return ci-dessous par la réponse API réelle
  return `Proposition envoyée à ${lead.email}`;
}

/**
 * Exécute un ordre de trade via Exchange / Polymarket.
 * Signature alignée : reçoit un objet `signal` (market, action, confidence…).
 */
async function executeTradeOrder(signal) {
  if (!signal?.market || !signal?.action) {
    throw new Error(`Signal invalide — champs requis : market, action. Reçu : ${JSON.stringify(signal)}`);
  }

  // ── Brancher ici : Binance, Hyperliquid, Polymarket CLOB API, etc. ──
  // Exemple Binance Testnet :
  // const res = await fetch('https://testnet.binance.vision/api/v3/order', {
  //   method: 'POST',
  //   headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY },
  //   body: new URLSearchParams({ symbol: signal.market, side: signal.action, type: 'MARKET', quoteOrderQty: process.env.TRADE_AMOUNT_USDT })
  // });
  // if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);

  console.log(`💰 [EXECUTOR] Ordre → ${signal.action} sur ${signal.market} (conf: ${signal.confidence ?? '?'})`);

  // TODO: remplacer le return ci-dessous par la réponse API réelle
  return `Ordre ${signal.action} passé sur ${signal.market}`;
}

// ─────────────────────────────────────────────────────────────
// DISPATCHER PRINCIPAL
// ─────────────────────────────────────────────────────────────

const ACTION_TIMEOUT = {
  SEND_LINKEDIN_DM: 15_000,
  SEND_PROPOSAL:    15_000,
  EXECUTE_TRADE:    10_000,
};

/**
 * Point d'entrée unique appelé par le Supervisor.
 * Toujours résout (ne throw jamais) — retourne { success, taskType, result?, error? }.
 */
async function executeNextAction(lead, taskType) {
  console.log(`⚡ [EXECUTOR] ${taskType} — ${lead?.name ?? lead?.market ?? '?'}`);

  const timeout = ACTION_TIMEOUT[taskType] ?? 12_000;

  try {
    const result = await withTimeout(
      () => withRetry(() => {
        switch (taskType) {
          case 'SEND_LINKEDIN_DM': return sendLinkedinDM(lead);
          case 'SEND_PROPOSAL':    return sendProposalEmail(lead);
          case 'EXECUTE_TRADE':    return executeTradeOrder(lead);
          default:
            console.warn(`⚠️  [EXECUTOR] Tâche inconnue : ${taskType}`);
            return Promise.resolve(null);
        }
      }),
      timeout,
      taskType
    );

    if (result === null) {
      // Tâche inconnue — on log mais sans erreur bloquante
      await auditLog({ taskType, lead, status: 'SKIPPED', resultSummary: 'Tâche non reconnue' });
      await logToFeed('EXECUTOR_WARN', `Tâche inconnue droppée : ${taskType}`, lead?.id);
      return { success: false, taskType, error: `Tâche inconnue : ${taskType}` };
    }

    await auditLog({ taskType, lead, status: 'SUCCESS', resultSummary: result });
    await logToFeed('EXECUTOR', result, lead?.id);
    return { success: true, taskType, result };

  } catch (err) {
    console.error(`❌ [EXECUTOR] ${taskType} failed:`, err.message);
    await auditLog({ taskType, lead, status: 'FAILURE', error: err.message });
    await logToFeed('EXECUTOR_ERROR', `${taskType} échoué (${lead?.name ?? '?'}): ${err.message}`, lead?.id);

    // On retourne un objet d'erreur structuré — ne throw pas,
    // le Supervisor gère via le résultat (pas via try/catch).
    return { success: false, taskType, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────

module.exports = { executeNextAction };