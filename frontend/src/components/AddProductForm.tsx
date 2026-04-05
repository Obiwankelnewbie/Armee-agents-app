// ============================================================
// SWARM-CREATOR AI — AddProductForm Component
// Formulaire d'ajout produit → table Supabase `products`
// ============================================================

import React, { useState } from 'react';
import { createProduct } from '../services/dataService';
import type { Product, ProductCategory } from '../types';

interface Props {
  onSuccess: (product: Product) => void;
  onCancel: () => void;
}

const CATEGORIES: { value: ProductCategory; label: string }[] = [
  { value: 'beaute', label: '💄 Beauté' },
  { value: 'mode',   label: '👗 Mode' },
  { value: 'tech',   label: '📱 Tech' },
  { value: 'maison', label: '🏠 Maison' },
  { value: 'food',   label: '🍴 Food' },
  { value: 'sport',  label: '🏋️ Sport' },
  { value: 'sante',  label: '🌿 Santé' },
];

interface FormData {
  brand_name: string;
  product_name: string;
  category: ProductCategory;
  price: string;
  commission_rate: string;
  tiktok_shop_url: string;
  ugc_style_notes: string;
  hook_keywords: string;       // CSV → string[]
  target_age_min: string;
  target_age_max: string;
  target_gender: 'f' | 'm' | 'all';
  target_interests: string;    // CSV → string[]
}

const EMPTY_FORM: FormData = {
  brand_name: '', product_name: '', category: 'beaute',
  price: '', commission_rate: '5',
  tiktok_shop_url: '', ugc_style_notes: '',
  hook_keywords: '', target_age_min: '18', target_age_max: '35',
  target_gender: 'all', target_interests: '',
};

export function AddProductForm({ onSuccess, onCancel }: Props) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.brand_name.trim() || !form.product_name.trim() || !form.price) {
      setError('Marque, produit et prix sont obligatoires.');
      return;
    }
    setLoading(true);
    try {
      const newProduct = await createProduct({
        brand_name: form.brand_name.trim(),
        product_name: form.product_name.trim(),
        category: form.category,
        price: parseFloat(form.price),
        commission_rate: parseFloat(form.commission_rate) / 100,
        tiktok_shop_url: form.tiktok_shop_url.trim() || null,
        ugc_style_notes: form.ugc_style_notes.trim() || null,
        hook_keywords: form.hook_keywords.split(',').map(s => s.trim()).filter(Boolean),
        assets_urls: [],
        is_active: true,
        target_audience: {
          age_min: parseInt(form.target_age_min),
          age_max: parseInt(form.target_age_max),
          gender: form.target_gender,
          interests: form.target_interests.split(',').map(s => s.trim()).filter(Boolean),
        },
      });
      onSuccess(newProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={modalHdr}>
          <span style={modalTitle}>➕ Nouveau Produit</span>
          <button onClick={onCancel} style={btnClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={formStyle}>
          {error && <div style={errorBox}>{error}</div>}

          <div style={row}>
            <Field label="Marque *">
              <input style={input} value={form.brand_name} onChange={set('brand_name')} placeholder="ex: NARS" />
            </Field>
            <Field label="Produit *">
              <input style={input} value={form.product_name} onChange={set('product_name')} placeholder="ex: Blush Orgasm" />
            </Field>
          </div>

          <div style={row}>
            <Field label="Catégorie">
              <select style={input} value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Prix (€) *">
              <input style={input} type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="42.00" />
            </Field>
            <Field label="Commission (%)">
              <input style={input} type="number" min="1" max="50" value={form.commission_rate} onChange={set('commission_rate')} placeholder="5" />
            </Field>
          </div>

          <Field label="URL TikTok Shop">
            <input style={input} type="url" value={form.tiktok_shop_url} onChange={set('tiktok_shop_url')} placeholder="https://www.tiktok.com/t/..." />
          </Field>

          <Field label="Mots-clés Hook (séparés par virgule)">
            <input style={input} value={form.hook_keywords} onChange={set('hook_keywords')} placeholder="peau nette, anti-acné, résultats rapides" />
          </Field>

          <Field label="Notes de ton UGC">
            <textarea style={{ ...input, height: 68, resize: 'vertical' }} value={form.ugc_style_notes} onChange={set('ugc_style_notes')} placeholder="Produit pour peaux mixtes, ton décontracté, éviter le mot 'efficace'..." />
          </Field>

          <div style={row}>
            <Field label="Âge min">
              <input style={input} type="number" min="13" max="80" value={form.target_age_min} onChange={set('target_age_min')} />
            </Field>
            <Field label="Âge max">
              <input style={input} type="number" min="13" max="80" value={form.target_age_max} onChange={set('target_age_max')} />
            </Field>
            <Field label="Genre">
              <select style={input} value={form.target_gender} onChange={set('target_gender')}>
                <option value="all">Tous</option>
                <option value="f">Femmes</option>
                <option value="m">Hommes</option>
              </select>
            </Field>
          </div>

          <Field label="Centres d'intérêt cible (virgule)">
            <input style={input} value={form.target_interests} onChange={set('target_interests')} placeholder="beauté, skincare, routine matin" />
          </Field>

          <div style={formFooter}>
            <button type="button" onClick={onCancel} style={btnSecondary} disabled={loading}>Annuler</button>
            <button type="submit" style={btnPrimary} disabled={loading}>
              {loading ? '⏳ Création...' : '✅ Créer le produit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 140 }}>
      <label style={{ fontSize: 10, color: '#64748b', letterSpacing: '.08em', fontWeight: 700, textTransform: 'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}

// Styles inline pour portabilité maximale
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(5,6,15,.85)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 100, padding: 16,
};
const modal: React.CSSProperties = {
  background: '#0b0d1a', border: '1px solid #1e2035', borderRadius: 12,
  width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
};
const modalHdr: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px', borderBottom: '1px solid #1e2035',
};
const modalTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#00e5a0', fontFamily: "'JetBrains Mono',monospace" };
const btnClose: React.CSSProperties = { background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16 };
const formStyle: React.CSSProperties = { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 };
const row: React.CSSProperties = { display: 'flex', gap: 12, flexWrap: 'wrap' };
const input: React.CSSProperties = {
  background: '#10122a', border: '1px solid #1e2035', borderRadius: 6,
  color: '#e2e8f0', fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
  padding: '8px 10px', width: '100%', outline: 'none',
};
const errorBox: React.CSSProperties = {
  background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)',
  borderRadius: 6, padding: '8px 12px', color: '#ef4444', fontSize: 12,
};
const formFooter: React.CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 };
const btnPrimary: React.CSSProperties = {
  background: '#00e5a0', color: '#05060f', border: 'none', borderRadius: 6,
  padding: '9px 18px', fontFamily: "'JetBrains Mono',monospace", fontSize: 12,
  fontWeight: 700, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  background: 'transparent', color: '#64748b', border: '1px solid #1e2035',
  borderRadius: 6, padding: '9px 18px', fontFamily: "'JetBrains Mono',monospace",
  fontSize: 12, cursor: 'pointer',
};
