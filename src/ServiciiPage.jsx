import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, setDoc } from 'firebase/firestore';
import { 
  Shield, Lock, Eye, Users, Radio, Zap, UserCheck, ChevronDown 
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

const ServiciiPage = ({ editabil }) => {
  const [calendar, setCalendar] = useState({});
  const [personal, setPersonal] = useState([]);
  const [reguli, setReguli] = useState({});
  const [loading, setLoading] = useState(true);

  const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

  const getIcon = (functie, size = 16) => {
    switch (functie) {
      case "Ajutor OSU": return <Shield size={size} className="text-blue-400" />;
      case "Sergent de serviciu PCT": return <Lock size={size} className="text-amber-400" />;
      case "Planton": return <Eye size={size} className="text-emerald-400" />;
      case "Patrulă": return <Users size={size} className="text-indigo-400" />;
      case "Operator radio": return <Radio size={size} className="text-purple-400" />;
      case "Intervenția 1": return <Zap size={size} className="text-red-500" />;
      case "Intervenția 2": return <Zap size={size} className="text-orange-500" />;
      case "Responsabil": return <UserCheck size={size} className="text-pink-400" />;
      default: return <Shield size={size} className="text-slate-400" />;
    }
  };

  // --- LOGICA DE FORMATARE REUTILIZABILĂ ---
  const formatareNumeElement = (text) => {
    if (!text || text === "Din altă subunitate") return { grad: "", nume: text, complet: text };
    
    const cifreRomane = ['I', 'II', 'III', 'IV', 'V'];
    const parti = text.split(' ');
    let indexStartNume = 0;

    for (let i = 0; i < parti.length; i++) {
      const cuv = parti[i].toUpperCase();
      if (cuv === "CLASA" || cifreRomane.includes(cuv)) {
        indexStartNume = i + 1;
      } else if (i === 0) {
        indexStartNume = 1;
      } else {
        break;
      }
    }

    const gradul = parti.slice(0, indexStartNume).map(p => {
      if (cifreRomane.includes(p.toUpperCase())) return p.toUpperCase();
      return p.toLowerCase();
    }).join(' ');

    const prenumeRaw = parti[indexStartNume] || "";
    const prenume = prenumeRaw.charAt(0).toUpperCase() + prenumeRaw.slice(1).toLowerCase();
    const numeleFamilie = parti.slice(indexStartNume + 1).join(' ').toUpperCase();

    const numeFormatat = `${prenume} ${numeleFamilie}`;
    return { 
      grad: gradul, 
      nume: numeFormatat,
      complet: `${gradul} ${numeFormatat}`
    };
  };

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

  const handleSchimbare = async (ziKey, index, valoare) => {
    const nouCalendar = { ...calendar };
    if (!nouCalendar[ziKey]) nouCalendar[ziKey] = { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
    nouCalendar[ziKey].oameni[index] = valoare;
    await setDoc(doc(db, "servicii", "calendar"), { data: nouCalendar });
  };

  if (loading) return <div className="p-10 text-center text-white/50 font-black">SE ÎNCARCĂ...</div>;

  const zileAfisate = [-1, 0, 1, 2, 3, 4, 5].map(offset => {
    const d = addDays(new Date(), offset);
    return { key: format(d, 'dd.MM.yyyy'), display: format(d, 'EEEE, dd.MM.yyyy', { locale: ro }) };
  });

  return (
    <div className="max-w-[1400px] mx-auto space-y-3 pb-20 px-2">
      {zileAfisate.map((zi) => {
        const dateZi = calendar[zi.key] || { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-[#0f172a] rounded-[1.2rem] border-2 transition-all ${esteAzi ? 'border-indigo-500' : 'border-slate-800/40'}`}>
            <div className="p-2.5 border-b border-slate-800/50 bg-black/20 rounded-t-[1.2rem]">
              <h3 className="text-[9px] font-black uppercase text-indigo-400">{zi.display}</h3>
            </div>

            <div className="p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-4">
              {functii.map((f, idx) => {
                if (dateZi.mod === "1" && f === "Intervenția 2") return null;
                const omPlanificat = dateZi.oameni[idx] || "Din altă subunitate";
                const info = formatareNumeElement(omPlanificat);
                const filtrati = (reguli[f] || []).length > 0 ? personal.filter(p => reguli[f].includes(p.numeComplet)) : personal;

                return (
                  <div key={f} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5 ml-1">
                      {getIcon(f, 11)}
                      <label className="text-[8px] font-bold text-slate-500 uppercase">{f}</label>
                    </div>

                    <div className="relative">
                      {/* CARD VIZUAL - TEXT MARE ȘI FORMATAT */}
                      <div className="w-full bg-[#020617] border border-slate-800/60 rounded-lg px-3 py-2 flex justify-between items-center min-h-[55px]">
                        <div className="text-left overflow-hidden">
                          <p className="text-[9px] font-medium text-indigo-400/90 leading-none mb-1">{info.grad}</p>
                          <p className="text-[16px] font-bold text-white tracking-tight truncate">{info.nume}</p>
                        </div>
                        <div className="opacity-30">{getIcon(f, 15)}</div>
                      </div>

                      {/* POP-UP NATIV - TEXTUL DIN LISTĂ ESTE FORMATAT AICI */}
                      {editabil && (
                        <select 
                          value={omPlanificat} 
                          onChange={(e) => handleSchimbare(zi.key, idx, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          style={{ fontSize: '18px' }} // Încercare de mărire font pentru unele browsere
                        >
                          <option value="Din altă subunitate">DIN ALTĂ SUBUNITATE</option>
                          {filtrati.map(p => {
                            const opt = formatareNumeElement(p.numeComplet);
                            return (
                              <option key={p.id} value={p.numeComplet}>
                                {opt.complet}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
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