'use client';

/**
 * PRICING PAGE — ÉDITION "SILENT LUXURY" v2.7
 * DA : Optimus Prime (Swiss Precision & Elite Contrast)
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0F172A] font-sans selection:bg-emerald-100">
      <div className="max-w-[1000px] mx-auto px-6 py-20">
        
        {/* HEADER */}
        <div className="text-center mb-24 animate-in fade-in slide-in-from-top-4 duration-1000">
          <h2 className="text-6xl font-black font-display tracking-tighter mb-6 italic uppercase leading-none">
            Tarifs.
          </h2>
          <p className="text-zinc-400 text-lg max-w-md mx-auto font-light leading-relaxed">
            {"L'excellence de l'IA, sans la complexité. Déploiement immédiat de votre Swarm."}
          </p>
        </div>

        {/* GRILLE DE PRIX SÉPARÉE PAR UNE LIGNE FINE */}
        <div className="grid md:grid-cols-2 border border-zinc-200 divide-y md:divide-y-0 md:divide-x divide-zinc-200 rounded-[40px] overflow-hidden shadow-2xl shadow-zinc-100 animate-in zoom-in-95 duration-700">
          
          {/* STARTER UNIT */}
          <div className="p-16 hover:bg-zinc-50/50 transition-colors duration-500 group">
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-6 block">
              Essentiel
            </span>
            <h3 className="text-2xl font-black text-zinc-300 mb-10 font-display italic uppercase group-hover:text-zinc-400 transition-colors">
              Starter
            </h3>
            <div className="text-7xl font-black font-display tracking-tighter mb-12 flex items-baseline">
              9€ <span className="text-base text-zinc-400 font-sans ml-3 font-normal tracking-normal italic">/ mois</span>
            </div>
            
            <ul className="space-y-6 mb-16">
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Agents Chasseur & Rédacteur <span className="text-zinc-400 text-[10px] uppercase font-mono">Actif</span>
              </li>
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                500 leads qualifiés <span className="text-zinc-400 text-[10px] uppercase font-mono">/ mois</span>
              </li>
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Contenu média automatisé <span className="text-zinc-400 text-[10px] uppercase font-mono">Inclus</span>
              </li>
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Support prioritaire <span className="text-zinc-400 text-[10px] uppercase font-mono">Email</span>
              </li>
            </ul>

            <button className="w-full py-5 border-2 border-[#0F172A] text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all duration-300 rounded-2xl active:scale-95">
              Commencer l'unité
            </button>
          </div>

          {/* MASTER UNIT */}
          <div className="p-16 hover:bg-zinc-50/50 transition-colors duration-500 bg-white group">
            <span className="text-[10px] font-bold text-[#0F172A] uppercase tracking-[0.2em] mb-6 block">
              Intégral
            </span>
            <h3 className="text-2xl font-black text-zinc-300 mb-10 font-display italic uppercase group-hover:text-zinc-400 transition-colors">
              Master
            </h3>
            <div className="text-7xl font-black font-display tracking-tighter mb-12 flex items-baseline text-emerald-500">
              29€ <span className="text-base text-zinc-400 font-sans ml-3 font-normal tracking-normal italic">/ mois</span>
            </div>
            
            <ul className="space-y-6 mb-16">
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Unités Trader & Growth <span className="text-zinc-400 text-[10px] uppercase font-mono">Actif</span>
              </li>
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Actions & Leads <span className="text-zinc-400 text-[10px] uppercase font-mono">Illimités</span>
              </li>
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Memory Mirror v2.7 <span className="text-zinc-400 text-[10px] uppercase font-mono">Actif</span>
              </li>
              <li className="flex justify-between text-sm pb-3 border-b border-zinc-100 font-semibold text-zinc-600">
                Hébergement Privé <span className="text-zinc-400 text-[10px] uppercase font-mono text-emerald-500">Suisse</span>
              </li>
            </ul>

            <button className="w-full py-5 bg-[#0F172A] text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all duration-300 rounded-2xl shadow-xl shadow-black/10 active:scale-95">
              Déployer Master Unit
            </button>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <div className="mt-24 text-center">
          <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em]">
            Engineered in Switzerland • Zero Commitment • Crypto Friendly
          </p>
        </div>
      </div>
    </div>
  );
}