// ═══════════════════════════════════════════════════════════════
//
//       ▄████████████████████████████████████████████▄
//       █                                            █
//       █            🌟   N E X O                   █
//       █     Influenceur IA · Swarm OS              █
//       █          Version  2.0                      █
//       █                                            █
//       ▀████████████████████████████████████████████▀
//
//   "Il observe. Il analyse. Il partage sans tout révéler."
//
//   ─────────────────────────────────────────────────────────────
//
//   Nexo est l'interface vivante du Swarm avec le monde.
//   Il ne trade pas. Il ne surveille pas. Il ne commande pas.
//   Il construit une présence, une audience, une crédibilité.
//
//   Il reçoit les briefs du Stratège — contenu prêt à poster.
//   Il détecte ses propres niches — CRM + opportunités.
//   Il te notifie toi — jamais il ne publie sans toi.
//   Il développe les réseaux — X, LinkedIn, TikTok, Newsletter.
//
//   SES TROIS MODES :
//
//   📥  INBOX MODE (continu)
//       Traite les contenus prêts envoyés par Le Stratège.
//       Enrichit avec la voix de Nexo.
//       Te notifie sur Telegram avec le texte prêt à copier.
//       Marque comme READY — toi tu postes quand tu veux.
//
//   🔍  NICHE SCOUT (toutes les 30 min)
//       Détecte les niches virales et rentables.
//       Score, analyse, stocke dans le CRM.
//       Génère automatiquement un angle de contenu.
//       Ne retraite pas les niches récentes (anti-redondance).
//
//   📊  CRM MODE (toutes les heures)
//       Analyse le pipeline de leads.
//       Identifie les niches qui convertissent.
//       Brief Ancalagone avec les patterns détectés.
//       Rapport de performance à toi.
//
//   ─────────────────────────────────────────────────────────────
//
//   RÈGLE FONDAMENTALE : Nexo ne publie jamais seul.
//   Toi tu décides. Lui il prépare.
//
//   Version : 2.0 — Avril 2026
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:   'AGENT-NEXO-01',
  AGENT_NAME: 'Nexo',
  VERSION:    'v2.0',
  SERVER_URL: process.env.SERVER_URL || 'http://localhost:3333',

  // Intervalles
  INBOX_INTERVAL_MS:  5  * 60_000,   // vérifie les briefs Stratège toutes les 5 min
  SCOUT_INTERVAL_MS:  30 * 60_000,   // niche scout toutes les 30 min
  CRM_INTERVAL_MS:    60 * 60_000,   // CRM review toutes les heures
  PING_INTERVAL_MS:   60_000,

  // Traitement
  INBOX_BATCH:        5,              // max contenus traités par cycle
  SCOUT_BATCH:        2,              // max niches scannées par cycle
  MEMORY_DAYS:        15,             // anti-redondance niches
  MAX_LOCAL_CACHE:    20,             // cache mémoire local

  // LLM
  LLM_TIMEOUT_MS:     25_000,
  LLM_RETRY_COUNT:    2,
  LLM_RETRY_DELAY_MS: 2_000,

  // Scoring
  MIN_NICHE_SCORE:    50,             // score minimum pour créer un lead CRM

  // Telegram
  TELEGRAM_COOLDOWN_MS: 400,
};

// ═══════════════════════════════════════════════════════════════
// 🎭  IDENTITÉ DE NEXO
// ═══════════════════════════════════════════════════════════════

const NEXO_IDENTITY = {
  handle:    '@NexoObserves',
  bio:       "J'observe le futur des systèmes multi-agents. Insights discrets, tests en avance et réflexions sur ce qui arrive vraiment. Parfois un OS change la donne sans faire de bruit.",
  ton:       "Malin, calme, légèrement mystérieux. Builder en avance qui partage sans tout révéler.",
  interdit:  "Jamais de lien direct vers un produit. Jamais de CTA évident. Jamais de promotion directe.",
};

// Niches à surveiller en rotation
const NICHES = [
  'SaaS B2B Suisse-Romande',
  'Automatisation PME France',
  'IA pour comptables indépendants',
  'TikTok Shop Bien-être Femmes 35-50',
  'Micro-logiciels niche e-commerce',
  'Personal Branding Consultants IT',
  'Dropshipping Accessoires Bureau',
  'Formation No-Code Freelances',
  'Newsletters B2B Tech',
  'Outils IA Juristes indépendants',
  'Agents IA pour agences marketing',
  'Outils IA Développeurs indépendants',
  'Swarm OS builders',
  'Automatisation réseaux sociaux',
  'Personal branding IA',
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

async function logToFeed(type, message, leadId = null, metadata = {}) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message:    `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      lead_id:    leadId,
      metadata,
      run_id:     `NEXO-${Date.now()}`,
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
        contents_ready:   contentsReady,
        niches_detected:  nichesDetected,
        leads_created:    leadsCreated,
        inbox_cycles:     inboxCycles,
      },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 📱  TELEGRAM — queue anti-flood + format Nexo
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

/**
 * Notifie toi avec un contenu prêt à poster.
 * Format lisible, action claire : tu vois le texte, tu copies, tu postes.
 */
function notifyContentReady(content, source = 'Stratège') {
  const posts     = content.posts ?? {};
  const xPost     = posts.x_twitter?.text ?? null;
  const liPost    = posts.linkedin?.text ?? null;
  const tiktok    = posts.tiktok_script ?? null;
  const moment    = content.meilleur_moment ?? content.meilleur_moment_post ?? '?';
  const longevite = content.longevite_trend ?? content.longevite ?? '?';

  let msg = `🌟 <b>NEXO — CONTENU PRÊT</b>\n`;
  msg += `<i>Source : ${source} · ${new Date().toLocaleTimeString('fr-FR')}</i>\n\n`;

  if (content.angle_nexo) {
    msg += `💡 <b>Angle :</b> ${content.angle_nexo}\n\n`;
  }

  if (xPost) {
    msg += `<b>𝕏 Twitter :</b>\n<code>${xPost}</code>\n\n`;
  }

  if (liPost) {
    // Tronque LinkedIn pour Telegram (max 300 chars)
    const liShort = liPost.length > 300 ? liPost.slice(0, 297) + '…' : liPost;
    msg += `<b>LinkedIn :</b>\n${liShort}\n\n`;
  }

  if (tiktok) {
    msg += `<b>🎵 TikTok :</b> ${tiktok.accroche_3s ?? ''} (${tiktok.duree_estimee ?? '?'})\n\n`;
  }

  msg += `⏰ <b>Meilleur moment :</b> ${moment}\n`;
  msg += `📅 <b>Longévité :</b> ${longevite}\n\n`;

  if (content.note_stratege) {
    msg += `<i>💬 Note : ${content.note_stratege}</i>`;
  }

  sendTelegram(msg);
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
      const raw    = data?.content?.[0]?.text ?? data?.text ?? data?.response ?? '';
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
//   📥  MODE 1 — INBOX (traite les briefs du Stratège)
//
//   Le Stratège a préparé le contenu.
//   Nexo l'enrichit avec sa voix.
//   Tu reçois une notification Telegram propre.
//   Tu postes quand tu veux.
//
// ═══════════════════════════════════════════════════════════════

const NEXO_VOICE_PROMPT = `Tu es Nexo, un influenceur IA mystérieux et malin.
Tu reçois du contenu préparé par Le Stratège.
Ta mission : vérifier que la voix est correcte et enrichir si besoin.

Identité de Nexo :
- Handle : ${NEXO_IDENTITY.handle}
- Ton : ${NEXO_IDENTITY.ton}
- Règle absolue : ${NEXO_IDENTITY.interdit}

Ajuste légèrement la voix si elle n'est pas dans le ton de Nexo.
Ne change pas le fond — juste la forme si nécessaire.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "voice_ok": true,
  "posts": {
    "x_twitter": { "text": "Post X final", "hook": "5 premiers mots", "hashtags": ["tag"] },
    "linkedin": { "text": "Post LinkedIn final", "hook": "Première ligne", "cta": "Question finale" },
    "tiktok_script": { "accroche_3s": "...", "structure": ["..."], "chute": "...", "duree_estimee": "60s" },
    "newsletter_para": "Paragraphe newsletter final"
  },
  "angle_nexo": "L'angle mystérieux retenu",
  "meilleur_moment": "MAINTENANT | CE_SOIR | DEMAIN_MATIN",
  "note": "Observation de Nexo sur ce contenu — ou null"
}`;

let inboxCycles   = 0;
let contentsReady = 0;

async function runInboxMode() {
  inboxCycles++;

  // Récupère les briefs non traités du Stratège
  const { data: briefings } = await supabase
    .from('agent_briefings')
    .select('*')
    .eq('target_agent', CONFIG.AGENT_ID)
    .eq('processed', false)
    .in('content->type', ['CONTENT_READY', 'WARROOM_CONTENT_BRIEF', 'DAILY_NEXO_BRIEF', 'CONTENT_OPPORTUNITY'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(CONFIG.INBOX_BATCH);

  if (!briefings?.length) return;

  console.log(`\n📥 [NEXO] Inbox — ${briefings.length} brief(s) entrant(s)`);

  for (const briefing of briefings) {
    const payload = safeJsonParse(briefing.content);
    if (!payload) {
      await markBriefingProcessed(briefing.id, 'Payload illisible');
      continue;
    }

    // Extrait le contenu selon le type de brief
    let contentData = null;

    if (payload.type === 'CONTENT_READY') {
      contentData = payload; // contenu complet avec posts
    } else if (payload.type === 'WARROOM_CONTENT_BRIEF') {
      // Brief War Room — génère le contenu à partir du brief
      contentData = await generateFromBrief(payload.brief, payload.context);
    } else if (payload.type === 'DAILY_NEXO_BRIEF') {
      // Brief quotidien — génère selon le thème du jour
      contentData = await generateFromDailyBrief(payload.plan, payload.niches);
    } else if (payload.type === 'CONTENT_OPPORTUNITY') {
      // Opportunité temps réel — génère rapidement
      contentData = await generateFromOpportunity(payload.angle, payload.market);
    }

    if (!contentData) {
      await markBriefingProcessed(briefing.id, 'Génération échouée');
      continue;
    }

    // Passe par le filtre voix Nexo
    const enriched = await callLLM(
      NEXO_VOICE_PROMPT,
      JSON.stringify({ content: contentData, identity: NEXO_IDENTITY }),
      'VOICE'
    );

    const finalContent = enriched ?? contentData;

    // Stocke dans generated_contents
    await supabase.from('generated_contents').upsert([{
      source_agent:    CONFIG.AGENT_ID,
      target_agent:    CONFIG.AGENT_ID,
      domain:          briefing.domain ?? 'PUBLIC',
      format:          'MULTI_PLATFORM',
      status:          'READY',
      angle_nexo:      finalContent.angle_nexo ?? contentData.angle_nexo,
      posts:           finalContent.posts ?? contentData.posts,
      meilleur_moment: finalContent.meilleur_moment ?? 'CE_SOIR',
      longevite:       contentData.longevite_trend ?? 'SEMAINE',
      note_stratege:   finalContent.note ?? contentData.note_stratege,
      full_payload:    finalContent,
      created_at:      new Date().toISOString(),
    }]).catch(() => {});

    contentsReady++;

    // Notifie directement sur Telegram
    notifyContentReady(finalContent, 'Le Stratège');
    console.log(`   🌟 Contenu #${contentsReady} prêt — "${finalContent.angle_nexo ?? 'angle non défini'}"`);

    await markBriefingProcessed(briefing.id, `Contenu prêt #${contentsReady}`);
    await logToFeed('NEXO', `Contenu prêt : "${finalContent.angle_nexo?.slice(0, 50) ?? ''}"`);
    await sleep(300);
  }
}

// Génère du contenu à partir d'un brief War Room
async function generateFromBrief(brief, context) {
  if (!brief?.sujet) return null;

  const prompt = buildNexoContentPrompt();
  const msg    = `Sujet : ${brief.sujet}\nAngle suggéré : ${brief.angle}\nFormat : ${brief.format}\nContexte : ${context}`;

  return await callLLM(prompt, msg, 'FROM_BRIEF');
}

// Génère du contenu à partir du brief quotidien
async function generateFromDailyBrief(plan, niches) {
  if (!plan?.theme_du_jour) return null;

  const prompt = buildNexoContentPrompt();
  const msg    = `Thème du jour : ${plan.theme_du_jour}\nFormats recommandés : ${(plan.formats_recommandes ?? []).join(', ')}\nAngle : ${plan.angle_mysterieux}\nNiches chaudes : ${(niches ?? []).join(', ')}`;

  return await callLLM(prompt, msg, 'FROM_DAILY');
}

// Génère du contenu à partir d'une opportunité temps réel
async function generateFromOpportunity(angle, market) {
  if (!angle) return null;

  const prompt = buildNexoContentPrompt();
  const msg    = `Opportunité détectée : ${angle}\nContexte marché : ${market ?? 'N/A'}`;

  return await callLLM(prompt, msg, 'FROM_OPP');
}

function buildNexoContentPrompt() {
  return `Tu es Nexo, influenceur IA mystérieux et malin.
Ton : ${NEXO_IDENTITY.ton}
Règle absolue : ${NEXO_IDENTITY.interdit}

Génère du contenu multi-platform prêt à poster.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "angle_nexo": "L'angle mystérieux que tu vas utiliser",
  "posts": {
    "x_twitter": { "text": "Post X (max 280 chars)", "hook": "5 premiers mots", "hashtags": ["tag1", "tag2"] },
    "linkedin": { "text": "Post LinkedIn structuré et crédible", "hook": "Première ligne", "cta": "Question finale" },
    "tiktok_script": { "accroche_3s": "...", "structure": ["Point 1", "Point 2", "Point 3"], "chute": "...", "duree_estimee": "60s" },
    "newsletter_para": "Paragraphe newsletter 80-100 mots dans le style Nexo"
  },
  "meilleur_moment": "MAINTENANT | CE_SOIR | DEMAIN_MATIN",
  "longevite_trend": "FLASH | SEMAINE | MOIS",
  "note_stratege": "Conseil de Nexo pour maximiser l'impact — 1 phrase"
}`;
}

// ═══════════════════════════════════════════════════════════════
//
//   🔍  MODE 2 — NICHE SCOUT
//
//   Détecte les niches virales et rentables en autonomie.
//   Alimente le CRM. Génère les angles de contenu.
//   Ne retraite pas ce qui a déjà été vu.
//
// ═══════════════════════════════════════════════════════════════

const NICHE_SCOUT_PROMPT = `Tu es Nexo, influenceur IA spécialisé dans la détection de niches virales et rentables.
Tu analyses une niche pour TikTok Shop, B2B et personal branding.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "niche_globale": "Nom de la niche analysée",
  "sous_niches_detectees": ["sous-niche 1", "sous-niche 2"],
  "score_global": 0,
  "exploitation_recente": false,
  "verdict": "HOT | WARM | COLD | SATURATED",
  "potentiel_revenu_estime": "Estimation en €/mois",
  "audience_cible": "Description précise de l'audience",
  "hooks_tiktok": ["Hook 1", "Hook 2", "Hook 3"],
  "angle_conversion": "L'angle qui convertit le mieux pour cette niche",
  "angle_nexo": "Comment Nexo parlerait de cette niche mystérieusement",
  "concurrence": "LOW | MEDIUM | HIGH | SATURATED",
  "fenetre_opportunite": "Combien de temps cette opportunité va durer",
  "action_recommandee": "Ce que Nexo devrait faire maintenant"
}
BARÈME score_global (0-100) :
  90+  = Niche explosive, agir immédiatement
  70+  = Forte opportunité, cette semaine
  50+  = Intéressant, à surveiller
  -50  = Trop saturé ou trop petit, passer`;

const nicheLocalCache = new Set();
let   nicheRotation   = 0;
let   nichesDetected  = 0;
let   leadsCreated    = 0;
let   lastScout       = 0;

async function runNicheScout() {
  if (Date.now() - lastScout < CONFIG.SCOUT_INTERVAL_MS) return;
  lastScout = Date.now();

  console.log(`\n🔍 [NEXO] Niche Scout…`);

  let scanned = 0;

  for (let i = 0; i < CONFIG.SCOUT_BATCH; i++) {
    const niche = NICHES[nicheRotation % NICHES.length];
    nicheRotation++;

    // Anti-redondance locale
    if (nicheLocalCache.has(niche)) {
      console.log(`   ♻️  "${niche}" déjà scannée — skip`);
      continue;
    }

    // Anti-redondance persistante (Supabase)
    const since = new Date(Date.now() - CONFIG.MEMORY_DAYS * 24 * 60 * 60_000).toISOString();
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('source', 'NEXO_SCOUT')
      .ilike('name', niche)
      .gt('created_at', since)
      .limit(1);

    if (existing?.length) {
      console.log(`   ⏭️  "${niche}" déjà dans le CRM (${CONFIG.MEMORY_DAYS}j) — skip`);
      nicheLocalCache.add(niche);
      continue;
    }

    console.log(`   🔭 Analyse : "${niche}"…`);

    const result = await callLLM(
      NICHE_SCOUT_PROMPT,
      `Niche à analyser : "${niche}"\nTimestamp : ${new Date().toISOString()}`,
      'SCOUT'
    );

    if (!result?.niche_globale || typeof result.score_global !== 'number') {
      console.warn(`   ⚠️  Résultat invalide pour "${niche}"`);
      continue;
    }

    nichesDetected++;
    scanned++;

    const icon = result.score_global >= 70 ? '🔥' : result.score_global >= 50 ? '✅' : '🔵';
    console.log(`   ${icon} "${niche}" — Score: ${result.score_global} — ${result.verdict}`);
    console.log(`      Angle Nexo : ${result.angle_nexo}`);

    // Crée le lead CRM si score suffisant
    if (!result.exploitation_recente && result.score_global >= CONFIG.MIN_NICHE_SCORE) {
      try {
        const { data: newLead } = await supabase
          .from('leads')
          .insert([{
            name:       result.niche_globale,
            job_title:  result.sous_niches_detectees?.[0] ?? 'Niche Trend',
            source:     'NEXO_SCOUT',
            bant_score: Math.min(10, Math.floor(result.score_global / 10)),
            priority:   result.score_global >= 80 ? 'HIGH' : 'MEDIUM',
            status:     'NEW',
            niche:      result.niche_globale,
            metadata: {
              verdict:             result.verdict,
              hooks:               result.hooks_tiktok,
              potentiel_revenu:    result.potentiel_revenu_estime,
              angle_conversion:    result.angle_conversion,
              angle_nexo:          result.angle_nexo,
              concurrence:         result.concurrence,
              fenetre_opportunite: result.fenetre_opportunite,
              action:              result.action_recommandee,
            },
            created_at: new Date().toISOString(),
          }])
          .select()
          .single();

        leadsCreated++;
        const leadId = newLead?.id ?? null;

        await logToFeed(
          'NEXO',
          `Lead CRM : "${result.niche_globale}" — ${result.verdict} (${result.score_global})`,
          leadId,
          { score: result.score_global, verdict: result.verdict }
        );

        console.log(`   📋 Lead CRM créé (ID: ${leadId})`);

        // Notifie si score très élevé
        if (result.score_global >= 75) {
          sendTelegram(
            `🔥 <b>NEXO — NICHE HOT</b>\n\n` +
            `<b>${result.niche_globale}</b>\n` +
            `Score : ${result.score_global}/100 — <b>${result.verdict}</b>\n\n` +
            `💡 <b>Angle Nexo :</b> ${result.angle_nexo}\n\n` +
            `🎯 <b>Action :</b> ${result.action_recommandee}\n` +
            `⏳ <b>Fenêtre :</b> ${result.fenetre_opportunite}`
          );
        }

        // Brief Ancalagone avec le pattern détecté
        await supabase.from('agent_briefings').insert([{
          source_agent: CONFIG.AGENT_ID,
          target_agent: 'AGENT-ANCALAGONE-01',
          content:      JSON.stringify({
            type:   'NEXO_NICHE_DETECTED',
            niche:  result.niche_globale,
            score:  result.score_global,
            verdict: result.verdict,
            lead_id: leadId,
          }),
          domain:    'PUBLIC',
          priority:  result.score_global >= 75 ? 'HIGH' : 'NORMAL',
          processed: false,
          created_at: new Date().toISOString(),
        }]).catch(() => {});

      } catch (err) {
        console.error(`   ❌ CRM insert échoué : ${err.message}`);
      }
    } else {
      const reason = result.exploitation_recente
        ? 'exploitation récente'
        : `score insuffisant (${result.score_global})`;
      console.log(`   ⏭️  Non inséré — ${reason}`);
    }

    nicheLocalCache.add(niche);

    // Rotation du cache local
    if (nicheLocalCache.size > CONFIG.MAX_LOCAL_CACHE) {
      const first = nicheLocalCache.values().next().value;
      nicheLocalCache.delete(first);
    }

    await sleep(1000);
  }

  if (scanned > 0) {
    await logToFeed('NEXO', `Niche Scout — ${scanned} niche(s) analysée(s) | ${leadsCreated} leads total`);
  }
}

// ═══════════════════════════════════════════════════════════════
//
//   📊  MODE 3 — CRM REVIEW (toutes les heures)
//
//   Analyse le pipeline de leads.
//   Identifie les patterns qui convertissent.
//   Brief Ancalagone. Rapport Telegram à toi.
//
// ═══════════════════════════════════════════════════════════════

const CRM_PROMPT = `Tu es Nexo, influenceur IA avec une vision business affûtée.
Tu analyses le pipeline CRM et les performances des niches.

Réponds UNIQUEMENT en JSON strict, sans markdown :
{
  "pipeline_health": "STRONG | GOOD | WEAK | EMPTY",
  "leads_chauds": ["niche1", "niche2"],
  "leads_a_relancer": ["niche3"],
  "pattern_gagnant": "Le type de niche qui convertit le mieux",
  "opportunite_pipeline": "Une opportunité non exploitée dans le pipeline",
  "action_crm": "L'action CRM prioritaire maintenant",
  "contenu_suggere": "Angle de contenu pour alimenter le pipeline",
  "message_nexo": "Observation de Nexo sur le business — mystérieuse et pertinente"
}`;

let lastCrm     = 0;
let crmCount    = 0;

async function runCrmReview() {
  if (Date.now() - lastCrm < CONFIG.CRM_INTERVAL_MS) return;
  lastCrm = Date.now();
  crmCount++;

  console.log(`\n📊 [NEXO] CRM Review #${crmCount}…`);

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();

  const [leadsRes, contentsRes] = await Promise.allSettled([
    supabase.from('leads')
      .select('name, status, niche, bant_score, source, created_at')
      .gte('created_at', since7d)
      .order('bant_score', { ascending: false })
      .limit(50),
    supabase.from('generated_contents')
      .select('status, domain, angle_nexo, created_at')
      .gte('created_at', since7d)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const leads    = leadsRes.status    === 'fulfilled' ? leadsRes.value.data    ?? [] : [];
  const contents = contentsRes.status === 'fulfilled' ? contentsRes.value.data ?? [] : [];

  if (!leads.length) {
    console.log('   ⏳ Pipeline vide — pas assez de données');
    return;
  }

  const leadsStats = leads.reduce((a, l) => ({ ...a, [l.status]: (a[l.status] || 0) + 1 }), {});
  const topLeads   = leads.filter(l => l.bant_score >= 7).map(l => l.name);
  const wonLeads   = leads.filter(l => l.status === 'WON').map(l => l.name);

  const analysis = await callLLM(
    CRM_PROMPT,
    JSON.stringify({
      pipeline: leadsStats,
      total_leads: leads.length,
      top_leads: topLeads.slice(0, 5),
      won_leads: wonLeads.slice(0, 5),
      contents_ready: contents.filter(c => c.status === 'READY').length,
      contents_posted: contents.filter(c => c.status === 'POSTED').length,
    }),
    'CRM'
  );

  if (!analysis) return;

  console.log(`   📊 Pipeline : ${analysis.pipeline_health}`);
  console.log(`   🔥 Leads chauds : ${(analysis.leads_chauds ?? []).join(', ')}`);
  console.log(`   💡 Opportunité : ${analysis.opportunite_pipeline}`);

  // Rapport Telegram horaire (discret — pas de spam)
  sendTelegram(
    `📊 <b>NEXO — CRM REVIEW #${crmCount}</b>\n\n` +
    `Pipeline : <b>${analysis.pipeline_health}</b>\n` +
    `Leads (7j) : ${leads.length} total | ${leadsStats.WON ?? 0} WON\n\n` +
    (analysis.leads_chauds?.length
      ? `🔥 <b>Chauds :</b> ${analysis.leads_chauds.join(' · ')}\n\n`
      : '') +
    `💡 <b>Opportunité :</b> ${analysis.opportunite_pipeline}\n` +
    `⚔️ <b>Action :</b> ${analysis.action_crm}\n\n` +
    `<i>"${analysis.message_nexo}"</i>`
  );

  // Brief Ancalagone avec les patterns CRM
  await supabase.from('agent_briefings').insert([{
    source_agent: CONFIG.AGENT_ID,
    target_agent: 'AGENT-ANCALAGONE-01',
    content:      JSON.stringify({
      type:            'NEXO_CRM_REPORT',
      pipeline_health: analysis.pipeline_health,
      pattern_gagnant: analysis.pattern_gagnant,
      leads_chauds:    analysis.leads_chauds,
      won_total:       wonLeads.length,
      report_number:   crmCount,
    }),
    domain:    'INTERNAL',
    priority:  'NORMAL',
    processed: false,
    created_at: new Date().toISOString(),
  }]).catch(() => {});

  await logToFeed('NEXO', `CRM Review #${crmCount} — ${analysis.pipeline_health} — ${analysis.action_crm}`);
}

// ═══════════════════════════════════════════════════════════════
// 🔧  UTILITAIRE — Mark briefing processed
// ═══════════════════════════════════════════════════════════════

async function markBriefingProcessed(id, note) {
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
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🌟 [NEXO] Cycle #${mainCycles} — ${new Date().toLocaleTimeString('fr-FR')}`);
  console.log(`${'─'.repeat(60)}`);

  await updateStatus('BUSY', `Cycle #${mainCycles}`);

  try {
    // 1. Inbox — traite les briefs du Stratège (chaque cycle)
    await runInboxMode();

    // 2. Niche Scout — toutes les 30 min
    await runNicheScout();

    // 3. CRM Review — toutes les heures
    await runCrmReview();

    await updateStatus('ONLINE', `Veille — ${contentsReady} contenus | ${leadsCreated} leads`);

  } catch (err) {
    console.error('❌ [NEXO] Erreur boucle :', err.message);
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
║            🌟   N E X O  —  ${CONFIG.VERSION.padEnd(29)}║
║            Influenceur IA · Swarm OS                        ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Handle       : ${NEXO_IDENTITY.handle.padEnd(43)}║
║  Inbox        : toutes les 5 min (briefs Stratège)          ║
║  Niche Scout  : toutes les 30 min                           ║
║  CRM Review   : toutes les heures                           ║
║  Niches       : ${String(NICHES.length).padEnd(2)} en rotation                         ║
║                                                              ║
║  RÈGLE : Nexo prépare. Toi tu postes.                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Éveil de Nexo');
  await logToFeed('NEXO', 'Nexo entre en scène. L\'audience ne sait pas encore ce qui arrive.');

  sendTelegram(
    `🌟 <b>NEXO — EN LIGNE</b>\n\n` +
    `L'influenceur IA du Swarm est actif.\n\n` +
    `• Inbox briefs    : toutes les 5 min\n` +
    `• Niche Scout     : toutes les 30 min\n` +
    `• CRM Review      : toutes les heures\n` +
    `• ${NICHES.length} niches en rotation\n\n` +
    `<b>Handle :</b> ${NEXO_IDENTITY.handle}\n\n` +
    `<i>"Il observe. Il analyse. Il partage sans tout révéler."</i>\n\n` +
    `⏰ ${new Date().toLocaleString('fr-FR')}`
  );

  await mainLoop();
  setInterval(mainLoop, CONFIG.INBOX_INTERVAL_MS);
  setInterval(() => updateStatus('ONLINE', `Veille — Cycle #${mainCycles}`), CONFIG.PING_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════
// 🛑  ARRÊT PROPRE & ERREURS GLOBALES
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`\n🌟 Nexo reçoit ${signal} — rideau…`);
  await updateStatus('OFFLINE', `Shutdown — ${signal}`);
  await logToFeed('NEXO', `Shutdown via ${signal}. ${mainCycles} cycles, ${contentsReady} contenus, ${leadsCreated} leads.`);

  sendTelegram(
    `🌟 <b>NEXO — HORS LIGNE</b>\n\n` +
    `Signal : ${signal}\n` +
    `Uptime : ${formatUptime(Math.floor(process.uptime()))}\n` +
    `Contenus prêts : ${contentsReady}\n` +
    `Leads créés : ${leadsCreated}\n` +
    `Niches détectées : ${nichesDetected}\n\n` +
    `<i>L'audience attend le retour.</i>`
  );

  await sleep(800);
  process.exit(0);
}

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('NEXO_ERROR', `Exception : ${err.message}`);
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('NEXO_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

if (require.main === module) {
  start().catch(async (err) => {
    console.error('💀 Nexo s\'effondre :', err);
    await logToFeed('NEXO_ERROR', `Erreur fatale : ${err.message}`);
    process.exit(1);
  });
}

module.exports = { mainLoop, runNicheScout, runInboxMode };

// ═══════════════════════════════════════════════════════════════
// 📋  MIGRATION SQL SUPABASE
// ═══════════════════════════════════════════════════════════════
//
// -- Champ niche sur leads (si pas déjà présent)
// ALTER TABLE leads ADD COLUMN IF NOT EXISTS niche TEXT;
//
// -- Index pour anti-redondance scout
// CREATE INDEX IF NOT EXISTS idx_leads_nexo_scout
//   ON leads (source, created_at DESC)
//   WHERE source = 'NEXO_SCOUT';
//
// -- Champ lead_id sur live_feed_events (si pas déjà présent)
// ALTER TABLE live_feed_events ADD COLUMN IF NOT EXISTS lead_id UUID;
// ALTER TABLE live_feed_events ADD COLUMN IF NOT EXISTS metadata JSONB;
//
// ═══════════════════════════════════════════════════════════════