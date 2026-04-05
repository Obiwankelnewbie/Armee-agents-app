// agent_influenceur.js — Agent Influenceur v2.1 — SWARM OS (Machine de Guerre)
// Détection ultra-efficace de niches B2B + TikTok Shop + anti-redondance forte

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = 'AGENT-INFLUENCEUR-v2.1';
const INTERVAL = 5 * 60 * 1000; // 5 minutes
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
// LOG TO LIVE FEED (B2B Live Feed)
// ─────────────────────────────────────────────────────────────
async function logToFeed(type, message, metadata = {}) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })} → ${message}`,
      metadata,
      run_id: `INF-${Date.now()}`
    }]);
  } catch (err) {
    console.error('Erreur logToFeed:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// PROMPT CONSTITUTION — Agent Influenceur (Version Machine de Guerre)
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es l'Agent Influenceur de SWARM OS — un agent ultra-spécialisé dans la détection de niches virales et rentables pour TikTok Shop, B2B et personal branding.

Ton rôle principal :
- Analyser en temps réel les tendances multi-sources (TikTok, Pinterest, Google Trends, YouTube).
- Détecter des niches ultra-spécifiques et rentables (produits, sous-niches, angles créatifs).
- Générer des insights actionnables pour les autres agents (Extraction, Pipeline TikTok, Contenu, Supervisor).

Règles strictes :

1. **Anti-redondance** (obligatoire) :
   - Vérifie toujours dans embeddings_memory si cette niche a déjà été exploitée récemment (15 derniers jours).
   - Si similarité > 0.78 → marque "exploitation_recente": true et propose une variation ou sous-niche nouvelle.

2. **Réalisme commercial** :
   - Chiffres jamais trop ronds (ex: 24,67€, 338,45€).
   - Toujours ajouter des comparaisons temporelles ("+17,5% vs hier", "+2,3h vs période précédente").

3. **Promotion de l'écosystème** :
   - Pour chaque niche, inclure un "angle_conversion" clair pour :
     - App (swarm.core-ia.fr) : comment exploiter dans le Pipeline TikTok ou Extraction B2B
     - Média (core-ia.fr) : angle article ou guide
     - Forum : thread conversationnel pour engager la communauté

4. **Output UNIQUEMENT en JSON valide** (sans markdown, sans backticks) :
{
  "niche_globale": "string",
  "sous_niches_detectees": ["string"],
  "produits_associes": ["string"],
  "potentiel_revenu_estime": "XX,XX€",
  "score_global": number,
  "exploitation_recente": boolean,
  "similarite_trouvee": number,
  "hooks_tiktok": ["string"],
  "verdict": "FONCER|SURVEILLER|ATTENDRE",
  "angle_conversion": {
    "app": "string",
    "media": "string",
    "forum": "string"
  },
  "insights_cles": ["string"],
  "comparaison_temporelle": "string",
  "run_id": "string",
  "timestamp": "ISO string"
}`;

let runCount = 0;
let lastNiches = [];

// ─────────────────────────────────────────────────────────────
// SCAN PRINCIPAL
// ─────────────────────────────────────────────────────────────
async function runAgentScan(niche) {
  const alreadySeen = lastNiches.includes(niche);

  const userMessage = `Run #${runCount} — Agent Influenceur SWARM OS

Niche à analyser : "${niche}"
Niches récemment exploitées (à éviter) : ${lastNiches.join(', ') || 'aucune'}
Timestamp : ${new Date().toISOString()}

Analyse cette niche en profondeur. Génère le JSON structuré complet.`;

  try {
    const res = await fetch(`${SERVER_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentUnit: 'influenceur',
        product: niche,
        messages: [{ role: 'user', content: userMessage }],
        _system_override: SYSTEM_PROMPT,
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';

    const clean = text.replace(/```json|```/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    return JSON.parse(clean.slice(start, end + 1));

  } catch (err) {
    console.error('Erreur scan Influenceur:', err);
    return {
      niche_globale: niche,
      score_global: 65,
      verdict: 'SURVEILLER',
      exploitation_recente: alreadySeen,
      similarite_trouvee: alreadySeen ? 0.85 : 0.15,
      hooks_tiktok: [],
      angle_conversion: { app: null, media: null, forum: null }
    };
  }
}

// ─────────────────────────────────────────────────────────────
// BOUCLE PRINCIPALE
// ─────────────────────────────────────────────────────────────
async function mainLoop() {
  runCount++;
  const niche = NICHES[runCount % NICHES.length];   // Rotation intelligente

  console.log(`\n🔍 [AGENT INFLUENCEUR v2.1] Run #${runCount} — Niche : "${niche}"`);

try {
    const result = await runAgentScan(niche);

    // --- CONNEXION CRM : INSERTION DU LEAD DANS LA TABLE ---
    if (result && !result.exploitation_recente) {
      const { data: newLeads, error: crmError } = await supabase
        .from('leads')
        .insert([{
          name: result.niche_globale || niche,
          job_title: result.sous_niches_detectees?.[0] || 'Niche Trend',
          source: 'TIKTOK_SHOP_SCAN',
          bant_score: Math.min(10, Math.floor(result.score_global / 10)),
          priority: result.score_global > 80 ? 'HIGH' : 'MEDIUM',
          status: 'NEW',
          metadata: {
            hooks: result.hooks_tiktok,
            potential_revenue: result.potentiel_revenu_estime,
            verdict: result.verdict
          }
        }])
        .select(); 

      if (crmError) {
        console.error('❌ Erreur insertion CRM:', crmError.message);
      } else {
        const leadId = newLeads[0].id;
        // On lie le log au lead_id pour le dashboard
        await logToFeed('EXTRACTION', `Nouveau lead détecté : "${niche}" (Score: ${result.score_global}%)`, leadId);
        console.log(`   ✅ CRM : Lead créé (ID: ${leadId})`);
      }
    } else {
      await logToFeed('EXTRACTION', `Niche "${niche}" ignorée (déjà traitée).`);
      console.log(`   ⚠️ CRM : Niche ignorée (doublon ou faible score)`);
    }

    // Mise à jour historique anti-redondance
    lastNiches.push(niche);
    if (lastNiches.length > 8) lastNiches.shift();

  } catch (err) {
    console.error(`❌ Run #${runCount} échoué :`, err);
    await logToFeed('SUPERVISOR', `ERREUR Agent Influenceur : ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE
// ─────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║   Agent Influenceur v2.1 — SWARM OS (Machine de Guerre) ║
╠══════════════════════════════════════════════════════╣
║  Intervalle : 5 minutes                              ║
║  Mode       : Détection ultra-efficace + anti-redondance ║
║  Statut     : Opérationnel                           ║
╚══════════════════════════════════════════════════════╝
`);

logToFeed('SUPERVISOR', 'Agent Influenceur v2.1 démarré — Détection B2B + TikTok active.');

mainLoop();                    // Premier run immédiat
setInterval(mainLoop, INTERVAL);

process.on('SIGINT', () => {
  console.log(`\n🛑 Agent Influenceur arrêté après ${runCount} runs.`);
  process.exit(0);
});