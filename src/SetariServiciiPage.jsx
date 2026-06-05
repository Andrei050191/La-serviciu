import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Settings, ToggleLeft, ToggleRight, Save } from 'lucide-react';

const functiiServicii = [
  'Ajutor OSU',
  'Sergent de serviciu PCT',
  'Planton',
  'Patrulă',
  'Operator radio',
  'Intervenția 1',
  'Intervenția 2',
  'Responsabil'
];

const SetariServiciiPage = ({ onLog }) => {
  const [serviciiZilnic, setServiciiZilnic] = useState({});
  const [loading, setLoading] = useState(true);
  const [salvare, setSalvare] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "servicii"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const valori = { ...(data.serviciiZilnic || {}) };

        // compatibilitate cu setarea veche pentru Operator radio
        if (data.operatorRadioZilnic === true) {
          valori["Operator radio"] = true;
        }

        setServiciiZilnic(valori);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const schimbaServiciu = async (functie) => {
    const valoareNoua = !(serviciiZilnic[functie] === true);
    const serviciiNoi = { ...serviciiZilnic, [functie]: valoareNoua };

    setServiciiZilnic(serviciiNoi);
    setSalvare(true);

    try {
      await setDoc(doc(db, "setari", "servicii"), {
        serviciiZilnic: serviciiNoi,
        // păstrăm și câmpul vechi ca să nu se strice nimic dacă există cod vechi
        operatorRadioZilnic: serviciiNoi["Operator radio"] === true
      }, { merge: true });

      if (onLog) {
        await onLog("Setare servicii", {
          camp: `${functie} zilnic`,
          valoare: valoareNoua ? "activat" : "dezactivat"
        }, null);
      }
    } catch (e) {
      console.error(e);
      alert("Nu am putut salva setarea.");
      setServiciiZilnic(serviciiZilnic);
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
            <Settings size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase">Setări servicii</h2>
            <p className="text-xs text-slate-400 font-bold">Activezi separat ce funcții permit aceeași persoană în zile consecutive</p>
          </div>
        </div>

        <div className="space-y-3">
          {functiiServicii.map((functie) => {
            const activ = serviciiZilnic[functie] === true;

            return (
              <div key={functie} className="bg-slate-950 border border-slate-800 rounded-[2rem] p-5 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-white">{functie}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {activ
                      ? 'Aceeași persoană poate fi pusă la acest serviciu în zile consecutive.'
                      : 'Se aplică regula normală: persoana nu poate fi pusă în ziua precedentă sau următoare.'}
                  </p>
                </div>

                <button
                  onClick={() => schimbaServiciu(functie)}
                  disabled={salvare}
                  className={`shrink-0 px-4 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 transition-all ${activ ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                >
                  {activ ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  {activ ? 'Activ' : 'Oprit'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-4 bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex gap-3 text-xs text-blue-200 leading-relaxed">
          <Save size={18} className="shrink-0 mt-0.5" />
          <p>
            Setările se salvează în Firebase. Pentru funcțiile activate, aceeași persoană poate fi planificată în zile consecutive doar la funcția respectivă.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetariServiciiPage;
