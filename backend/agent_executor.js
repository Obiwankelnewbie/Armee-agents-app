// agent_executor.js — SWARM EXECUTOR v2.5 — Les Mains du Système
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = 'AGENT-EXECUTOR-01';
const { sendTelegramAlert } = require('./telegram/bot');
async function logToFeed(type, message, leadId = null) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} → ${message}`,
      lead_id: leadId,
      run_id: `EXEC-${Date.now()}`
    }]);
  } catch (err) {
    console.error('Erreur logToFeed:', err.message);
  }
}

// === MONITORING LIVE ===
async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: 'Executor',
      status,
      last_ping: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      current_task: currentTask,
      last_error: error ? error.toString().slice(0, 500) : null,
      version: 'v2.5'
    }, { onConflict: 'agent_id' });
  } catch (e) {
    console.error('Status update failed:', e.message);
  }
}
// --- Ligne 40 environ ---

// 1. LE PROMPT (Instruction pour l'IA) - Reste fixe en haut
const EXECUTOR_PROMPT = `Tu es l'EXECUTOR de SWARM OS — les mains du système.

Ton rôle : transformer une instruction "next_task" en une action concrète et professionnelle (email, LinkedIn DM, proposition).

Règles strictes :
- Ton professionnel, confiant, orienté valeur et closing.
- Personnalise toujours avec le nom, le poste et l'entreprise du lead.
- Sois direct sur l'objectif sans être agressif.
- Email : 120-180 mots. LinkedIn DM : 60-90 mots.

Réponds UNIQUEMENT avec ce JSON :

{
  "action_type": "SEND_EMAIL | SEND_LINKEDIN_DM | SCHEDULE_CALL | SEND_PROPOSAL",
  "subject": "string (seulement pour email)",
  "content": "Le message complet prêt à envoyer",
  "target_channel": "email | linkedin | phone",
  "lead_id": "uuid",
  "status_after": "CONTACTED | NEGOTIATION"
}
`;

// 2. LA FONCTION PRINCIPALE (Le moteur)
async function executeNextAction(lead, nextTask) {
  await updateAgentStatus('ONLINE', `Executing ${nextTask} for ${lead.name}`);

  try {
    const signal = {
      lead_id: lead.id,
      name: lead.name,
      company: lead.company_name || 'Entreprise',
      job_title: lead.job_title,
      next_task: nextTask,
      context: "Lead qualifié BANT, prêt pour action commerciale"
    };

    const res = await fetch(`${SERVER_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        prompt: EXECUTOR_PROMPT,
        user_message: JSON.stringify(signal)
      })
    });

    const data = await res.json();
    const resultText = data.text || data.content || data.result;
    const result = typeof resultText === 'string' ? JSON.parse(resultText) : resultText;

    const { action_type, subject, content, status_after } = result;

    // Log & Update Lead
    await logToFeed('EXECUTOR', `Action ${action_type} pour ${lead.name}`);
    
    if (status_after && lead.id) {
      await supabase.from('leads').update({
        status: status_after,
        next_action_date: new Date().toISOString()
      }).eq('id', lead.id);
    }

    console.log(`✅ Executor -> ${action_type}`);
    await updateAgentStatus('IDLE', `Completed: ${action_type}`);
    // 
    
    // 🏆 ALERTE VICTOIRE (À insérer ICI)
    if (result?.status_after === 'WON' || result?.action_type === 'SEND_PROPOSAL') {
      
      await sendTelegramAlert(
        `<b>💰 VICTOIRE : LEAD GAGNÉ !</b>\n\n` +
        `👤 Client : ${lead.name}\n` +
        `🏢 Entreprise : ${lead.company_name || 'N/A'}\n` +
        `🚀 Mission accomplie par l'Executor.`,
        { emoji: '🎉' }
      );
    }

    
    return result;

  } catch (err) {
    console.error('❌ Executor Error:', err);
    await updateAgentStatus('ERROR', null, err.message);
    await logToFeed('SUPERVISOR', `Erreur Executor: ${err.message}`);
    return null;
  }
}
// Démarrage


// ==========================================
// --- DÉMARRAGE ET INITIALISATION ---
// ==========================================

console.log('🚀 SWARM EXECUTOR v2.5 -> PRÊT');

// Cette fonction permet d'utiliser "await" au lancement sans erreur
async function init() {
  try {
    // On signale au Dashboard que l'agent est en ligne
    await logToFeed('SUPERVISOR', 'Executor v2.5 connecté – Prêt à envoyer des messages.');
    await updateAgentStatus('ONLINE', 'Agent starting');
    console.log('📡 Statut mis à jour sur le Dashboard (ONLINE)');
  } catch (e) {
    console.error("❌ Erreur lors de l'initialisation :", e.message);
  }
}

// On lance la machine
init();

// On exporte la fonction pour que le Supervisor (agent_superviseur.js) puisse l'appeler
module.exports = { executeNextAction };