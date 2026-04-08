// ═══════════════════════════════════════════════════════════════
//   👁️  L'ŒEIL DE SAURON — SWARM OS
//   Surveillance omnisciente : Crypto · TikTok · Music · Shop · News
//   Un seul agent pour tout voir. Rien ne lui échappe.
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const parser     = new Parser({ timeout: 15000 });
const AGENT_ID   = 'AGENT-SAURON-01';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3333';

// Qui reçoit les signaux selon leur domaine
const ROUTING = {
  CRYPTO:  'AGENT-SENTINELLE-02',          // → Trader
  TREND:   'AGENT-CONTENU-SAURON-01',      // → Agent Contenu
  MUSIC:   'AGENT-CONTENU-SAURON-01',
  SHOP:    'AGENT-CONTENU-SAURON-01',
  NEWS:    'AGENT-CONTENU-SAURON-01',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 👁️  LES FLUX — Tout ce que l'Œil surveille
// ═══════════════════════════════════════════════════════════════

const SURVEILLANCE_FEEDS = {

  // ── CRYPTO ────────────────────────────────────────────────────
  CRYPTO: [
    { name: 'CoinTelegraph',   url: 'https://cointelegraph.com/rss' },
    { name: 'CoinDesk',        url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml' },
    { name: 'Decrypt',         url: 'https://decrypt.co/feed' },
    { name: 'Bitcoinist',      url: 'https://bitcoinist.com/feed/' },
    { name: 'CryptoNews',      url: 'https://cryptonews.com/news/feed/' },
    { name: 'TheDefiant',      url: 'https://thedefiant.io/feed/' },
    { name: 'NewsBTC',         url: 'https://www.newsbtc.com/feed/' },
  ],

  // ── TENDANCES SOCIALES (TikTok / Viral / Pop Culture) ─────────
  TREND: [
    { name: 'TechCrunch',      url: 'https://techcrunch.com/feed/' },
    { name: 'TheVerge',        url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Reddit-Trending', url: 'https://www.reddit.com/r/tiktoktrends/.rss' },
    { name: 'Reddit-Viral',    url: 'https://www.reddit.com/r/videos/top/.rss?t=day' },
    { name: 'Reddit-PopCulture', url: 'https://www.reddit.com/r/popculture/.rss' },
    { name: 'Buzzfeed',        url: 'https://www.buzzfeed.com/index.xml' },
    { name: 'Mashable',        url: 'https://mashable.com/feeds/rss/all' },
  ],

  // ── MUSIQUE ───────────────────────────────────────────────────
  MUSIC: [
    { name: 'Billboard',       url: 'https://www.billboard.com/feed/' },
    { name: 'NME',             url: 'https://www.nme.com/feed' },
    { name: 'Pitchfork',       url: 'https://pitchfork.com/rss/news/feed.json' },
    { name: 'HypeMachine',     url: 'https://hypem.com/feed/popular/1/feed.xml' },
    { name: 'Reddit-HipHop',   url: 'https://www.reddit.com/r/hiphopheads/.rss' },
    { name: 'Reddit-Music',    url: 'https://www.reddit.com/r/Music/top/.rss?t=day' },
  ],

  // ── E-COMMERCE / SHOP / DROP ──────────────────────────────────
  SHOP: [
    { name: 'ProductHunt',     url: 'https://www.producthunt.com/feed' },
    { name: 'Reddit-Deals',    url: 'https://www.reddit.com/r/deals/.rss' },
    { name: 'Reddit-Sneakers', url: 'https://www.reddit.com/r/Sneakers/top/.rss?t=day' },
    { name: 'Reddit-Frugal',   url: 'https://www.reddit.com/r/Frugal/top/.rss?t=day' },
    { name: 'Hypebeast',       url: 'https://hypebeast.com/feed' },
    { name: 'Hypebae',         url: 'https://hypebae.com/feed' },
  ],

  // ── MACRO / NEWS MONDIALE ─────────────────────────────────────
  NEWS: [
    { name: 'Reuters-Tech',    url: 'https://feeds.reuters.com/reuters/technologyNews' },
    { name: 'Reuters-Business',url: 'https://feeds.reuters.com/reuters/businessNews' },
    { name: 'BBC-Business',    url: 'http://feeds.bbci.co.uk/news/business/rss.xml' },
    { name: 'FT',              url: 'https://www.ft.com/rss/home' },
    { name: 'Reddit-World',    url: 'https://www.reddit.com/r/worldnews/top/.rss?t=day' },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 🔥 PROMPTS PAR DOMAINE — L'Œil analyse différemment selon la source
// ═══════════════════════════════════════════════════════════════

const DOMAIN_PROMPTS = {

  CRYPTO: `Tu es un analyste crypto senior. Évalue cette news pour le trading on-chain.
Réponds UNIQUEMENT en JSON :
{
  "domain": "CRYPTO",
  "briefing": "Résumé factuel 12-18 mots",
  "impact_score": 0.0-1.0,
  "asset": "BTC|ETH|SOL|BNB|OTHER|GLOBAL",
  "token_address": "0x... ou null",
  "event_type": "ETF|REGULATION|HACK|LISTING|ADOPTION|MACRO|OTHER",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
  "action_signal": "BUY|WATCH|IGNORE"
}
BARÈME impact_score: hack/ETF=0.85+, adoption institutionnelle=0.70+, listing=0.55+, news générale=0.35+, opinion=0.20`,

  TREND: `Tu es un expert en tendances virales TikTok et réseaux sociaux.
Réponds UNIQUEMENT en JSON :
{
  "domain": "TREND",
  "briefing": "Résumé viral en 15 mots max",
  "viral_score": 0.0-1.0,
  "platform": "TIKTOK|INSTAGRAM|YOUTUBE|TWITTER|REDDIT|GLOBAL",
  "niche": "nom de la niche en 2-4 mots",
  "trend_type": "CHALLENGE|MEME|PRODUCT|SOUND|AESTHETIC|EVENT",
  "content_potential": "HIGH|MEDIUM|LOW",
  "suggested_angle": "Angle de contenu recommandé en 1 phrase"
}`,

  MUSIC: `Tu es un A&R et analyste music industry expert.
Réponds UNIQUEMENT en JSON :
{
  "domain": "MUSIC",
  "briefing": "Résumé en 15 mots max",
  "hype_score": 0.0-1.0,
  "artist": "Nom artiste ou null",
  "genre": "HIP-HOP|POP|ELECTRONIC|R&B|ROCK|OTHER",
  "event_type": "RELEASE|CHART|COLLAB|BEEF|TOUR|VIRAL|OTHER",
  "content_potential": "HIGH|MEDIUM|LOW",
  "tiktok_sound_potential": true|false
}`,

  SHOP: `Tu es un expert e-commerce, dropshipping et tendances produits.
Réponds UNIQUEMENT en JSON :
{
  "domain": "SHOP",
  "briefing": "Résumé produit en 15 mots max",
  "opportunity_score": 0.0-1.0,
  "product_category": "FASHION|TECH|BEAUTY|FOOD|SPORT|HOME|OTHER",
  "trend_stage": "EMERGING|PEAK|DECLINING",
  "price_range": "BUDGET|MID|PREMIUM|LUXURY",
  "content_potential": "HIGH|MEDIUM|LOW",
  "drop_alert": true|false
}`,

  NEWS: `Tu es un macro-analyste économique et géopolitique.
Réponds UNIQUEMENT en JSON :
{
  "domain": "NEWS",
  "briefing": "Résumé factuel en 15 mots max",
  "impact_score": 0.0-1.0,
  "sector": "TECH|FINANCE|POLITICS|ENERGY|HEALTH|OTHER",
  "market_impact": "BULLISH|BEARISH|NEUTRAL",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL",
  "crypto_correlation": "HIGH|MEDIUM|LOW|NONE"
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

async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id: `SAURON-${Date.now()}`,
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:     AGENT_ID,
      agent_name:   "L'Œil de Sauron",
      status,
      last_ping:    new Date().toISOString(),
      current_task: task,
      version:      'v1.0',
      metadata:     { domains: Object.keys(SURVEILLANCE_FEEDS) },
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 🧠 ANALYSE IA D'UN SIGNAL
// ═══════════════════════════════════════════════════════════════

async function analyzeSignal(title, link, source, domain) {
  try {
    const res = await fetch(`${SERVER_URL}/api/trigger`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id:     AGENT_ID,
        prompt:       DOMAIN_PROMPTS[domain],
        user_message: `Titre : ${title}\nSource : ${source}\nLien : ${link}`,
      }),
    });

    if (!res.ok) return null;
    const data    = await res.json();
    const rawText = data.text ?? data.response ?? '';
    return safeJsonParse(rawText);

  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════
// 📡 ROUTAGE DES SIGNAUX VERS LES BONS AGENTS
// ═══════════════════════════════════════════════════════════════

const MAIN_AGENT = 'AGENT-MAIN-SAURON-01'; // La Main reçoit les signaux HIGH/CRITICAL

async function routeSignal(parsed, domain, meta) {
  const targetAgent = ROUTING[domain];
  if (!targetAgent) return;

  const score = parsed.impact_score ?? parsed.viral_score ?? parsed.hype_score ?? parsed.opportunity_score ?? 0;

  if (score < 0.30) {
    console.log(`   ⚫ Score trop bas (${score.toFixed(2)}) — ignoré`);
    return;
  }

  const priority = score >= 0.70 ? 'URGENT' : score >= 0.50 ? 'HIGH' : 'NORMAL';
  const payload  = JSON.stringify({ ...parsed, ...meta });

  // 1. Route normale (Sentinelle ou Agent Contenu)
  const { error } = await supabase.from('agent_briefings').insert([{
    source_agent: AGENT_ID,
    target_agent: targetAgent,
    content:      payload,
    priority,
    processed:    false,
    created_at:   new Date().toISOString(),
  }]);

  if (error) {
    console.error(`   ❌ Routage échoué vers ${targetAgent} :`, error.message);
  } else {
    const icon = score >= 0.70 ? '🔴' : score >= 0.50 ? '🟠' : '🟡';
    console.log(`   ${icon} Routé → ${targetAgent} (score: ${score.toFixed(2)}, priorité: ${priority})`);
    await logToFeed('SAURON', `[${domain}] ${parsed.briefing ?? meta.title?.slice(0, 60)} → ${targetAgent}`);
  }

  // 2. Copie à la Main si signal fort (score >= 0.70)
  if (score >= 0.70) {
    await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: MAIN_AGENT,
      content:      payload,
      priority:     'URGENT',
      processed:    false,
      created_at:   new Date().toISOString(),
    }]);
    console.log(`   🖐️  Copie → Main de Sauron (signal HIGH/CRITICAL)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 🔄 SCAN D'UN DOMAINE COMPLET
// ═══════════════════════════════════════════════════════════════

// Cache partagé pour éviter les doublons inter-domaines
const seenGuids = new Set();

async function scanDomain(domain, feeds) {
  console.log(`\n👁️  Scan [${domain}] — ${feeds.length} sources…`);
  let count = 0;

  for (const feed of feeds) {
    try {
      const rss   = await parser.parseURL(feed.url);
      const items = (rss.items ?? []).slice(0, 5); // Max 5 items par source

      for (const item of items) {
        const guid = item.guid ?? item.link ?? item.pubDate;
        if (!guid || seenGuids.has(guid)) continue;
        seenGuids.add(guid);

        // Rotation du cache
        if (seenGuids.size > 2000) {
          const keep = Array.from(seenGuids).slice(-1500);
          seenGuids.clear();
          keep.forEach(g => seenGuids.add(g));
        }

        const title = item.title ?? '';
        const link  = item.link  ?? '';
        console.log(`   📰 [${feed.name}] ${title.slice(0, 65)}…`);

        const parsed = await analyzeSignal(title, link, feed.name, domain);

        if (!parsed) {
          console.log(`   ⚠️  IA non parsable — ignoré`);
        } else {
          await routeSignal(parsed, domain, { title, link, source: feed.name });
          count++;
        }

        await sleep(1200); // Anti rate-limit
      }

    } catch (err) {
      console.warn(`   ⚠️  [${feed.name}] Inaccessible : ${err.message}`);
    }

    await sleep(800);
  }

  console.log(`   ✅ [${domain}] ${count} signal(s) traité(s)`);
  return count;
}

// ═══════════════════════════════════════════════════════════════
// 🌑 BOUCLE PRINCIPALE — L'Œil ne dort jamais
// ═══════════════════════════════════════════════════════════════

// Intervalles de surveillance par domaine (en ms)
const SCAN_INTERVALS = {
  CRYPTO: 3  * 60 * 1000,   //  3 min — marché ne dort pas
  TREND:  10 * 60 * 1000,   // 10 min — tendances évoluent vite
  MUSIC:  15 * 60 * 1000,   // 15 min
  SHOP:   20 * 60 * 1000,   // 20 min
  NEWS:   8  * 60 * 1000,   //  8 min — macro important
};

let totalSignals = 0;

async function startSurveillance() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   👁️   L'ŒEIL DE SAURON — SWARM OS  v1.0                   ║
╠══════════════════════════════════════════════════════════════╣
║  Domaines  : CRYPTO · TREND · MUSIC · SHOP · NEWS           ║
║  Sources   : ${String(Object.values(SURVEILLANCE_FEEDS).flat().length).padEnd(3)} flux RSS actifs                          ║
║  Routing   : Sentinelle · Contenu · Trader                  ║
║  Principe  : Rien ne lui échappe.                           ║
╚══════════════════════════════════════════════════════════════╝
`);

  await updateStatus('ONLINE', 'Initialisation');

  // Scan initial de tous les domaines (décalé pour éviter la surcharge)
  for (const [domain, feeds] of Object.entries(SURVEILLANCE_FEEDS)) {
    const count = await scanDomain(domain, feeds);
    totalSignals += count;
    await sleep(2000);
  }

  console.log(`\n🔥 Scan initial terminé — ${totalSignals} signaux envoyés`);
  await logToFeed('SAURON', `Œil ouvert — ${totalSignals} signaux détectés au démarrage`);

  // Boucles indépendantes par domaine
  for (const [domain, feeds] of Object.entries(SURVEILLANCE_FEEDS)) {
    const interval = SCAN_INTERVALS[domain];
    console.log(`⏱️  [${domain}] Planifié toutes les ${interval / 60000} min`);

    setInterval(async () => {
      await updateStatus('BUSY', `Scan ${domain}`);
      const count = await scanDomain(domain, feeds);
      totalSignals += count;
      await updateStatus('ONLINE', `Veille active — ${totalSignals} signaux total`);
    }, interval);
  }

  // Ping de vie toutes les 60s
  setInterval(() => updateStatus('ONLINE', `Veille — ${totalSignals} signaux capturés`), 60_000);
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

startSurveillance().catch(err => {
  console.error('💀 Erreur fatale Sauron :', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n👁️  L'Œil se ferme… ${totalSignals} signaux capturés cette session.`);
  process.exit(0);
});