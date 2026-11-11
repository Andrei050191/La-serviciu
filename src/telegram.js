// Notificări Telegram trimise direct din aplicație (varianta C).
// Token-ul se pune în fișierul .env (VITE_TELEGRAM_BOT_TOKEN) și ajunge în codul publicat,
// deci oricine se uită în aplicație îl poate vedea.

const TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

export const telegramActiv = Boolean(TOKEN);

let numeBotCache = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || null;

// Folosim cereri GET / form-urlencoded (fără preflight CORS).
const apel = async (metoda, parametri = {}) => {
  if (!API) throw new Error('Telegram nu este configurat');
  const raspuns = await fetch(`${API}/${metoda}`, {
    method: 'POST',
    body: new URLSearchParams(
      Object.fromEntries(Object.entries(parametri).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]))
    )
  });
  const date = await raspuns.json();
  if (!date.ok) throw new Error(date.description || `Eroare Telegram la ${metoda}`);
  return date.result;
};

export const numeBot = async () => {
  if (numeBotCache) return numeBotCache;
  const eu = await apel('getMe');
  numeBotCache = eu.username;
  return numeBotCache;
};

// Nu aruncă niciodată eroare: o notificare Telegram eșuată nu trebuie să blocheze aplicația.
export const trimiteTelegram = async (chatId, text) => {
  if (!API || !chatId) return false;
  try {
    await apel('sendMessage', { chat_id: String(chatId), text });
    return true;
  } catch (e) {
    console.warn('Nu am putut trimite pe Telegram:', e);
    return false;
  }
};

export const genereazaCodConectare = () => String(Math.floor(100000 + Math.random() * 900000));

// Caută mesajul cu codul de conectare (scris direct sau ca „/start <cod>”)
// și întoarce chat_id-ul celui care l-a trimis.
// Nu confirmăm update-urile (fără offset), ca să nu pierdem conectările altor colegi.
export const cautaChatIdPentru = async (cod) => {
  const updates = await apel('getUpdates', { limit: 100, allowed_updates: ['message'] });
  const valide = [cod, `/start ${cod}`];
  const potriviri = updates.filter(u => valide.includes(u.message?.text?.replace(/\s+/g, ' ').trim()));
  const ultima = potriviri[potriviri.length - 1];
  return ultima ? ultima.message.chat.id : null;
};
