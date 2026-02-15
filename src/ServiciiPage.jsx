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

  // --- LOGICĂ DE FORMATARE AVANSATĂ PENTRU GRADE DIN RM ---
  const formatTextBrut = (text) => {
    if (!text || text === "Din altă subunitate") return text;
    
    const cifreRomane = ['I', 'II', 'III', 'IV', 'V'];
    const parti = text.split(' ');
    
    let indexStartNume = 0;

    // Detectăm unde se termină gradul (ex: "Soldat clasa I", "Sergent", "Locotenent")
    for (let i = 0; i < parti.length; i++) {
      const cuv = parti[i].toUpperCase();
      // Dacă cuvântul este "CLASA" sau o cifră romană, face parte din grad
      if (cuv === "CLASA" || cifreRomane.includes(cuv)) {
        indexStartNume = i + 1;
      } 
      // Dacă este un grad simplu (primul cuvânt)
      else if (i === 0) {
        indexStartNume = 1;
      } else {
        break; // Am ajuns la Prenume
      }
    }

    // 1. Gradul (mici + cifre romane MARI)
    const gradul = parti.slice(0, indexStartNume).map(p => {
      if (cifreRomane.includes(p.toUpperCase())) return p.toUpperCase();
      return p.toLowerCase();
    }).join(' ');

    // 2. Prenumele (Prima majusculă)
    const prenumeRaw = parti[indexStartNume] || "";
    const prenume = prenumeRaw.charAt(0).toUpperCase() + prenumeRaw.slice(1).toLowerCase();

    // 3. Numele de familie (Restul cuvintelor - TOATE MARI)
    const numeleFamilie = parti.slice(indexStartNume + 1).join(' ').toUpperCase();

    return `${gradul} ${prenume} ${numeleFamilie}`.trim();
  };

  const zileAfisate = [-1, 0, 1, 2, 3, 4, 5].map(offset => {
    const d = addDays(new Date(), offset);
    return {
      key: format(d, 'dd.MM.yyyy'),
      display: format(d, 'EEEE, dd.MM.yyyy', { locale: ro }),
      ziFiltru: format(d, 'yyyyMMdd'),
      ziUrmatoareFiltru: format(addDays(d, 1), 'yyyyMMdd')
    };
  });

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubPers = onSnapshot(q, (snap) => {
      setPersonal(snap.docs.map(d => ({
        id: d.id,
        numeComplet: `${d.data().grad || ''} ${d.data().prenume || ''} ${d.data().nume || ''}`.trim().toUpperCase(),
        ...d.data()
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

  const handleSchimbare = async (zi, index, valoare) => {
    if (navigator.vibrate) navigator.vibrate(40);
    const nouCalendar = JSON.parse(JSON.stringify(calendar));
    const vechiulOmNume = calendar[zi.key]?.oameni[index];
    const dataCurenta = parse(zi.key, 'dd.MM.yyyy', new Date());
    
    const ieriKey = format(addDays(dataCurenta, -1), 'dd.MM.yyyy');
    const maineKey = format(addDays(dataCurenta, 1), 'dd.MM.yyyy');
    
    const oameniIeri = calendar[ieriKey]?.oameni || [];
    const oameniAzi = calendar[zi.key]?.oameni || [];
    const oameniMaine = calendar[maineKey]?.oameni || [];

    if (valoare !== "Din altă subunitate") {
      if (oameniAzi.includes(valoare)) {
        alert(`⚠️ ${formatTextBrut(valoare)} este deja planificat azi!`);
        return;
      }
      if (oameniIeri.includes(valoare) || oameniMaine.includes(valoare)) {
        alert(`⚠️ ${formatTextBrut(valoare)} este planificat ieri sau mâine!`);
        return;
      }
    }

    const functiaCurenta = functii[index];
    const esteInterventie = functiaCurenta.includes("Intervenția");

    if (vechiulOmNume && vechiulOmNume !== "Din altă subunitate" && !esteInterventie) {
      const omV = personal.find(p => p.numeComplet === vechiulOmNume);
      if (omV) {
        await updateDoc(doc(db, "echipa", omV.id), { 
          [`status_${zi.ziFiltru}`]: "Prezent la serviciu",
          [`status_${zi.ziUrmatoareFiltru}`]: "Prezent la serviciu"
        });
      }
    }

    if (valoare !== "Din altă subunitate" && !esteInterventie) {
      const omN = personal.find(p => p.numeComplet === valoare);
      if (omN) {
        await updateDoc(doc(db, "echipa", omN.id), { 
          [`status_${zi.ziFiltru}`]: "În serviciu",
          [`status_${zi.ziUrmatoareFiltru}`]: "După serviciu"
        });
      }
    }

    if (!nouCalendar[zi.key]) nouCalendar[zi.key] = { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
    nouCalendar[zi.key].oameni[index] = valoare;
    await setDoc(doc(db, "servicii", "calendar"), { data: nouCalendar });
  };

  if (loading) return <div className="p-10 text-center text-white opacity-50 font-black uppercase">Se încarcă...</div>;

  return (
    <div className="space-y-6">
      {zileAfisate.map((zi) => {
        const dateZi = calendar[zi.key] || { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-slate-900 rounded-[2rem] border-2 transition-all ${esteAzi ? 'border-green-500 shadow-2xl' : 'border-slate-800'}`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-black/20 rounded-t-[2rem]">
              <h3 className="text-[11px] font-black uppercase text-white tracking-widest">{zi.display}</h3>
              {editabil && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
                  <button onClick={async () => {
                    const nC = {...calendar}; nC[zi.key] = {...(nC[zi.key]||{}), mod: "1"};
                    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
                  }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${dateZi.mod === "1" ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}><User size={12}/></button>
                  <button onClick={async () => {
                    const nC = {...calendar}; nC[zi.key] = {...(nC[zi.key]||{}), mod: "2"};
                    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
                  }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${dateZi.mod === "2" ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}><Users size={12}/></button>
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              {functii.map((f, idx) => {
                if (dateZi.mod === "1" && f === "Intervenția 2") return null;
                const omPlanificat = dateZi.oameni[idx] || "Din altă subunitate";
                const listaE = reguli[f] || [];
                const filtrati = (listaE.length > 0) ? personal.filter(p => listaE.includes(p.numeComplet)) : personal;

                return (
                  <div key={f} className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase ml-2 tracking-tighter">{f}</label>
                    {editabil ? (
                      <select 
                        value={omPlanificat} 
                        onChange={(e) => handleSchimbare(zi, idx, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs font-black text-white outline-none focus:border-blue-500 appearance-none shadow-inner"
                      >
                        <option value="Din altă subunitate">Din altă subunitate</option>
                        {filtrati.map(p => (
                          <option key={p.id} value={p.numeComplet}>
                            {formatTextBrut(p.numeComplet)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                        <span className="text-xs font-black uppercase text-white/90">{formatTextBrut(omPlanificat)}</span>
                        <Shield size={14} className="text-blue-500/20" />
                      </div>
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