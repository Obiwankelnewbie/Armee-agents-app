// ═══════════════════════════════════════════════════════════════
//   🔭  ARGUS — SWARM OS
//   Surveillance omnisciente : Crypto · TikTok · Music · Shop · News
//   Un seul agent pour tout voir. Rien ne lui échappe.
//   Version : 2.0 — Avril 2026
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const Parser           = require('rss-parser');

// ═══════════════════════════════════════════════════════════════
// ⚙️  CONFIG & CONSTANTES
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  AGENT_ID:        'AGENT-ARGUS-01',
  AGENT_NAME:      'Argus',
  VERSION:         'v2.0',
  SERVER_URL:      process.env.SERVER_URL || 'http://localhost:3333',
  GENERAL_AGENT:   'AGENT-GENERAL-01',       // Tout passe par Le Général
  GUID_CACHE_MAX:  3000,
  GUID_CACHE_TRIM: 2000,
  RSS_TIMEOUT:     15000,                    // ms
  SLEEP_BETWEEN_ITEMS:   800,               // ms — anti rate-limit
  SLEEP_BETWEEN_FEEDS:   600,               // ms
  SLEEP_BETWEEN_DOMAINS: 3000,              // ms — évite la surcharge au démarrage
  MAX_ITEMS_PER_FEED:    5,
  MIN_SCORE_THRESHOLD:   0.30,              // En dessous → ignoré
  URGENT_SCORE:          0.70,              // Copie également vers Le Général en URGENT
  LLM_RETRY_COUNT:       2,                // Tentatives si l'IA ne répond pas
  LLM_RETRY_DELAY:       2000,             // ms entre chaque retry
  GUID_TTL_HOURS:        24,               // Durée de vie des GUIDs en base
  PING_INTERVAL:         60_000,           // ms — heartbeat
};

// Intervalles de scan par domaine (ms)
const SCAN_INTERVALS = {
  CRYPTO: 3  * 60 * 1000,   //  3 min — marché ne dort pas
  TREND:  10 * 60 * 1000,   // 10 min — tendances évoluent vite
  MUSIC:  15 * 60 * 1000,   // 15 min
  SHOP:   20 * 60 * 1000,   // 20 min
  NEWS:   8  * 60 * 1000,   //  8 min — macro important
};

// ═══════════════════════════════════════════════════════════════
// 🔌  CLIENTS
// ═══════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const parser = new Parser({
  timeout:         CONFIG.RSS_TIMEOUT,
  headers:         { 'User-Agent': 'Argus-SwarmOS/2.0 (+https://swarm.os)' },
  customFields:    { item: [['media:content', 'mediaContent']] },
});

// ═══════════════════════════════════════════════════════════════
// 📡  FLUX DE SURVEILLANCE
// ═══════════════════════════════════════════════════════════════

const SURVEILLANCE_FEEDS = {

  // ── CRYPTO ────────────────────────────────────────────────────
  CRYPTO: [
    { name: 'CoinTelegraph',    url: 'https://cointelegraph.com/rss' },
    { name: 'CoinDesk',         url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml' },
    { name: 'Decrypt',          url: 'https://decrypt.co/feed' },
    { name: 'Bitcoinist',       url: 'https://bitcoinist.com/feed/' },
    { name: 'CryptoNews',       url: 'https://cryptonews.com/news/feed/' },
    { name: 'TheDefiant',       url: 'https://thedefiant.io/feed/' },
    { name: 'NewsBTC',          url: 'https://www.newsbtc.com/feed/' },
    { name: 'CryptoSlate',      url: 'https://cryptoslate.com/feed/' },
    { name: 'DeFiPulse-Blog',   url: 'https://medium.com/feed/defipulse' },
  ],

  // ── TENDANCES SOCIALES (TikTok / Viral / Pop Culture) ─────────
  TREND: [
    { name: 'TechCrunch',         url: 'https://techcrunch.com/feed/' },
    { name: 'TheVerge',           url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Reddit-TikTokTrends',url: 'https://www.reddit.com/r/tiktoktrends/.rss' },
    { name: 'Reddit-Viral',       url: 'https://www.reddit.com/r/videos/top/.rss?t=day' },
    { name: 'Reddit-PopCulture',  url: 'https://www.reddit.com/r/popculture/.rss' },
    { name: 'Buzzfeed',           url: 'https://www.buzzfeed.com/index.xml' },
    { name: 'Mashable',           url: 'https://mashable.com/feeds/rss/all' },
    { name: 'Reddit-InternetIsBeautiful', url: 'https://www.reddit.com/r/InternetIsBeautiful/top/.rss?t=day' },
  ],

  // ── MUSIQUE ───────────────────────────────────────────────────
  MUSIC: [
    { name: 'Billboard',      url: 'https://www.billboard.com/feed/' },
    { name: 'NME',            url: 'https://www.nme.com/feed' },
    { name: 'HypeMachine',    url: 'https://hypem.com/feed/popular/1/feed.xml' },
    { name: 'Reddit-HipHop',  url: 'https://www.reddit.com/r/hiphopheads/.rss' },
    { name: 'Reddit-Music',   url: 'https://www.reddit.com/r/Music/top/.rss?t=day' },
    { name: 'Reddit-EDM',     url: 'https://www.reddit.com/r/EDM/top/.rss?t=day' },
    // Note : Pitchfork retiré (feed JSON non compatible RSS standard)
  ],

  // ── E-COMMERCE / SHOP / DROP ──────────────────────────────────
  SHOP: [
    { name: 'ProductHunt',     url: 'https://www.producthunt.com/feed' },
    { name: 'Reddit-Deals',    url: 'https://www.reddit.com/r/deals/.rss' },
    { name: 'Reddit-Sneakers', url: 'https://www.reddit.com/r/Sneakers/top/.rss?t=day' },
    { name: 'Reddit-Frugal',   url: 'https://www.reddit.com/r/Frugal/top/.rss?t=day' },
    { name: 'Hypebeast',       url: 'https://hypebeast.com/feed' },
    { name: 'Hypebae',         url: 'https://hypebae.com/feed' },
    { name: 'Reddit-Entrepreneur', url: 'https://www.reddit.com/r/Entrepreneur/top/.rss?t=day' },
  ],

  // ── MACRO / NEWS MONDIALE ─────────────────────────────────────
  NEWS: [
    { name: 'Reuters-Tech',     url: 'https://feeds.reuters.com/reuters/technologyNews' },
    { name: 'Reuters-Business', url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'BBC-Business',     url: 'http://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'FT',               url: 'https://www.ft.com/rss/home' },
    { name: 'Reddit-World',     url: 'https://www.reddit.com/r/worldnews/top/.rss?t=day' },
    { name: 'HackerNews',       url: 'https://hnrss.org/frontpage' },
    { name: 'Reddit-Futurology',url: 'https://www.reddit.com/r/Futurology/top/.rss?t=day' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 🧠  PROMPTS IA PAR DOMAINE
// ═══════════════════════════════════════════════════════════════

const DOMAIN_PROMPTS = {

  CRYPTO: `Tu es un analyste crypto senior. Évalue cette news pour un trading on-chain sur Base Network.
Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire :
{
  "domain": "CRYPTO",
  "briefing": "Résumé factuel 12-18 mots",
  "impact_score": 0.0,
  "asset": "BTC|ETH|SOL|BNB|BASE|OTHER|GLOBAL",
  "token_address": "0x... ou null",
  "event_type": "ETF|REGULATION|HACK|LISTING|ADOPTION|MACRO|DEFI|NFT|OTHER",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
  "action_signal": "BUY|WATCH|IGNORE",
  "base_network_relevance": true
}
BARÈME impact_score : hack/ETF=0.85+, adoption institutionnelle=0.70+, listing=0.55+, news générale=0.35+, opinion/rumeur=0.20`,

  TREND: `Tu es un expert en tendances virales TikTok, Instagram et réseaux sociaux.
Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire :
{
  "domain": "TREND",
  "briefing": "Résumé viral en 15 mots max",
  "viral_score": 0.0,
  "platform": "TIKTOK|INSTAGRAM|YOUTUBE|TWITTER|REDDIT|GLOBAL",
  "niche": "nom de la niche en 2-4 mots",
  "trend_type": "CHALLENGE|MEME|PRODUCT|SOUND|AESTHETIC|EVENT|AI",
  "content_potential": "HIGH|MEDIUM|LOW",
  "suggested_angle": "Angle de contenu mystérieux et intriguant en 1 phrase courte",
  "longevity": "FLASH|WEEK|MONTH|DURABLE"
}`,

  MUSIC: `Tu es un A&R et analyste music industry expert en viralité audio.
Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire :
{
  "domain": "MUSIC",
  "briefing": "Résumé en 15 mots max",
  "hype_score": 0.0,
  "artist": "Nom artiste ou null",
  "genre": "HIP-HOP|POP|ELECTRONIC|R&B|ROCK|AFRO|OTHER",
  "event_type": "RELEASE|CHART|COLLAB|BEEF|TOUR|VIRAL|SAMPLE|OTHER",
  "content_potential": "HIGH|MEDIUM|LOW",
  "tiktok_sound_potential": true,
  "suggested_angle": "Angle de contenu court en 1 phrase"
}`,

  SHOP: `Tu es un expert e-commerce, TikTok Shop, dropshipping et tendances produits viraux.
Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire :
{
  "domain": "SHOP",
  "briefing": "Résumé produit en 15 mots max",
  "opportunity_score": 0.0,
  "product_category": "FASHION|TECH|BEAUTY|FOOD|SPORT|HOME|AI-TOOL|OTHER",
  "trend_stage": "EMERGING|PEAK|DECLINING",
  "price_range": "BUDGET|MID|PREMIUM|LUXURY",
  "content_potential": "HIGH|MEDIUM|LOW",
  "drop_alert": true,
  "tiktok_shop_fit": true
}`,

  NEWS: `Tu es un macro-analyste économique, géopolitique et tech.
Réponds UNIQUEMENT en JSON strict, sans markdown, sans commentaire :
{
  "domain": "NEWS",
  "briefing": "Résumé factuel en 15 mots max",
  "impact_score": 0.0,
  "sector": "TECH|FINANCE|POLITICS|ENERGY|HEALTH|AI|OTHER",
  "market_impact": "BULLISH|BEARISH|NEUTRAL",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
  "crypto_correlation": "HIGH|MEDIUM|LOW|NONE",
  "content_angle": "Angle de contenu pertinent en 1 phrase ou null"
}`,
};

// ═══════════════════════════════════════════════════════════════
// 🔧  UTILITAIRES
// ═══════════════════════════════════════════════════════════════

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** Extrait proprement un JSON d'une réponse LLM potentiellement bruitée */
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

/** Extrait le score dominant d'un signal selon son domaine */
function extractScore(parsed) {
  return (
    parsed?.impact_score      ??
    parsed?.viral_score       ??
    parsed?.hype_score        ??
    parsed?.opportunity_score ??
    0
  );
}

/** Log dans live_feed_events (non-fatal) */
async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message:    `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id:     `ARGUS-${Date.now()}`,
      created_at: new Date().toISOString(),
    }]);
  } catch { /* non-fatal */ }
}

/** Met à jour le statut de l'agent dans agent_status */
async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:     CONFIG.AGENT_ID,
      agent_name:   CONFIG.AGENT_NAME,
      status,
      last_ping:    new Date().toISOString(),
      current_task: task,
      version:      CONFIG.VERSION,
      metadata:     {
        domains:      Object.keys(SURVEILLANCE_FEEDS),
        total_feeds:  Object.values(SURVEILLANCE_FEEDS).flat().length,
        min_score:    CONFIG.MIN_SCORE_THRESHOLD,
      },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 💾  DÉDUPLICATION PERSISTANTE (Supabase)
//     Évite de retraiter les mêmes items après un redémarrage
// ═══════════════════════════════════════════════════════════════

/** Cache mémoire rapide (première barrière) */
const seenGuids = new Set();

/** Vérifie si un GUID a déjà été traité (mémoire + base) */
async function isAlreadySeen(guid) {
  if (seenGuids.has(guid)) return true;

  try {
    const { data } = await supabase
      .from('argus_seen_guids')
      .select('guid')
      .eq('guid', guid)
      .maybeSingle();
    return !!data;
  } catch {
    return false; // En cas d'erreur DB, on laisse passer (fail open)
  }
}

/** Marque un GUID comme traité en mémoire et en base */
async function markAsSeen(guid) {
  seenGuids.add(guid);

  // Rotation du cache mémoire
  if (seenGuids.size > CONFIG.GUID_CACHE_MAX) {
    const keep = Array.from(seenGuids).slice(-CONFIG.GUID_CACHE_TRIM);
    seenGuids.clear();
    keep.forEach(g => seenGuids.add(g));
  }

  // Persistance en base avec TTL (nettoyage via pg_cron côté Supabase)
  try {
    const expires = new Date();
    expires.setHours(expires.getHours() + CONFIG.GUID_TTL_HOURS);
    await supabase.from('argus_seen_guids').upsert(
      [{ guid, expires_at: expires.toISOString() }],
      { onConflict: 'guid' }
    );
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 🧠  ANALYSE IA — avec retry automatique
// ═══════════════════════════════════════════════════════════════

async function analyzeSignal(title, link, source, domain) {
  const body = JSON.stringify({
    agent_id:     CONFIG.AGENT_ID,
    prompt:       DOMAIN_PROMPTS[domain],
    user_message: `Titre : ${title}\nSource : ${source}\nLien : ${link}`,
  });

  for (let attempt = 1; attempt <= CONFIG.LLM_RETRY_COUNT; attempt++) {
    try {
      const controller = new AbortController();
      const timeout    = setTimeout(() => controller.abort(), 20_000);

      const res = await fetch(`${CONFIG.SERVER_URL}/api/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal:  controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`   ⚠️  Tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT} échouée (HTTP ${res.status})`);
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY * attempt);
        continue;
      }

      const data    = await res.json();
      const rawText = data.text ?? data.response ?? '';
      const parsed  = safeJsonParse(rawText);

      if (!parsed) {
        console.warn(`   ⚠️  Tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT} — JSON non parsable`);
        if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY * attempt);
        continue;
      }

      return parsed; // ✅ Succès

    } catch (err) {
      const reason = err.name === 'AbortError' ? 'timeout' : err.message;
      console.warn(`   ⚠️  Tentative ${attempt}/${CONFIG.LLM_RETRY_COUNT} — ${reason}`);
      if (attempt < CONFIG.LLM_RETRY_COUNT) await sleep(CONFIG.LLM_RETRY_DELAY * attempt);
    }
  }

  return null; // Toutes les tentatives ont échoué
}

// ═══════════════════════════════════════════════════════════════
// 📤  ROUTAGE — Tout passe par Le Général
// ═══════════════════════════════════════════════════════════════

let totalSignals = 0;
let totalRejected = 0;

async function routeSignal(parsed, domain, meta) {
  const score    = extractScore(parsed);
  const scoreStr = score.toFixed(2);

  if (score < CONFIG.MIN_SCORE_THRESHOLD) {
    console.log(`   ⚫ Score trop bas (${scoreStr}) — rejeté`);
    totalRejected++;
    return;
  }

  const priority = score >= CONFIG.URGENT_SCORE ? 'URGENT' : score >= 0.50 ? 'HIGH' : 'NORMAL';
  const icon     = score >= CONFIG.URGENT_SCORE ? '🔴' : score >= 0.50 ? '🟠' : '🟡';

  const payload = JSON.stringify({
    ...parsed,
    ...meta,
    argus_version: CONFIG.VERSION,
    detected_at:   new Date().toISOString(),
  });

  // ── Route principale → Le Général (toujours) ──────────────────
  const { error } = await supabase.from('agent_briefings').insert([{
    source_agent: CONFIG.AGENT_ID,
    target_agent: CONFIG.GENERAL_AGENT,
    content:      payload,
    domain,
    priority,
    processed:    false,
    created_at:   new Date().toISOString(),
  }]);

  if (error) {
    console.error(`   ❌ Routage échoué → ${CONFIG.GENERAL_AGENT} : ${error.message}`);
    return;
  }

  totalSignals++;
  const briefing = parsed.briefing ?? meta.title?.slice(0, 60);
  console.log(`   ${icon} [${domain}] → Le Général (score: ${scoreStr}, priorité: ${priority})`);
  console.log(`      ↳ ${briefing}`);

  await logToFeed('ARGUS', `[${domain}] ${briefing} — score ${scoreStr} → Général`);

  // ── Alerte haute priorité (log séparé pour le dashboard) ──────
  if (score >= CONFIG.URGENT_SCORE) {
    try {
      await supabase.from('argus_alerts').insert([{
        domain,
        score,
        priority:    'URGENT',
        briefing:    parsed.briefing ?? '',
        source:      meta.source,
        link:        meta.link,
        raw_payload: payload,
        created_at:  new Date().toISOString(),
      }]);
      console.log(`   🚨 Alerte URGENT enregistrée dans argus_alerts`);
    } catch { /* non-fatal */ }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄  SCAN D'UN DOMAINE COMPLET
// ═══════════════════════════════════════════════════════════════

async function scanDomain(domain, feeds) {
  console.log(`\n🔭 Argus — Scan [${domain}] sur ${feeds.length} source(s)…`);
  let domainCount = 0;

  for (const feed of feeds) {
    try {
      const rss   = await parser.parseURL(feed.url);
      const items = (rss.items ?? []).slice(0, CONFIG.MAX_ITEMS_PER_FEED);

      for (const item of items) {
        const guid = item.guid ?? item.link ?? item.id ?? item.pubDate;
        if (!guid) continue;

        const alreadySeen = await isAlreadySeen(guid);
        if (alreadySeen) {
          console.log(`   ♻️  [${feed.name}] Déjà traité — ignoré`);
          continue;
        }

        await markAsSeen(guid);

        const title = (item.title ?? '').trim();
        const link  = item.link ?? '';
        if (!title) continue;

        console.log(`   📰 [${feed.name}] ${title.slice(0, 70)}…`);

        const parsed = await analyzeSignal(title, link, feed.name, domain);

        if (!parsed) {
          console.log(`   ❌ Analyse IA échouée après ${CONFIG.LLM_RETRY_COUNT} tentatives`);
        } else {
          await routeSignal(parsed, domain, { title, link, source: feed.name });
          domainCount++;
        }

        await sleep(CONFIG.SLEEP_BETWEEN_ITEMS);
      }

    } catch (err) {
      if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        console.warn(`   ⚠️  [${feed.name}] Timeout/connexion refusée`);
      } else if (err.message?.includes('Invalid XML')) {
        console.warn(`   ⚠️  [${feed.name}] Feed RSS invalide ou format non supporté`);
      } else {
        console.warn(`   ⚠️  [${feed.name}] ${err.message}`);
      }
    }

    await sleep(CONFIG.SLEEP_BETWEEN_FEEDS);
  }

  const icon = domainCount > 0 ? '✅' : '🔵';
  console.log(`   ${icon} [${domain}] — ${domainCount} signal(s) routé(s)`);
  return domainCount;
}

// ═══════════════════════════════════════════════════════════════
// 📊  RAPPORT DE SESSION (affiché périodiquement)
// ═══════════════════════════════════════════════════════════════

function printSessionReport() {
  const total = totalSignals + totalRejected;
  const ratio = total > 0 ? ((totalSignals / total) * 100).toFixed(1) : '0.0';
  console.log(`
┌─────────────────────────────────────────┐
│  🔭  Argus — Rapport de session         │
├─────────────────────────────────────────┤
│  Signaux routés   : ${String(totalSignals).padEnd(20)} │
│  Signaux rejetés  : ${String(totalRejected).padEnd(20)} │
│  Taux de qualité  : ${(ratio + '%').padEnd(20)} │
└─────────────────────────────────────────┘`);
}

// ═══════════════════════════════════════════════════════════════
// 🌑  BOUCLE PRINCIPALE — Argus ne dort jamais
// ═══════════════════════════════════════════════════════════════

async function startSurveillance() {
  const totalFeeds = Object.values(SURVEILLANCE_FEEDS).flat().length;

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🔭  ARGUS — SWARM OS  ${CONFIG.VERSION.padEnd(37)}║
╠══════════════════════════════════════════════════════════════╣
║  Domaines  : CRYPTO · TREND · MUSIC · SHOP · NEWS           ║
║  Sources   : ${String(totalFeeds).padEnd(3)} flux RSS actifs                          ║
║  Seuil     : Score ≥ ${String(CONFIG.MIN_SCORE_THRESHOLD).padEnd(39)}║
║  Routing   : Tout → Le Général (filtre avant traitement)    ║
║  Principe  : Rien ne lui échappe.                           ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Initialisation');

  // ── Scan initial de tous les domaines ─────────────────────────
  for (const [domain, feeds] of Object.entries(SURVEILLANCE_FEEDS)) {
    const count = await scanDomain(domain, feeds);
    totalSignals += count;
    await sleep(CONFIG.SLEEP_BETWEEN_DOMAINS);
  }

  console.log(`\n🔥 Scan initial terminé.`);
  printSessionReport();
  await logToFeed('ARGUS', `Démarrage — ${totalSignals} signaux détectés`);

  // ── Boucles indépendantes par domaine ─────────────────────────
  for (const [domain, feeds] of Object.entries(SURVEILLANCE_FEEDS)) {
    const interval = SCAN_INTERVALS[domain];
    console.log(`⏱️  [${domain}] Planifié toutes les ${interval / 60000} min`);

    setInterval(async () => {
      await updateStatus('BUSY', `Scan ${domain}`);
      await scanDomain(domain, feeds);
      await updateStatus('ONLINE', `Veille active — ${totalSignals} signaux routés`);
    }, interval);
  }

  // ── Heartbeat toutes les 60s ───────────────────────────────────
  setInterval(async () => {
    await updateStatus('ONLINE', `Veille — ${totalSignals} signaux routés, ${totalRejected} rejetés`);
  }, CONFIG.PING_INTERVAL);

  // ── Rapport de session toutes les 30 min ──────────────────────
  setInterval(printSessionReport, 30 * 60 * 1000);
}

// ═══════════════════════════════════════════════════════════════
// 🚀  DÉMARRAGE & GESTION D'ERREURS GLOBALE
// ═══════════════════════════════════════════════════════════════

process.on('uncaughtException', async (err) => {
  console.error('💀 Exception non capturée :', err);
  await logToFeed('ARGUS_ERROR', `Exception : ${err.message}`);
  // On ne quitte pas — on laisse le processus survivre si possible
});

process.on('unhandledRejection', async (reason) => {
  console.error('💀 Promesse rejetée :', reason);
  await logToFeed('ARGUS_ERROR', `Rejection : ${String(reason).slice(0, 200)}`);
});

process.on('SIGINT', async () => {
  console.log(`\n🔭 Argus se ferme proprement…`);
  printSessionReport();
  await updateStatus('OFFLINE', 'Arrêt manuel');
  await logToFeed('ARGUS', `Arrêt — session terminée`);
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(`\n🔭 Argus — SIGTERM reçu, arrêt propre…`);
  await updateStatus('OFFLINE', 'Arrêt système');
  process.exit(0);
});

startSurveillance().catch(async (err) => {
  console.error('💀 Erreur fatale Argus :', err);
  await logToFeed('ARGUS_ERROR', `Erreur fatale : ${err.message}`);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
// 📋  MIGRATION SQL SUPABASE REQUISE
// ═══════════════════════════════════════════════════════════════
//
// Exécuter dans ton projet Supabase :
//
// -- Table de déduplication persistante
// CREATE TABLE IF NOT EXISTS argus_seen_guids (
//   guid       TEXT PRIMARY KEY,
//   expires_at TIMESTAMPTZ NOT NULL,
//   created_at TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Index d'expiration (pour nettoyage via pg_cron)
// CREATE INDEX ON argus_seen_guids (expires_at);
//
// -- Nettoyage automatique toutes les heures (nécessite pg_cron activé)
// SELECT cron.schedule('clean-argus-guids', '0 * * * *',
//   $$DELETE FROM argus_seen_guids WHERE expires_at < NOW()$$
// );
//
// -- Table des alertes hautes priorité
// CREATE TABLE IF NOT EXISTS argus_alerts (
//   id          BIGSERIAL PRIMARY KEY,
//   domain      TEXT,
//   score       FLOAT,
//   priority    TEXT,
//   briefing    TEXT,
//   source      TEXT,
//   link        TEXT,
//   raw_payload JSONB,
//   created_at  TIMESTAMPTZ DEFAULT NOW()
// );
//
// -- Index pour le dashboard
// CREATE INDEX ON argus_alerts (created_at DESC);
// CREATE INDEX ON argus_alerts (domain, score DESC);
//
// ═══════════════════════════════════════════════════════════════