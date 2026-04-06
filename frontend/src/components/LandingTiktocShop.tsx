'use client';
import { ChevronRight, Flame, TrendingUp, ShoppingBag, Video, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LandingTikTokShop() {

  const fadeInUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
  };

  return (
    <div className="bg-[#FAFAFA] min-h-screen text-zinc-900 font-sans overflow-hidden">

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full" />

        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="max-w-5xl mx-auto px-6 text-center">

          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 px-4 py-2 bg-white border text-xs font-bold rounded-full mb-8">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            SYSTÈME DE DOMINATION TIKTOK SHOP
          </motion.div>

          <motion.h1 variants={fadeInUp} className="text-5xl md:text-7xl font-black leading-tight tracking-tight">
            Pendant que vous dormez, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 italic">
              50 vidéos vendent pour vous.
            </span>
          </motion.h1>

          <motion.p variants={fadeInUp} className="mt-8 text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Swarm OS clone ce qui fonctionne, génère du contenu en masse et inonde TikTok.
            <br /><br />
            Résultat : <strong className="text-zinc-900">plus de vues, plus de ventes, zéro effort.</strong>
          </motion.p>

          <motion.div variants={fadeInUp} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/demo" className="bg-zinc-950 text-white px-8 py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-all">
              Activer ma machine
              <ChevronRight size={16} />
            </a>

            <a href="#cas" className="border px-8 py-4 rounded-2xl font-bold">
              Voir les résultats
            </a>
          </motion.div>

        </motion.div>
      </section>

      {/* ── PROBLÈME ── */}
      <section className="py-24 bg-white text-center px-6">
        <h2 className="text-3xl md:text-4xl font-black mb-6">
          Vous êtes lent.
        </h2>

        <p className="text-zinc-500 max-w-2xl mx-auto text-lg leading-relaxed">
          1 vidéo = 2h de travail. <br />
          1 trend = déjà morte. <br />
          1 compte = shadowban.
          <br /><br />
          Pendant ce temps, certains postent <strong className="text-zinc-900">50 vidéos par jour.</strong>
        </p>
      </section>

      {/* ── SOLUTION ── */}
      <section className="py-24 text-center px-6">
        <h2 className="text-4xl md:text-5xl font-black mb-8">
          Ce n’est pas un outil. <br /> C’est une arme.
        </h2>

        <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
          Swarm OS analyse TikTok, copie ce qui fonctionne, le multiplie et le diffuse à grande échelle.
          <br /><br />
          Vous ne créez plus. <br />
          <strong className="text-zinc-900">Vous dominez.</strong>
        </p>
      </section>

      {/* ── AVANTAGES ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8 px-6">

          <div className="p-8 border rounded-3xl">
            <Flame className="text-emerald-600 mb-4" />
            <h3 className="font-bold text-xl mb-2">Postez avant tout le monde</h3>
            <p className="text-zinc-500 text-sm">
              Captez les vues avant saturation.
            </p>
          </div>

          <div className="p-8 border rounded-3xl">
            <Video className="mb-4" />
            <h3 className="font-bold text-xl mb-2">Inondez votre niche</h3>
            <p className="text-zinc-500 text-sm">
              Volume massif = domination algorithmique.
            </p>
          </div>

          <div className="p-8 border rounded-3xl">
            <ShoppingBag className="text-emerald-600 mb-4" />
            <h3 className="font-bold text-xl mb-2">Monétisation automatique</h3>
            <p className="text-zinc-500 text-sm">
              Chaque vue devient une opportunité de vente.
            </p>
          </div>

        </div>
      </section>

      {/* ── CAS CLIENT ── */}
      <section id="cas" className="py-24 text-center px-6">
        <h2 className="text-4xl md:text-5xl font-black mb-6">
          0 → 15,000$ en 21 jours
        </h2>

        <p className="text-zinc-500 max-w-2xl mx-auto text-lg">
          Sans pub. <br />
          Sans équipe. <br />
          Sans visage.
          <br /><br />
          Juste du volume.
        </p>
      </section>

      {/* ── PROCESS ── */}
      <section className="py-24 bg-white text-center px-6">
        <h2 className="text-3xl font-black mb-12">
          Comment ça marche
        </h2>

        <div className="flex flex-col md:flex-row justify-center items-center gap-6 text-sm font-bold text-zinc-500">

          <div>Ciblage niche</div>
          <ArrowRight />
          <div>Scraping trends</div>
          <ArrowRight />
          <div>Génération contenu</div>
          <ArrowRight />
          <div className="text-emerald-600">Mass posting</div>

        </div>
      </section>

      {/* ── EXCLUSIVITÉ ── */}
      <section className="py-32 bg-zinc-950 text-white text-center px-6">

        <h2 className="text-4xl md:text-5xl font-black mb-6">
          Si trop de gens utilisent ce système,
          il ne fonctionne plus.
        </h2>

        <p className="text-zinc-400 mb-10">
          Accès limité. Sélection stricte.
        </p>

        <a href="/demo" className="bg-emerald-500 text-black px-10 py-5 rounded-2xl font-black uppercase">
          Obtenir mon accès
        </a>

      </section>

    </div>
  );
}