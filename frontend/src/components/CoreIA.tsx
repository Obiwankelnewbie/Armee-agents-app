<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>core-ia — L’actualité de l’IA, de l’automatisation et des outils qui changent tout</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
:root {
  --bg: #0A0A0F;
  --accent: #00D4FF;
  --purple: #7B5CFA;
  --text: #F0F0F5;
  --text2: #A0A0B8;
  --card: #111118;
}

* { margin:0; padding:0; box-sizing:border-box; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', sans-serif;
}

h1, h2, h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  letter-spacing: -1.5px;
}

header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(10,10,15,0.95);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 20px 5%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -1px;
}
.logo span { color: var(--accent); }

.nav a {
  margin: 0 24px;
  color: var(--text2);
  text-decoration: none;
  font-weight: 500;
}
.nav a:hover { color: white; }

.cta {
  background: var(--accent);
  color: #001A1F;
  padding: 12px 28px;
  border-radius: 9999px;
  font-weight: 700;
  text-decoration: none;
}

/* Hero */
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0 5%;
  background: linear-gradient(135deg, #0A0A0F 0%, #1A0F2E 100%);
}

.hero-title {
  font-size: 68px;
  line-height: 1.05;
  margin-bottom: 28px;
}

.hero-subtitle {
  font-size: 22px;
  color: var(--text2);
  max-width: 620px;
  margin: 0 auto 48px;
}

.hero-cta {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.btn-primary {
  background: var(--accent);
  color: #001A1F;
  padding: 18px 42px;
  border-radius: 9999px;
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
}

.btn-secondary {
  border: 1px solid rgba(255,255,255,0.3);
  color: white;
  padding: 18px 36px;
  border-radius: 9999px;
  font-size: 18px;
  font-weight: 600;
  text-decoration: none;
}

/* Innovations */
.innovations {
  padding: 120px 5%;
  background: #111118;
}

.innovations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 32px;
  margin-top: 60px;
}

.innovation-card {
  background: var(--card);
  border-radius: 20px;
  padding: 40px 32px;
  border: 1px solid rgba(255,255,255,0.08);
}

/* Agents */
.agents-section {
  padding: 120px 5%;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  margin-top: 60px;
}

.agent-card {
  background: var(--card);
  border-radius: 20px;
  padding: 40px 32px;
  border: 1px solid rgba(255,255,255,0.08);
}

/* Forum */
.forum-teaser {
  padding: 100px 5%;
  background: linear-gradient(135deg, #1A0F2E, #0A0A0F);
  text-align: center;
}
</style>
</head>
<body>

<header>
  <div class="logo">core-<span>ia</span></div>
  <nav class="nav">
    <a href="#innovations">Innovations</a>
    <a href="#agents">Agents IA</a>
    <a href="#forum">Forum</a>
  </nav>
  <a href="/app" class="cta">Accéder à Swarm OS</a>
</header>

<section class="hero">
  <div>
    <div class="hero-title">L’actualité de l’IA.<br>Chaque jour.</div>
    <p class="hero-subtitle">
      Les dernières avancées en intelligence artificielle, automatisation, outils et stratégies qui changent la donne.
    </p>
    <div class="hero-cta">
      <a href="#innovations" class="btn-primary">Découvrir les dernières innovations</a>
      <a href="#forum" class="btn-secondary">Rejoindre la communauté</a>
    </div>
  </div>
</section>

<section class="innovations" id="innovations">
  <h2 style="text-align:center;font-size:48px;margin-bottom:20px">Dernières Innovations IA</h2>
  <p style="text-align:center;color:var(--text2);max-width:600px;margin:0 auto 60px">
    Ce que les plus grands labs et startups lancent cette semaine.
  </p>

  <div class="innovations-grid">
    <div class="innovation-card">
      <h3>Claude 4 Opus : le nouveau roi du raisonnement</h3>
      <p style="margin-top:16px;color:var(--text2)">Anthropic vient de franchir un cap majeur avec une version qui surpasse GPT-4o sur les tâches complexes.</p>
    </div>
    <div class="innovation-card">
      <h3>Agentic Workflows : l’automatisation qui pense seule</h3>
      <p style="margin-top:16px;color:var(--text2)">Les nouveaux frameworks permettent à des agents IA de gérer des projets complets sans intervention humaine.</p>
    </div>
    <div class="innovation-card">
      <h3>Multimodal en temps réel : vidéo + voix + texte</h3>
      <p style="margin-top:16px;color:var(--text2)">Les modèles qui comprennent et génèrent du contenu vidéo en direct arrivent sur le marché.</p>
    </div>
  </div>
</section>

<section class="agents-section" id="agents">
  <h2 style="text-align:center;font-size:42px;margin-bottom:60px">Votre armée d’agents IA</h2>
  
  <div class="agents-grid">
    <div class="agent-card">
      <div class="agent-icon">🎯</div>
      <div class="agent-name">Le Chasseur</div>
      <p class="agent-desc">Trouve automatiquement des leads qualifiés et les qualifie avec la méthode BANT.</p>
    </div>
    <div class="agent-card">
      <div class="agent-icon">🧬</div>
      <div class="agent-name">Le Clone</div>
      <p class="agent-desc">Transforme un article en posts LinkedIn, X ou TikTok parfaitement adaptés à votre voix.</p>
    </div>
    <div class="agent-card">
      <div class="agent-icon">🕵️</div>
      <div class="agent-name">L’Espion</div>
      <p class="agent-desc">Surveille vos concurrents et vous alerte en temps réel sur les changements stratégiques.</p>
    </div>
    <div class="agent-card">
      <div class="agent-icon">📝</div>
      <div class="agent-name">Le Rédacteur</div>
      <p class="agent-desc">Réécrit et optimise vos articles pour core-ia.fr et adapte le contenu pour le forum.</p>
    </div>
  </div>
</section>

<section class="forum-teaser" id="forum">
  <h2>Le Forum core-ia</h2>
  <p>Discutez des dernières avancées en IA, partagez vos outils préférés, posez vos questions techniques et échangez avec une communauté passionnée. Vous pouvez aussi parler de Swarm OS et de vos expériences avec l’application.</p>
  <a href="/forum" style="margin-top:40px;display:inline-block;background:var(--purple);color:white;padding:16px 48px;border-radius:9999px;text-decoration:none;font-weight:600;">Rejoindre le forum →</a>
</section>

</body>
</html>