// agent_slide_forge.js — LA FORGE À DIAPORAMAS
// Version améliorée avec gestion d'erreurs, logs et flexibilité

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── AUDIO POOL — sons trending rotatifs ──
const AUDIO_POOL = [
  "https://cdn.swarm-os.com/audio/trending_viral_hook.mp3",
  "https://cdn.swarm-os.com/audio/trending_beat_2.mp3",
  "https://cdn.swarm-os.com/audio/trending_suspense.mp3",
];

function pickAudio() {
  return AUDIO_POOL[Math.floor(Math.random() * AUDIO_POOL.length)];
}

// ── LOG CENTRALISÉ ──
async function logToFeed(source, message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] [${source}] ${message}`);

  try {
    await supabase.from('logs').insert({
      source,
      message,
      level,
      created_at: timestamp,
    });
  } catch (err) {
    console.error(`[LOG ERROR] Impossible d'écrire dans Supabase :`, err.message);
  }
}

// ── GÉNÉRATION DES SLIDES ──
function buildSlides(product) {
  return [
    {
      image: product.main_img,
      text: `CE GADGET CHANGE TOUT 😱`,
    },
    {
      image: product.img_2,
      text: `Finit les galères de ${product.problem_solved}`,
    },
    {
      image: product.img_3,
      text: `Déjà +${product.social_proof || '10k'} personnes conquises 🔥`,
    },
    {
      image: product.img_4,
      text: `Lien en Bio — Promo -${product.discount_percent || 50}%`,
    },
  ];
}

// ── AGENT PRINCIPAL ──
async function generateTikTokSlideshow(productId) {
  await logToFeed('FORGE', `Démarrage génération pour product_id: ${productId}`);

  // 1. RÉCUPÉRATION DU PRODUIT
  const { data: product, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  if (error || !product) {
    await logToFeed('FORGE', `Produit introuvable : ${productId}`, 'ERROR');
    throw new Error(`Produit ${productId} introuvable dans Supabase`);
  }

  // Vérification des assets obligatoires
  const requiredFields = ['main_img', 'img_2', 'img_3', 'img_4', 'problem_solved', 'name', 'niche'];
  for (const field of requiredFields) {
    if (!product[field]) {
      await logToFeed('FORGE', `Champ manquant : ${field} pour ${productId}`, 'WARN');
    }
  }

  // 2. GÉNÉRATION DES SLIDES
  const slides = buildSlides(product);

  // 3. SÉLECTION AUDIO DYNAMIQUE
  const audioTrack = product.custom_audio || pickAudio();

  // 4. ASSEMBLAGE DE L'ASSET FINAL
  const finalAsset = {
    type: 'SLIDESHOW',
    product_id: productId,
    product_name: product.name,
    content: slides,
    audio: audioTrack,
    caption: `#TikTokShop #BonPlan #Suisse #Promo ${product.niche}`,
    generated_at: new Date().toISOString(),
  };

  // 5. SAUVEGARDE EN BASE
  const { error: saveError } = await supabase
    .from('generated_assets')
    .insert({
      product_id: productId,
      asset_type: 'SLIDESHOW',
      payload: finalAsset,
      status: 'READY',
    });

  if (saveError) {
    await logToFeed('FORGE', `Erreur sauvegarde asset : ${saveError.message}`, 'ERROR');
  }

  await logToFeed('FORGE', `Diaporama généré avec succès pour : ${product.name}`);

  return finalAsset;
}

module.exports = { generateTikTokSlideshow };