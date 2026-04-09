#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//   ⚡  SWARM OS — LAUNCHER v2.0
//   Un seul script. Tout démarre dans le bon ordre.
//
//   Usage :
//     node launch.js            → démarrer tout
//     node launch.js --stop     → arrêter tout
//     node launch.js --status   → voir l'état
//     node launch.js --restart  → stop + start
// ═══════════════════════════════════════════════════════════════

import 'dotenv/config';
import { spawn }          from 'child_process';
import path               from 'path';
import fs                 from 'fs';
import { fileURLToPath }  from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const SWARM_DIR  = process.cwd();
const LOG_DIR    = path.join(SWARM_DIR, 'logs');
const PID_FILE   = path.join(SWARM_DIR, '.swarm.pids');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// ═══════════════════════════════════════════════════════════════
// SÉQUENCE DE LANCEMENT — ordre critique respecté
//
// Règle : Ancalagone EN PREMIER (mémoire du swarm)
//         Serveur EN SECOND (LLM gateway)
//         Argus EN TROISIÈME (scraping)
//         Le Général EN QUATRIÈME (filtre)
//         Agents offensifs ENSUITE
// ═══════════════════════════════════════════════════════════════

const LAUNCH_SEQUENCE = [
  {
    id:       'swarm-server',
    name:     '🔷 Swarm Server',
    script:   'server.js',
    delay:    0,
    waitMs:   8000,
    health:   `http://127.0.0.1:${process.env.PORT || 3000}/status`,
    critical: true,
    note:     'LLM gateway + API dashboard',
  },
  {
    id:       'AGENT-ANCALAGONE-01',
    name:     '🐉 Ancalagone',
    script:   'ancalagone.js',
    delay:    10000,
    waitMs:   3000,
    critical: true,
    note:     'Mémoire épisodique — démarre avant tout',
  },
  {
    id:       'AGENT-ARGUS-O1',
    name:     '🔭 Argus',
    script:   'argus.js',
    delay:    14000,
    waitMs:   2500,
    critical: true,
    note:     'Scraping 35+ sources',
  },
  {
    id:       'AGENT-GENERAL-01',
    name:     '🎖️  Le Général',
    script:   'le_general.js',
    delay:    17000,
    waitMs:   2000,
    critical: true,
    note:     'Supervision · filtrage · routing',
  },
  {
    id:       'AGENT-STRATEGE-01',
    name:     '⚔️  Le Stratège',
    script:   'le_stratege.js',
    delay:    20000,
    waitMs:   2000,
    critical: false,
    note:     'Growth · War Room · contenu',
  },
  {
    id:       'AGENT-NEXO-01',
    name:     '🌟 Nexo',
    script:   'nexo.js',
    delay:    23000,
    waitMs:   2000,
    critical: false,
    note:     'Influenceur · leads · CRM',
  },
  {
    id:       'AGENT-TRADER-01',
    name:     '💹 Le Trader',
    script:   'le_trader.js',
    delay:    26000,
    waitMs:   2000,
    critical: false,
    note:     'Signaux privés · BUY/WAIT/SKIP',
  },
  {
    id:       'AGENT-EXECUTOR-01',
    name:     '⚡ L\'Executor',
    script:   'le_executor.js',
    delay:    29000,
    waitMs:   1500,
    critical: false,
    note:     'Actions · DM · trades',
  },
];

// ═══════════════════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════════════════

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
${cyan('║')}   ${bold('🌑  SWARM OS — LAUNCHER  v2.0')}                              ${cyan('║')}
${cyan('╠══════════════════════════════════════════════════════════════╣')}
${cyan('║')}  ${dim(`${LAUNCH_SEQUENCE.length} agents · démarrage séquentiel · ordre critique`)}         ${cyan('║')}
${cyan('║')}  ${dim('Logs → ./logs/  ·  PIDs → .swarm.pids')}                       ${cyan('║')}
${cyan('╚══════════════════════════════════════════════════════════════╝')}
`);
}

// Health check avec retry
async function healthCheck(url, retries = 8, intervalMs = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (res.ok) return true;
    } catch {}
    await sleep(intervalMs);
    process.stdout.write('.');
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════
// GESTION DES PIDs
// ═══════════════════════════════════════════════════════════════

function savePid(id, pid) {
  let pids = {};
  try { pids = JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); } catch {}
  pids[id] = pid;
  fs.writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}

function loadPids() {
  try { return JSON.parse(fs.readFileSync(PID_FILE, 'utf8')); } catch { return {}; }
}

function isRunning(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════
// LANCEMENT D'UN AGENT
// ═══════════════════════════════════════════════════════════════

async function launchAgent(agent) {
  const scriptPath = path.join(SWARM_DIR, agent.script);

  if (!fs.existsSync(scriptPath)) {
    return { pid: null, error: 'script introuvable' };
  }

  const logOut = fs.openSync(path.join(LOG_DIR, `${agent.id}.log`), 'a');
  const logErr = fs.openSync(path.join(LOG_DIR, `${agent.id}.err`), 'a');

  // Timestamp dans les logs
  const ts = new Date().toISOString();
  fs.writeSync(logOut, `\n\n[${ts}] ═══ DÉMARRAGE ═══\n`);

  const child = spawn('node', [scriptPath], {
    detached: true,
    stdio:    ['ignore', logOut, logErr],
    cwd:      SWARM_DIR,
    env:      { ...process.env },
  });

  child.unref();
  savePid(agent.id, child.pid);
  return { pid: child.pid, error: null };
}

// ═══════════════════════════════════════════════════════════════
// DÉMARRER TOUT
// ═══════════════════════════════════════════════════════════════

async function startAll() {
  printBanner();

  const pids    = loadPids();
  const results = [];
  let   lastDelay = 0;

  for (const agent of LAUNCH_SEQUENCE) {

    // Déjà en cours ?
    if (pids[agent.id] && isRunning(pids[agent.id])) {
      console.log(`  ${green('●')} ${agent.name.padEnd(26)} ${dim(`déjà actif (PID ${pids[agent.id]})`)}`);
      results.push({ ...agent, status: 'ALREADY_RUNNING' });
      lastDelay = agent.delay;
      continue;
    }

    // Attente relative entre agents
    const relDelay = agent.delay - lastDelay;
    if (relDelay > 0) {
      process.stdout.write(`  ${dim('○')} ${agent.name.padEnd(26)} ${dim(`attente ${(relDelay/1000).toFixed(0)}s`)}`);
      await sleep(relDelay);
      clearLine();
    }

    lastDelay = agent.delay;

    process.stdout.write(`  ${cyan('◎')} ${agent.name.padEnd(26)} ${dim('démarrage...')}`);

    const { pid, error } = await launchAgent(agent);

    if (!pid) {
      clearLine();
      console.log(`  ${yellow('⚠')}  ${agent.name.padEnd(26)} ${yellow(error ?? 'échec')}`);
      if (agent.critical) {
        console.log(`\n  ${red('ARRÊT CRITIQUE')} : ${agent.name} est requis.\n`);
        process.exit(1);
      }
      results.push({ ...agent, status: 'MISSING' });
      continue;
    }

    // Health check si URL définie
    if (agent.health) {
      process.stdout.write(`  ${cyan('◎')} ${agent.name.padEnd(26)} ${dim('health check')}`);
      const ok = await healthCheck(agent.health);
      clearLine();
      if (!ok) {
        console.log(`  ${red('✗')} ${agent.name.padEnd(26)} ${red(`health check échoué (PID ${pid})`)}`);
        if (agent.critical) {
          console.log(`\n  ${red('ARRÊT')} : serveur critique inaccessible.\n`);
          process.exit(1);
        }
        results.push({ ...agent, pid, status: 'UNHEALTHY' });
        continue;
      }
    } else {
      await sleep(agent.waitMs);
    }

    clearLine();
    const noteStr = agent.note ? dim(` · ${agent.note}`) : '';
    console.log(`  ${green('✓')} ${agent.name.padEnd(26)} ${dim(`PID ${pid}`)}${noteStr}`);
    results.push({ ...agent, pid, status: 'STARTED' });
  }

  // ── Résumé ────────────────────────────────────────────────
  const ok     = results.filter(r => ['STARTED','ALREADY_RUNNING'].includes(r.status)).length;
  const failed = results.filter(r => ['MISSING','UNHEALTHY'].includes(r.status)).length;
  const total  = LAUNCH_SEQUENCE.length;

  console.log(`
${cyan('─'.repeat(62))}
  ${green(`✓ ${ok}/${total} agents actifs`)}${failed > 0 ? `   ${red(`✗ ${failed} en erreur`)}` : ''}
  ${dim('Logs : ./logs/<agent-id>.log')}
  ${dim('Stop : node launch.js --stop')}
${cyan('─'.repeat(62))}
`);

  const criticalOk = LAUNCH_SEQUENCE.filter(a => a.critical).every(a =>
    results.find(r => r.id === a.id && ['STARTED','ALREADY_RUNNING'].includes(r.status))
  );

  if (criticalOk) {
    console.log(green(bold('  🌑 SWARM OS — EN LIGNE\n')));
  } else {
    console.log(red(bold('  ⚠  Agents critiques manquants — Swarm dégradé\n')));
  }
}

// ═══════════════════════════════════════════════════════════════
// ARRÊTER TOUT
// ═══════════════════════════════════════════════════════════════

async function stopAll() {
  console.log(bold('\n🛑 Arrêt du Swarm...\n'));
  const pids = loadPids();

  // Arrêt en ordre inverse (Executor en premier, Ancalagone en dernier)
  const reversed = [...LAUNCH_SEQUENCE].reverse();

  for (const agent of reversed) {
    const pid = pids[agent.id];
    if (!pid) continue;
    try {
      process.kill(pid, 'SIGTERM');
      console.log(`  ${green('✓')} ${agent.name.padEnd(28)} ${dim(`SIGTERM → PID ${pid}`)}`);
      await sleep(300); // laisse le temps au graceful shutdown
    } catch {
      console.log(`  ${dim('○')} ${agent.name.padEnd(28)} ${dim('déjà arrêté')}`);
    }
  }

  fs.writeFileSync(PID_FILE, '{}');
  console.log(green('\n  ✓ Swarm arrêté proprement.\n'));
}

// ═══════════════════════════════════════════════════════════════
// STATUT
// ═══════════════════════════════════════════════════════════════

function showStatus() {
  const pids = loadPids();
  console.log(bold('\n📊 État du Swarm\n'));

  let alive = 0;
  for (const agent of LAUNCH_SEQUENCE) {
    const pid     = pids[agent.id];
    const running = pid && isRunning(pid);
    const icon    = running ? green('●') : dim('○');
    const label   = running ? green('ONLINE ') : dim('OFFLINE');
    const pidStr  = pid ? dim(` PID ${pid}`) : '';
    const crit    = agent.critical ? '' : dim(' opt');
    if (running) alive++;
    console.log(`  ${icon} ${agent.name.padEnd(26)} ${label}${pidStr}${crit}`);
  }

  console.log(`\n  ${alive}/${LAUNCH_SEQUENCE.length} agents actifs\n`);

  // Vérifie les logs récents
  console.log(dim('  Logs récents (stderr) :'));
  for (const agent of LAUNCH_SEQUENCE) {
    const errFile = path.join(LOG_DIR, `${agent.id}.err`);
    if (fs.existsSync(errFile)) {
      const size = fs.statSync(errFile).size;
      if (size > 0) {
        const tail = fs.readFileSync(errFile, 'utf8').split('\n').filter(Boolean).slice(-1)[0] ?? '';
        if (tail.includes('Error') || tail.includes('error')) {
          console.log(`  ${red('!')} ${agent.name} : ${tail.slice(0, 80)}`);
        }
      }
    }
  }
  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const arg = process.argv[2];

if (arg === '--stop') {
  stopAll();
} else if (arg === '--status') {
  showStatus();
} else if (arg === '--restart') {
  await stopAll();
  await sleep(2000);
  await startAll();
} else {
  startAll();
}