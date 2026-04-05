// ============================================================
// SWARM-CREATOR AI — TypeScript Types v2.0
// Alignés sur le vrai schéma Supabase
// ============================================================

// ─────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────

export type AgentStatus =
  | 'idle'
  | 'scripting'
  | 'rendering'
  | 'publishing'
  | 'error'
  | 'offline';

export type AgentUnit =
  | 'tiktok_shop'
  | 'affiliation'
  | 'media_buzz'
  | 'forum'
  | 'redacteur'
  | 'market_intel';

export type ProductCategory =
  | 'beaute'
  | 'mode'
  | 'maison'
  | 'food'
  | 'tech'
  | 'sport'
  | 'sante'
  | 'autre';

// Statuts réels dans video_jobs Supabase
export type JobStatus =
  | 'pending'
  | 'scripting'
  | 'rendering'
  | 'publishing'
  | 'done'
  | 'error';

// Plan client
export type ClientPlan = 'free' | 'starter' | 'pro' | 'enterprise';

// ─────────────────────────────────────────────────────────
// AGENT
// Colonnes réelles : id, name, unit, status,
//                   videos_produced_today, created_at
// ─────────────────────────────────────────────────────────
export interface Agent {
  id:                    string;
  name:                  string;
  unit:                  AgentUnit;
  status:                AgentStatus;
  videos_produced_today: number;
  created_at:            string;
  // Champs optionnels non stockés en DB — calculés côté front
  gmv_generated?:        number;
  cost_per_video?:       number;
}

// ─────────────────────────────────────────────────────────
// PRODUCT
// Colonnes réelles : id, client_id, product_name, brand_name,
//                   category, price, commission_rate,
//                   tiktok_shop_url, ugc_style_notes,
//                   hook_keywords, target_age_min,
//                   target_age_max, target_interests,
//                   is_active, created_at, updated_at
// ─────────────────────────────────────────────────────────
export interface Product {
  id:               string;
  client_id?:       string;
  product_name:     string;
  brand_name:       string;
  category:         ProductCategory;
  price:            number;
  commission_rate:  number;       // ex: 0.05 = 5 %
  tiktok_shop_url?: string | null;
  ugc_style_notes?: string | null;
  hook_keywords?:   string[];
  target_age_min?:  number;
  target_age_max?:  number;
  target_interests?:string[];
  is_active:        boolean;
  created_at:       string;
  updated_at?:      string;
}

// ─────────────────────────────────────────────────────────
// VIDEO JOB
// Colonnes réelles : id, agent_id, status, product_id,
//                   product_name, production_cost,
//                   gmv_generated, views_count,
//                   created_at, updated_at
// ─────────────────────────────────────────────────────────
export interface VideoJob {
  id:               string;
  agent_id:         string | null;
  status:           JobStatus;
  product_id?:      string | null;
  product_name?:    string | null;
  production_cost?: number | null;
  gmv_generated?:   number;
  views_count?:     number;
  created_at:       string;
  updated_at?:      string;
  // Relations joinées (optionnelles)
  agent?:           Pick<Agent, 'name' | 'unit'>;
  product?:         Pick<Product, 'product_name' | 'brand_name' | 'category' | 'price'>;
}

// ─────────────────────────────────────────────────────────
// CLIENT
// Colonnes réelles : id, email, full_name, company_name,
//                   plan, plan_expires_at, api_key,
//                   is_active, created_at, updated_at
// ─────────────────────────────────────────────────────────
export interface Client {
  id:               string;
  email:            string;
  full_name?:       string;
  company_name?:    string;
  plan:             ClientPlan;
  plan_expires_at?: string | null;
  api_key?:         string;
  is_active:        boolean;
  created_at:       string;
  updated_at?:      string;
}

// ─────────────────────────────────────────────────────────
// SCAN RESULT
// Colonnes réelles : id, client_id, keyword, global_score,
//                   tiktok_score, youtube_score, reddit_score,
//                   trends_score, pinterest_score, verdict,
//                   verdict_detail, opportunity_level,
//                   window_days, hook_suggestion, insights,
//                   data_quality, real_sources, scanned_at
// ─────────────────────────────────────────────────────────
export interface ScanResult {
  id:                string;
  client_id:         string;
  product_id?:       string | null;
  keyword:           string;
  tiktok_score?:     number;
  youtube_score?:    number;
  reddit_score?:     number;
  trends_score?:     number;
  pinterest_score?:  number;
  global_score:      number;
  verdict:           'FONCER' | 'ATTENDRE' | 'RISQUÉ';
  verdict_detail?:   string;
  opportunity_level: 'HIGH' | 'MEDIUM' | 'LOW';
  window_days?:      string;
  hook_suggestion?:  string;
  insights?:         string[];
  data_quality:      'real' | 'estimated';
  real_sources?:     string[];
  scanned_at:        string;
}

// ─────────────────────────────────────────────────────────
// OPPORTUNITY ALERT
// ─────────────────────────────────────────────────────────
export interface OpportunityAlert {
  id:               string;
  client_id:        string;
  scan_id?:         string | null;
  product_name:     string;
  global_score:     number;
  verdict:          string;
  hook_suggestion?: string;
  window_days?:     string;
  is_read:          boolean;
  is_actioned:      boolean;
  created_at:       string;
}

// ─────────────────────────────────────────────────────────
// AGENT MISSION
// ─────────────────────────────────────────────────────────
export interface AgentMission {
  id:            string;
  client_id:     string;
  agent_type:    AgentUnit | 'hunter' | 'clone' | 'spy' | 'hook' | 'script' | 'pipeline';
  input_text:    string;
  output_text?:  string;
  tokens_used?:  number;
  cost_usd?:     number;
  status:        'pending' | 'running' | 'success' | 'error';
  error_message?:string;
  duration_ms?:  number;
  created_at:    string;
}

// ─────────────────────────────────────────────────────────
// ANALYTICS GMV
// Colonnes réelles : id, date, hour, product_id, agent_id,
//                   videos_published, total_views, total_clicks,
//                   total_orders, gmv, production_cost, roi
// ─────────────────────────────────────────────────────────
export interface AnalyticsGMV {
  id:                string;
  date:              string;       // 'YYYY-MM-DD'
  hour?:             number | null; // 0-23
  product_id?:       string | null;
  agent_id?:         string | null;
  videos_published:  number;
  total_views:       number;
  total_clicks:      number;
  total_orders:      number;
  gmv:               number;
  production_cost:   number;
  roi?:              number | null;
}

// ─────────────────────────────────────────────────────────
// USAGE TRACKING
// ─────────────────────────────────────────────────────────
export interface UsageTracking {
  id:              string;
  client_id:       string;
  month:           string;
  scans_count:     number;
  missions_count:  number;
  scripts_count:   number;
  tokens_used:     number;
  cost_usd:        number;
}

// ─────────────────────────────────────────────────────────
// SCRIPT GENERATION (front-only, pas en DB)
// ─────────────────────────────────────────────────────────
export interface ScriptRequest {
  product:   Product;
  style:     'ugc' | 'temoignage' | 'defi' | 'hack' | 'review';
  agentUnit: AgentUnit;
}

export interface GeneratedScript {
  hook:               string;   // 0-3 s
  body:               string;   // 3-25 s
  cta:                string;   // 25-30 s
  hashtags:           string[];
  estimatedViralScore:number;   // 0-100
}

// ─────────────────────────────────────────────────────────
// DASHBOARD STATE (front-only)
// ─────────────────────────────────────────────────────────
export interface SwarmStats {
  totalAgents:  number;
  activeAgents: number;
  idleAgents:   number;
  errorAgents:  number;
  videosToday:  number;
  totalGMV:     number;
  totalCost:    number;
  netMargin:    number;
  roi:          number;
}

export interface UnitStats {
  unit:        AgentUnit;
  label:       string;
  agentCount:  number;
  videosToday: number;
  gmv:         number;
}