'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

const AGENT_ID      = 'AGENT-TIKTOK-FORGE-01';
const AGENT_NAME    = 'TikTok Forge Virale';

console.log("🔥 AGENT TIKTOK FORGE — LA FORGE VIRALE ACTIVÉE");

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

async function logToFeed(type, message) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR')} → ${message}`,
      run_id: `FORGE-${Date.now()}`,
    }]);
  } catch (e) {
    console.error("❌ LogToFeed failed:", e.message);
  }
}

async function updateAgentStatus(status, task = null, error = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: AGENT_NAME,
      status,
      last_ping: new Date().toISOString(),
      current_task: task,
      last_error: error ? String(error).slice(0, 400) : null,
    }, { onConflict: 'agent_id' });
  } catch (e) {
    console.error("❌ updateAgentStatus failed:", e.message);
  }
}

// ─────────────────────────────────────────────────────────────
// AUDIO POOL (Trending)
// ─────────────────────────────────────────────────────────────

const AUDIO_POOL = [
  "https://cdn.swarm-os.com/audio/viral_hook_01.mp3",
  "https://cdn.swarm-os.com/audio/trending_beat_02.mp3",
  "https://cdn.swarm-os.com/audio/suspense_drop.mp3",
  "https://cdn.swarm-os.com/audio/hype_transition.mp3",
];

function pickRandomAudio() {
  return AUDIO_POOL[Math.floor(Math.random() * AUDIO_POOL.length)];
}

// ─────────────────────────────────────────────────────────────
// GÉNÉRATION DES HOOKS VIA IA (beaucoup plus fort que des textes en dur)
// ─────────────────────────────────────────────────────────────

async function generateViralHooks(product) {
  const prompt = `Tu es un créateur TikTok viral de haut niveau.
Produit : ${product.name}
Niche : ${product.niche}
Problème résolu : ${product.problem_solved || 'inconnu'}

Génère 4 hooks ultra viraux (style TikTok Shop Suisse/France) en français.
Chaque hook doit être court, percutant et inciter à l'achat.

Réponds UNIQUEMENT avec un tableau JSON :
["Hook 1", "Hook 2", "Hook 3", "Hook 4"]`;

  try {
    const res = await fetch('http://localhost:3333/api/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        product: "TikTok Viral Content",
        prompt
      })
    });

    const data = await res.json();
    const raw = data.content?.[0]?.text || data.text || "[]";
    const hooks = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());

    return Array.isArray(hooks) ? hooks : [
      `CE PRODUIT CHANGE TOUT 😱`,
      `Fini les galères de ${product.problem_solved || 'la vie'}`,
      `Déjà +${product.social_proof || '10k'} personnes l’ont adopté 🔥`,
      `Promo exclusive -${product.discount_percent || 50}% → Lien en bio`
    ];
  } catch (err) {
    console.error("⚠️ Erreur génération hooks IA :", err.message);
    // Fallback
    return [
      `CE PRODUIT CHANGE TOUT 😱`,
      `Fini les galères de ${product.problem_solved || 'la vie'}`,
      `Déjà +${product.social_proof || '10k'} personnes l’ont adopté 🔥`,
      `Promo exclusive -${product.discount_percent || 50}% → Lien en bio`
    ];
  }
}

// ─────────────────────────────────────────────────────────────
// AGENT PRINCIPAL — LA FORGE VIRALE
// ─────────────────────────────────────────────────────────────

async function generateTikTokSlideshow(productId) {
  await logToFeed('FORGE', `Démarrage Forge Virale pour product_id: ${productId}`);
  await updateAgentStatus('ONLINE', `Forge en cours pour ${productId}`);

  try {
    // 1. Récupération du produit
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      throw new Error(`Produit ${productId} introuvable`);
    }

    await logToFeed('FORGE', `Produit chargé : ${product.name}`);

    // 2. Génération des hooks viraux via IA
    const hooks = await generateViralHooks(product);

    // 3. Construction des slides
    const slides = [
      { image: product.main_img, text: hooks[0] },
      { image: product.img_2 || product.main_img, text: hooks[1] },
      { image: product.img_3 || product.main_img, text: hooks[2] },
      { image: product.img_4 || product.main_img, text: hooks[3] },
    ];

    // 4. Audio
    const audioTrack = product.custom_audio || pickRandomAudio();

    // 5. Asset final
    const finalAsset = {
      type: 'TIKTOK_SLIDESHOW',
      product_id: productId,
      product_name: product.name,
      niche: product.niche,
      slides: slides,
      audio: audioTrack,
      caption: `#TikTokShop #${product.niche.replace(/\s+/g, '')} #PromoSuisse #Viral`,
      generated_at: new Date().toISOString(),
    };

    // 6. Sauvegarde
    await supabase.from('generated_assets').insert({
      product_id: productId,
      asset_type: 'TIKTOK_SLIDESHOW',
      payload: finalAsset,
      status: 'READY',
    });

    await logToFeed('FORGE', `✅ Diaporama viral généré pour : ${product.name}`);
    await updateAgentStatus('IDLE', `Forge terminée pour ${product.name}`);

    return finalAsset;

  } catch (err) {
    console.error("❌ Erreur Forge Virale :", err.message);
    await logToFeed('FORGE', `Échec génération pour ${productId} : ${err.message}`, 'ERROR');
    await updateAgentStatus('ERROR', 'Forge failed', err.message);
    throw err;
  }
}

module.exports = { generateTikTokSlideshow };