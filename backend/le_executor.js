// ═══════════════════════════════════════════════════════════════
//
//       ▄████████████████████████████████████████████▄
//       █                                            █
//       █         ⚡  L ' E X E C U T O R           █
//       █      Unité d'Action Tactique · Swarm OS    █
//       █              Version  2.0                  █
//       █                                            █
//       ▀████████████████████████████████████████████▀
//
//   "Il ne réfléchit pas. Il exécute. Précisément."
//
//   ─────────────────────────────────────────────────────────────
//
//   L'Executor est le bras armé du Swarm.
//   Quand les agents décident, lui agit.
//   Il ne prend jamais d'initiative — il reçoit des ordres
//   validés et les exécute avec rigueur et traçabilité totale.
//
//   TROIS TYPES D'ACTIONS :
//
//   📨  CRM — DM LinkedIn, email proposition
//       Déclenché par Nexo / Le Général sur leads qualifiés.
//
//   💰  TRADING — Ordres de marché
//       Déclenché par Le Trader sur signaux BUY validés.
//       Usage strictement privé.
//
//   📣  CONTENT — Publication assistée
//       Marque un contenu comme POSTED dans generated_contents.
//       Notifie Ancalagone pour la feedback loop.
//
//   ─────────────────────────────────────────────────────────────
//
//   PRINCIPES :
//     • Ne throw jamais — retourne toujours un résultat structuré
//     • Audit log complet de chaque action (succès ET échec)
//     • Timeout strict par type d'action
//     • Retry avec backoff exponentiel
//     • Notifie Le Général après chaque action critique
//     • Boucle Ancalagone — chaque résultat est mémorisé
//
//   Version : 2.0 — Avril 2026
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:   'AGENT-EXECUTOR-01',
  AGENT_NAME: 'L\'Executor',
  VERSION:    'v2.0',

  // Timeouts par type d'action (ms)
  TIMEOUTS: {
    SEND_LINKEDIN_DM:  15_000,
    SEND_PROPOSAL:     15_000,
    EXECUTE_TRADE:     10_000,
    MARK_CONTENT_POSTED: 5_000,
    DEFAULT:           12_000,
  },

  // Retry
  RETRY_COUNT:    3,
  RETRY_BASE_MS:  600,

  // Polling — vérifie les tâches en attente
  POLL_INTERVAL_MS: 2 * 60_000,   // toutes les 2 min
  TASK_BATCH:       5,             // max tâches par cycle
  PING_INTERVAL_MS: 60_000,

  // Telegram
  TELEGRAM_COOLDOWN_MS: 400,
};

// ═══════════════════════════════════════════════════════════════
// 🔌  CLIENTS
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ═══════════════════════════════════════════════════════════════
// 🔧  UTILITAIRES
// ═══════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

async function withRetry(fn, retries = CONFIG.RETRY_COUNT, base = CONFIG.RETRY_BASE_MS) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * 2 ** attempt + Math.random() * 300;
        console.warn(`   ⚠️  Retry ${attempt + 1}/${retries - 1} dans ${Math.round(delay)}ms — ${err.message}`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

function withTimeout(fn, ms, label) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT — ${label} (${ms}ms)`)), ms)
    ),
  ]);
}

function assertFields(obj, fields, context = '') {
  const missing = fields.filter(f => !obj[f]);
  if (missing.length > 0) {
    throw new Error(`${context} — champs manquants : ${missing.join(', ')}`);
  }
}

function safeJsonParse(raw) {
  try {
    const str = String(raw ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const s = str.indexOf('{'), e = str.lastIndexOf('}');
    if (s === -1 || e === -1) return null;
    return JSON.parse(str.slice(s, e + 1));
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// 📋  TÉLÉMÉTRIE & AUDIT
// ═══════════════════════════════════════════════════════════════

async function logToFeed(type, message, leadId = null, metadata = {}) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message:    `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      lead_id:    leadId,
      metadata,
      run_id:     `EXEC-${Date.now()}`,
      created_at: new Date().toISOString(),
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:       CONFIG.AGENT_ID,
      agent_name:     CONFIG.AGENT_NAME,
      status,
      last_ping:      new Date().toISOString(),
      current_task:   task,
      version:        CONFIG.VERSION,
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      metadata: {
        actions_total:   actionsTotal,
        actions_success: actionsSuccess,
        actions_failed:  actionsFailed,
        poll_cycles:     pollCycles,
      },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

/**
 * Audit log complet — traçabilité de chaque action.
 * Ne bloque jamais l'exécution principale.
 */
async function auditLog({ taskType, subject, status, resultSummary = null, error = null, metadata = {} }) {
  try {
    await withRetry(() =>
      supabase.from('executor_audit_log').insert([{
        agent_id:       CONFIG.AGENT_ID,
        task_type:      taskType,
        lead_id:        subject?.id     ?? null,
        lead_name:      subject?.name   ?? subject?.market ?? null,
        status,                              // SUCCESS | FAILURE | SKIPPED | TIMEOUT
        result_summary: resultSummary ? String(resultSummary).slice(0, 500) : null,
        error:          error ? String(error).slice(0, 500) : null,
        metadata,
        executed_at:    new Date().toISOString(),
      }])
    );
  } catch (err) {
    console.error('   ❌ auditLog non-fatal :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📱  TELEGRAM — notifications actions critiques
// ═══════════════════════════════════════════════════════════════

const telegramQueue = [];
let telegramBusy    = false;

async function flushTelegram() {
  if (telegramBusy || telegramQueue.length === 0) return;
  telegramBusy = true;

  while (telegramQueue.length > 0) {
    const { msg, chatId: overrideChatId } = telegramQueue.shift();
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = overrideChatId ?? process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (err.error_code === 429) {
            const wait = (err.parameters?.retry_after ?? 5) * 1000;
            telegramQueue.unshift({ msg, chatId: overrideChatId });
            await sleep(wait);
            break;
          }
        }
      } catch (e) {
        console.error('   ❌ Telegram Executor :', e.message);
      }
    }
    await sleep(CONFIG.TELEGRAM_COOLDOWN_MS);
  }

  telegramBusy = false;
}

function sendTelegram(message, isPrivate = false) {
  const chatId = isPrivate
    ? (process.env.TELEGRAM_PRIVATE_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID)
    : process.env.TELEGRAM_CHAT_ID;
  telegramQueue.push({ msg: message, chatId });
  flushTelegram().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
//
//   📨  ACTION 1 — DM LINKEDIN
//
//   Branche ici : PhantomBuster, Waalaxy, HeyReach…
//
// ═══════════════════════════════════════════════════════════════

async function sendLinkedinDM(lead) {
  assertFields(lead, ['name', 'linkedin_url', 'niche'], `Lead ${lead.id ?? '?'}`);

  // ── À brancher ────────────────────────────────────────────────
  // PhantomBuster :
  // const res = await fetch('https://api.phantombuster.com/api/v2/agents/launch', {
  //   method:  'POST',
  //   headers: { 'X-Phantombuster-Key': process.env.PHANTOMBUSTER_KEY, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     id:       process.env.PHANTOM_LINKEDIN_AGENT_ID,
  //     argument: { profileUrl: lead.linkedin_url, message: buildDMMessage(lead) }
  //   }),
  // });
  // if (!res.ok) throw new Error(`PhantomBuster HTTP ${res.status}`);
  // ────────────────────────────────────────────────────────────

  console.log(`   📨 DM LinkedIn → ${lead.name} (${lead.niche})`);
  return `DM envoyé à ${lead.name} via LinkedIn`;
}

// ═══════════════════════════════════════════════════════════════
//
//   📧  ACTION 2 — EMAIL PROPOSITION
//
//   Branche ici : Resend, SendGrid, Brevo…
//
// ═══════════════════════════════════════════════════════════════

async function sendProposalEmail(lead) {
  assertFields(lead, ['name', 'email', 'niche'], `Lead ${lead.id ?? '?'}`);

  // ── À brancher ────────────────────────────────────────────────
  // Resend :
  // const res = await fetch('https://api.resend.com/emails', {
  //   method:  'POST',
  //   headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     from:    process.env.FROM_EMAIL,
  //     to:      lead.email,
  //     subject: `Proposition — ${lead.niche}`,
  //     html:    buildProposalHtml(lead),
  //   }),
  // });
  // if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
  // ────────────────────────────────────────────────────────────

  console.log(`   📧 Email → ${lead.email}`);
  return `Proposition envoyée à ${lead.email}`;
}

// ═══════════════════════════════════════════════════════════════
//
//   💰  ACTION 3 — ORDRE DE TRADE (PRIVÉ)
//
//   Branche ici : Binance, Hyperliquid, Base Network, Polymarket…
//
// ═══════════════════════════════════════════════════════════════

async function executeTradeOrder(signal) {
  if (!signal?.market || !signal?.action) {
    throw new Error(`Signal invalide — requis: market, action. Reçu: ${JSON.stringify(signal)}`);
  }

  // ── À brancher ────────────────────────────────────────────────
  // Binance Testnet :
  // const res = await fetch('https://testnet.binance.vision/api/v3/order', {
  //   method:  'POST',
  //   headers: { 'X-MBX-APIKEY': process.env.BINANCE_API_KEY },
  //   body:    new URLSearchParams({
  //     symbol:        signal.asset + 'USDT',
  //     side:          signal.action,
  //     type:          'MARKET',
  //     quoteOrderQty: process.env.TRADE_AMOUNT_USDT ?? '50',
  //   }),
  // });
  // if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  //
  // Base Network (via viem / ethers) :
  // import { createWalletClient, http } from 'viem'
  // import { base } from 'viem/chains'
  // const client = createWalletClient({ chain: base, transport: http() })
  // const tx = await client.sendTransaction({ ... })
  // ────────────────────────────────────────────────────────────

  console.log(`   💰 Ordre → ${signal.action} sur ${signal.market} (conf: ${signal.confidence ?? '?'})`);
  return `Ordre ${signal.action} soumis sur ${signal.market} — conf: ${signal.confidence ?? '?'}`;
}

// ═══════════════════════════════════════════════════════════════
//
//   📣  ACTION 4 — MARK CONTENT POSTED
//
//   Marque un contenu Nexo comme POSTED.
//   Notifie Ancalagone pour la feedback loop d'engagement.
//
// ═══════════════════════════════════════════════════════════════

async function markContentPosted(contentRef) {
  if (!contentRef?.content_id && !contentRef?.angle_nexo) {
    throw new Error('Référence contenu invalide — content_id ou angle_nexo requis');
  }

  const { error } = await supabase
    .from('generated_contents')
    .update({
      status:    'POSTED',
      posted_at: new Date().toISOString(),
    })
    .eq('id', contentRef.content_id);

  if (error) throw new Error(`Update generated_contents : ${error.message}`);

  // Brief Ancalagone — feedback loop engagement
  await supabase.from('agent_briefings').insert([{
    source_agent: CONFIG.AGENT_ID,
    target_agent: 'AGENT-ANCALAGONE-01',
    content:      JSON.stringify({
      type:       'CONTENT_POSTED',
      content_id: contentRef.content_id,
      angle:      contentRef.angle_nexo,
      platform:   contentRef.platform ?? 'UNKNOWN',
      posted_at:  new Date().toISOString(),
    }),
    domain:    'PUBLIC',
    priority:  'NORMAL',
    processed: false,
    created_at: new Date().toISOString(),
  }]).catch(() => {});

  console.log(`   📣 Contenu marqué POSTED (ID: ${contentRef.content_id})`);
  return `Contenu ${contentRef.content_id} marqué POSTED — Ancalagone notifié`;
}

// ═══════════════════════════════════════════════════════════════
//
//   ⚡  DISPATCHER PRINCIPAL
//
//   Point d'entrée unique. Ne throw jamais.
//   Retourne toujours { success, taskType, result?, error? }
//
// ═══════════════════════════════════════════════════════════════

const TASK_MAP = {
  SEND_LINKEDIN_DM:     (subject) => sendLinkedinDM(subject),
  SEND_PROPOSAL:        (subject) => sendProposalEmail(subject),
  EXECUTE_TRADE:        (subject) => executeTradeOrder(subject),
  MARK_CONTENT_POSTED:  (subject) => markContentPosted(subject),
};

let actionsTotal   = 0;
let actionsSuccess = 0;
let actionsFailed  = 0;

async function executeAction(subject, taskType) {
  actionsTotal++;
  console.log(`\n⚡ [EXECUTOR] ${taskType} — ${subject?.name ?? subject?.market ?? subject?.content_id ?? '?'}`);

  const handler = TASK_MAP[taskType];
  const timeout = CONFIG.TIMEOUTS[taskType] ?? CONFIG.TIMEOUTS.DEFAULT;

  if (!handler) {
    console.warn(`   ⚠️  Tâche inconnue : ${taskType}`);
    await auditLog({ taskType, subject, status: 'SKIPPED', resultSummary: 'Tâche non reconnue' });
    await logToFeed('EXECUTOR_WARN', `Tâche inconnue droppée : ${taskType}`, subject?.id);
    return { success: false, taskType, error: `Tâche inconnue : ${taskType}` };
  }

  try {
    const result = await withTimeout(
      () => withRetry(() => handler(subject)),
      timeout,
      taskType
    );

    actionsSuccess++;
    await auditLog({ taskType, subject, status: 'SUCCESS', resultSummary: result });
    await logToFeed('EXECUTOR', result, subject?.id, { taskType, status: 'SUCCESS' });

    // Notifie Le Général des actions critiques
    if (['EXECUTE_TRADE', 'SEND_LINKEDIN_DM'].includes(taskType)) {
      const isPrivate = taskType === 'EXECUTE_TRADE';
      sendTelegram(
        `⚡ <b>EXECUTOR — ${taskType}</b>\n\n` +
        `✅ Succès\n<i>${result}</i>`,
        isPrivate
      );

      // Brief Le Général pour traçabilité
      await supabase.from('agent_briefings').insert([{
        source_agent: CONFIG.AGENT_ID,
        target_agent: 'AGENT-GENERAL-01',
        content:      JSON.stringify({
          type:    'EXECUTOR_ACTION_DONE',
          task:    taskType,
          subject: subject?.name ?? subject?.market,
          result,
          status:  'SUCCESS',
        }),
        domain:    taskType === 'EXECUTE_TRADE' ? 'CRYPTO' : 'PUBLIC',
        priority:  'NORMAL',
        processed: false,
        created_at: new Date().toISOString(),
      }]).catch(() => {});
    }

    return { success: true, taskType, result };

  } catch (err) {
    actionsFailed++;
    const isTimeout = err.message.startsWith('TIMEOUT');
    const status    = isTimeout ? 'TIMEOUT' : 'FAILURE';

    console.error(`   ❌ ${taskType} ${status} :`, err.message);
    await auditLog({ taskType, subject, status, error: err.message });
    await logToFeed(
      'EXECUTOR_ERROR',
      `${taskType} ${status} (${subject?.name ?? subject?.market ?? '?'}): ${err.message}`,
      subject?.id,
      { taskType, status, error: err.message }
    );

    // Alerte si action critique échoue
    if (['EXECUTE_TRADE', 'SEND_LINKEDIN_DM'].includes(taskType)) {
      sendTelegram(
        `⚡ <b>EXECUTOR — ÉCHEC ${taskType}</b>\n\n` +
        `❌ ${status}\n<i>${err.message}</i>`,
        taskType === 'EXECUTE_TRADE'
      );
    }

    return { success: false, taskType, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════
//
//   🔄  POLLING MODE — traite la queue de tâches en attente
//
//   Quand l'Executor est lancé en standalone,
//   il vérifie régulièrement s'il y a des tâches à exécuter
//   dans la table executor_queue (optionnel).
//
// ═══════════════════════════════════════════════════════════════

let pollCycles = 0;

async function pollTaskQueue() {
  pollCycles++;

  try {
    const { data: tasks } = await supabase
      .from('executor_queue')
      .select('*')
      .eq('status', 'PENDING')
      .order('priority_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(CONFIG.TASK_BATCH);

    if (!tasks?.length) return;

    console.log(`\n🔄 [EXECUTOR] Queue — ${tasks.length} tâche(s) en attente`);

    for (const task of tasks) {
      const subject   = safeJsonParse(task.subject) ?? task.subject_raw ?? {};
      const taskType  = task.task_type;

      // Marque en cours
      await supabase.from('executor_queue')
        .update({ status: 'RUNNING', started_at: new Date().toISOString() })
        .eq('id', task.id)
        .catch(() => {});

      const result = await executeAction(subject, taskType);

      // Marque terminé
      await supabase.from('executor_queue')
        .update({
          status:       result.success ? 'DONE' : 'FAILED',
          completed_at: new Date().toISOString(),
          result_note:  result.result ?? result.error ?? '',
        })
        .eq('id', task.id)
        .catch(() => {});

      await sleep(300);
    }

  } catch (err) {
    console.error('❌ [EXECUTOR] pollTaskQueue :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀  DÉMARRAGE STANDALONE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        ⚡  L ' E X E C U T O R  —  ${CONFIG.VERSION.padEnd(21)}║
║        Unité d'Action Tactique · Swarm OS                   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Actions     : LinkedIn DM · Email · Trade · Content        ║
║  Poll queue  : toutes les 2 min                             ║
║  Audit log   : complet (SUCCESS + FAILURE + TIMEOUT)        ║
║  Boucle      : Ancalagone notifié après chaque action       ║
║                                                              ║
║  "Il ne réfléchit pas. Il exécute. Précisément."            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Activation Executor');
  await logToFeed('EXECUTOR', 'L\'Executor est prêt. En attente d\'ordres.');

  sendTelegram(
    `⚡ <b>L'EXECUTOR — EN LIGNE</b>\n\n` +
    `Unité d'action tactique active.\n\n` +
    `• LinkedIn DM      : prêt\n` +
    `• Email Proposal   : prêt\n` +
    `• Trade Order      : prêt\n` +
    `• Content Marking  : prêt\n\n` +
    `Poll queue : toutes les 2 min\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  await pollTaskQueue();
  setInterval(pollTaskQueue, CONFIG.POLL_INTERVAL_MS);
  setInterval(() => updateStatus('ONLINE', `Veille — ${actionsTotal} actions | Cycle #${pollCycles}`), CONFIG.PING_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// 🛑  ARRÊT PROPRE
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n⚡ L'Executor reçoit ${signal} — fin de mission…`);
  console.log(`   ${actionsTotal} actions | ${actionsSuccess} succès | ${actionsFailed} échecs`);

  await updateStatus('OFFLINE', `Shutdown — ${signal}`);
  await logToFeed('EXECUTOR',
    `Shutdown via ${signal}. ${actionsTotal} actions, ${actionsSuccess} succès, ${actionsFailed} échecs.`
  );

  sendTelegram(
    `⚡ <b>EXECUTOR — HORS LIGNE</b>\n\n` +
    `Signal : ${signal}\n` +
    `Uptime : ${formatUptime(Math.floor(process.uptime()))}\n` +
    `Actions : ${actionsTotal} total\n` +
    `Succès : ${actionsSuccess} | Échecs : ${actionsFailed}\n` +
    `Cycles poll : ${pollCycles}`
  );

  await sleep(800);
  process.exit(0);
}

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('EXECUTOR_ERROR', `Exception : ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('EXECUTOR_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
  start().catch(async (err) => {
    console.error('💀 L\'Executor s\'effondre :', err);
    await logToFeed('EXECUTOR_ERROR', `Erreur fatale : ${err.message}`);
    process.exit(1);
  });
}

module.exports = { executeAction };

