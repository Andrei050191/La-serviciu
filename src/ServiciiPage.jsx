import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, setDoc } from 'firebase/firestore';
import { 
  Shield, 
  Lock, 
  Eye, 
  Users, 
  Radio, 
  Zap, 
  UserCheck, 
  ChevronDown 
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';

const ServiciiPage = ({ editabil }) => {
  const [calendar, setCalendar] = useState({});
  const [personal, setPersonal] = useState([]);
  const [reguli, setReguli] = useState({});
  const [loading, setLoading] = useState(true);

  const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

  // --- MAPARE ICONIȚE ---
  const getIcon = (functie, size = 18) => {
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

  // --- FORMATARE NUME (GRAD MIC, NUME MARE) ---
  const formatNumeInterfata = (text) => {
    if (!text || text === "Din altă subunitate") return { grad: "", nume: text };
    
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

    return { grad: gradul, nume: `${prenume} ${numeleFamilie}` };
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
    <div className="max-w-[1400px] mx-auto space-y-10 pb-24 px-4">
      {zileAfisate.map((zi) => {
        const dateZi = calendar[zi.key] || { oameni: Array(functii.length).fill("Din altă subunitate"), mod: "2" };
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-[#0f172a] rounded-[2.5rem] border-2 transition-all ${esteAzi ? 'border-indigo-500 shadow-2xl' : 'border-slate-800/50'}`}>
            <div className="p-6 border-b border-slate-800 bg-black/20 rounded-t-[2.5rem]">
              <h3 className="text-xs font-black uppercase text-indigo-400 tracking-widest">{zi.display}</h3>
            </div>

            {/* GRID ADAPTIV: 1 coloană pe mobil, 2 pe tabletă, 3 pe PC mare */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {functii.map((f, idx) => {
                if (dateZi.mod === "1" && f === "Intervenția 2") return null;
                const omPlanificat = dateZi.oameni[idx] || "Din altă subunitate";
                const info = formatNumeInterfata(omPlanificat);
                const filtrati = (reguli[f] || []).length > 0 ? personal.filter(p => reguli[f].includes(p.numeComplet)) : personal;

                return (
                  <div key={f} className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 ml-2">
                      {getIcon(f, 16)}
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{f}</label>
                    </div>

                    <div className="relative group">
                      {/* UI VIZUAL */}
                      <div className="w-full bg-[#020617] border border-slate-800 rounded-2xl p-5 flex justify-between items-center min-h-[80px] transition-colors group-hover:border-slate-600">
                        <div className="text-left overflow-hidden mr-4">
                          <p className="text-[10px] font-bold text-indigo-400/80 leading-none mb-1.5">{info.grad}</p>
                          <p className="text-[15px] font-black text-white uppercase tracking-tight truncate">{info.nume}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="bg-slate-900/50 p-2 rounded-lg">{getIcon(f, 20)}</div>
                          {editabil && <ChevronDown size={18} className="text-slate-700" />}
                        </div>
                      </div>

                      {/* SELECT NATIV (Invisible Overlay) */}
                      {editabil && (
                        <select 
                          value={omPlanificat} 
                          onChange={(e) => handleSchimbare(zi.key, idx, e.target.value)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        >
                          <option value="Din altă subunitate">DIN ALTĂ SUBUNITATE</option>
                          {filtrati.map(p => (
                            <option key={p.id} value={p.numeComplet}>{p.numeComplet}</option>
                          ))}
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