// ═══════════════════════════════════════════════════════════════
//   🖐️  LA MAIN DE SAURON — SWARM OS
//   Le cerveau stratégique qui reçoit tout, décide tout, ordonne tout
//
//   Sources :
//     ← Œil de Sauron      (signaux HIGH/URGENT tous domaines)
//     ← Agent Contenu       (contenus prêts à exploiter)
//     ← Trader/Executor     (trades exécutés)
//     ← Leads + GMV         (données business réelles)
//
//   Actions :
//     → Ordres à l'Executor (closing, DM, campagne)
//     → Telegram War Room   (alertes temps réel)
//     → Supabase            (historique décisions)
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3333';
const AGENT_ID   = 'AGENT-MAIN-SAURON-01';
const POLL_MS    = 12_000;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 📡 TELEGRAM WAR ROOM
// ═══════════════════════════════════════════════════════════════

async function sendTelegram(message) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('   📋 Telegram non configuré — message loggé seulement');
    return;
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) {
    console.error('   ❌ Telegram failed :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🧠 PROMPTS STRATÉGIQUES PAR TYPE DE SIGNAL
// ═══════════════════════════════════════════════════════════════

const PROMPTS = {

  // Signal de l'Œil (trend/music/shop/news) → stratégie contenu + acquisition
  SAURON_SIGNAL: `Tu es LA MAIN DE SAURON, stratège suprême du Swarm OS.
Tu reçois un signal détecté par l'Œil. Décide de la meilleure action de croissance.
Réponds UNIQUEMENT en JSON :
{
  "decision": "PUSH_CONTENT | LAUNCH_CAMPAIGN | SEND_DM | IGNORE",
  "title": "Titre de la mission (court, percutant)",
  "reasoning": "Pourquoi cette décision en 1-2 phrases",
  "action_sequence": ["Étape 1", "Étape 2", "Étape 3"],
  "target_audience": "Description de la cible",
  "expected_impact": "Impact estimé chiffré",
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "telegram_alert": true,
  "executor_command": "Instruction précise pour l'Executor"
}`,

  // Contenu prêt → décide comment l'exploiter
  CONTENT_READY: `Tu es LA MAIN DE SAURON. Un contenu vient d'être généré par l'Agent Contenu.
Décide comment l'exploiter au maximum pour la croissance.
Réponds UNIQUEMENT en JSON :
{
  "decision": "PUBLISH_NOW | SCHEDULE | A_B_TEST | BOOST_WITH_ADS | HOLD",
  "title": "Titre de la mission",
  "reasoning": "Pourquoi cette décision",
  "distribution_channels": ["canal1", "canal2"],
  "best_posting_time": "HH:MM UTC",
  "expected_impact": "Impact estimé",
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "telegram_alert": true,
  "executor_command": "Instruction précise pour l'Executor"
}`,

  // Trade exécuté → analyse et réaction
  TRADE_EXECUTED: `Tu es LA MAIN DE SAURON. Un trade vient d'être exécuté sur la blockchain.
Analyse et décide de la suite.
Réponds UNIQUEMENT en JSON :
{
  "decision": "HOLD | TAKE_PROFIT | DOUBLE_DOWN | ALERT_COMMUNITY | IGNORE",
  "title": "Titre de la mission",
  "reasoning": "Analyse du trade en 1-2 phrases",
  "risk_assessment": "LOW | MEDIUM | HIGH | CRITICAL",
  "next_price_target": "Prix cible ou null",
  "expected_impact": "Impact estimé",
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "telegram_alert": true,
  "executor_command": "Instruction précise pour la suite"
}`,

  // Analyse globale périodique leads + GMV
  GLOBAL_STRATEGY: `Tu es LA MAIN DE SAURON. Analyse l'état global du Swarm et génère l'ordre de mission prioritaire.
Réponds UNIQUEMENT en JSON :
{
  "decision": "VIRAL_HOOK | CONTENT_STRATEGY | ACQUISITION | OPTIMIZATION | CLOSING_PUSH",
  "title": "Titre de la mission",
  "reasoning": "Analyse stratégique en 2-3 phrases",
  "weak_points": ["Point faible 1", "Point faible 2"],
  "opportunities": ["Opportunité 1", "Opportunité 2"],
  "action_sequence": ["Étape 1", "Étape 2", "Étape 3"],
  "expected_impact": "Impact estimé chiffré",
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "telegram_alert": true,
  "executor_command": "Instruction ultra-précise pour l'Executor"
}`,
};

// ═══════════════════════════════════════════════════════════════
// 🔧 UTILITAIRES
// ═══════════════════════════════════════════════════════════════

function safeJsonParse(raw) {
  try {
    const str = String(raw ?? '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const s = str.indexOf('{'), e = str.lastIndexOf('}');
    if (s === -1 || e === -1) return null;
    return JSON.parse(str.slice(s, e + 1));
  } catch { return null; }
}

async function callSwarm(prompt, userMessage) {
  const res = await fetch(`${SERVER_URL}/api/trigger`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agent_id: AGENT_ID, prompt, user_message: userMessage }),
  });
  if (!res.ok) throw new Error(`Swarm HTTP ${res.status}`);
  const data = await res.json();
  return safeJsonParse(data.text ?? data.response ?? '');
}

async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id:  `MAIN-${Date.now()}`,
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:     AGENT_ID,
      agent_name:   'La Main de Sauron',
      status,
      last_ping:    new Date().toISOString(),
      current_task: task,
      version:      'v1.0',
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb:    Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// ⚔️  DÉCISION → ACTION
// ═══════════════════════════════════════════════════════════════

async function executeDecision(decision, sourceType) {
  if (!decision) return;

  const priority = decision.priority ?? 'MEDIUM';
  const icon     = priority === 'CRITICAL' ? '🔴' : priority === 'HIGH' ? '🟠' : priority === 'MEDIUM' ? '🟡' : '⚪';

  console.log(`\n   ${icon} [${priority}] ${decision.title}`);
  console.log(`   → ${decision.decision} : ${decision.reasoning}`);
  console.log(`   → Impact : ${decision.expected_impact}`);

  // 1. Sauvegarder la décision
  await supabase.from('main_decisions').insert([{
    agent_id:       AGENT_ID,
    source_type:    sourceType,
    decision:       decision.decision,
    title:          decision.title,
    reasoning:      decision.reasoning,
    priority,
    expected_impact: decision.expected_impact,
    executor_command: decision.executor_command,
    full_payload:   JSON.stringify(decision),
    created_at:     new Date().toISOString(),
  }]);

  // 2. Envoyer l'ordre à l'Executor si nécessaire
  if (decision.executor_command && decision.decision !== 'IGNORE' && decision.decision !== 'HOLD') {
    await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: 'AGENT-EXECUTOR-BASE-01',
      content: JSON.stringify({
        action:   'EXECUTE_GROWTH_ORDER',
        command:  decision.executor_command,
        decision: decision.decision,
        priority,
        title:    decision.title,
      }),
      priority: priority === 'CRITICAL' || priority === 'HIGH' ? 'URGENT' : 'NORMAL',
      processed: false,
      created_at: new Date().toISOString(),
    }]);
    console.log(`   ⚡ Ordre envoyé à l'Executor`);
  }

  // 3. Alerte Telegram War Room
  if (decision.telegram_alert && (priority === 'CRITICAL' || priority === 'HIGH')) {
    const actionSteps = decision.action_sequence
      ? decision.action_sequence.map((s, i) => `  ${i + 1}. ${s}`).join('\n')
      : '';

    const weakPoints = decision.weak_points
      ? '\n⚠️ <b>Points faibles :</b>\n' + decision.weak_points.map(w => `  • ${w}`).join('\n')
      : '';

    const opportunities = decision.opportunities
      ? '\n💡 <b>Opportunités :</b>\n' + decision.opportunities.map(o => `  • ${o}`).join('\n')
      : '';

    await sendTelegram(
      `🖐️ <b>LA MAIN DE SAURON</b> — Ordre de Mission\n\n` +
      `${icon} <b>[${priority}] ${decision.title}</b>\n\n` +
      `🎯 <b>Décision :</b> <code>${decision.decision}</code>\n` +
      `📊 <b>Analyse :</b> ${decision.reasoning}\n` +
      `📈 <b>Impact attendu :</b> <b>${decision.expected_impact}</b>` +
      (actionSteps ? `\n\n📋 <b>Séquence d'actions :</b>\n${actionSteps}` : '') +
      weakPoints + opportunities +
      (decision.executor_command ? `\n\n⚡ <b>Commande Executor :</b>\n<i>"${decision.executor_command}"</i>` : '') +
      `\n\n⏰ ${new Date().toLocaleTimeString('fr-FR')}`
    );

    console.log(`   📱 Telegram War Room alerté`);
  }

  await logToFeed('MAIN', `[${priority}] ${decision.title} → ${decision.decision}`);
}

// ═══════════════════════════════════════════════════════════════
// 📥 TRAITEMENT DES SIGNAUX ENTRANTS
// ═══════════════════════════════════════════════════════════════

async function processIncomingSignals() {
  const { data, error } = await supabase
    .from('agent_briefings')
    .select('*')
    .eq('target_agent', AGENT_ID)
    .eq('processed', false)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(5);

  if (error) throw error;
  if (!data?.length) return 0;

  console.log(`\n📥 [MAIN] ${data.length} signal(s) reçu(s)`);

  for (const briefing of data) {
    let signal;
    try {
      signal = typeof briefing.content === 'string'
        ? JSON.parse(briefing.content)
        : briefing.content;
    } catch {
      console.warn(`⚠️  Signal #${briefing.id?.slice(0,8)} invalide — ignoré`);
      await supabase.from('agent_briefings').update({ processed: true }).eq('id', briefing.id);
      continue;
    }

    // Détermine le type de signal et le prompt approprié
    const sourceAgent = briefing.source_agent ?? '';
    let promptKey, label;

    if (sourceAgent.includes('SAURON') && !sourceAgent.includes('MAIN') && !sourceAgent.includes('CONTENU')) {
      promptKey = 'SAURON_SIGNAL';
      label     = '👁️ Œil';
    } else if (sourceAgent.includes('CONTENU')) {
      promptKey = 'CONTENT_READY';
      label     = '✍️ Contenu';
    } else if (sourceAgent.includes('TRADER') || sourceAgent.includes('EXECUTOR')) {
      promptKey = 'TRADE_EXECUTED';
      label     = '💹 Trade';
    } else {
      promptKey = 'SAURON_SIGNAL';
      label     = '📡 Signal';
    }

    // Filtrer les signaux trop faibles (score < 0.55) pour ne pas surcharger
    const score = signal.impact_score ?? signal.viral_score ?? signal.hype_score ?? signal.opportunity_score ?? 1;
    if (score < 0.55 && briefing.priority !== 'URGENT') {
      console.log(`   ⚫ [${label}] Score trop bas (${score}) — ignoré`);
      await supabase.from('agent_briefings').update({ processed: true }).eq('id', briefing.id);
      continue;
    }

    console.log(`\n${'─'.repeat(55)}`);
    console.log(`🖐️  [MAIN] Analyse signal ${label} — score: ${score}`);

    try {
      const decision = await callSwarm(
        PROMPTS[promptKey],
        `Signal à analyser : ${JSON.stringify(signal)}`
      );
      await executeDecision(decision, promptKey);
    } catch (err) {
      console.error(`   ❌ Décision échouée :`, err.message);
    }

    await supabase.from('agent_briefings').update({ processed: true }).eq('id', briefing.id);
    await sleep(2000);
  }

  return data.length;
}

// ═══════════════════════════════════════════════════════════════
// 🌍 ANALYSE STRATÉGIQUE GLOBALE (toutes les 30 min)
// ═══════════════════════════════════════════════════════════════

let lastGlobalAnalysis = 0;
const GLOBAL_INTERVAL  = 30 * 60 * 1000;

async function runGlobalStrategy() {
  if (Date.now() - lastGlobalAnalysis < GLOBAL_INTERVAL) return;
  lastGlobalAnalysis = Date.now();

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`🌍 [MAIN] Analyse stratégique globale…`);

  try {
    // Collecte des données business réelles
    const [
      { data: leads },
      { data: gmv },
      { data: recentDecisions },
      { data: recentContents },
    ] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('gmv_tracking').select('*').order('created_at', { ascending: false }).limit(14),
      supabase.from('main_decisions').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('generated_contents').select('domain, format, status, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    const globalSignal = {
      leads_count:        leads?.length ?? 0,
      leads_sample:       leads?.slice(0, 5) ?? [],
      gmv_trend:          gmv ?? [],
      recent_decisions:   recentDecisions?.map(d => ({ title: d.title, decision: d.decision, priority: d.priority })) ?? [],
      content_produced:   recentContents?.length ?? 0,
      content_breakdown:  recentContents?.reduce((acc, c) => { acc[c.format] = (acc[c.format] || 0) + 1; return acc; }, {}) ?? {},
      timestamp:          new Date().toISOString(),
    };

    const decision = await callSwarm(
      PROMPTS.GLOBAL_STRATEGY,
      `État global du Swarm : ${JSON.stringify(globalSignal)}`
    );

    await executeDecision(decision, 'GLOBAL_STRATEGY');
    console.log(`✅ Analyse stratégique terminée`);

  } catch (err) {
    console.error(`❌ Analyse globale échouée :`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 BOUCLE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

let totalDecisions = 0;

async function mainLoop() {
  try {
    await updateStatus('BUSY', 'Analyse des signaux');
    const count = await processIncomingSignals();
    totalDecisions += count;

    // Analyse globale périodique
    await runGlobalStrategy();

    await updateStatus('ONLINE', `Veille — ${totalDecisions} décisions prises`);

  } catch (err) {
    console.error('❌ Erreur boucle Main :', err.message);
    await updateStatus('ERROR', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🖐️   LA MAIN DE SAURON — SWARM OS  v1.0                  ║
╠══════════════════════════════════════════════════════════════╣
║  Reçoit   : Œil · Contenu · Trader · Executor              ║
║  Décide   : Stratégie · Campagne · Closing · Trade          ║
║  Alerte   : Telegram War Room (HIGH + CRITICAL)             ║
║  Analyse  : Globale toutes les 30 min                       ║
╚══════════════════════════════════════════════════════════════╝

Variables Telegram :
  TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID  → Alertes War Room
`);

  await updateStatus('ONLINE', 'Démarrage');

  // Alerte de démarrage
  await sendTelegram(
    `🖐️ <b>LA MAIN DE SAURON</b> — En ligne\n\n` +
    `Le Swarm OS est actif. Je surveille tout.\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  await logToFeed('MAIN', 'La Main de Sauron est en ligne — War Room activée');

  // Mise à jour du routing de l'Œil : lui dire d'envoyer les HIGH à la Main
  await updateSauronRouting();

  await mainLoop();
  setInterval(mainLoop, POLL_MS);
  setInterval(() => updateStatus('ONLINE', `Veille — ${totalDecisions} décisions`), 60_000);
}

// ═══════════════════════════════════════════════════════════════
// 🔗 ENREGISTREMENT DANS LE ROUTING SAURON
// Insère une règle dans Supabase pour que l'Œil sache où envoyer
// ═══════════════════════════════════════════════════════════════

async function updateSauronRouting() {
  try {
    // Enregistre la Main comme destinataire des signaux HIGH/CRITICAL
    await supabase.from('swarm_routing').upsert([
      { source_agent: 'AGENT-SAURON-01',         target_agent: AGENT_ID, filter: 'HIGH,CRITICAL', domain: 'ALL' },
      { source_agent: 'AGENT-CONTENU-SAURON-01', target_agent: AGENT_ID, filter: 'ALL',           domain: 'ALL' },
      { source_agent: 'AGENT-TRADER-01',         target_agent: AGENT_ID, filter: 'ALL',           domain: 'CRYPTO' },
      { source_agent: 'AGENT-EXECUTOR-BASE-01',  target_agent: AGENT_ID, filter: 'ALL',           domain: 'CRYPTO' },
    ], { onConflict: 'source_agent,target_agent' });

    console.log('✅ Routing Swarm enregistré dans swarm_routing');
  } catch {
    // Table optionnelle — non bloquant
    console.log('ℹ️  Table swarm_routing non disponible (optionnelle)');
  }
}

start().catch(err => {
  console.error('💀 Erreur fatale Main de Sauron :', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n🖐️  La Main se ferme — ${totalDecisions} décisions prises cette session.`);
  process.exit(0);
});

module.exports = { runGlobalStrategy };