import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { numeBot } from './telegram';

// Butonul „Conectează Telegram” + caseta cu codul de 6 cifre.
// `conectare` este rezultatul hook-ului useConectareTelegram.
const ConectareTelegram = ({ conectare, descriere }) => {
  const [bot, setBot] = useState(null);

  useEffect(() => {
    numeBot().then(setBot).catch(e => console.warn('Telegram getMe:', e));
  }, []);

  if (!bot) {
    return <p className="text-[10px] text-slate-500 font-bold text-center">Se încarcă...</p>;
  }

  if (conectare.stare === 'asteapta' && conectare.cod) {
    return (
      <div className="bg-slate-950 border-2 border-sky-500/50 p-5 rounded-2xl text-center space-y-3">
        <p className="text-[11px] text-slate-300 font-bold leading-relaxed">
          1. Deschide în Telegram botul{' '}
          <a href={`https://t.me/${bot}`} target="_blank" rel="noreferrer" className="text-sky-400 underline">@{bot}</a>
          <br />2. Trimite-i acest cod ca mesaj:
        </p>
        <p className="text-4xl font-black tracking-[0.3em] text-white select-all">{conectare.cod}</p>
        <p className="text-[10px] text-slate-500 font-bold">Aștept mesajul... (rămâi pe această pagină)</p>
        <button onClick={conectare.anuleaza} className="text-[10px] font-black uppercase bg-slate-800 px-4 py-2 rounded-xl active:scale-95">Anulează</button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => { if (navigator.vibrate) navigator.vibrate(40); conectare.porneste(); }}
        className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-sky-600 font-black uppercase text-sm active:scale-[0.98] transition-all"
      >
        <Send size={20} /> Conectează Telegram
      </button>
      <p className="text-[10px] text-slate-400 font-bold text-center mt-3 leading-relaxed">
        {conectare.stare === 'eroare' ? 'Nu am primit codul la timp. Apasă din nou butonul.' : descriere}
      </p>
    </>
  );
};

export default ConectareTelegram;
