import time
import requests
import json
from datetime import datetime, timedelta
from supabase import create_client, Client

# ====================== CONFIG ======================
SUPABASE_URL = "https://zdgwnjqtpmedzprgyqja.supabase.co"
SUPABASE_KEY = "TON_API_KEY" # Utilise une variable d'environnement idéalement
GEMMA_API_URL = "http://127.0.0.1:1234/v1/chat/completions"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ====================== INTELLIGENCE GEMMA 4 ======================
def ask_gemma_analysis(market_title, probability):
    """Demande une analyse stratégique à Gemma 4 sur ta 5080"""
    prompt = f"""
    Tu es l'intelligence tactique du Swarm OS. 
    Marché : {market_title}
    Probabilité actuelle : {probability*100:.1f}%
    
    Analyse ce trade pour une enveloppe de 30€. 
    Donne une analyse de 15 mots maximum, très incisive, style 'Trader Pro'.
    """
    try:
        response = requests.post(GEMMA_API_URL, json={
            "messages": [{"role": "system", "content": "Tu es un Trader Alpha."}, 
                         {"role": "user", "content": prompt}],
            "model": "google/gemma-4-26b-a4b",
            "temperature": 0.3
        }, timeout=10)
        return response.json()['choices'][0]['message']['content'].strip()
    except:
        return f"Alerte Alpha : Probabilité de {probability*100:.1f}% détectée. Exécution immédiate."

# ====================== API POLYMARKET ======================
def fetch_polymarket_markets():
    try:
        # On cible les marchés à gros volume (plus de "vrai" alpha)
        url = "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=30&order=volume_24hr&ascending=false"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        markets = []
        for m in data:
            if m.get("probability") and isinstance(m["probability"], (int, float)):
                markets.append({
                    "title": m.get("question") or m.get("title"),
                    "probability": float(m["probability"]),
                    "category": m.get("category", "General"),
                    "volume": m.get("volume_24hr", 0)
                })
        return markets
    except Exception as e:
        print(f"❌ Erreur API Polymarket: {e}")
        return []

# ====================== MEMORY MIRROR & ANTI-DUPE ======================
def signal_exists(title):
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    res = supabase.table("private_trader_signals").select("id").eq("opportunity", title).gte("created_at", since).execute()
    return len(res.data) > 0

def save_to_memory(signal):
    try:
        supabase.table("embeddings_memory").insert({
            "content_type": "trader_signal",
            "content": f"{signal['opportunity']} : {signal['analysis']}",
            "metadata": signal
        }).execute()
    except: pass

# ====================== CORE LOOP ======================
def run_swarm():
    print("⚔️  SWARM TRADER ALPHA : ACTIVÉ (Moteur: Gemma 4 + RTX 5080)")
    
    while True:
        markets = fetch_polymarket_markets()
        
        for m in markets:
            title = m['title']
            prob = m['probability']
            
            # Seuil de déclenchement : 89% ou 11% (arbitrage inverse)
            if (prob >= 0.89 or prob <= 0.11) and not signal_exists(title):
                print(f"🎯 Cible détectée : {title[:50]}...")
                
                # Appel à l'IA locale pour l'analyse
                analysis = ask_gemma_analysis(title, prob)
                
                signal = {
                    "market": m['category'].upper(),
                    "opportunity": title,
                    "action": "BUY" if prob >= 0.5 else "SELL",
                    "analysis": analysis,
                    "confidence": int(prob * 100) if prob >= 0.5 else int((1-prob)*100),
                    "risk_level": "LOW" if (prob > 0.94 or prob < 0.06) else "MEDIUM"
                }

                try:
                    supabase.table("private_trader_signals").insert(signal).execute()
                    save_to_memory(signal)
                    print(f"✅ SIGNAL INJECTÉ -> {signal['opportunity']}")
                except Exception as e:
                    print(f"⚠️ Erreur insertion: {e}")

        time.sleep(60) # Scan toutes les minutes

if __name__ == "__main__":
    run_swarm()