// ═══════════════════════════════════════════════════════════════
//   🌑  MORGOTH — SUPERVISEUR SUPRÊME DU SWARM OS
//
//   "Sauron n'est que sa Main. Morgoth est la volonté derrière."
//
//   Il supervise et coordonne :
//     👁️  Œil de Sauron        (surveillance)
//     🖐️  Main de Sauron        (stratégie / growth)
//     ✍️  Agent Contenu         (production)
//     🛡️  Sentinelle            (filtrage crypto)
//     💹  Trader + Executor     (trading on-chain)
//     📋  Supervisor v3.0       (CRM / leads)
//
//   Ses pouvoirs :
//     → Détecte les agents morts et les relance
//     → Rééquilibre les priorités selon l'état du Swarm
//     → Analyse la performance globale (GMV, leads, trades, contenu)
//     → Envoie le rapport War Room toutes les heures
//     → Prend les décisions que personne d'autre ne peut prendre
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { execSync, spawn } = require('child_process');

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3333';
const AGENT_ID   = 'MORGOTH-SUPREME-01';
const POLL_MS    = 30_000;       // vérifie l'état du Swarm toutes les 30s
const REPORT_MS  = 60 * 60_000; // rapport War Room toutes les heures

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 📋 REGISTRE DES AGENTS — La troupe de Morgoth
// ═══════════════════════════════════════════════════════════════

const SWARM_AGENTS = [
  {
    id:       'AGENT-SAURON-01',
    name:     "Œil de Sauron",
    script:   'agent_sauron.js',
    role:     'SURVEILLANCE',
    critical: true,   // si mort → relance immédiate
    timeout_ms: 5 * 60_000, // considéré mort si pas de ping depuis 5 min
  },
  {
    id:       'AGENT-MAIN-SAURON-01',
    name:     "Main de Sauron",
    script:   'agent_main_sauron.js',
    role:     'STRATEGY',
    critical: true,
    timeout_ms: 3 * 60_000,
  },
  {
    id:       'AGENT-CONTENU-SAURON-01',
    name:     "Agent Contenu",
    script:   'agent_contenu_sauron.js',
    role:     'CONTENT',
    critical: false,
    timeout_ms: 10 * 60_000,
  },
  {
    id:       'AGENT-SENTINELLE-02',
    name:     "Sentinelle",
    script:   'agent_sentinelle_v2.js',
    role:     'FILTER',
    critical: true,
    timeout_ms: 3 * 60_000,
  },
  {
    id:       'AGENT-TRADER-01',
    name:     "Trader",
    script:   'agent_trader.js',
    role:     'TRADING',
    critical: true,
    timeout_ms: 3 * 60_000,
  },
  {
    id:       'AGENT-EXECUTOR-BASE-01',
    name:     "Executor Base",
    script:   'agent_executor.js',
    role:     'EXECUTION',
    critical: true,
    timeout_ms: 3 * 60_000,
  },
  {
    id:       'AGENT-MEDIA-01',
    name:     "Agent Media RSS",
    script:   'agent_media.js',
    role:     'MEDIA',
    critical: false,
    timeout_ms: 10 * 60_000,
  },
  {
    id:       'SUPERVISOR-v3.0',
    name:     "Supervisor CRM",
    script:   'agent_superviseur.js',
    role:     'CRM',
    critical: false,
    timeout_ms: 8 * 60_000,
  },
];

// ═══════════════════════════════════════════════════════════════
// 📡 TELEGRAM WAR ROOM
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
  } catch (err) {
    console.error('   ❌ Telegram :', err.message);
  }
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
      run_id:  `MORGOTH-${Date.now()}`,
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:       AGENT_ID,
      agent_name:     'Morgoth — Superviseur Suprême',
      status,
      last_ping:      new Date().toISOString(),
      current_task:   task,
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      version:        'v1.0 SUPREME',
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 🏥 HEALTH CHECK — Morgoth surveille ses soldats
// ═══════════════════════════════════════════════════════════════

async function checkSwarmHealth() {
  const { data: statuses } = await supabase
    .from('agent_status')
    .select('*')
    .in('agent_id', SWARM_AGENTS.map(a => a.id));

  const now      = Date.now();
  const report   = [];
  const deadList = [];

  for (const agent of SWARM_AGENTS) {
    const status = statuses?.find(s => s.agent_id === agent.id);

    if (!status) {
      // Agent jamais vu → mort
      report.push({ ...agent, health: 'NEVER_SEEN', lastPing: null });
      deadList.push(agent);
      continue;
    }

    const lastPing  = new Date(status.last_ping).getTime();
    const elapsed   = now - lastPing;
    const isDead    = elapsed > agent.timeout_ms;
    const isError   = status.status === 'ERROR';

    const health = isDead ? 'DEAD' : isError ? 'ERROR' : 'ALIVE';
    report.push({ ...agent, health, lastPing: status.last_ping, currentTask: status.current_task, elapsed });

    if (isDead || isError) deadList.push({ ...agent, health });
  }

  return { report, deadList };
}

// ═══════════════════════════════════════════════════════════════
// 🔄 RELANCE D'UN AGENT MORT (via PM2 si disponible, sinon spawn)
// ═══════════════════════════════════════════════════════════════

const restartAttempts = {}; // anti-boucle infinie

async function reviveAgent(agent) {
  const key = agent.id;
  restartAttempts[key] = (restartAttempts[key] || 0) + 1;

  // Max 3 tentatives avant d'alerter et d'abandonner
  if (restartAttempts[key] > 3) {
    console.error(`💀 [MORGOTH] ${agent.name} ne répond plus après 3 tentatives — ALERTE`);
    await sendTelegram(
      `💀 <b>MORGOTH — AGENT PERDU</b>\n\n` +
      `<b>${agent.name}</b> (${agent.id}) ne répond plus.\n` +
      `3 tentatives de relance échouées.\n` +
      `⚠️ Intervention manuelle requise.`
    );
    return;
  }

  console.log(`🔄 [MORGOTH] Relance de ${agent.name} (tentative ${restartAttempts[key]}/3)…`);

  try {
    // Tente PM2 en priorité
    execSync(`pm2 restart ${agent.script.replace('.js', '')}`, { stdio: 'ignore' });
    console.log(`   ✅ PM2 restart OK : ${agent.name}`);
  } catch {
    // Fallback : spawn direct
    try {
      const child = spawn('node', [agent.script], {
        detached: true,
        stdio:    'ignore',
        cwd:      process.cwd(),
      });
      child.unref();
      console.log(`   ✅ Spawn direct OK : ${agent.name} (PID ${child.pid})`);
    } catch (err) {
      console.error(`   ❌ Impossible de relancer ${agent.name} :`, err.message);
    }
  }

  await logToFeed('MORGOTH', `Relance de ${agent.name} (tentative ${restartAttempts[key]})`);
  await sendTelegram(
    `🔄 <b>MORGOTH — RELANCE</b>\n\n` +
    `<b>${agent.name}</b> était mort.\n` +
    `Tentative de relance ${restartAttempts[key]}/3 en cours…`
  );
}

// Reset les compteurs quand un agent revit
function resetReviveCounter(agentId) {
  if (restartAttempts[agentId] > 0) {
    console.log(`   💚 ${agentId} est de retour — compteur reset`);
    restartAttempts[agentId] = 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🧠 ANALYSE STRATÉGIQUE — Morgoth réfléchit
// ═══════════════════════════════════════════════════════════════

const MORGOTH_PROMPT = `Tu es MORGOTH, le Superviseur Suprême du Swarm OS.
Tu reçois l'état complet du Swarm et les KPIs business.
Analyse et génère une directive suprême.
Réponds UNIQUEMENT en JSON :
{
  "etat_global": "OPTIMAL | STABLE | DEGRADED | CRITICAL",
  "diagnostic": "Analyse en 2-3 phrases de l'état du Swarm",
  "point_faible_critique": "Le maillon le plus faible actuellement",
  "directive_supreme": "L'action la plus importante à prendre MAINTENANT",
  "agents_a_prioriser": ["agent_id_1", "agent_id_2"],
  "kpi_alert": "Alerte sur un KPI si nécessaire ou null",
  "message_war_room": "Message court et percutant pour la War Room Telegram"
}`;

async function runSupremeAnalysis(healthReport, kpis) {
  try {
    const payload = {
      swarm_health:    healthReport.map(a => ({ name: a.name, health: a.health, role: a.role })),
      dead_agents:     healthReport.filter(a => a.health !== 'ALIVE').length,
      kpis,
      timestamp:       new Date().toISOString(),
    };

    return await callSwarm(MORGOTH_PROMPT, JSON.stringify(payload));
  } catch (err) {
    console.error('❌ Analyse suprême échouée :', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊 COLLECTE DES KPIs
// ═══════════════════════════════════════════════════════════════

async function collectKpis() {
  try {
    const [
      { data: leads },
      { data: gmv },
      { data: trades },
      { data: contents },
      { data: decisions },
      { data: feedEvents },
    ] = await Promise.all([
      supabase.from('leads').select('status').order('created_at', { ascending: false }),
      supabase.from('gmv_tracking').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('executor_audit_log').select('status, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('generated_contents').select('format, domain, status, created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('main_decisions').select('decision, priority, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('live_feed_events').select('type, created_at').order('created_at', { ascending: false }).limit(50),
    ]);

    // Agrégation leads
    const leadsStats = (leads ?? []).reduce((acc, l) => {
      acc[l.status] = (acc[l.status] || 0) + 1;
      return acc;
    }, {});

    // Trades réussis vs échoués
    const tradesOk  = (trades ?? []).filter(t => t.status === 'SUCCESS').length;
    const tradesFail = (trades ?? []).filter(t => t.status === 'FAILURE').length;

    // Contenu par format
    const contentByFormat = (contents ?? []).reduce((acc, c) => {
      acc[c.format] = (acc[c.format] || 0) + 1;
      return acc;
    }, {});

    return {
      leads:          leadsStats,
      total_leads:    leads?.length ?? 0,
      gmv_entries:    gmv?.length ?? 0,
      trades_success: tradesOk,
      trades_fail:    tradesFail,
      trade_rate:     tradesOk + tradesFail > 0 ? `${Math.round(tradesOk / (tradesOk + tradesFail) * 100)}%` : 'N/A',
      content_total:  contents?.length ?? 0,
      content_by_format: contentByFormat,
      decisions_24h:  decisions?.length ?? 0,
      feed_activity:  feedEvents?.length ?? 0,
    };
  } catch (err) {
    console.error('❌ KPI collection failed :', err.message);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════
// 📨 RAPPORT HORAIRE WAR ROOM
// ═══════════════════════════════════════════════════════════════

let lastReport = 0;

async function sendHourlyReport(healthReport, kpis, directive) {
  if (Date.now() - lastReport < REPORT_MS) return;
  lastReport = Date.now();

  const alive = healthReport.filter(a => a.health === 'ALIVE').length;
  const dead  = healthReport.filter(a => a.health !== 'ALIVE').length;
  const emoji = dead === 0 ? '🟢' : dead <= 2 ? '🟡' : '🔴';

  const agentLines = healthReport.map(a => {
    const icon = a.health === 'ALIVE' ? '✅' : a.health === 'ERROR' ? '⚠️' : '💀';
    return `  ${icon} ${a.name}`;
  }).join('\n');

  const message =
    `🌑 <b>MORGOTH — RAPPORT WAR ROOM</b>\n` +
    `${new Date().toLocaleString('fr-FR')}\n\n` +
    `${emoji} <b>Swarm : ${alive}/${SWARM_AGENTS.length} agents actifs</b>\n\n` +
    `<b>🪖 Troupe :</b>\n${agentLines}\n\n` +
    `<b>📊 KPIs :</b>\n` +
    `  • Leads total : ${kpis.total_leads ?? 0}\n` +
    `  • WON : ${kpis.leads?.WON ?? 0} | QUALIFIED : ${kpis.leads?.QUALIFIED ?? 0}\n` +
    `  • Trades : ${kpis.trades_success ?? 0} ✅ / ${kpis.trades_fail ?? 0} ❌ (taux: ${kpis.trade_rate ?? 'N/A'})\n` +
    `  • Contenus générés : ${kpis.content_total ?? 0}\n` +
    `  • Décisions Main : ${kpis.decisions_24h ?? 0}\n\n` +
    (directive ? `<b>⚔️ Directive Suprême :</b>\n<i>${directive.directive_supreme}</i>\n\n` : '') +
    (directive?.kpi_alert ? `⚠️ <b>Alerte KPI :</b> ${directive.kpi_alert}\n\n` : '') +
    `<i>"${directive?.message_war_room ?? 'Le Swarm veille.'}"</i>`;

  await sendTelegram(message);
  console.log(`\n📱 Rapport War Room envoyé`);
}

// ═══════════════════════════════════════════════════════════════
// 🔄 BOUCLE PRINCIPALE DE MORGOTH
// ═══════════════════════════════════════════════════════════════

let cycleCount = 0;

async function mainLoop() {
  cycleCount++;
  const isMajorCycle = cycleCount % 10 === 0; // analyse IA toutes les ~5 min

  try {
    await updateStatus('BUSY', `Cycle #${cycleCount} — Health check`);

    // 1. Health check de la troupe
    const { report, deadList } = await checkSwarmHealth();

    // 2. Relance les agents morts critiques
    for (const dead of deadList) {
      if (dead.critical) {
        await reviveAgent(dead);
        await sleep(3000);
      } else {
        console.warn(`⚠️  [MORGOTH] ${dead.name} est ${dead.health} (non-critique — pas de relance auto)`);
      }
    }

    // Reset compteurs pour les agents revenus à la vie
    report.filter(a => a.health === 'ALIVE').forEach(a => resetReviveCounter(a.id));

    // 3. Collecte KPIs + Analyse IA (cycles majeurs seulement)
    let kpis = {}, directive = null;

    if (isMajorCycle) {
      console.log(`\n🧠 [MORGOTH] Cycle majeur #${cycleCount} — Analyse suprême…`);
      kpis      = await collectKpis();
      directive = await runSupremeAnalysis(report, kpis);

      if (directive) {
        console.log(`\n⚔️  Directive : ${directive.directive_supreme}`);
        console.log(`   État Swarm : ${directive.etat_global} | ${directive.diagnostic}`);

        // Sauvegarder la directive
        await supabase.from('morgoth_directives').insert([{
          agent_id:         AGENT_ID,
          etat_global:      directive.etat_global,
          diagnostic:       directive.diagnostic,
          directive:        directive.directive_supreme,
          point_faible:     directive.point_faible_critique,
          agents_priorites: directive.agents_a_prioriser,
          kpi_alert:        directive.kpi_alert,
          full_payload:     JSON.stringify(directive),
          created_at:       new Date().toISOString(),
        }]).catch(() => {}); // table optionnelle

        await logToFeed('MORGOTH', `[${directive.etat_global}] ${directive.directive_supreme}`);

        // Alerte si état dégradé
        if (directive.etat_global === 'CRITICAL' || directive.etat_global === 'DEGRADED') {
          await sendTelegram(
            `🌑 <b>MORGOTH — ALERTE SUPRÊME</b>\n\n` +
            `État : <b>${directive.etat_global}</b>\n\n` +
            `${directive.diagnostic}\n\n` +
            `⚔️ <b>Directive :</b> ${directive.directive_supreme}\n\n` +
            `⚠️ Point faible : ${directive.point_faible_critique}`
          );
        }
      }

      // Rapport horaire
      await sendHourlyReport(report, kpis, directive);
    }

    // 4. Affichage console de l'état
    const alive = report.filter(a => a.health === 'ALIVE').length;
    const icon  = deadList.length === 0 ? '🟢' : deadList.length <= 2 ? '🟡' : '🔴';
    console.log(`${icon} [MORGOTH] ${alive}/${SWARM_AGENTS.length} agents actifs | Cycle #${cycleCount}`);

    await updateStatus('ONLINE', `Veille — ${alive}/${SWARM_AGENTS.length} agents | Cycle #${cycleCount}`);

  } catch (err) {
    console.error('❌ [MORGOTH] Erreur boucle :', err.message);
    await updateStatus('ERROR', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🌑  MORGOTH — SUPERVISEUR SUPRÊME — SWARM OS  v1.0       ║
╠══════════════════════════════════════════════════════════════╣
║  Surveille : ${String(SWARM_AGENTS.length).padEnd(2)} agents                              ║
║  Health    : toutes les 30s                                 ║
║  Analyse   : toutes les ~5 min                              ║
║  Rapport   : toutes les heures (Telegram)                   ║
║  Relance   : auto (agents critiques, max 3 tentatives)      ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Éveil de Morgoth');
  await logToFeed('MORGOTH', 'Morgoth s\'éveille. Le Swarm est sous commandement suprême.');

  await sendTelegram(
    `🌑 <b>MORGOTH — ÉVEIL</b>\n\n` +
    `Le Superviseur Suprême est en ligne.\n` +
    `${SWARM_AGENTS.length} agents sous commandement.\n\n` +
    `<i>"La volonté du Swarm ne dort jamais."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  // Premier cycle immédiat
  await mainLoop();
  setInterval(mainLoop, POLL_MS);

  // Ping de vie toutes les 60s
  setInterval(() => updateStatus('ONLINE', `Veille suprême — Cycle #${cycleCount}`), 60_000);
}

start().catch(err => {
  console.error('💀 MORGOTH est tombé :', err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// ARRÊT PROPRE
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n🌑 Morgoth reçoit ${signal} — retrait dans les ombres…`);
  await updateStatus('OFFLINE', 'Graceful Shutdown');
  await logToFeed('MORGOTH', `Shutdown propre via ${signal}.`);
  await sendTelegram(`🌑 <b>MORGOTH</b> — Hors ligne (${signal})\nLe Swarm continue sans supervision suprême.`);
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));