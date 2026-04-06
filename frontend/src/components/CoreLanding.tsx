// app/page.tsx ou pages/index.js
export default function LandingSwiss() {
  return (
    <div className="bg-white min-h-screen text-[#1F1F1F]">
      {/* Hero Section */}
      <section className="pt-32 pb-24 bg-gradient-to-br from-[#F8F8F8] to-white">
        <div className="max-w-5xl mx-auto px-8 text-center">
          <div className="inline-block px-5 py-2 bg-[#1A3C34] text-white text-sm font-medium rounded-full mb-6">
            Disponible en Suisse romande & alémanique
          </div>
          
          <h1 className="text-6xl font-semibold tracking-tight leading-[1.1]">
            L’intelligence artificielle<br />
            qui transforme vos leads<br />
            en clients fidèles.
          </h1>
          
          <p className="mt-8 text-2xl text-[#555555] max-w-3xl mx-auto">
            Swarm OS automatise la qualification, le suivi et le closing de vos leads B2B. 
            Conçu pour les entreprises suisses qui exigent performance, discrétion et résultats mesurables.
          </p>

          <div className="mt-12 flex justify-center gap-6">
            <a href="/demo" className="bg-[#1A3C34] hover:bg-[#00A386] text-white px-10 py-4 rounded-2xl text-lg font-medium transition-colors">
              Demander une démonstration privée
            </a>
            <a href="#cas" className="border border-[#1A3C34] text-[#1A3C34] px-10 py-4 rounded-2xl text-lg font-medium hover:bg-[#F8F8F8] transition-colors">
              Voir nos cas d’usage en Suisse
            </a>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-8 border-b border-[#E5E5E5]">
        <div className="max-w-5xl mx-auto px-8 flex justify-center gap-12 text-sm text-[#888888]">
          <div>Utilisé par des entreprises en Romandie et Suisse alémanique</div>
          <div>Conforme RGPD & Swiss Data Protection</div>
          <div>Support en français, allemand et anglais</div>
        </div>
      </section>

      {/* Avantages */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-8">
          <h2 className="text-4xl font-semibold text-center mb-16">Pourquoi les entreprises suisses choisissent Swarm OS</h2>
          
          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center">
              <div className="text-5xl mb-6">📈</div>
              <h3 className="text-2xl font-semibold mb-4">Automatisation intelligente</h3>
              <p className="text-[#555555]">Qualification BANT, suivi et closing automatisés 24/7 avec un niveau de précision suisse.</p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-6">🛡️</div>
              <h3 className="text-2xl font-semibold mb-4">Confidentialité garantie</h3>
              <p className="text-[#555555]">Hébergement en Suisse possible • Conformité totale avec la loi suisse sur la protection des données.</p>
            </div>
            <div className="text-center">
              <div className="text-5xl mb-6">🚀</div>
              <h3 className="text-2xl font-semibold mb-4">Croissance mesurable</h3>
              <p className="text-[#555555]">ROI visible dès les premières semaines grâce au Growth Hacker intégré et au Memory Mirror.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-24 bg-[#1A3C34] text-white">
        <div className="max-w-3xl mx-auto text-center px-8">
          <h2 className="text-4xl font-semibold">Prêt à transformer vos leads en clients ?</h2>
          <p className="mt-6 text-xl opacity-90">Réservez une démonstration personnalisée de 30 minutes.</p>
          <a href="/demo" className="mt-10 inline-block bg-white text-[#1A3C34] px-12 py-4 rounded-2xl text-lg font-medium hover:bg-[#00A386] hover:text-white transition-all">
            Réserver ma démonstration
          </a>
        </div>
      </section>
    </div>
  );
}