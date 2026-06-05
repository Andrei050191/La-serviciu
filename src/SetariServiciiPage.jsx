import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Radio, ToggleLeft, ToggleRight, Save } from 'lucide-react';

const SetariServiciiPage = ({ onLog }) => {
  const [operatorRadioZilnic, setOperatorRadioZilnic] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvare, setSalvare] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "servicii"), (snap) => {
      if (snap.exists()) {
        setOperatorRadioZilnic(snap.data().operatorRadioZilnic === true);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const schimbaOperatorRadio = async () => {
    const valoareNoua = !operatorRadioZilnic;
    setOperatorRadioZilnic(valoareNoua);
    setSalvare(true);

    try {
      await setDoc(doc(db, "setari", "servicii"), {
        operatorRadioZilnic: valoareNoua
      }, { merge: true });

      if (onLog) {
        await onLog("Setare servicii", {
          camp: "Operator radio zilnic",
          valoare: valoareNoua ? "activat" : "dezactivat"
        }, null);
      }
    } catch (e) {
      console.error(e);
      alert("Nu am putut salva setarea.");
      setOperatorRadioZilnic(!valoareNoua);
    } finally {
      setSalvare(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-white opacity-50 font-black tracking-[0.2em]">SE ÎNCARCĂ...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 shadow-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-blue-600 p-3 rounded-2xl">
            <Radio size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase">Setări servicii</h2>
            <p className="text-xs text-slate-400 font-bold">Reguli speciale pentru planificare</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-[2rem] p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase text-white">Operator radio zilnic</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Când este activat, aceeași persoană poate fi pusă la Operator radio în zile consecutive.
            </p>
          </div>

          <button
            onClick={schimbaOperatorRadio}
            disabled={salvare}
            className={`shrink-0 px-4 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 transition-all ${operatorRadioZilnic ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'}`}
          >
            {operatorRadioZilnic ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
            {operatorRadioZilnic ? 'Activ' : 'Oprit'}
          </button>
        </div>

        <div className="mt-4 bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex gap-3 text-xs text-blue-200 leading-relaxed">
          <Save size={18} className="shrink-0 mt-0.5" />
          <p>
            Setarea se salvează în Firebase și lucrează automat în pagina SERVICII. Pentru celelalte funcții rămâne regula veche: persoana nu poate fi pusă în ziua precedentă sau următoare.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetariServiciiPage;
