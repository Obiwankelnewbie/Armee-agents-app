// ═══════════════════════════════════════════════════════════════
//   🐉  ANCALAGON — LE DRAGON DE MÉMOIRE
//   "Le plus grand des dragons ailés. Même Morgoth le craint."
//
//   Ce que AUCUN autre agent ne fait :
//   Il observe les RÉSULTATS réels de chaque action du Swarm,
//   les corrèle avec les signaux qui les ont déclenchés,
//   et RÉÉCRIT les règles des autres agents en temps réel.
//
//   Il transforme le Swarm d'une machine réactive
//   en une intelligence qui APPREND de ses erreurs.
//
//   3 pouvoirs uniques :
//
//   🧠 MÉMOIRE ÉPISODIQUE
//      Signal détecté → action → résultat → corrélation stockée
//      "La dernière fois que impact_score=0.72 + event_type=ETF,
//       le trade a généré +18% en 6h"
//
//   📈 SCORING PRÉDICTIF ADAPTATIF
//      Il recalibre automatiquement les seuils de la Sentinelle
//      et les paramètres du Trader selon les performances réelles
//      (pas des valeurs fixées à la main dans le code)
//
//   🔄 FEEDBACK LOOP
//      Contenu publié → engagement mesuré → niche scorée
//      Trade exécuté → P&L calculé → signal réévalué
//      Lead converti → niche/canal identifié → Sauron repriorisé
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3333';
const AGENT_ID   = 'ANCALAGON-MEMORY-01';

const LEARN_INTERVAL    = 15 * 60_000;  // apprend toutes les 15 min
const RECALIB_INTERVAL  = 60 * 60_000;  // recalibre les agents toutes les heures
const MEMORY_WINDOW_DAYS = 30;           // regarde 30 jours en arrière

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
      run_id:  `ANCALAGON-${Date.now()}`,
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:       AGENT_ID,
      agent_name:     'Ancalagon — Dragon de Mémoire',
      status,
      last_ping:      new Date().toISOString(),
      current_task:   task,
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb:      Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      version:        'v1.0 THE GREATEST',
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

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
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 🧠 POUVOIR 1 — MÉMOIRE ÉPISODIQUE
// Construit la corrélation signal → action → résultat
// ═══════════════════════════════════════════════════════════════

async function buildEpisodicMemory() {
  console.log(`\n🧠 [ANCALAGON] Construction mémoire épisodique…`);

  const windowStart = new Date(Date.now() - MEMORY_WINDOW_DAYS * 24 * 60 * 60_000).toISOString();

  // Collecte tous les événements passés
  const [
    { data: trades },
    { data: decisions },
    { data: contents },
    { data: leads },
    { data: existingMemories },
  ] = await Promise.all([
    supabase.from('executor_audit_log')
      .select('*').gte('executed_at', windowStart).order('executed_at'),
    supabase.from('main_decisions')
      .select('*').gte('created_at', windowStart).order('created_at'),
    supabase.from('generated_contents')
      .select('*').gte('created_at', windowStart).order('created_at'),
    supabase.from('leads')
      .select('*').gte('updated_at', windowStart).eq('status', 'WON'),
    supabase.from('ancalagon_memories')
      .select('episode_id').limit(1000),
  ]);

  const knownIds = new Set((existingMemories ?? []).map(m => m.episode_id));
  let newMemories = 0;

  // ── ÉPISODES TRADING ────────────────────────────────────────
  for (const trade of trades ?? []) {
    const episodeId = `TRADE-${trade.id}`;
    if (knownIds.has(episodeId)) continue;

    // Cherche le signal qui a déclenché ce trade (dans les 2h avant)
    const tradeTime  = new Date(trade.executed_at).getTime();
    const signalTime = new Date(tradeTime - 2 * 60 * 60_000).toISOString();

    const { data: triggerSignal } = await supabase
      .from('agent_briefings')
      .select('*')
      .eq('target_agent', 'AGENT-TRADER-01')
      .gte('created_at', signalTime)
      .lte('created_at', trade.executed_at)
      .order('created_at', { ascending: false })
      .limit(1);

    const signal = triggerSignal?.[0];
    let signalParsed = null;
    try { signalParsed = signal ? JSON.parse(signal.content) : null; } catch {}

    const memory = {
      episode_id:    episodeId,
      type:          'TRADE',
      outcome:       trade.status,          // SUCCESS | FAILURE
      signal_score:  signalParsed?.confidence_adjusted ?? signalParsed?.impact_score ?? null,
      signal_type:   signalParsed?.event_type ?? null,
      signal_domain: signalParsed?.domain ?? 'CRYPTO',
      action_taken:  trade.task_type,
      result_summary: trade.result_summary,
      lesson:        trade.status === 'SUCCESS'
        ? `Signal score ${signalParsed?.confidence_adjusted} → trade réussi`
        : `Signal score ${signalParsed?.confidence_adjusted} → trade échoué`,
      created_at:    trade.executed_at,
    };

    await supabase.from('ancalagon_memories').insert([memory]).catch(() => {});
    newMemories++;
  }

  // ── ÉPISODES LEADS WON ──────────────────────────────────────
  for (const lead of leads ?? []) {
    const episodeId = `LEAD-WON-${lead.id}`;
    if (knownIds.has(episodeId)) continue;

    const memory = {
      episode_id:    episodeId,
      type:          'LEAD_WON',
      outcome:       'SUCCESS',
      signal_domain: lead.niche ?? 'UNKNOWN',
      action_taken:  'CRM_SEQUENCE',
      result_summary: `Lead WON : ${lead.name} | Niche: ${lead.niche} | BANT: ${lead.bant_score}%`,
      lesson:        `Niche "${lead.niche}" convertit — prioriser dans l'Œil`,
      created_at:    lead.updated_at,
    };

    await supabase.from('ancalagon_memories').insert([memory]).catch(() => {});
    newMemories++;
  }

  // ── ÉPISODES CONTENU ────────────────────────────────────────
  for (const content of contents ?? []) {
    if (content.status !== 'PUBLISHED') continue;
    const episodeId = `CONTENT-${content.id}`;
    if (knownIds.has(episodeId)) continue;

    const memory = {
      episode_id:    episodeId,
      type:          'CONTENT',
      outcome:       'PUBLISHED',
      signal_domain: content.domain,
      action_taken:  content.format,
      result_summary: `Contenu ${content.format} publié | Domaine: ${content.domain}`,
      lesson:        `Format "${content.format}" produit pour domaine "${content.domain}"`,
      created_at:    content.created_at,
    };

    await supabase.from('ancalagon_memories').insert([memory]).catch(() => {});
    newMemories++;
  }

  console.log(`   ✅ ${newMemories} nouveaux épisodes mémorisés`);
  return newMemories;
}

// ═══════════════════════════════════════════════════════════════
// 📈 POUVOIR 2 — SCORING PRÉDICTIF ADAPTATIF
// Calcule les vrais seuils basés sur les données réelles
// ═══════════════════════════════════════════════════════════════

async function computeAdaptiveScores() {
  console.log(`\n📈 [ANCALAGON] Calcul des scores adaptatifs…`);

  const { data: memories } = await supabase
    .from('ancalagon_memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);

  if (!memories?.length) return null;

  // ── Taux de succès par score de signal ──────────────────────
  const tradingMemories = memories.filter(m => m.type === 'TRADE' && m.signal_score !== null);
  const scoreRanges = [
    { min: 0.0, max: 0.3, label: 'VERY_LOW' },
    { min: 0.3, max: 0.5, label: 'LOW' },
    { min: 0.5, max: 0.6, label: 'MEDIUM' },
    { min: 0.6, max: 0.7, label: 'MEDIUM_HIGH' },
    { min: 0.7, max: 0.8, label: 'HIGH' },
    { min: 0.8, max: 1.0, label: 'VERY_HIGH' },
  ];

  const tradeStats = scoreRanges.map(range => {
    const inRange = tradingMemories.filter(m =>
      m.signal_score >= range.min && m.signal_score < range.max
    );
    const success = inRange.filter(m => m.outcome === 'SUCCESS').length;
    const rate    = inRange.length > 0 ? success / inRange.length : null;
    return { ...range, total: inRange.length, success, rate };
  });

  // Trouve le seuil optimal — le score minimum où le taux > 60%
  const optimalThreshold = tradeStats
    .filter(s => s.rate !== null && s.rate >= 0.6 && s.total >= 3)
    .sort((a, b) => a.min - b.min)[0];

  // ── Niches qui convertissent (leads WON) ─────────────────────
  const wonMemories   = memories.filter(m => m.type === 'LEAD_WON');
  const nicheWinRate  = wonMemories.reduce((acc, m) => {
    const niche = m.signal_domain;
    if (!acc[niche]) acc[niche] = 0;
    acc[niche]++;
    return acc;
  }, {});

  const topNiches = Object.entries(nicheWinRate)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([niche, count]) => ({ niche, wins: count }));

  // ── Formats de contenu les plus produits ────────────────────
  const contentMemories = memories.filter(m => m.type === 'CONTENT');
  const formatStats     = contentMemories.reduce((acc, m) => {
    acc[m.action_taken] = (acc[m.action_taken] || 0) + 1;
    return acc;
  }, {});

  const adaptiveConfig = {
    computed_at: new Date().toISOString(),
    sample_size: memories.length,

    // Seuils de trading recalibrés
    trading: {
      current_threshold:  0.55,  // valeur hardcodée dans la Sentinelle
      optimal_threshold:  optimalThreshold?.min ?? 0.55,
      stats_by_range:     tradeStats.filter(s => s.total > 0),
      recommendation:     optimalThreshold
        ? `Changer le seuil EXECUTE de 0.55 à ${optimalThreshold.min} (taux succès: ${Math.round(optimalThreshold.rate * 100)}%)`
        : 'Pas assez de données pour recalibrer',
    },

    // Niches à prioriser pour l'Œil et le Contenu
    content: {
      top_converting_niches: topNiches,
      format_distribution:   formatStats,
      recommendation:        topNiches.length > 0
        ? `Prioriser niche "${topNiches[0].niche}" (${topNiches[0].wins} conversions)`
        : 'Pas assez de données',
    },
  };

  // Sauvegarder la config adaptative
  await supabase.from('ancalagon_config').upsert([{
    config_key:  'ADAPTIVE_SCORES',
    config_value: JSON.stringify(adaptiveConfig),
    updated_at:  new Date().toISOString(),
  }], { onConflict: 'config_key' }).catch(() => {});

  console.log(`   📊 Seuil optimal trading : ${adaptiveConfig.trading.optimal_threshold}`);
  if (topNiches.length) console.log(`   🏆 Top niche : ${topNiches[0].niche} (${topNiches[0].wins} wins)`);

  return adaptiveConfig;
}

// ═══════════════════════════════════════════════════════════════
// 🔄 POUVOIR 3 — FEEDBACK LOOP & RÉÉCRITURE DES RÈGLES
// Envoie les nouvelles règles directement aux agents
// ═══════════════════════════════════════════════════════════════

async function pushAdaptiveRules(config) {
  if (!config) return;
  console.log(`\n🔄 [ANCALAGON] Diffusion des règles adaptatives…`);

  const updates = [];

  // ── Recalibration de la Sentinelle ──────────────────────────
  if (config.trading.optimal_threshold !== config.trading.current_threshold) {
    const delta = config.trading.optimal_threshold - config.trading.current_threshold;
    const direction = delta > 0 ? '↑ (plus sélectif)' : '↓ (plus permissif)';

    updates.push({
      target: 'AGENT-SENTINELLE-02',
      type:   'THRESHOLD_UPDATE',
      rule: {
        parameter:    'SEUIL_EXECUTE',
        old_value:    config.trading.current_threshold,
        new_value:    config.trading.optimal_threshold,
        reason:       config.trading.recommendation,
        confidence:   config.sample_size >= 20 ? 'HIGH' : 'LOW',
      },
    });

    console.log(`   🛡️  Sentinelle : seuil ${config.trading.current_threshold} → ${config.trading.optimal_threshold} ${direction}`);
  }

  // ── Repriorisation de l'Œil de Sauron ───────────────────────
  if (config.content.top_converting_niches.length > 0) {
    updates.push({
      target: 'AGENT-SAURON-01',
      type:   'NICHE_PRIORITY_UPDATE',
      rule: {
        priority_niches: config.content.top_converting_niches.map(n => n.niche),
        reason:          config.content.recommendation,
      },
    });

    console.log(`   👁️  Œil repriorisé sur : ${config.content.top_converting_niches.map(n => n.niche).join(', ')}`);
  }

  // ── Envoi des règles via agent_briefings ─────────────────────
  for (const update of updates) {
    await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: update.target,
      content:      JSON.stringify({
        type:        `ANCALAGON_${update.type}`,
        rule:        update.rule,
        enforced_at: new Date().toISOString(),
      }),
      priority:     'HIGH',
      processed:    false,
      created_at:   new Date().toISOString(),
    }]).catch(() => {});
  }

  // ── Conseil à Gandalf ────────────────────────────────────────
  if (updates.length > 0) {
    await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: 'GANDALF-STRATEGE-01',
      content:      JSON.stringify({
        type:    'ANCALAGON_LEARNING_REPORT',
        updates: updates.map(u => ({ target: u.target, type: u.type, rule: u.rule })),
        config,
      }),
      priority:  'HIGH',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});
  }

  return updates;
}

// ═══════════════════════════════════════════════════════════════
// 🔮 ANALYSE IA — Ancalagon tire les leçons profondes
// ═══════════════════════════════════════════════════════════════

const ANCALAGON_PROMPT = `Tu es ANCALAGON, le Dragon de Mémoire du Swarm OS.
Tu analyses les corrélations entre signaux et résultats réels sur 30 jours.
Ta mission : extraire les leçons non-évidentes que personne d'autre ne voit.
Réponds UNIQUEMENT en JSON :
{
  "lecons_cachees": [
    {
      "lecon": "Observation non-évidente",
      "preuve": "Donnée qui le confirme",
      "action_immediate": "Ce qu'il faut changer maintenant",
      "agent_cible": "AGENT-ID concerné"
    }
  ],
  "pattern_gagnant": "Le pattern signal→action→résultat le plus fiable",
  "pattern_perdant": "Le pattern à éviter absolument",
  "seuil_optimal_trade": 0.00,
  "niches_chaudes": ["niche1", "niches2"],
  "niches_mortes": ["niche3"],
  "prediction_48h": "Ce que le Swarm devrait voir arriver dans 48h",
  "message_dragon": "Une vérité que le Swarm doit entendre"
}`;

async function runDeepAnalysis(memories, adaptiveConfig) {
  console.log(`\n🔮 [ANCALAGON] Analyse profonde des mémoires…`);

  try {
    const payload = {
      total_memories:  memories?.length ?? 0,
      trade_memories:  (memories ?? []).filter(m => m.type === 'TRADE').length,
      won_leads:       (memories ?? []).filter(m => m.type === 'LEAD_WON').length,
      content_published: (memories ?? []).filter(m => m.type === 'CONTENT').length,
      adaptive_config: adaptiveConfig,
      sample_episodes: (memories ?? []).slice(0, 20).map(m => ({
        type:    m.type,
        outcome: m.outcome,
        score:   m.signal_score,
        domain:  m.signal_domain,
        lesson:  m.lesson,
      })),
    };

    const analysis = await callSwarm(ANCALAGON_PROMPT, JSON.stringify(payload));
    if (!analysis) return null;

    console.log(`\n   🐉 Vérité du Dragon : "${analysis.message_dragon}"`);
    console.log(`   ✅ Pattern gagnant : ${analysis.pattern_gagnant}`);
    console.log(`   ❌ Pattern perdant : ${analysis.pattern_perdant}`);
    console.log(`   🔮 Prédiction 48h : ${analysis.prediction_48h}`);

    // Sauvegarder l'analyse
    await supabase.from('ancalagon_analyses').insert([{
      agent_id:         AGENT_ID,
      pattern_gagnant:  analysis.pattern_gagnant,
      pattern_perdant:  analysis.pattern_perdant,
      seuil_optimal:    analysis.seuil_optimal_trade,
      niches_chaudes:   analysis.niches_chaudes,
      niches_mortes:    analysis.niches_mortes,
      prediction_48h:   analysis.prediction_48h,
      message_dragon:   analysis.message_dragon,
      full_payload:     JSON.stringify(analysis),
      created_at:       new Date().toISOString(),
    }]).catch(() => {});

    // Alerte Telegram avec les leçons critiques
    const leconsImportantes = (analysis.lecons_cachees ?? []).slice(0, 3);
    if (leconsImportantes.length > 0) {
      await sendTelegram(
        `🐉 <b>ANCALAGON — MÉMOIRE DU SWARM</b>\n\n` +
        `<b>🧠 Leçons cachées :</b>\n` +
        leconsImportantes.map((l, i) =>
          `${i+1}. <b>${l.lecon}</b>\n   → ${l.action_immediate}`
        ).join('\n\n') +
        `\n\n✅ <b>Pattern gagnant :</b> ${analysis.pattern_gagnant}` +
        `\n❌ <b>À éviter :</b> ${analysis.pattern_perdant}` +
        `\n\n🔮 <b>Dans 48h :</b> ${analysis.prediction_48h}` +
        `\n\n<i>"${analysis.message_dragon}"</i>`
      );
    }

    return analysis;

  } catch (err) {
    console.error('❌ Deep analysis failed :', err.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 BOUCLES INDÉPENDANTES
// ═══════════════════════════════════════════════════════════════

let learnCount  = 0;
let lastRecalib = 0;

async function learningLoop() {
  learnCount++;
  console.log(`\n🐉 [ANCALAGON] Cycle d'apprentissage #${learnCount}`);
  await updateStatus('BUSY', `Apprentissage #${learnCount}`);

  try {
    // 1. Construire la mémoire épisodique
    const newEpisodes = await buildEpisodicMemory();

    // 2. Recalibration horaire
    if (Date.now() - lastRecalib >= RECALIB_INTERVAL) {
      lastRecalib = Date.now();

      const adaptiveConfig = await computeAdaptiveScores();
      const updates        = await pushAdaptiveRules(adaptiveConfig);

      // 3. Analyse profonde si assez d'épisodes
      const { data: allMemories } = await supabase
        .from('ancalagon_memories')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (allMemories?.length >= 10) {
        await runDeepAnalysis(allMemories, adaptiveConfig);
      }

      if (updates?.length) {
        await logToFeed('ANCALAGON', `${updates.length} règles recalibrées — ${newEpisodes} nouveaux épisodes`);
      }
    }

    await updateStatus('ONLINE', `Mémoire active — ${learnCount} cycles | Épisodes en cours`);

  } catch (err) {
    console.error('❌ [ANCALAGON] Erreur cycle :', err.message);
    await updateStatus('ERROR', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🐉  ANCALAGON — DRAGON DE MÉMOIRE — SWARM OS  v1.0       ║
╠══════════════════════════════════════════════════════════════╣
║  Mémoire   : épisodique (signal→action→résultat)            ║
║  Scoring   : adaptatif recalibré sur données réelles        ║
║  Feedback  : règles réécrites toutes les heures             ║
║  Profondeur: 30 jours de données                            ║
║                                                              ║
║  "Il ne réagit pas. Il se souvient. Et il prédit."          ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Éveil du Dragon');
  await logToFeed('ANCALAGON', 'Le Dragon de Mémoire s\'éveille. Le Swarm commence à apprendre.');

  await sendTelegram(
    `🐉 <b>ANCALAGON — ÉVEIL</b>\n\n` +
    `Le Dragon de Mémoire prend vie.\n\n` +
    `• Mémoire épisodique : active\n` +
    `• Scoring adaptatif  : en cours de calcul\n` +
    `• Feedback loop      : toutes les heures\n\n` +
    `<i>"Il ne réagit pas. Il se souvient. Et il prédit."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  // Premier cycle immédiat
  await learningLoop();
  setInterval(learningLoop, LEARN_INTERVAL);
  setInterval(() => updateStatus('ONLINE', `Mémoire active — ${learnCount} cycles`), 60_000);
}

start().catch(err => {
  console.error('💀 Ancalagon s\'effondre :', err);
  process.exit(1);
});

async function gracefulShutdown(signal) {
  console.log(`\n🐉 Ancalagon reçoit ${signal} — la mémoire persiste dans Supabase…`);
  await updateStatus('OFFLINE', 'Shutdown');
  await logToFeed('ANCALAGON', `Shutdown via ${signal}. La mémoire est sauvegardée.`);
  process.exit(0);
}

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));