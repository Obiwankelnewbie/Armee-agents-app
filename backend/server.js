// ═══════════════════════════════════════════════════════════════
//   SWARM OS — SERVEUR BACKEND v2.1
//   Express ESM · Supabase · PM2 · LM Studio
//
//   .env backend requis :
//     SUPABASE_URL=...
//     SUPABASE_ANON_KEY=...
//     LLM_URL=http://127.0.0.1:1234
//     LLM_MODEL=local-model
//     LLM_MAX_TOKENS=1000
//     PORT=3000
// ═══════════════════════════════════════════════════════════════

import express           from 'express';
import path              from 'path';
import cors              from 'cors';
import dotenv            from 'dotenv';
import { fileURLToPath } from 'url';
import { createClient }  from '@supabase/supabase-js';
import { exec, spawn }   from 'child_process';
import { promisify }     from 'util';

dotenv.config();

const execAsync  = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

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
// AGENTS — ordre de boot
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

const BOOT_DELAYS = [0, 2000, 2500, 2000, 1800, 2200, 1500];

// ── Helpers agents ───────────────────────────────────────────

async function startAgent(script, name) {
  try {
    await execAsync(`pm2 restart ${name} 2>/dev/null || pm2 start ${script} --name ${name}`);
    return { method: 'pm2', success: true };
  } catch {
    try {
      const child = spawn('node', [script], { detached: true, stdio: 'ignore', cwd: __dirname });
      child.unref();
      return { method: 'spawn', pid: child.pid, success: true };
    } catch (err) {
      return { method: 'none', success: false, error: err.message };
    }
  }
}

async function stopAgent(name) {
  try {
    await execAsync(`pm2 stop ${name} 2>/dev/null`);
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message:    `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id:     `SERVER-${Date.now()}`,
      created_at: new Date().toISOString(),
    }]);
  } catch { /* non-fatal */ }
}

// ═══════════════════════════════════════════════════════════════
// ROUTES — SANTÉ
// ═══════════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/status', (req, res) => {
  res.json({
    status:           'online',
    agents_reachable: true,
    database:         'connected',
    llm:              process.env.LLM_URL || 'http://127.0.0.1:1234',
    version:          '2.1',
    uptime:           Math.floor(process.uptime()),
    timestamp:        new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════
// ROUTE LLM — LM Studio (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════

app.post('/api/trigger', async (req, res) => {
  const { agent_id, prompt, user_message } = req.body;

  if (!prompt && !user_message) {
    return res.status(400).json({ error: 'prompt ou user_message requis' });
  }

  const LLM_URL    = process.env.LLM_URL    || 'http://127.0.0.1:1234';
  const LLM_MODEL  = process.env.LLM_MODEL  || 'local-model';
  const MAX_TOKENS = parseInt(process.env.LLM_MAX_TOKENS || '1000');

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(`${LLM_URL}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        model:       LLM_MODEL,
        max_tokens:  MAX_TOKENS,
        temperature: 0.3,
        messages: [
          ...(prompt       ? [{ role: 'system', content: prompt }]       : []),
          ...(user_message ? [{ role: 'user',   content: user_message }] : []),
        ],
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      console.error(`[LLM] HTTP ${response.status} :`, err.slice(0, 200));
      return res.status(502).json({ error: `LLM HTTP ${response.status}` });
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? '';

    console.log(`[LLM] ${agent_id ?? '?'} → ${text.slice(0, 80)}…`);
    return res.json({ text, agent_id, model: LLM_MODEL });

  } catch (err) {
    const reason = err.name === 'AbortError' ? 'LLM timeout (30s)' : err.message;
    console.error(`[LLM] Erreur :`, reason);
    return res.status(503).json({ error: reason });
  }
});

// ═══════════════════════════════════════════════════════════════
// ROUTES — SWARM CONTROL
// ═══════════════════════════════════════════════════════════════

app.post('/api/swarm/start', async (req, res) => {
  const { script, name } = req.body;
  if (!script || !name) return res.status(400).json({ error: 'script et name requis' });
  const result = await startAgent(script, name);
  await logToFeed('SERVER', `Démarrage ${name} via dashboard (${result.method})`);
  res.json(result);
});

app.post('/api/swarm/stop-one', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name requis' });
  const result = await stopAgent(name);
  await logToFeed('SERVER', `Arrêt ${name} via dashboard`);
  res.json(result);
});

app.post('/api/swarm/boot', async (req, res) => {
  res.json({ success: true, message: 'Boot séquentiel lancé' });

  (async () => {
    await logToFeed('SERVER', 'Séquence boot swarm initiée depuis dashboard');
    for (let i = 0; i < AGENTS.length; i++) {
      await new Promise(r => setTimeout(r, BOOT_DELAYS[i] || 1500));
      console.log(`🚀 [BOOT] ${i+1}/${AGENTS.length} : ${AGENTS[i].name}`);
      const result = await startAgent(AGENTS[i].script, AGENTS[i].id);
      await logToFeed('SERVER', result.success
        ? `${AGENTS[i].name} démarré (${result.method})`
        : `${AGENTS[i].name} ÉCHEC : ${result.error}`
      );
    }
    await logToFeed('SERVER', 'Boot complet — swarm opérationnel');
    console.log('✅ [BOOT] Swarm complet');
  })();
});

app.post('/api/swarm/stop-all', async (req, res) => {
  const results = [];
  for (const agent of AGENTS) {
    results.push({ name: agent.name, ...(await stopAgent(agent.id)) });
  }
  await logToFeed('SERVER', 'Arrêt complet swarm depuis dashboard');
  res.json({ success: true, results });
});

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

app.get('/api/signals', async (req, res) => {
  const { data, error } = await supabase
    .from('private_trader_signals')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

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

app.get('/api/mirror', async (req, res) => {
  const { data, error } = await supabase
    .from('ancalagone_mirror')
    .select('*')
    .eq('mirror_key', 'CURRENT')
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? null);
});

app.get('/api/kpis', async (req, res) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const [s, c, l, t] = await Promise.allSettled([
    supabase.from('agent_briefings').select('id', { count: 'exact', head: true }).eq('process_status', 'ROUTED').gte('created_at', since24h),
    supabase.from('generated_contents').select('id', { count: 'exact', head: true }).eq('status', 'READY').gte('created_at', since24h),
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since24h),
    supabase.from('private_trader_signals').select('id', { count: 'exact', head: true }).eq('verdict', 'BUY').gte('scanned_at', since24h),
  ]);
  res.json({
    signals:  s.status === 'fulfilled' ? (s.value.count ?? 0) : 0,
    contents: c.status === 'fulfilled' ? (c.value.count ?? 0) : 0,
    leads:    l.status === 'fulfilled' ? (l.value.count ?? 0) : 0,
    trades:   t.status === 'fulfilled' ? (t.value.count ?? 0) : 0,
  });
});

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

app.post('/api/contents/:id/posted', async (req, res) => {
  const { error } = await supabase
    .from('generated_contents')
    .update({ status: 'POSTED', posted_at: new Date().toISOString() })
    .eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  await logToFeed('NEXO', `Contenu ${req.params.id} marqué POSTED depuis dashboard`);
  res.json({ success: true });
});

app.get('/api/leads', async (req, res) => {
  const { data, error } = await supabase
    .from('leads')
    .select('id, name, status, niche, bant_score, source, created_at')
    .order('bant_score', { ascending: false })
    .limit(20);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

// ═══════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║   🔷  SWARM OS — SERVEUR v2.1                               ║
╠══════════════════════════════════════════════════════════════╣
║  Port  : ${String(PORT).padEnd(51)}║
║  LLM   : ${(process.env.LLM_URL || 'http://127.0.0.1:1234').padEnd(51)}║
║  DB    : ${(process.env.SUPABASE_URL || 'non configuré').slice(0, 51).padEnd(51)}║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export default app;