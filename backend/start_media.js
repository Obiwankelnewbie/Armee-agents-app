'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

// ====================== CONFIGURATION ======================
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*',
  },
  timeout: 18000
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const AGENT_ID = 'AGENT-MEDIA-01';
const TARGET_SENTINEL = 'AGENT-SENTINELLE-02';
const TRIGGER_URL = process.env.SERVER_URL || "http://localhost:3333";

// Flux RSS stables (CryptoPanic retiré car trop instable)
const RSS_FEEDS = [
  "https://cointelegraph.com/rss",
  "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
  "https://cryptoslate.com/feed/",
  "https://thedefiant.io/feed/",
  "https://cryptopotato.com/feed/",
  "https://decrypt.co/feed",
  "https://bitcoinist.com/feed/",
  "https://www.newsbtc.com/feed/"
];

const seenGuids = new Set();
const MAX_SEEN = 300;

// ====================== PARSER JSON ROBUSTE ======================
function parseJSONSafe(raw) {
  try {
    let str = typeof raw === 'string' ? raw : '';
    str = str.replace(/<\|[\s\S]*?\|>/g, '').trim();
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(str.substring(start, end + 1));
  } catch (e) {
    console.error("❌ Parse JSON failed:", e.message);
    return null;
  }
}

// ====================== ANALYSE IA ======================
async function performScouting(title, link = '', source = 'Unknown') {
  console.log(`📡 [MEDIA-01] Analyse (${source}) : ${title.substring(0, 65)}...`);

  try {
    const response = await fetch(`${TRIGGER_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        temperature: 0.1,
        max_tokens: 300,
        prompt: `Tu es un analyste crypto professionnel spécialisé en opportunités de trading.

Analyse la news et réponds **UNIQUEMENT** avec un JSON valide :

{
  "briefing": "Résumé court en 12-18 mots",
  "impact_score": 0.0-1.0,
  "asset": "BTC|ETH|SOL|BNB|DOGE|PEPE|GLOBAL|OTHER",
  "token_address": "0x... ou null",
  "event_type": "ETF|REGULATION|HACK|PARTNERSHIP|LISTING|ADOPTION|MACRO|OTHER",
  "urgency": "LOW|MEDIUM|HIGH|CRITICAL"
}

Pas d'hallucination. Urgency CRITICAL seulement pour hacks majeurs.`,
        user_message: `${title}\nSource: ${source}\nLien: ${link}`
      })
    });

    const data = await response.json();
    const rawText = data.text || data.content || "";
    const parsed = parseJSONSafe(rawText);

    if (!parsed) {
      console.log("⚠️ IA n'a pas renvoyé de JSON valide");
      return;
    }

    const { error } = await supabase.from('agent_briefings').insert([{
      source_agent: AGENT_ID,
      target_agent: TARGET_SENTINEL,
      content: JSON.stringify(parsed),
      priority: parsed.urgency === "CRITICAL" ? "URGENT" : null,
      processed: false,
      created_at: new Date().toISOString()
    }]);

    if (error) {
      console.error("❌ Supabase error:", error.message);
    } else {
      console.log(`✅ SIGNAL ENVOYÉ → ${TARGET_SENTINEL} | Score: ${parsed.impact_score} | Asset: ${parsed.asset}`);
    }

  } catch (err) {
    console.error("❌ Erreur lors de l'appel IA :", err.message);
  }
}

// ====================== VÉRIFICATION FLUX ======================
async function checkAllFeeds() {
  console.log("\n🔄 Scan multi-RSS en cours...");

  let totalProcessed = 0;

  for (const url of RSS_FEEDS) {
    try {
      const feed = await parser.parseURL(url);
      const sourceName = new URL(url).hostname.replace('www.', '');

      for (const item of feed.items || []) {
        const guid = item.guid || item.link || item.pubDate;
        if (!guid || seenGuids.has(guid)) continue;

        console.log(`🔥 Nouvelle news (${sourceName}) : ${item.title}`);
        await performScouting(item.title, item.link || '', sourceName);

        seenGuids.add(guid);
        totalProcessed++;

        if (seenGuids.size > MAX_SEEN) {
          const keep = Array.from(seenGuids).slice(-MAX_SEEN);
          seenGuids.clear();
          keep.forEach(g => seenGuids.add(g));
        }

        await new Promise(r => setTimeout(r, 1200)); // pause douce
      }
    } catch (e) {
      console.log(`⚠️ Flux ${url} indisponible ou erreur.`);
    }
  }

  if (totalProcessed === 0) {
    console.log("😴 Aucune nouvelle news cette passe.");
  } else {
    console.log(`✅ ${totalProcessed} news traitée(s) cette passe.`);
  }
}

// ====================== DÉMARRAGE ======================
async function startAgent() {
  console.log(`\n🚀 ${AGENT_ID} → MULTI-RSS ACTIF`);
  console.log(`🎯 Cible : ${TARGET_SENTINEL}\n`);

  // Premier scan
  await checkAllFeeds();

  // Toutes les 2 minutes
  setInterval(checkAllFeeds, 120 * 1000);
}

startAgent();