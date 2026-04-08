// ═══════════════════════════════════════════════════════════════
//   🧙  GANDALF — LE STRATÈGE DU SWARM OS
//
//   "Je suis Gandalf le Blanc. Et Morgoth redoute mon conseil."
//
//   Là où Morgoth commande et surveille,
//   Gandalf COMPREND, ANTICIPE et GUIDE.
//
//   Il ne relance pas les agents — il empêche qu'ils tombent.
//   Il ne réagit pas aux crises — il les prédit.
//   Il ne donne pas d'ordres — il donne la DIRECTION.
//
//   Ses pouvoirs :
//     → Lit TOUTES les données du Swarm en profondeur
//     → Détecte les patterns avant qu'ils deviennent des problèmes
//     → Génère la stratégie hebdomadaire du Swarm
//     → Conseille Morgoth sur les priorités absolues
//     → Envoie le Brief Stratégique à toute la troupe
//     → Prédit les opportunités 24-48h à l'avance
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3333';
const AGENT_ID   = 'GANDALF-STRATEGE-01';

// Gandalf n'est pas pressé — il pense lentement et juste
const THINK_INTERVAL    = 20 * 60_000;  // analyse toutes les 20 min
const STRATEGY_INTERVAL = 6 * 60 * 60_000; // stratégie toutes les 6h
const BRIEF_INTERVAL    = 24 * 60 * 60_000; // brief quotidien

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 📡 TELEGRAM
// ═══════════════════════════════════════════════════════════════

async function sendTelegram(message) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    });
  } catch (err) { console.error('   ❌ Telegram :', err.message); }
}

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
      run_id:  `GANDALF-${Date.now()}`,
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:       AGENT_ID,
      agent_name:     'Gandalf — Le Stratège',
      status,
      last_ping:      new Date().toISOString(),
      current_task:   task,
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      version:        'v1.0 THE WHITE',
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 📚 LECTURE PROFONDE DU SWARM — Gandalf lit tout
// ═══════════════════════════════════════════════════════════════

async function readTheSwarm() {
  const [
    { data: leads },
    { data: gmv },
    { data: trades },
    { data: contents },
    { data: decisions },
    { data: directives },
    { data: feedEvents },
    { data: agentStatuses },
    { data: topSignals },
  ] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('gmv_tracking').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('executor_audit_log').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('generated_contents').select('*').order('created_at', { ascending: false }).limit(50),
    supabase.from('main_decisions').select('*').order('created_at', { ascending: false }).limit(30),
    supabase.from('morgoth_directives').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('live_feed_events').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('agent_status').select('*'),
    supabase.from('top_signals').select('*').order('best_score', { ascending: false }).limit(10),
  ]);

  // ── Analyse des leads ────────────────────────────────────────
  const leadsParStatut = (leads ?? []).reduce((acc, l) => {
    acc[l.status] = (acc[l.status] || 0) + 1;
    return acc;
  }, {});

  const leadsParNiche = (leads ?? []).reduce((acc, l) => {
    if (l.niche) acc[l.niche] = (acc[l.niche] || 0) + 1;
    return acc;
  }, {});

  // ── Vélocité des leads (dernières 24h vs semaine) ────────────
  const now      = Date.now();
  const h24      = new Date(now - 24 * 60 * 60_000).toISOString();
  const leadsH24 = (leads ?? []).filter(l => l.created_at > h24).length;

  // ── Performance trading ──────────────────────────────────────
  const tradesOk   = (trades ?? []).filter(t => t.status === 'SUCCESS').length;
  const tradesFail = (trades ?? []).filter(t => t.status === 'FAILURE').length;
  const tradeRate  = tradesOk + tradesFail > 0
    ? Math.round(tradesOk / (tradesOk + tradesFail) * 100)
    : null;

  // ── Contenu par domaine ──────────────────────────────────────
  const contentParDomaine = (contents ?? []).reduce((acc, c) => {
    acc[c.domain] = (acc[c.domain] || 0) + 1;
    return acc;
  }, {});

  const contentH24 = (contents ?? []).filter(c => c.created_at > h24).length;

  // ── Niches tendances détectées par l'Œil ────────────────────
  const topNiches = (topSignals ?? []).map(s => ({
    niche: s.niche,
    score: s.best_score,
    verdict: s.verdict,
  }));

  // ── État de la troupe ────────────────────────────────────────
  const agentsActifs = (agentStatuses ?? []).filter(a =>
    a.status === 'ONLINE' || a.status === 'BUSY' || a.status === 'IDLE'
  ).length;

  // ── Dernière directive de Morgoth ────────────────────────────
  const dernièreDirective = directives?.[0] ?? null;

  return {
    leads: {
      total:      leads?.length ?? 0,
      h24:        leadsH24,
      par_statut: leadsParStatut,
      par_niche:  leadsParNiche,
      niches_top: Object.entries(leadsParNiche).sort((a,b) => b[1]-a[1]).slice(0,3),
    },
    trading: {
      total:      trades?.length ?? 0,
      success:    tradesOk,
      fail:       tradesFail,
      taux:       tradeRate ? `${tradeRate}%` : 'N/A',
    },
    contenu: {
      total:      contents?.length ?? 0,
      h24:        contentH24,
      par_domaine: contentParDomaine,
    },
    decisions_main:   decisions?.length ?? 0,
    top_niches:       topNiches,
    agents_actifs:    agentsActifs,
    derniere_directive: dernièreDirective ? {
      etat:      dernièreDirective.etat_global,
      directive: dernièreDirective.directive,
    } : null,
    feed_activite:    feedEvents?.length ?? 0,
    timestamp:        new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════
// 🧙 PROMPTS DE GANDALF — Sa sagesse en JSON
// ═══════════════════════════════════════════════════════════════

const PROMPTS = {

  // Analyse de patterns — détecte les anomalies avant qu'elles explosent
  PATTERN_ANALYSIS: `Tu es GANDALF, le Stratège Suprême du Swarm OS.
Tu lis les données en profondeur et détectes les patterns invisibles.
Réponds UNIQUEMENT en JSON :
{
  "patterns_detectes": [
    { "pattern": "Description du pattern", "risque": "LOW|MEDIUM|HIGH|CRITICAL", "action": "Action recommandée" }
  ],
  "opportunite_cachee": "Opportunité que personne d'autre n'a vue",
  "alerte_precoce": "Problème qui va survenir dans 24-48h si rien n'est fait",
  "conseil_morgoth": "Conseil stratégique pour Morgoth en 1 phrase",
  "conseil_main": "Conseil pour la Main de Sauron en 1 phrase",
  "conseil_trader": "Conseil pour le Trader en 1 phrase",
  "sagesse": "Une phrase de sagesse stratégique courte et percutante"
}`,

  // Stratégie 6h — plan d'action moyen terme
  STRATEGY_6H: `Tu es GANDALF, le Stratège Suprême du Swarm OS.
Génère le plan stratégique pour les 6 prochaines heures.
Réponds UNIQUEMENT en JSON :
{
  "focus_principal": "La priorité absolue des 6 prochaines heures",
  "objectifs": [
    { "objectif": "Description", "kpi": "Métrique cible", "agent_responsable": "AGENT-ID" }
  ],
  "sequence_actions": ["Action 1 → Agent X", "Action 2 → Agent Y", "Action 3 → Agent Z"],
  "risques_a_surveiller": ["Risque 1", "Risque 2"],
  "signal_declencheur": "Si ce signal apparaît, changer de plan immédiatement",
  "message_troupe": "Message motivant pour la troupe (court, percutant)"
}`,

  // Brief quotidien — la vision du jour
  DAILY_BRIEF: `Tu es GANDALF, le Stratège Suprême du Swarm OS.
Génère le Brief Stratégique Quotidien complet.
Réponds UNIQUEMENT en JSON :
{
  "date": "aujourd'hui",
  "vision_du_jour": "La grande direction de la journée en 1 phrase",
  "contexte_marche": "Lecture du contexte crypto/social/business",
  "priorites": [
    { "rang": 1, "priorite": "Description", "pourquoi": "Raison", "agent": "AGENT-ID" },
    { "rang": 2, "priorite": "Description", "pourquoi": "Raison", "agent": "AGENT-ID" },
    { "rang": 3, "priorite": "Description", "pourquoi": "Raison", "agent": "AGENT-ID" }
  ],
  "domaines_chauds": ["Domaine 1", "Domaine 2"],
  "domaines_a_eviter": ["Domaine 3"],
  "objectif_du_jour": "1 seul KPI à atteindre aujourd'hui",
  "message_war_room": "Message pour la War Room Telegram"
}`,

};

// ═══════════════════════════════════════════════════════════════
// 💬 DIFFUSION DES CONSEILS À LA TROUPE
// ═══════════════════════════════════════════════════════════════

async function broadcastCounsel(type, payload) {
  // Gandalf envoie ses conseils via agent_briefings à chaque agent concerné
  const targets = {
    PATTERN:   ['MORGOTH-SUPREME-01', 'AGENT-MAIN-SAURON-01', 'AGENT-TRADER-01'],
    STRATEGY:  ['MORGOTH-SUPREME-01', 'AGENT-MAIN-SAURON-01', 'AGENT-CONTENU-SAURON-01'],
    DAILY:     ['MORGOTH-SUPREME-01', 'AGENT-MAIN-SAURON-01', 'AGENT-CONTENU-SAURON-01', 'AGENT-TRADER-01'],
  };

  const recipients = targets[type] ?? ['MORGOTH-SUPREME-01'];

  for (const target of recipients) {
    await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: target,
      content:      JSON.stringify({ type: `GANDALF_${type}`, ...payload }),
      priority:     'HIGH',
      processed:    false,
      created_at:   new Date().toISOString(),
    }]);
  }

  console.log(`   📨 Conseils diffusés à ${recipients.length} agents`);
}

// ═══════════════════════════════════════════════════════════════
// 🔮 ANALYSE DE PATTERNS (toutes les 20 min)
// ═══════════════════════════════════════════════════════════════

async function runPatternAnalysis() {
  console.log(`\n🔮 [GANDALF] Lecture des patterns…`);
  await updateStatus('BUSY', 'Analyse des patterns');

  try {
    const swarmData = await readTheSwarm();
    const analysis  = await callSwarm(
      PROMPTS.PATTERN_ANALYSIS,
      `Données du Swarm : ${JSON.stringify(swarmData)}`
    );

    if (!analysis) return;

    console.log(`\n   🧙 Sagesse : "${analysis.sagesse}"`);

    // Afficher les patterns détectés
    for (const p of analysis.patterns_detectes ?? []) {
      const icon = p.risque === 'CRITICAL' ? '🔴' : p.risque === 'HIGH' ? '🟠' : p.risque === 'MEDIUM' ? '🟡' : '🟢';
      console.log(`   ${icon} Pattern [${p.risque}] : ${p.pattern}`);
      console.log(`      → ${p.action}`);
    }

    if (analysis.alerte_precoce) {
      console.log(`\n   ⚠️  Alerte précoce : ${analysis.alerte_precoce}`);
    }

    if (analysis.opportunite_cachee) {
      console.log(`   💡 Opportunité : ${analysis.opportunite_cachee}`);
    }

    // Sauvegarder
    await supabase.from('gandalf_analyses').insert([{
      agent_id:    AGENT_ID,
      type:        'PATTERN',
      payload:     JSON.stringify(analysis),
      sagesse:     analysis.sagesse,
      created_at:  new Date().toISOString(),
    }]).catch(() => {});

    // Alerte Telegram si pattern critique
    const critiques = (analysis.patterns_detectes ?? []).filter(p => p.risque === 'CRITICAL' || p.risque === 'HIGH');
    if (critiques.length > 0) {
      await sendTelegram(
        `🧙 <b>GANDALF — ALERTE PATTERN</b>\n\n` +
        critiques.map(p => `🔴 <b>${p.pattern}</b>\n→ ${p.action}`).join('\n\n') +
        (analysis.alerte_precoce ? `\n\n⚠️ <b>Dans 24-48h :</b> ${analysis.alerte_precoce}` : '') +
        `\n\n<i>"${analysis.sagesse}"</i>`
      );
    }

    await broadcastCounsel('PATTERN', analysis);
    await logToFeed('GANDALF', `Patterns analysés — ${analysis.patterns_detectes?.length ?? 0} détectés`);

  } catch (err) {
    console.error('❌ Pattern analysis failed :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🗺️  STRATÉGIE 6H (toutes les 6 heures)
// ═══════════════════════════════════════════════════════════════

let lastStrategy = 0;

async function runStrategy6h() {
  if (Date.now() - lastStrategy < STRATEGY_INTERVAL) return;
  lastStrategy = Date.now();

  console.log(`\n🗺️  [GANDALF] Plan stratégique 6h…`);
  await updateStatus('BUSY', 'Élaboration stratégie 6h');

  try {
    const swarmData = await readTheSwarm();
    const strategy  = await callSwarm(
      PROMPTS.STRATEGY_6H,
      `État du Swarm pour la prochaine fenêtre de 6h : ${JSON.stringify(swarmData)}`
    );

    if (!strategy) return;

    console.log(`\n   🎯 Focus : ${strategy.focus_principal}`);
    console.log(`   📋 Séquence :`);
    (strategy.sequence_actions ?? []).forEach((a, i) => console.log(`      ${i+1}. ${a}`));

    // Sauvegarder
    await supabase.from('gandalf_analyses').insert([{
      agent_id:   AGENT_ID,
      type:       'STRATEGY_6H',
      payload:    JSON.stringify(strategy),
      sagesse:    strategy.focus_principal,
      created_at: new Date().toISOString(),
    }]).catch(() => {});

    await sendTelegram(
      `🧙 <b>GANDALF — PLAN STRATÉGIQUE 6H</b>\n\n` +
      `🎯 <b>Focus :</b> ${strategy.focus_principal}\n\n` +
      `<b>📋 Séquence :</b>\n` +
      (strategy.sequence_actions ?? []).map((a, i) => `  ${i+1}. ${a}`).join('\n') +
      `\n\n⚠️ <b>Risques :</b>\n` +
      (strategy.risques_a_surveiller ?? []).map(r => `  • ${r}`).join('\n') +
      `\n\n🔔 <b>Signal déclencheur :</b> ${strategy.signal_declencheur}` +
      `\n\n<i>"${strategy.message_troupe}"</i>`
    );

    await broadcastCounsel('STRATEGY', strategy);
    await logToFeed('GANDALF', `Stratégie 6h établie : ${strategy.focus_principal}`);

  } catch (err) {
    console.error('❌ Strategy 6h failed :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 📜 BRIEF QUOTIDIEN (une fois par jour)
// ═══════════════════════════════════════════════════════════════

let lastBrief = 0;

async function runDailyBrief() {
  if (Date.now() - lastBrief < BRIEF_INTERVAL) return;
  lastBrief = Date.now();

  console.log(`\n📜 [GANDALF] Brief quotidien…`);
  await updateStatus('BUSY', 'Brief quotidien');

  try {
    const swarmData = await readTheSwarm();
    const brief     = await callSwarm(
      PROMPTS.DAILY_BRIEF,
      `Données complètes pour le brief du jour : ${JSON.stringify(swarmData)}`
    );

    if (!brief) return;

    console.log(`\n   📜 Vision du jour : ${brief.vision_du_jour}`);
    console.log(`   🏆 Objectif : ${brief.objectif_du_jour}`);

    await supabase.from('gandalf_analyses').insert([{
      agent_id:   AGENT_ID,
      type:       'DAILY_BRIEF',
      payload:    JSON.stringify(brief),
      sagesse:    brief.vision_du_jour,
      created_at: new Date().toISOString(),
    }]).catch(() => {});

    const prioritesText = (brief.priorites ?? [])
      .map(p => `  ${p.rang}. <b>${p.priorite}</b>\n     → ${p.pourquoi}`)
      .join('\n');

    await sendTelegram(
      `🧙 <b>GANDALF — BRIEF QUOTIDIEN</b>\n` +
      `${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n` +
      `✨ <b>${brief.vision_du_jour}</b>\n\n` +
      `<b>📋 Priorités du jour :</b>\n${prioritesText}\n\n` +
      `🔥 <b>Domaines chauds :</b> ${(brief.domaines_chauds ?? []).join(' · ')}\n` +
      `❌ <b>À éviter :</b> ${(brief.domaines_a_eviter ?? []).join(' · ')}\n\n` +
      `🏆 <b>Objectif du jour :</b> ${brief.objectif_du_jour}\n\n` +
      `<i>"${brief.message_war_room}"</i>`
    );

    await broadcastCounsel('DAILY', brief);
    await logToFeed('GANDALF', `Brief quotidien : ${brief.vision_du_jour}`);

  } catch (err) {
    console.error('❌ Daily brief failed :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 BOUCLE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

let thinkCount = 0;

async function mainLoop() {
  thinkCount++;
  console.log(`\n🧙 [GANDALF] Pensée #${thinkCount} — ${new Date().toLocaleTimeString('fr-FR')}`);

  try {
    await updateStatus('BUSY', `Pensée #${thinkCount}`);

    await runPatternAnalysis();  // toutes les 20 min
    await runStrategy6h();       // toutes les 6h
    await runDailyBrief();       // une fois par jour

    await updateStatus('ONLINE', `Veille sage — Pensée #${thinkCount}`);

  } catch (err) {
    console.error('❌ [GANDALF] Erreur :', err.message);
    await updateStatus('ERROR', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🧙  GANDALF — LE STRATÈGE — SWARM OS  v1.0               ║
╠══════════════════════════════════════════════════════════════╣
║  Analyse   : Patterns toutes les 20 min                     ║
║  Stratégie : Plan 6h toutes les 6 heures                    ║
║  Brief     : Quotidien à chaque démarrage du jour           ║
║  Conseil   : Diffusé à toute la troupe                      ║
║                                                              ║
║  "Je suis Gandalf. Et Gandalf arrive toujours à temps."     ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'L\'Istari s\'éveille');
  await logToFeed('GANDALF', 'Gandalf le Blanc prend position. Le Swarm a un stratège.');

  await sendTelegram(
    `🧙 <b>GANDALF — EN LIGNE</b>\n\n` +
    `Le Stratège Suprême prend position.\n\n` +
    `• Analyse patterns : toutes les 20 min\n` +
    `• Plan stratégique : toutes les 6h\n` +
    `• Brief quotidien  : chaque jour\n\n` +
    `<i>"Un assistant n'est jamais en retard.\nIl arrive précisément quand le Swarm en a besoin."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  // Premier brief immédiat
  lastBrief    = 0;
  lastStrategy = 0;

  await mainLoop();
  setInterval(mainLoop, THINK_INTERVAL);
  setInterval(() => updateStatus('ONLINE', `Veille sage — Pensée #${thinkCount}`), 60_000);
}

start().catch(err => {
  console.error('💀 Gandalf est tombé dans l\'abîme :', err);
  process.exit(1);
});

async function gracefulShutdown(signal) {
  console.log(`\n🧙 Gandalf reçoit ${signal} — "Fuyez, pauvres fous !"…`);
  await updateStatus('OFFLINE', 'Graceful Shutdown');
  await logToFeed('GANDALF', `Shutdown via ${signal}. "Je reviendrai."`)
  await sendTelegram(`🧙 <b>GANDALF</b> — Hors ligne (${signal})\n<i>"Je reviendrai."</i>`);
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));