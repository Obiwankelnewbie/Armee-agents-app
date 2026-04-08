'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function forcePush() {
    console.log("🚀 TENTATIVE DE FORÇAGE VERS SENTINELLE...");
    
    const { data, error } = await supabase.from('agent_briefings').insert([{
        source_agent: 'TEST-DEBUG',
        target_agent: 'AGENT-SENTINELLE-02',
        content: JSON.stringify({ test: "COUCOU SENTINELLE" }),
        processed: false
    }]).select();

    if (error) {
        console.error("❌ ÉCHEC CRITIQUE :", error.message);
    } else {
        console.log("✅ SUCCÈS ! Message envoyé avec l'ID :", data[0].id);
        console.log("👉 Maintenant, regarde ton SQL Editor Supabase.");
    }
}

forcePush();