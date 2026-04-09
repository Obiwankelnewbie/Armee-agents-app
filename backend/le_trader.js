// ═══════════════════════════════════════════════════════════════
//
//       ▄████████████████████████████████████████████▄
//       █                                            █
//       █          💹  L E  T R A D E R             █
//       █     Analyse IA · Signaux · Privé           █
//       █           Version  2.0                     █
//       █                                            █
//       ▀████████████████████████████████████████████▀
//
//   "Froid. Précis. Chirurgical. Il ne devine pas — il calcule."
//
//   ─────────────────────────────────────────────────────────────
//
//   ⚠️  USAGE STRICTEMENT PRIVÉ
//   Ces données ne transitent JAMAIS vers Nexo, Le Stratège
//   ou toute interface publique. Elles restent entre toi
//   et le Swarm. Visible uniquement sur le dashboard privé.
//
//   ─────────────────────────────────────────────────────────────
//
//   SES TROIS MODES :
//
//   📥  SIGNAL MODE (continu)
//       Traite les signaux CRYPTO routés par Le Général.
//       Applique le seuil calibré par Ancalagone.
//       Verdict BUY / WAIT / SKIP avec raisonnement.
//       Te notifie sur Telegram (canal privé).
//
//   🔭  SCAN MODE (toutes les 30 min)
//       Scan autonome : BTC, ETH, Base Network, altcoins.
//       Polymarket + marchés prédictifs.
//       Corrèle avec la macro (news routées par Le Général).
//
//   🧠  CALIBRATION MODE (lecture Ancalagone)
//       Lit le scoring adaptatif d'Ancalagone toutes les heures.
//       Ajuste son seuil EXECUTE dynamiquement.
//       Jamais de valeur hardcodée — toujours les données réelles.
//
//   ─────────────────────────────────────────────────────────────
//
//   SOURCES :
//     • Signaux filtrés de Le Général  (CRYPTO haute priorité)
//     • Scoring adaptatif d'Ancalagone (seuil recalibré)
//     • Scan autonome RSS/API crypto
//
//   OUTPUTS :
//     • private_trader_signals  (Supabase — privé)
//     • Telegram canal privé    (toi uniquement)
//     • executor_audit_log      (pour Ancalagone)
//     • Jamais vers le public   (règle absolue)
//
//   Version : 2.0 — Avril 2026
// ═══════════════════════════════════════════════════════════════

import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:   'AGENT-TRADER-01',
  AGENT_NAME: 'Le Trader',
  VERSION:    'v2.0',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3333',

  // Intervalles
  SIGNAL_INTERVAL_MS:  5  * 60_000,   // vérifie les signaux entrants toutes les 5 min
  SCAN_INTERVAL_MS:    30 * 60_000,   // scan autonome toutes les 30 min
  CALIB_INTERVAL_MS:   60 * 60_000,   // recalibration Ancalagone toutes les heures
  PING_INTERVAL_MS:    60_000,

  // Traitement
  SIGNAL_BATCH:        8,             // max signaux traités par cycle

  // Seuils (valeurs par défaut — écrasées par Ancalagone dès calibration)
  EXECUTE_THRESHOLD:   0.55,          // seuil minimum pour BUY
  HIGH_CONF_THRESHOLD: 0.72,          // seuil pour alerte immédiate
  SKIP_THRESHOLD:      0.35,          // en dessous → SKIP sans analyse

  // LLM
  LLM_TIMEOUT_MS:      25_000,
  LLM_RETRY_COUNT:     2,
  LLM_RETRY_DELAY_MS:  2_000,

  // Telegram
  TELEGRAM_COOLDOWN_MS: 400,

  // Sécurité
  MAX_SIGNALS_PER_HOUR: 20,           // anti-spam — pas plus de 20 signaux/heure
};

// Actifs surveillés en scan autonome
const WATCH_LIST = [
  { symbol: 'BTC',  name: 'Bitcoin',        network: 'bitcoin' },
  { symbol: 'ETH',  name: 'Ethereum',       network: 'ethereum' },
  { symbol: 'SOL',  name: 'Solana',         network: 'solana' },
  { symbol: 'BASE', name: 'Base Network',   network: 'base' },
  { symbol: 'BNB',  name: 'BNB Chain',      network: 'bsc' },
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

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h${String(m).padStart(2, '0')}`;
}

async function withRetry(fn, retries = CONFIG.LLM_RETRY_COUNT) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try { return await fn(); } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = CONFIG.LLM_RETRY_DELAY_MS * (attempt + 1) + Math.random() * 400;
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

async function logToFeed(type, message, metadata = {}) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message:    `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      metadata,
      run_id:     `TRADER-${Date.now()}`,
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
        execute_threshold: CONFIG.EXECUTE_THRESHOLD,
        signals_processed: signalsProcessed,
        buys_triggered:    buysTrigered,
        scan_count:        scanCount,
        calibrated_by:     'Ancalagone',
      },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 📱  TELEGRAM — canal PRIVÉ uniquement
// ═══════════════════════════════════════════════════════════════

const telegramQueue = [];
let telegramBusy    = false;

async function flushTelegram() {
  if (telegramBusy || telegramQueue.length === 0) return;
  telegramBusy = true;

  while (telegramQueue.length > 0) {
    const msg    = telegramQueue.shift();
    const token  = process.env.TELEGRAM_BOT_TOKEN;
    // Canal privé séparé si disponible — sinon fallback sur le canal principal
    const chatId = process.env.TELEGRAM_PRIVATE_CHAT_ID ?? process.env.TELEGRAM_CHAT_ID;

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
        console.error('   ❌ Telegram Trader :', e.message);
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
// 🧠  APPEL LLM
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
      const raw    = data?.text ?? data?.response ?? '';
      const parsed = safeJsonParse(raw);

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
//
//   🧠  CALIBRATION — Lit les seuils d'Ancalagone
//
//   Le seuil EXECUTE n'est jamais hardcodé.
//   Ancalagone le recalcule sur les trades réels.
//   Le Trader s'aligne automatiquement.
//
// ═══════════════════════════════════════════════════════════════

let lastCalib   = 0;
let calibSource = 'default';

async function readAncalagoneCalibration() {
  if (Date.now() - lastCalib < CONFIG.CALIB_INTERVAL_MS) return;
  lastCalib = Date.now();

  try {
    const { data } = await supabase
      .from('ancalagone_config')
      .select('config_value')
      .eq('config_key', 'ADAPTIVE_SCORING')
      .maybeSingle();

    if (!data?.config_value) return;

    const scoring = data.config_value;
    const newThreshold = scoring?.trading?.optimal_threshold;

    if (newThreshold && typeof newThreshold === 'number' && newThreshold > 0 && newThreshold < 1) {
      const old = CONFIG.EXECUTE_THRESHOLD;
      CONFIG.EXECUTE_THRESHOLD = newThreshold;
      calibSource = 'Ancalagone';

      if (Math.abs(newThreshold - old) >= 0.01) {
        const dir = newThreshold > old ? '↑ plus sélectif' : '↓ plus permissif';
        console.log(`   🎯 Seuil recalibré par Ancalagone : ${old.toFixed(3)} → ${newThreshold.toFixed(3)} (${dir})`);
        await logToFeed('TRADER', `Seuil recalibré : ${old.toFixed(3)} → ${newThreshold.toFixed(3)} (${dir})`);
      }
    }

    // Lit aussi les event_types gagnants/perdants
    const winningEvents = scoring?.trading?.winning_events ?? [];
    const losingEvents  = scoring?.trading?.losing_events  ?? [];

    if (winningEvents.length || losingEvents.length) {
      console.log(`   ✅ Event types gagnants : ${winningEvents.join(', ')}`);
      console.log(`   ❌ Event types perdants : ${losingEvents.join(', ')}`);
    }

  } catch (err) {
    console.warn(`   ⚠️  Calibration Ancalagone échouée : ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
//
//   📥  MODE 1 — SIGNAL MODE
//
//   Traite les signaux CRYPTO validés par Le Général.
//   Chaque signal a déjà un score — le Trader approfondit.
//   Verdict final : BUY / WAIT / SKIP.
//
// ═══════════════════════════════════════════════════════════════

const SIGNAL_ANALYSIS_PROMPT = `Tu es Le Trader privé d'un swarm IA.
Tu reçois un signal crypto déjà filtré et scoré.
Ta mission : analyse approfondie et verdict final.
Ton ton est froid, précis, chirurgical.

SEUIL EXECUTE ACTUEL : ${CONFIG.EXECUTE_THRESHOLD}

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "verdict": "BUY | WAIT | SKIP",
  "asset": "BTC | ETH | SOL | BASE | OTHER",
  "confidence": "HIGH | MEDIUM | LOW",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "entry_rationale": "Pourquoi entrer — ou null si SKIP",
  "risk_rationale": "Risques principaux à surveiller",
  "time_horizon": "SCALP(1-4h) | SHORT(4-24h) | SWING(1-7j) | null",
  "invalidation": "Ce qui invaliderait ce setup",
  "base_network_angle": "Opportunité spécifique sur Base Network — ou null",
  "confidence_adjusted": 0.00,
  "priority_score": 0.00
}
RÈGLES STRICTES :
- BUY uniquement si confidence_adjusted >= SEUIL EXECUTE ACTUEL
- WAIT si signal intéressant mais timing incertain
- SKIP si signal faible, trop tardif ou risque > reward
- Jamais de biais haussier — sois contra si les données le justifient`;

const signalHourBucket = new Map(); // anti-spam par heure
let signalsProcessed   = 0;
let buysTrigered       = 0;

async function runSignalMode() {
  // Lit la calibration Ancalagone
  await readAncalagoneCalibration();

  // Anti-spam — max signaux par heure
  const hourKey = new Date().toISOString().slice(0, 13);
  const hourCount = signalHourBucket.get(hourKey) ?? 0;
  if (hourCount >= CONFIG.MAX_SIGNALS_PER_HOUR) {
    console.log(`   ⏳ [TRADER] Limite horaire atteinte (${hourCount}) — pause`);
    return;
  }

  // Récupère les signaux CRYPTO non traités
  const { data: briefings } = await supabase
    .from('agent_briefings')
    .select('*')
    .eq('target_agent', CONFIG.AGENT_ID)
    .eq('processed', false)
    .order('priority', { ascending: false }) // URGENT d'abord
    .order('created_at', { ascending: true })
    .limit(CONFIG.SIGNAL_BATCH);

  if (!briefings?.length) return;

  console.log(`\n📥 [TRADER] ${briefings.length} signal(s) entrant(s) — seuil: ${CONFIG.EXECUTE_THRESHOLD.toFixed(3)} (${calibSource})`);

  for (const briefing of briefings) {
    const signal = safeJsonParse(briefing.content);
    if (!signal) {
      await markProcessed(briefing.id, 'Payload illisible');
      continue;
    }

    // Extrait le score du signal
    const score = signal.impact_score ?? signal.confidence_adjusted ?? signal.priority_score ?? 0;

    // SKIP rapide sans LLM si score trop bas
    if (score < CONFIG.SKIP_THRESHOLD) {
      console.log(`   ⚫ Score ${score.toFixed(2)} < ${CONFIG.SKIP_THRESHOLD} — SKIP rapide`);
      await markProcessed(briefing.id, `Score trop bas : ${score.toFixed(2)}`);
      signalsProcessed++;
      signalHourBucket.set(hourKey, (signalHourBucket.get(hourKey) ?? 0) + 1);
      continue;
    }

    // Analyse LLM approfondie
    const dynamicPrompt = SIGNAL_ANALYSIS_PROMPT.replace(
      'SEUIL EXECUTE ACTUEL : ' + CONFIG.EXECUTE_THRESHOLD,
      `SEUIL EXECUTE ACTUEL : ${CONFIG.EXECUTE_THRESHOLD.toFixed(3)}`
    );

    const analysis = await callLLM(
      dynamicPrompt,
      JSON.stringify({
        signal,
        current_threshold: CONFIG.EXECUTE_THRESHOLD,
        signal_score:      score,
        event_type:        signal.event_type,
        asset:             signal.asset,
        urgency:           signal.urgency,
        briefing:          signal.briefing,
        source:            signal.source ?? briefing.source_agent,
      }),
      'SIGNAL'
    );

    if (!analysis) {
      await markProcessed(briefing.id, 'Analyse LLM échouée');
      continue;
    }

    signalsProcessed++;
    signalHourBucket.set(hourKey, (signalHourBucket.get(hourKey) ?? 0) + 1);

    const icon = analysis.verdict === 'BUY' ? '🟢' : analysis.verdict === 'WAIT' ? '🟡' : '⚫';
    console.log(`   ${icon} [${analysis.verdict}] ${analysis.asset} — conf: ${analysis.confidence} | risk: ${analysis.risk_level}`);
    if (analysis.entry_rationale) console.log(`      ↳ ${analysis.entry_rationale}`);

    // Persistance dans private_trader_signals
    await supabase.from('private_trader_signals').insert([{
      agent_id:           CONFIG.AGENT_ID,
      source:             'SIGNAL_MODE',
      market:             signal.domain ?? 'CRYPTO',
      asset:              analysis.asset,
      opportunity:        signal.briefing ?? signal.opportunity ?? '',
      analysis:           analysis.entry_rationale ?? analysis.risk_rationale,
      verdict:            analysis.verdict,
      confidence:         analysis.confidence,
      confidence_score:   analysis.confidence_adjusted,
      risk_level:         analysis.risk_level,
      time_horizon:       analysis.time_horizon,
      invalidation:       analysis.invalidation,
      base_angle:         analysis.base_network_angle,
      original_score:     score,
      threshold_used:     CONFIG.EXECUTE_THRESHOLD,
      calibrated_by:      calibSource,
      signal_payload:     signal,
      scanned_at:         new Date().toISOString(),
    }]).catch(() => {});

    // Log pour Ancalagone (feedback loop)
    await supabase.from('executor_audit_log').insert([{
      agent_id:    CONFIG.AGENT_ID,
      task_type:   analysis.verdict,
      status:      'PENDING',
      signal_score: score,
      result_summary: JSON.stringify({
        verdict:    analysis.verdict,
        asset:      analysis.asset,
        confidence: analysis.confidence,
        risk:       analysis.risk_level,
      }),
      executed_at: new Date().toISOString(),
    }]).catch(() => {});

    // Notification Telegram si BUY ou signal fort
    if (analysis.verdict === 'BUY') {
      buysTrigered++;
      const urgence = analysis.confidence === 'HIGH' ? '🔴 URGENT' : '🟡 SIGNAL';

      sendTelegram(
        `💹 <b>TRADER — ${urgence}</b>\n\n` +
        `<b>${analysis.verdict}</b> · ${analysis.asset} · ${analysis.time_horizon ?? 'N/A'}\n\n` +
        `<b>📊 Signal :</b> ${signal.briefing ?? ''}\n` +
        `<b>💡 Rationale :</b> ${analysis.entry_rationale}\n\n` +
        `<b>⚠️ Risques :</b> ${analysis.risk_rationale}\n` +
        `<b>❌ Invalidation :</b> ${analysis.invalidation}\n\n` +
        (analysis.base_network_angle ? `<b>🔵 Base :</b> ${analysis.base_network_angle}\n\n` : '') +
        `Score signal : ${score.toFixed(2)} | Seuil : ${CONFIG.EXECUTE_THRESHOLD.toFixed(2)}\n` +
        `Conf: ${analysis.confidence} | Risk: ${analysis.risk_level}`
      );
    } else if (score >= CONFIG.HIGH_CONF_THRESHOLD) {
      // Signal fort mais pas BUY — WAIT notable
      sendTelegram(
        `💹 <b>TRADER — WATCH</b>\n\n` +
        `<b>${analysis.verdict}</b> · ${analysis.asset}\n` +
        `Score : ${score.toFixed(2)} — <i>${analysis.risk_rationale}</i>\n\n` +
        `<i>Invalidation : ${analysis.invalidation}</i>`
      );
    }

    await markProcessed(briefing.id, `${analysis.verdict} — ${analysis.confidence}`);
    await logToFeed('TRADER', `[${analysis.verdict}] ${analysis.asset} — score ${score.toFixed(2)} — ${analysis.confidence}`);
    await sleep(500);
  }
}

// ═══════════════════════════════════════════════════════════════
//
//   🔭  MODE 2 — SCAN AUTONOME (toutes les 30 min)
//
//   Scan indépendant des sources Argus.
//   Analyse BTC, ETH, SOL, Base, Polymarket.
//   Corrèle avec les news macro récentes.
//
// ═══════════════════════════════════════════════════════════════

const SCAN_PROMPT = `Tu es Le Trader privé d'un swarm IA.
Tu fais un scan autonome des marchés crypto et prédictifs.
Ton ton est froid, précis, chirurgical. Pas de biais.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "scan_timestamp": "ISO timestamp",
  "market_sentiment": "BULLISH | BEARISH | NEUTRAL | UNCERTAIN",
  "dominant_narrative": "La narrative dominante du marché en ce moment",
  "opportunities": [
    {
      "asset": "BTC | ETH | SOL | BASE | OTHER",
      "verdict": "BUY | WAIT | SKIP",
      "setup": "Description du setup technique/fondamental",
      "confidence": "HIGH | MEDIUM | LOW",
      "risk": "LOW | MEDIUM | HIGH",
      "horizon": "SCALP | SHORT | SWING",
      "score": 0.00
    }
  ],
  "macro_correlation": "Impact des news macro sur le marché crypto",
  "base_network_watch": "Opportunité ou risque spécifique sur Base Network",
  "polymarket_signal": "Signal Polymarket pertinent — ou null",
  "risk_global": "LOW | MEDIUM | HIGH | CRITICAL",
  "conseil_prive": "Observation privée et non-évidente pour le trader"
}`;

let lastScan  = 0;
let scanCount = 0;

async function runAutonomousScan() {
  if (Date.now() - lastScan < CONFIG.SCAN_INTERVAL_MS) return;
  lastScan = Date.now();
  scanCount++;

  console.log(`\n🔭 [TRADER] Scan autonome #${scanCount}…`);

  // Lit les news macro récentes (routées par Le Général depuis Argus)
  const since2h = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
  const { data: macroNews } = await supabase
    .from('agent_briefings')
    .select('content, domain, created_at')
    .eq('source_agent', 'AGENT-GENERAL-01')
    .in('domain', ['NEWS', 'CRYPTO'])
    .gte('created_at', since2h)
    .order('created_at', { ascending: false })
    .limit(5);

  // Lit la Mirror Memory d'Ancalagone pour le contexte
  const { data: mirror } = await supabase
    .from('ancalagone_mirror')
    .select('pattern_dominant, prediction_48h, niches_chaudes')
    .eq('mirror_key', 'CURRENT')
    .maybeSingle();

  const context = {
    timestamp:       new Date().toISOString(),
    watchlist:       WATCH_LIST.map(a => a.symbol),
    execute_threshold: CONFIG.EXECUTE_THRESHOLD,
    calibrated_by:   calibSource,
    macro_context:   (macroNews ?? [])
      .map(b => safeJsonParse(b.content)?.briefing ?? '')
      .filter(Boolean)
      .slice(0, 5),
    ancalagone_view: mirror ? {
      pattern:    mirror.pattern_dominant,
      prediction: mirror.prediction_48h,
    } : null,
  };

  const scan = await callLLM(SCAN_PROMPT, JSON.stringify(context), 'SCAN');
  if (!scan) return;

  console.log(`   📊 Sentiment : ${scan.market_sentiment}`);
  console.log(`   📰 Narrative : ${scan.dominant_narrative}`);
  console.log(`   ⚠️  Risque global : ${scan.risk_global}`);

  const buys = (scan.opportunities ?? []).filter(o => o.verdict === 'BUY');
  const waits = (scan.opportunities ?? []).filter(o => o.verdict === 'WAIT');

  for (const opp of scan.opportunities ?? []) {
    const icon = opp.verdict === 'BUY' ? '🟢' : opp.verdict === 'WAIT' ? '🟡' : '⚫';
    console.log(`   ${icon} ${opp.asset} — [${opp.verdict}] ${opp.setup?.slice(0, 60)}…`);
  }

  // Persistance
  await supabase.from('private_trader_signals').insert([{
    agent_id:         CONFIG.AGENT_ID,
    source:           'AUTONOMOUS_SCAN',
    market:           'MULTI',
    asset:            'SCAN',
    opportunity:      scan.dominant_narrative,
    analysis:         scan.conseil_prive,
    verdict:          scan.market_sentiment,
    confidence:       scan.risk_global === 'LOW' ? 'HIGH' : 'MEDIUM',
    risk_level:       scan.risk_global,
    base_angle:       scan.base_network_watch,
    signal_payload:   scan,
    scanned_at:       new Date().toISOString(),
  }]).catch(() => {});

  await logToFeed('TRADER', `Scan #${scanCount} — ${scan.market_sentiment} — ${buys.length} BUY / ${waits.length} WAIT`);

  // Telegram si opportunités ou risque élevé
  if (buys.length > 0 || scan.risk_global === 'CRITICAL' || scan.risk_global === 'HIGH') {
    const oppLines = (scan.opportunities ?? [])
      .filter(o => ['BUY', 'WAIT'].includes(o.verdict))
      .map(o => {
        const icon = o.verdict === 'BUY' ? '🟢' : '🟡';
        return `${icon} <b>${o.asset}</b> [${o.verdict}] — ${o.confidence} conf — ${o.horizon}\n   <i>${o.setup?.slice(0, 80)}</i>`;
      })
      .join('\n\n');

    sendTelegram(
      `💹 <b>TRADER — SCAN #${scanCount}</b>\n\n` +
      `Sentiment : <b>${scan.market_sentiment}</b> | Risque : <b>${scan.risk_global}</b>\n` +
      `<i>${scan.dominant_narrative}</i>\n\n` +
      (oppLines ? `<b>Opportunités :</b>\n${oppLines}\n\n` : '') +
      (scan.base_network_watch ? `<b>🔵 Base :</b> ${scan.base_network_watch}\n\n` : '') +
      (scan.polymarket_signal ? `<b>📊 Polymarket :</b> ${scan.polymarket_signal}\n\n` : '') +
      `<i>🔒 ${scan.conseil_prive}</i>`
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔧  MARK PROCESSED
// ═══════════════════════════════════════════════════════════════

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

let mainCycles = 0;

async function mainLoop() {
  mainCycles++;

  try {
    await updateStatus('BUSY', `Cycle #${mainCycles}`);

    // 1. Signal Mode — traite les signaux Général
    await runSignalMode();

    // 2. Scan autonome — toutes les 30 min
    await runAutonomousScan();

    await updateStatus('ONLINE',
      `Veille — ${signalsProcessed} signaux | ${buysTrigered} BUY | seuil: ${CONFIG.EXECUTE_THRESHOLD.toFixed(3)}`
    );

    console.log(
      `💹 [TRADER] Cycle #${mainCycles} | ` +
      `Signaux: ${signalsProcessed} | BUY: ${buysTrigered} | ` +
      `Seuil: ${CONFIG.EXECUTE_THRESHOLD.toFixed(3)} (${calibSource})`
    );

  } catch (err) {
    console.error('❌ [TRADER] Erreur boucle :', err.message);
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
║         💹  L E  T R A D E R  —  ${CONFIG.VERSION.padEnd(22)}║
║         Analyse IA · Signaux · PRIVÉ                        ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ⚠️  USAGE STRICTEMENT PRIVÉ — Dashboard uniquement         ║
║                                                              ║
║  Signal Mode  : toutes les 5 min (signaux Général)          ║
║  Scan Auto    : toutes les 30 min                           ║
║  Calibration  : toutes les heures (Ancalagone)              ║
║  Seuil init   : ${String(CONFIG.EXECUTE_THRESHOLD).padEnd(43)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Activation Le Trader');
  await logToFeed('TRADER', 'Le Trader entre en position. Mode privé actif.');

  sendTelegram(
    `💹 <b>LE TRADER — EN LIGNE</b>\n\n` +
    `⚠️ <i>Canal privé — usage strictement personnel</i>\n\n` +
    `• Signal Mode  : toutes les 5 min\n` +
    `• Scan Auto    : toutes les 30 min\n` +
    `• Seuil init   : ${CONFIG.EXECUTE_THRESHOLD}\n` +
    `• Calibration  : Ancalagone (auto)\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  await mainLoop();
  setInterval(mainLoop, CONFIG.SIGNAL_INTERVAL_MS);
  setInterval(() => updateStatus('ONLINE', `Veille — Cycle #${mainCycles}`), CONFIG.PING_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// 🛑  ARRÊT PROPRE
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n💹 Le Trader reçoit ${signal} — clôture des positions…`);
  await updateStatus('OFFLINE', `Shutdown — ${signal}`);
  await logToFeed('TRADER', `Shutdown via ${signal}. ${signalsProcessed} signaux, ${buysTrigered} BUY, ${scanCount} scans.`);

  sendTelegram(
    `💹 <b>LE TRADER — HORS LIGNE</b>\n\n` +
    `Signal : ${signal}\n` +
    `Uptime : ${formatUptime(Math.floor(process.uptime()))}\n` +
    `Signaux traités : ${signalsProcessed}\n` +
    `BUY déclenchés : ${buysTrigered}\n` +
    `Scans autonomes : ${scanCount}\n` +
    `Seuil final : ${CONFIG.EXECUTE_THRESHOLD.toFixed(3)} (${calibSource})`
  );

  await sleep(800);
  process.exit(0);
}

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('TRADER_ERROR', `Exception : ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('TRADER_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
  start().catch(async (err) => {
    console.error('💀 Le Trader s\'effondre :', err);
    await logToFeed('TRADER_ERROR', `Erreur fatale : ${err.message}`);
    process.exit(1);
  });
}

module.exports = { mainLoop, runSignalMode, runAutonomousScan };

// ═══════════════════════════════════════════════════════════════
// 📋  MIGRATION SQL SUPABASE
// ═══════════════════════════════════════════════════════════════
//
// -- Table signaux privés (enrichie)
// CREATE TABLE IF NOT EXISTS private_trader_signals (
//   id                BIGSERIAL PRIMARY KEY,
//   agent_id          TEXT,
//   source            TEXT,           -- SIGNAL_MODE | AUTONOMOUS_SCAN
//   market            TEXT,
//   asset             TEXT,
//   opportunity       TEXT,
//   analysis          TEXT,
//   verdict           TEXT,           -- BUY | WAIT | SKIP | BULLISH | BEARISH…
//   confidence        TEXT,
//   confidence_score  FLOAT,
//   risk_level        TEXT,
//   time_horizon      TEXT,
//   invalidation      TEXT,
//   base_angle        TEXT,
//   original_score    FLOAT,
//   threshold_used    FLOAT,
//   calibrated_by     TEXT,
//   signal_payload    JSONB,
//   scanned_at        TIMESTAMPTZ DEFAULT NOW()
// );
