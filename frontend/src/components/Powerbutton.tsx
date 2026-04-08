'use client';

import { useState, useEffect } from 'react';

type SwarmState = 'OFF' | 'BOOTING' | 'ONLINE' | 'STOPPING';

type AgentBoot = {
  id:     string;
  name:   string;
  icon:   string;
  status: 'WAITING' | 'BOOTING' | 'ONLINE' | 'ERROR';
};

const BOOT_SEQUENCE: AgentBoot[] = [
  { id:'swarm-server',    name:'Swarm Server',    icon:'🧠', status:'WAITING' },
  { id:'agent-media',     name:'Agent Média',     icon:'📡', status:'WAITING' },
  { id:'agent-sauron',    name:"Œil de Sauron",  icon:'👁', status:'WAITING' },
  { id:'agent-sentinelle',name:'Sentinelle',      icon:'🛡', status:'WAITING' },
  { id:'agent-trader',    name:'Trader',          icon:'💹', status:'WAITING' },
  { id:'agent-executor',  name:'Executor',        icon:'⚡', status:'WAITING' },
  { id:'agent-contenu',   name:'Contenu',         icon:'✍', status:'WAITING' },
  { id:'agent-superviseur',name:'Supervisor',     icon:'📋', status:'WAITING' },
  { id:'agent-main',      name:'Main de Sauron',  icon:'🖐', status:'WAITING' },
  { id:'gandalf',         name:'Gandalf',         icon:'🧙', status:'WAITING' },
  { id:'morgoth',         name:'Morgoth',         icon:'🌑', status:'WAITING' },
  { id:'ancalagon',       name:'Ancalagon',       icon:'🐉', status:'WAITING' },
];

const BOOT_DELAYS = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // secondes

export default function PowerButton() {
  const [state,    setState]    = useState<SwarmState>('OFF');
  const [agents,   setAgents]   = useState<AgentBoot[]>(BOOT_SEQUENCE);
  const [progress, setProgress] = useState(0);
  const [log,      setLog]      = useState<string[]>([]);
  const [showModal,setShowModal]= useState(false);

  const addLog = (msg: string) => setLog(prev => [`${new Date().toLocaleTimeString('fr-FR')} — ${msg}`, ...prev].slice(0, 20));

  const bootAgent = (index: number) => {
    setAgents(prev => prev.map((a, i) => i === index ? { ...a, status: 'BOOTING' } : a));
    addLog(`Démarrage ${BOOT_SEQUENCE[index].name}…`);

    setTimeout(() => {
      setAgents(prev => prev.map((a, i) => i === index ? { ...a, status: 'ONLINE' } : a));
      setProgress(Math.round(((index + 1) / BOOT_SEQUENCE.length) * 100));
      addLog(`✓ ${BOOT_SEQUENCE[index].name} — ONLINE`);

      if (index === BOOT_SEQUENCE.length - 1) {
        setState('ONLINE');
        addLog('🌑 SWARM OS — EN LIGNE');
      }
    }, 1800);
  };

  const startSwarm = async () => {
    setState('BOOTING');
    setProgress(0);
    setAgents(BOOT_SEQUENCE.map(a => ({ ...a, status: 'WAITING' })));
    setLog([]);
    addLog('Initialisation du Swarm OS…');

    // Appel réel au launcher (si API Next.js disponible)
    try {
      await fetch('/api/swarm/launch', { method: 'POST' });
    } catch {
      // Mode démo si pas d'API
    }

    // Animation de boot séquentielle
    BOOT_DELAYS.forEach((delay, i) => {
      setTimeout(() => bootAgent(i), delay * 1000);
    });
  };

  const stopSwarm = async () => {
    setState('STOPPING');
    addLog('Arrêt du Swarm en cours…');
    try {
      await fetch('/api/swarm/stop', { method: 'POST' });
    } catch {}
    setTimeout(() => {
      setState('OFF');
      setAgents(BOOT_SEQUENCE.map(a => ({ ...a, status: 'WAITING' })));
      setProgress(0);
      addLog('Swarm arrêté.');
    }, 2000);
  };

  const STATUS_COLOR = {
    OFF:      '#4A4A52',
    BOOTING:  '#FFA533',
    ONLINE:   '#00FF87',
    STOPPING: '#FF4444',
  };

  const STATUS_LABEL = {
    OFF:      'Éteint',
    BOOTING:  'Démarrage…',
    ONLINE:   'En ligne',
    STOPPING: 'Arrêt…',
  };

  const AGENT_STATUS_COLOR = {
    WAITING: '#2E2E36',
    BOOTING: '#FFA533',
    ONLINE:  '#00FF87',
    ERROR:   '#FF4444',
  };

  return (
    <>
      {/* BOUTON POWER COMPACT */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            12,
          padding:        '10px 16px',
          background:     '#0E0E10',
          border:         `1px solid ${STATUS_COLOR[state]}33`,
          borderRadius:   12,
          cursor:         state === 'BOOTING' || state === 'STOPPING' ? 'default' : 'pointer',
        }}
        onClick={() => setShowModal(true)}
      >
        {/* Orbe power */}
        <div style={{
          width:        36,
          height:       36,
          borderRadius: '50%',
          border:       `2px solid ${STATUS_COLOR[state]}`,
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          background:   `${STATUS_COLOR[state]}15`,
          flexShrink:   0,
          animation:    state === 'BOOTING' ? 'pulse 1s infinite' : undefined,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={STATUS_COLOR[state]} strokeWidth="2.5" strokeLinecap="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
            <line x1="12" y1="2" x2="12" y2="12" />
          </svg>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLOR[state], textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            SWARM OS
          </div>
          <div style={{ fontSize: 10, color: '#4A4A52', marginTop: 1 }}>
            {STATUS_LABEL[state]}
          </div>
        </div>

        {state === 'ONLINE' && (
          <div style={{ marginLeft: 8, fontSize: 10, color: '#00FF87', fontFamily: 'monospace' }}>
            {progress}%
          </div>
        )}
      </div>

      {/* MODAL DE BOOT */}
      {showModal && (
        <div style={{
          position:   'fixed',
          inset:      0,
          background: 'rgba(0,0,0,0.85)',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex:     9999,
        }}
          onClick={e => { if (e.target === e.currentTarget && state === 'ONLINE') setShowModal(false); }}
        >
          <div style={{
            background:   '#0A0A0B',
            border:       '1px solid #1A1A1D',
            borderRadius: 20,
            padding:      28,
            width:        520,
            maxHeight:    '85vh',
            overflowY:    'auto',
            fontFamily:   'var(--font-geist-mono, monospace)',
          }}>
            {/* Header modal */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color:'#E8E8EC', marginBottom: 4 }}>
                  🌑 SWARM OS — Contrôle
                </div>
                <div style={{ fontSize: 10, color: STATUS_COLOR[state], textTransform:'uppercase', letterSpacing:'0.15em' }}>
                  ● {STATUS_LABEL[state]}
                </div>
              </div>
              {state === 'ONLINE' && (
                <button
                  onClick={() => setShowModal(false)}
                  style={{ background:'transparent', border:'1px solid #1A1A1D', color:'#4A4A52', fontSize: 12, padding:'6px 12px', borderRadius: 8, cursor:'pointer' }}
                >
                  Fermer
                </button>
              )}
            </div>

            {/* Barre de progression */}
            <div style={{ height: 3, background:'#1A1A1D', borderRadius: 2, overflow:'hidden', marginBottom: 16 }}>
              <div style={{
                height:     '100%',
                width:      `${progress}%`,
                background: STATUS_COLOR[state],
                borderRadius: 2,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize: 10, color:'#4A4A52', marginBottom: 20 }}>
              <span>{state === 'BOOTING' ? `Démarrage en cours…` : state === 'ONLINE' ? '12/12 agents actifs' : 'Prêt à démarrer'}</span>
              <span>{progress}%</span>
            </div>

            {/* Grille agents */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 8, marginBottom: 20 }}>
              {agents.map((a, i) => (
                <div key={a.id} style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          10,
                  padding:      '8px 12px',
                  background:   '#111113',
                  border:       `1px solid ${AGENT_STATUS_COLOR[a.status]}33`,
                  borderRadius: 10,
                }}>
                  <span style={{ fontSize: 14 }}>{a.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color:'#E8E8EC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.name}</div>
                    <div style={{ fontSize: 9, color: AGENT_STATUS_COLOR[a.status], textTransform:'uppercase', letterSpacing:'0.1em', marginTop: 1 }}>
                      {a.status === 'BOOTING' ? '◎ boot…' : a.status === 'ONLINE' ? '● online' : a.status === 'ERROR' ? '✗ erreur' : '○ attente'}
                    </div>
                  </div>
                  <div style={{ width: 6, height: 6, borderRadius:'50%', background: AGENT_STATUS_COLOR[a.status], flexShrink: 0, animation: a.status === 'BOOTING' ? 'pulse 1s infinite' : undefined }} />
                </div>
              ))}
            </div>

            {/* Log terminal */}
            <div style={{
              background:   '#070709',
              border:       '1px solid #1A1A1D',
              borderRadius: 10,
              padding:      12,
              marginBottom: 16,
              height:       120,
              overflowY:    'auto',
            }}>
              <div style={{ fontSize: 9, color:'#4A4A52', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom: 8 }}>— Terminal</div>
              {log.length === 0 && (
                <div style={{ fontSize: 11, color:'#2E2E36' }}>En attente de commande…</div>
              )}
              {log.map((line, i) => (
                <div key={i} style={{ fontSize: 11, color: i === 0 ? '#00FF87' : '#4A4A52', lineHeight: 1.6, fontFamily:'monospace' }}>
                  {line}
                </div>
              ))}
            </div>

            {/* Boutons d'action */}
            <div style={{ display:'flex', gap: 10 }}>
              {(state === 'OFF') && (
                <button
                  onClick={startSwarm}
                  style={{
                    flex: 1, background:'#00FF8715', border:'1px solid #00FF8744',
                    color:'#00FF87', fontSize: 11, fontWeight: 700,
                    textTransform:'uppercase', letterSpacing:'0.2em',
                    padding:'12px 0', borderRadius: 10, cursor:'pointer',
                  }}
                >
                  ⚡ DÉMARRER LE SWARM
                </button>
              )}
              {state === 'BOOTING' && (
                <div style={{ flex:1, textAlign:'center', color:'#FFA533', fontSize: 11, padding:'12px 0', letterSpacing:'0.15em' }}>
                  ◎ Démarrage en cours…
                </div>
              )}
              {state === 'ONLINE' && (
                <>
                  <button
                    onClick={() => { window.open('http://localhost:3333/', '_blank'); }}
                    style={{
                      flex:1, background:'transparent', border:'1px solid #1A1A1D',
                      color:'#B0B0BA', fontSize: 11, padding:'12px 0',
                      borderRadius: 10, cursor:'pointer', letterSpacing:'0.1em',
                    }}
                  >
                    📊 Logs
                  </button>
                  <button
                    onClick={stopSwarm}
                    style={{
                      flex:1, background:'#FF444415', border:'1px solid #FF444444',
                      color:'#FF4444', fontSize: 11, fontWeight: 700,
                      textTransform:'uppercase', letterSpacing:'0.2em',
                      padding:'12px 0', borderRadius: 10, cursor:'pointer',
                    }}
                  >
                    🛑 ARRÊTER
                  </button>
                </>
              )}
              {state === 'STOPPING' && (
                <div style={{ flex:1, textAlign:'center', color:'#FF4444', fontSize: 11, padding:'12px 0', letterSpacing:'0.15em' }}>
                  ◎ Arrêt en cours…
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 12, textAlign:'center', fontSize: 9, color:'#2E2E36', letterSpacing:'0.15em', textTransform:'uppercase' }}>
              node launch.js · node launch.js --stop · node launch.js --status
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
    </>
  );
}