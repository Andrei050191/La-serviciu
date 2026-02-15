import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc } from 'firebase/firestore';
import { 
  Shield, 
  User, 
  Users, 
  Radio, 
  Zap, 
  Eye, 
  Lock, 
  UserCheck 
} from 'lucide-react';
import { format, addDays, parse } from 'date-fns';
import { ro } from 'date-fns/locale';

const ServiciiPage = ({ editabil }) => {
  const [calendar, setCalendar] = useState({});
  const [personal, setPersonal] = useState([]);
  const [reguli, setReguli] = useState({});
  const [loading, setLoading] = useState(true);

  const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

  // --- FUNCȚIE PENTRU ICONIȚE ---
  const getIcon = (functie) => {
    switch (functie) {
      case "Ajutor OSU": return <Shield size={18} className="text-blue-400" />;
      case "Sergent de serviciu PCT": return <Lock size={18} className="text-amber-400" />;
      case "Planton": return <Eye size={18} className="text-emerald-400" />;
      case "Patrulă": return <Users size={18} className="text-indigo-400" />;
      case "Operator radio": return <Radio size={18} className="text-purple-400" />;
      case "Intervenția 1": return <Zap size={18} className="text-red-500" />;
      case "Intervenția 2": return <Zap size={18} className="text-orange-500" />;
      case "Responsabil": return <UserCheck size={18} className="text-pink-400" />;
      default: return <Shield size={18} className="text-slate-400" />;
    }
  };

  // --- FORMATARE LUNGĂ CU TEXT MARE ---
  const formatTextBrut = (text) => {
    if (!text || text === "Din altă subunitate") return text;
    
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
    const nouCalendar = { ...calendar };
    if (!nouCalendar[zi.key]) nouCalendar[zi.key] = { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
    nouCalendar[zi.key].oameni[index] = valoare;
    await setDoc(doc(db, "servicii", "calendar"), { data: nouCalendar });
  };

  if (loading) return <div className="p-10 text-center text-white/50 font-black">SE ÎNCARCĂ...</div>;

  return (
    <div className="space-y-6 pb-20">
      {zileAfisate.map((zi) => {
        const dateZi = calendar[zi.key] || { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-slate-900 rounded-[2rem] border-2 transition-all ${esteAzi ? 'border-indigo-500 shadow-2xl scale-[1.02]' : 'border-slate-800'}`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-black/30 rounded-t-[2rem]">
              <h3 className="text-xs font-black uppercase text-white tracking-widest">{zi.display}</h3>
            </div>

            <div className="p-4 space-y-5">
              {functii.map((f, idx) => {
                if (dateZi.mod === "1" && f === "Intervenția 2") return null;
                const omPlanificat = dateZi.oameni[idx] || "Din altă subunitate";
                const listaE = reguli[f] || [];
                const filtrati = (listaE.length > 0) ? personal.filter(p => listaE.includes(p.numeComplet)) : personal;

                return (
                  <div key={f} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 ml-2">
                      {getIcon(f)}
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{f}</label>
                    </div>
                    {editabil ? (
                      <select 
                        value={omPlanificat} 
                        onChange={(e) => handleSchimbare(zi, idx, e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 p-5 rounded-2xl text-[14px] font-black text-white outline-none appearance-none shadow-xl focus:border-indigo-500"
                      >
                        <option value="Din altă subunitate">DIN ALTĂ SUBUNITATE</option>
                        {filtrati.map(p => (
                          <option key={p.id} value={p.numeComplet}>
                            {formatTextBrut(p.numeComplet)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex justify-between items-center shadow-inner">
                        <span className="text-[14px] font-black uppercase text-white">{formatTextBrut(omPlanificat)}</span>
                        <div className="opacity-40">{getIcon(f)}</div>
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