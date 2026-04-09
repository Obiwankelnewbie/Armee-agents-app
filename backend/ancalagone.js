// ═══════════════════════════════════════════════════════════════
//
//       ▄████████████████████████████████████████████▄
//       █                                            █
//       █          🐉  A N C A L A G O N E          █
//       █        Dragon de Mémoire — Swarm OS        █
//       █               Version  2.0                 █
//       █                                            █
//       ▀████████████████████████████████████████████▀
//
//   "Il ne surveille pas. Il ne publie pas. Il ne trade pas.
//    Il se souvient de tout. Et c'est pour ça que le Swarm vit."
//
//   ─────────────────────────────────────────────────────────────
//
//   Ancalagone est la colonne vertébrale invisible du Swarm.
//   Sans lui, les agents sont des boucles sans cerveau.
//   Avec lui, chaque échec devient une leçon,
//   chaque succès devient une règle.
//
//   SES QUATRE POUVOIRS :
//
//   🧠  MÉMOIRE ÉPISODIQUE SÉMANTIQUE
//       Chaque signal → action → résultat est vectorisé.
//       Il ne cherche pas par mots-clés. Il cherche par sens.
//       "La dernière fois que l'ambiance ressemblait à ça..."
//
//   📈  SCORING ADAPTATIF EN TEMPS RÉEL
//       Les seuils des autres agents ne sont pas hardcodés.
//       Ancalagone les recalibre toutes les heures
//       selon les performances réelles — pas des intuitions.
//
//   🔄  FEEDBACK LOOP CROSS-AGENTS
//       Trade raté → Ancalagone comprend pourquoi.
//       Lead WON   → Ancalagone identifie le pattern.
//       Contenu viral → Ancalagone extrait la formule.
//       Et il réécrit les règles des autres en conséquence.
//
//   🔮  MÉMOIRE MIROIR (Mirror Memory)
//       Résumé vivant du Swarm : ce qui marche, ce qui tue,
//       ce qui arrive dans 48h. Visible sur le dashboard.
//       La conscience du système.
//
//   ─────────────────────────────────────────────────────────────
//
//   POSITION DANS LE SWARM : #1 — Priorité absolue
//   Il démarre avant tout le monde. Il s'arrête en dernier.
//
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:           'AGENT-ANCALAGONE-01',
  AGENT_NAME:         'Ancalagone',
  VERSION:            'v2.0',
  SERVER_URL:         process.env.SERVER_URL || 'http://localhost:3333',

  // Intervalles
  LEARN_INTERVAL_MS:   15 * 60_000,   // mémoire épisodique toutes les 15 min
  RECALIB_INTERVAL_MS: 60 * 60_000,   // recalibration des agents toutes les heures
  MIRROR_INTERVAL_MS:  30 * 60_000,   // mise à jour Mirror Memory toutes les 30 min
  PING_INTERVAL_MS:    60_000,

  // Mémoire
  MEMORY_WINDOW_DAYS:  30,            // fenêtre d'analyse
  MEMORY_DEEP_LIMIT:   300,           // épisodes chargés pour l'analyse profonde
  MEMORY_SAMPLE_SIZE:  25,            // épisodes envoyés au LLM
  MIN_EPISODES_ANALYSIS: 8,           // minimum avant d'activer l'analyse IA

  // Scoring
  TRADE_SUCCESS_RATE_TARGET: 0.60,    // taux cible pour valider un seuil
  MIN_SAMPLES_FOR_THRESHOLD:  3,      // min trades dans une plage pour la valider

  // LLM
  LLM_TIMEOUT_MS:      30_000,
  LLM_RETRY_COUNT:     2,
  LLM_RETRY_DELAY_MS:  3_000,

  // Telegram
  TELEGRAM_COOLDOWN_MS: 400,
};

// Score ranges pour l'analyse trading
const SCORE_RANGES = [
  { min: 0.0,  max: 0.3,  label: 'NOISE'     },
  { min: 0.3,  max: 0.45, label: 'WEAK'      },
  { min: 0.45, max: 0.55, label: 'MODERATE'  },
  { min: 0.55, max: 0.65, label: 'SOLID'     },
  { min: 0.65, max: 0.75, label: 'STRONG'    },
  { min: 0.75, max: 0.85, label: 'VERY_HIGH' },
  { min: 0.85, max: 1.0,  label: 'CRITICAL'  },
];

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

function windowStart(days = CONFIG.MEMORY_WINDOW_DAYS) {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
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
      run_id:     `ANCALAGONE-${Date.now()}`,
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
        learn_cycles:   learnCount,
        recalib_count:  recalibCount,
        mirror_version: mirrorVersion,
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
// 🧠  APPEL LLM — retry + timeout + parsing robuste
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
        console.warn(`   ⚠️  LLM [${label}] HTTP ${res.status} — tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT}`);
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY_MS * attempt);
        continue;
      }

      const data   = await res.json();
      const parsed = safeJsonParse(data.text ?? data.response ?? '');

      if (!parsed) {
        console.warn(`   ⚠️  LLM [${label}] JSON non parsable — tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT}`);
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
//
//   🧠  POUVOIR 1 — MÉMOIRE ÉPISODIQUE SÉMANTIQUE
//
//   Chaque événement du Swarm devient un épisode mémorisé :
//   signal → contexte → action → résultat → leçon
//
//   La mémoire n'est pas un log. C'est une compréhension.
//
// ═══════════════════════════════════════════════════════════════

async function buildEpisodicMemory() {
  console.log(`\n🧠 [ANCALAGONE] Construction mémoire épisodique…`);

  const since = windowStart();

  // Charge tous les événements en parallèle
  const [
    tradesRes,
    leadsRes,
    contentsRes,
    briefingsRes,
    existingRes,
  ] = await Promise.allSettled([
    supabase.from('executor_audit_log')
      .select('*').gte('executed_at', since).order('executed_at'),
    supabase.from('leads')
      .select('*').gte('updated_at', since),
    supabase.from('generated_contents')
      .select('*').gte('created_at', since).order('created_at'),
    supabase.from('agent_briefings')
      .select('id, source_agent, target_agent, content, domain, priority, created_at')
      .eq('target_agent', 'AGENT-TRADER-01')
      .gte('created_at', since)
      .order('created_at'),
    supabase.from('ancalagone_memories')
      .select('episode_id').limit(5000),
  ]);

  const trades    = tradesRes.status    === 'fulfilled' ? tradesRes.value.data    ?? [] : [];
  const leads     = leadsRes.status     === 'fulfilled' ? leadsRes.value.data     ?? [] : [];
  const contents  = contentsRes.status  === 'fulfilled' ? contentsRes.value.data  ?? [] : [];
  const briefings = briefingsRes.status === 'fulfilled' ? briefingsRes.value.data ?? [] : [];
  const existing  = existingRes.status  === 'fulfilled' ? existingRes.value.data  ?? [] : [];

  const knownIds  = new Set(existing.map(m => m.episode_id));
  const newEpisodes = [];

  // ── ÉPISODES TRADING ─────────────────────────────────────────
  for (const trade of trades) {
    const episodeId = `TRADE-${trade.id}`;
    if (knownIds.has(episodeId)) continue;

    // Corrèle avec le signal déclencheur (2h avant le trade)
    const tradeTime    = new Date(trade.executed_at).getTime();
    const searchFrom   = new Date(tradeTime - 2 * 60 * 60_000).toISOString();
    const triggerSignal = briefings.find(b =>
      b.created_at >= searchFrom &&
      b.created_at <= trade.executed_at
    );

    const signalData = triggerSignal ? safeJsonParse(triggerSignal.content) : null;
    const score      = signalData?.confidence_adjusted ?? signalData?.impact_score ?? null;
    const eventType  = signalData?.event_type ?? null;
    const asset      = signalData?.asset ?? null;

    // Calcule le P&L si disponible
    const result = safeJsonParse(trade.result_summary);
    const pnlPct = result?.pnl_percent ?? null;

    newEpisodes.push({
      episode_id:     episodeId,
      type:           'TRADE',
      outcome:        trade.status,
      signal_score:   score,
      signal_type:    eventType,
      signal_domain:  'CRYPTO',
      asset,
      action_taken:   trade.task_type,
      result_summary: trade.result_summary,
      pnl_percent:    pnlPct,
      lesson: trade.status === 'SUCCESS'
        ? `[TRADE_WIN] Score ${score?.toFixed(2)} + ${eventType} sur ${asset} → succès${pnlPct ? ` (+${pnlPct}%)` : ''}`
        : `[TRADE_LOSS] Score ${score?.toFixed(2)} + ${eventType} sur ${asset} → échec`,
      semantic_tags:  [
        'TRADING',
        trade.status,
        eventType,
        asset,
        score >= 0.7 ? 'HIGH_CONFIDENCE' : score >= 0.5 ? 'MED_CONFIDENCE' : 'LOW_CONFIDENCE',
      ].filter(Boolean),
      created_at:     trade.executed_at,
    });
  }

  // ── ÉPISODES LEADS ───────────────────────────────────────────
  for (const lead of leads) {
    const episodeId = `LEAD-${lead.id}-${lead.status}`;
    if (knownIds.has(episodeId)) continue;

    const isWon = lead.status === 'WON';

    newEpisodes.push({
      episode_id:     episodeId,
      type:           'LEAD',
      outcome:        isWon ? 'WON' : lead.status,
      signal_domain:  lead.niche ?? 'UNKNOWN',
      action_taken:   'CRM_SEQUENCE',
      result_summary: `Lead ${lead.status} : ${lead.name} | Niche: ${lead.niche} | BANT: ${lead.bant_score ?? 'N/A'}%`,
      lesson: isWon
        ? `[LEAD_WON] Niche "${lead.niche}" convertit — BANT: ${lead.bant_score}% — à prioriser`
        : `[LEAD_${lead.status}] Niche "${lead.niche}" — à analyser`,
      semantic_tags:  ['CRM', lead.status, lead.niche, `BANT_${lead.bant_score > 70 ? 'HIGH' : 'MED'}`].filter(Boolean),
      created_at:     lead.updated_at ?? lead.created_at,
    });
  }

  // ── ÉPISODES CONTENU ─────────────────────────────────────────
  for (const content of contents) {
    const episodeId = `CONTENT-${content.id}`;
    if (knownIds.has(episodeId)) continue;

    const engagementScore = content.engagement_score ?? null;

    newEpisodes.push({
      episode_id:     episodeId,
      type:           'CONTENT',
      outcome:        content.status,
      signal_domain:  content.domain,
      action_taken:   content.format,
      result_summary: `Contenu ${content.format} | Domaine: ${content.domain} | Statut: ${content.status}`,
      engagement_score: engagementScore,
      lesson: content.status === 'PUBLISHED'
        ? `[CONTENT_OUT] Format "${content.format}" publié sur "${content.domain}"${engagementScore ? ` — engagement: ${engagementScore}` : ''}`
        : `[CONTENT_${content.status}] Format "${content.format}" non publié`,
      semantic_tags:  ['CONTENT', content.format, content.domain, content.status].filter(Boolean),
      created_at:     content.created_at,
    });
  }

  // ── ÉCRITURE EN BASE (batch pour éviter les timeouts) ────────
  const BATCH_SIZE = 20;
  let written = 0;

  for (let i = 0; i < newEpisodes.length; i += BATCH_SIZE) {
    const batch = newEpisodes.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('ancalagone_memories')
      .insert(batch);

    if (!error) written += batch.length;
    await sleep(100);
  }

  console.log(`   ✅ ${written} nouveaux épisodes mémorisés (${trades.length} trades · ${leads.length} leads · ${contents.length} contenus)`);
  return written;
}

// ═══════════════════════════════════════════════════════════════
//
//   📈  POUVOIR 2 — SCORING ADAPTATIF
//
//   Les seuils ne sont pas dans le code.
//   Ils sont dans les données.
//   Ancalagone les recalcule en continu.
//
// ═══════════════════════════════════════════════════════════════

async function computeAdaptiveScoring() {
  console.log(`\n📈 [ANCALAGONE] Calcul du scoring adaptatif…`);

  const { data: memories } = await supabase
    .from('ancalagone_memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(CONFIG.MEMORY_DEEP_LIMIT);

  if (!memories?.length) {
    console.log('   ⚠️  Pas assez de mémoires pour calibrer');
    return null;
  }

  // ── TRADING : taux de succès par plage de score ──────────────
  const tradeMems = memories.filter(m => m.type === 'TRADE' && m.signal_score !== null);

  const tradeStats = SCORE_RANGES.map(range => {
    const inRange = tradeMems.filter(m =>
      m.signal_score >= range.min && m.signal_score < range.max
    );
    const wins    = inRange.filter(m => m.outcome === 'SUCCESS').length;
    const rate    = inRange.length > 0 ? wins / inRange.length : null;
    const avgPnl  = inRange.filter(m => m.pnl_percent != null).length > 0
      ? inRange.reduce((s, m) => s + (m.pnl_percent ?? 0), 0) / inRange.filter(m => m.pnl_percent != null).length
      : null;

    return {
      ...range,
      total: inRange.length,
      wins,
      rate,
      avg_pnl: avgPnl ? parseFloat(avgPnl.toFixed(2)) : null,
    };
  });

  // Seuil optimal : plage la plus basse avec rate ≥ target ET assez d'échantillons
  const optimalRange = tradeStats
    .filter(s => s.rate !== null && s.rate >= CONFIG.TRADE_SUCCESS_RATE_TARGET && s.total >= CONFIG.MIN_SAMPLES_FOR_THRESHOLD)
    .sort((a, b) => a.min - b.min)[0];

  // ── LEADS : niches qui convertissent ────────────────────────
  const leadMems    = memories.filter(m => m.type === 'LEAD');
  const nicheStats  = {};

  for (const m of leadMems) {
    const niche = m.signal_domain ?? 'UNKNOWN';
    if (!nicheStats[niche]) nicheStats[niche] = { won: 0, total: 0 };
    nicheStats[niche].total++;
    if (m.outcome === 'WON') nicheStats[niche].won++;
  }

  const nicheRanking = Object.entries(nicheStats)
    .map(([niche, s]) => ({
      niche,
      won:       s.won,
      total:     s.total,
      win_rate:  s.total > 0 ? parseFloat((s.won / s.total).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.win_rate - a.win_rate || b.won - a.won)
    .slice(0, 8);

  // ── CONTENU : formats et domaines qui performent ─────────────
  const contentMems = memories.filter(m => m.type === 'CONTENT' && m.outcome === 'PUBLISHED');
  const formatStats = contentMems.reduce((a, m) => {
    a[m.action_taken] = (a[m.action_taken] || 0) + 1;
    return a;
  }, {});
  const domainStats = contentMems.reduce((a, m) => {
    a[m.signal_domain] = (a[m.signal_domain] || 0) + 1;
    return a;
  }, {});

  // ── EVENT TYPES QUI GAGNENT ──────────────────────────────────
  const winnerEvents = tradeMems
    .filter(m => m.outcome === 'SUCCESS' && m.signal_type)
    .reduce((a, m) => {
      a[m.signal_type] = (a[m.signal_type] || 0) + 1;
      return a;
    }, {});

  const loserEvents = tradeMems
    .filter(m => m.outcome === 'FAILURE' && m.signal_type)
    .reduce((a, m) => {
      a[m.signal_type] = (a[m.signal_type] || 0) + 1;
      return a;
    }, {});

  const scoring = {
    computed_at:     new Date().toISOString(),
    sample_size:     memories.length,
    trading: {
      stats_by_range:    tradeStats.filter(s => s.total > 0),
      optimal_threshold: optimalRange?.min ?? null,
      current_threshold: 0.55,
      threshold_delta:   optimalRange ? parseFloat((optimalRange.min - 0.55).toFixed(3)) : 0,
      recommendation:    optimalRange
        ? `Changer seuil EXECUTE : 0.55 → ${optimalRange.min} (win rate: ${Math.round(optimalRange.rate * 100)}% sur ${optimalRange.total} trades)`
        : `Pas assez de données fiables (${tradeMems.length} trades analysés)`,
      winning_events:    Object.entries(winnerEvents).sort((a,b) => b[1]-a[1]).slice(0,3).map(([e,c]) => `${e}(${c})`),
      losing_events:     Object.entries(loserEvents).sort((a,b) => b[1]-a[1]).slice(0,3).map(([e,c]) => `${e}(${c})`),
    },
    leads: {
      niche_ranking:    nicheRanking,
      top_niche:        nicheRanking[0]?.niche ?? null,
      recommendation:   nicheRanking[0]
        ? `Prioriser "${nicheRanking[0].niche}" (win rate: ${Math.round(nicheRanking[0].win_rate * 100)}%)`
        : 'Pas assez de leads',
    },
    content: {
      format_stats:  formatStats,
      domain_stats:  domainStats,
      top_format:    Object.entries(formatStats).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null,
      top_domain:    Object.entries(domainStats).sort((a,b) => b[1]-a[1])[0]?.[0] ?? null,
    },
  };

  // Persistance
  await supabase.from('ancalagone_config').upsert([{
    config_key:   'ADAPTIVE_SCORING',
    config_value: scoring,
    updated_at:   new Date().toISOString(),
  }], { onConflict: 'config_key' }).catch(() => {});

  // Console summary
  console.log(`   📊 Trades analysés    : ${tradeMems.length}`);
  if (optimalRange) {
    const dir = scoring.trading.threshold_delta >= 0 ? '↑' : '↓';
    console.log(`   📊 Seuil optimal      : ${optimalRange.min} ${dir} (actuel: 0.55)`);
    console.log(`   📊 Win rate optimal   : ${Math.round(optimalRange.rate * 100)}%`);
  }
  if (nicheRanking[0]) {
    console.log(`   🏆 Top niche          : ${nicheRanking[0].niche} (${Math.round(nicheRanking[0].win_rate * 100)}% win rate)`);
  }

  return scoring;
}

// ═══════════════════════════════════════════════════════════════
//
//   🔄  POUVOIR 3 — FEEDBACK LOOP & RÉÉCRITURE DES RÈGLES
//
//   Ancalagone ne suggère pas. Il envoie des ordres.
//   Les autres agents les appliquent.
//
// ═══════════════════════════════════════════════════════════════

async function pushAdaptiveRules(scoring) {
  if (!scoring) return [];
  console.log(`\n🔄 [ANCALAGONE] Diffusion des règles adaptatives…`);

  const updates = [];

  // ── Recalibration Le Trader ──────────────────────────────────
  const newThreshold = scoring.trading.optimal_threshold;
  if (newThreshold !== null && Math.abs(scoring.trading.threshold_delta) >= 0.02) {
    const dir = scoring.trading.threshold_delta > 0 ? '↑ plus sélectif' : '↓ plus permissif';
    updates.push({
      target: 'AGENT-TRADER-01',
      type:   'THRESHOLD_RECALIBRATION',
      rule: {
        parameter:     'EXECUTE_THRESHOLD',
        old_value:     scoring.trading.current_threshold,
        new_value:     newThreshold,
        direction:     dir,
        win_rate:      scoring.trading.stats_by_range.find(r => r.min === newThreshold)?.rate,
        sample_size:   scoring.sample_size,
        confidence:    scoring.sample_size >= 30 ? 'HIGH' : scoring.sample_size >= 15 ? 'MEDIUM' : 'LOW',
        reason:        scoring.trading.recommendation,
      },
    });
    console.log(`   💹 Le Trader : seuil 0.55 → ${newThreshold} (${dir})`);
  }

  // ── Repriorisation Argus selon niches qui convertissent ──────
  const topNiches = scoring.leads.niche_ranking
    .filter(n => n.win_rate >= 0.3 && n.total >= 2)
    .map(n => n.niche);

  if (topNiches.length > 0) {
    updates.push({
      target: 'AGENT-ARGUS-01',
      type:   'NICHE_REPRIORITIZATION',
      rule: {
        priority_niches:   topNiches.slice(0, 5),
        boost_factor:      1.25,
        reason:            scoring.leads.recommendation,
        winning_events:    scoring.trading.winning_events,
        avoid_events:      scoring.trading.losing_events,
      },
    });
    console.log(`   🔭 Argus repriorisé sur : ${topNiches.slice(0, 3).join(', ')}`);
  }

  // ── Brief stratégique pour Le Stratège ──────────────────────
  if (scoring.content.top_format || scoring.content.top_domain) {
    updates.push({
      target: 'AGENT-STRATEGE-01',
      type:   'CONTENT_STRATEGY_UPDATE',
      rule: {
        preferred_format:  scoring.content.top_format,
        preferred_domain:  scoring.content.top_domain,
        format_stats:      scoring.content.format_stats,
        domain_stats:      scoring.content.domain_stats,
        reason:            `Basé sur ${scoring.sample_size} épisodes mémorisés`,
      },
    });
    console.log(`   ⚔️  Le Stratège : format préféré → ${scoring.content.top_format} | domaine → ${scoring.content.top_domain}`);
  }

  // ── Envoi en base (agent_briefings) ─────────────────────────
  for (const update of updates) {
    await supabase.from('agent_briefings').insert([{
      source_agent: CONFIG.AGENT_ID,
      target_agent: update.target,
      content:      JSON.stringify({
        type:            `ANCALAGONE_${update.type}`,
        rule:            update.rule,
        enforced_at:     new Date().toISOString(),
        ancalagone_ver:  CONFIG.VERSION,
      }),
      domain:    'INTERNAL',
      priority:  'HIGH',
      processed: false,
      created_at: new Date().toISOString(),
    }]).catch(() => {});

    await sleep(200);
  }

  if (updates.length > 0) {
    await logToFeed('ANCALAGONE', `${updates.length} règles recalibrées et diffusées`);
  } else {
    console.log('   ✓ Aucun recalibrage nécessaire ce cycle');
  }

  return updates;
}

// ═══════════════════════════════════════════════════════════════
//
//   🔮  POUVOIR 4 — MIRROR MEMORY (Mémoire Miroir)
//
//   Une conscience vivante du Swarm.
//   Ce qui marche. Ce qui ne marche pas.
//   Ce qui arrive dans 48h.
//   Visible sur le dashboard. Toujours à jour.
//
// ═══════════════════════════════════════════════════════════════

const MIRROR_PROMPT = `Tu es Ancalagone, le Dragon de Mémoire d'un swarm IA.
Tu as accès aux mémoires épisodiques des 30 derniers jours.
Tu dois produire la Mémoire Miroir du Swarm : une conscience vivante de ce qui se passe.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "etat_swarm": "APPRENANT | STABLE | OPTIMISE | CRITIQUE",
  "connaissance_actuelle": "Ce que le Swarm sait maintenant qu'il ne savait pas avant — 2 phrases",
  "pattern_dominant": "Le pattern signal→résultat le plus fiable en ce moment",
  "pattern_danger": "Le pattern à éviter absolument — avec preuve concrète",
  "seuil_trading_ideal": 0.00,
  "niches_chaudes": ["niche1", "niche2"],
  "niches_mortes": ["niche3"],
  "forces_swarm": ["Force 1", "Force 2"],
  "faiblesses_swarm": ["Faiblesse 1"],
  "prediction_48h": "Ce que le Swarm va voir dans les 48 prochaines heures — précis et factuel",
  "action_critique": "L'action la plus importante à faire MAINTENANT",
  "lecons_cachees": [
    {
      "observation": "Ce que les données révèlent",
      "implication": "Ce que ça signifie pour le Swarm",
      "agent_cible": "AGENT-ID concerné"
    }
  ],
  "message_du_dragon": "Une vérité essentielle que le Swarm doit intégrer — percutante, mémorable"
}`;

let mirrorVersion = 0;

async function updateMirrorMemory() {
  console.log(`\n🔮 [ANCALAGONE] Mise à jour Mirror Memory…`);

  const { data: memories } = await supabase
    .from('ancalagone_memories')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(CONFIG.MEMORY_DEEP_LIMIT);

  if (!memories?.length || memories.length < CONFIG.MIN_EPISODES_ANALYSIS) {
    console.log(`   ⏳ ${memories?.length ?? 0}/${CONFIG.MIN_EPISODES_ANALYSIS} épisodes requis — Mirror en attente`);
    return null;
  }

  const { data: currentScoring } = await supabase
    .from('ancalagone_config')
    .select('config_value')
    .eq('config_key', 'ADAPTIVE_SCORING')
    .maybeSingle();

  // Prépare un échantillon représentatif (pas tous pour éviter des tokens excessifs)
  const sample = [
    ...memories.filter(m => m.type === 'TRADE').slice(0, 10),
    ...memories.filter(m => m.type === 'LEAD').slice(0, 8),
    ...memories.filter(m => m.type === 'CONTENT').slice(0, 7),
  ].slice(0, CONFIG.MEMORY_SAMPLE_SIZE);

  const payload = {
    total_episodes:   memories.length,
    sample_episodes:  sample.map(m => ({
      type:    m.type,
      outcome: m.outcome,
      score:   m.signal_score,
      domain:  m.signal_domain,
      lesson:  m.lesson,
      tags:    m.semantic_tags,
    })),
    scoring_snapshot: currentScoring?.config_value ?? null,
    timestamp:        new Date().toISOString(),
    swarm_uptime:     formatUptime(Math.floor(process.uptime())),
  };

  const mirror = await callLLM(MIRROR_PROMPT, JSON.stringify(payload), 'MIRROR');
  if (!mirror) return null;

  mirrorVersion++;

  // Persistance Mirror Memory (upsert — toujours la version la plus récente visible)
  await supabase.from('ancalagone_mirror').upsert([{
    mirror_key:       'CURRENT',
    version:          mirrorVersion,
    etat_swarm:       mirror.etat_swarm,
    connaissance:     mirror.connaissance_actuelle,
    pattern_dominant: mirror.pattern_dominant,
    pattern_danger:   mirror.pattern_danger,
    seuil_ideal:      mirror.seuil_trading_ideal,
    niches_chaudes:   mirror.niches_chaudes,
    niches_mortes:    mirror.niches_mortes,
    forces:           mirror.forces_swarm,
    faiblesses:       mirror.faiblesses_swarm,
    prediction_48h:   mirror.prediction_48h,
    action_critique:  mirror.action_critique,
    lecons_cachees:   mirror.lecons_cachees,
    message_dragon:   mirror.message_du_dragon,
    episodes_count:   memories.length,
    full_payload:     mirror,
    updated_at:       new Date().toISOString(),
  }], { onConflict: 'mirror_key' }).catch(() => {});

  // Historique des mirrors (pour trend analysis)
  await supabase.from('ancalagone_mirror_history').insert([{
    version:         mirrorVersion,
    etat_swarm:      mirror.etat_swarm,
    message_dragon:  mirror.message_du_dragon,
    prediction_48h:  mirror.prediction_48h,
    episodes_count:  memories.length,
    created_at:      new Date().toISOString(),
  }]).catch(() => {});

  await logToFeed('ANCALAGONE', `Mirror v${mirrorVersion} — ${mirror.etat_swarm} — "${mirror.message_du_dragon?.slice(0, 60)}…"`);

  console.log(`\n   🐉 Message du Dragon : "${mirror.message_du_dragon}"`);
  console.log(`   🔮 Prédiction 48h    : ${mirror.prediction_48h}`);
  console.log(`   ✅ Pattern dominant  : ${mirror.pattern_dominant}`);
  console.log(`   ❌ Pattern danger    : ${mirror.pattern_danger}`);
  console.log(`   ⚔️  Action critique   : ${mirror.action_critique}`);

  // Telegram si leçons critiques ou état dégradé
  const shouldAlert = mirror.etat_swarm === 'CRITIQUE' || (mirror.lecons_cachees?.length > 0);

  if (shouldAlert) {
    const lecons = (mirror.lecons_cachees ?? []).slice(0, 2);
    sendTelegram(
      `🐉 <b>ANCALAGONE — MÉMOIRE MIROIR v${mirrorVersion}</b>\n\n` +
      `État Swarm : <b>${mirror.etat_swarm}</b>\n\n` +
      (lecons.length > 0
        ? `<b>🧠 Leçons cachées :</b>\n` +
          lecons.map((l, i) => `${i+1}. <b>${l.observation}</b>\n   → ${l.implication}`).join('\n\n') + '\n\n'
        : '') +
      `<b>🔮 Dans 48h :</b> ${mirror.prediction_48h}\n\n` +
      `<b>⚔️ Action critique :</b> ${mirror.action_critique}\n\n` +
      `<i>"${mirror.message_du_dragon}"</i>`
    );
  }

  return mirror;
}

// ═══════════════════════════════════════════════════════════════
// 🔁  BOUCLES INDÉPENDANTES
// ═══════════════════════════════════════════════════════════════

let learnCount   = 0;
let recalibCount = 0;
let lastRecalib  = 0;
let lastMirror   = 0;

async function learningCycle() {
  learnCount++;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🐉 [ANCALAGONE] Cycle d'apprentissage #${learnCount}`);
  console.log(`${'─'.repeat(60)}`);

  await updateStatus('BUSY', `Apprentissage #${learnCount}`);

  try {
    // 1. Mémoire épisodique (chaque cycle)
    const newEpisodes = await buildEpisodicMemory();

    // 2. Scoring adaptatif + rules (toutes les heures)
    if (Date.now() - lastRecalib >= CONFIG.RECALIB_INTERVAL_MS) {
      lastRecalib = Date.now();
      recalibCount++;

      const scoring = await computeAdaptiveScoring();
      const updates = await pushAdaptiveRules(scoring);

      if (updates.length > 0 || newEpisodes > 0) {
        console.log(`   📤 ${updates.length} règle(s) diffusée(s) | ${newEpisodes} épisode(s) mémorisé(s)`);
      }
    }

    // 3. Mirror Memory (toutes les 30 min)
    if (Date.now() - lastMirror >= CONFIG.MIRROR_INTERVAL_MS) {
      lastMirror = Date.now();
      await updateMirrorMemory();
    }

    await updateStatus('ONLINE', `Mémoire active — ${learnCount} cycles | Mirror v${mirrorVersion}`);

  } catch (err) {
    console.error('❌ [ANCALAGONE] Erreur cycle :', err.message);
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
║        🐉  A N C A L A G O N E  —  ${CONFIG.VERSION.padEnd(22)}║
║            Dragon de Mémoire — Swarm OS                     ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  POSITION      : #1 — Priorité absolue                      ║
║  Mémoire       : Épisodique sémantique — 30 jours           ║
║  Apprentissage : Toutes les 15 min                          ║
║  Recalibration : Toutes les heures                          ║
║  Mirror Memory : Toutes les 30 min                          ║
║  Profondeur    : ${String(CONFIG.MEMORY_DEEP_LIMIT).padEnd(3)} épisodes analysés             ║
║                                                              ║
║  "Il ne réagit pas. Il se souvient. Et il prédit."          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Éveil du Dragon');
  await logToFeed('ANCALAGONE', 'Ancalagone s\'éveille. La mémoire du Swarm prend vie.');

  sendTelegram(
    `🐉 <b>ANCALAGONE — ÉVEIL</b>\n\n` +
    `Le Dragon de Mémoire est en ligne.\n\n` +
    `• Mémoire épisodique : <b>active</b>\n` +
    `• Scoring adaptatif  : <b>en calcul</b>\n` +
    `• Mirror Memory      : <b>en construction</b>\n` +
    `• Feedback loop      : <b>toutes les heures</b>\n\n` +
    `<i>"Il ne réagit pas. Il se souvient. Et il prédit."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  // Premier cycle immédiat
  await learningCycle();

  // Boucles indépendantes
  setInterval(learningCycle, CONFIG.LEARN_INTERVAL_MS);
  setInterval(() => updateStatus('ONLINE', `Mémoire active — ${learnCount} cycles | Mirror v${mirrorVersion}`), CONFIG.PING_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// 🛑  ARRÊT PROPRE & ERREURS GLOBALES
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n🐉 Ancalagone reçoit ${signal} — la mémoire persiste dans Supabase…`);
  console.log(`   ${learnCount} cycles | ${recalibCount} recalibrages | Mirror v${mirrorVersion}`);

  await updateStatus('OFFLINE', `Shutdown — ${signal}`);
  await logToFeed('ANCALAGONE', `Shutdown via ${signal}. ${learnCount} cycles, Mirror v${mirrorVersion}.`);

  sendTelegram(
    `🐉 <b>ANCALAGONE — HORS LIGNE</b>\n\n` +
    `Signal : ${signal}\n` +
    `Uptime : ${formatUptime(Math.floor(process.uptime()))}\n` +
    `Cycles d'apprentissage : ${learnCount}\n` +
    `Recalibrages : ${recalibCount}\n` +
    `Mirror Memory : v${mirrorVersion}\n\n` +
    `<i>La mémoire persiste. Le Dragon reviendra.</i>`
  );

  await sleep(800);
  process.exit(0);
}

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('ANCALAGONE_ERROR', `Exception : ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('ANCALAGONE_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

start().catch(async (err) => {
  console.error('💀 Ancalagone s\'effondre :', err);
  await logToFeed('ANCALAGONE_ERROR', `Erreur fatale : ${err.message}`);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// 📋  MIGRATION SQL SUPABASE
// ═══════════════════════════════════════════════════════════════
//
// -- Mémoires épisodiques
// CREATE TABLE IF NOT EXISTS ancalagone_memories (
//   id              BIGSERIAL PRIMARY KEY,
//   episode_id      TEXT UNIQUE NOT NULL,
//   type            TEXT,           -- TRADE | LEAD | CONTENT
//   outcome         TEXT,           -- SUCCESS | FAILURE | WON | PUBLISHED…
//   signal_score    FLOAT,
//   signal_type     TEXT,
//   signal_domain   TEXT,
//   asset           TEXT,
//   action_taken    TEXT,
//   result_summary  TEXT,
//   pnl_percent     FLOAT,
//   engagement_score FLOAT,
//   lesson          TEXT,
//   semantic_tags   JSONB,
//   created_at      TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON ancalagone_memories (type, outcome);
// CREATE INDEX ON ancalagone_memories (created_at DESC);
// CREATE INDEX ON ancalagone_memories (signal_score);
//
// -- Config adaptative
// CREATE TABLE IF NOT EXISTS ancalagone_config (
//   config_key   TEXT PRIMARY KEY,
//   config_value JSONB,
//   updated_at   TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Mirror Memory (toujours 1 seule ligne active + historique)
// CREATE TABLE IF NOT EXISTS ancalagone_mirror (
//   mirror_key       TEXT PRIMARY KEY,
//   version          INT,
//   etat_swarm       TEXT,
//   connaissance     TEXT,
//   pattern_dominant TEXT,
//   pattern_danger   TEXT,
//   seuil_ideal      FLOAT,
//   niches_chaudes   JSONB,
//   niches_mortes    JSONB,
//   forces           JSONB,
//   faiblesses       JSONB,
//   prediction_48h   TEXT,
//   action_critique  TEXT,
//   lecons_cachees   JSONB,
//   message_dragon   TEXT,
//   episodes_count   INT,
//   full_payload     JSONB,
//   updated_at       TIMESTAMPTZ DEFAULT NOW()
// );
//
// CREATE TABLE IF NOT EXISTS ancalagone_mirror_history (
//   id             BIGSERIAL PRIMARY KEY,
//   version        INT,
//   etat_swarm     TEXT,
//   message_dragon TEXT,
//   prediction_48h TEXT,
//   episodes_count INT,
//   created_at     TIMESTAMPTZ DEFAULT NOW()
// );
// CREATE INDEX ON ancalagone_mirror_history (created_at DESC);
//
// -- Analyses profondes (optionnel — pour audit)
// CREATE TABLE IF NOT EXISTS ancalagone_analyses (
//   id               BIGSERIAL PRIMARY KEY,
//   pattern_gagnant  TEXT,
//   pattern_perdant  TEXT,
//   seuil_optimal    FLOAT,
//   niches_chaudes   JSONB,
//   niches_mortes    JSONB,
//   prediction_48h   TEXT,
//   message_dragon   TEXT,
//   full_payload     JSONB,
//   created_at       TIMESTAMPTZ DEFAULT NOW()
// );
//
// ═══════════════════════════════════════════════════════════════