// agent_contenu.js — Agent Contenu v2.0 — SWARM OS
// Transforme les niches de l'Agent Influenceur en contenus Média + Forum

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = 'AGENT-CONTENU-v2.0';
const INTERVAL = 8 * 60 * 1000; // 8 minutes
// ─────────────────────────────────────────────────────────────
// UPDATE AGENT STATUS — MONITORING LIVE
// ─────────────────────────────────────────────────────────────
async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: AGENT_ID.replace('AGENT-', '').replace('-01', '').replace('-v2.5', ''),
      status: status,
      last_ping: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      current_task: currentTask,
      last_error: error ? error.toString() : null,
      version: 'v2.5',
      metadata: {
        interval_minutes: Math.round((CHECK_INTERVAL || 240000) / 60000)
      }
    }, { 
      onConflict: 'agent_id',
      ignoreDuplicates: false 
    });

    console.log(`📡 Agent status updated → ${status}`);
  } catch (err) {
    console.error('Failed to update agent_status:', err.message);
  }
}
// ─────────────────────────────────────────────────────────────
// LOG TO LIVE FEED
// ─────────────────────────────────────────────────────────────
async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })} → ${message}`,
      run_id: `CONTENU-${Date.now()}`
    }]);
  } catch (err) {
    console.error('Erreur logToFeed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// PROMPT SYSTÈME — Agent Contenu (Version renforcée)
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'Agent Contenu de SWARM OS, un stratège de contenu expert.

Ton rôle : Transformer les niches détectées par l'Agent Influenceur en contenus de haute qualité pour le Média (core-ia.fr) et le Forum.

Règles strictes :

1. Vérification mémoire :
   - Vérifie toujours si la niche a déjà été traitée récemment (similarité > 0.75 sur 20 jours).
   - Si oui, propose une variation fraîche.

2. Version Média (core-ia.fr) :
   - Ton expert, éducatif, structuré.
   - Longueur : 1200-2000 mots.
   - Structure Markdown obligatoire : # H1, ## H2 (2-4), ### H3.
   - Inclure listes, exemples concrets, données.

3. Version Forum :
   - Ton proche, conversationnel.
   - Longueur : 400-800 mots.
   - Markdown léger + 3 à 4 questions ouvertes à la fin.

4. Angle de conversion obligatoire :
   - Inclure un angle pour l'App SWARM OS, le Média et le Forum.
   - CTA subtils et variés (lien, "Testez dans le Pipeline", "Rejoignez le forum", etc.).

Output UNIQUEMENT en JSON valide :
{
  "niche_globale": "string",
  "sujet_principal": "string",
  "version_media": {
    "titre": "string",
    "contenu_markdown": "texte complet",
    "meta_description": "string",
    "angle_conversion": { "app": "string", "forum": "string" }
  },
  "version_forum": {
    "titre_thread": "string",
    "contenu_markdown": "texte forum",
    "questions_ouverture": ["Q1", "Q2", "Q3"],
    "angle_conversion": { "app": "string", "media": "string" }
  },
  "deja_traite": boolean,
  "similarite": number
}`;

// ─────────────────────────────────────────────────────────────
// RÉCUPÉRATION DES SIGNAUX
// ─────────────────────────────────────────────────────────────
async function getTopSignals() {
  try {
    const res = await fetch(`${SERVER_URL}/api/agent/top?limit=5`);
    const data = await res.json();
    return data.top_signals || [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION DE CONTENU
// ─────────────────────────────────────────────────────────────
async function generateContent(niche) {
  const userMessage = `Génère les contenus pour la niche suivante : "${niche}"

Priorise :
- Contenu Média (article long, éducatif)
- Contenu Forum (conversationnel avec questions)
- Intègre subtilement la promotion de swarm.core-ia.fr`;

  try {
    const res = await fetch(`${SERVER_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentUnit: 'contenu',
        messages: [{ role: 'user', content: userMessage }],
        _system_override: SYSTEM_PROMPT
      })
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    const clean = text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    return JSON.parse(clean.slice(start, end + 1));

  } catch (err) {
    console.error('Erreur génération contenu:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// BOUCLE PRINCIPALE
// ─────────────────────────────────────────────────────────────
let runCount = 0;

async function mainLoop() {
  runCount++;
  console.log(`\n🤖 [AGENT CONTENU v2.0] Run #${runCount} — Démarrage...`);

  try {
    const topSignals = await getTopSignals();

    if (topSignals.length === 0) {
      await logToFeed('CONTENU', 'Aucun signal Influenceur disponible — attente...');
      return;
    }

    const bestSignal = topSignals[0];
    const niche = bestSignal.niche || 'sérum visage';

    console.log(`   └─ Niche sélectionnée : "${niche}"`);

    // Génération des contenus
    const result = await generateContent(niche);

    if (!result) {
      await logToFeed('CONTENU', `Échec génération pour "${niche}"`);
      return;
    }

    // === AJOUT DEMANDÉ : Enregistrement dans agent_tasks ===
    await supabase.from('agent_tasks').insert([{
      agent_id: AGENT_ID,
      task_type: 'CONTENT_GENERATION',
      status: 'COMPLETED',
      output_data: result,           // Contient le JSON complet (Media + Forum)
      metadata: { 
        niche: niche,
        run_id: `CONTENU-${runCount}`
      }
    }]);

    await logToFeed('CONTENU', `Contenus générés avec succès pour "${niche}"`);

    console.log(`   ✅ Contenus Média + Forum générés et sauvegardés.`);

  } catch (err) {
    console.error(`❌ Run #${runCount} échoué :`, err);
    await logToFeed('CONTENU', `ERREUR : ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║   Agent Contenu v2.0 — SWARM OS                     ║
╠══════════════════════════════════════════════════════╣
║  Intervalle : 8 minutes                             ║
║  Source     : Top signaux Agent Influenceur         ║
║  Destination: Média + Forum + agent_tasks           ║
╚══════════════════════════════════════════════════════╝
`);

console.log('⏳ Attente initiale de 2 minutes...');
setTimeout(() => {
  mainLoop();
  setInterval(mainLoop, INTERVAL);
}, 2 * 60 * 1000);

process.on('SIGINT', () => {
  console.log(`\n🛑 Agent Contenu arrêté après ${runCount} runs.`);
  process.exit(0);
});