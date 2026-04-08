<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swarm OS — Signal Audit</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
    <link rel="icon" href="data:," /> <!-- Empêche l'erreur favicon.ico -->

    <style>
        :root {
            --bg: #0A0A0F;
            --accent: #00D4FF;
            --emerald: #3DD68C;
            --text: #F0F0F5;
            --text2: #A0A0B8;
            --border: rgba(255,255,255,0.08);
            --card: #111118;
        }

        * { margin:0; padding:0; box-sizing:border-box; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            min-height: 100vh;
        }

        h1, h2, h3 {
            font-family: 'Space Grotesk', sans-serif;
            font-weight: 700;
            letter-spacing: -1.5px;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 40px 20px;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 60px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .logo-circle {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #3DD68C, #00D4FF);
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            box-shadow: 0 0 30px rgba(61, 214, 140, 0.3);
        }

        .title { font-size: 42px; font-weight: 700; }

        .status {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 20px;
            background: rgba(61, 214, 140, 0.1);
            border: 1px solid rgba(61, 214, 140, 0.3);
            border-radius: 9999px;
            font-size: 15px;
            color: var(--emerald);
        }

        .dot {
            width: 10px;
            height: 10px;
            background: var(--emerald);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .score-hero {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 28px;
            padding: 48px;
            display: flex;
            gap: 48px;
            align-items: center;
            margin-bottom: 60px;
        }

        .sh-ring {
            width: 120px;
            height: 120px;
            position: relative;
            flex-shrink: 0;
        }

        .sh-val {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            font-size: 52px;
            font-weight: 700;
            color: #3DD68C;
        }

        .sh-niche { font-size: 28px; font-weight: 600; margin-bottom: 12px; }
        .sh-meta { font-size: 16px; color: var(--text2); line-height: 1.9; }

        .sec {
            font-size: 13px;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--text2);
            margin: 60px 0 20px;
            font-weight: 600;
        }

        .card {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 24px;
            padding: 32px;
            margin-bottom: 32px;
        }

        .btn {
            background: var(--emerald);
            color: #000;
            padding: 16px 32px;
            border-radius: 16px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
        }

        .btn:hover {
            background: #5ce8a0;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <div class="logo">
            <div class="logo-circle">⚔️</div>
            <div>
                <h1 class="title">SWARM OS</h1>
                <p class="text-emerald-400 text-sm font-mono">Signal Audit • v2.7</p>
            </div>
        </div>
        <div class="status">
            <div class="dot"></div>
            Analyse en cours
        </div>
    </div>

    <!-- Score Hero -->
    <div class="score-hero">
        <div class="sh-ring">
            <svg width="120" height="120" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="52" fill="none" stroke="#1F1F1F" stroke-width="12"/>
                <circle cx="60" cy="60" r="52" fill="none" stroke="#3DD68C" stroke-width="12" 
                        stroke-dasharray="327" stroke-dashoffset="65" stroke-linecap="round"/>
            </svg>
            <div class="sh-val">84%</div>
        </div>
        <div>
            <div class="sh-niche">Sérum Vitamine C Anti-Âge</div>
            <div class="sh-meta">
                Score global : <strong>84%</strong><br>
                Sources : TikTok Shop • Pinterest • Google Trends<br>
                Données : <strong>Réelles</strong> • Fraîches (&lt;48h)<br>
                Confiance : <strong>Élevée</strong>
            </div>
        </div>
    </div>

    <div class="sec">Scores par source</div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div class="card"><div class="text-emerald-400 text-sm mb-2">TikTok Shop</div><div class="text-5xl font-bold">91%</div></div>
        <div class="card"><div class="text-emerald-400 text-sm mb-2">Pinterest</div><div class="text-5xl font-bold">78%</div></div>
        <div class="card"><div class="text-emerald-400 text-sm mb-2">Google Trends</div><div class="text-5xl font-bold">87%</div></div>
        <div class="card"><div class="text-emerald-400 text-sm mb-2">Amazon</div><div class="text-5xl font-bold">72%</div></div>
    </div>

    <div class="sec">Hook suggéré</div>
    <div class="card">
        <p class="text-xl leading-relaxed">"Vous en avez marre d’avoir une peau terne ? Ce sérum à la vitamine C change tout en 14 jours. Résultats visibles dès la première semaine."</p>
    </div>

    <div class="sec">Actions recommandées</div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="card">
            <div class="font-semibold mb-3">1. Tester 3 créatives TikTok</div>
            <p class="text-sm text-zinc-400">Budget test : 25-40€ • Format 15-30s</p>
        </div>
        <div class="card">
            <div class="font-semibold mb-3">2. Créer une landing page</div>
            <p class="text-sm text-zinc-400">Une page simple avec un CTA clair</p>
        </div>
        <div class="card">
            <div class="font-semibold mb-3">3. Activer la veille</div>
            <p class="text-sm text-zinc-400">Surveillance automatique pour 14€/mois</p>
        </div>
    </div>

    <div class="text-center mt-16">
        <button onclick="alert('Exécution lancée ! Connecté au backend Swarm OS')" class="btn text-lg px-12 py-5">
            Lancer l’exécution complète →
        </button>
    </div>
</div>

</body>
</html>
