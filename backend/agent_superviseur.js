// backend/agent_superviseur.js — SUPERVISOR v2.7 — BRIDGE MODE ACTIVATED
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { processCrmSignal } = require('./agent_crm_optimizer');
const { executeNextAction } = require('./agent_executor');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = 'SUPERVISOR-v2.7';
const CHECK_INTERVAL = 4 * 60 * 1000; // 4 minutes

// ─────────────────────────────────────────────────────────────
// LOGS ET MONITORING
// ─────────────────────────────────────────────────────────────

async function logToFeed(type, message, leadId = null) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      lead_id: leadId,
      run_id: `SUP-${Date.now()}`
    }]);
  } catch (err) {
    console.error('Erreur logToFeed:', err.message);
  }
}

async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: 'Supervisor',
      status,
      last_ping: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      current_task: currentTask,
      last_error: error ? error.toString().slice(0, 500) : null,
      version: 'v2.7 (Bridge)'
    }, { onConflict: 'agent_id' });
  } catch (e) {
    console.error('Status update failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// TELEGRAM : NOTIFICATIONS STRATÉGIQUES
// ─────────────────────────────────────────────────────────────

async function sendTelegramAlert(message, options = {}) {
  try {
    const { sendTelegramAlert: send } = require('./telegram/bot');
    await send(message, options);
  } catch (e) {
    console.warn('⚠️ Telegram non disponible :', e.message);
  }
}

async function startupAlert() {
  await sendTelegramAlert(
    `<b>👁️ SUPERVISOR v2.7 ACTIVÉ</b>\n\n` +
    `✅ SwarmOS est opérationnel\n` +
    `🌉 <b>BRIDGE MODE :</b> Actif (Growth → Executor)\n` +
    `🤖 Agents : Supervisor • CRM Optimizer • Executor • Growth Hacker\n\n` +
    `Système autonome prêt pour l'exécution massive.`,
    { emoji: '🛰️' }
  );
}

// ─────────────────────────────────────────────────────────────
// LE BRIDGE : GROWTH HACKER → EXECUTOR
// ─────────────────────────────────────────────────────────────

async function checkGrowthIdeasAndExecute() {
  await updateAgentStatus('ONLINE', 'Checking Bridge: Growth -> Executor');

  try {
    // Récupère les dernières idées HIGH priority du Growth Hacker
    const { data: growthLogs } = await supabase
      .from('live_feed_events')
      .select('*')
      .eq('type', 'GROWTH')
      .order('created_at', { ascending: false })
      .limit(5);

    for (const log of growthLogs || []) {
      // Si l'idée est HIGH ou mentionne une action prioritaire
      if (log.message.includes('HIGH')) {
        const ideaTitle = log.message.split('→')[1] || 'Action stratégique';

        await logToFeed('SUPERVISOR', `BRIDGE: Exécution automatique de l'idée : ${ideaTitle}`);

        // On cible le dernier lead qualifié pour porter cette action
        const { data: targetLead } = await supabase
          .from('leads')
          .select('*')
          .eq('status', 'QUALIFIED')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (targetLead) {
          // On déclenche l'exécution (on peut adapter l'action selon le titre de l'idée)
          await executeNextAction(targetLead, 'SEND_PROPOSAL'); 
          
          await sendTelegramAlert(
            `<b>🔗 BRIDGE ACTIVÉ</b>\n\n` +
            `L'idée Growth <b>"${ideaTitle.trim()}"</b> a été convertie en action immédiate pour <b>${targetLead.name}</b>.`,
            { emoji: '🌉' }
          );
          
          // On ne traite qu'une idée par cycle pour éviter la saturation
          break; 
        }
      }
    }
  } catch (e) {
    console.error('Bridge error:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// ORCHESTRATION DU SWARM
// ─────────────────────────────────────────────────────────────

async function runCrmOrchestration() {
  await updateAgentStatus('ONLINE', 'Orchestrating CRM Leads');
  try {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('status', ['QUALIFIED', 'CONTACTED', 'NEGOTIATION'])
      .limit(10);

    for (const lead of leads || []) {
      const nextTask = lead.metadata?.next_task || 
                      (lead.status === 'NEGOTIATION' ? 'SEND_PROPOSAL' : 'SEND_LINKEDIN_DM');

      await executeNextAction(lead, nextTask);
      await new Promise(r => setTimeout(r, 2000));
    }
  } catch (e) {
    console.error('Orchestration error:', e.message);
  }
}

async function mainCycle() {
  console.log(`\n👁 [SUPERVISOR v2.7] Cycle — ${new Date().toLocaleTimeString('fr-FR')}`);
  
  try {
    // 1. Gérer le flux CRM habituel
    await runCrmOrchestration();

    // 2. Vérifier les idées du Growth Hacker et les EXÉCUTER (Bridge)
    await checkGrowthIdeasAndExecute();

    // 3. Vérifier les victoires (leads WON récents)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: wonLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'WON')
      .gt('updated_at', tenMinutesAgo);

    for (const lead of wonLeads || []) {
      await sendTelegramAlert(
        `<b>💰 VICTOIRE : CASH COLLECTED !</b>\n\n` +
        `👤 Client : ${lead.name}\n` +
        `🚀 Lead ID : <code>${lead.id}</code>`,
        { emoji: '🎉' }
      );
    }

    await updateAgentStatus('IDLE', 'Cycle complete - Waiting');
    console.log('✅ Cycle terminé avec succès');
  } catch (err) {
    console.error('Cycle error:', err.message);
    await updateAgentStatus('ERROR', null, err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE FINAL
// ─────────────────────────────────────────────────────────────

console.log(`
╔══════════════════════════════════════════════════════╗
║   SUPERVISOR v2.7 — SWARM OS (BRIDGE MODE)          ║
╠══════════════════════════════════════════════════════╣
║  Intelligence -> Action • Autonomie Totale          ║
╚══════════════════════════════════════════════════════╝
`);

logToFeed('SUPERVISOR', 'Supervisor v2.7 Online — Bridge Growth/Executor actif.');
updateAgentStatus('ONLINE', 'Stabilizing system');

setTimeout(async () => {
  await startupAlert();
  await updateAgentStatus('ONLINE', 'Ready');
  
  mainCycle();
  setInterval(mainCycle, CHECK_INTERVAL);
}, 30000);

process.on('SIGINT', async () => {
  await updateAgentStatus('OFFLINE', 'Stopped by Master');
  await sendTelegramAlert("<b>🛑 SUPERVISOR ARRÊTÉ</b>\nLe Swarm est en veille.", { emoji: '⛔' });
  console.log('\n🛑 Arrêt propre.');
  process.exit(0);
});