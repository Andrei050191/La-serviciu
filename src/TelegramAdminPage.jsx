import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { arrayUnion, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { addDays } from 'date-fns';
import { Send, ToggleLeft, ToggleRight, BellRing, FileText } from 'lucide-react';
import { telegramActiv, trimiteTelegram } from './telegram';
import { useConectareTelegram } from './useConectareTelegram';
import ConectareTelegram from './ConectareTelegram';
import { setariTelegramComplete, trimiteMementoPentru } from './telegramAutomat';

const ore = Array.from({ length: 24 }, (_, i) => i);

const TelegramAdminPage = ({ onLog, persoanaId }) => {
  const [setari, setSetari] = useState(setariTelegramComplete());
  const [seTrimite, setSeTrimite] = useState(false);
  const ref = doc(db, 'setari', 'telegram');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'setari', 'telegram'), (snap) => {
      setSetari(setariTelegramComplete(snap.exists() ? snap.data() : {}));
    });
    return () => unsub();
  }, []);

  const salveaza = async (camp, valoare) => {
    await setDoc(ref, { [camp]: valoare }, { merge: true });
    if (onLog) await onLog('Setare Telegram', { camp, valoare }, null);
  };

  const conectare = useConectareTelegram(async (chatId) => {
    await setDoc(ref, { adminChatIds: arrayUnion(chatId) }, { merge: true });
    // Admin care e și în efectiv: primește și notificările lui de serviciu, memento și anunțuri.
    if (persoanaId) await updateDoc(doc(db, 'echipa', persoanaId), { telegramChatId: chatId });
    await trimiteTelegram(chatId, persoanaId
      ? '✅ Conectat ca administrator. Aici vei primi raportul zilnic, serviciile tale și anunțurile.'
      : '✅ Conectat ca administrator. Aici vei primi raportul zilnic.');
  });

  const deconecteazaToti = async () => {
    if (!window.confirm('Opresc trimiterea raportului către toate conturile de administrator conectate?')) return;
    await salveaza('adminChatIds', []);
  };

  const mementoAcum = async () => {
    setSeTrimite(true);
    try {
      const nr = await trimiteMementoPentru(addDays(new Date(), 1));
      alert(nr ? `Memento trimis la ${nr} persoane.` : 'Nimeni conectat la Telegram nu are serviciu mâine.');
    } finally {
      setSeTrimite(false);
    }
  };

  if (!telegramActiv) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 text-sm text-slate-400 font-bold">
        Telegram nu este configurat. Pune token-ul botului în fișierul .env (VITE_TELEGRAM_BOT_TOKEN).
      </div>
    );
  }

  const comutator = (titlu, descriere, camp, campOra, icon) => {
    const activ = setari[camp] === true;
    return (
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-sky-600/20 text-sky-300 p-3 rounded-2xl shrink-0">{icon}</div>
            <div>
              <p className="text-sm font-black uppercase text-white">{titlu}</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{descriere}</p>
            </div>
          </div>
          <button
            onClick={() => salveaza(camp, !activ)}
            className={`shrink-0 px-4 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 transition-all ${activ ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {activ ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            {activ ? 'Activ' : 'Oprit'}
          </button>
        </div>
        <label className="flex items-center justify-between gap-3 text-[11px] font-black uppercase text-slate-400">
          De la ora
          <select
            value={setari[campOra]}
            onChange={(e) => salveaza(campOra, Number(e.target.value))}
            style={{ fontSize: '16px' }}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-black text-white outline-none"
          >
            {ore.map(o => <option key={o} value={o}>{String(o).padStart(2, '0')}:00</option>)}
          </select>
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="bg-sky-600 p-3 rounded-2xl"><Send size={24} /></div>
          <div>
            <h2 className="text-lg font-black uppercase">Telegram</h2>
            <p className="text-xs text-slate-400 font-bold">Raport pentru administrator și memento pentru efectiv</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-5 space-y-3">
          <p className="text-sm font-black uppercase text-white">Contul administratorului</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {setari.adminChatIds.length
              ? `Conturi conectate: ${setari.adminChatIds.length}. Raportul ajunge la toate.`
              : 'Niciun cont conectat. Conectează-te ca să primești raportul pe Telegram.'}
          </p>
          <ConectareTelegram conectare={conectare} descriere="Poți conecta mai multe conturi (de ex. comandant și ajutor)." />
          {setari.adminChatIds.length > 0 && (
            <button onClick={deconecteazaToti} className="w-full text-[10px] font-black uppercase bg-slate-800 px-4 py-3 rounded-xl active:scale-95">
              Deconectează toate conturile
            </button>
          )}
        </div>

        {comutator('Raport zilnic', 'Raportul efectivului de azi, trimis administratorului o dată pe zi.', 'raportActiv', 'oraRaport', <FileText size={20} />)}
        {comutator('Memento de seară', 'Fiecare om conectat primește serviciile lui de mâine.', 'mementoActiv', 'oraMemento', <BellRing size={20} />)}

        <button
          onClick={mementoAcum}
          disabled={seTrimite}
          className="w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-50 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-xs"
        >
          {seTrimite ? 'Se trimite...' : 'Trimite acum memento pentru mâine'}
        </button>

        <div className="bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 text-xs text-blue-200 leading-relaxed">
          Aplicația nu are server: raportul și memento-ul pleacă de pe primul telefon care deschide aplicația după ora setată
          (o singură dată pe zi). Dacă nimeni nu deschide aplicația, nu se trimit.
        </div>
      </div>
    </div>
  );
};

export default TelegramAdminPage;
