// ============================================================
// SWARM-CREATOR AI — Script Generation Service
// Moteur Hook-Body-CTA ultra-viral pour le marché français
// Ton UGC natif, jamais une traduction littérale US.
// ============================================================

import type {
  Product,
  GeneratedScript,
  ScriptRequest,
  AgentUnit,
} from '../types';

// ---------------------------------------------------------------
// Templates de hooks par style (registre oral français authentique)
// ---------------------------------------------------------------
const HOOK_TEMPLATES: Record<string, ((p: Product) => string)[]> = {
  ugc: [
    (p) => `🚨 ${p.brand_name} m'a VOLÉ ma routine pendant 3 ans sans que je le sache`,
    (p) => `Attends... ${p.price}€ pour ça ? J'étais sceptique aussi.`,
    (p) => `Le truc que TOUTES les filles de ${p.target_audience?.interests?.[0] ?? 'ma niche'} s'arrachent en ce moment`,
    (p) => `POV : tu découvres ${p.product_name} à 23h et tu dors plus`,
    (p) => `Quelqu'un peut m'expliquer pourquoi personne m'avait parlé de ${p.product_name} avant ?`,
    (p) => `Je devais pas acheter ${p.product_name}. J'aurais dû écouter ma banquière.`,
  ],
  temoignage: [
    (p) => `Franchement je pensais que c'était encore une arnaque TikTok. Spoiler : non.`,
    (p) => `${p.brand_name} m'a répondu dans les DMs et ce qu'ils m'ont dit sur ${p.product_name}...`,
    (p) => `Ma meilleure amie m'a détestée quand elle a vu mes résultats avec ${p.product_name}`,
    (p) => `3 semaines de test. Voilà ce que ${p.product_name} a vraiment changé.`,
  ],
  defi: [
    (p) => `J'ai testé ${p.product_name} pendant 7 jours. Voilà ce qui s'est passé 👀`,
    (p) => `Le défi : utiliser SEULEMENT ${p.product_name} pendant 2 semaines`,
    (p) => `${p.brand_name} m'a challengée. J'ai accepté. Erreur ou révélation ?`,
  ],
  hack: [
    (p) => `Le hack ${p.category} que les influenceuses planquent depuis des mois`,
    (p) => `Personne te dit ça sur ${p.product_name} mais voilà la vérité`,
    (p) => `Comment j'ai économisé ${Math.round(p.price * 4)}€ grâce à ${p.product_name}`,
  ],
  review: [
    (p) => `${p.product_name} à ${p.price}€ — j'ai checké TOUS les avis. Verdict honnête.`,
    (p) => `Honest review : ${p.brand_name} mérite-t-il son hype ? (Thread)`,
    (p) => `J'ai comparé ${p.product_name} avec 3 alternatives. Résultat surprenant.`,
  ],
};

// ---------------------------------------------------------------
// Corps de script par unité d'agent
// ---------------------------------------------------------------
function buildBody(p: Product, unit: AgentUnit, style: string): string {
  const price = p.price.toLocaleString('fr-FR');
  const commission = Math.round(p.price * p.commission_rate);

  const bodies: Partial<Record<AgentUnit, string>> = {
    tiktok_shop: [
      `Alors voilà ce que ${p.product_name} fait concrètement : [DÉMO VISUELLE 8s]. `,
      `J'étais comme toi, j'hésitais à cause du prix — ${price}€ c'est pas rien. `,
      `Mais franchement ? En 2 semaines j'ai vu une vraie différence. `,
      `${p.ugc_style_notes ?? `C'est exactement pour ça que ${p.brand_name} cartonne en ce moment.`}`,
    ].join(''),

    media_buzz: [
      `Le truc c'est que tout le monde en parle mais personne montre vraiment. `,
      `Moi j'ai décidé de faire le test en vrai, devant vous. [TRANSITION DYNAMIQUE]. `,
      `Les résultats ? ${p.hook_keywords?.slice(0,2).join(', ') ?? 'au-delà de mes attentes'}. `,
      `Et c'est pour ça que ça tourne autant sur FYP cette semaine.`,
    ].join(''),

    affiliation: [
      `Le lien est en bio — et non, c'est pas sponsorisé, je l'ai acheté moi-même. `,
      `${p.brand_name} propose une commission de ${commission}€ par vente via mon lien. `,
      `Donc si tu achètes : tu soutiens ce compte ET tu découvres un produit qui déchire. Win-win.`,
    ].join(''),

    redacteur: [
      `[INTRO ARTICLE] : ${p.product_name} s'impose comme LA référence ${p.category} de 2025. `,
      `Après test approfondi, voici notre analyse complète des formulations, du rapport qualité-prix `,
      `et des avis consommateurs vérifiés. Score global : [NOTATION]. `,
      `Retrouvez le test complet sur Core-IA.`,
    ].join(''),

    forum: [
      `[POST COMMUNITY] : Quelqu'un a testé ${p.product_name} récemment ? `,
      `Je l'utilise depuis 3 semaines, j'ai quelques retours à partager si ça intéresse. `,
      `Le brand ${p.brand_name} répond aussi aux messages — expérience client correcte.`,
    ].join(''),
  };

  return bodies[unit] ?? bodies.tiktok_shop!;
}

// ---------------------------------------------------------------
// CTA par unité
// ---------------------------------------------------------------
function buildCTA(p: Product, unit: AgentUnit): string {
  const ctas: Partial<Record<AgentUnit, string[]>> = {
    tiktok_shop: [
      `Le lien TikTok Shop est juste là 👆 — livraison rapide, retour gratuit.`,
      `Clique sur le panier, c'est en stock pour l'instant. Spoiler : ça part vite.`,
      `Code promo en description pour -10% — valable cette semaine seulement 🔥`,
    ],
    media_buzz: [
      `Follow pour la suite du test J+14 — je vous montre tout.`,
      `Commente "LINK" et je t'envoie le bon de réduc en DM 👇`,
      `Sauvegarde cette vidéo si t'as pas encore craqué — tu reviendras 😅`,
    ],
    affiliation: [
      `Lien dans la bio, code [PROMO] pour 10% off. Commission reversée à ce compte.`,
      `Swipe up ou lien bio — j'ai négocié un tarif préférentiel pour vous.`,
    ],
    redacteur: [
      `Article complet sur Core-IA — lien bio. Comparatif de 5 produits similaires disponible.`,
    ],
    forum: [
      `Venez en discuter dans les commentaires 👇 — vos retours d'expérience m'intéressent.`,
    ],
  };

  const unitCTAs = ctas[unit] ?? ctas.tiktok_shop!;
  return unitCTAs[Math.floor(Math.random() * unitCTAs.length)];
}

// ---------------------------------------------------------------
// Hashtags contextuels français
// ---------------------------------------------------------------
function buildHashtags(p: Product, unit: AgentUnit): string[] {
  const base = ['#tiktokviral', '#tiktokfrance', '#pourtoi'];
  const categoryTags: Record<string, string[]> = {
    beaute:  ['#beautetiktok', '#skincarefrançais', '#routinebeaute', '#glow'],
    mode:    ['#modetiktok', '#outfitfr', '#look', '#fashionfrancais'],
    tech:    ['#techtiktok', '#gadget', '#hightech', '#unboxingfr'],
    food:    ['#foodtiktok', '#recettefr', '#cuisine', '#foodie'],
    maison:  ['#homedesign', '#decodinterieur', '#maisonfrancaise'],
    sport:   ['#sporttiktok', '#fitness', '#workout', '#musculation'],
    sante:   ['#santetiktok', '#bienetre', '#wellness'],
  };
  const unitTags: Partial<Record<AgentUnit, string[]>> = {
    tiktok_shop: ['#tiktokshop', '#tiktokmademebuyit', '#achatsoftiktok'],
    media_buzz:  ['#viral', '#foryoupage', '#fyp', '#trending'],
    affiliation: ['#affiliation', '#codeparrain', '#bonplan'],
    redacteur:   ['#SEO', '#coreIA', '#test', '#avis'],
    forum:       ['#communaute', '#retourexperience', '#discussion'],
  };

  return [
    ...base,
    ...(categoryTags[p.category] ?? []).slice(0, 3),
    ...(unitTags[unit] ?? []).slice(0, 2),
    `#${p.brand_name.toLowerCase().replace(/\s+/g, '')}`,
  ];
}

// ---------------------------------------------------------------
// Score viral estimé (heuristique simple, à remplacer par ML)
// ---------------------------------------------------------------
function estimateViralScore(p: Product, style: string): number {
  let score = 50;
  if (style === 'ugc') score += 15;
  if (style === 'defi') score += 10;
  if (p.price < 50) score += 8;         // prix accessible = plus de conversions
  if (p.hook_keywords?.length > 3) score += 7;
  if (p.category === 'beaute') score += 5;
  return Math.min(score + Math.floor(Math.random() * 12), 99);
}

// ---------------------------------------------------------------
// API PUBLIQUE
// ---------------------------------------------------------------

/**
 * Génère un script Hook-Body-CTA complet pour un produit donné.
 * Ton 100% français natif, jamais une traduction US.
 */
export function generateScript(req: ScriptRequest): GeneratedScript {
  const { product, style, agentUnit } = req;

  const hookPool = HOOK_TEMPLATES[style] ?? HOOK_TEMPLATES.ugc;
  const hook = hookPool[Math.floor(Math.random() * hookPool.length)](product);
  const body = buildBody(product, agentUnit, style);
  const cta  = buildCTA(product, agentUnit);
  const hashtags = buildHashtags(product, agentUnit);
  const estimatedViralScore = estimateViralScore(product, style);

  return { hook, body, cta, hashtags, estimatedViralScore };
}

/**
 * Transforme un script vidéo en ébauche d'article SEO (Agent Rédacteur).
 * À brancher sur l'API Claude ou GPT en production.
 */
export function scriptToSEOArticle(script: GeneratedScript, product: Product): string {
  return `# ${product.product_name} — Test & Avis Complet ${new Date().getFullYear()}

## Introduction
${script.hook.replace(/[🚨👀😭]/g, '')}

## Notre Test Terrain
${script.body}

## Pour Qui ?
Idéal pour les profils ${product.target_audience?.interests?.join(', ') ?? 'passionnés'}.
Tranche d'âge cible : ${product.target_audience?.age_min ?? 18}-${product.target_audience?.age_max ?? 45} ans.

## Prix & Disponibilité
**Prix constaté** : ${product.price.toLocaleString('fr-FR')}€  
**Où l'acheter** : [TikTok Shop](${product.tiktok_shop_url ?? '#'})

## Verdict
${script.cta}

---
*Article généré par Swarm-Creator AI — Agent Rédacteur 11 — Core-IA.fr*
`;
}

/**
 * Génère un post forum/communauté (Agent Forum 12).
 */
export function generateForumPost(product: Product): string {
  return `**[Discussion] ${product.product_name} de ${product.brand_name} — retours d'expérience ?**

Bonjour à tous,

J'utilise ${product.product_name} depuis quelques semaines maintenant.
Prix : ${product.price.toLocaleString('fr-FR')}€, disponible sur TikTok Shop.

Quelques observations initiales :
- ${product.ugc_style_notes ?? `Correspond bien à la description ${product.brand_name}`}
- Rapport qualité/prix : à discuter ensemble

Est-ce que d'autres membres l'ont testé ? Vos retours m'intéressent, surtout si vous êtes dans la tranche ${product.target_audience?.age_min ?? 18}-${product.target_audience?.age_max ?? 35} ans.

Lien produit : ${product.tiktok_shop_url ?? 'disponible sur demande'}

*(Partage non sponsorisé — achat personnel)*`;
}
