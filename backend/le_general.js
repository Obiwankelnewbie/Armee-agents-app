// ═══════════════════════════════════════════════════════════════
//   🎖️  LE GÉNÉRAL — SUPERVISEUR SUPRÊME DU SWARM OS
//
//   "Il ne surveille pas. Il commande."
//
//   Responsabilités :
//     🔭  Argus           (surveillance · scraping)
//     ⚔️  Le Stratège     (growth · war room · contenu)
//     🧠  Ancalagone      (mémoire · CRM · leads)
//     💹  Le Trader       (analyse · signaux on-chain)
//     🌟  Nexo            (influenceur · réseaux sociaux)
//
//   Pouvoirs :
//     → Filtre TOUT ce qu'Argus remonte avant base de données
//     → Détecte les agents morts et les relance (PM2 + spawn)
//     → Analyse la performance globale toutes les 5 min
//     → Rapport War Room horaire (Telegram)
//     → Alertes critiques immédiates
//     → Décisions que personne d'autre ne peut prendre
//
//   Version : 2.0 — Avril 2026
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { execSync, spawn } from 'child_process';

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG CENTRALISÉE
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:            'AGENT-GENERAL-01',
  AGENT_NAME:          'Le Général',
  VERSION:             'v2.0',
  SERVER_URL:          process.env.SERVER_URL || 'http://localhost:3333',
  POLL_MS:             30_000,          // health check toutes les 30s
  REPORT_MS:           60 * 60_000,     // rapport War Room toutes les heures
  MAJOR_CYCLE_EVERY:   10,              // analyse IA tous les 10 cycles (~5 min)
  LLM_TIMEOUT_MS:      25_000,
  LLM_RETRY_COUNT:     2,
  LLM_RETRY_DELAY_MS:  2_500,
  MAX_REVIVE_ATTEMPTS: 3,               // max tentatives de relance par agent
  REVIVE_COOLDOWN_MS:  5 * 60_000,     // cooldown entre relances (5 min)
  FILTER_MIN_SCORE:    0.30,           // seuil minimum — en dessous = REJECT
  FILTER_WARN_SCORE:   0.50,           // entre 0.30 et 0.50 = LOW priority
  FILTER_HIGH_SCORE:   0.70,           // au-dessus = HIGH / route vers Trader si CRYPTO
  BRIEFINGS_BATCH:     20,             // nombre de briefings Argus traités par cycle
};

// ═══════════════════════════════════════════════════════════════
// 🔌  CLIENTS
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ═══════════════════════════════════════════════════════════════
// 🪖  REGISTRE DES AGENTS
// ═══════════════════════════════════════════════════════════════

const SWARM_AGENTS = [
  {
    id:         'AGENT-ARGUS-01',
    name:       'Argus',
    script:     'argus.js',
    pm2_name:   'argus',
    role:       'SURVEILLANCE',
    critical:   true,
    timeout_ms: 6 * 60_000,   // mort si pas de ping depuis 6 min
  },
  {
    id:         'AGENT-STRATEGE-01',
    name:       'Le Stratège',
    script:     'le_stratege.js',
    pm2_name:   'le_stratege',
    role:       'STRATEGY',
    critical:   true,
    timeout_ms: 5 * 60_000,
  },
  {
    id:         'AGENT-ANCALAGONE-01',
    name:       'Ancalagone',
    script:     'ancalagone.js',
    pm2_name:   'ancalagone',
    role:       'MEMORY',
    critical:   true,
    timeout_ms: 8 * 60_000,
  },
  {
    id:         'AGENT-TRADER-01',
    name:       'Le Trader',
    script:     'le_trader.js',
    pm2_name:   'le_trader',
    role:       'TRADING',
    critical:   false,         // privé, non critique pour le swarm public
    timeout_ms: 5 * 60_000,
  },
  {
    id:         'AGENT-NEXO-01',
    name:       'Nexo',
    script:     'nexo.js',
    pm2_name:   'nexo',
    role:       'INFLUENCE',
    critical:   false,
    timeout_ms: 15 * 60_000,
  },
];

// Routing post-filtre par domaine et score
const DOMAIN_ROUTING = {
  CRYPTO: { target: 'AGENT-TRADER-01',    label: 'Le Trader'   },
  TREND:  { target: 'AGENT-STRATEGE-01',  label: 'Le Stratège' },
  MUSIC:  { target: 'AGENT-STRATEGE-01',  label: 'Le Stratège' },
  SHOP:   { target: 'AGENT-STRATEGE-01',  label: 'Le Stratège' },
  NEWS:   { target: 'AGENT-ANCALAGONE-01',label: 'Ancalagone'  },
};

// ═══════════════════════════════════════════════════════════════
// 🔧  UTILITAIRES
// ═══════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function safeJsonParse(raw) {
  try {
    const str = String(raw ?? '')
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const s = str.indexOf('{');
    const e = str.lastIndexOf('}');
    if (s === -1 || e === -1) return null;
    return JSON.parse(str.slice(s, e + 1));
  } catch {
    return null;
  }
}

function extractScore(parsed) {
  return (
    parsed?.impact_score      ??
    parsed?.viral_score       ??
    parsed?.hype_score        ??
    parsed?.opportunity_score ??
    0
  );
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message:    `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id:     `GENERAL-${Date.now()}`,
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
        agents_count:    SWARM_AGENTS.length,
        filter_min:      CONFIG.FILTER_MIN_SCORE,
        filter_high:     CONFIG.FILTER_HIGH_SCORE,
      },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 📱  TELEGRAM
// ═══════════════════════════════════════════════════════════════

const telegramQueue = [];
let telegramBusy    = false;

async function flushTelegramQueue() {
  if (telegramBusy || telegramQueue.length === 0) return;
  telegramBusy = true;

  while (telegramQueue.length > 0) {
    const msg    = telegramQueue.shift();
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && chatId) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id:    chatId,
            text:       msg,
            parse_mode: 'HTML',
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          // Anti-flood : si Telegram rate-limite, on remet en queue
          if (err.error_code === 429) {
            const wait = (err.parameters?.retry_after ?? 5) * 1000;
            telegramQueue.unshift(msg);
            await sleep(wait);
            break;
          }
        }
      } catch (e) {
        console.error('   ❌ Telegram :', e.message);
      }
    }

    await sleep(400); // 400ms entre messages — respect rate limit Telegram
  }

  telegramBusy = false;
}

function sendTelegram(message) {
  telegramQueue.push(message);
  flushTelegramQueue().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
// 🧠  APPEL LLM — avec retry + timeout
// ═══════════════════════════════════════════════════════════════

async function callLLM(prompt, userMessage) {
  for (let attempt = 1; attempt <= CONFIG.LLM_RETRY_COUNT; attempt++) {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), CONFIG.LLM_TIMEOUT_MS);

    try {
      const res = await fetch(`${CONFIG.SERVER_URL}/api/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id:     CONFIG.AGENT_ID,
          prompt,
          user_message: userMessage,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        console.warn(`   ⚠️  LLM HTTP ${res.status} — tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT}`);
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
        continue;
      }

      const data   = await res.json();
      const parsed = safeJsonParse(data.text ?? data.response ?? '');

      if (!parsed) {
        console.warn(`   ⚠️  JSON non parsable — tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT}`);
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
        continue;
      }

      return parsed;

    } catch (err) {
      clearTimeout(timer);
      const reason = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn(`   ⚠️  LLM — ${reason} (tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT})`);
      if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// 🛡️  FILTRE — Cœur du Général
//     Traite les briefings d'Argus avant stockage
// ═══════════════════════════════════════════════════════════════

const FILTER_PROMPT = `Tu es Le Général, superviseur suprême d'un swarm IA.
Tu reçois un signal brut détecté par Argus (ton agent de surveillance).
Tu dois décider si ce signal mérite d'être traité et par qui.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "action":          "ROUTE | STORE | REJECT",
  "target":          "AGENT-TRADER-01 | AGENT-STRATEGE-01 | AGENT-ANCALAGONE-01 | null",
  "priority":        "URGENT | HIGH | NORMAL | LOW",
  "quality_score":   0.0,
  "target_label":    "PRIVATE | PUBLIC",
  "reason":          "Explication de ta décision en 1 phrase",
  "rupture":         false,
  "rupture_reason":  "null ou explication si rupture",
  "enriched_brief":  "Briefing enrichi ou reformulé en 15 mots max"
}

RÈGLES DE DÉCISION :
- REJECT si : doublons évidents, opinion sans substance, rumeur non sourcée, hors-sujet
- ROUTE vers Le Trader si : signal crypto avec impact_score ≥ 0.55
- ROUTE vers Le Stratège si : trend viral, contenu, musique, shop — content_potential HIGH ou MEDIUM
- STORE dans Ancalagone si : news macro, contexte utile, signal faible mais pertinent
- REJECT + rupture=true si : score < 0.30 ou information insignifiante
- "PUBLIC" : tout ce qui peut nourrir Nexo ou Le Stratège
- "PRIVATE" : crypto, trading, données sensibles`;

let filteredTotal = 0;
let filteredPass  = 0;
let filteredReject = 0;

async function filterBriefing(briefing) {
  const payload = safeJsonParse(briefing.content);
  if (!payload) {
    await markBriefingProcessed(briefing.id, 'REJECT', 'Payload illisible');
    filteredReject++;
    return;
  }

  const score = extractScore(payload);

  // Rejet rapide sans appel LLM (économie de tokens)
  if (score < CONFIG.FILTER_MIN_SCORE) {
    console.log(`   ⚫ [FILTRE] Score ${score.toFixed(2)} < ${CONFIG.FILTER_MIN_SCORE} — rejet direct`);
    await markBriefingProcessed(briefing.id, 'REJECT', `Score trop bas : ${score.toFixed(2)}`);
    filteredReject++;
    filteredTotal++;
    return;
  }

  // Appel LLM pour décision qualitative
  const decision = await callLLM(
    FILTER_PROMPT,
    JSON.stringify({ signal: payload, source_domain: briefing.domain })
  );

  filteredTotal++;

  if (!decision) {
    // En cas d'échec LLM → route par défaut selon domaine
    const defaultRoute = DOMAIN_ROUTING[briefing.domain ?? 'NEWS'];
    await routeToAgent(briefing, payload, defaultRoute?.target, 'NORMAL', 'LLM indisponible — route par défaut');
    filteredPass++;
    return;
  }

  if (decision.action === 'REJECT') {
    const icon = decision.rupture ? '💥' : '⚫';
    console.log(`   ${icon} [FILTRE] REJET — ${decision.reason}`);
    if (decision.rupture) {
      console.log(`      RUPTURE : ${decision.rupture_reason}`);
    }
    await markBriefingProcessed(briefing.id, 'REJECT', decision.reason);
    filteredReject++;
    return;
  }

  // ROUTE ou STORE
  const target = decision.target ?? DOMAIN_ROUTING[briefing.domain ?? 'NEWS']?.target;
  await routeToAgent(briefing, payload, target, decision.priority, decision.reason, decision);
  filteredPass++;
}

async function routeToAgent(briefing, payload, targetAgent, priority, reason, decision = null) {
  if (!targetAgent) {
    await markBriefingProcessed(briefing.id, 'REJECT', 'Pas de target défini');
    return;
  }

  const enrichedPayload = JSON.stringify({
    ...payload,
    general_decision: decision,
    general_reason:   reason,
    routed_at:        new Date().toISOString(),
    original_source:  briefing.source_agent,
  });

  const { error } = await supabase.from('agent_briefings').insert([{
    source_agent: CONFIG.AGENT_ID,
    target_agent: targetAgent,
    content:      enrichedPayload,
    domain:       briefing.domain ?? payload.domain,
    priority:     priority ?? 'NORMAL',
    processed:    false,
    created_at:   new Date().toISOString(),
  }]);

  if (error) {
    console.error(`   ❌ Route vers ${targetAgent} échouée : ${error.message}`);
    return;
  }

  const icon = priority === 'URGENT' ? '🔴' : priority === 'HIGH' ? '🟠' : '🟡';
  const agent = SWARM_AGENTS.find(a => a.id === targetAgent);
  console.log(`   ${icon} [FILTRE] → ${agent?.name ?? targetAgent} (${priority}) — ${reason}`);

  await markBriefingProcessed(briefing.id, 'ROUTED', reason);
  await logToFeed('GENERAL', `[${briefing.domain}] → ${agent?.name ?? targetAgent} (${priority})`);
}

async function markBriefingProcessed(id, status, reason) {
  try {
    await supabase.from('agent_briefings')
      .update({
        processed:    true,
        processed_at: new Date().toISOString(),
        process_note: reason,
        process_status: status,
      })
      .eq('id', id);
  } catch { /* non-fatal */ }
}

async function processPendingBriefings() {
  try {
    const { data: briefings } = await supabase
      .from('agent_briefings')
      .select('*')
      .eq('target_agent', CONFIG.AGENT_ID)
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(CONFIG.BRIEFINGS_BATCH);

    if (!briefings?.length) return;

    console.log(`\n🛡️  [GÉNÉRAL] ${briefings.length} briefing(s) à filtrer…`);

    for (const briefing of briefings) {
      await filterBriefing(briefing);
      await sleep(300); // légère pause entre chaque filtrage
    }

    console.log(`   ✅ Filtrage : ${filteredPass} routés / ${filteredReject} rejetés (session: ${filteredTotal} total)`);

  } catch (err) {
    console.error('❌ processPendingBriefings :', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🏥  HEALTH CHECK
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
      report.push({ ...agent, health: 'NEVER_SEEN', lastPing: null, elapsed: null });
      if (agent.critical) deadList.push({ ...agent, health: 'NEVER_SEEN' });
      continue;
    }

    const lastPing = new Date(status.last_ping).getTime();
    const elapsed  = now - lastPing;
    const isDead   = elapsed > agent.timeout_ms;
    const isError  = status.status === 'ERROR';
    const health   = isDead ? 'DEAD' : isError ? 'ERROR' : 'ALIVE';

    report.push({
      ...agent,
      health,
      lastPing:    status.last_ping,
      currentTask: status.current_task,
      elapsed,
      memoryMb:    status.memory_mb,
    });

    if (isDead || isError) deadList.push({ ...agent, health });
  }

  return { report, deadList };
}

// ═══════════════════════════════════════════════════════════════
// 🔄  RELANCE D'UN AGENT
// ═══════════════════════════════════════════════════════════════

const reviveState = {}; // { agentId: { count, lastAttempt } }

async function reviveAgent(agent) {
  const state = reviveState[agent.id] ?? { count: 0, lastAttempt: 0 };
  const now   = Date.now();

  // Cooldown : ne pas spam les relances
  if (now - state.lastAttempt < CONFIG.REVIVE_COOLDOWN_MS && state.count > 0) {
    console.log(`   ⏳ [GÉNÉRAL] ${agent.name} — cooldown actif, prochain essai dans ${Math.round((CONFIG.REVIVE_COOLDOWN_MS - (now - state.lastAttempt)) / 1000)}s`);
    return;
  }

  state.count++;
  state.lastAttempt = now;
  reviveState[agent.id] = state;

  if (state.count > CONFIG.MAX_REVIVE_ATTEMPTS) {
    console.error(`💀 [GÉNÉRAL] ${agent.name} — ${CONFIG.MAX_REVIVE_ATTEMPTS} tentatives épuisées. Intervention manuelle requise.`);
    sendTelegram(
      `💀 <b>GÉNÉRAL — AGENT PERDU</b>\n\n` +
      `<b>${agent.name}</b> ne répond plus.\n` +
      `${CONFIG.MAX_REVIVE_ATTEMPTS} relances échouées.\n\n` +
      `⚠️ <b>Intervention manuelle requise.</b>`
    );
    return;
  }

  console.log(`🔄 [GÉNÉRAL] Relance ${agent.name} — tentative ${state.count}/${CONFIG.MAX_REVIVE_ATTEMPTS}…`);

  let success = false;

  // Tentative PM2
  try {
    execSync(`pm2 restart ${agent.pm2_name}`, { stdio: 'ignore', timeout: 10_000 });
    console.log(`   ✅ PM2 restart OK : ${agent.name}`);
    success = true;
  } catch {
    // Fallback spawn direct
    try {
      const child = spawn('node', [agent.script], {
        detached: true,
        stdio:    'ignore',
        cwd:      process.cwd(),
      });
      child.unref();
      console.log(`   ✅ Spawn direct OK : ${agent.name} (PID ${child.pid})`);
      success = true;
    } catch (err) {
      console.error(`   ❌ Impossible de relancer ${agent.name} : ${err.message}`);
    }
  }

  if (success) {
    await logToFeed('GENERAL', `Relance ${agent.name} (tentative ${state.count}/${CONFIG.MAX_REVIVE_ATTEMPTS})`);
    sendTelegram(
      `🔄 <b>GÉNÉRAL — RELANCE</b>\n\n` +
      `<b>${agent.name}</b> était ${agent.health}.\n` +
      `Tentative ${state.count}/${CONFIG.MAX_REVIVE_ATTEMPTS} lancée.`
    );
  }
}

function resetReviveCounter(agentId) {
  if (reviveState[agentId]?.count > 0) {
    console.log(`   💚 ${agentId} est de retour — compteur reset`);
    reviveState[agentId] = { count: 0, lastAttempt: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// 📊  COLLECTE DES KPIs
// ═══════════════════════════════════════════════════════════════

async function collectKpis() {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [
      leadsRes,
      tradesRes,
      contentsRes,
      briefingsRes,
      alertsRes,
    ] = await Promise.allSettled([
      supabase.from('leads').select('status').gte('created_at', since24h),
      supabase.from('executor_audit_log').select('status').gte('created_at', since24h),
      supabase.from('generated_contents').select('format, domain, status').gte('created_at', since24h),
      supabase.from('agent_briefings').select('process_status, domain').gte('created_at', since24h).eq('source_agent', CONFIG.AGENT_ID),
      supabase.from('argus_alerts').select('domain, score').gte('created_at', since24h),
    ]);

    const leads     = leadsRes.status    === 'fulfilled' ? leadsRes.value.data    ?? [] : [];
    const trades    = tradesRes.status   === 'fulfilled' ? tradesRes.value.data   ?? [] : [];
    const contents  = contentsRes.status === 'fulfilled' ? contentsRes.value.data ?? [] : [];
    const briefings = briefingsRes.status === 'fulfilled' ? briefingsRes.value.data ?? [] : [];
    const alerts    = alertsRes.status   === 'fulfilled' ? alertsRes.value.data   ?? [] : [];

    const leadsStats   = leads.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] || 0) + 1 }), {});
    const tradesOk     = trades.filter(t => t.status === 'SUCCESS').length;
    const tradesFail   = trades.filter(t => t.status === 'FAILURE').length;
    const routed       = briefings.filter(b => b.process_status === 'ROUTED').length;
    const rejected     = briefings.filter(b => b.process_status === 'REJECT').length;
    const filterRate   = briefings.length > 0 ? `${Math.round(routed / briefings.length * 100)}%` : 'N/A';

    return {
      window:          '24h',
      leads_total:     leads.length,
      leads_by_status: leadsStats,
      trades_ok:       tradesOk,
      trades_fail:     tradesFail,
      trade_rate:      tradesOk + tradesFail > 0 ? `${Math.round(tradesOk / (tradesOk + tradesFail) * 100)}%` : 'N/A',
      contents_total:  contents.length,
      briefings_routed: routed,
      briefings_rejected: rejected,
      filter_pass_rate: filterRate,
      urgent_alerts:   alerts.filter(a => a.score >= CONFIG.FILTER_HIGH_SCORE).length,
    };

  } catch (err) {
    console.error('❌ collectKpis :', err.message);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════
// 🧠  ANALYSE STRATÉGIQUE
// ═══════════════════════════════════════════════════════════════

const GENERAL_PROMPT = `Tu es Le Général, commandant suprême d'un swarm IA multi-agents.
Tu reçois l'état complet du swarm et les KPIs des dernières 24h.
Génère une directive stratégique précise.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "etat_global":           "OPTIMAL | STABLE | DEGRADED | CRITICAL",
  "diagnostic":            "Analyse en 2 phrases maximum",
  "point_faible_critique": "Le maillon le plus faible actuellement",
  "directive_supreme":     "L'action prioritaire à prendre MAINTENANT — concrète et actionnable",
  "agents_a_prioriser":    ["agent_id"],
  "kpi_alert":             "Alerte si un KPI est anormal — sinon null",
  "message_war_room":      "Message court, percutant, pour le rapport Telegram (1 phrase)"
}`;

async function runStrategicAnalysis(healthReport, kpis) {
  try {
    const payload = {
      timestamp:       new Date().toISOString(),
      uptime:          formatUptime(Math.floor(process.uptime())),
      agents:          healthReport.map(a => ({
        name:    a.name,
        role:    a.role,
        health:  a.health,
        memory:  a.memoryMb ? `${a.memoryMb}MB` : 'N/A',
      })),
      dead_count:      healthReport.filter(a => a.health !== 'ALIVE').length,
      filter_session:  { total: filteredTotal, pass: filteredPass, reject: filteredReject },
      kpis,
    };

    const directive = await callLLM(GENERAL_PROMPT, JSON.stringify(payload));
    if (!directive) return null;

    // Persistance en base
    await supabase.from('general_directives').insert([{
      agent_id:         CONFIG.AGENT_ID,
      etat_global:      directive.etat_global,
      diagnostic:       directive.diagnostic,
      directive:        directive.directive_supreme,
      point_faible:     directive.point_faible_critique,
      agents_priorites: directive.agents_a_prioriser,
      kpi_alert:        directive.kpi_alert,
      full_payload:     directive,
      created_at:       new Date().toISOString(),
    }]).catch(() => {}); // table optionnelle au départ

    await logToFeed('GENERAL', `[${directive.etat_global}] ${directive.directive_supreme}`);

    return directive;

  } catch (err) {
    console.error('❌ runStrategicAnalysis :', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 📨  RAPPORT WAR ROOM (Telegram horaire)
// ═══════════════════════════════════════════════════════════════

let lastReportAt = 0;

async function sendWarRoomReport(healthReport, kpis, directive) {
  if (Date.now() - lastReportAt < CONFIG.REPORT_MS) return;
  lastReportAt = Date.now();

  const alive  = healthReport.filter(a => a.health === 'ALIVE').length;
  const dead   = healthReport.filter(a => a.health !== 'ALIVE').length;
  const emoji  = dead === 0 ? '🟢' : dead <= 1 ? '🟡' : '🔴';

  const agentLines = healthReport.map(a => {
    const icon  = a.health === 'ALIVE' ? '✅' : a.health === 'ERROR' ? '⚠️' : '💀';
    const extra = a.health !== 'ALIVE' ? ` — <b>${a.health}</b>` : '';
    return `  ${icon} ${a.name}${extra}`;
  }).join('\n');

  const filterLine = kpis.briefings_routed !== undefined
    ? `  • Filtrage : ${kpis.briefings_routed} routés / ${kpis.briefings_rejected} rejetés (${kpis.filter_pass_rate})`
    : '';

  const msg =
    `🎖️ <b>LE GÉNÉRAL — RAPPORT WAR ROOM</b>\n` +
    `<i>${new Date().toLocaleString('fr-FR')}</i>\n\n` +
    `${emoji} <b>${alive}/${SWARM_AGENTS.length} agents actifs</b>\n\n` +
    `<b>🪖 Troupe :</b>\n${agentLines}\n\n` +
    `<b>📊 KPIs (24h) :</b>\n` +
    `  • Leads : ${kpis.leads_total ?? 0} total | WON: ${kpis.leads_by_status?.WON ?? 0}\n` +
    `  • Trades : ${kpis.trades_ok ?? 0} ✅ / ${kpis.trades_fail ?? 0} ❌ (${kpis.trade_rate ?? 'N/A'})\n` +
    `  • Contenus : ${kpis.contents_total ?? 0}\n` +
    `  • Alertes URGENT : ${kpis.urgent_alerts ?? 0}\n` +
    `${filterLine}\n\n` +
    (directive
      ? `<b>⚔️ Directive :</b>\n<i>${directive.directive_supreme}</i>\n\n` +
        (directive.kpi_alert ? `⚠️ <b>KPI Alert :</b> ${directive.kpi_alert}\n\n` : '') +
        `<i>"${directive.message_war_room}"</i>`
      : `<i>Le Swarm tient le cap.</i>`);

  sendTelegram(msg);
  console.log('\n📱 Rapport War Room envoyé');
}

// ═══════════════════════════════════════════════════════════════
// 🔁  BOUCLE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

let cycleCount = 0;

async function mainLoop() {
  cycleCount++;
  const isMajorCycle = cycleCount % CONFIG.MAJOR_CYCLE_EVERY === 0;

  try {
    await updateStatus('BUSY', `Cycle #${cycleCount}`);

    // 1. Filtrage des briefings Argus entrants
    await processPendingBriefings();

    // 2. Health check
    const { report, deadList } = await checkSwarmHealth();

    // 3. Relance des agents morts critiques
    for (const dead of deadList) {
      if (dead.critical) {
        await reviveAgent(dead);
        await sleep(2000);
      } else {
        console.warn(`⚠️  [GÉNÉRAL] ${dead.name} est ${dead.health} (non-critique)`);
      }
    }

    // Reset compteurs des agents revenus à la vie
    report.filter(a => a.health === 'ALIVE').forEach(a => resetReviveCounter(a.id));

    // 4. Cycles majeurs : analyse stratégique + rapport
    if (isMajorCycle) {
      console.log(`\n🧠 [GÉNÉRAL] Cycle majeur #${cycleCount} — Analyse stratégique…`);

      const kpis      = await collectKpis();
      const directive = await runStrategicAnalysis(report, kpis);

      if (directive) {
        console.log(`\n⚔️  Directive : ${directive.directive_supreme}`);
        console.log(`   État : ${directive.etat_global} — ${directive.diagnostic}`);

        if (['CRITICAL', 'DEGRADED'].includes(directive.etat_global)) {
          sendTelegram(
            `🎖️ <b>GÉNÉRAL — ALERTE STRATÉGIQUE</b>\n\n` +
            `État : <b>${directive.etat_global}</b>\n\n` +
            `${directive.diagnostic}\n\n` +
            `⚔️ <b>Directive :</b> ${directive.directive_supreme}\n` +
            (directive.kpi_alert ? `\n⚠️ ${directive.kpi_alert}` : '')
          );
        }
      }

      await sendWarRoomReport(report, kpis, directive);
    }

    // 5. Console status
    const alive = report.filter(a => a.health === 'ALIVE').length;
    const icon  = deadList.length === 0 ? '🟢' : deadList.length <= 1 ? '🟡' : '🔴';
    console.log(
      `${icon} [GÉNÉRAL] ${alive}/${SWARM_AGENTS.length} agents | ` +
      `Filtre: ${filteredPass}↑ ${filteredReject}↓ | ` +
      `Cycle #${cycleCount} | ` +
      `Uptime: ${formatUptime(Math.floor(process.uptime()))}`
    );

    await updateStatus('ONLINE', `Veille — ${alive}/${SWARM_AGENTS.length} agents | Cycle #${cycleCount}`);

  } catch (err) {
    console.error('❌ [GÉNÉRAL] Erreur boucle :', err.message);
    await updateStatus('ERROR', err.message.slice(0, 200));
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀  DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  const totalFeeds = SWARM_AGENTS.length;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🎖️  LE GÉNÉRAL — SUPERVISEUR SUPRÊME — SWARM OS ${CONFIG.VERSION.padEnd(8)}║
╠══════════════════════════════════════════════════════════════╣
║  Agents    : ${String(totalFeeds).padEnd(2)} sous commandement                       ║
║  Filtre    : Score ≥ ${String(CONFIG.FILTER_MIN_SCORE).padEnd(38)}║
║  Health    : toutes les ${String(CONFIG.POLL_MS / 1000).padEnd(36)}s ║
║  Analyse   : tous les ${CONFIG.MAJOR_CYCLE_EVERY} cycles (~${CONFIG.MAJOR_CYCLE_EVERY * CONFIG.POLL_MS / 60000} min)           ║
║  Rapport   : toutes les heures (Telegram)                   ║
║  Relance   : auto — max ${CONFIG.MAX_REVIVE_ATTEMPTS} tentatives, cooldown ${CONFIG.REVIVE_COOLDOWN_MS/60000} min    ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Prise de commandement');
  await logToFeed('GENERAL', 'Le Général prend le commandement. Swarm sous contrôle.');

  sendTelegram(
    `🎖️ <b>LE GÉNÉRAL — EN LIGNE</b>\n\n` +
    `${SWARM_AGENTS.length} agents sous commandement.\n` +
    `Filtrage actif — seuil ${CONFIG.FILTER_MIN_SCORE}.\n\n` +
    `<i>"Rien ne passe sans mon accord."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  // Premier cycle immédiat
  await mainLoop();
  setInterval(mainLoop, CONFIG.POLL_MS);

  // Heartbeat
  setInterval(() => updateStatus('ONLINE', `Veille — Cycle #${cycleCount}`), 60_000);
}

// ═══════════════════════════════════════════════════════════════
// 🛑  ARRÊT PROPRE & ERREURS GLOBALES
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n🎖️  Le Général reçoit ${signal} — transfert de commandement…`);
  await updateStatus('OFFLINE', `Shutdown — ${signal}`);
  await logToFeed('GENERAL', `Shutdown propre via ${signal}`);
  sendTelegram(
    `🎖️ <b>LE GÉNÉRAL — HORS LIGNE</b>\n\n` +
    `Signal : ${signal}\n` +
    `Uptime : ${formatUptime(Math.floor(process.uptime()))}\n` +
    `Signaux filtrés : ${filteredTotal} (${filteredPass} routés / ${filteredReject} rejetés)\n\n` +
    `<i>Le Swarm continue sans supervision suprême.</i>`
  );
  await sleep(1000); // laisse Telegram envoyer
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('GENERAL_ERROR', `Exception : ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('GENERAL_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

start().catch(async (err) => {
  console.error('💀 Erreur fatale Le Général :', err);
  await logToFeed('GENERAL_ERROR', `Erreur fatale : ${err.message}`);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// 📋  MIGRATION SQL SUPABASE REQUISE
// ═══════════════════════════════════════════════════════════════
//
// -- Champs supplémentaires sur agent_briefings
// ALTER TABLE agent_briefings
//   ADD COLUMN IF NOT EXISTS domain          TEXT,
//   ADD COLUMN IF NOT EXISTS processed_at    TIMESTAMPTZ,
//   ADD COLUMN IF NOT EXISTS process_note    TEXT,
//   ADD COLUMN IF NOT EXISTS process_status  TEXT;  -- ROUTED | REJECT
//
// CREATE INDEX IF NOT EXISTS idx_briefings_target_processed
//   ON agent_briefings (target_agent, processed, created_at);
//
// -- Table des directives stratégiques
// CREATE TABLE IF NOT EXISTS general_directives (
//   id               BIGSERIAL PRIMARY KEY,
//   agent_id         TEXT,
//   etat_global      TEXT,
//   diagnostic       TEXT,
//   directive        TEXT,
//   point_faible     TEXT,
//   agents_priorites JSONB,
//   kpi_alert        TEXT,
//   full_payload     JSONB,
//   created_at       TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON general_directives (created_at DESC);
//
// ═══════════════════════════════════════════════════════════════