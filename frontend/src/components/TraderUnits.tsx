'use client';
import { useEffect, useRef, useState } from "react";

/**
 * TRADER UNIT 3.0 — ÉDITION "BLACK OPS"
 * Système d'arbitrage haute fréquence
 */

const signals = [
  { asset: "POLYMARKET", target: "Election Outcome", confidence: 92, type: "bull" },
  { asset: "ETH / USDT",  target: "Liquidations",    confidence: 78, type: "vol"  },
  { asset: "BTC / USDT",  target: "Halving Corr.",   confidence: 64, type: "neutral" },
];

const RAW = [28,45,38,62,55,70,48,82,74,90,68,95,80,88,72,60,78,85,92,76,88,95,83,70,91,88,94,79,85,92];

const BADGE: any = {
  bull:    { label: "Bullish", style: { background: "rgba(0,255,135,0.12)", color: "#00FF87", border: "1px solid rgba(0,255,135,0.25)" } },
  vol:     { label: "Volatil", style: { background: "rgba(255,165,50,0.12)", color: "#FFA533", border: "1px solid rgba(255,165,50,0.25)" } },
  neutral: { label: "Neutre",  style: { background: "#222226", color: "#6E6E7A", border: "1px solid #4A4A52" } },
};

function SparkChart() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = 72;
    
    // Setup Canvas Resolution
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...RAW);
    const max = Math.max(...RAW);
    const pts = RAW.map((v, i) => ({
      x: (i / (RAW.length - 1)) * W,
      y: H - 8 - ((v - min) / (max - min)) * (H - 16),
    }));

    // Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(0,255,135,0.35)");
    grad.addColorStop(1, "rgba(0,255,135,0)");

    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    ctx.lineTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = "#00FF87";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // End Dot
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#00FF87";
    ctx.fill();
  }, []); // Dépendance vide pour ne pas recalculer inutilement

  return <canvas ref={ref} style={{ width: "100%", height: 72, display: "block" }} />;
}

export default function TraderUnits() {
  const [latency, setLatency] = useState(98);

  useEffect(() => {
    const id = setInterval(() => {
      setLatency(Math.floor(Math.random() * 40) + 80);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Unbounded:wght@300;400;700;900&display=swap');

        .tu-root {
          background: #0A0A0B;
          border-radius: 28px;
          padding: 28px;
          font-family: 'Space Mono', monospace;
          color: #E8E8EC;
          position: relative;
          overflow: hidden;
          max-width: 480px;
          border: 1px solid #1A1A1D;
        }
        .tu-scanline {
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,135,0.015) 2px, rgba(0,255,135,0.015) 4px);
          pointer-events: none;
        }
        .tu-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; }
        .tu-title-top {
          font-family: 'Unbounded', sans-serif;
          font-size: 10px; font-weight: 400; color: #00FF87;
          letter-spacing: 0.25em; text-transform: uppercase;
          margin-bottom: 4px; display: flex; align-items: center; gap: 6px;
        }
        .tu-dot {
          width: 6px; height: 6px; border-radius: 50%; background: #00FF87;
          animation: tu-pulse 1.5s ease-in-out infinite;
        }
        @keyframes tu-pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        .tu-title-main {
          font-family: 'Unbounded', sans-serif;
          font-size: 28px; font-weight: 900; color: #E8E8EC;
          line-height: 1; letter-spacing: -0.03em;
        }
        .tu-em { color: #00FF87; }
        .tu-latency-block {
          text-align: right; background: #1A1A1D;
          border: 1px solid #222226; border-radius: 12px; padding: 10px 14px;
        }
        .tu-latency-val {
          font-family: 'Unbounded', sans-serif;
          font-size: 18px; font-weight: 700; color: #00FF87;
          letter-spacing: -0.02em; line-height: 1;
        }
        .tu-latency-label { font-size: 9px; color: #4A4A52; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 3px; }
        .tu-section-label { font-size: 9px; color: #4A4A52; letter-spacing: 0.25em; text-transform: uppercase; margin-bottom: 12px; }
        .tu-signals { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
        .tu-row {
          display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 12px;
          background: #1A1A1D; border: 1px solid #222226; border-radius: 14px; padding: 12px 16px;
          transition: 0.2s;
        }
        .tu-row:hover { border-color: rgba(0,255,135,0.3); background: #1f1f23; }
        .tu-asset { font-family: 'Unbounded', sans-serif; font-size: 11px; font-weight: 700; color: #E8E8EC; }
        .tu-target { font-size: 9px; color: #6E6E7A; text-transform: uppercase; }
        .tu-conf { font-size: 10px; color: #4A4A52; text-align: right; }
        .tu-conf strong { display: block; font-family: 'Unbounded', sans-serif; font-size: 14px; color: #E8E8EC; }
        .tu-badge {
          font-family: 'Unbounded', sans-serif; font-size: 8px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 4px 8px; border-radius: 6px;
        }
        .tu-graph {
          background: #111113; border: 1px solid #222226;
          border-radius: 16px; padding: 16px; margin-bottom: 20px;
        }
        .tu-graph-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .tu-graph-title { font-size: 9px; color: #4A4A52; letter-spacing: 0.2em; text-transform: uppercase; }
        .tu-graph-acc { font-family: 'Unbounded', sans-serif; font-size: 9px; font-weight: 700; color: #00FF87; }
        .tu-cta {
          width: 100%; background: transparent; border: 1px solid rgba(0,255,135,0.4);
          color: #00FF87; font-family: 'Unbounded', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase; padding: 16px;
          border-radius: 14px; cursor: pointer; transition: all 0.2s;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .tu-cta:hover { background: #00FF87; color: #0A0A0B; }
      `}</style>

      <div className="tu-root">
        <div className="tu-scanline" />

        <div className="tu-header">
          <div>
            <div className="tu-title-top">
              <div className="tu-dot" />
              Module actif · v3.0
            </div>
            <div className="tu-title-main">
              TRADER<span className="tu-em">.</span>AI
            </div>
          </div>
          <div className="tu-latency-block">
            <div className="tu-latency-val">{latency}ms</div>
            <div className="tu-latency-label">Latence</div>
          </div>
        </div>

        <div className="tu-section-label">— Signaux en cours</div>
        <div className="tu-signals">
          {signals.map((s, i) => (
            <div key={i} className={`tu-row ${s.type === "vol" ? "alert" : ""}`}>
              <div>
                <div className="tu-asset">{s.asset}</div>
                <div className="tu-target">{s.target}</div>
              </div>
              <div className="tu-conf">
                <strong>{s.confidence}%</strong>
                conf.
              </div>
              <div className="tu-badge" style={BADGE[s.type].style}>
                {BADGE[s.type].label}
              </div>
            </div>
          ))}
        </div>

        <div className="tu-graph">
          <div className="tu-graph-header">
            <span className="tu-graph-title">Correlation Matrix · 30j</span>
            <span className="tu-graph-acc">High Accuracy</span>
          </div>
          <SparkChart />
        </div>

        <button className="tu-cta">
          Ouvrir le terminal de prédiction →
        </button>
      </div>
    </>
  );
}