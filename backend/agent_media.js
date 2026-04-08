'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 20000
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const AGENT_ID        = 'AGENT-MEDIA-01';
const TARGET_SENTINEL = 'AGENT-SENTINELLE-02';
const TRIGGER_URL     = process.env.SERVER_URL || 'http://localhost:3333';

const RSS_FEEDS = [
  'https://cointelegraph.com/rss',
  'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
  'https://cryptoslate.com/feed/',
  'https://thedefiant.io/feed/',
  'https://cryptopotato.com/feed/',
  'https://decrypt.co/feed',
  'https://bitcoinist.com/feed/',
  'https://www.newsbtc.com/feed/',
  'https://cryptonews.com/news/feed/',
];

const seenGuids = new Set();
const MAX_SEEN  = 500;

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

function parseJSONSafe(raw) {
  try {
    let str = typeof raw === 'string' ? raw : '';
    str = str.replace(/<\|[\s\S]*?\|>/g, '').trim();
    const start = str.indexOf('{');
    const end   = str.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(str.substring(start, end + 1));
  } catch (e) {
    console.error('❌ Parse JSON failed:', e.message);
    return null;
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────
// TEST INITIAL DES FLUX
// ─────────────────────────────────────────────────────────────

async function testAllFeeds() {
  console.log('\n🔍 TEST INITIAL DES FLUX RSS...\n');
  let working = 0;

  for (const url of RSS_FEEDS) {
    try {
      const feed  = await parser.parseURL(url);
      const count = feed?.items?.length || 0;
      const name  = new URL(url).hostname.replace('www.', '');
      console.log(`✅ ${name.padEnd(20)} → ${count} items`);
      working++;
    } catch (err) {
      const name = new URL(url).hostname.replace('www.', '');
      console.log(`❌ ${name.padEnd(20)} → ${err.message}`);
    }
    await sleep(800);
  }

  console.log(`\n📊 ${working}/${RSS_FEEDS.length} flux fonctionnent.\n`);
  return working > 0;
}

// ─────────────────────────────────────────────────────────────
// PROMPT IA — SCORING AMÉLIORÉ
// ─────────────────────────────────────────────────────────────

// Barème impact_score :
//   0.80-1.00 → Hack majeur, ETF approuvé, faillite exchange, listing Binance
//   0.65-0.79 → Partenariat important, adoption institutionnelle, régulation critique
//   0.50-0.64 → News modérée avec impact prix probable
//   0.30-0.49 → News générale, peu d'impact immédiat
//   0.00-0.29 → Bruit, opinion, contenu promotionnel

const MEDIA_PROMPT = `Tu es un analyste crypto senior spécialisé dans le trading on-chain.
Évalue cette news avec PRÉCISION et réponds UNIQUEMENT avec ce JSON valide :

{
  "briefing": "Résumé factuel en 12-18 mots",
  "impact_score": <nombre entre 0.0 et 1.0>,
  "asset": "BTC|ETH|SOL|BNB|DOGE|PEPE|GLOBAL|OTHER",
  "token_address": "<adresse 0x si mentionnée dans la news, sinon null>",
  "event_type": "ETF|REGULATION|HACK|PARTNERSHIP|LISTING|ADOPTION|MACRO|OTHER",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL"
}

BARÈME impact_score OBLIGATOIRE :
- 0.85+ : Hack majeur, ETF approuvé/rejeté, faillite exchange, listing Binance spot
- 0.70-0.84 : Partenariat institutionnel, adoption gouvernementale, régulation majeure
- 0.55-0.69 : Listing exchange tier-2, partnership notable, metric on-chain fort
- 0.35-0.54 : News générale positive/négative, analyse de marché
- 0.00-0.34 : Opinion, contenu promotionnel, bruit médiatique

RÈGLES :
- Urgency CRITICAL uniquement pour hacks confirmés ou événements systémiques
- Si la news mentionne un token spécifique avec adresse de contrat, l'inclure
- Sois STRICT sur le score : une news Bloomberg sur BTC ETF = 0.80+, un article d'opinion = 0.25`;

// ─────────────────────────────────────────────────────────────
// ANALYSE IA
// ─────────────────────────────────────────────────────────────

async function performScouting(title, link, source) {
  console.log(`📡 Analyse (${source}) : ${title.substring(0, 70)}…`);

  try {
    const response = await fetch(`${TRIGGER_URL}/api/trigger`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id:     AGENT_ID,
        temperature:  0,
        max_tokens:   300,
        prompt:       MEDIA_PROMPT,
        user_message: `Titre : ${title}\nSource : ${source}\nLien : ${link}`,
      }),
    });

    if (!response.ok) {
      console.error(`❌ Serveur HTTP ${response.status}`);
      return;
    }

    const data    = await response.json();
    const rawText = data.text || data.response || '';
    const parsed  = parseJSONSafe(rawText);

    if (!parsed) {
      console.log('⚠️  JSON invalide de l\'IA :', rawText.slice(0, 100));
      return;
    }

    const score = Number(parsed.impact_score) || 0;
    console.log(`   Score: ${score.toFixed(2)} | Asset: ${parsed.asset} | CA: ${parsed.token_address ?? 'null'} | Type: ${parsed.event_type}`);

    const { error } = await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: TARGET_SENTINEL,
      content:      JSON.stringify({ ...parsed, title, source, link }),
      priority:     parsed.urgency === 'CRITICAL' ? 'URGENT' : 'NORMAL',
      processed:    false,
      created_at:   new Date().toISOString(),
    }]);

    if (error) console.error('❌ Supabase :', error.message);
    else       console.log(`✅ Envoyé à ${TARGET_SENTINEL}`);

  } catch (err) {
    console.error('❌ Erreur IA :', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// SCAN D'UN FLUX (avec retry)
// ─────────────────────────────────────────────────────────────

async function checkOneFeed(url, retries = 3) {
  const sourceName = new URL(url).hostname.replace('www.', '');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const feed = await parser.parseURL(url);
      if (!feed?.items?.length) return 0;

      let newCount = 0;

      for (const item of feed.items) {
        const guid = item.guid || item.link || item.pubDate;
        if (!guid || seenGuids.has(guid)) continue;

        await performScouting(item.title, item.link || '', sourceName);

        seenGuids.add(guid);
        newCount++;

        // Rotation du cache pour éviter une croissance infinie
        if (seenGuids.size > MAX_SEEN) {
          const keep = Array.from(seenGuids).slice(-MAX_SEEN);
          seenGuids.clear();
          keep.forEach(g => seenGuids.add(g));
        }

        await sleep(1300);
      }

      return newCount;

    } catch (err) {
      console.error(`❌ Tentative ${attempt}/${retries} sur ${sourceName} : ${err.message}`);
      if (attempt < retries) await sleep(3000);
    }
  }
  return 0;
}

// ─────────────────────────────────────────────────────────────
// BOUCLE PRINCIPALE
// ─────────────────────────────────────────────────────────────

async function checkAllFeeds() {
  console.log('\n🔄 Scan de tous les flux RSS…');
  let totalNew = 0;

  for (const url of RSS_FEEDS) {
    const count = await checkOneFeed(url);
    totalNew += count;
  }

  console.log(totalNew > 0
    ? `✅ ${totalNew} nouvelle(s) news traitée(s).`
    : '😴 Aucune nouvelle news cette passe.'
  );
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────────────────────

async function startAgent() {
  console.log(`\n🚀 ${AGENT_ID} démarré — ${RSS_FEEDS.length} sources RSS`);
  console.log(`🎯 Cible : ${TARGET_SENTINEL}\n`);

  const hasWorkingFeed = await testAllFeeds();
  if (!hasWorkingFeed) {
    console.error('⚠️  Aucun flux RSS ne répond. Vérifie ta connexion.');
    return;
  }

  await checkAllFeeds();
  setInterval(checkAllFeeds, 130_000); // toutes les ~2min10
}

startAgent();