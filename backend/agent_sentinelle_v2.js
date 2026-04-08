'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERREUR : Clés Supabase manquantes !');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const AGENT_ID       = 'AGENT-SENTINELLE-02';
const TARGET_TRADER  = 'AGENT-TRADER-01';
const CHECK_INTERVAL = 20_000;

const SEUIL_EXECUTE = 0.55;
const SEUIL_MONITOR = 0.35;

function evaluateSignal(signal) {
  let score = Number(signal.impact_score) || 0;
  let risk  = 'MEDIUM';

  const text = (signal.briefing || signal.title || '').toLowerCase();
  const ca   = signal.token_address || null;

  if (!ca || ca === '0x...') score -= 0.10;

  if (/moon|pump|x100|gem|giveaway|presale|whitelist/.test(text)) {
    score -= 0.30;
    risk   = 'HIGH';
  }

  if (signal.event_type === 'HACK' && signal.urgency === 'CRITICAL') score += 0.10;
  if (signal.event_type === 'ETF') score += 0.05;

  score = Math.max(0, Math.min(1, score));

  let verdict, reasoning;

  if (score >= SEUIL_EXECUTE) {
    verdict   = 'EXECUTE';
    reasoning = `Signal actionnable (score ${score.toFixed(2)}, risque ${risk})`;
  } else if (score >= SEUIL_MONITOR) {
    verdict   = 'MONITOR';
    reasoning = `Signal faible (score ${score.toFixed(2)}) — surveillance`;
  } else {
    verdict   = 'ABORT';
    reasoning = ca ? `Score trop bas (${score.toFixed(2)})` : `Pas de CA + score faible (${score.toFixed(2)})`;
  }

  return { verdict, risk_level: risk, confidence_adjusted: Number(score.toFixed(2)), token_address: ca, reasoning, original_signal: signal };
}

async function runSentinelle() {
  console.log(`\n🛡️  [${AGENT_ID}] EN GARDE`);
  console.log(`   Seuil EXECUTE : ${SEUIL_EXECUTE} | MONITOR : ${SEUIL_MONITOR}`);
  console.log(`   Cible Trader  : ${TARGET_TRADER}\n`);

  while (true) {
    try {
      const { data, error } = await supabase
        .from('agent_briefings')
        .select('*')
        .eq('target_agent', AGENT_ID)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data?.length) {
        console.log(`\n📥 ${data.length} briefing(s) à filtrer…`);

        for (const briefing of data) {
          let signal;
          try {
            signal = typeof briefing.content === 'string'
              ? JSON.parse(briefing.content)
              : briefing.content;
          } catch {
            console.warn(`⚠️  #${briefing.id.slice(0,8)} — JSON invalide, ignoré`);
            await supabase.from('agent_briefings').update({ processed: true }).eq('id', briefing.id);
            continue;
          }

          const decision = evaluateSignal(signal);
          const tag = decision.verdict === 'EXECUTE' ? '🟢' : decision.verdict === 'MONITOR' ? '🟡' : '🔴';
          console.log(`${tag} #${briefing.id.slice(0,8)} | ${decision.verdict} (${decision.confidence_adjusted}) — ${decision.reasoning}`);

          if (decision.verdict === 'EXECUTE') {
            const { error: sendError } = await supabase
              .from('agent_briefings')
              .insert([{
                source_agent: AGENT_ID,
                target_agent: TARGET_TRADER,
                content:      JSON.stringify(decision),
                priority:     'URGENT',
                processed:    false,
              }]);

            if (sendError) console.error('❌ Erreur envoi Trader :', sendError.message);
            else           console.log(`   🚀 Transmis à ${TARGET_TRADER}`);
          }

          await supabase.from('agent_briefings').update({ processed: true }).eq('id', briefing.id);
        }
      }

    } catch (err) {
      console.error('❌ Erreur boucle :', err.message);
    }

    await new Promise(r => setTimeout(r, CHECK_INTERVAL));
  }
}

runSentinelle();