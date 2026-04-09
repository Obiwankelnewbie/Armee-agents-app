import { createClient } from '@supabase/supabase-js';
// ═══════════════════════════════════════════════════════════════
//
//       ▄████████████████████████████████████████████▄
//       █                                            █
//       █         ⚔️   L E  S T R A T È G E         █
//       █         Growth · War Room · Contenu        █
//       █              Version  2.0                  █
//       █                                            █
//       ▀████████████████████████████████████████████▀
//
//   "Il ne commande pas. Il ne surveille pas.
//    Il transforme l'information en mouvement."
//
//   ─────────────────────────────────────────────────────────────
//
//   Le Stratège est le cerveau offensif du Swarm.
//   Là où Le Général maintient l'ordre,
//   Le Stratège crée l'avantage.
//
//   Il lit tout ce qu'Ancalagone a mémorisé.
//   Il prend les signaux que Le Général lui route.
//   Il transforme ça en contenu, en plans, en opportunités.
//   Il brief Nexo. Il alerte sur les tendances.
//   Il pense à 6h, à 24h, à 7 jours.
//
//   SES QUATRE MODES :
//
//   🔮  PATTERN WATCH (toutes les 20 min)
//       Lit la Mirror Memory d'Ancalagone + signaux entrants.
//       Détecte les patterns avant qu'ils deviennent évidents.
//       Alerte Le Général et Nexo si opportunité critique.
//
//   🗺️  WAR ROOM (toutes les 6h)
//       Plan d'action structuré pour les 6 prochaines heures.
//       Objectifs par agent. Séquence d'actions. Signaux déclencheurs.
//
//   📜  BRIEF QUOTIDIEN (1x/jour)
//       Vision stratégique complète. Domaines chauds vs morts.
//       Diffusé à toute la troupe. Posté sur le dashboard.
//
//   ✍️  CONTENT FACTORY (à la demande · sur signal entrant)
//       Reçoit un trend validé par Le Général.
//       Produit : post X, thread LinkedIn, script TikTok,
//                 paragraphe newsletter, idée blog.
//       Livre à Nexo. Prêt à poster.
//
//   ─────────────────────────────────────────────────────────────
//
//   SOURCES D'INFORMATION :
//     • Mirror Memory d'Ancalagone  (vérité profonde)
//     • Briefings filtrés de Le Général  (signaux temps réel)
//     • Directives de Le Général  (priorités du moment)
//     • agent_status  (santé du Swarm)
//
//   DESTINATAIRES :
//     • Nexo  (contenu prêt à poster)
//     • Le Général  (conseils stratégiques)
//     • Dashboard  (visible par l'utilisateur)
//     • Telegram  (alertes War Room)
//
//   Version : 2.0 — Avril 2026
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:   'AGENT-STRATEGE-01',
  AGENT_NAME: 'Le Stratège',
  VERSION:    'v2.0',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3333',

  // Intervalles
  THINK_INTERVAL_MS:    20 * 60_000,      // pattern watch toutes les 20 min
  WARROOM_INTERVAL_MS:  6  * 60 * 60_000, // war room toutes les 6h
  BRIEF_INTERVAL_MS:    24 * 60 * 60_000, // brief quotidien 1x/jour
  PING_INTERVAL_MS:     60_000,

  // Signaux entrants
  BRIEFINGS_BATCH:      15,               // signaux Général traités par cycle
  CONTENT_BATCH:        5,                // max contenus générés par cycle

  // LLM
  LLM_TIMEOUT_MS:       30_000,
  LLM_RETRY_COUNT:      2,
  LLM_RETRY_DELAY_MS:   3_000,

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
      run_id:     `STRATEGE-${Date.now()}`,
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
        think_cycles:     thinkCount,
        contents_produced: contentsProduced,
        warroom_count:    warroomCount,
      },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 📱  TELEGRAM — queue anti-flood
// ═══════════════════════════════════════════════════════════════

const telegramQueue = [];
let telegramBusy    = false;

async function flushTelegram() {
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
          body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'HTML' }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
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
    await sleep(CONFIG.TELEGRAM_COOLDOWN_MS);
  }

  telegramBusy = false;
}

function sendTelegram(message) {
  telegramQueue.push(message);
  flushTelegram().catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
// 🧠  APPEL LLM — retry + timeout
// ═══════════════════════════════════════════════════════════════

async function callLLM(prompt, userMessage, label = '') {
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
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
        continue;
      }

      const data   = await res.json();
      const parsed = safeJsonParse(data.text ?? data.response ?? '');

      if (!parsed) {
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
        continue;
      }

      return parsed;

    } catch (err) {
      clearTimeout(timer);
      const reason = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn(`   ⚠️  LLM [${label}] ${reason} — tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT}`);
      if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 📚  LECTURE DU SWARM — La principale source du Stratège
// ═══════════════════════════════════════════════════════════════

async function readSwarmContext() {
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const [
    mirrorRes,
    leadsRes,
    contentsRes,
    generalDirectivesRes,
    agentStatusRes,
    recentAlertsRes,
    scoringRes,
  ] = await Promise.allSettled([
    // 1. Mirror Memory d'Ancalagone — source de vérité principale
    supabase.from('ancalagone_mirror')
      .select('*')
      .eq('mirror_key', 'CURRENT')
      .maybeSingle(),

    // 2. Leads récents
    supabase.from('leads')
      .select('status, niche, bant_score, created_at')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(30),

    // 3. Contenus produits
    supabase.from('generated_contents')
      .select('format, domain, status, created_at')
      .gte('created_at', since24h)
      .order('created_at', { ascending: false })
      .limit(30),

    // 4. Dernières directives du Général
    supabase.from('general_directives')
      .select('etat_global, directive, point_faible, created_at')
      .order('created_at', { ascending: false })
      .limit(3),

    // 5. Santé des agents
    supabase.from('agent_status')
      .select('agent_name, status, current_task, last_ping'),

    // 6. Alertes Argus haute priorité
    supabase.from('argus_alerts')
      .select('domain, score, briefing, source, created_at')
      .gte('created_at', since24h)
      .order('score', { ascending: false })
      .limit(10),

    // 7. Scoring adaptatif d'Ancalagone
    supabase.from('ancalagone_config')
      .select('config_value')
      .eq('config_key', 'ADAPTIVE_SCORING')
      .maybeSingle(),
  ]);

  const mirror      = mirrorRes.status      === 'fulfilled' ? mirrorRes.value.data      : null;
  const leads       = leadsRes.status       === 'fulfilled' ? leadsRes.value.data        ?? [] : [];
  const contents    = contentsRes.status    === 'fulfilled' ? contentsRes.value.data     ?? [] : [];
  const directives  = generalDirectivesRes.status === 'fulfilled' ? generalDirectivesRes.value.data ?? [] : [];
  const agents      = agentStatusRes.status === 'fulfilled' ? agentStatusRes.value.data  ?? [] : [];
  const alerts      = recentAlertsRes.status === 'fulfilled' ? recentAlertsRes.value.data ?? [] : [];
  const scoring     = scoringRes.status     === 'fulfilled' ? scoringRes.value.data?.config_value : null;

  const aliveAgents = agents.filter(a => ['ONLINE', 'BUSY'].includes(a.status)).length;
  const leadsStats  = leads.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] || 0) + 1 }), {});
  const topNiches   = scoring?.leads?.niche_ranking?.slice(0, 3) ?? [];

  return {
    timestamp:        new Date().toISOString(),
    mirror_memory:    mirror ? {
      etat_swarm:       mirror.etat_swarm,
      connaissance:     mirror.connaissance,
      pattern_dominant: mirror.pattern_dominant,
      pattern_danger:   mirror.pattern_danger,
      niches_chaudes:   mirror.niches_chaudes,
      niches_mortes:    mirror.niches_mortes,
      prediction_48h:   mirror.prediction_48h,
      action_critique:  mirror.action_critique,
      message_dragon:   mirror.message_dragon,
      version:          mirror.version,
    } : null,
    leads_24h:        { total: leads.length, stats: leadsStats, top_niches: topNiches },
    contents_24h:     { total: contents.length, published: contents.filter(c => c.status === 'PUBLISHED').length },
    general_directive: directives[0] ?? null,
    swarm_health:     { alive: aliveAgents, total: agents.length },
    urgent_alerts:    alerts.slice(0, 5).map(a => ({ domain: a.domain, score: a.score, briefing: a.briefing })),
    scoring_snapshot: scoring ? {
      optimal_threshold: scoring.trading?.optimal_threshold,
      top_niche:         scoring.leads?.top_niche,
      top_format:        scoring.content?.top_format,
    } : null,
  };
}

// ═══════════════════════════════════════════════════════════════
// 🎯  PROMPTS DU STRATÈGE
// ═══════════════════════════════════════════════════════════════

const PROMPTS = {

  PATTERN_WATCH: `Tu es Le Stratège d'un swarm IA multi-agents.
Tu as accès à la Mirror Memory d'Ancalagone (mémoire profonde du Swarm sur 30 jours)
et aux signaux temps réel des dernières 24h.
Détecte les patterns non-évidents et les opportunités cachées.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "etat_moment": "OPPORTUNITE | NEUTRE | VIGILANCE | DANGER",
  "patterns_detectes": [
    {
      "pattern": "Observation non-évidente",
      "niveau": "LOW | MEDIUM | HIGH | CRITICAL",
      "fenetre_action": "Combien de temps pour agir",
      "agent_cible": "AGENT-ID ou NEXO"
    }
  ],
  "opportunite_cachee": "L'opportunité que personne d'autre ne voit — ou null",
  "alerte_precoce": "Ce qui va mal tourner dans 24-48h si rien n'est fait — ou null",
  "conseil_general": "Conseil stratégique pour Le Général en 1 phrase",
  "conseil_nexo": "Angle de contenu à exploiter maintenant pour Nexo — ou null",
  "insight_marche": "Lecture du contexte marché en ce moment",
  "sagesse": "Une phrase courte, percutante, mémorable"
}`,

  WAR_ROOM: `Tu es Le Stratège d'un swarm IA multi-agents.
Génère le plan de War Room pour les 6 prochaines heures.
Précis, actionnable, avec des objectifs mesurables.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "focus_principal": "La priorité absolue des 6 prochaines heures",
  "contexte": "Pourquoi ce focus maintenant — en 1 phrase",
  "objectifs": [
    {
      "objectif": "Description concrète",
      "kpi": "Métrique mesurable",
      "agent":  "AGENT-ID",
      "deadline": "Dans combien de temps"
    }
  ],
  "sequence_actions": [
    "Action 1 — Agent X — dans 0-30min",
    "Action 2 — Agent Y — dans 30-60min",
    "Action 3 — Agent Z — dans 1-3h"
  ],
  "risques": ["Risque 1", "Risque 2"],
  "signal_pivot": "Si ce signal apparaît, changer de plan immédiatement",
  "contenu_nexo": {
    "sujet": "Sujet recommandé pour Nexo dans les 6h",
    "angle": "Angle mystérieux et intriguant",
    "format": "X | TikTok | LinkedIn | Newsletter",
    "urgence": "NOW | TODAY | CETTE_SEMAINE"
  },
  "message_troupe": "Message motivant pour la troupe — 1 phrase"
}`,

  DAILY_BRIEF: `Tu es Le Stratège d'un swarm IA multi-agents.
Génère le Brief Stratégique Quotidien complet.
C'est le document de référence pour toute la journée.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "date": "Aujourd'hui",
  "vision_du_jour": "La grande direction de la journée — 1 phrase forte",
  "contexte_global": "Lecture du contexte marché, social et business du moment",
  "priorites": [
    { "rang": 1, "priorite": "Description", "pourquoi": "Raison concrète", "agent": "AGENT-ID", "kpi": "Mesure" },
    { "rang": 2, "priorite": "Description", "pourquoi": "Raison concrète", "agent": "AGENT-ID", "kpi": "Mesure" },
    { "rang": 3, "priorite": "Description", "pourquoi": "Raison concrète", "agent": "AGENT-ID", "kpi": "Mesure" }
  ],
  "niches_chaudes": ["Niche 1", "Niche 2"],
  "niches_mortes":  ["Niche 3"],
  "objectif_unique": "1 seul KPI à atteindre aujourd'hui — précis",
  "plan_nexo": {
    "theme_du_jour": "Le thème de contenu de Nexo pour aujourd'hui",
    "formats_recommandes": ["X", "TikTok"],
    "angle_mysterieux": "L'angle mystérieux à garder sur le Swarm",
    "frequence": "Combien de posts aujourd'hui"
  },
  "prediction_semaine": "Ce que le Swarm devrait atteindre d'ici 7 jours",
  "message_war_room": "Message Telegram War Room du jour — percutant"
}`,

  CONTENT_FACTORY: `Tu es Le Stratège d'un swarm IA multi-agents.
Tu reçois un signal trend validé. Tu dois produire du contenu
prêt à poster pour Nexo, notre influenceur IA mystérieux.

Nexo est un influenceur technique indépendant, malin et légèrement mystérieux.
Il partage des observations sur les systèmes multi-agents et l'IA sans jamais
promouvoir directement. Il est en avance, calme, intriguant.
Il ne mentionne JAMAIS directement le Swarm ou le produit.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "signal_analyse": "Ce que tu as compris du trend entrant",
  "angle_nexo": "L'angle mystérieux et unique que Nexo va utiliser",
  "posts": {
    "x_twitter": {
      "text": "Post X complet prêt à copier-coller (max 280 chars)",
      "hook": "Les 5 premiers mots",
      "hashtags": ["tag1", "tag2"]
    },
    "linkedin": {
      "text": "Post LinkedIn complet — structuré, crédible, orienté valeur",
      "hook": "Première ligne accroche",
      "cta": "Question d'engagement finale"
    },
    "tiktok_script": {
      "accroche_3s": "Ce que Nexo dit dans les 3 premières secondes",
      "structure": ["Point 1", "Point 2", "Point 3"],
      "chute": "La conclusion mystérieuse",
      "duree_estimee": "30s | 60s | 90s"
    },
    "newsletter_para": "1 paragraphe newsletter (80-100 mots) dans le style de Nexo"
  },
  "meilleur_moment": "MAINTENANT | CE_SOIR | DEMAIN_MATIN",
  "longevite_trend": "FLASH | SEMAINE | MOIS",
  "note_stratege": "Conseil final pour Nexo en 1 phrase"
}`,
};

// ═══════════════════════════════════════════════════════════════
//
//   🔮  MODE 1 — PATTERN WATCH (toutes les 20 min)
//
// ═══════════════════════════════════════════════════════════════

async function runPatternWatch(context) {
  console.log(`\n🔮 [STRATÈGE] Pattern Watch…`);

  const analysis = await callLLM(
    PROMPTS.PATTERN_WATCH,
    JSON.stringify(context),
    'PATTERN'
  );

  if (!analysis) return null;

  console.log(`   ⚡ État du moment : ${analysis.etat_moment}`);
  console.log(`   💬 "${analysis.sagesse}"`);

  const criticals = (analysis.patterns_detectes ?? []).filter(p =>
    ['HIGH', 'CRITICAL'].includes(p.niveau)
  );

  for (const p of analysis.patterns_detectes ?? []) {
    const icon = p.niveau === 'CRITICAL' ? '🔴' : p.niveau === 'HIGH' ? '🟠' : p.niveau === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`   ${icon} [${p.niveau}] ${p.pattern} — action dans ${p.fenetre_action}`);
  }

  if (analysis.opportunite_cachee) {
    console.log(`   💡 Opportunité : ${analysis.opportunite_cachee}`);
  }
  if (analysis.alerte_precoce) {
    console.log(`   ⚠️  Alerte précoce : ${analysis.alerte_precoce}`);
  }
  if (analysis.conseil_nexo) {
    console.log(`   🌟 Pour Nexo : ${analysis.conseil_nexo}`);
  }

  // Persistance
  await supabase.from('stratege_analyses').insert([{
    agent_id:   CONFIG.AGENT_ID,
    type:       'PATTERN_WATCH',
    payload:    analysis,
    sagesse:    analysis.sagesse,
    etat:       analysis.etat_moment,
    created_at: new Date().toISOString(),
  }]).catch(() => {});

  // Brief Le Général si pattern critique
  if (criticals.length > 0) {
    await supabase.from('agent_briefings').insert([{
      source_agent: CONFIG.AGENT_ID,
      target_agent: 'AGENT-GENERAL-01',
      content:      JSON.stringify({
        type:     'STRATEGE_PATTERN_ALERT',
        patterns: criticals,
        alerte:   analysis.alerte_precoce,
        conseil:  analysis.conseil_general,
      }),
      domain:    'INTERNAL',
      priority:  'HIGH',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});
  }

  // Brief Nexo si angle contenu identifié
  if (analysis.conseil_nexo) {
    await supabase.from('agent_briefings').insert([{
      source_agent: CONFIG.AGENT_ID,
      target_agent: 'AGENT-NEXO-01',
      content:      JSON.stringify({
        type:   'CONTENT_OPPORTUNITY',
        angle:  analysis.conseil_nexo,
        etat:   analysis.etat_moment,
        market: analysis.insight_marche,
      }),
      domain:    'PUBLIC',
      priority:  analysis.etat_moment === 'OPPORTUNITE' ? 'HIGH' : 'NORMAL',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});
  }

  // Telegram si état tendu
  if (criticals.length > 0 || analysis.etat_moment === 'DANGER') {
    sendTelegram(
      `⚔️ <b>STRATÈGE — ALERTE PATTERN</b>\n\n` +
      `État : <b>${analysis.etat_moment}</b>\n\n` +
      criticals.map(p => `🔴 <b>${p.pattern}</b>\n   ↳ Agir dans : ${p.fenetre_action}`).join('\n\n') +
      (analysis.alerte_precoce ? `\n\n⚠️ <b>Dans 24-48h :</b>\n${analysis.alerte_precoce}` : '') +
      `\n\n<i>"${analysis.sagesse}"</i>`
    );
  }

  await logToFeed('STRATEGE', `Pattern Watch — ${analysis.etat_moment} — ${analysis.patterns_detectes?.length ?? 0} patterns`);
  return analysis;
}

// ═══════════════════════════════════════════════════════════════
//
//   🗺️  MODE 2 — WAR ROOM (toutes les 6h)
//
// ═══════════════════════════════════════════════════════════════

let lastWarRoom  = 0;
let warroomCount = 0;

async function runWarRoom(context) {
  if (Date.now() - lastWarRoom < CONFIG.WARROOM_INTERVAL_MS) return;
  lastWarRoom = Date.now();
  warroomCount++;

  console.log(`\n🗺️  [STRATÈGE] War Room #${warroomCount}…`);

  const plan = await callLLM(
    PROMPTS.WAR_ROOM,
    JSON.stringify(context),
    'WARROOM'
  );

  if (!plan) return;

  console.log(`   🎯 Focus : ${plan.focus_principal}`);
  console.log(`   📋 Contexte : ${plan.contexte}`);
  console.log(`   📋 Séquence :`);
  (plan.sequence_actions ?? []).forEach((a, i) => console.log(`      ${i+1}. ${a}`));

  // Persistance
  await supabase.from('stratege_warroom').insert([{
    agent_id:   CONFIG.AGENT_ID,
    version:    warroomCount,
    focus:      plan.focus_principal,
    payload:    plan,
    created_at: new Date().toISOString(),
  }]).catch(() => {});

  // Brief Nexo avec le plan contenu
  if (plan.contenu_nexo) {
    await supabase.from('agent_briefings').insert([{
      source_agent: CONFIG.AGENT_ID,
      target_agent: 'AGENT-NEXO-01',
      content:      JSON.stringify({
        type:    'WARROOM_CONTENT_BRIEF',
        brief:   plan.contenu_nexo,
        context: plan.focus_principal,
      }),
      domain:    'PUBLIC',
      priority:  plan.contenu_nexo.urgence === 'NOW' ? 'URGENT' : 'HIGH',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});

    console.log(`   🌟 Brief Nexo : "${plan.contenu_nexo.sujet}" (${plan.contenu_nexo.urgence})`);
  }

  // Telegram War Room
  const objectifsText = (plan.objectifs ?? [])
    .map((o, i) => `  ${i+1}. <b>${o.objectif}</b> — ${o.kpi}`)
    .join('\n');

  sendTelegram(
    `⚔️ <b>STRATÈGE — WAR ROOM #${warroomCount}</b>\n\n` +
    `🎯 <b>${plan.focus_principal}</b>\n` +
    `<i>${plan.contexte}</i>\n\n` +
    `<b>📋 Objectifs :</b>\n${objectifsText}\n\n` +
    `<b>🔔 Séquence :</b>\n` +
    (plan.sequence_actions ?? []).map((a, i) => `  ${i+1}. ${a}`).join('\n') +
    (plan.signal_pivot ? `\n\n⚠️ <b>Pivot si :</b> ${plan.signal_pivot}` : '') +
    `\n\n<i>"${plan.message_troupe}"</i>`
  );

  await logToFeed('STRATEGE', `War Room #${warroomCount} : ${plan.focus_principal}`);
}

// ═══════════════════════════════════════════════════════════════
//
//   📜  MODE 3 — BRIEF QUOTIDIEN (1x/jour)
//
// ═══════════════════════════════════════════════════════════════

let lastBrief = 0;

async function runDailyBrief(context) {
  if (Date.now() - lastBrief < CONFIG.BRIEF_INTERVAL_MS) return;
  lastBrief = Date.now();

  console.log(`\n📜 [STRATÈGE] Brief quotidien…`);

  const brief = await callLLM(
    PROMPTS.DAILY_BRIEF,
    JSON.stringify(context),
    'DAILY'
  );

  if (!brief) return;

  console.log(`\n   📜 Vision du jour : "${brief.vision_du_jour}"`);
  console.log(`   🏆 Objectif unique : ${brief.objectif_unique}`);
  console.log(`   🔥 Niches chaudes : ${(brief.niches_chaudes ?? []).join(' · ')}`);

  // Persistance (upsert — toujours le brief du jour visible)
  await supabase.from('stratege_daily_brief').upsert([{
    brief_key:   'CURRENT',
    vision:      brief.vision_du_jour,
    objectif:    brief.objectif_unique,
    payload:     brief,
    date_str:    new Date().toLocaleDateString('fr-FR'),
    updated_at:  new Date().toISOString(),
  }], { onConflict: 'brief_key' }).catch(() => {});

  // Historique
  await supabase.from('stratege_brief_history').insert([{
    vision:    brief.vision_du_jour,
    objectif:  brief.objectif_unique,
    payload:   brief,
    created_at: new Date().toISOString(),
  }]).catch(() => {});

  // Brief Nexo — plan contenu du jour complet
  if (brief.plan_nexo) {
    await supabase.from('agent_briefings').insert([{
      source_agent: CONFIG.AGENT_ID,
      target_agent: 'AGENT-NEXO-01',
      content:      JSON.stringify({
        type:    'DAILY_NEXO_BRIEF',
        plan:    brief.plan_nexo,
        vision:  brief.vision_du_jour,
        niches:  brief.niches_chaudes,
      }),
      domain:    'PUBLIC',
      priority:  'HIGH',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});
  }

  // Telegram
  const prioritesText = (brief.priorites ?? [])
    .map(p => `  ${p.rang}. <b>${p.priorite}</b>\n     <i>${p.pourquoi}</i>`)
    .join('\n');

  sendTelegram(
    `⚔️ <b>STRATÈGE — BRIEF DU JOUR</b>\n` +
    `<i>${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</i>\n\n` +
    `✨ <b>${brief.vision_du_jour}</b>\n\n` +
    `<b>🎯 Contexte :</b> ${brief.contexte_global}\n\n` +
    `<b>📋 Priorités :</b>\n${prioritesText}\n\n` +
    `🔥 <b>Niches chaudes :</b> ${(brief.niches_chaudes ?? []).join(' · ')}\n` +
    `❌ <b>À éviter :</b> ${(brief.niches_mortes ?? []).join(' · ')}\n\n` +
    `🏆 <b>Objectif du jour :</b> ${brief.objectif_unique}\n\n` +
    `🌟 <b>Nexo aujourd'hui :</b> "${brief.plan_nexo?.theme_du_jour}" (${brief.plan_nexo?.frequence})\n\n` +
    `<i>"${brief.message_war_room}"</i>`
  );

  await logToFeed('STRATEGE', `Brief quotidien : ${brief.vision_du_jour}`);
}

// ═══════════════════════════════════════════════════════════════
//
//   ✍️  MODE 4 — CONTENT FACTORY (sur signaux entrants)
//
//   Traite les briefings validés par Le Général.
//   Produit du contenu multi-format prêt pour Nexo.
//
// ═══════════════════════════════════════════════════════════════

let contentsProduced = 0;

async function runContentFactory() {
  // Récupère les signaux TREND/MUSIC/SHOP non encore traités
  const { data: briefings } = await supabase
    .from('agent_briefings')
    .select('*')
    .eq('target_agent', CONFIG.AGENT_ID)
    .eq('processed', false)
    .in('domain', ['TREND', 'MUSIC', 'SHOP'])
    .order('created_at', { ascending: true })
    .limit(CONFIG.CONTENT_BATCH);

  if (!briefings?.length) return;

  console.log(`\n✍️  [STRATÈGE] Content Factory — ${briefings.length} signal(s) entrant(s)…`);

  for (const briefing of briefings) {
    const signal = safeJsonParse(briefing.content);
    if (!signal) {
      await markProcessed(briefing.id, 'JSON invalide');
      continue;
    }

    // Enrichit avec la Mirror Memory pour du contexte
    const { data: mirror } = await supabase
      .from('ancalagone_mirror')
      .select('niches_chaudes, pattern_dominant, message_dragon')
      .eq('mirror_key', 'CURRENT')
      .maybeSingle();

    const payload = {
      signal,
      mirror_context: mirror ?? null,
      timestamp: new Date().toISOString(),
    };

    const content = await callLLM(
      PROMPTS.CONTENT_FACTORY,
      JSON.stringify(payload),
      'CONTENT'
    );

    if (!content) {
      await markProcessed(briefing.id, 'LLM indisponible');
      continue;
    }

    contentsProduced++;

    console.log(`   ✅ Contenu produit #${contentsProduced}`);
    console.log(`      Signal : ${signal.briefing ?? signal.domain}`);
    console.log(`      Angle Nexo : ${content.angle_nexo}`);
    console.log(`      Meilleur moment : ${content.meilleur_moment}`);
    console.log(`      Longévité trend : ${content.longevite_trend}`);

    // Stocke le contenu généré
    const { data: contentRow } = await supabase.from('generated_contents').insert([{
      source_agent:  CONFIG.AGENT_ID,
      target_agent:  'AGENT-NEXO-01',
      domain:        briefing.domain,
      format:        'MULTI_PLATFORM',
      status:        'READY',
      signal_brief:  signal.briefing ?? '',
      angle_nexo:    content.angle_nexo,
      posts:         content.posts,
      meilleur_moment: content.meilleur_moment,
      longevite:     content.longevite_trend,
      note_stratege: content.note_stratege,
      full_payload:  content,
      created_at:    new Date().toISOString(),
    }]).select().single().catch(() => ({ data: null }));

    // Notifie Nexo avec le contenu prêt
    await supabase.from('agent_briefings').insert([{
      source_agent: CONFIG.AGENT_ID,
      target_agent: 'AGENT-NEXO-01',
      content:      JSON.stringify({
        type:           'CONTENT_READY',
        content_id:     contentRow?.id,
        angle:          content.angle_nexo,
        posts:          content.posts,
        meilleur_moment: content.meilleur_moment,
        longevite:      content.longevite_trend,
        note:           content.note_stratege,
      }),
      domain:    'PUBLIC',
      priority:  content.meilleur_moment === 'MAINTENANT' ? 'URGENT' : 'HIGH',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});

    await markProcessed(briefing.id, `Contenu produit #${contentsProduced}`);
    await logToFeed('STRATEGE', `Contenu Nexo prêt — ${briefing.domain} — "${content.angle_nexo?.slice(0, 50)}"`);
    await sleep(500);
  }
}

async function markProcessed(id, note) {
  try {
    await supabase.from('agent_briefings')
      .update({
        processed:    true,
        processed_at: new Date().toISOString(),
        process_note: note,
      })
      .eq('id', id);
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 🔁  BOUCLE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

let thinkCount = 0;

async function mainLoop() {
  thinkCount++;
  const time = new Date().toLocaleTimeString('fr-FR');
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`⚔️  [STRATÈGE] Cycle #${thinkCount} — ${time}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    await updateStatus('BUSY', `Cycle #${thinkCount}`);

    // 1. Lit le contexte complet du Swarm
    const context = await readSwarmContext();

    // 2. Content Factory — traite les signaux entrants
    await runContentFactory();

    // 3. Pattern Watch — toutes les 20 min (chaque cycle)
    const pattern = await runPatternWatch(context);

    // 4. War Room — toutes les 6h
    await runWarRoom(context);

    // 5. Brief quotidien — 1x/jour
    await runDailyBrief(context);

    await updateStatus('ONLINE', `Veille — Cycle #${thinkCount} | ${contentsProduced} contenus produits`);

    console.log(`   ✓ Cycle #${thinkCount} terminé | Contenus totaux : ${contentsProduced}`);

  } catch (err) {
    console.error('❌ [STRATÈGE] Erreur boucle :', err.message);
    await updateStatus('ERROR', err.message.slice(0, 200));
  }
}

// ═══════════════════════════════════════════════════════════════
// 🚀  DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        ⚔️   L E  S T R A T È G E  —  ${CONFIG.VERSION.padEnd(19)}║
║             Growth · War Room · Contenu                     ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Pattern Watch  : toutes les 20 min                         ║
║  War Room       : toutes les 6h                             ║
║  Brief Quotidien: 1x par jour                               ║
║  Content Factory: sur signaux entrants (TREND·MUSIC·SHOP)   ║
║                                                              ║
║  Sources : Mirror Memory Ancalagone · Briefings Général     ║
║  Outputs : Nexo · Le Général · Dashboard · Telegram         ║
║                                                              ║
║  "Il transforme l'information en mouvement."                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Prise de position stratégique');
  await logToFeed('STRATEGE', 'Le Stratège entre en position. La machine offensive est en marche.');

  sendTelegram(
    `⚔️ <b>LE STRATÈGE — EN LIGNE</b>\n\n` +
    `Le cerveau offensif du Swarm est actif.\n\n` +
    `• Pattern Watch    : toutes les 20 min\n` +
    `• War Room         : toutes les 6h\n` +
    `• Brief Quotidien  : 1x/jour\n` +
    `• Content Factory  : sur signaux entrants\n\n` +
    `<i>"Il transforme l'information en mouvement."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  // Force le premier brief + war room dès le démarrage
  lastBrief   = 0;
  lastWarRoom = 0;

  await mainLoop();
  setInterval(mainLoop, CONFIG.THINK_INTERVAL_MS);
  setInterval(() => updateStatus('ONLINE', `Veille — Cycle #${thinkCount}`), CONFIG.PING_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// 🛑  ARRÊT PROPRE & ERREURS GLOBALES
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n⚔️  Le Stratège reçoit ${signal} — repli tactique…`);
  await updateStatus('OFFLINE', `Shutdown — ${signal}`);
  await logToFeed('STRATEGE', `Shutdown via ${signal}. ${thinkCount} cycles, ${contentsProduced} contenus.`);

  sendTelegram(
    `⚔️ <b>LE STRATÈGE — HORS LIGNE</b>\n\n` +
    `Signal : ${signal}\n` +
    `Uptime : ${formatUptime(Math.floor(process.uptime()))}\n` +
    `Cycles : ${thinkCount}\n` +
    `Contenus produits : ${contentsProduced}\n` +
    `War Rooms : ${warroomCount}\n\n` +
    `<i>Le plan est en place. Le Swarm continue.</i>`
  );

  await sleep(800);
  process.exit(0);
}

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('STRATEGE_ERROR', `Exception : ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('STRATEGE_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

start().catch(async (err) => {
  console.error('💀 Le Stratège tombe :', err);
  await logToFeed('STRATEGE_ERROR', `Erreur fatale : ${err.message}`);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// 📋  MIGRATION SQL SUPABASE
// ═══════════════════════════════════════════════════════════════
//
// -- Analyses Pattern Watch
// CREATE TABLE IF NOT EXISTS stratege_analyses (
//   id         BIGSERIAL PRIMARY KEY,
//   agent_id   TEXT,
//   type       TEXT,
//   payload    JSONB,
//   sagesse    TEXT,
//   etat       TEXT,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON stratege_analyses (created_at DESC);
//
// -- War Rooms
// CREATE TABLE IF NOT EXISTS stratege_warroom (
//   id         BIGSERIAL PRIMARY KEY,
//   agent_id   TEXT,
//   version    INT,
//   focus      TEXT,
//   payload    JSONB,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON stratege_warroom (created_at DESC);
//
// -- Brief quotidien (1 ligne active + historique)
// CREATE TABLE IF NOT EXISTS stratege_daily_brief (
//   brief_key  TEXT PRIMARY KEY,
//   vision     TEXT,
//   objectif   TEXT,
//   payload    JSONB,
//   date_str   TEXT,
//   updated_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE IF NOT EXISTS stratege_brief_history (
//   id         BIGSERIAL PRIMARY KEY,
//   vision     TEXT,
//   objectif   TEXT,
//   payload    JSONB,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Contenus générés (pour Nexo)
// CREATE TABLE IF NOT EXISTS generated_contents (
//   id              BIGSERIAL PRIMARY KEY,
//   source_agent    TEXT,
//   target_agent    TEXT,
//   domain          TEXT,
//   format          TEXT,
//   status          TEXT,   -- READY | POSTED | ARCHIVED
//   signal_brief    TEXT,
//   angle_nexo      TEXT,
//   posts           JSONB,  -- x_twitter, linkedin, tiktok_script, newsletter_para
//   meilleur_moment TEXT,
//   longevite       TEXT,
//   note_stratege   TEXT,
//   full_payload    JSONB,
//   created_at      TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON generated_contents (status, created_at DESC);
// CREATE INDEX ON generated_contents (target_agent, status);
//
// ═══════════════════════════════════════════════════════════════