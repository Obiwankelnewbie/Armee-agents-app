'use client';
import { ChevronRight, Activity, ShieldCheck, Zap, Server, Lock, BarChart3, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingSwiss() {

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  // Animation pour les éléments qui apparaissent au scroll
  const scrollReveal = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } }
  };

  return (
    <div className="bg-[#FAFAFA] min-h-screen text-zinc-900 font-sans overflow-hidden selection:bg-emerald-500/30">

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full" />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative max-w-5xl mx-auto px-6 text-center"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-xs font-bold rounded-full mb-8 shadow-sm">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            SYSTÈME D’ACQUISITION B2B AUTONOME
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-black tracking-tight leading-tight">
            Transformez votre pipeline <br />
            en machine à closing <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 italic">
              pilotée par IA.
            </span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="mt-8 text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Swarm OS remplace votre prospection, qualification et suivi commercial par une
            <strong className="text-zinc-900"> infrastructure autonome</strong>.
            <br /><br />
            Résultat : jusqu’à <strong className="text-zinc-900">+35% de closing</strong> et
            <strong className="text-zinc-900"> -70% de temps commercial</strong>.
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/demo" className="group flex items-center justify-center gap-2 bg-zinc-950 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all shadow-xl hover:shadow-emerald-500/20 hover:-translate-y-1">
              Accéder à une démo privée
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </a>

            <a href="#cas" className="flex items-center justify-center border border-zinc-200 bg-white px-8 py-4 rounded-2xl font-bold hover:bg-zinc-50 transition-all hover:-translate-y-1">
              Voir un cas réel
            </a>
          </motion.div>
        </motion.div>
      </section>

      {/* ── PROBLÈME ── */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={scrollReveal}
        className="py-24 bg-white border-y border-zinc-100"
      >
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-6">
            Votre équipe commerciale est le goulot d’étranglement.
          </h2>
          <p className="text-zinc-500 leading-relaxed text-lg">
            Leads non qualifiés. Relances oubliées. Temps perdu sur des prospects inutiles.
            <br /><br />
            Pendant ce temps, vos concurrents automatisent déjà leur acquisition.
          </p>
        </div>
      </motion.section>

      {/* ── SOLUTION ── */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={scrollReveal}
        className="py-24"
      >
        <div className="max-w-5xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-8">
            Swarm OS opère comme une équipe commerciale autonome.
          </h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
            Une architecture d’IA multi-agents qui qualifie, engage et convertit vos leads
            en continu — sans intervention humaine.
          </p>
        </div>
      </motion.section>

      {/* ── AVANTAGES ── */}
      <section className="py-24 bg-white">
        <motion.div 
          variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
          className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6"
        >
          <motion.div variants={fadeInUp} className="bg-[#FAFAFA] p-8 rounded-[32px] border border-zinc-200 hover:shadow-lg transition-shadow">
            <Zap className="text-emerald-600 mb-6" size={32} />
            <h3 className="font-bold text-xl mb-3 text-zinc-950">Zéro perte de temps</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Vos commerciaux ne parlent plus qu’à des prospects qualifiés et prêts à signer.
            </p>
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-[#FAFAFA] p-8 rounded-[32px] border border-zinc-200 hover:shadow-lg transition-shadow">
            <ShieldCheck className="text-zinc-900 mb-6" size={32} />
            <h3 className="font-bold text-xl mb-3 text-zinc-950">Données sous contrôle</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Infrastructure sécurisée et souveraine. Aucun compromis sur la confidentialité.
            </p>
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-[#FAFAFA] p-8 rounded-[32px] border border-zinc-200 hover:shadow-lg transition-shadow">
            <BarChart3 className="text-emerald-600 mb-6" size={32} />
            <h3 className="font-bold text-xl mb-3 text-zinc-950">Croissance prévisible</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">
              Pipeline optimisé, revenus stabilisés, ROI mesurable dès les premières semaines.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* ── CAS CLIENT ── */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={scrollReveal}
        id="cas" className="py-24"
      >
        <div className="max-w-4xl mx-auto text-center px-6">
          <div className="inline-block px-4 py-1 bg-emerald-500/10 text-emerald-600 font-bold rounded-full mb-6">ÉTUDE DE CAS</div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
            +42% de closing en 30 jours
          </h2>
          <p className="text-zinc-500 text-lg leading-relaxed max-w-2xl mx-auto">
            Une entreprise SaaS B2B a remplacé ses premières relances par Swarm OS.
            <br /><br />
            Résultat : pipeline structuré, cycle de vente divisé par deux, closing accéléré.
          </p>
        </div>
      </motion.section>

      {/* ── PROCESS ── */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={scrollReveal}
        className="py-24 bg-white border-y border-zinc-100"
      >
        <div className="max-w-5xl mx-auto text-center px-6">
          <h2 className="text-3xl font-black tracking-tight mb-16">
            Déploiement en 4 étapes
          </h2>

          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 font-bold text-zinc-500 uppercase tracking-widest text-xs">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 text-lg">1</div>
              Audit stratégique
            </div>
            <ArrowRight className="text-zinc-300 hidden md:block" />
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 text-lg">2</div>
              Déploiement infra
            </div>
            <ArrowRight className="text-zinc-300 hidden md:block" />
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-900 text-lg">3</div>
              Activation IA
            </div>
            <ArrowRight className="text-emerald-500 hidden md:block" />
            <div className="flex flex-col items-center gap-4 text-emerald-600">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-lg">4</div>
              Scaling
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── EXCLUSIVITÉ ── */}
      <motion.section 
        initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scrollReveal}
        className="py-32 bg-[#0A0A0B] text-white text-center px-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-6">
            Nous ne travaillons qu’avec <span className="text-emerald-500">10 entreprises</span> par mois.
          </h2>
          <p className="text-zinc-400 mb-12 text-lg">
            Chaque déploiement est stratégique. Notre sélection est stricte pour garantir des résultats hors normes.
          </p>
          <motion.a 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            href="/demo" 
            className="inline-flex bg-emerald-500 text-black px-10 py-5 rounded-2xl font-black uppercase tracking-wider hover:bg-emerald-400 transition-colors shadow-[0_0_40px_rgba(16,185,129,0.3)]"
          >
            Demander un accès
          </motion.a>
        </div>
      </motion.section>

    </div>
  );
}