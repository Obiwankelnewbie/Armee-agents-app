'use client';

/**
 * AGENT STATUS PANEL — ÉDITION "PRECISION SWISS" v2.7
 * DA : Silent Luxury (Minimalisme, Micro-animations, Typo High-Tech)
 */
export default function AgentStatusPanel() {
  const agents = [
    { name: "Supervisor", status: "ONLINE", task: "Orchestration Master", load: "12%" },
    { name: "Chasseur B2B", status: "ONLINE", task: "Qualification BANT", load: "64%" },
    { name: "Rédacteur IA", status: "IDLE", task: "Attente de brief", load: "0%" },
    { name: "Growth Hacker", status: "ONLINE", task: "Scan de niches", load: "38%" },
    { name: "Trader", status: "ONLINE", task: "Arbitrage Polymarket", load: "21%" },
  ];

  return (
    <div className="bg-white rounded-[40px] p-10 border border-zinc-200 shadow-2xl shadow-zinc-100 transition-all duration-700 hover:border-emerald-500/20">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-3xl font-black font-display italic uppercase tracking-tighter">
          Status <span className="text-emerald-500">Escouade</span>
        </h2>
        <div className="px-3 py-1 bg-zinc-100 rounded-lg text-[9px] font-bold text-zinc-400 font-mono tracking-widest uppercase">
          Unit-2.7
        </div>
      </div>

      <div className="space-y-4">
        {agents.map((agent, i) => (
          <div 
            key={i} 
            className="group flex items-center justify-between p-6 bg-white border border-zinc-100 rounded-[28px] hover:bg-zinc-50 transition-all duration-500"
          >
            <div className="flex items-center gap-6">
              {/* INDICATEUR DE STATUT LUMINEUX */}
              <div className="relative">
                <div className={`w-3 h-3 rounded-full ${agent.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                {agent.status === 'ONLINE' && (
                  <div className="absolute inset-0 w-3 h-3 bg-emerald-500 rounded-full animate-ping opacity-40" />
                )}
              </div>
              
              <div>
                <div className="font-black font-display italic uppercase text-lg leading-none group-hover:text-emerald-600 transition-colors">
                  {agent.name}
                </div>
                <div className="text-[10px] font-mono font-bold text-zinc-400 mt-1 uppercase tracking-widest italic">
                  {agent.task}
                </div>
              </div>
            </div>

            {/* CHARGE DE L'AGENT */}
            <div className="text-right">
              <div className="text-[9px] font-black text-zinc-300 uppercase tracking-widest mb-1.5">
                {agent.load} LOAD
              </div>
              <div className="w-12 h-1 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${agent.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-zinc-200'}`}
                  style={{ width: agent.load }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER TECHNIQUE */}
      <div className="mt-8 pt-8 border-t border-zinc-100 flex justify-between items-center text-[9px] font-mono font-bold text-zinc-300 uppercase tracking-widest">
         <span>Signal: Stable (42ms)</span>
         <span className="text-emerald-500 opacity-60">S-Key Active</span>
      </div>
    </div>
  );
}