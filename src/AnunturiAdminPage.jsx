import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { Megaphone, ChevronDown, ChevronUp } from 'lucide-react';
import { telegramActiv, trimiteTelegram } from './telegram';
import { numeFrumos } from './serviciiConfig';

// Admin: scrie un anunț care se trimite pe Telegram tuturor celor conectați.
// Anunțul NU apare în aplicație; păstrăm doar evidența trimiterilor.
const AnunturiAdminPage = ({ onLog }) => {
  const [text, setText] = useState('');
  const [seTrimite, setSeTrimite] = useState(false);
  const [anunturi, setAnunturi] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [deschisId, setDeschisId] = useState(null);
  const [rezultat, setRezultat] = useState(null); // { tip: 'ok' | 'eroare', text }

  useEffect(() => {
    const unsubA = onSnapshot(query(collection(db, 'anunturi'), orderBy('dataClient', 'desc'), limit(30)), (snap) => {
      setAnunturi(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubP = onSnapshot(query(collection(db, 'echipa'), orderBy('ordine', 'asc')), (snap) => {
      setPersonal(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activ !== false));
    });
    return () => { unsubA(); unsubP(); };
  }, []);

  const conectati = personal.filter(p => p.telegramChatId);
  const neconectati = personal.filter(p => !p.telegramChatId);

  const trimite = async () => {
    const mesaj = text.trim();
    if (!mesaj) return;
    if (!conectati.length) {
      setRezultat({ tip: 'eroare', text: 'Nimeni nu este conectat la Telegram încă.' });
      return;
    }
    setRezultat(null);
    setSeTrimite(true);
    try {
      const primit = [];
      const esuat = [];
      for (const p of conectati) {
        const ok = await trimiteTelegram(p.telegramChatId, `📢 Anunț:\n${mesaj}`);
        (ok ? primit : esuat).push(p.id);
      }

      await addDoc(collection(db, 'anunturi'), {
        mesaj,
        autor: 'Administrator',
        trimisLa: primit,
        esuat,
        dataClient: new Date().toISOString(),
        createdAt: serverTimestamp()
      });

      if (onLog) await onLog('Anunț Telegram', { mesaj, trimisLa: `${primit.length} persoane` }, null);
      setText('');
      setRezultat(esuat.length
        ? { tip: 'eroare', text: `Trimis la ${primit.length} persoane. Nu a ajuns la ${esuat.length}.` }
        : { tip: 'ok', text: `✅ Anunțul a fost trimis pe Telegram la ${primit.length} persoane.` });
    } catch (e) {
      console.error(e);
      setRezultat({ tip: 'eroare', text: 'Nu am putut trimite anunțul. Verifică internetul.' });
    } finally {
      setSeTrimite(false);
    }
  };

  const formatData = (a) => {
    const d = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.dataClient);
    return d.toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const numePentru = (ids = []) => personal.filter(p => ids.includes(p.id)).map(numeFrumos);

  if (!telegramActiv) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 text-sm text-slate-400 font-bold">
        Telegram nu este configurat. Pune token-ul botului în fișierul .env (VITE_TELEGRAM_BOT_TOKEN).
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="bg-amber-600 p-3 rounded-2xl"><Megaphone size={24} /></div>
          <div>
            <h2 className="text-lg font-black uppercase">Anunțuri</h2>
            <p className="text-xs text-slate-400 font-bold">Mesaj trimis pe Telegram tuturor celor conectați</p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrie anunțul... (ex: Mâine la 08:00 adunare pe platou)"
          rows={4}
          style={{ fontSize: '16px' }}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 font-bold text-white outline-none focus:border-amber-500 resize-y"
        />

        <button
          onClick={trimite}
          disabled={seTrimite || !text.trim()}
          className={`w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-sm flex items-center justify-center gap-2`}
        >
          <Megaphone size={18} />
          {seTrimite ? 'Se trimite...' : `Trimite pe Telegram (${conectati.length})`}
        </button>

        {rezultat && (
          <div className={`rounded-2xl p-4 text-xs font-black ${rezultat.tip === 'ok' ? 'bg-green-600/20 border border-green-600/50 text-green-200' : 'bg-red-600/20 border border-red-700 text-red-200'}`}>
            {rezultat.text}
          </div>
        )}

        {neconectati.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-900/40 rounded-2xl p-4 text-[11px] text-amber-200 font-bold leading-relaxed">
            Nu primesc anunțul (nu sunt conectați la Telegram, {neconectati.length}): {neconectati.map(numeFrumos).join(', ')}
          </div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 space-y-3">
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Anunțuri trimise</p>
        {anunturi.length === 0 && (
          <p className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-[11px] text-slate-500 font-black uppercase">Niciun anunț</p>
        )}
        {anunturi.map(a => {
          const deschis = deschisId === a.id;
          return (
            <div key={a.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
              <p className="text-sm font-bold text-white whitespace-pre-wrap break-words">{a.mesaj}</p>
              <button onClick={() => setDeschisId(deschis ? null : a.id)} className="w-full flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
                <span>{formatData(a)} · Trimis la {(a.trimisLa || []).length}{(a.esuat || []).length ? ` · eșuat ${(a.esuat || []).length}` : ''}</span>
                {deschis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {deschis && (
                <div className="text-[11px] font-bold leading-relaxed space-y-1">
                  <p className="text-green-300">Au primit: {numePentru(a.trimisLa).join(', ') || '—'}</p>
                  {(a.esuat || []).length > 0 && <p className="text-red-300">Nu a ajuns la: {numePentru(a.esuat).join(', ')}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnunturiAdminPage;
