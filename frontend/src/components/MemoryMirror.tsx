'use client';
import { useState, useEffect, useRef } from 'react';

/**
 * MEMORY MIRROR v2.7 — UNITÉ D'APPRENTISSAGE
 * DA : Même univers que Trader 3.0 — Noir d'encre, accents émeraude/violet/ambre
 * Fonts : Unbounded + Space Mono (Google Fonts)
 */

const INITIAL_INSIGHTS = [
  { type: 'PRÉFÉRENCE', source: 'Chasseur', cls: 'pref', content: 'Ciblage SaaS Suisse-Romande privilégié.', date: 'il y a 12m' },
  { type: 'STYLE',      source: 'Rédacteur', cls: 'style', content: 'Ton « Expert Sobriété » assimilé pour les Threads.', date: 'il y a 1h' },
  { type: 'STRATÉGIE',  source: 'Trader',    cls: 'strat', content: "Seuil d'alerte Polymarket ajusté à 1.2% vol.", date: 'il y a 3h' },
];

const LINE_COLORS = {
  pref:  '#00FF87',
  style: '#7B61FF',
  strat: '#FFA533',
};

const SRC_COLORS = {
  pref:  { color: '#00FF87' },
  style: { color: '#7B61FF' },
  strat: { color: '#FFA533' },
};

function useSyncTime() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const fmt = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      setTime(`${h}:${m}`);
    };
    fmt();
    const id = setInterval(fmt, 30000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export default function MemoryMirror() {
  const [score, setScore] = useState(84);
  const [insights, setInsights] = useState(INITIAL_INSIGHTS);
  const [feedback, setFeedback] = useState('');
  const [barReady, setBarReady] = useState(false);
  const syncTime = useSyncTime();
  const textareaRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setBarReady(true), 200);
    return () => clearTimeout(t);
  }, []);

  const inject = () => {
    const val = feedback.trim();
    if (!val) return;
    setInsights(prev => [
      { type: 'FEEDBACK', source: 'Manuel', cls: 'pref', content: val, date: "à l'instant" },
      ...prev,
    ]);
    setFeedback('');
    setScore(s => Math.min(99, s + 2));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700&family=Unbounded:wght@300;400;700;900&display=swap');

        .mm-root {
          background: #0A0A0B;
          border-radius: 28px;
          padding: 28px;
          font-family: 'Space Mono', monospace;
          color: #E8E8EC;
          position: relative;
          overflow: hidden;
          max-width: 480px;
        }
        .mm-scan {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,135,0.015) 2px, rgba(0,255,135,0.015) 4px);
          pointer-events: none; border-radius: 28px;
        }
        .mm-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
        .mm-tag {
          font-family: 'Unbounded', sans-serif; font-size: 10px; font-weight: 400; color: #00FF87;
          letter-spacing: .25em; text-transform: uppercase; margin-bottom: 4px;
          display: flex; align-items: center; gap: 6px;
        }
        .mm-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #00FF87;
          animation: mm-pulse 2s ease-in-out infinite;
        }
        @keyframes mm-pulse { 0%,100%{opacity:1} 50%{opacity:0.15} }
        .mm-title {
          font-family: 'Unbounded', sans-serif; font-size: 26px; font-weight: 900;
          color: #E8E8EC; line-height: 1; letter-spacing: -.03em;
        }
        .mm-em { color: #00FF87; }
        .mm-score-val {
          font-family: 'Unbounded', sans-serif; font-size: 32px; font-weight: 900;
          color: #E8E8EC; line-height: 1; letter-spacing: -.03em; text-align: right;
        }
        .mm-score-label { font-size: 9px; color: #00FF87; letter-spacing: .2em; text-transform: uppercase; margin-top: 3px; text-align: right; }
        .mm-bar-wrap { background: #1A1A1D; border-radius: 4px; height: 4px; margin-bottom: 20px; overflow: hidden; }
        .mm-bar { height: 4px; background: #00FF87; border-radius: 4px; transition: width 1s ease; }
        .mm-section { font-size: 9px; color: #4A4A52; letter-spacing: .25em; text-transform: uppercase; margin-bottom: 12px; }
        .mm-feed { display: flex; flex-direction: column; margin-bottom: 20px; }
        .mm-item { display: grid; grid-template-columns: 3px 1fr; gap: 0 14px; padding: 12px 0; border-bottom: 1px solid #1A1A1D; }
        .mm-item:last-child { border-bottom: none; }
        .mm-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .mm-item-src { font-family: 'Unbounded', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
        .mm-item-time { font-size: 9px; color: #4A4A52; letter-spacing: .05em; }
        .mm-item-content { font-size: 12px; color: #B0B0BA; line-height: 1.5; }
        .mm-input-block { background: #111113; border: 1px solid #222226; border-radius: 16px; padding: 16px; margin-bottom: 16px; }
        .mm-input-label { font-size: 9px; color: #4A4A52; letter-spacing: .2em; text-transform: uppercase; margin-bottom: 8px; }
        .mm-textarea {
          width: 100%; background: #0A0A0B; border: 1px solid #222226; border-radius: 10px;
          color: #E8E8EC; font-family: 'Space Mono', monospace; font-size: 11px;
          padding: 10px 12px; resize: none; height: 60px; outline: none; transition: border-color .2s;
        }
        .mm-textarea:focus { border-color: rgba(0,255,135,0.4); }
        .mm-cta {
          width: 100%; background: transparent; border: 1px solid rgba(0,255,135,0.4); color: #00FF87;
          font-family: 'Unbounded', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: .2em; text-transform: uppercase; padding: 14px; border-radius: 12px;
          cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px;
        }
        .mm-cta:hover { background: #00FF87; color: #0A0A0B; border-color: #00FF87; }
        .mm-footer { text-align: center; margin-top: 16px; }
        .mm-footer-txt { font-size: 9px; color: #2E2E36; letter-spacing: .15em; text-transform: uppercase; }
        .mm-sync { color: #00FF87; }
      `}</style>

      <div className="mm-root">
        <div className="mm-scan" />

        {/* HEADER */}
        <div className="mm-header">
          <div>
            <div className="mm-tag">
              <div className="mm-dot" />
              Synchro active · v2.7
            </div>
            <div className="mm-title">
              MEMORY<span className="mm-em">.</span>MIRROR
            </div>
          </div>
          <div>
            <div className="mm-score-val">{score}%</div>
            <div className="mm-score-label">Aligné</div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="mm-bar-wrap">
          <div className="mm-bar" style={{ width: barReady ? `${score}%` : '0%' }} />
        </div>

        {/* FEED */}
        <div className="mm-section">— Dernières synapses</div>
        <div className="mm-feed">
          {insights.map((ins, i) => (
            <div key={i} className="mm-item">
              <div style={{ background: LINE_COLORS[ins.cls] || '#00FF87', borderRadius: 0 }} />
              <div>
                <div className="mm-item-top">
                  <span className="mm-item-src" style={SRC_COLORS[ins.cls] || {}}>
                    {ins.source} · {ins.type}
                  </span>
                  <span className="mm-item-time">{ins.date}</span>
                </div>
                <div className="mm-item-content">{ins.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FEEDBACK MANUEL */}
        <div className="mm-input-block">
          <div className="mm-input-label">— Injecter un feedback manuel</div>
          <textarea
            ref={textareaRef}
            className="mm-textarea"
            placeholder="Ex: Privilégier les posts le mardi matin…"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); inject(); } }}
          />
          <button className="mm-cta" onClick={inject}>
            Injecter dans le vecteur →
          </button>
        </div>

        {/* FOOTER */}
        <div className="mm-footer">
          <div className="mm-footer-txt">
            Vector DB · Local Mirror · Sync <span className="mm-sync">{syncTime}</span>
          </div>
        </div>
      </div>
    </>
  );
}