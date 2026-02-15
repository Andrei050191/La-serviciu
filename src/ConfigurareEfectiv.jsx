import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, collection, query, orderBy } from 'firebase/firestore';
import { Check, ShieldAlert } from 'lucide-react';

const ConfigurareEfectiv = () => {
  const [personal, setPersonal] = useState([]);
  const [reguli, setReguli] = useState({});
  const [functieSelectata, setFunctieSelectata] = useState("Ajutor OSU");

  const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubPers = onSnapshot(q, (snap) => {
      setPersonal(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubReguli = onSnapshot(doc(db, "setari", "reguli_servicii"), (docSnap) => {
      if (docSnap.exists()) setReguli(docSnap.data());
    });
    return () => { unsubPers(); unsubReguli(); };
  }, []);

  const togglePersoana = async (numeComplet) => {
    const listaActuala = reguli[functieSelectata] || [];
    const nouaLista = listaActuala.includes(numeComplet) ? listaActuala.filter(n => n !== numeComplet) : [...listaActuala, numeComplet];
    await setDoc(doc(db, "setari", "reguli_servicii"), { [functieSelectata]: nouaLista }, { merge: true });
  };

  // --- FUNCTIE SUPORT PENTRU GRAD ---
  const formateazaGradul = (gradBrut) => {
    if (!gradBrut) return "";
    const cifreRomane = ['I', 'II', 'III', 'IV', 'V'];
    return gradBrut.split(' ').map(cuvant => {
      const curat = cuvant.toUpperCase().trim();
      return cifreRomane.includes(curat) ? curat : cuvant.toLowerCase();
    }).join(' ');
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800">
        <h2 className="text-sm font-black uppercase text-indigo-400 mb-4 flex items-center gap-2"><ShieldAlert size={18} /> Eligibilitate</h2>
        <div className="flex overflow-x-auto gap-2 pb-4 mb-4 border-b border-slate-800 scrollbar-hide">
          {functii.map(f => (
            <button key={f} onClick={() => setFunctieSelectata(f)} className={`px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap border ${functieSelectata === f ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{f}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2">
          {personal.map(p => {
            // APLICARE LOGICA NOUA AICI:
            const gradCorect = formateazaGradul(p.grad);
            
            const prenumeFormatat = p.prenume ? (p.prenume.charAt(0).toUpperCase() + p.prenume.slice(1).toLowerCase()) : "";
            const numeFormatat = p.nume ? p.nume.toUpperCase() : "";
            
            // Pentru baza de date (comparație), păstrăm totul Uppercase ca să nu existe erori de matching
            const numeCompletFull = `${p.grad} ${p.prenume} ${p.nume}`.trim().toUpperCase();
            const esteBifat = (reguli[functieSelectata] || []).includes(numeCompletFull);

            return (
              <button key={p.id} onClick={() => togglePersoana(numeCompletFull)}
                className={`flex justify-between items-center p-4 rounded-2xl border-2 ${esteBifat ? 'bg-indigo-600/20 border-indigo-500 shadow-xl' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                <div className="text-left">
                  {/* AFISARE VIZUALA CORECTA: sergent clasa III */}
                  <p className="text-[9px] font-black text-indigo-400 leading-none mb-1">{gradCorect}</p>
                  <p className="text-sm font-black text-white">{prenumeFormatat} <span className="uppercase">{numeFormatat}</span></p>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${esteBifat ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-transparent'}`}><Check size={16} strokeWidth={4} /></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConfigurareEfectiv;