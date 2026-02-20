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

  // AUTO-CURĂȚARE ZILE VECHI - REPARAT SINTAXĂ
  useEffect(() => {
    if (editabil && Object.keys(calendar).length > 0) {
      const curataZileVechi = async () => {
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        const ieri = addDays(azi, -1);
        
        let dateNoi = { ...calendar };
        let saSchimbat = false;

        Object.keys(calendar).forEach(key => {
          try {
            const dataDoc = parse(key, 'dd.MM.yyyy', new Date());
            if (dataDoc < ieri) {
              delete dateNoi[key];
              saSchimbat = true;
            }
          } catch (e) { console.error("Eroare cheie data:", key); }
        });

        if (saSchimbat) {
          await setDoc(doc(db, "servicii", "calendar"), { data: dateNoi });
        }
      };
      curataZileVechi();
    }
  }, [calendar, editabil]);

  const afiseazaNumeFrumos = (numeComplet) => {
    if (!numeComplet || numeComplet === "Din altă subunitate") return numeComplet;
    const p = personal.find(pers => pers.numeComplet === numeComplet);
    if (!p) return numeComplet;

    const grad = (p.grad || "").split(' ').map(c => 
      /^[IVXLC]+$/i.test(c) ? c.toUpperCase() : c.toLowerCase()
    ).join(' ');

    const prenume = p.prenume 
      ? p.prenume.charAt(0).toUpperCase() + p.prenume.slice(1).toLowerCase() 
      : "";

    const nume = (p.nume || "").toUpperCase();
    return `${grad} ${prenume} ${nume}`.trim();
  };

  const zileAfisate = [ 0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
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
    const nouCalendar = JSON.parse(JSON.stringify(calendar || {}));
    
    // REPARAȚIE: Verificăm dacă ziua are array-ul de oameni, dacă nu, îl creăm
    if (!nouCalendar[zi.key] || !nouCalendar[zi.key].oameni) {
        nouCalendar[zi.key] = { 
            oameni: Array(functii.length).fill("Din altă subunitate"), 
            mod: nouCalendar[zi.key]?.mod || "2" 
        };
    }

    const vechiulOmNume = nouCalendar[zi.key].oameni[index];
    const dataCurenta = parse(zi.key, 'dd.MM.yyyy', new Date());
    
    const ieriKey = format(addDays(dataCurenta, -1), 'dd.MM.yyyy');
    const maineKey = format(addDays(dataCurenta, 1), 'dd.MM.yyyy');
    
    const oameniIeri = calendar[ieriKey]?.oameni || [];
    const oameniAzi = nouCalendar[zi.key].oameni || [];
    const oameniMaine = calendar[maineKey]?.oameni || [];

    if (valoare !== "Din altă subunitate") {
      if (oameniAzi.includes(valoare)) {
        alert(`⚠️ ${valoare} este deja planificat azi!`);
        return;
      }
      if (oameniIeri.includes(valoare) || oameniMaine.includes(valoare)) {
        alert(`⚠️ ${valoare} este planificat în ziua precedentă sau următoare!`);
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

    nouCalendar[zi.key].oameni[index] = valoare;
    await setDoc(doc(db, "servicii", "calendar"), { data: nouCalendar });
  };

  if (loading) return <div className="p-10 text-center text-white opacity-50 font-black tracking-[0.2em]">SE ÎNCARCĂ...</div>;

  return (
    <div className="space-y-6">
      {zileAfisate.map((zi) => {
        // REPARAȚIE VIZUALĂ: Ne asigurăm că dateZi are mereu structura corectă pentru mapare
        const dateZiIncompleta = calendar[zi.key] || {};
        const dateZi = {
          mod: dateZiIncompleta.mod || "2",
          oameni: dateZiIncompleta.oameni || Array(functii.length).fill("Din altă subunitate")
        };
        
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-slate-900 rounded-[2rem] border-2 transition-all ${esteAzi ? 'border-green-500 shadow-2xl' : 'border-slate-800'}`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-black/20 rounded-t-[2rem]">
              <h3 className="text-[17px] font-black uppercase text-white tracking-widest">{zi.display}</h3>
              {editabil && (
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
                  <button onClick={async () => {
                    const nC = {...calendar}; 
                    nC[zi.key] = {...(nC[zi.key] || {}), oameni: dateZi.oameni, mod: "1"};
                    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
                  }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${dateZi.mod === "1" ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><User size={12}/></button>
                  <button onClick={async () => {
                    const nC = {...calendar}; 
                    nC[zi.key] = {...(nC[zi.key] || {}), oameni: dateZi.oameni, mod: "2"};
                    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
                  }} className={`px-3 py-1.5 rounded-lg text-[9px] font-black ${dateZi.mod === "2" ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><Users size={12}/></button>
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
                    <label className="text-[12px] font-black text-slate-200 uppercase ml-2 tracking-tighter">{f}</label>
                    {editabil ? (
                      <select 
                        value={omPlanificat} 
                        onChange={(e) => handleSchimbare(zi, idx, e.target.value)}
                        style={{ fontSize: '16px' }}
                        className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl text-xs font-black text-white outline-none focus:border-blue-500 appearance-none shadow-inner"
                      >
                        <option value="Din altă subunitate">Din altă subunitate</option>
                        {filtrati.map(p => (
                          <option key={p.id} value={p.numeComplet}>
                            {afiseazaNumeFrumos(p.numeComplet)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                        <span style={{ fontSize: '18px' }} className="font-black text-white/90">
                          {afiseazaNumeFrumos(omPlanificat)}
                        </span>
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