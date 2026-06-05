import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { History, Search } from 'lucide-react';

const IstoricPage = () => {
  const [istoric, setIstoric] = useState([]);
  const [cautare, setCautare] = useState('');

  useEffect(() => {
    const q = query(collection(db, "istoric_modificari"), orderBy("createdAt", "desc"), limit(100));

    const unsub = onSnapshot(q, (snap) => {
      setIstoric(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    });

    return () => unsub();
  }, []);

  const formatData = (item) => {
    try {
      const data = item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.dataClient);
      return data.toLocaleString('ro-RO');
    } catch (e) {
      return item.dataClient || '—';
    }
  };

  const detaliiText = (detalii = {}) => {
    return Object.entries(detalii)
      .map(([cheie, valoare]) => `${cheie}: ${typeof valoare === 'object' ? JSON.stringify(valoare) : valoare}`)
      .join(' | ');
  };

  const filtrat = istoric.filter(item => {
    const q = cautare.toLowerCase().trim();
    if (!q) return true;

    return `${item.actiune || ''} ${item.facutDeNume || ''} ${item.persoanaVizataNume || ''} ${detaliiText(item.detalii)}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="bg-blue-600 p-3 rounded-2xl">
            <History size={22} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase text-blue-400 tracking-widest">
              Istoric modificări
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              Ultimele 100 de acțiuni salvate
            </p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 mb-4">
          <Search size={18} className="text-slate-500" />
          <input
            value={cautare}
            onChange={(e) => setCautare(e.target.value)}
            placeholder="Caută după persoană, acțiune sau autor..."
            className="w-full bg-transparent outline-none text-sm font-bold text-white placeholder:text-slate-600"
          />
        </div>

        <div className="space-y-3">
          {filtrat.length === 0 && (
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 text-center text-slate-500 text-xs font-black uppercase">
              Nu sunt înregistrări.
            </div>
          )}

          {filtrat.map(item => (
            <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
              <div className="flex justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-black text-white uppercase">
                    {item.actiune || 'Acțiune'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    De: {item.facutDeNume || 'Necunoscut'}
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 font-bold text-right shrink-0">
                  {formatData(item)}
                </p>
              </div>

              {item.persoanaVizataNume && (
                <p className="text-xs font-bold text-blue-300 mb-2">
                  Persoană: {item.persoanaVizataNume}
                </p>
              )}

              {item.detalii && Object.keys(item.detalii).length > 0 && (
                <p className="text-xs text-slate-400 leading-relaxed break-words">
                  {detaliiText(item.detalii)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default IstoricPage;
