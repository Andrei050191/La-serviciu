import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Umbrella, ChevronDown, ChevronUp, Search, FileDown } from 'lucide-react';
import { descarcaGraficConcedii } from './graficConcediiDocx';
import { numeFrumos } from './serviciiConfig';
import { sumarAn, textPerioada, nrZile } from './concedii';
import ConcediuAnual from './ConcediuAnual';

// Admin: concediul fiecărei persoane — total, planificate, folosite, rămase și perioadele.
const ConcediiAdminPage = ({ onLog }) => {
  const anCurent = new Date().getFullYear();
  const [an, setAn] = useState(anCurent);
  const [personal, setPersonal] = useState([]);
  const [deschis, setDeschis] = useState(null);
  const [cautare, setCautare] = useState('');
  const [seGenereaza, setSeGenereaza] = useState(false);
  const [eroareDocx, setEroareDocx] = useState('');

  const descarcaDocx = async () => {
    setSeGenereaza(true);
    setEroareDocx('');
    try {
      await descarcaGraficConcedii(personal, an);
    } catch (e) {
      console.error(e);
      setEroareDocx('Nu am putut genera documentul.');
    } finally {
      setSeGenereaza(false);
    }
  };

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'echipa'), orderBy('ordine', 'asc')), (snap) => {
      setPersonal(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.activ !== false));
    });
    return () => unsub();
  }, []);

  const filtrati = personal.filter(p => numeFrumos(p).toLowerCase().includes(cautare.toLowerCase().trim()));
  const rezumate = personal.map(p => sumarAn(p, an));
  const fara14 = personal.filter((p, i) => !rezumate[i].are14).length;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="bg-purple-600 p-3 rounded-2xl"><Umbrella size={24} /></div>
          <div>
            <h2 className="text-lg font-black uppercase">Concedii</h2>
            <p className="text-xs text-slate-400 font-bold">Cât concediu are fiecare, în ce zile, cât a folosit și cât îi rămâne</p>
          </div>
        </div>

        <div className="flex gap-2">
          {[anCurent - 1, anCurent, anCurent + 1].map(a => (
            <button
              key={a}
              onClick={() => { setAn(a); setDeschis(null); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black border ${a === an ? 'bg-purple-600 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
            >
              {a}
            </button>
          ))}
        </div>

        <button
          onClick={descarcaDocx}
          disabled={seGenereaza || personal.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-xs flex items-center justify-center gap-2"
        >
          <FileDown size={18} /> {seGenereaza ? 'Se generează...' : `Descarcă graficul concediilor ${an} (.docx)`}
        </button>
        {eroareDocx && <p className="text-[11px] font-black text-red-300">⚠️ {eroareDocx}</p>}

        {fara14 > 0 && (
          <p className="text-[11px] font-black text-amber-300">⚠ {fara14} {fara14 === 1 ? 'persoană nu are' : 'persoane nu au'} perioada obligatorie de 14 zile în {an}.</p>
        )}

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
          <Search size={18} className="text-slate-500" />
          <input
            value={cautare}
            onChange={(e) => setCautare(e.target.value)}
            placeholder="Caută persoana..."
            className="w-full bg-transparent outline-none text-sm font-bold text-white placeholder:text-slate-600"
          />
        </div>
      </div>

      <div className="space-y-2">
        {filtrati.map(p => {
          const s = sumarAn(p, an);
          const eDeschis = deschis === p.id;
          return (
            <div key={p.id} className={`bg-slate-900 border rounded-2xl ${eDeschis ? 'border-purple-500' : 'border-slate-800'}`}>
              <button onClick={() => setDeschis(eDeschis ? null : p.id)} className="w-full p-4 text-left space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">{numeFrumos(p)}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${s.ramase > 0 ? 'bg-purple-600/30 text-purple-200' : 'bg-slate-800 text-slate-400'}`}>
                      rămase {s.ramase}
                    </span>
                    {eDeschis ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold text-slate-400">
                  <span>Total {s.total}</span>
                  <span>Planificate {s.planificate}</span>
                  <span>Folosite {s.folosite}</span>
                  <span className={s.are14 ? 'text-green-400' : 'text-amber-400'}>{s.are14 ? '✓ 14 zile' : '⚠ fără 14 zile'}</span>
                </div>
                {s.perioade.length > 0 && (
                  <p className="text-[11px] font-bold text-slate-300">
                    {s.perioade.map(x => `${textPerioada(x)} (${nrZile(x)})`).join(' · ')}
                  </p>
                )}
              </button>
              {eDeschis && (
                <div className="px-4 pb-4">
                  <ConcediuAnual persoana={p} eu={false} onLog={onLog} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConcediiAdminPage;
