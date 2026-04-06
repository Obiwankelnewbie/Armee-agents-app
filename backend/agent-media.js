// backend/agents/agent_media.js — AGENT MEDIA v3.0
// Améliorations : retry/backoff, safe JSON parse, validation des champs,
//                 updateAgentStatus avec error, pas de side-effects au require(),
//                 timestamp explicite, HTTP status check.
'use strict';
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENT_ID = 'AGENT-MEDIA-01';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────

async function withRetry(fn, retries = 3, base = 800) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) {
        const delay = base * 2 ** attempt + Math.random() * 400;
        console.warn(`⚠️  [MEDIA] Retry ${attempt + 1}/${retries - 1} dans ${Math.round(delay)}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

function safeJsonParse(str) {
  try {
    // Nettoie les éventuels blocs ```json ... ``` que certains LLM ajoutent
    const clean = String(str ?? '').replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// TÉLÉMÉTRIE
// ─────────────────────────────────────────────────────────────

async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await withRetry(() =>
      supabase.from('agent_status').upsert({
        agent_id:     AGENT_ID,
        agent_name:   'Agent Media',
        status,
        last_ping:    new Date().toISOString(),
        current_task: currentTask,
        last_error:   error ? String(error).slice(0, 500) : null,
        version:      'v3.0',
      }, { onConflict: 'agent_id' })
    );
  } catch (e) {
    console.error('❌ [MEDIA] updateAgentStatus failed (non-fatal):', e.message);
  }
}

async function logToFeed(type, message) {
  try {
    await withRetry(() =>
      supabase.from('live_feed_events').insert([{
        type,
        message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', {
          hour: '2-digit', minute: '2-digit', second: '2-digit',
        })} → ${message}`,
        run_id: `MEDIA-${Date.now()}`,
      }])
    );
  } catch (err) {
    console.error('❌ [MEDIA] logToFeed failed (non-fatal):', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// PROMPT
// ─────────────────────────────────────────────────────────────

const MEDIA_PROMPT = `Tu es l'Agent Media de Swarm OS.
Ton rôle : réécrire des contenus bruts en articles pro, SEO-friendly, ton expert et clair.
Réponds UNIQUEMENT avec du JSON valide, sans markdown, sans texte avant ou après :
{
  "title": "Titre percutant",
  "content": "Article Markdown complet",
  "meta_description": "Description pour Google (150 caractères max)",
  "seo_keywords": ["mot1", "mot2"]
}`;

// ─────────────────────────────────────────────────────────────
// AGENT PRINCIPAL
// ─────────────────────────────────────────────────────────────

async function rewriteForMedia(rawContent, niche) {
  console.log(`📝 [MEDIA] Rédaction article — niche: ${niche}`);
  await updateAgentStatus('WORKING', `Rédaction article : ${niche}`);

  // 1. Appel API avec retry + HTTP status check
  let data;
  try {
    data = await withRetry(() =>
      fetch(`${process.env.SERVER_URL}/api/trigger`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          agent_id:     AGENT_ID,
          prompt:       MEDIA_PROMPT,
          user_message: `Niche: ${niche}\n\nContenu:\n${rawContent}`,
        }),
      }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
        return r.json();
      })
    );
  } catch (err) {
    console.error('❌ [MEDIA] Fetch API failed:', err.message);
    await updateAgentStatus('ERROR', 'API fetch failed', err.message);
    await logToFeed('MEDIA_ERROR', `Fetch échoué (${niche}): ${err.message}`);
    throw err; // remonte au Supervisor pour Promise.allSettled
  }

  // 2. Parse JSON sécurisé
  const result = safeJsonParse(data?.text ?? '');
  if (!result) {
    const raw = String(data?.text ?? '').slice(0, 200);
    const errMsg = `JSON invalide reçu de l'API: ${raw}`;
    console.error('❌ [MEDIA]', errMsg);
    await updateAgentStatus('ERROR', 'Invalid JSON response', errMsg);
    await logToFeed('MEDIA_ERROR', errMsg);
    throw new Error(errMsg);
  }

  // 3. Validation des champs obligatoires
  const missing = ['title', 'content', 'meta_description', 'seo_keywords']
    .filter(k => !result[k]);

  if (missing.length > 0) {
    const errMsg = `Champs manquants dans la réponse LLM: ${missing.join(', ')}`;
    console.error('❌ [MEDIA]', errMsg);
    await updateAgentStatus('ERROR', 'Incomplete LLM response', errMsg);
    await logToFeed('MEDIA_ERROR', errMsg);
    throw new Error(errMsg);
  }

  // Sanitisation : seo_keywords doit être un tableau de strings
  if (!Array.isArray(result.seo_keywords)) {
    result.seo_keywords = String(result.seo_keywords).split(',').map(s => s.trim());
  }

  // 4. Insert Supabase avec retry + timestamp explicite
  try {
    await withRetry(() =>
      supabase.from('content_items').insert([{
        type:       'media_article',
        title:      result.title,
        content:    result.content,
        niche,
        status:     'READY',
        created_at: new Date().toISOString(),
        metadata:   {
          seo:      result.meta_description,
          keywords: result.seo_keywords,
        },
      }])
    );
  } catch (err) {
    // L'insert a échoué mais le contenu est valide — on log sans bloquer le retour
    console.error('❌ [MEDIA] Insert Supabase failed:', err.message);
    await logToFeed('MEDIA_ERROR', `Insert échoué pour "${result.title}": ${err.message}`);
  }

  await updateAgentStatus('IDLE', `Article prêt : ${result.title}`);
  await logToFeed('MEDIA', `Article généré : "${result.title}" (${niche})`);
  console.log(`✅ [MEDIA] Article prêt — "${result.title}"`);

  return result;
}

// ─────────────────────────────────────────────────────────────
// DÉMARRAGE STANDALONE uniquement
// Aucun side-effect au require() — le Supervisor ne polluera
// pas le feed Supabase à chaque import.
// ─────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('📝 AGENT MEDIA v3.0 — Mode standalone activé');
  updateAgentStatus('ONLINE', 'En attente de contenu...');
}

module.exports = { rewriteForMedia };