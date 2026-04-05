const fetch = require('node-fetch');

/**
 * Envoie une alerte Telegram sécurisée avec gestion d'erreurs avancée
 */
async function sendTelegramAlert(message, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('⚠️ Telegram : Token ou Chat ID non configuré dans .env');
    return false;
  }

  const emoji = options.emoji || '🚨';
  const fullMessage = `${emoji} ${message}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: fullMessage,
        parse_mode: 'HTML',
        disable_web_page_preview: true // Garde le chat propre sans gros aperçus de liens
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Telegram API error: ${errorText}`);
    }

    console.log(`📨 Telegram alert envoyée avec succès`);
    return true;
  } catch (err) {
    console.error('❌ Erreur Telegram:', err.message);
    return false;
  }
}

module.exports = { sendTelegramAlert };