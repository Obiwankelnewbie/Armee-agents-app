// swarm-server.js — Swarm Creator Data Engine v11.0
// ─────────────────────────────────────────────────────────────
// DUAL AI : Claude + Gemini Flash
//
//  Claude Sonnet  → Analyse stratégique, scripts Hook-Body-CTA
//                   Décisions complexes, croisement données
//
//  Gemini Flash   → Tâches rapides & répétitives (40x moins cher)
//                   Enrichissement keywords, hooks simples,
//                   Classification, résumés rapides
//
// Répartition des coûts estimée :
//   Avant  : 100% Claude  → ~$0.003/1k tokens
//   Après  : 30% Claude + 70% Gemini → ~$0.001/1k tokens
//   Économie : ~67% sur les coûts IA
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';
import express     from 'express';
import cors        from 'cors';
import { createClient } from '@supabase/supabase-js';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.on('uncaughtException',  e => console.error('💥 UNCAUGHT:', e));
process.on('unhandledRejection', r => console.error('💥 REJECTION:', r));

const app          = express();
const PORT = process.env.PORT || 3000;
const SECRET       = process.env.SWARM_SECRET      || 'armee-swarm-secret-2025';
const APIFY_KEY    = process.env.APIFY_API_KEY;
const CLAUDE_KEY   = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY   = process.env.GEMINI_API_KEY;
const YT_KEY       = process.env.YOUTUBE_API_KEY;
const PIN_KEY      = process.env.PINTEREST_API_KEY;
const N8N_URL      = process.env.N8N_WEBHOOK_URL;
const IS_PROD      = process.env.NODE_ENV === 'production';

app.use(cors({ origin:'*' }));
app.use(express.json({ limit:'2mb' }));
app.use(express.static(__dirname));
// ─────────────────────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────────────────────
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken:false, persistSession:false }
    })
  : null;

function createUserClient(token) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return null;
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers:{ Authorization:`Bearer ${token}` } },
    auth: { autoRefreshToken:false, persistSession:false }
  });
}

// ─────────────────────────────────────────────────────────────
// 🧠 CLAUDE SONNET — Analyse stratégique complexe
// ─────────────────────────────────────────────────────────────
async function callClaude(system, userMessage, maxTokens=1000) {
  if (!CLAUDE_KEY) throw new Error('ANTHROPIC_API_KEY manquante');
  const t0 = Date.now();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-api-key':CLAUDE_KEY, 'anthropic-version':'2023-06-01' },
    body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:maxTokens, system, messages:[{ role:'user', content:userMessage }] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message||'Erreur Claude');
  const text   = data.content?.[0]?.text||'';
  const tokens = (data.usage?.input_tokens||0)+(data.usage?.output_tokens||0);
  const cost   = parseFloat(((tokens/1000)*0.003).toFixed(6));
  console.log(`  🧠 Claude: ${tokens} tokens | $${cost} | ${Date.now()-t0}ms`);
  return { text, tokens, cost, model:'claude' };
}

// ─────────────────────────────────────────────────────────────
// ⚡ GEMINI FLASH — Tâches rapides & économiques
// ─────────────────────────────────────────────────────────────
async function callGemini(prompt, maxTokens=500) {
  if (!GEMINI_KEY) {
    // Fallback Claude si Gemini non configuré
    console.warn('  ⚠ GEMINI_KEY manquante — fallback Claude');
    return callClaude('Tu es un assistant utile. Réponds en JSON uniquement sans markdown.', prompt, maxTokens);
  }
  const t0 = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          contents:[{ parts:[{ text:prompt }] }],
          generationConfig:{ maxOutputTokens:maxTokens, temperature:0.7 }
        })
      }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message||'Erreur Gemini');
    const text   = data.candidates?.[0]?.content?.parts?.[0]?.text||'';
    const tokens = data.usageMetadata?.totalTokenCount||0;
    const cost   = parseFloat(((tokens/1000)*0.000075).toFixed(8)); // Gemini Flash ~$0.000075/1k
    console.log(`  ⚡ Gemini: ${tokens} tokens | $${cost} | ${Date.now()-t0}ms`);
    return { text, tokens, cost, model:'gemini' };
  } catch(e) {
    console.warn(`  ⚠ Gemini error: ${e.message} — fallback Claude`);
    return callClaude('Tu es un assistant utile. Réponds en JSON uniquement sans markdown.', prompt, maxTokens);
  }
}

// ─────────────────────────────────────────────────────────────
// 🤖 ROUTER IA — Choisit le bon modèle selon la tâche
// ─────────────────────────────────────────────────────────────
const AI_TASKS = {
  // Gemini Flash — rapide & économique
  ENRICH_KEYWORD:    'gemini',  // Enrichissement keyword → générique
  QUICK_HOOK:        'gemini',  // Hook simple pour veille
  CLASSIFY:          'gemini',  // Classification catégorie
  SUMMARIZE:         'gemini',  // Résumé rapide
  DETECT_VIRAL:      'gemini',  // Détection signal viral simple
  REDDIT_SENTIMENT:  'gemini',  // Analyse sentiment Reddit

  // Claude Sonnet — qualité maximale
  FULL_SCAN:         'claude',  // Analyse scan complète
  SCRIPT_HOOK:       'claude',  // Script Hook-Body-CTA
  STRATEGY:          'claude',  // Recommandation stratégique
  CROSS_ANALYSIS:    'claude',  // Croisement données multi-sources
  AGENT_MISSION:     'claude',  // Mission IA agents
};

async function callAI(task, prompt, options={}) {
  const model = AI_TASKS[task] || 'claude';
  const { maxTokens=500, system=null } = options;

  if (model === 'gemini') {
    return callGemini(prompt, maxTokens);
  } else {
    const sys = system || 'Tu es un expert TikTok Shop France. JSON uniquement sans markdown.';
    return callClaude(sys, prompt, maxTokens);
  }
}

// ─────────────────────────────────────────────────────────────
// KEYWORDS VIRAUX — 50+ mots-clés par catégorie
// ─────────────────────────────────────────────────────────────
const VIRAL_KEYWORDS = {
  beaute:  ['sérum visage','acide hyaluronique','gua sha','jade roller','fond de teint','mascara','blush','contour','eye liner','rétinol','niacinamide','collagène','patch yeux','crème solaire','sérum vitamine C'],
  mode:    ['tenue tendance','sneakers','cargo pants','mini jupe','blazer','ensemble jogging','robe midi','sandales','sac tendance','chapeau','lunettes soleil','bijoux','jean taille haute','crop top','hoodie'],
  tech:    ['airpods','lampe led','ring light','support téléphone','chargeur sans fil','écouteurs','montre connectée','drone','batterie externe','enceinte bluetooth','casque gaming','stylo numérique'],
  food:    ['matcha','collagen drink','protéine shake','energy drink','snack healthy','kombucha','recette virale','meal prep','smoothie','café dalgona','boba tea','granola','poke bowl'],
  sport:   ['résistance band','tapis yoga','gourde sport','protéine','shaker','corde à sauter','haltères','tenue sport','baskets running','foam roller','balle massage'],
  maison:  ['lampe ambiance','organisateur','bougie','diffuseur','plante','cadre mural','coussin','storage box','cafetière','blender','air fryer','robot cuisine'],
  sante:   ['vitamine D','omega 3','probiotique','magnésium','mélatonine','collagène','zinc','spiruline','ashwagandha','CBD','brosse dents électrique'],
  musique: ['son viral tiktok','musique tendance','hit 2025','remix viral','chanson populaire','trending audio','beat viral'],
};

// ─────────────────────────────────────────────────────────────
// CACHE
// ─────────────────────────────────────────────────────────────
const apifyCache      = new Map();
const cacheTimestamps = new Map();
const CACHE_TTL       = 5*60*1000;

function getCached(kw) {
  const ts = cacheTimestamps.get(kw);
  if (!ts||Date.now()-ts>CACHE_TTL) return null;
  return apifyCache.get(kw)||null;
}
function setCache(kw, source, items) {
  const ex = apifyCache.get(kw)||{};
  apifyCache.set(kw,{...ex,[source]:items});
  cacheTimestamps.set(kw,Date.now());
}

// ─────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!IS_PROD&&!authHeader) {
    req.clientId   = process.env.DEMO_CLIENT_ID||'00000000-0000-0000-0000-000000000001';
    req.userToken  = null;
    req.userClient = supabaseAdmin;
    return next();
  }
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error:'Token manquant' });
  const token = authHeader.split(' ')[1];
  if (!supabaseAdmin) {
    req.clientId='00000000-0000-0000-0000-000000000001';
    req.userToken=token; req.userClient=createUserClient(token);
    return next();
  }
  try {
    const { data:{ user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error||!user) return res.status(401).json({ error:'Token invalide' });
    req.clientId=user.id; req.userToken=token;
    req.userClient=createUserClient(token);
    next();
  } catch { return res.status(401).json({ error:'Erreur auth' }); }
}

// ─────────────────────────────────────────────────────────────
// RATE LIMITING
// ─────────────────────────────────────────────────────────────
const rateLimits = new Map();
function rateLimit(max=15) {
  return (req,res,next) => {
    const ip  = req.headers['x-forwarded-for']?.split(',')[0]||'unknown';
    const key = req.clientId?`c:${req.clientId}`:`ip:${ip}`;
    const now = Date.now();
    const e   = rateLimits.get(key)||{ count:0, resetAt:now+60000 };
    if (now>e.resetAt) { e.count=0; e.resetAt=now+60000; }
    e.count++; rateLimits.set(key,e);
    if (e.count>max) return res.status(429).json({ error:'Trop de requêtes — attends 1 minute' });
    next();
  };
}

// ─────────────────────────────────────────────────────────────
// ⚡ GEMINI — Enrichissement keyword (rapide)
// ─────────────────────────────────────────────────────────────
async function enrichKeyword(keyword) {
  const words = keyword.trim().split(/\s+/);
  if (words.length >= 2) return { generic:keyword, hashtag:keyword.replace(/\s+/g,'').toLowerCase() };
  try {
    const { text } = await callAI('ENRICH_KEYWORD',
      `Produit: "${keyword}". Retourne UNIQUEMENT ce JSON sans rien d'autre:
{"generic":"terme générique français 2-3 mots pour scraper","hashtag":"hashtag TikTok sans espace minuscules"}`,
      { maxTokens:80 }
    );
    const parsed = JSON.parse(text.replace(/```json|```/g,'').trim());
    console.log(`  🔍 Keyword: "${keyword}" → "${parsed.generic}" (Gemini)`);
    return parsed;
  } catch { return { generic:keyword, hashtag:keyword.replace(/\s+/g,'').toLowerCase() }; }
}

// ─────────────────────────────────────────────────────────────
// ⚡ GEMINI — Hook simple pour veille
// ─────────────────────────────────────────────────────────────
async function generateQuickHook(keyword, category, signals) {
  try {
    const { text } = await callAI('QUICK_HOOK',
      `Produit viral "${keyword}" (${category}). Signaux: ${signals.join(', ')}.
Retourne UNIQUEMENT ce JSON:
{"hook":"accroche TikTok ultra-courte français max 12 mots","verdict":"FONCER|ATTENDRE","window":"ex: 7-10 jours"}`,
      { maxTokens:100 }
    );
    return JSON.parse(text.replace(/```json|```/g,'').trim());
  } catch { return { hook:`${keyword} est en train d'exploser !`, verdict:'FONCER', window:'7-14 jours' }; }
}

// ─────────────────────────────────────────────────────────────
// APIFY HELPERS
// ─────────────────────────────────────────────────────────────
async function apifyLaunch(actorId, input) {
  if (!APIFY_KEY) return null;
  try {
    const res  = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_KEY}&timeout=55&memory=256`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(input) });
    const data = await res.json();
    return data?.data?.id||null;
  } catch { return null; }
}

async function apifyCollect(runId, maxWait=50000) {
  if (!runId||!APIFY_KEY) return [];
  const deadline = Date.now()+maxWait;
  while (Date.now()<deadline) {
    await new Promise(r=>setTimeout(r,4000));
    try {
      const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_KEY}`)).json();
      if (s?.data?.status==='SUCCEEDED') {
        const items = await (await fetch(`https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_KEY}&limit=10`)).json();
        return Array.isArray(items)?items:[];
      }
      if (['FAILED','TIMED-OUT','ABORTED'].includes(s?.data?.status)) return [];
    } catch { return []; }
  }
  return [];
}

// ─────────────────────────────────────────────────────────────
// SCRAPERS DIRECTS
// ─────────────────────────────────────────────────────────────
async function scrapeYouTube(keyword) {
  if (!YT_KEY) return null;
  try {
    const res  = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=5&relevanceLanguage=fr&key=${YT_KEY}`);
    const data = await res.json();
    if (data.error||!data.items?.length) return null;
    const ids   = data.items.map(v=>v.id.videoId).join(',');
    const stats = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${YT_KEY}`)).json();
    const sMap  = Object.fromEntries(stats.items?.map(v=>[v.id,v.statistics])||[]);
    const totalViews = data.items.reduce((s,v)=>s+parseInt(sMap[v.id.videoId]?.viewCount||'0'),0);
    return {
      total_views: totalViews,
      video_count: data.items.length,
      score:       Math.min(99,40+Math.round(totalViews/800000)),
      items:       data.items?.map(v=>({
        title:     v.snippet.title,
        channel:   v.snippet.channelTitle,
        videoId:   v.id.videoId,
        url:       `https://youtube.com/watch?v=${v.id.videoId}`,
        thumbnail: v.snippet.thumbnails?.medium?.url||null,
        viewCount: parseInt(sMap[v.id.videoId]?.viewCount||'0'),
        likeCount: parseInt(sMap[v.id.videoId]?.likeCount||'0'),
      }))||[]
    };
  } catch { return null; }
}

async function scrapeReddit(keyword) {
  try {
    const res  = await fetch(`https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=hot&limit=8`,
      { headers:{'User-Agent':'SwarmCreator/1.0'} });
    const data = await res.json();
    if (!data?.data?.children?.length) return null;
    const posts   = data.data.children;
    const upvotes = posts.reduce((s,p)=>s+(p.data.ups||0),0);
    return {
      upvotes, post_count:posts.length,
      score:     Math.min(99,40+Math.round(upvotes/80)),
      sentiment: upvotes>1000?'🟢 Très positif':upvotes>200?'🟡 Positif':'⚪ Neutre',
      top_posts: posts.slice(0,3).map(p=>({
        title:   p.data.title,
        upvotes: p.data.ups,
        url:     `https://reddit.com${p.data.permalink}`
      }))
    };
  } catch { return null; }
}

async function scrapePinterest(keyword) {
  if (!PIN_KEY) return null;
  try {
    const res  = await fetch(`https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(keyword)}&page_size=8`,
      { headers:{'Authorization':`Bearer ${PIN_KEY}`} });
    const data = await res.json();
    const pins = data.items||[];
    return pins.length?{ pin_count:pins.length, score:Math.min(99,50+pins.length*3) }:null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────
// DÉTECTION SIGNAL VIRAL
// ─────────────────────────────────────────────────────────────
function computeCrossScore(sources) {
  const w = { tiktok:0.35, trends:0.25, youtube:0.20, reddit:0.12, pinterest:0.08 };
  let total=0, weight=0;
  for (const [src,data] of Object.entries(sources)) {
    if (data?.score&&w[src]) { total+=data.score*w[src]; weight+=w[src]; }
  }
  return weight>0?Math.round(total/weight):0;
}

function detectViralSignal(sources) {
  const signals=[], scores=[];
  if (sources.tiktok?.score)  { scores.push(sources.tiktok.score);  if (sources.tiktok.score>=70)  signals.push(`🎵 TikTok ${sources.tiktok.score}%`); }
  if (sources.trends?.score)  { scores.push(sources.trends.score);  if (sources.trends.trend==='📈 En hausse') signals.push(`📊 Trends ↑${sources.trends.avg_interest}`); }
  if (sources.youtube?.score) { scores.push(sources.youtube.score); if (sources.youtube.score>=60) signals.push(`▶️ YouTube ${sources.youtube.score}%`); }
  if (sources.reddit?.score)  { scores.push(sources.reddit.score);  if (sources.reddit.score>=60)  signals.push(`🤖 Reddit ${sources.reddit.upvotes} upvotes`); }
  if (sources.pinterest?.score){ scores.push(sources.pinterest.score); if (sources.pinterest.score>=60) signals.push(`📌 Pinterest ${sources.pinterest.pin_count} pins`); }
  const maxScore   = Math.max(...scores,0);
  const crossScore = computeCrossScore(sources);
  return { is_viral:signals.length>=2&&maxScore>=65, signal_count:signals.length, signals, max_score:maxScore, cross_score:crossScore };
}

// ─────────────────────────────────────────────────────────────
// SUPABASE — Sauvegarde veille
// ─────────────────────────────────────────────────────────────
async function saveVeilleResult(clientId, keyword, category, sources, viralInfo, hookSuggestion) {
  if (!supabaseAdmin) return null;
  try {
    const { data, error } = await supabaseAdmin.from('veille_results').insert({
      client_id:       clientId, keyword, category,
      source:          viralInfo.signals.map(s=>s.split(' ')[0]).join('+')||'multi',
      score:           viralInfo.cross_score,
      trend:           sources.trends?.trend||null,
      views:           (sources.tiktok?.total_views||0)+(sources.youtube?.total_views||0),
      videos_count:    (sources.tiktok?.video_count||0)+(sources.youtube?.video_count||0),
      verdict:         viralInfo.is_viral?'VIRAL':viralInfo.cross_score>=55?'MONTANT':'STABLE',
      hook_suggestion: hookSuggestion||null,
      raw_data:        { sources, signals:viralInfo.signals },
      scraped_at:      new Date().toISOString(),
    }).select('id').single();
    if (!error) console.log(`  💾 Supabase ← veille [${keyword}] score:${viralInfo.cross_score}`);
    return data?.id||null;
  } catch(e) { console.error('  ⚠ saveVeilleResult:', e.message); return null; }
}

// ─────────────────────────────────────────────────────────────
// ENDPOINT : /api/veille — RADAR DE VIRALITÉ
// ─────────────────────────────────────────────────────────────
app.post('/api/veille', requireAuth, rateLimit(20), async (req, res) => {
  const { clientId }   = req;
  const categories     = req.body.categories||Object.keys(VIRAL_KEYWORDS);
  const maxPerCat      = req.body.max_per_category||3;
  const minScore       = req.body.min_score||50;

  console.log(`\n🔭 VEILLE v11 | Gemini+Claude | catégories: ${categories.join(',')}`);

  res.setHeader('Content-Type','text/event-stream');
  res.setHeader('Cache-Control','no-cache');
  res.setHeader('Connection','keep-alive');
  res.setHeader('Access-Control-Allow-Origin','*');

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const totalKeywords = categories.reduce((s,c)=>s+(VIRAL_KEYWORDS[c]?.slice(0,maxPerCat).length||0),0);
  send('start',{ message:'Veille démarrée (Gemini+Claude)', categories, total_keywords:totalKeywords });

  const allResults=[];
  let processed=0;

  for (const category of categories) {
    const keywords = VIRAL_KEYWORDS[category]?.slice(0,maxPerCat)||[];
    for (const keyword of keywords) {
      processed++;
      console.log(`\n  🔍 [${processed}/${totalKeywords}] "${keyword}" (${category})`);
      send('scanning',{ keyword, category, processed });

      const sources={};

      // ⚡ Gemini enrichit le keyword (économique)
      const kwEnriched = await enrichKeyword(keyword);
      const kw         = kwEnriched.generic;
      const kwHt       = kwEnriched.hashtag;

      // TikTok via Apify
      if (APIFY_KEY) {
        send('source',{ keyword, source:'tiktok', status:'launching' });
        const ttRunId = await apifyLaunch('clockworks~tiktok-scraper',{ hashtags:[kwHt], maxItems:8 });
        if (ttRunId) {
          const ttItems = await apifyCollect(ttRunId,45000);
          if (ttItems.length) {
            const totalViews = ttItems.reduce((s,v)=>s+(v.playCount||v.statsV2?.playCount||0),0);
            sources.tiktok = { total_views:totalViews, video_count:ttItems.length, score:Math.min(99,50+Math.round(totalViews/400000)), views_str:totalViews>1000000?(totalViews/1000000).toFixed(1)+'M':Math.round(totalViews/1000)+'k', top_videos:ttItems.slice(0,3).map(v=>({ views:v.playCount||0, desc:(v.text||'').slice(0,60) })) };
            send('source',{ keyword, source:'tiktok', status:'done', score:sources.tiktok.score, views:sources.tiktok.views_str });
          }
        }
      }

      // Google Trends via Apify
      if (APIFY_KEY) {
        send('source',{ keyword, source:'trends', status:'launching' });
        const trRunId = await apifyLaunch('apify~google-trends-scraper',{ searchTerms:[kw], geo:'FR', timeRange:'today 3-m' });
        if (trRunId) {
          const trItems = await apifyCollect(trRunId,45000);
          if (trItems.length) {
            const item=trItems[0], points=item?.interestOverTime||item?.timelineData||[];
            let avg=50,isUp=false;
            if (points.length>0) { const vals=points.slice(-8).map(p=>Number(p.value||0)).filter(n=>!isNaN(n)); if(vals.length){avg=Math.round(vals.reduce((a,b)=>a+b,0)/vals.length);isUp=vals[vals.length-1]>vals[0];} }
            sources.trends={ avg_interest:avg, trend:isUp?'📈 En hausse':'📉 En baisse', score:Math.min(99,avg) };
            send('source',{ keyword, source:'trends', status:'done', score:sources.trends.score, trend:sources.trends.trend });
          }
        }
      }

      // YouTube direct
      if (YT_KEY) {
        send('source',{ keyword, source:'youtube', status:'launching' });
        const ytData = await scrapeYouTube(kw);
        if (ytData) { sources.youtube=ytData; send('source',{ keyword, source:'youtube', status:'done', score:ytData.score }); }
      } else {
        send('source',{ keyword, source:'youtube', status:'skip', reason:'clé manquante' });
      }

      // Reddit direct
      send('source',{ keyword, source:'reddit', status:'launching' });
      const rdData = await scrapeReddit(kw);
      if (rdData) { sources.reddit=rdData; send('source',{ keyword, source:'reddit', status:'done', score:rdData.score, sentiment:rdData.sentiment }); }

      // Pinterest
      if (PIN_KEY) {
        send('source',{ keyword, source:'pinterest', status:'launching' });
        const pinData = await scrapePinterest(kw);
        if (pinData) { sources.pinterest=pinData; send('source',{ keyword, source:'pinterest', status:'done', score:pinData.score }); }
      } else {
        send('source',{ keyword, source:'pinterest', status:'skip', reason:'clé en attente' });
      }

      // Calcul signal viral
      const viralInfo = detectViralSignal(sources);

      // ⚡ Gemini génère le hook si pertinent (économique)
      let hookSuggestion=null, hookVerdict=null, hookWindow=null;
      if (viralInfo.is_viral||viralInfo.cross_score>=70) {
        try {
          const hookData = await generateQuickHook(keyword, category, viralInfo.signals);
          hookSuggestion = hookData.hook;
          hookVerdict    = hookData.verdict;
          hookWindow     = hookData.window;
        } catch { hookSuggestion=`Tendance ${keyword} — agis vite !`; }
      }

      const result = {
        keyword, category, sources,
        cross_score:    viralInfo.cross_score,
        is_viral:       viralInfo.is_viral,
        signal_count:   viralInfo.signal_count,
        signals:        viralInfo.signals,
        verdict:        viralInfo.is_viral?'VIRAL':viralInfo.cross_score>=55?'MONTANT':'STABLE',
        hook_suggestion: hookSuggestion,
        scraped_at:     new Date().toISOString(),
      };

      allResults.push(result);

      if (viralInfo.cross_score>=minScore) {
        send('result', result);
        await saveVeilleResult(clientId,keyword,category,sources,viralInfo,hookSuggestion);
        if (viralInfo.is_viral&&N8N_URL) fetch(N8N_URL,{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ event:'VIRAL_DETECTED', keyword, category, score:viralInfo.cross_score, signals:viralInfo.signals }) }).catch(()=>{});
      }

      await new Promise(r=>setTimeout(r,800));
    }
  }

  const topResults = allResults.filter(r=>r.cross_score>=minScore).sort((a,b)=>b.cross_score-a.cross_score).slice(0,20);
  const crossHits  = allResults.filter(r=>r.signal_count>=2).sort((a,b)=>b.cross_score-a.cross_score);

  send('complete',{
    total_scanned:  processed,
    total_results:  topResults.length,
    viral_count:    allResults.filter(r=>r.is_viral).length,
    cross_hits:     crossHits.length,
    top_results:    topResults,
    cross_hits_data:crossHits.slice(0,10),
  });

  console.log(`\n✅ VEILLE TERMINÉE | ${processed} keywords | ${allResults.filter(r=>r.is_viral).length} viraux`);
  res.end();
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT : /api/scan — 🧠 Claude analyse complète
// ─────────────────────────────────────────────────────────────
app.post('/api/scan', requireAuth, rateLimit(15), async (req, res) => {
  const { clientId, userClient } = req;
  const { url, product_name }   = req.body;
  if (!url&&!product_name) return res.status(400).json({ error:'URL ou nom de produit requis' });

  const keyword = (product_name||url).trim();
  console.log(`\n🔍 SCAN "${keyword}" | user: ${clientId.slice(0,8)}...`);

  // ⚡ Gemini enrichit le keyword
  const kwEnriched = await enrichKeyword(keyword);
  const kw   = kwEnriched.generic;
  const kwHt = kwEnriched.hashtag;

  if (APIFY_KEY) {
    apifyLaunch('clockworks~tiktok-scraper',{ hashtags:[kwHt], maxItems:10 }).then(id=>id&&apifyCollect(id,55000).then(items=>{ if(items.length) setCache(keyword,'tiktok',items); }));
    apifyLaunch('apify~google-trends-scraper',{ searchTerms:[kw], geo:'FR', timeRange:'today 3-m' }).then(id=>id&&apifyCollect(id,55000).then(items=>{ if(items.length) setCache(keyword,'trends',items); }));
  }

  const [ytData, rdData, pinData] = await Promise.all([ scrapeYouTube(kw), scrapeReddit(kw), scrapePinterest(kw) ]);
  if (ytData)  setCache(keyword,'youtube',[ytData]);
  if (rdData)  setCache(keyword,'reddit',[rdData]);
  if (pinData) setCache(keyword,'pinterest',[pinData]);

  const cached = getCached(keyword);
  const ttScore  = cached?.tiktok?.[0]  ? Math.min(99,50+Math.round((cached.tiktok[0].playCount||0)/400000)) : null;
  const gtScore  = cached?.trends?.[0]  ? (()=>{ const pts=cached.trends[0]?.interestOverTime||[]; const vals=pts.slice(-8).map(p=>Number(p.value||0)); return vals.length?Math.min(99,Math.round(vals.reduce((a,b)=>a+b,0)/vals.length)):null; })() : null;
  const ytScore  = ytData ? ytData.score : null;
  const rdScore  = rdData ? rdData.score : null;
  const pinScore = pinData ? pinData.score : null;
  const hasReal  = !!(ttScore||gtScore||ytScore||rdScore||pinScore);

  // 🧠 Claude — analyse stratégique complète
  const { text, tokens, cost } = await callAI('FULL_SCAN',
    `Analyse "${keyword}". Données réelles: TikTok:${ttScore||'?'} Trends:${gtScore||'?'} YouTube:${ytScore||'?'} Reddit:${rdScore||'?'} Pinterest:${pinScore||'?'}
JSON uniquement sans rien d'autre:
{"product_name":"${keyword}","category":"beaute|mode|tech|food|sport|maison|sante","tiktok_score":${ttScore||'<60-99>'},"youtube_score":${ytScore||'<50-90>'},"reddit_score":${rdScore||'<40-85>'},"trends_score":${gtScore||'<50-95>'},"pinterest_score":${pinScore||'<50-90>'},"global_score":"<calculé>","verdict":"FONCER|ATTENDRE|RISQUÉ","verdict_detail":"<phrase>","hook_suggestion":"<hook viral français>","window":"<ex:12j>","opportunity_level":"HIGH|MEDIUM|LOW","tiktok_weekly":"<stat>","tiktok_views_est":"<stat>","insights":["<1>","<2>","<3>"],"agents":["Script Master","Créateur Hook","Pipeline Swarm"]}`,
    { maxTokens:900, system:'Tu es expert TikTok Shop France. JSON uniquement sans markdown.' }
  );

  let scanData;
  try { scanData=JSON.parse(text.replace(/```json|```/g,'').trim()); }
  catch { const m=text.match(/\{[\s\S]*\}/); if(m) scanData=JSON.parse(m[0]); else throw new Error('JSON invalide'); }

  if (ttScore)  scanData.tiktok_score    = ttScore;
  if (gtScore)  scanData.trends_score    = gtScore;
  if (ytScore)  scanData.youtube_score   = ytScore;
  if (rdScore)  scanData.reddit_score    = rdScore;
  if (pinScore) scanData.pinterest_score = pinScore;

  if (hasReal) {
    scanData.global_score = Math.round(
      (scanData.tiktok_score||0)*0.35+(scanData.trends_score||0)*0.20+
      (scanData.youtube_score||0)*0.20+(scanData.reddit_score||0)*0.15+(scanData.pinterest_score||0)*0.10
    );
  }

  if (supabaseAdmin) {
    supabaseAdmin.from('scan_results').insert({
      client_id:clientId, keyword, global_score:scanData.global_score,
      tiktok_score:scanData.tiktok_score, youtube_score:scanData.youtube_score,
      reddit_score:scanData.reddit_score, trends_score:scanData.trends_score,
      pinterest_score:scanData.pinterest_score, verdict:scanData.verdict,
      verdict_detail:scanData.verdict_detail, opportunity_level:scanData.opportunity_level,
      window_days:scanData.window, hook_suggestion:scanData.hook_suggestion,
      insights:scanData.insights, data_quality:hasReal?'real':'estimated',
      real_sources:[ttScore&&'TikTok',gtScore&&'Trends',ytScore&&'YouTube',rdScore&&'Reddit',pinScore&&'Pinterest'].filter(Boolean),
      raw_data:{ scanData, youtube_items:ytData?.items||[] },
      scanned_at:new Date().toISOString()
    }).then(({error})=>{ if(error) console.warn('⚠ scan save:',error.message); });
  }

  console.log(`  ✅ "${keyword}" | Score:${scanData.global_score} | ${scanData.verdict} | AI:Claude`);
  return res.status(200).json({ success:true, scan:{ ...scanData, sources:{ tiktok:cached?.tiktok?.[0]||null, google_trends:cached?.trends?.[0]||null, youtube:ytData, reddit:rdData, pinterest:pinData } }, data_quality:hasReal?'real':'estimated', timestamp:new Date().toISOString() });
});

// ─────────────────────────────────────────────────────────────
// ENDPOINT : /api/trigger — 🧠 Claude missions agents
// ─────────────────────────────────────────────────────────────
app.post('/api/trigger', requireAuth, rateLimit(20), async (req, res) => {
  try {
    const { messages, agentUnit, product, _system_override } = req.body;
    const claudeMessages = messages?.length?messages:[{ role:'user', content:String(product||'Mission IA') }];
    const systemPrompts  = {
      hunter:  `Tu es "Le Chasseur de Clients" B2B. Français. Statut 🟢, Stratégie, 5 leads (Nom — Poste, Entreprise — Score X/10), "💰 Valeur : +XX€".`,
      clone:   `Tu es "Le Clone Social". 3 posts LinkedIn viraux. POST 1:, POST 2:, POST 3:. "💰 Valeur : +XX€".`,
      spy:     `Tu es "L'Espion IA". Rapport militaire. "🕵️ RAPPORT — [NOM]", menaces (🟢🟡🔴), RECOMMANDATION, "💰 Valeur : +XX€".`,
      hook:    `Tu es "Le Créateur Hook" TikTok Shop. HOOK 1:, HOOK 2:, HOOK 3:. "🛒 GMV estimé : +XX€".`,
      script:  `Tu es "Le Script Master". Script TikTok [0-5s][5-15s][15-25s][25-30s]. "🛒 GMV estimé : +XX€".`,
      pipeline:`Tu es "Le Pipeline Complet". Plan TikTok Shop 5 étapes, stats. "💰 GMV pipeline : +XX€".`,
    };
    // 🧠 Claude pour toutes les missions agents (qualité max)
  const { text } = await callAI('AGENT_MISSION',
      claudeMessages[claudeMessages.length-1].content,
     { maxTokens:1000, system:_system_override||systemPrompts[agentUnit]||systemPrompts.hunter }
    );
    return res.status(200).json({ content:[{ type:'text', text }] });
  } catch(e) { return res.status(500).json({ error:'Erreur génération', detail:e.message }); }
});

// ─────────────────────────────────────────────────────────────
// ENDPOINTS LECTURE
// ─────────────────────────────────────────────────────────────
app.get('/api/history', requireAuth, async (req,res) => {
  const { userClient }=req;
  if (!userClient) return res.status(503).json({ error:'Supabase non configuré' });
  const limit=Math.min(parseInt(req.query.limit)||20,100);
  const { data, error }=await userClient.from('scan_results').select('id,keyword,global_score,verdict,opportunity_level,data_quality,real_sources,scanned_at').order('scanned_at',{ascending:false}).limit(limit);
  if (error) return res.status(500).json({ error:error.message });
  return res.json({ history:data, count:data.length });
});

app.get('/api/alerts', requireAuth, async (req,res) => {
  const { userClient }=req;
  if (!userClient) return res.status(503).json({ error:'Supabase non configuré' });
  const { data, error }=await userClient.from('opportunity_alerts').select('*').eq('is_read',false).order('created_at',{ascending:false}).limit(10);
  if (error) return res.status(500).json({ error:error.message });
  return res.json({ alerts:data, count:data.length });
});

app.get('/api/stats', requireAuth, async (req,res) => {
  const { userClient }=req;
  if (!userClient) return res.status(503).json({ error:'Supabase non configuré' });
  const { data, error }=await userClient.from('v_client_stats').select('*').single();
  if (error) return res.status(500).json({ error:error.message });
  return res.json({ stats:data });
});

app.get('/api/veille/history', requireAuth, async (req,res) => {
  if (!supabaseAdmin) return res.status(503).json({ error:'Supabase non configuré' });
  const { clientId }=req;
  const limit=Math.min(parseInt(req.query.limit)||50,200);
  const { data, error }=await supabaseAdmin.from('veille_results').select('*').eq('client_id',clientId).order('scraped_at',{ascending:false}).limit(limit);
  if (error) return res.status(500).json({ error:error.message });
  return res.json({ results:data, count:data.length });
});

app.get('/api/veille/top', requireAuth, async (req,res) => {
  if (!supabaseAdmin) return res.status(503).json({ error:'Supabase non configuré' });
  const { clientId }=req;
  const since=new Date(Date.now()-24*60*60*1000).toISOString();
  const { data, error }=await supabaseAdmin.from('veille_results').select('*').eq('client_id',clientId).gte('scraped_at',since).order('score',{ascending:false}).limit(20);
  if (error) return res.status(500).json({ error:error.message });
  return res.json({ top:data, count:data.length });
});

app.get('/api/cache-status', (req,res) => {
  const status={};
  for (const [kw,data] of apifyCache.entries()) {
    const ts=cacheTimestamps.get(kw);
    status[kw]={ sources:Object.keys(data).filter(k=>data[k]?.length>0), expires_in:ts?Math.round((CACHE_TTL-(Date.now()-ts))/60000)+'min':null };
  }
  res.json({ cache:status, total:apifyCache.size });
});

app.get('/api/status', (req,res) => {
  res.json({
    status:'online', version:'11.0.0',
    ai: {
      claude:  CLAUDE_KEY ?'✅ connecté':'❌ manquant',
      gemini:  GEMINI_KEY ?'✅ connecté':'⚠️ manquant (fallback Claude)',
      strategy:'Claude→Analyse | Gemini→Keywords+Hooks'
    },
    sources:{ tiktok:APIFY_KEY?'✅':'❌', trends:APIFY_KEY?'✅':'❌', youtube:YT_KEY?'✅':'⚠️', reddit:'✅ gratuit', pinterest:PIN_KEY?'✅':'⏳' },
    storage:{ supabase:supabaseAdmin?'✅':'⚠️' },
    keywords_total:Object.values(VIRAL_KEYWORDS).reduce((s,arr)=>s+arr.length,0),
    timestamp:new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
// PATCH swarm-server.js — Mémoire Vive + Agent Ping
// ═══════════════════════════════════════════════════════════════
//
// INSTALLATION (une seule fois) :
//   npm install better-sqlite3
//
// AJOUT dans swarm-server.js :
//   Colle ce bloc juste AVANT la ligne "app.listen(PORT, ...)"
//
// ═══════════════════════════════════════════════════════════════


import { existsSync, mkdirSync } from 'fs';

// ─────────────────────────────────────────────
// SQLITE — Initialisation
// ─────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH || './swarm_memory.db';

const db = new Database(DB_PATH);

// Performance SQLite
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// ─────────────────────────────────────────────
// CRÉATION DES TABLES (si elles n'existent pas)
// ─────────────────────────────────────────────
db.exec(`
  -- Signaux reçus des agents
  CREATE TABLE IF NOT EXISTS agent_pings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id    TEXT    NOT NULL,
    status      TEXT    NOT NULL,
    run         INTEGER,
    niche       TEXT,
    score       INTEGER,
    verdict     TEXT,
    views_est   INTEGER,
    uptime_s    REAL,
    memory_mb   INTEGER,
    raw_data    TEXT,              -- JSON complet
    received_at TEXT DEFAULT (datetime('now'))
  );

  -- Index pour les requêtes fréquentes
  CREATE INDEX IF NOT EXISTS idx_agent_pings_agent    ON agent_pings(agent_id);
  CREATE INDEX IF NOT EXISTS idx_agent_pings_received ON agent_pings(received_at DESC);
  CREATE INDEX IF NOT EXISTS idx_agent_pings_niche    ON agent_pings(niche);

  -- Meilleurs signaux (vue matérialisée simple)
  CREATE TABLE IF NOT EXISTS top_signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    niche       TEXT    NOT NULL,
    best_score  INTEGER,
    total_hits  INTEGER DEFAULT 1,
    last_seen   TEXT,
    verdict     TEXT,
    UNIQUE(niche)
  );
`);

console.log(`  💾 SQLite connecté : ${DB_PATH}`);

// ─────────────────────────────────────────────
// HELPERS DB
// ─────────────────────────────────────────────
const stmtInsertPing = db.prepare(`
  INSERT INTO agent_pings
    (agent_id, status, run, niche, score, verdict, views_est, uptime_s, memory_mb, raw_data)
  VALUES
    (@agent_id, @status, @run, @niche, @score, @verdict, @views_est, @uptime_s, @memory_mb, @raw_data)
`);

const stmtUpsertSignal = db.prepare(`
  INSERT INTO top_signals (niche, best_score, last_seen, verdict)
  VALUES (@niche, @score, @last_seen, @verdict)
  ON CONFLICT(niche) DO UPDATE SET
    best_score = MAX(best_score, excluded.best_score),
    total_hits = total_hits + 1,
    last_seen  = excluded.last_seen,
    verdict    = CASE WHEN excluded.best_score > best_score
                   THEN excluded.verdict
                   ELSE verdict
                 END
`);

const stmtGetRecent = db.prepare(`
  SELECT * FROM agent_pings
  ORDER BY received_at DESC
  LIMIT ?
`);

const stmtGetTopSignals = db.prepare(`
  SELECT * FROM top_signals
  ORDER BY best_score DESC
  LIMIT ?
`);

const stmtGetStats = db.prepare(`
  SELECT
    COUNT(*)                                    AS total_pings,
    COUNT(DISTINCT agent_id)                    AS active_agents,
    COUNT(DISTINCT niche)                       AS niches_tracked,
    ROUND(AVG(score), 1)                        AS avg_score,
    MAX(score)                                  AS best_score,
    MAX(received_at)                            AS last_ping,
    SUM(CASE WHEN verdict = 'FONCER' THEN 1 ELSE 0 END) AS foncer_count
  FROM agent_pings
`);

// ─────────────────────────────────────────────
// ENDPOINT : POST /api/agent/ping
// Reçoit le signal de l'agent, sauvegarde en SQLite
// ─────────────────────────────────────────────
app.post('/api/agent/ping', (req, res) => {
  try {
    const { agent_id, status, run, data, uptime_s, memory_mb } = req.body;

    if (!agent_id || !status) {
      return res.status(400).json({ error: 'agent_id et status requis' });
    }

    const niche   = data?.niche   || null;
    const score   = data?.score   || null;
    const verdict = data?.verdict || null;
    const views   = data?.views_estimate || null;

    // Sauvegarde en base
    const result = stmtInsertPing.run({
      agent_id,
      status,
      run:       run || 0,
      niche,
      score,
      verdict,
      views_est: views,
      uptime_s:  uptime_s || 0,
      memory_mb: memory_mb || 0,
      raw_data:  JSON.stringify(req.body),
    });

    // Mise à jour top signaux si score disponible
    if (niche && score) {
      stmtUpsertSignal.run({
        niche,
        score,
        last_seen: new Date().toISOString(),
        verdict: verdict || 'SURVEILLER',
      });
    }

    console.log(`  📡 PING reçu · ${agent_id} · run #${run} · ${niche ? `"${niche}" score:${score}%` : status}`);

    return res.json({
      ok:         true,
      message:    `Signal reçu · Run #${run} enregistré`,
      ping_id:    result.lastInsertRowid,
      agent_id,
      niche,
      score,
      verdict,
      server_time: new Date().toISOString(),
    });

  } catch (err) {
    console.error('  ❌ /api/agent/ping error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// ENDPOINT : GET /api/agent/history?limit=50
// Dashboard : derniers signaux reçus
// ─────────────────────────────────────────────
app.get('/api/agent/history', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const rows  = stmtGetRecent.all(limit);
    return res.json({ history: rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// ENDPOINT : GET /api/agent/top?limit=20
// Dashboard : meilleurs signaux détectés
// ─────────────────────────────────────────────
app.get('/api/agent/top', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const rows  = stmtGetTopSignals.all(limit);
    return res.json({ top_signals: rows, count: rows.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// ENDPOINT : GET /api/agent/stats
// Dashboard : statistiques globales
// ─────────────────────────────────────────────
app.get('/api/agent/stats', (req, res) => {
  try {
    const stats = stmtGetStats.get();
    return res.json({ stats });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// NOTE FINALE
// ─────────────────────────────────────────────
// Ce fichier est un PATCH. Pour l'intégrer :
//
// 1. npm install better-sqlite3
//
// 2. En haut de swarm-server.js, ajoute :
//    import Database from 'better-sqlite3';
//    import { existsSync } from 'fs';
//
// 3. Colle tout le reste de ce fichier juste
//    AVANT la ligne app.listen(PORT, ...)
//
// 4. Relance : node swarm-server.js
//
// 5. Lance l'agent : node agent_influenceur.js
//
// Tu dois voir dans le terminal du serveur :
//   📡 PING reçu · AGENT-INFLUENCEUR-01 · run #1 · "sérum visage" score:78%
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  const kwCount=Object.values(VIRAL_KEYWORDS).reduce((s,arr)=>s+arr.length,0);
  console.log(`
╔══════════════════════════════════════════════════════╗
║    Swarm Creator Data Engine  v11.0  DUAL AI        ║
╠══════════════════════════════════════════════════════╣
║  🧠 Claude  → Analyse, Scripts, Stratégie           ║
║  ⚡ Gemini  → Keywords, Hooks, Classification        ║
║  💰 Économie estimée : ~67% sur coûts IA            ║
╠══════════════════════════════════════════════════════╣
║  Claude  : ${CLAUDE_KEY?'✅ connecté              ':'❌ manquant                '}║
║  Gemini  : ${GEMINI_KEY?'✅ connecté              ':'⚠️  ajouter GEMINI_API_KEY  '}║
║  Apify   : ${APIFY_KEY?'✅ connecté              ':'❌ manquant                '}║
║  YouTube : ${YT_KEY?'✅ connecté              ':'⚠️  ajouter YOUTUBE_API_KEY '}║
║  Supabase: ${supabaseAdmin?'✅ connecté              ':'⚠️  config manquante       '}║
╠══════════════════════════════════════════════════════╣
║  🔭 POST /api/veille    → Radar viralité            ║
║  🔍 POST /api/scan      → Analyse produit           ║
║  🤖 POST /api/trigger   → Mission agent             ║
║  Keywords: ${kwCount} mots-clés surveillés          ║
╚══════════════════════════════════════════════════════╝
`);
});

process.on('SIGINT',()=>{ console.log('\n🛑 Arrêt...'); process.exit(0); });
process.stdin.resume();