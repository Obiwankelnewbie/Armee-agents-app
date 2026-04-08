import express from 'express';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION ESM ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONNEXION SUPABASE ---
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// --- MIDDLEWARES ---
app.use(cors({ origin: '*' }));
app.use(express.json());

// Sert les fichiers de ton application mobile/frontend
// Assure-toi que ton index.html est bien dans le dossier 'backend'
app.use(express.static(__dirname));

// --- ROUTES ---

// Route principale : affiche ton App Mobile
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Route de santé : indispensable pour launch.js
app.get('/status', (req, res) => {
    res.json({ 
        status: 'online', 
        agents_reachable: true,
        database: 'connected'
    });
});

// API pour ton Dashboard CRM
app.get('/api/signals', async (req, res) => {
    const { data, error } = await supabase
        .from('private_trader_signals')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// --- DÉMARRAGE ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    =========================================
       🚀 SWARM SERVER IS LIVE
       Port: ${PORT}
       Mode: ES Modules
    =========================================
    `);
});