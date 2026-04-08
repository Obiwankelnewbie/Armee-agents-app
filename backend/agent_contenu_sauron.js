// ═══════════════════════════════════════════════════════════════
//   ✍️  AGENT CONTENU SAURON — SWARM OS
//   Consomme les signaux de l'Œil → Génère tous les formats
//   Blog · TikTok · Twitter/X · Instagram · Newsletter
//   Domaines : CRYPTO · TREND · MUSIC · SHOP · NEWS
// ═══════════════════════════════════════════════════════════════

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase   = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3333';
const AGENT_ID   = 'AGENT-CONTENU-SAURON-01';
const POLL_MS    = 15_000; // vérifie les signaux toutes les 15s

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════════════
// 📐 FORMATS DE CONTENU PAR DOMAINE
// ═══════════════════════════════════════════════════════════════

// Chaque domaine génère les formats les plus pertinents
const DOMAIN_FORMATS = {
  CRYPTO: ['BLOG', 'TWITTER_THREAD', 'NEWSLETTER'],
  TREND:  ['TIKTOK_SCRIPT', 'INSTAGRAM', 'TWITTER_THREAD'],
  MUSIC:  ['TIKTOK_SCRIPT', 'INSTAGRAM', 'BLOG'],
  SHOP:   ['TIKTOK_SCRIPT', 'INSTAGRAM', 'BLOG'],
  NEWS:   ['BLOG', 'TWITTER_THREAD', 'NEWSLETTER'],
};

// ═══════════════════════════════════════════════════════════════
// 🧠 PROMPTS DE GÉNÉRATION PAR FORMAT
// ═══════════════════════════════════════════════════════════════

function buildPrompt(format, signal) {
  const base = `Signal détecté : ${JSON.stringify(signal)}`;

  const prompts = {

    BLOG: `Tu es un rédacteur web expert SEO et crypto/tech/culture.
Génère un article de blog complet basé sur ce signal.
Réponds UNIQUEMENT en JSON valide :
{
  "format": "BLOG",
  "titre": "Titre accrocheur SEO (60 chars max)",
  "meta_description": "Description SEO 155 chars max",
  "slug": "url-slug-seo",
  "contenu_markdown": "Article complet 1200-2000 mots en Markdown avec ## titres, listes, exemples",
  "tags": ["tag1", "tag2", "tag3"],
  "cta": "Call-to-action final"
}
${base}`,

    TIKTOK_SCRIPT: `Tu es un créateur TikTok viral avec 10M+ followers.
Génère un script TikTok percutant basé sur ce signal.
Réponds UNIQUEMENT en JSON valide :
{
  "format": "TIKTOK_SCRIPT",
  "hook": "Accroche première seconde (max 8 mots, CHOC)",
  "script_complet": "Script 45-60 secondes avec indications [PAUSE] [ZOOM] [TEXT_OVERLAY]",
  "captions": ["caption1", "caption2", "caption3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "son_suggere": "Type de son recommandé (trend/original/silence)",
  "viralite_estimee": "LOW|MEDIUM|HIGH|FIRE"
}
${base}`,

    TWITTER_THREAD: `Tu es un expert Twitter/X avec une audience crypto/tech engagée.
Génère un thread viral basé sur ce signal.
Réponds UNIQUEMENT en JSON valide :
{
  "format": "TWITTER_THREAD",
  "tweet_accroche": "Tweet d'accroche 280 chars max — doit donner envie de lire la suite",
  "tweets": [
    "Tweet 2 (280 chars max)",
    "Tweet 3",
    "Tweet 4",
    "Tweet 5",
    "Tweet 6 — CTA final"
  ],
  "hashtags": ["#tag1", "#tag2"],
  "meilleur_moment_poster": "HH:MM UTC"
}
${base}`,

    INSTAGRAM: `Tu es un créateur Instagram lifestyle/crypto/culture.
Génère un post Instagram optimisé basé sur ce signal.
Réponds UNIQUEMENT en JSON valide :
{
  "format": "INSTAGRAM",
  "caption": "Caption complète avec emojis, max 2200 chars",
  "premiere_ligne": "Accroche visible avant 'voir plus' (125 chars max)",
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"],
  "type_visuel": "CARROUSEL|REELS|IMAGE|STORY",
  "description_visuel": "Description du visuel à créer",
  "stories_sequence": ["Story 1", "Story 2", "Story 3"]
}
${base}`,

    NEWSLETTER: `Tu es un rédacteur de newsletter premium lue par des investisseurs et créateurs.
Génère un email newsletter basé sur ce signal.
Réponds UNIQUEMENT en JSON valide :
{
  "format": "NEWSLETTER",
  "subject_line": "Objet email (50 chars max, taux ouverture maximal)",
  "preview_text": "Prévisualisation 90 chars",
  "corps_html": "Corps complet en HTML propre avec sections, CTA bouton",
  "segment_cible": "CRYPTO|TECH|CULTURE|ALL",
  "cta_principal": "Texte du bouton CTA",
  "cta_url": "URL cible (utilise # si inconnue)"
}
${base}`,
  };

  return prompts[format] ?? prompts.BLOG;
}

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
      run_id:  `CONTENU-${Date.now()}`,
    }]);
  } catch { /* non-fatal */ }
}

async function updateStatus(status, task) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id:     AGENT_ID,
      agent_name:   'Agent Contenu Sauron',
      status,
      last_ping:    new Date().toISOString(),
      current_task: task,
      version:      'v1.0',
    }, { onConflict: 'agent_id' });
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// 💾 SAUVEGARDE & PUBLICATION
// ═══════════════════════════════════════════════════════════════

async function saveContent(signal, format, content, domain) {
  // 1. Toujours sauvegarder dans Supabase (source de vérité)
  const { data, error } = await supabase.from('generated_contents').insert([{
    agent_id:    AGENT_ID,
    domain,
    format,
    signal_id:   signal.id ?? null,
    briefing:    signal.briefing ?? signal.title ?? '',
    content:     JSON.stringify(content),
    status:      'PENDING_REVIEW',   // validation manuelle possible
    created_at:  new Date().toISOString(),
  }]).select().single();

  if (error) {
    console.error(`   ❌ Save échoué :`, error.message);
    return null;
  }

  console.log(`   💾 Sauvegardé → generated_contents #${data?.id ?? '?'}`);

  // 2. Notifier la Main de Sauron que le contenu est prêt
  await supabase.from('agent_briefings').insert([{
    source_agent: AGENT_ID,
    target_agent: 'AGENT-MAIN-SAURON-01',
    content: JSON.stringify({
      action:      'CONTENT_READY',
      format,
      domain,
      content_id:  data?.id,
      briefing:    signal.briefing ?? signal.title ?? '',
      summary:     content.titre ?? content.tweet_accroche ?? content.hook ?? '',
    }),
    priority:   'HIGH',
    processed:  false,
    created_at: new Date().toISOString(),
  }]);
  console.log(`   🖐️  Main de Sauron notifiée`);

  // 3. Publication automatique selon format
  await publishContent(format, content, domain, data?.id);

  return data;
}

async function publishContent(format, content, domain, contentId) {
  switch (format) {

    case 'TWITTER_THREAD':
      await publishTwitterThread(content, contentId);
      break;

    case 'BLOG':
      await publishBlog(content, contentId);
      break;

    case 'NEWSLETTER':
      await scheduleNewsletter(content, contentId);
      break;

    case 'TIKTOK_SCRIPT':
    case 'INSTAGRAM':
      // Ces formats nécessitent un visuel → on les met en file d'attente créative
      await queueForCreative(format, content, contentId);
      break;
  }
}

// ── Twitter/X ─────────────────────────────────────────────────
async function publishTwitterThread(content, contentId) {
  // Si token Twitter configuré → publication directe
  if (process.env.TWITTER_BEARER_TOKEN && process.env.TWITTER_API_KEY) {
    try {
      // Publication du tweet d'accroche (les suivants en réponse)
      console.log(`   🐦 Twitter : publication du thread…`);

      let lastTweetId = null;

      const allTweets = [content.tweet_accroche, ...(content.tweets ?? [])];

      for (const tweet of allTweets) {
        if (!tweet) continue;

        const body = lastTweetId
          ? { text: tweet, reply: { in_reply_to_tweet_id: lastTweetId } }
          : { text: tweet };

        const res = await fetch('https://api.twitter.com/2/tweets', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          lastTweetId = data.data?.id;
          console.log(`   ✅ Tweet publié : ${tweet.slice(0, 50)}…`);
        } else {
          console.warn(`   ⚠️  Tweet échoué : ${res.status}`);
        }

        await sleep(1500); // Respect rate limit Twitter
      }

      // Marquer comme publié
      await supabase.from('generated_contents')
        .update({ status: 'PUBLISHED', published_at: new Date().toISOString() })
        .eq('id', contentId);

      await logToFeed('CONTENU', `Thread Twitter publié (${allTweets.length} tweets)`);

    } catch (err) {
      console.error(`   ❌ Twitter publish failed :`, err.message);
      await queueForCreative('TWITTER_THREAD', content, contentId);
    }

  } else {
    // Pas de token → file d'attente
    console.log(`   📋 Twitter : mis en file (pas de token configuré)`);
    await queueForCreative('TWITTER_THREAD', content, contentId);
  }
}

// ── Blog / WordPress ──────────────────────────────────────────
async function publishBlog(content, contentId) {
  if (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD) {
    try {
      console.log(`   📝 WordPress : publication en cours…`);

      const credentials = Buffer.from(`${process.env.WP_USER}:${process.env.WP_APP_PASSWORD}`).toString('base64');

      const res = await fetch(`${process.env.WP_URL}/wp-json/wp/v2/posts`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Basic ${credentials}`,
        },
        body: JSON.stringify({
          title:   content.titre,
          content: content.contenu_markdown,
          excerpt: content.meta_description,
          slug:    content.slug,
          status:  'draft',   // 'publish' pour publier direct
          tags:    content.tags ?? [],
        }),
      });

      if (res.ok) {
        const post = await res.json();
        console.log(`   ✅ Article WordPress créé : ${post.link}`);
        await supabase.from('generated_contents')
          .update({ status: 'PUBLISHED', published_url: post.link, published_at: new Date().toISOString() })
          .eq('id', contentId);
        await logToFeed('CONTENU', `Article blog créé : ${content.titre}`);
      } else {
        throw new Error(`WP HTTP ${res.status}`);
      }

    } catch (err) {
      console.error(`   ❌ WordPress publish failed :`, err.message);
      await queueForCreative('BLOG', content, contentId);
    }

  } else {
    console.log(`   📋 Blog : mis en file (WP_URL non configuré)`);
    await queueForCreative('BLOG', content, contentId);
  }
}

// ── Newsletter (Brevo / Mailchimp) ────────────────────────────
async function scheduleNewsletter(content, contentId) {
  if (process.env.BREVO_API_KEY) {
    try {
      console.log(`   📧 Brevo : création de la campagne…`);

      const res = await fetch('https://api.brevo.com/v3/emailCampaigns', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key':      process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          name:        `[SAURON] ${content.subject_line}`,
          subject:     content.subject_line,
          previewText: content.preview_text,
          type:        'classic',
          htmlContent: content.corps_html,
          sender:      { name: process.env.NEWSLETTER_SENDER_NAME || 'SWARM OS', email: process.env.NEWSLETTER_SENDER_EMAIL },
          recipients:  { listIds: [Number(process.env.BREVO_LIST_ID || 1)] },
          scheduledAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // dans 30 min
        }),
      });

      if (res.ok) {
        const campaign = await res.json();
        console.log(`   ✅ Newsletter planifiée : ID ${campaign.id}`);
        await supabase.from('generated_contents')
          .update({ status: 'SCHEDULED', published_at: new Date().toISOString() })
          .eq('id', contentId);
        await logToFeed('CONTENU', `Newsletter planifiée : ${content.subject_line}`);
      } else {
        throw new Error(`Brevo HTTP ${res.status}`);
      }

    } catch (err) {
      console.error(`   ❌ Newsletter failed :`, err.message);
      await queueForCreative('NEWSLETTER', content, contentId);
    }

  } else {
    console.log(`   📋 Newsletter : mis en file (BREVO_API_KEY non configuré)`);
    await queueForCreative('NEWSLETTER', content, contentId);
  }
}

// ── File d'attente créative (TikTok, Instagram, non publiables auto) ──
async function queueForCreative(format, content, contentId) {
  await supabase.from('content_queue').insert([{
    content_id:  contentId,
    format,
    status:      'AWAITING_CREATIVE',
    payload:     JSON.stringify(content),
    created_at:  new Date().toISOString(),
  }]);
  console.log(`   📋 [${format}] Mis en file content_queue`);
}

// ═══════════════════════════════════════════════════════════════
// ⚙️  TRAITEMENT D'UN SIGNAL
// ═══════════════════════════════════════════════════════════════

async function processSignal(briefing) {
  let signal;
  try {
    signal = typeof briefing.content === 'string'
      ? JSON.parse(briefing.content)
      : briefing.content;
  } catch {
    console.warn(`⚠️  Signal #${briefing.id?.slice(0,8)} — JSON invalide`);
    return;
  }

  const domain  = signal.domain ?? 'NEWS';
  const formats = DOMAIN_FORMATS[domain] ?? ['BLOG', 'TWITTER_THREAD'];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✍️  Signal [${domain}] → ${formats.length} formats à générer`);
  console.log(`   Briefing : ${signal.briefing ?? signal.title ?? 'N/A'}`);

  for (const format of formats) {
    console.log(`\n   🔄 Génération [${format}]…`);

    try {
      const prompt  = buildPrompt(format, signal);
      const content = await callSwarm(prompt, `Génère le contenu ${format} pour ce signal.`);

      if (!content) {
        console.warn(`   ⚠️  [${format}] IA non parsable — ignoré`);
        continue;
      }

     // --- INJECTION REFERRAL ---
      const referralLink = process.env.BINANCE_REF_LINK;
      if (referralLink && (domain === 'CRYPTO' || domain === 'TREND')) {
        content += `\n\n👉 Profitez de cette opportunité sur Binance : ${referralLink}`;
      }
      // --------------------------- 
      console.log(`   ✅ [${format}] Généré`);
      await saveContent(signal, format, content, domain);
      await sleep(2000); // Pause entre chaque format

    } catch (err) {
      console.error(`   ❌ [${format}] Échec :`, err.message);
    }
  }

  await logToFeed('CONTENU', `[${domain}] ${formats.length} contenus générés`);
}

// ═══════════════════════════════════════════════════════════════
// 🔄 BOUCLE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

let totalGenerated = 0;

async function mainLoop() {
  try {
    const { data, error } = await supabase
      .from('agent_briefings')
      .select('*')
      .eq('target_agent', AGENT_ID)
      .eq('processed', false)
      .order('priority', { ascending: false }) // URGENT en premier
      .order('created_at', { ascending: true })
      .limit(3);

    if (error) throw error;

    if (data?.length) {
      console.log(`\n📥 ${data.length} signal(s) reçu(s) de l'Œil de Sauron`);
      await updateStatus('BUSY', `Génération de contenu (${data.length} signaux)`);

      for (const briefing of data) {
        await processSignal(briefing);
        totalGenerated++;

        await supabase
          .from('agent_briefings')
          .update({ processed: true })
          .eq('id', briefing.id);
      }

      await updateStatus('ONLINE', `Veille — ${totalGenerated} contenus générés`);
    }

  } catch (err) {
    console.error('❌ Erreur boucle :', err.message);
    await updateStatus('ERROR', err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

async function start() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   ✍️   AGENT CONTENU SAURON — SWARM OS  v1.0               ║
╠══════════════════════════════════════════════════════════════╣
║  Formats   : Blog · TikTok · Twitter · Instagram · News     ║
║  Domaines  : CRYPTO · TREND · MUSIC · SHOP · NEWS           ║
║  Publie    : WordPress · Twitter/X · Brevo · Queue          ║
╚══════════════════════════════════════════════════════════════╝

Variables d'env pour la publication automatique :
  TWITTER_BEARER_TOKEN + TWITTER_API_KEY  → Thread Twitter
  WP_URL + WP_USER + WP_APP_PASSWORD      → Blog WordPress
  BREVO_API_KEY + BREVO_LIST_ID           → Newsletter
  (Sans ces vars → stockage Supabase + content_queue)
`);

  await updateStatus('ONLINE', 'Démarrage');

  // Boucle principale
  await mainLoop();
  setInterval(mainLoop, POLL_MS);

  // Ping de vie toutes les 60s
  setInterval(() => updateStatus('ONLINE', `Veille — ${totalGenerated} contenus générés`), 60_000);
}

start().catch(err => {
  console.error('💀 Erreur fatale Agent Contenu :', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log(`\n✍️  Agent Contenu arrêté — ${totalGenerated} contenus générés cette session.`);
  process.exit(0);
});