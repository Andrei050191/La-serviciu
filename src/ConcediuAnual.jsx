import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Umbrella, Pencil, Trash2, Plus, X, Check } from 'lucide-react';
import CalendarInterval from './CalendarInterval';
import {
  ZILE_OBLIGATORII, nrZile, salveazaPerioada, seteazaTotal, stergePerioada, sumarAn, textPerioada, zileDinPerioada
} from './concedii';

// Planificarea concediului anual pentru o persoană (o folosesc și omul, și adminul).
const ConcediuAnual = ({ persoana, eu, onLog }) => {
  const anCurent = new Date().getFullYear();
  const [an, setAn] = useState(anCurent);
  const [editare, setEditare] = useState(null); // null | 'nou' | id perioadă
  const [deLa, setDeLa] = useState('');
  const [panaLa, setPanaLa] = useState('');
  const [mesaj, setMesaj] = useState(null); // { tip, text }
  const [seSalveaza, setSeSalveaza] = useState(false);
  const [deSters, setDeSters] = useState(null);
  const [totalText, setTotalText] = useState(null);

  if (!persoana) return null;
  const s = sumarAn(persoana, an);
  const azi = format(new Date(), 'yyyy-MM-dd');

  const vibreaza = (ms) => { if (navigator.vibrate) navigator.vibrate(ms); };

  const incepe = (perioada) => {
    vibreaza(30);
    setMesaj(null);
    setDeSters(null);
    if (perioada) {
      setEditare(perioada.id);
      setDeLa(perioada.deLa);
      setPanaLa(perioada.panaLa);
    } else {
      const start = an === anCurent ? azi : `${an}-01-01`;
      setEditare('nou');
      setDeLa(start);
      setPanaLa(start);
    }
  };

  const salveaza = async () => {
    setSeSalveaza(true);
    try {
      const perioadaVeche = editare === 'nou' ? null : s.perioade.find(p => p.id === editare);
      const r = await salveazaPerioada({ persoana, an, perioadaVeche, deLa, panaLa, onLog, eu });
      if (r.eroare) {
        setMesaj({ tip: 'eroare', text: r.eroare });
        vibreaza([80, 60, 80]);
      } else {
        setMesaj({ tip: 'ok', text: '✅ Concediul a fost salvat.' });
        setEditare(null);
      }
    } catch (e) {
      console.error(e);
      setMesaj({ tip: 'eroare', text: 'Nu am putut salva. Verifică internetul.' });
    } finally {
      setSeSalveaza(false);
    }
  };

  const sterge = async (p) => {
    if (deSters !== p.id) { setDeSters(p.id); return; }
    setSeSalveaza(true);
    try {
      await stergePerioada({ persoana, an, perioada: p, onLog });
      setMesaj({ tip: 'ok', text: 'Perioada a fost ștearsă.' });
    } finally {
      setDeSters(null);
      setSeSalveaza(false);
    }
  };

  const schimbaTotal = async (valoare) => {
    const nou = Math.max(0, Math.min(120, Math.round(Number(valoare) || 0)));
    setTotalText(null);
    if (nou === s.total) return;
    if (nou < s.planificate) {
      setMesaj({ tip: 'eroare', text: `Sunt deja planificate ${s.planificate} zile; totalul nu poate fi mai mic.` });
      return;
    }
    await seteazaTotal({ persoana, an, total: nou, onLog });
  };

  const zileSelectie = deLa && panaLa ? zileDinPerioada(deLa, panaLa).length : 0;
  const zileAltele = s.perioade.filter(p => p.id !== editare).reduce((t, p) => t + nrZile(p), 0);
  const ramaseDupa = s.total - zileAltele - zileSelectie;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[anCurent, anCurent + 1].map(a => (
          <button
            key={a}
            onClick={() => { setAn(a); setEditare(null); setMesaj(null); }}
            className={`flex-1 py-2 rounded-xl text-xs font-black border ${a === an ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className={`rounded-2xl p-4 text-center border-2 ${s.ramase > 0 ? 'bg-purple-950/40 border-purple-600/60' : 'bg-slate-950 border-slate-800'}`}>
        <p className="text-xs font-black uppercase text-purple-200">
          {eu ? 'Ți-au mai rămas' : 'Mai are'}
        </p>
        <p className="text-4xl font-black text-white my-1">{s.ramase}</p>
        <p className="text-[11px] font-bold text-slate-400">zile de concediu din {s.total} în {an}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
          <p className="text-[9px] font-black uppercase text-slate-500">Planificate</p>
          <p className="text-lg font-black">{s.planificate}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
          <p className="text-[9px] font-black uppercase text-slate-500">Folosite</p>
          <p className="text-lg font-black">{s.folosite}</p>
        </div>
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-2">
          <p className="text-[9px] font-black uppercase text-slate-500">Total</p>
          <div className="flex items-center justify-center gap-1">
            <button onClick={() => schimbaTotal(s.total - 1)} className="w-6 h-6 bg-slate-800 rounded-full font-black text-xs">-</button>
            <input
              type="number"
              inputMode="numeric"
              value={totalText ?? s.total}
              onChange={(e) => setTotalText(e.target.value)}
              onBlur={(e) => schimbaTotal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              style={{ fontSize: '16px' }}
              className="w-12 bg-transparent text-center font-black outline-none"
            />
            <button onClick={() => schimbaTotal(s.total + 1)} className="w-6 h-6 bg-slate-800 rounded-full font-black text-xs">+</button>
          </div>
        </div>
      </div>

      <div className={`rounded-xl p-3 text-[11px] font-black ${s.are14 ? 'bg-green-600/15 text-green-300 border border-green-700/40' : 'bg-amber-600/15 text-amber-300 border border-amber-700/40'}`}>
        {s.are14
          ? `✓ Are perioada obligatorie de minim ${ZILE_OBLIGATORII} zile.`
          : `⚠ Lipsește perioada obligatorie de minim ${ZILE_OBLIGATORII} zile la rând.`}
      </div>

      <div className="space-y-2">
        {s.perioade.length === 0 && editare !== 'nou' && (
          <p className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center text-[11px] text-slate-500 font-black uppercase">Nicio perioadă planificată în {an}</p>
        )}
        {s.perioade.map(p => {
          const trecut = p.panaLa < azi;
          return (
            <div key={p.id} className={`flex items-center justify-between gap-2 p-3 rounded-xl border ${editare === p.id ? 'border-purple-500 bg-purple-950/30' : 'border-slate-800 bg-slate-950'} ${trecut ? 'opacity-60' : ''}`}>
              <div>
                <p className="text-sm font-black text-white">{textPerioada(p)}</p>
                <p className="text-[10px] font-bold text-slate-500">
                  {nrZile(p)} zile{nrZile(p) >= ZILE_OBLIGATORII ? ' · perioada obligatorie' : ''}{trecut ? ' · trecută' : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => incepe(p)} disabled={seSalveaza} className="p-2 rounded-xl bg-slate-800 text-purple-300 active:scale-95"><Pencil size={15} /></button>
                <button
                  onClick={() => sterge(p)}
                  disabled={seSalveaza}
                  className={`p-2 rounded-xl active:scale-95 ${deSters === p.id ? 'bg-red-600 text-white px-3 text-[10px] font-black uppercase' : 'bg-red-600/20 text-red-300'}`}
                >
                  {deSters === p.id ? 'Sigur?' : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editare ? (
        <div className="bg-slate-950 border-2 border-purple-600/50 rounded-2xl p-4 space-y-3">
          <p className="text-center text-[11px] font-black uppercase text-purple-300">
            {editare === 'nou' ? 'Perioadă nouă' : 'Modifică perioada'}
          </p>
          <CalendarInterval
            key={`${editare}-${an}`}
            deLa={deLa}
            panaLa={panaLa}
            onChange={(a, b) => { setDeLa(a); setPanaLa(b); setMesaj(null); }}
          />
          {deLa && panaLa && (
            <p className="text-center text-[11px] font-bold text-slate-400">
              {format(parseISO(deLa), 'dd.MM.yyyy')} – {format(parseISO(panaLa), 'dd.MM.yyyy')} ·{' '}
              <span className="text-white font-black">{zileSelectie} zile</span> ·{' '}
              <span className={ramaseDupa < 0 ? 'text-red-400 font-black' : 'text-purple-300 font-black'}>
                {ramaseDupa < 0 ? `depășește cu ${-ramaseDupa}` : `rămân ${ramaseDupa}`}
              </span>
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={salveaza}
              disabled={seSalveaza || !zileSelectie || ramaseDupa < 0}
              className="flex-1 bg-purple-600 disabled:opacity-40 py-3 rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-95"
            >
              <Check size={16} /> {seSalveaza ? 'Se salvează...' : 'Salvează'}
            </button>
            <button onClick={() => { setEditare(null); setMesaj(null); }} className="bg-slate-800 px-4 rounded-xl active:scale-95"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => incepe(null)}
          disabled={s.ramase <= 0}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Plus size={16} /> Adaugă perioadă de concediu
        </button>
      )}

      {mesaj && (
        <div className={`rounded-xl p-3 text-xs font-black ${mesaj.tip === 'ok' ? 'bg-green-600/20 border border-green-600/50 text-green-200' : 'bg-red-950/50 border border-red-700 text-red-200'}`}>
          {mesaj.tip === 'eroare' ? '⚠️ ' : ''}{mesaj.text}
        </div>
      )}
    </div>
  );
};

// Antetul scurt „ți-au mai rămas X zile”, folosit pe cardul utilizatorului.
export const RezumatConcediu = ({ persoana }) => {
  const an = new Date().getFullYear();
  const s = sumarAn(persoana, an);
  return (
    <div className="flex items-center gap-4 min-w-0">
      <div className="bg-purple-600 p-3 rounded-2xl text-white shrink-0"><Umbrella size={22} /></div>
      <div className="min-w-0">
        <p className="font-black text-xs uppercase tracking-widest">Concediul meu {an}</p>
        <p className="text-[11px] text-slate-400 font-bold mt-1 truncate">
          Ți-au mai rămas <span className="text-purple-300 font-black">{s.ramase}</span> din {s.total} zile
          {!s.are14 ? ' · lipsește perioada de 14 zile' : ''}
        </p>
      </div>
    </div>
  );
};

export default ConcediuAnual;
