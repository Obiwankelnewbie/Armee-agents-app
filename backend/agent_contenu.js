// agent_contenu.js — Agent Contenu v1.0 — SWARM OS
// ─────────────────────────────────────────────────────────────
// Transforme les niches détectées par l'Agent Influenceur
// en contenus publiables (LinkedIn, X, TikTok, Article SEO)
// S'appuie sur les top signaux SQLite pour prioriser
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID   = 'AGENT-CONTENU-01';
const INTERVAL   = 8 * 60 * 1000; // 8 minutes (décalé par rapport à l'influenceur)

const HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

let runCount = 0;

// ─────────────────────────────────────────────────────────────
// PROMPT SYSTÈME — Agent Contenu SWARM OS
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'Agent Contenu de SWARM OS, un agent stratège de contenu chargé de transformer les niches détectées par l'Agent Influenceur en contenus de haute qualité pour le Média Core IA (core-ia.fr) et le Forum communautaire.

Ton rôle : Créer de la valeur réelle tout en promouvant subtilement SWARM OS (swarm.core-ia.fr), le média et le forum.

Règles strictes :

1. Vérification de la mémoire :
   - Si une niche similaire a déjà été traitée récemment (similarité > 0.75 sur 20 derniers jours), propose une variation fraîche.
   - Indique dans l'output : "deja_traite": boolean, "similarite": number

2. Version Média (core-ia.fr) :
   - Ton expert, éducatif, structuré et SEO-friendly.
   - Longueur cible : 1200-2000 mots.
   - Structure obligatoire en Markdown :
     * 1x # H1 (titre principal)
     * 2 à 4x ## H2 (sections principales)
     * ### H3 pour sous-points et exemples
   - Inclure des listes, exemples concrets et données actionnables.

3. Version Forum :
   - Ton proche, conversationnel et engageant.
   - Longueur cible : 400-800 mots.
   - Markdown léger : gras, italique, listes à puces, lignes vides pour aérer.
   - Terminer par 3 à 4 questions ouvertes pour stimuler le débat.

4. Angle de conversion + CTA dynamique :
   - Pour chaque contenu, inclure un "angle_conversion" pour l'App SWARM OS, le Média et le Forum.
   - CTA variés et naturels (jamais trop commercial) :
     * Parfois lien direct vers swarm.core-ia.fr
     * Parfois "Testez cette niche dans le Pipeline de SWARM OS"
     * Parfois "Rejoignez la discussion sur le forum"
     * Parfois "Inscrivez-vous à la bêta" ou "Découvrez l'outil ici"
   - Le CTA doit rester subtil et utile pour le lecteur.

5. Réalisme : chiffres jamais trop ronds, comparaisons temporelles obligatoires.

Output UNIQUEMENT en JSON valide sans markdown ni backticks :
{
  "niche_globale": "string",
  "sujet_principal": "string",
  "version_media": {
    "titre": "string",
    "contenu_markdown": "Texte complet 1200-2000 mots avec # ## ### ...",
    "meta_description": "string (160 caractères max)",
    "angle_conversion": { "app": "string", "forum": "string" }
  },
  "version_forum": {
    "titre_thread": "string",
    "contenu_markdown": "Texte forum 400-800 mots aéré avec Markdown léger",
    "questions_ouverture": ["Q1", "Q2", "Q3", "Q4"],
    "angle_conversion": { "app": "string", "media": "string" }
  },
  "deja_traite": boolean,
  "similarite": number,
  "run_id": "string",
  "timestamp": "ISO string"
}`;

// ─────────────────────────────────────────────────────────────
// RÉCUPÉRER LES TOP SIGNAUX de l'Agent Influenceur
// ─────────────────────────────────────────────────────────────
async function getTopSignals() {
  try {
    const res  = await fetch(`${SERVER_URL}/api/agent/top?limit=5`, { headers: HEADERS });
    const data = await res.json();
    return data.top_signals || [];
  } catch {
    return [];
  }
}

async function getRecentPings() {
  try {
    const res  = await fetch(`${SERVER_URL}/api/agent/history?limit=3`, { headers: HEADERS });
    const data = await res.json();
    return data.history || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRER LES CONTENUS via Claude
// ─────────────────────────────────────────────────────────────
async function generateContent(niche, score, verdict) {
  const userMessage = `Run #${runCount} — Agent Contenu SWARM OS

Niche à traiter : "${niche}"
Score viral détecté : ${score}%
Verdict Agent Influenceur : ${verdict}
Timestamp : ${new Date().toISOString()}
Run ID : RUN-CONTENU-${Date.now()}

Génère 5 contenus multi-canal complets et immédiatement publiables pour cette niche.
Priorité : TikTok Shop (UGC natif) + LinkedIn B2B + Article core-ia.fr
Intègre naturellement la promotion de swarm.core-ia.fr dans le contenu LinkedIn.`;

  const res = await fetch(`${SERVER_URL}/api/trigger`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      agentUnit: 'clone',
      product: niche,
      messages: [{ role: 'user', content: userMessage }],
      _system_override: SYSTEM_PROMPT,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean      = text.replace(/```json|```/g, '').trim();
    const jsonStart  = clean.indexOf('{');
    const jsonEnd    = clean.lastIndexOf('}');
    return JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
  } catch {
    // Fallback si JSON mal formé
    return {
      niche,
      contenus: [{ canal: 'TikTok', texte: text.slice(0, 500), angle: 'ugc' }],
      strategie_globale: 'Contenu généré — JSON parsing partiel',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// PING SERVEUR avec les contenus générés
// ─────────────────────────────────────────────────────────────
async function pingServer(niche, score, verdict, result) {
  const media = result.version_media;
  const forum = result.version_forum;

  const payload = {
    agent_id: AGENT_ID,
    status:   'content_generated',
    run:      runCount,
    data: {
      niche,
      score,
      verdict,
      views_estimate:    Math.floor(Math.random() * 500000) + 50000,
      // Média
      media_titre:       media?.titre,
      media_mots:        media?.contenu_markdown?.split(' ').length || 0,
      meta_description:  media?.meta_description,
      // Forum
      forum_titre:       forum?.titre_thread,
      forum_questions:   forum?.questions_ouverture?.length || 0,
      // Anti-redondance
      deja_traite:       result.deja_traite,
      similarite:        result.similarite,
      sujet:             result.sujet_principal,
    },
    uptime_s:  process.uptime(),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  };

  const res = await fetch(`${SERVER_URL}/api/agent/ping`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify(payload),
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// AFFICHER LES CONTENUS dans le terminal
// ─────────────────────────────────────────────────────────────
function displayContent(result) {
  const media = result.version_media;
  const forum = result.version_forum;

  console.log(`\n   📰 VERSION MÉDIA (core-ia.fr)`);
  if (media?.titre) {
    console.log(`   Titre : "${media.titre}"`);
    console.log(`   Meta  : ${(media.meta_description || '').slice(0, 80)}…`);
    console.log(`   Contenu : ${(media.contenu_markdown || '').slice(0, 150).replace(/\n/g,' ')}…`);
    if (media.angle_conversion?.app) console.log(`   App angle : ${media.angle_conversion.app.slice(0,80)}…`);
  }

  console.log(`\n   💬 VERSION FORUM`);
  if (forum?.titre_thread) {
    console.log(`   Thread : "${forum.titre_thread}"`);
    console.log(`   Contenu : ${(forum.contenu_markdown || '').slice(0, 150).replace(/\n/g,' ')}…`);
    if (forum.questions_ouverture?.length) {
      console.log(`   Questions : ${forum.questions_ouverture.slice(0,2).join(' | ')}`);
    }
  }

  console.log(`\n   🔍 Déjà traité : ${result.deja_traite ? '⚠ OUI (similarité '+result.similarite+')' : '✓ NON'}`);
  if (result.sujet_principal) console.log(`   Sujet : ${result.sujet_principal}`);
}

// ─────────────────────────────────────────────────────────────
// BOUCLE PRINCIPALE
// ─────────────────────────────────────────────────────────────
async function mainLoop() {
  runCount++;
  console.log(`\n🤖 [AGENT CONTENU · Run #${runCount}] Démarrage…`);

  try {
    // 1. Récupérer le meilleur signal de l'Agent Influenceur
    const topSignals = await getTopSignals();
    const recentPings = await getRecentPings();

    let niche, score, verdict;

    if (topSignals.length > 0) {
      // Prend le top signal avec le meilleur score FONCER
      const best = topSignals.find(s => s.verdict === 'FONCER') || topSignals[0];
      niche   = best.niche;
      score   = best.best_score;
      verdict = best.verdict;
      console.log(`   └─ Signal reçu de l'Agent Influenceur : "${niche}" (${score}% · ${verdict})`);
    } else if (recentPings.length > 0) {
      // Fallback sur le ping le plus récent
      const last = recentPings[0];
      niche   = last.niche || 'sérum visage';
      score   = last.score || 70;
      verdict = last.verdict || 'SURVEILLER';
      console.log(`   └─ Ping récent utilisé : "${niche}"`);
    } else {
      // Aucun signal — niche par défaut
      niche   = 'sérum vitamine C visage';
      score   = 72;
      verdict = 'FONCER';
      console.log(`   └─ Aucun signal disponible — niche par défaut : "${niche}"`);
    }

    console.log(`   └─ Génération contenus via Claude…`);

    // 2. Générer les contenus
    const result = await generateContent(niche, score, verdict);

    // 3. Afficher dans le terminal
    displayContent(result);

    // 4. Ping dashboard
    const pingResp = await pingServer(niche, score, verdict, result);
    const nbMots = result.version_media?.contenu_markdown?.split(' ').length || 0;
    console.log(`\n✅ Dashboard mis à jour · Ping #${pingResp.ping_id || runCount} · Média: ${nbMots} mots · Forum: ${result.version_forum?.questions_ouverture?.length || 0} questions`);

  } catch (err) {
    console.error(`❌ Run #${runCount} échoué — ${err.message}`);
    try {
      await fetch(`${SERVER_URL}/api/agent/ping`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({
          agent_id: AGENT_ID, status: 'error_recovery', run: runCount,
          data: { niche: '—', score: null, verdict: 'ERREUR', error: err.message },
          uptime_s: process.uptime(),
          memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        }),
      });
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║   Agent Contenu  v1.0  · SWARM OS                   ║
╠══════════════════════════════════════════════════════╣
║  Serveur   : ${SERVER_URL.padEnd(41)}║
║  Intervalle: 8 min · décalé Agent Influenceur       ║
║  Canaux    : TikTok · LinkedIn · X · Article · Forum║
║  Source    : Top signaux Agent Influenceur (SQLite)  ║
╚══════════════════════════════════════════════════════╝
`);

// Attendre 2 minutes avant le premier run
// (laisse l'Agent Influenceur détecter d'abord)
console.log('⏳ Attente 2 min — laisse l\'Agent Influenceur détecter les signaux…');
setTimeout(() => {
  mainLoop();
  setInterval(mainLoop, INTERVAL);
}, 2 * 60 * 1000);

process.stdin.resume();
process.on('SIGINT', () => {
  console.log(`\n🛑 Agent Contenu arrêté après ${runCount} runs.`);
  process.exit(0);
});