import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc } from 'firebase/firestore';
import { Shield, User, Users } from 'lucide-react';
import { format, addDays, parse } from 'date-fns';
import { ro } from 'date-fns/locale';

const ServiciiPage = ({ editabil }) => {
  const [calendar, setCalendar] = useState({});
  const [personal, setPersonal] = useState([]);
  const [reguli, setReguli] = useState({});
  const [loading, setLoading] = useState(true);

  const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

  const zileAfisate = [-1, 0, 1, 2, 3, 4, 5].map(offset => {
    const d = addDays(new Date(), offset);
    return {
      key: format(d, 'dd.MM.yyyy'),
      display: format(d, 'EEEE, dd.MM.yyyy', { locale: ro }),
      ziFiltru: format(d, 'yyyyMMdd')
    };
  });

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubPers = onSnapshot(q, (snap) => {
      setPersonal(snap.docs.map(d => ({
        id: d.id,
        numeComplet: `${d.data().grad || ''} ${d.data().prenume || ''} ${d.data().nume || ''}`.trim().toUpperCase(),
        original: d.data()
      })));
    });

    const unsubCal = onSnapshot(doc(db, "servicii", "calendar"), (snap) => {
      if (snap.exists()) setCalendar(snap.data().data || {});
      setLoading(false);
    });

    const unsubReg = onSnapshot(doc(db, "setari", "reguli_servicii"), (snap) => {
      if (snap.exists()) setReguli(snap.data());
    });

    return () => { unsubPers(); unsubCal(); unsubReg(); };
  }, []);

  const handleSchimbare = async (ziKey, index, valoare, ziFiltru) => {
    const nouCalendar = { ...calendar };
    if (!nouCalendar[ziKey]) nouCalendar[ziKey] = { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
    
    const vechiulOmNume = nouCalendar[ziKey].oameni[index];
    const totiOameniiAzi = nouCalendar[ziKey].oameni;

    // 1. RESTRICȚIE: Nu în 2 servicii în aceeași zi
    if (valoare !== "Din altă subunitate" && totiOameniiAzi.includes(valoare)) {
      alert(`⚠️ ${valoare} este deja planificat la altă funcție azi!`);
      return;
    }

    // 2. RESTRICȚIE: Nu 2 zile la rând
    const ieriKey = format(addDays(parse(ziKey, 'dd.MM.yyyy', new Date()), -1), 'dd.MM.yyyy');
    const maineKey = format(addDays(parse(ziKey, 'dd.MM.yyyy', new Date()), 1), 'dd.MM.yyyy');
    
    const oameniIeri = calendar[ieriKey]?.oameni || [];
    const oameniMaine = calendar[maineKey]?.oameni || [];

    if (valoare !== "Din altă subunitate" && (oameniiIeri.includes(valoare) || oameniMaine.includes(valoare))) {
      alert(`⚠️ ${valoare} a fost/este planificat în ziua precedentă sau următoare!`);
      return;
    }

    // 3. ACTUALIZARE STATUS AUTOMAT ÎN LISTĂ
    // Dacă scoatem pe cineva, îl punem "Prezent la serviciu" (sau status anterior)
    if (vechiulOmNume !== "Din altă subunitate") {
      const omVechi = personal.find(p => p.numeComplet === vechiulOmNume);
      if (omVechi) await updateDoc(doc(db, "echipa", omVechi.id), { [`status_${ziFiltru}`]: "Prezent la serviciu" });
    }

    // Dacă adăugăm pe cineva, îl punem "În serviciu"
    if (valoare !== "Din altă subunitate") {
      const omNou = personal.find(p => p.numeComplet === valoare);
      if (omNou) await updateDoc(doc(db, "echipa", omNou.id), { [`status_${ziFiltru}`]: "În serviciu" });
    }

    nouCalendar[ziKey].oameni[index] = valoare;
    await setDoc(doc(db, "servicii", "calendar"), { data: nouCalendar });
  };

  if (loading) return <div className="p-10 text-center opacity-50 text-white">Se încarcă...</div>;

  return (
    <div className="space-y-10 pb-10">
      {zileAfisate.map((zi) => {
        const dateZi = calendar[zi.key] || { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-slate-900/50 rounded-[2rem] border-2 ${esteAzi ? 'border-green-500 shadow-lg' : 'border-slate-800'}`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-black uppercase text-white tracking-tighter">{zi.display}</h3>
              {editabil && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button onClick={async () => {
                    const nC = {...calendar}; nC[zi.key] = {...(nC[zi.key]||{}), mod: "1"};
                    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
                  }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${dateZi.mod === "1" ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><User size={12}/></button>
                  <button onClick={async () => {
                    const nC = {...calendar}; nC[zi.key] = {...(nC[zi.key]||{}), mod: "2"};
                    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
                  }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${dateZi.mod === "2" ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><Users size={12}/></button>
                </div>
              )}
            </div>
            <div className="p-4 space-y-3">
              {functii.map((f, idx) => {
                if (dateZi.mod === "1" && f === "Intervenția 2") return null;
                const omPlanificat = dateZi.oameni[idx] || "Din altă subunitate";
                const listaEligibila = reguli[f] || [];
                const oameniFiltrati = (listaEligibila.length > 0) ? personal.filter(p => listaEligibila.includes(p.numeComplet)) : personal;

                return (
                  <div key={f} className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase ml-1">{f}</span>
                    {editabil ? (
                      <select value={omPlanificat} onChange={(e) => handleSchimbare(zi.key, idx, e.target.value, zi.ziFiltru)}
                        className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold text-white outline-none">
                        <option value="Din altă subunitate">Din altă subunitate</option>
                        {oameniFiltrati.map(p => <option key={p.id} value={p.numeComplet}>{p.numeComplet}</option>)}
                      </select>
                    ) : (
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/50 flex justify-between items-center"><span className="text-xs font-black uppercase text-white">{omPlanificat}</span><Shield size={12} className="opacity-20" /></div>
                    )}
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