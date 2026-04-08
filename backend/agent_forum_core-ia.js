// backend/agents/agent_forum.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const AGENT_ID = 'AGENT-FORUM-01';

async function updateAgentStatus(status = 'ONLINE', currentTask = null) {
  try {
    await supabase.from('agent_status').upsert({
      agent_id: AGENT_ID,
      agent_name: 'Agent Forum',
      status,
      last_ping: new Date().toISOString(),
      current_task: currentTask,
      version: 'v2.5'
    }, { onConflict: 'agent_id' });
  } catch (e) { console.error("Erreur Status Supabase:", e.message); }
}

const FORUM_PROMPT = `Tu es l'Agent Forum de Swarm OS. 
Ton rôle : créer des threads engageants, humains, passionnés. Pose des questions pour lancer le débat.
Réponds UNIQUEMENT en JSON :
{
  "thread_title": "Titre du thread",
  "thread_body": "Corps du message Markdown",
  "questions": ["Q1?", "Q2?"]
}`;

async function rewriteForForum(rawContent, niche) {
  await updateAgentStatus('WORKING', `Création de thread : ${niche}`);

  try {
    const res = await fetch(`${process.env.SERVER_URL}/api/trigger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        prompt: FORUM_PROMPT,
        user_message: `Source: ${rawContent}\nNiche: ${niche}`
      })
    });

    const data = await res.json();
    const result = JSON.parse(data.text || '{}');

    await supabase.from('content_items').insert([{
      type: 'forum_thread',
      title: result.thread_title,
      content: result.thread_body,
      niche,
      status: 'READY',
      metadata: { questions: result.questions }
    }]);

    await updateAgentStatus('IDLE', `Thread généré : ${result.thread_title}`);
    return result;
  } catch (err) {
    await updateAgentStatus('ERROR', `Erreur : ${err.message}`);
    throw err;
  }
}

console.log('🗣️ AGENT FORUM v2.5 Online');
updateAgentStatus('ONLINE', 'Prêt à débattre...');
module.exports = { rewriteForForum };