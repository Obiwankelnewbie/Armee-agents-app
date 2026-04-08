// 🧠 AGENT INFILTRÉ — SWARM OS V3 AUTO POST V2
// Autonomous Posting System (Gandalf Core Required)
// Hiérarchie : Briefings -> Infiltré -> Gandalf (Validation) -> Ancalagon (Autorité)

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Connexion réelle à ton infrastructure
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TRIGGER_URL = process.env.SERVER_URL || 'http://localhost:3333';

// ⚠️ CONFIGURATION
const CONFIG = {
  agentId: 'AGENT-INFILTRE-V3', // ID unique pour ton Dashboard
  platforms: ["tiktok", "x"],
  postTimes: ["18:42", "21:13", "23:07"],
  anomalyChance: 0.15,
  minImpactScore: 0.7 // Seuil d'autorité d'Ancalagon
};

// 🧙‍♂️ GANDALF CORE (Connecté à la table gandalf_analyses)
class Gandalf {
  static async validate(content, briefingId) {
    console.log("🧙‍♂️ Gandalf analyse la pertinence stratégique...");
    
    // On enregistre l'analyse dans Supabase pour le Dashboard
    await supabase.from('gandalf_analyses').insert([{
      agent_id: CONFIG.agentId,
      content_ref: briefingId,
      status: 'APPROVED', // Validation auto pour le test
      decision_metadata: { score: 0.88, logic: "Opportunité Tech/IA valide" }
    }]);

    return { approved: true, score: 0.88 };
  }

  static async enhance(content) {
    content.script += " ...observe bien le signal.";
    return content;
  }
}

// 🧠 AGENT (Connecté aux Briefings réels)
class AgentInfiltre {
  constructor() {
    this.memory = [];
  }

  // RÉCUPÉRATION : On pioche dans les 5000+ briefings de Sauron
  async fetchRealIntelligence() {
    const { data, error } = await supabase
      .from('agent_briefings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data;
  }

  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  async generateContent() {
    // On va chercher une news réelle au lieu de phrases bidons
    const intelligence = await this.fetchRealIntelligence();
    
    // Si pas de news fraîche ou impact trop faible (Autorité Ancalagon)
    if (!intelligence || intelligence.impact_score < CONFIG.minImpactScore) {
      console.log("🐲 Ancalagon : Impact trop faible pour l'Oracle.");
      return null;
    }

    const hooks = [
      "L'Oracle a détecté un mouvement.",
      "C'est déjà en train de changer.",
      "Le briefing de l'ombre est tombé.",
      "Ils ne regardent pas au bon endroit."
    ];

    // On transforme le briefing en script court
    const cleanContent = intelligence.content.substring(0, 100);

    return {
      briefingId: intelligence.id,
      hook: this.pick(hooks),
      script: `Analyse terminée : ${cleanContent}`,
      duration: "8-12 sec",
      visual: "dark + neon",
      impact: intelligence.impact_score,
      timestamp: new Date().toISOString()
    };
  }

  detectAnomaly() {
    return Math.random() < CONFIG.anomalyChance;
  }
}

// 🤖 POSTING ENGINE — SWARM OS INTEGRATED
class AutoPostEngine {
  constructor(agent) {
    this.agent = agent;
    this.lastPostMinute = "";
  }

  // 📡 Rapport de présence aux DEUX tables du Dashboard
  async reportStatus() {
    try {
      // 1. Inscription dans l'annuaire principal (Table agents)
      await supabase.from('agents').upsert({ 
        id: CONFIG.agentId, 
        name: 'Oracle Infiltré', 
        role: 'Social Infiltrator',
        status: 'ACTIVE' 
      });

      // 2. Signal de vie (Table agent_status)
      await supabase.from('agent_status').upsert({ 
        agent_id: CONFIG.agentId, 
        status: 'ACTIVE', 
        last_seen: new Date().toISOString()
      });

      console.log(`📡 [DASHBOARD] ${CONFIG.agentId} est en ligne.`);
    } catch (e) {
      console.error("❌ Erreur reporting Dashboard:", e.message);
    }
  }

  async createValidatedContent() {
    let content = await this.agent.generateContent();
    if (!content) return null;

    const review = await Gandalf.validate(content, content.briefingId);
    if (!review.approved) return null;

    content = await Gandalf.enhance(content);
    return content;
  }

  async postToX(content) { console.log("🐦 [X-POST] :", content.hook); }
  async postToTikTok(content) { console.log("🎵 [TIKTOK-POST] :", content.script); }

  async executePostCycle() {
    const isAnomaly = this.agent.detectAnomaly();
    let content;

    if (isAnomaly) {
      console.log("🚨 [MODE ANOMALIE]");
      content = { hook: "Ok… l'IA vient de franchir une ligne.", script: "Ce briefing n'aurait jamais dû sortir. Observez bien.", duration: "7 sec" };
    } else {
      content = await this.createValidatedContent();
    }

    if (!content) return;

    for (const platform of CONFIG.platforms) {
      if (platform === "x") await this.postToX(content);
      if (platform === "tiktok") await this.postToTikTok(content);
    }
  }

  start() {
    console.log(`🧠 [SYSTEM] ${CONFIG.agentId} — INITIALISATION`);
    this.reportStatus();
    setInterval(() => this.reportStatus(), 300000);

    setInterval(() => {
      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5);
      if (CONFIG.postTimes.includes(currentTime) && this.lastPostMinute !== currentTime) {
        this.lastPostMinute = currentTime;
        this.executePostCycle();
      }
    }, 15000);
  }
}

// ▶️ INIT
const agent = new AgentInfiltre();
const engine = new AutoPostEngine(agent);
engine.start();

module.exports = { AgentInfiltre, AutoPostEngine, Gandalf };
