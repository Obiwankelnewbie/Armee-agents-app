// backend/agent_growth_hacker.js — GROWTH HACKER v2.7 BRIDGE MODE
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { sendTelegramAlert } = require('./telegram/bot');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = 'AGENT-GROWTH-HACKER-01';

// ─────────────────────────────────────────────────────────────
// MONITORING & LOGS
// ─────────────────────────────────────────────────────────────

async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id: `GROWTH-${Date.now()}`
    }]);
  } catch (err) {
    console.error('Erreur logToFeed:', err.message);
  }
}

async function updateAgentStatus(status = 'ONLINE', currentTask = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: 'Growth Hacker',
      status,
      last_ping: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      current_task: currentTask,
      version: 'v2.7 BRIDGE'
    }, { onConflict: 'agent_id' });
  } catch (e) {
    console.error('Status update failed:', e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// PROMPT BRIDGE : LA MATRICE D'EXÉCUTION
// ─────────────────────────────────────────────────────────────

const GROWTH_PROMPT = `Tu es le GROWTH HACKER v2.7 en mode BRIDGE.
Ton rôle : Analyser les données et générer une idée de croissance HAUTEMENT EXÉCUTABLE.

Réponds UNIQUEMENT avec ce JSON strict :
{
  "idea_type": "VIRAL_HOOK | CONTENT_STRATEGY | ACQUISITION | OPTIMIZATION",
  "title": "Titre court et percutant",
  "description": "Description détaillée de la stratégie",
  "expected_impact": "Estimation chiffrée (ex: +25% de conversion)",
  "priority": "HIGH | MEDIUM | LOW",
  "executable_action": "SEND_PROPOSAL | CREATE_TIKTOK_VIDEO | SEND_LINKEDIN_DM",
  "execution_command": "Instruction ultra-précise et complète pour l'Executor (ex: Rédige une proposition de closing pour le lead en mettant l'accent sur l'urgence TikTok)"
}`;

// ─────────────────────────────────────────────────────────────
// CŒUR DE L'AGENT : GÉNÉRATION DE L'ORDRE DE MISSION
// ─────────────────────────────────────────────────────────────

async function runGrowthHack() {
  await updateAgentStatus('ONLINE', 'Génération d\'ordre de mission Bridge');

  try {
    const { data: recentLeads } = await supabase.from('leads').select('*').limit(30);
    const { data: recentGMV } = await supabase.from('gmv_tracking').select('*').limit(7);

    const signal = {
      recent_leads: recentLeads || [],
      gmv_trend: recentGMV || [],
      mode: "BRIDGE_EXECUTION"
    };

    const res = await fetch(`${SERVER_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        prompt: GROWTH_PROMPT,
        user_message: JSON.stringify(signal)
      })
    });

    const data = await res.json();
    const result = JSON.parse(data.text || data.content?.[0]?.text || '{}');

    // 1. Log Interne
    await logToFeed('GROWTH', `${result.priority} | BRIDGE READY: ${result.title}`);
    console.log(`🚀 BRIDGE ORDRE → ${result.priority} | ${result.title}`);

    // 2. ⚡ Alerte Telegram War Room
    if (result.priority !== 'LOW') {
      await sendTelegramAlert(
        `<b>⚔️ ORDRE DE MISSION [v2.7 BRIDGE]</b>\n\n` +
        `🎯 <b>Cible :</b> ${result.title}\n` +
        `🛠 <b>Action :</b> <code>${result.executable_action}</code>\n\n` +
        `📝 <b>Commande Executor :</b>\n<i>"${result.execution_command}"</i>\n\n` +
        `📈 Impact attendu : <b>${result.expected_impact}</b>`,
        { emoji: '⚔️' }
      );
    }

    await updateAgentStatus('IDLE', `Dernière mission : ${result.title}`);
    return result;

  } catch (err) {
    console.error('❌ Growth Error:', err.message);
    await updateAgentStatus('ERROR', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// INITIALISATION
// ─────────────────────────────────────────────────────────────

console.log('🚀 GROWTH HACKER v2.7 BRIDGE MODE → ACTIVÉ');

async function init() {
  await logToFeed('SUPERVISOR', 'Growth Hacker v2.7 BRIDGE en ligne. Prêt à armer le Supervisor.');
  setTimeout(runGrowthHack, 10000);
}

init();

// Cycle d'analyse toutes les 12 minutes
setInterval(runGrowthHack, 12 * 60 * 1000);

module.exports = { runGrowthHack };