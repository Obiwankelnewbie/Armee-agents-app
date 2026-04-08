#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//   ⚡  SWARM OS — LAUNCHER
//   Un seul script. Tout démarre dans le bon ordre.
//   Usage : node launch.js
//           node launch.js --stop
//           node launch.js --status
// ═══════════════════════════════════════════════════════════════

'use strict';
import 'dotenv/config';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// ─── CONFIG ───────────────────────────────────────────────────

const SWARM_DIR = process.cwd();
const LOG_DIR   = path.join(SWARM_DIR, 'logs');
const PID_FILE  = path.join(SWARM_DIR, '.swarm.pids');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Ordre de lancement — CRITIQUE : ne pas changer
const LAUNCH_SEQUENCE = [
  {
    id:      'swarm-server',
    name:    '🧠 Swarm Server',
    script:  'swarm-server.js',
    delay:   0,
    waitMs:  10000,   // attendre qu'il soit prêt avant de continuer
    health:  'http://127.0.0.1:3333/',
    critical: true,
  },
  {
    id:      'agent-media',
    name:    '📡 Agent Média RSS',
    script:  'agent_media.js',
    delay:   12000,
    waitMs:  2000,
    critical: false,
  },
  {
    id:      'agent-sauron',
    name:    "👁️  Œil de Sauron",
    script:  'agent_sauron.js',
    delay:   14000,
    waitMs:  2000,
    critical: true,
  },
  {
    id:      'agent-sentinelle',
    name:    '🛡️  Sentinelle',
    script:  'agent_sentinelle_v2.js',
    delay:   15000,
    waitMs:  1500,
    critical: true,
  },
  {
    id:      'agent-trader',
    name:    '💹 Trader',
    script:  'agent_trader.js',
    delay:   16000,
    waitMs:  1500,
    critical: true,
  },
  {
    id:      'agent-executor',
    name:    '⚡ Executor Base',
    script:  'agent_executor.js',
    delay:   17000,
    waitMs:  1500,
    critical: true,
  },
  {
    id:      'agent-contenu sauron',
    name:    '✍️  Agent Contenu',
    script:  'agent_contenu_sauron.js',
    delay:   18000,
    waitMs:  2000,
    critical: false,
  },
  {
    id:      'agent-nexus',
    name:    '📋 Supervisor crm',
    script:  'agent_nexus.js',
    delay:   19000,
    waitMs:  2000,
    critical: false,
  },
  {
    id:      'agent-main sauron',
    name:    '🖐️  Main de Sauron',
    script:  'agent_main_sauron.js',
    delay:   20000,
    waitMs:  2000,
    critical: true,
  },
  {
    id:      'agent-gandalf',
    name:    '🧙 Gandalf',
    script:  'gandalf.js',
    delay:   21000,
    waitMs:  2000,
    critical: false,
  },
  {
    id:      'agent-morgoth',
    name:    '🌑 Morgoth',
    script:  'morgoth.js',
    delay:   24000,
    waitMs:  2000,
    critical: true,
  },
  {
    id:      'agent-ancalagon',
    name:    '🐉 Ancalagon',
    script:  'ancalagon.js',
    delay:   27000,
    waitMs:  2000,
    critical: false,
  },
];

// ─── UTILS ────────────────────────────────────────────────────

const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
const cyan   = (s)  => `\x1b[36m${s}\x1b[0m`;
const green  = (s)  => `\x1b[32m${s}\x1b[0m`;
const red    = (s)  => `\x1b[31m${s}\x1b[0m`;
const yellow = (s)  => `\x1b[33m${s}\x1b[0m`;
const dim    = (s)  => `\x1b[2m${s}\x1b[0m`;
const bold   = (s)  => `\x1b[1m${s}\x1b[0m`;

function clearLine() { process.stdout.write('\r\x1b[K'); }

function printBanner() {
  console.log(`
${cyan('╔══════════════════════════════════════════════════════════════╗')}
${cyan('║')}   ${bold('🌑  SWARM OS — LAUNCHER  v1.0')}                              ${cyan('║')}
${cyan('╠══════════════════════════════════════════════════════════════╣')}
${cyan('║')}  ${dim('12 agents · démarrage séquentiel · ordre critique')}           ${cyan('║')}
${cyan('║')}  ${dim('Logs → ./logs/  ·  PIDs → .swarm.pids')}                       ${cyan('║')}
${cyan('╚══════════════════════════════════════════════════════════════╝')}
`);
}

async function healthCheck(url, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

// ─── PIDS ─────────────────────────────────────────────────────

function savePid(id, pid) {
  let pids = {};
  try { pids = JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); } catch {}
  pids[id] = pid;
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}

function loadPids() {
  try { return JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); }
  catch { return {}; }
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true; }
  catch { return false; }
}

// ─── LAUNCH ───────────────────────────────────────────────────

async function launchAgent(agent) {
  const scriptPath = path.join(SWARM_DIR, agent.script);

  if (!fs.existsSync(scriptPath)) {
    console.log(`  ${yellow('⚠')}  ${agent.name} ${dim(`→ ${agent.script} introuvable — ignoré`)}`);
    return null;
  }

  const logOut = fs.openSync(path.join(LOG_DIR, `${agent.id}.log`), 'a');
  const logErr = fs.openSync(path.join(LOG_DIR, `${agent.id}.err`), 'a');

  const child = spawn('node', [scriptPath], {
    detached: true,
    stdio:    ['ignore', logOut, logErr],
    cwd:      SWARM_DIR,
    env:      { ...process.env },
  });

  child.unref();
  savePid(agent.id, child.pid);

  return child.pid;
}

// ─── START ALL ────────────────────────────────────────────────

async function startAll() {
  printBanner();
  console.log(bold(`Démarrage de ${LAUNCH_SEQUENCE.length} agents...\n`));

  const pids = loadPids();
  const results = [];

  for (const agent of LAUNCH_SEQUENCE) {
    // Check si déjà en vie
    if (pids[agent.id] && isRunning(pids[agent.id])) {
      console.log(`  ${green('●')} ${agent.name.padEnd(28)} ${dim(`déjà actif (PID ${pids[agent.id]})`)}`);
      results.push({ ...agent, status: 'ALREADY_RUNNING' });
      continue;
    }

    // Attente avant lancement
    if (agent.delay > 0) {
      const elapsed = agent.delay / 1000;
      process.stdout.write(`  ${dim('○')} ${agent.name.padEnd(28)} ${dim(`attente ${elapsed}s...`)}`);
      await sleep(agent.delay - (results.length > 0 ? LAUNCH_SEQUENCE[results.length-1]?.delay || 0 : 0));
      clearLine();
    }

    process.stdout.write(`  ${cyan('◎')} ${agent.name.padEnd(28)} ${dim('démarrage...')}`);

    const pid = await launchAgent(agent);

    if (!pid) {
      clearLine();
      console.log(`  ${red('✗')} ${agent.name.padEnd(28)} ${red('script introuvable')}`);
      if (agent.critical) {
        console.log(`\n  ${red('ARRÊT')} : agent critique manquant — ${agent.name}`);
        process.exit(1);
      }
      results.push({ ...agent, status: 'MISSING' });
      continue;
    }

    // Health check si URL définie
    if (agent.health) {
      process.stdout.write(`  ${cyan('◎')} ${agent.name.padEnd(28)} ${dim('health check...')}`);
      const ok = await healthCheck(agent.health);
      clearLine();
      if (!ok) {
        console.log(`  ${red('✗')} ${agent.name.padEnd(28)} ${red(`health check échoué (PID ${pid})`)}`);
        if (agent.critical) { console.log(`\n  ${red('ARRÊT')} : serveur critique inaccessible.`); process.exit(1); }
        results.push({ ...agent, status: 'UNHEALTHY' });
        continue;
      }
    } else {
      await sleep(agent.waitMs);
    }

    clearLine();
    console.log(`  ${green('✓')} ${agent.name.padEnd(28)} ${dim(`PID ${pid}`)}`);
    results.push({ ...agent, pid, status: 'STARTED' });
  }

  // ── Résumé ────────────────────────────────────────────────
  const ok      = results.filter(r => r.status === 'STARTED' || r.status === 'ALREADY_RUNNING').length;
  const failed  = results.filter(r => r.status === 'MISSING' || r.status === 'UNHEALTHY').length;

  console.log(`
${cyan('─'.repeat(62))}
  ${green('✓')} ${ok} agents actifs   ${failed > 0 ? red(`✗ ${failed} en erreur`) : ''}
  ${dim('Logs disponibles dans ./logs/')}
  ${dim('Arrêt : node launch.js --stop')}
${cyan('─'.repeat(62))}
`);

  if (ok >= LAUNCH_SEQUENCE.filter(a => a.critical).length) {
    console.log(green(bold('  🌑 SWARM OS — EN LIGNE\n')));
  } else {
    console.log(red(bold('  ⚠  Agents critiques manquants — Swarm dégradé\n')));
  }
}

// ─── STOP ALL ─────────────────────────────────────────────────

async function stopAll() {
  console.log(bold('\n🛑 Arrêt du Swarm...\n'));
  const pids = loadPids();

  for (const [id, pid] of Object.entries(pids)) {
    const agent = LAUNCH_SEQUENCE.find(a => a.id === id);
    const name  = agent?.name ?? id;
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`  ${green('✓')} ${name.padEnd(30)} ${dim(`SIGTERM → PID ${pid}`)}`);
    } catch {
      console.log(`  ${dim('○')} ${name.padEnd(30)} ${dim('déjà arrêté')}`);
    }
  }

  fs.writeFileSync(PID_FILE, '{}');
  console.log(green('\n  ✓ Swarm arrêté proprement.\n'));
}

// ─── STATUS ───────────────────────────────────────────────────

function showStatus() {
  const pids = loadPids();
  console.log(bold('\n📊 État du Swarm\n'));

  for (const agent of LAUNCH_SEQUENCE) {
    const pid     = pids[agent.id];
    const running = pid && isRunning(pid);
    const icon    = running ? green('●') : red('○');
    const label   = running ? green('ONLINE') : red('OFFLINE');
    const pidStr  = pid ? dim(` PID ${pid}`) : '';
    console.log(`  ${icon} ${agent.name.padEnd(28)} ${label}${pidStr}`);
  }
  console.log('');
}

// ─── CLI ──────────────────────────────────────────────────────

const arg = process.argv[2];

if (arg === '--stop')   { stopAll();    }
else if (arg === '--status') { showStatus(); }
else                   { startAll();   }