// backend/utils/memoryMirror.js — L'Intelligence Mémorielle du Swarm
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Analyse les succès passés pour guider l'action présente.
 * @param {Object} leadData - Les données du lead actuel
 * @param {number} similarityThreshold - Niveau de ressemblance (0.0 à 1.0)
 */
async function getMemoryMirror(leadData, similarityThreshold = 0.78) {
  try {
    // On prépare le texte de recherche basé sur le contexte actuel
    const leadText = `${leadData.niche} ${leadData.job_title} ${leadData.company_name || ''} ${leadData.metadata?.context || ''}`;

    // APPEL RPC : Recherche vectorielle dans la base de données
    // Note : Nécessite la fonction SQL 'match_embeddings' sur Supabase
    const { data, error } = await supabase.rpc('match_embeddings', {
      query_text: leadText, // En v2.8, l'IA compare le sens, pas juste les mots
      match_threshold: similarityThreshold,
      match_count: 3 // On prend les 3 meilleures victoires passées
    });

    if (error) {
      console.warn('⚠️ MemoryMirror: Recherche vectorielle non configurée, passage en mode manuel.');
      return [];
    }

    return data.map(item => ({
      similarity: Math.round(item.similarity * 100),
      pastLead: item.metadata?.name || 'Anonyme',
      winningMessage: item.content,
      strategyUsed: item.metadata?.strategy || 'Standard',
      result: 'WON'
    }));
  } catch (err) {
    console.error('❌ Memory Mirror Error:', err.message);
    return [];
  }
}

module.exports = { getMemoryMirror };