// agent_crm_optimizer.js — SWARM CRM OPTIMIZER v2.5 FINAL
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const AGENT_ID = 'AGENT-CRM-OPTIMIZER-01';

async function logToFeed(type, message, leadId = null) {
  try {
    await supabase.from('live_feed_events').insert([{
      type,
      message: `[${type}] ${new Date().toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })} → ${message}`,
      lead_id: leadId,
      run_id: `CRM-${Date.now()}`
    }]);
  } catch (err) {
    console.error('Erreur logToFeed:', err.message);
  }
}

// === MONITORING LIVE (Heartbeat) ===
async function updateAgentStatus(status = 'ONLINE', currentTask = null, error = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: 'CRM Optimizer',
      status,
      last_ping: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      current_task: currentTask,
      last_error: error ? error.toString().slice(0, 500) : null, // limite la taille
      version: 'v2.5'
    }, { onConflict: 'agent_id' });
  } catch (e) {
    console.error('Failed to update agent_status:', e.message);
  }
}

const SYSTEM_PROMPT = `Tu es le SWARM CRM OPTIMIZER v2.5.
Ton rôle unique : exécuter les mises à jour CRM avec précision chirurgicale.
Zéro hallucination. Historique immuable.
Réponds UNIQUEMENT avec le JSON demandé.`;

async function processCrmSignal(lead_id, interaction_entry, next_task) {
    try {
        // 1. Appel à l'IA (On récupère la décision)
        const res = await fetch(`${SERVER_URL}/api/trigger`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_id: AGENT_ID,
                prompt: CRM_PROMPT,
                user_message: JSON.stringify({ lead_id, interaction_entry, next_task })
            })
        });

        const data = await res.json();
        const resultText = data.text || data.content?.[0]?.text || '{}';
        const result = JSON.parse(resultText);

        // Extraction des données de l'IA
        const { action_crm, updates, live_feed_message } = result;

        console.log(`✅ CRM Optimizer -> ${action_crm} | Lead ${lead_id || 'N/A'}`);

        // 2. Actions Supabase (Mise à jour du Lead)
        await logToFeed('CRM', live_feed_message || `[CRM] Action sur lead ${lead_id}`, lead_id);

        if (updates && lead_id) {
            await supabase.from('leads').update(updates).eq('id', lead_id);
        }

        // 3. Insertion de l'interaction
        if (interaction_entry?.content_summary && lead_id) {
            await supabase.from('interactions').insert([{
                lead_id,
                type: interaction_entry.type || 'manual',
                content_summary: interaction_entry.content_summary,
                sentiment: interaction_entry.sentiment || 'NEUTRAL',
                metadata: { next_task: result.next_task || 'NONE' }
            }]);
        }

        // 4. --- 📥 ALERTE TELEGRAM (Le déclencheur "Lead Chaud") ---
        // On vérifie si la décision de l'IA est "PRIORITE_HAUTE" ou si le statut passe en "NEGOTIATION"
        if (result.decision?.includes('PRIORITE_HAUTE') || updates?.status === 'NEGOTIATION') {
            const { sendTelegramAlert } = require('./telegram/bot');
            
            await sendTelegramAlert(
                `<b>🔥 Lead chaud détecté !</b>\n\n` +
                `👤 ID Lead: ${lead_id}\n` +
                `🎯 Score BANT: ${updates?.bant_score || 'N/A'}/10\n` +
                `📈 Nouveau Statut: ${updates?.status || 'N/A'}\n` +
                `📝 Note: ${action_crm}`,
                { emoji: '🔥' }
            );
        }

        // 5. Finalisation
        await updateAgentStatus('IDLE', 'En attente de nouveau signal');
        return result;

    } catch (err) {
        console.error('❌ CRM Optimizer Error:', err.message);
        await updateAgentStatus('ERROR', null, err.message);
        throw err;
    }
}