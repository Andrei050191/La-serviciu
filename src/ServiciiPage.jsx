import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Calendar, Users, User, ShieldCheck } from 'lucide-react';

const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

const persoaneToate = [
  "Din altă subunitate", "lt.col. Bordea Andrei", "lt. Bodiu Sergiu", "lt. Dermindje Mihail", 
  "lt. Samoschin Anton", "sg.II Plugaru Iurie", "sg.III Botnari Anastasia", "sg.III Murafa Oleg", 
  "sg.III Ungureanu Andrei", "sg.III Zamaneagra Aliona", "sg.III Boțoc Dumitru", "sold.I Răileanu Marina", 
  "sold.I Rotari Natalia", "sold.I Smirnov Silvia", "sold.I Tuceacov Nicolae", "cap. Pinzari Vladimir", 
  "sold.II Cucer Oxana", "sold.II Vovc Dan", "sold.III Roler Ira" 
];

const reguliServicii = {
  "Ajutor OSU": ["lt. Bodiu Sergiu", "lt. Dermindje Mihail", "lt. Samoschin Anton"],
  "Sergent de serviciu PCT": ["sg.II Plugaru Iurie", "sg.III Zamaneagra Aliona", "sg.III Murafa Oleg", "sg.III Boțoc Dumitru"],
  "Planton": ["sold.I Tuceacov Nicolae", "sold.II Cucer Oxana", "sold.III Roler Ira", "sold.II Vovc Dan"],
  "Patrulă": ["sold.I Tuceacov Nicolae", "cap. Pinzari Vladimir"],
  "Operator radio": ["sg.III Ungureanu Andrei", "sg.III Botnari Anastasia", "sold.I Smirnov Silvia"],
  "Intervenția 1": persoaneToate.filter(p => p !== "Din altă subunitate"),
  "Intervenția 2": persoaneToate.filter(p => p !== "Din altă subunitate"),
  "Responsabil": ["lt.col. Bordea Andrei"]
};

const ServiciiPage = ({ editabil = true, ziSelectata = null }) => {
  const [calendar, setCalendar] = useState({});
  const [incarcare, setIncarcare] = useState(true);

  const getZileSaptamana = (dataStr) => {
    try {
      const parti = dataStr.split('.');
      const data = new Date(parti[2], parti[1] - 1, parti[0]);
      return data.toLocaleDateString('ro-RO', { weekday: 'long' }).toUpperCase();
    } catch (e) {
      return "DATA INVALIDĂ";
    }
  };

  const zileDeAfisat = ziSelectata 
    ? [ziSelectata] 
    : Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i - 1);
        return d.toLocaleDateString("ro-RO");
      });

  useEffect(() => {
    const ref = doc(db, "servicii", "calendar");
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) setCalendar(snap.data().data || {});
      setIncarcare(false);
    });
    return () => unsubscribe();
  }, []);

  const salveazaCalendar = async (dateNoi) => {
    await setDoc(doc(db, "servicii", "calendar"), { data: dateNoi }, { merge: true });
  };

  const handleChange = async (zi, indexFunctie, numeNou) => {
    let copieCalendar = { ...calendar };
    if (!copieCalendar[zi]) {
      copieCalendar[zi] = { oameni: new Array(functii.length).fill("Din altă subunitate"), mod: "2" };
    }
    copieCalendar[zi].oameni[indexFunctie] = numeNou;
    await salveazaCalendar(copieCalendar);
  };

  const toggleMod = async (zi) => {
    let copieCalendar = { ...calendar };
    if (!copieCalendar[zi]) {
        copieCalendar[zi] = { oameni: new Array(functii.length).fill("Din altă subunitate"), mod: "2" };
    }
    const noulMod = copieCalendar[zi].mod === "1" ? "2" : "1";
    copieCalendar[zi].mod = noulMod;
    if (noulMod === "1") {
      copieCalendar[zi].oameni[6] = "Din altă subunitate"; 
    }
    await salveazaCalendar(copieCalendar);
  };

  if (incarcare) return <div className="p-10 text-center font-black text-white text-xl uppercase tracking-tighter">Se încarcă...</div>;

  return (
    <div className="space-y-6">
      {zileDeAfisat.map(zi => {
        const dateZi = calendar[zi] || { oameni: new Array(functii.length).fill("Din altă subunitate"), mod: "2" };
        const azi = new Date().toLocaleDateString("ro-RO");
        const ieri = new Date(Date.now() - 86400000).toLocaleDateString("ro-RO");

        let borderCol = "border-slate-800";
        let shadow = "";
        if (zi === azi) { borderCol = "border-green-500"; shadow = "shadow-lg shadow-green-500/10"; }
        else if (zi === ieri) { borderCol = "border-red-200"; }

        return (
          <div key={zi} className={`bg-slate-900 rounded-[2rem] border-2 ${borderCol} ${shadow} overflow-hidden`}>
            
            <div className="p-4 bg-black/40 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black text-white uppercase leading-none">{getZileSaptamana(zi)}</h3>
                <span className="text-slate-400 font-bold text-xs">{zi}</span>
              </div>
              
              <button onClick={() => toggleMod(zi)} className="bg-slate-950 p-1 rounded-xl flex border border-white/10">
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${dateZi.mod === '1' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  <User size={14} strokeWidth={3} /> <span className="font-black text-[10px]">1P</span>
                </div>
                <div className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${dateZi.mod === '2' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}>
                  <Users size={14} strokeWidth={3} /> <span className="font-black text-[10px]">2P</span>
                </div>
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {functii.map((f, idx) => {
                if (dateZi.mod === "1" && f === "Intervenția 2") return null;
                const numeCurent = dateZi.oameni[idx] || "Din altă subunitate";
                const listaPermisa = ["Din altă subunitate", ...(reguliServicii[f] || [])];
                const esteSubunitate = numeCurent === "Din altă subunitate";

                return (
                  <div key={f} className="flex flex-col gap-1">
                    <span className="text-[10px] font-black uppercase text-slate-500 px-1">{f}</span>
                    <select 
                      value={numeCurent}
                      onChange={(e) => handleChange(zi, idx, e.target.value)}
                      className={`w-full bg-black text-white p-4 rounded-xl border-2 text-sm font-black uppercase outline-none transition-all
                        ${esteSubunitate ? 'border-slate-800 text-slate-600' : 'border-blue-500/50 text-white'}`}
                    >
                      {listaPermisa.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ServiciiPage;