// ═══════════════════════════════════════════════════════════════
//   SWARM OS — SERVEUR BACKEND
//   Express ESM · Supabase · PM2 · Agents
//   Version : 2.0
// ═══════════════════════════════════════════════════════════════

import express       from 'express';
import path          from 'path';
import cors          from 'cors';
import dotenv        from 'dotenv';
import { fileURLToPath } from 'url';
import { createClient }  from '@supabase/supabase-js';
import { exec, spawn }   from 'child_process';
import { promisify }     from 'util';

const execAsync = promisify(exec);

// ── Config ESM ───────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Supabase ─────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname));

// ═══════════════════════════════════════════════════════════════
// REGISTRE DES AGENTS — ordre de boot séquentiel
// ═══════════════════════════════════════════════════════════════

const AGENTS = [
  { id: 'AGENT-ANCALAGONE-01', name: 'Ancalagone',  script: 'ancalagone.js',  critical: true  },
  { id: 'AGENT-ARGUS-01',      name: 'Argus',        script: 'argus.js',       critical: true  },
  { id: 'AGENT-GENERAL-01',    name: 'Le Général',   script: 'le_general.js',  critical: true  },
  { id: 'AGENT-STRATEGE-01',   name: 'Le Stratège',  script: 'le_stratege.js', critical: false },
  { id: 'AGENT-NEXO-01',       name: 'Nexo',         script: 'nexo.js',        critical: false },
  { id: 'AGENT-TRADER-01',     name: 'Le Trader',    script: 'le_trader.js',   critical: false },
  { id: 'AGENT-EXECUTOR-01',   name: "L'Executor",   script: 'le_executor.js', critical: false },
];

// ── Helper : démarrer un agent ───────────────────────────────
async function startAgent(script, name) {
  // Tente PM2 en premier
  try {
    await execAsync(`pm2 restart ${name} 2>/dev/null || pm2 start ${script} --name ${name}`);
    return { method: 'pm2', success: true };
  } catch {
    // Fallback : spawn Node direct (détaché)
    try {
      const child = spawn('node', [script], {
        detached: true,
        stdio:    'ignore',
        cwd:      __dirname,
      });
      child.unref();
      return { method: 'spawn', pid: child.pid, success: true };
    } catch (err) {
      return { method: 'none', success: false, error: err.message };
    }
  }
}

// ── Helper : arrêter un agent ────────────────────────────────
async function stopAgent(name) {
  try {
    await execAsync(`pm2 stop ${name} 2>/dev/null`);
    return { success: true };
  } catch {
    return { success: false };
  }
}

// ── Helper : log dans live_feed_events ───────────────────────
async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id:  `SERVER-${Date.now()}`,
      created_at: new Date().toISOString(),
    }]);
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES — SANTÉ & STATUS
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/status', (req, res) => {
  res.json({
    status:          'online',
    agents_reachable: true,
    database:        'connected',
    version:         '2.0',
    uptime:          Math.floor(process.uptime()),
    timestamp:       new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — SWARM CONTROL
// ═══════════════════════════════════════════════════════════════

// Démarrer UN agent
app.post('/api/swarm/start', async (req, res) => {
  const { script, name } = req.body;

  if (!script || !name) {
    return res.status(400).json({ error: 'script et name requis' });
  }

  const result = await startAgent(script, name);
  await logToFeed('SERVER', `Démarrage ${name} via dashboard (${result.method})`);

  res.json({ success: result.success, ...result });
});

// Arrêter UN agent
app.post('/api/swarm/stop-one', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name requis' });

  const result = await stopAgent(name);
  await logToFeed('SERVER', `Arrêt ${name} via dashboard`);
  res.json(result);
});

// Démarrage séquentiel COMPLET du swarm
// (avec délais entre chaque agent pour ne pas surcharger)
app.post('/api/swarm/boot', async (req, res) => {
  res.json({ success: true, message: 'Boot séquentiel lancé en arrière-plan' });

  // Exécution asynchrone — la réponse est déjà envoyée
  (async () => {
    await logToFeed('SERVER', 'Séquence de boot swarm initiée depuis le dashboard');

    const DELAYS = [0, 2000, 2500, 2000, 1800, 2200, 1500];

    for (let i = 0; i < AGENTS.length; i++) {
      const agent = AGENTS[i];
      await new Promise(r => setTimeout(r, DELAYS[i] || 1500));

      console.log(`🚀 [SERVER] Boot ${i+1}/${AGENTS.length} : ${agent.name}`);
      const result = await startAgent(agent.script, agent.id);

      await logToFeed('SERVER',
        result.success
          ? `${agent.name} démarré (${result.method})`
          : `${agent.name} ÉCHEC : ${result.error}`
      );
    }

    await logToFeed('SERVER', 'Boot swarm complet — tous les agents lancés');
    console.log('✅ [SERVER] Boot swarm complet');
  })();
});

// Arrêter TOUS les agents
app.post('/api/swarm/stop-all', async (req, res) => {
  const results = [];

  for (const agent of AGENTS) {
    const r = await stopAgent(agent.id);
    results.push({ name: agent.name, ...r });
  }

  await logToFeed('SERVER', 'Arrêt complet du swarm depuis le dashboard');
  res.json({ success: true, results });
});

// Statut de tous les agents (depuis Supabase)
app.get('/api/swarm/status', async (req, res) => {
  const { data, error } = await supabase
    .from('agent_status')
    .select('agent_id, agent_name, status, current_task, last_ping, uptime_seconds, memory_mb, version')
    .in('agent_id', AGENTS.map(a => a.id));

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — DONNÉES DASHBOARD
// ═══════════════════════════════════════════════════════════════

// Signaux trader privés
app.get('/api/signals', async (req, res) => {
  const { data, error } = await supabase
    .from('private_trader_signals')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// Live feed
app.get('/api/feed', async (req, res) => {
  const limit = parseInt(req.query.limit) || 40;
  const { data, error } = await supabase
    .from('live_feed_events')
    .select('id, type, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// Mirror Memory d'Ancalagone
app.get('/api/mirror', async (req, res) => {
  const { data, error } = await supabase
    .from('ancalagone_mirror')
    .select('*')
    .eq('mirror_key', 'CURRENT')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? null);
});

// KPIs 24h
app.get('/api/kpis', async (req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();

  const [signalsRes, contentsRes, leadsRes, tradesRes] = await Promise.allSettled([
    supabase.from('agent_briefings')
      .select('id', { count: 'exact', head: true })
      .eq('process_status', 'ROUTED')
      .gte('created_at', since24h),
    supabase.from('generated_contents')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'READY')
      .gte('created_at', since24h),
    supabase.from('leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since24h),
    supabase.from('private_trader_signals')
      .select('id', { count: 'exact', head: true })
      .eq('verdict', 'BUY')
      .gte('scanned_at', since24h),
  ]);

  res.json({
    signals:  signalsRes.status  === 'fulfilled' ? (signalsRes.value.count  ?? 0) : 0,
    contents: contentsRes.status === 'fulfilled' ? (contentsRes.value.count ?? 0) : 0,
    leads:    leadsRes.status    === 'fulfilled' ? (leadsRes.value.count    ?? 0) : 0,
    trades:   tradesRes.status   === 'fulfilled' ? (tradesRes.value.count   ?? 0) : 0,
  });
});

// Contenus Nexo prêts à poster
app.get('/api/contents', async (req, res) => {
  const { data, error } = await supabase
    .from('generated_contents')
    .select('id, domain, angle_nexo, posts, meilleur_moment, longevite, status, created_at')
    .eq('status', 'READY')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// Marquer un contenu comme posté
app.post('/api/contents/:id/posted', async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('generated_contents')
    .update({ status: 'POSTED', posted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });

  await logToFeed('NEXO', `Contenu ${id} marqué POSTED depuis le dashboard`);
  res.json({ success: true });
});

// Leads CRM récents
app.get('/api/leads', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, status, niche, bant_score, source, created_at')
    .order('bant_score', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ── Déclencheur LLM (existant — conservé tel quel) ──────────
app.post('/api/trigger', async (req, res) => {
  const { agent_id, prompt, user_message } = req.body;

  // Assurez-vous d'avoir installé le SDK OpenAI : npm install openai
const openai = new (require('openai'))({
    baseURL: "http://localhost:1234/v1",
    apiKey: "lm-studio",
  });

  const response = await openai.chat.completions.create({
    model: "meta-llama-3.1-8b-instruct",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: user_message }
    ],
    temperature: 0.7,
  });

  return res.json({ text: response.choices[0].message.content });

  res.json({ text: '', agent_id });
});

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🔷  SWARM OS — SERVEUR v2.0                               ║
╠══════════════════════════════════════════════════════════════╣
║  Port     : ${String(PORT).padEnd(47)}║
║  Routes   : /api/swarm/* · /api/signals · /api/feed         ║
║             /api/mirror · /api/kpis · /api/contents         ║
║             /api/leads · /api/trigger                       ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;