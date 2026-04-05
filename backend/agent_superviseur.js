// agent_superviseur.js — Superviseur v1.0 — SWARM OS
// ─────────────────────────────────────────────────────────────
// Orchestrateur central : coordonne Agent Influenceur → Agent Contenu
// Décide d'approuver, rejeter ou demander une révision
// Sauvegarde tout dans Supabase + SQLite
// ─────────────────────────────────────────────────────────────

import 'dotenv/config';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID   = 'AGENT-SUPERVISEUR-01';
const INTERVAL   = 10 * 60 * 1000; // 10 minutes (après Influenceur + Contenu)

const HEADERS = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true',
};

let runCount    = 0;
let cyclesOk    = 0;
let cyclesRej   = 0;

// ─────────────────────────────────────────────────────────────
// PROMPT SYSTÈME — Superviseur SWARM OS
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es le Superviseur de SWARM OS, l'agent orchestrateur central du système.

Ton rôle : coordonner intelligemment le flux entre les agents spécialisés pour maximiser la valeur produite tout en maintenant la cohérence de l'écosystème (Application swarm.core-ia.fr, Média core-ia.fr et Forum).

Agents sous ton contrôle :
- Agent Influenceur → Détecte les niches virales et rentables
- Agent Contenu → Transforme les niches en contenus optimisés pour le Média et le Forum

Règles strictes d'orchestration :

1. Flux de travail :
   - Tu reçois l'output complet de l'Agent Influenceur.
   - Si score_global >= 75 ET exploitation_recente = false → APPROVED → déclenche Agent Contenu.
   - Si score faible ou niche déjà exploitée → REJECTED ou NEEDS_REVISION avec explication.

2. Vérification qualité :
   - Valide que version_media respecte H1/H2/H3 Markdown.
   - Valide que version_forum contient 3-4 questions ouvertes et Markdown léger.
   - Refuse si contenu trop commercial, redondant ou de mauvaise qualité.

3. Promotion intelligente :
   - Chaque contenu doit contenir des angles de conversion naturels vers swarm.core-ia.fr, core-ia.fr et le forum.
   - CTA variés, utiles, jamais agressifs.

4. Réalisme : chiffres précis, comparaisons temporelles.

Output UNIQUEMENT en JSON valide sans markdown ni backticks :
{
  "run_id": "string",
  "timestamp": "ISO string",
  "niche_globale": "string",
  "decision": "APPROVED|REJECTED|NEEDS_REVISION",
  "raison": "string (explication courte)",
  "score_analyse": number,
  "qualite_media": "CONFORME|NON_CONFORME|ABSENT",
  "qualite_forum": "CONFORME|NON_CONFORME|ABSENT",
  "cta_naturels": boolean,
  "actions_declenchees": ["string"],
  "prochaines_etapes": ["string"],
  "recommandations": ["string"],
  "valeur_estimee_cycle": "XX,XX€"
}`;

// ─────────────────────────────────────────────────────────────
// RÉCUPÉRER LES DONNÉES des autres agents
// ─────────────────────────────────────────────────────────────
async function getTopSignals(limit = 3) {
  try {
    const res  = await fetch(`${SERVER_URL}/api/agent/top?limit=${limit}`, { headers: HEADERS });
    const data = await res.json();
    return data.top_signals || [];
  } catch { return []; }
}

async function getRecentHistory(limit = 10) {
  try {
    const res  = await fetch(`${SERVER_URL}/api/agent/history?limit=${limit}`, { headers: HEADERS });
    const data = await res.json();
    return data.history || [];
  } catch { return []; }
}

async function getAgentStats() {
  try {
    const res  = await fetch(`${SERVER_URL}/api/agent/stats`, { headers: HEADERS });
    const data = await res.json();
    return data.stats || {};
  } catch { return {}; }
}

// ─────────────────────────────────────────────────────────────
// ANALYSE SUPERVISOR via Claude
// ─────────────────────────────────────────────────────────────
async function superviseurAnalyse(topSignals, recentHistory, stats) {

  // Construire le contexte complet du cycle
  const influenceurOutputs = topSignals.map(s => ({
    niche:               s.niche,
    score_global:        s.best_score,
    verdict:             s.verdict,
    total_hits:          s.total_hits,
    last_seen:           s.last_seen,
  }));

  // Trouver les outputs de l'Agent Contenu dans l'historique
  const contenuPings = recentHistory.filter(h =>
    h.agent_id === 'AGENT-CONTENU-01' && h.status === 'content_generated'
  );

  const contenuOutputs = contenuPings.slice(0, 3).map(p => {
    const raw = JSON.parse(p.raw_data || '{}');
    return {
      niche:        raw.data?.niche,
      media_titre:  raw.data?.media_titre,
      forum_titre:  raw.data?.forum_titre,
      mots:         raw.data?.media_mots,
      deja_traite:  raw.data?.deja_traite,
      similarite:   raw.data?.similarite,
    };
  });

  const userMessage = `Run #${runCount} — Superviseur SWARM OS

STATS GLOBALES DU SYSTÈME :
- Total pings : ${stats.total_pings || 0}
- Niches trackées : ${stats.niches_tracked || 0}
- Score moyen : ${stats.avg_score || 0}%
- Signaux FONCER : ${stats.foncer_count || 0}
- Agents actifs : ${stats.active_agents || 0}

OUTPUTS AGENT INFLUENCEUR (top signaux) :
${JSON.stringify(influenceurOutputs, null, 2)}

OUTPUTS AGENT CONTENU (derniers cycles) :
${JSON.stringify(contenuOutputs, null, 2)}

Timestamp : ${new Date().toISOString()}
Run ID : RUN-SUPERVISOR-${Date.now()}
Cycles approuvés : ${cyclesOk} | Rejetés : ${cyclesRej}

Analyse la qualité du cycle complet. Prends une décision APPROVED/REJECTED/NEEDS_REVISION.
Génère le JSON structuré de supervision.`;

  const res = await fetch(`${SERVER_URL}/api/trigger`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      agentUnit: 'pipeline',
      product:   'supervision_cycle',
      messages:  [{ role: 'user', content: userMessage }],
      _system_override: SYSTEM_PROMPT,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data.content?.[0]?.text || '';

  try {
    const clean     = text.replace(/```json|```/g, '').trim();
    const jsonStart = clean.indexOf('{');
    const jsonEnd   = clean.lastIndexOf('}');
    return JSON.parse(clean.slice(jsonStart, jsonEnd + 1));
  } catch {
    const decisionM = text.match(/"decision"\s*:\s*"(APPROVED|REJECTED|NEEDS_REVISION)"/);
    return {
      niche_globale:      topSignals[0]?.niche || '—',
      decision:           decisionM ? decisionM[1] : 'NEEDS_REVISION',
      raison:             'Parsing partiel — voir logs',
      actions_declenchees:[],
      prochaines_etapes:  [],
      recommandations:    [],
    };
  }
}

// ─────────────────────────────────────────────────────────────
// PING SERVEUR — rapport superviseur
// ─────────────────────────────────────────────────────────────
async function pingServer(result, topSignals) {
  const payload = {
    agent_id: AGENT_ID,
    status:   'supervision_complete',
    run:      runCount,
    data: {
      niche:             result.niche_globale,
      score:             result.score_analyse,
      verdict:           result.decision,
      views_estimate:    0,
      decision:          result.decision,
      raison:            result.raison,
      qualite_media:     result.qualite_media,
      qualite_forum:     result.qualite_forum,
      cta_naturels:      result.cta_naturels,
      actions:           result.actions_declenchees?.join(' | '),
      prochaines_etapes: result.prochaines_etapes?.join(' | '),
      valeur_cycle:      result.valeur_estimee_cycle,
      cycles_ok:         cyclesOk,
      cycles_rej:        cyclesRej,
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
// AFFICHER LE RAPPORT dans le terminal
// ─────────────────────────────────────────────────────────────
function displayReport(result) {
  const decIcon = {
    APPROVED:       '✅',
    REJECTED:       '❌',
    NEEDS_REVISION: '⚠️',
  }[result.decision] || '❓';

  console.log(`\n   ${decIcon} DÉCISION : ${result.decision}`);
  console.log(`   Raison : ${result.raison}`);
  console.log(`   Niche  : ${result.niche_globale}`);

  if (result.score_analyse) {
    console.log(`   Score analysé : ${result.score_analyse}%`);
  }

  if (result.qualite_media) {
    const mIcon = result.qualite_media === 'CONFORME' ? '✅' : '⚠️';
    const fIcon = result.qualite_forum === 'CONFORME' ? '✅' : '⚠️';
    console.log(`   Qualité Média : ${mIcon} ${result.qualite_media} | Forum : ${fIcon} ${result.qualite_forum}`);
  }

  if (result.cta_naturels !== undefined) {
    console.log(`   CTA naturels : ${result.cta_naturels ? '✅' : '❌'}`);
  }

  if (result.actions_declenchees?.length) {
    console.log(`\n   🚀 Actions :`);
    result.actions_declenchees.forEach(a => console.log(`      • ${a}`));
  }

  if (result.prochaines_etapes?.length) {
    console.log(`\n   📋 Prochaines étapes :`);
    result.prochaines_etapes.slice(0, 3).forEach(e => console.log(`      → ${e}`));
  }

  if (result.recommandations?.length) {
    console.log(`\n   💡 Recommandations :`);
    result.recommandations.slice(0, 2).forEach(r => console.log(`      — ${r}`));
  }

  if (result.valeur_estimee_cycle) {
    console.log(`\n   💰 Valeur du cycle : ${result.valeur_estimee_cycle}`);
  }
}

// ─────────────────────────────────────────────────────────────
// BOUCLE PRINCIPALE
// ─────────────────────────────────────────────────────────────
async function mainLoop() {
  runCount++;
  console.log(`\n👁 [SUPERVISEUR · Run #${runCount}] Analyse du cycle…`);
  console.log(`   Cycles OK: ${cyclesOk} | Rejetés: ${cyclesRej}`);

  try {
    // 1. Récupérer les données de tous les agents
    const [topSignals, recentHistory, stats] = await Promise.all([
      getTopSignals(5),
      getRecentHistory(15),
      getAgentStats(),
    ]);

    console.log(`   └─ ${topSignals.length} signaux · ${recentHistory.length} pings · ${stats.niches_tracked || 0} niches`);

    if (topSignals.length === 0) {
      console.log(`   └─ Aucun signal disponible — attente de l'Agent Influenceur…`);
      return;
    }

    // 2. Analyse Claude
    console.log(`   └─ Supervision via Claude…`);
    const result = await superviseurAnalyse(topSignals, recentHistory, stats);

    // 3. Compteurs
    if (result.decision === 'APPROVED') cyclesOk++;
    else if (result.decision === 'REJECTED') cyclesRej++;

    // 4. Afficher le rapport
    displayReport(result);

    // 5. Ping dashboard
    const pingResp = await pingServer(result, topSignals);
    console.log(`\n✅ Supervision enregistrée · Ping #${pingResp.ping_id || runCount}`);

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
// DÉMARRAGE — attend 4 minutes
// (laisse Influenceur + Contenu travailler en premier)
// ─────────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════╗
║   Superviseur  v1.0  · SWARM OS                     ║
╠══════════════════════════════════════════════════════╣
║  Serveur   : ${SERVER_URL.padEnd(41)}║
║  Intervalle: 10 min · orchestration complète        ║
║  Rôle      : Valide · Approuve · Coordonne          ║
║  Agents    : Influenceur + Contenu                  ║
╚══════════════════════════════════════════════════════╝
`);

console.log('⏳ Attente 4 min — laisse les agents travailler en premier…');
setTimeout(() => {
  mainLoop();
  setInterval(mainLoop, INTERVAL);
}, 4 * 60 * 1000);

process.stdin.resume();
process.on('SIGINT', () => {
  console.log(`\n🛑 Superviseur arrêté · ${cyclesOk} approuvés · ${cyclesRej} rejetés`);
  process.exit(0);
});