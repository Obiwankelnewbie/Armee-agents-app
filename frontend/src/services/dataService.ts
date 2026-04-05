// ============================================================
// SWARM-CREATOR AI — Data Service v2.0
// Branché sur le vrai schéma Supabase
// ============================================================

import { supabase } from '../lib/supabase';
import type { Agent, VideoJob, Product, AnalyticsGMV, SwarmStats } from '../types';

// ─────────────────────────────────────────────────────────
// AGENTS
// Colonnes réelles : id, name, unit, status,
//                   videos_produced_today, created_at
// ─────────────────────────────────────────────────────────

export async function fetchAgents(): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Agent[];
}

export async function updateAgentStatus(
  agentId: string,
  status: Agent['status']
): Promise<void> {
  const { error } = await supabase
    .from('agents')
    .update({ status })
    .eq('id', agentId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// VIDEO JOBS
// Colonnes réelles : id, agent_id, status, product_id,
//                   product_name, production_cost,
//                   gmv_generated, views_count,
//                   created_at, updated_at
// ─────────────────────────────────────────────────────────

export async function fetchActiveJobs(): Promise<VideoJob[]> {
  const { data, error } = await supabase
    .from('video_jobs')
    .select(`
      *,
      agent:agents(name, unit)
    `)
    // Statuts actifs dans ta table : pending, scripting, rendering, publishing
    // Statuts terminés à exclure : done, error
    .not('status', 'in', '(done,error)')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as VideoJob[];
}

export async function createVideoJob(
  productId: string,
  agentId: string,
  productName: string,
  cost: number = 5.5
): Promise<VideoJob> {
  const { data, error } = await supabase
    .from('video_jobs')
    .insert({
      product_id:      productId,
      agent_id:        agentId,
      product_name:    productName,
      status:          'pending',
      production_cost: cost,
    })
    .select()
    .single();
  if (error) throw error;
  return data as VideoJob;
}

export async function updateJobStatus(
  jobId: string,
  status: string,
  extra?: { gmv_generated?: number; views_count?: number }
): Promise<void> {
  const { error } = await supabase
    .from('video_jobs')
    .update({ status, updated_at: new Date().toISOString(), ...extra })
    .eq('id', jobId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// PRODUCTS
// Colonnes réelles : id, client_id, product_name, brand_name,
//                   category, price, commission_rate,
//                   tiktok_shop_url, is_active, created_at
// ─────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function createProduct(
  product: Omit<Product, 'id' | 'created_at' | 'updated_at'>
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// GMV ANALYTICS
// Colonnes réelles : id, date, hour, product_id, agent_id,
//                   videos_published, total_views, total_clicks,
//                   total_orders, gmv, production_cost, roi
// ─────────────────────────────────────────────────────────

export async function fetchGMVHourly(date?: string): Promise<AnalyticsGMV[]> {
  const targetDate = date ?? new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('analytics_gmv')
    .select('*')
    .eq('date', targetDate)
    .order('hour', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AnalyticsGMV[];
}

export async function fetchGMVTotal(): Promise<number> {
  const { data, error } = await supabase
    .from('analytics_gmv')
    .select('gmv');
  if (error) return 0;
  return (data ?? []).reduce((sum, row) => sum + (row.gmv || 0), 0);
}

// ─────────────────────────────────────────────────────────
// SCAN RESULTS — lecture historique
// ─────────────────────────────────────────────────────────

export async function fetchScanHistory(clientId: string, limit = 15) {
  const { data, error } = await supabase
    .from('scan_results')
    .select('id, keyword, global_score, verdict, opportunity_level, data_quality, real_sources, scanned_at')
    .eq('client_id', clientId)
    .order('scanned_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ─────────────────────────────────────────────────────────
// OPPORTUNITY ALERTS
// ─────────────────────────────────────────────────────────

export async function fetchUnreadAlerts(clientId: string) {
  const { data, error } = await supabase
    .from('opportunity_alerts')
    .select('*')
    .eq('client_id', clientId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data ?? [];
}

export async function markAlertRead(alertId: string): Promise<void> {
  const { error } = await supabase
    .from('opportunity_alerts')
    .update({ is_read: true })
    .eq('id', alertId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────
// STATS CALCULÉES
// GMV calculé depuis analytics_gmv + video_jobs
// (agents n'a pas de colonne gmv_generated)
// ─────────────────────────────────────────────────────────

export async function computeSwarmStats(
  agents: Agent[],
  jobs: VideoJob[]
): Promise<SwarmStats> {
  // GMV réel depuis video_jobs
  const gmvFromJobs = jobs.reduce((s, j) => s + (j.gmv_generated ?? 0), 0);

  // GMV depuis analytics_gmv si disponible
  let gmvFromAnalytics = 0;
  try {
    gmvFromAnalytics = await fetchGMVTotal();
  } catch { /* silencieux */ }

  const totalGMV   = gmvFromAnalytics || gmvFromJobs;
  const totalVideos = agents.reduce((s, a) => s + (a.videos_produced_today ?? 0), 0);
  const totalCost  = jobs.reduce((s, j) => s + (j.production_cost ?? 0), 0) || totalVideos * 5.5;
  const netMargin  = totalGMV > 0 ? Math.round(((totalGMV - totalCost) / totalGMV) * 100) : 0;

  return {
    totalAgents:  agents.length,
    activeAgents: agents.filter(a => !['idle','offline'].includes(a.status)).length,
    idleAgents:   agents.filter(a => a.status === 'idle').length,
    errorAgents:  agents.filter(a => a.status === 'error').length,
    videosToday:  totalVideos,
    totalGMV,
    totalCost,
    netMargin,
    roi: totalCost > 0 ? Math.round(((totalGMV - totalCost) / totalCost) * 100) : 0,
  };
}
