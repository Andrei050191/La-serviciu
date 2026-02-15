import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { 
  Activity, Briefcase, Umbrella, Coffee, Home, MapPin, 
  Stethoscope, CalendarDays, Utensils, Check, Lock, LogOut, 
  Shield, X, ExternalLink, ChevronDown, ChevronUp
} from 'lucide-react';

import ServiciiPage from './ServiciiPage';
import ConfigurareEfectiv from './ConfigurareEfectiv';

const statusConfig = {
  "Prezent la serviciu": { color: "bg-green-600", icon: <Activity size={20} /> },
  "În serviciu": { color: "bg-blue-600", icon: <Briefcase size={20} /> },
  "După serviciu": { color: "bg-slate-500", icon: <Coffee size={20} /> },
  "Zi liberă": { color: "bg-yellow-600", icon: <Home size={20} /> },
  "Concediu": { color: "bg-purple-600", icon: <Umbrella size={20} /> },
  "Deplasare": { color: "bg-orange-600", icon: <MapPin size={20} /> },
  "Foaie de boala": { color: "bg-red-600", icon: <Stethoscope size={20} /> },
};

function App() {
  const [echipa, setEchipa] = useState([]);
  const [serviciiPlan, setServiciiPlan] = useState({});
  const [paginaCurenta, setPaginaCurenta] = useState('login');
  const [ziSelectata, setZiSelectata] = useState(0); 
  const [userLogat, setUserLogat] = useState(null);
  const [inputCod, setInputCod] = useState("");
  const [indicatii, setIndicatii] = useState("");
  const [editIndicatii, setEditIndicatii] = useState(false);
  const [mesajNou, setMesajNou] = useState(false);
  const [showConcediuSelect, setShowConcediuSelect] = useState(false);
  const [numarZileConcediu, setNumarZileConcediu] = useState(1);

  const optiuniZile = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const d = addDays(new Date(), i);
    let label = i === 0 ? "Azi" : i === 1 ? "Mâine" : format(d, 'eeee', { locale: ro });
    return { label, data: d, key: format(d, 'yyyyMMdd') };
  }), []);

  const ziKey = optiuniZile[ziSelectata].key;

  useEffect(() => {
    const sesiune = localStorage.getItem('userEfectiv');
    if (sesiune) {
      const u = JSON.parse(sesiune);
      setUserLogat(u);
      setPaginaCurenta(u.rol === 'admin' ? 'categorii' : 'personal');
    }
  }, []);

  useEffect(() => {
    const unsubEchipa = onSnapshot(query(collection(db, "echipa"), orderBy("ordine", "asc")), (s) => {
      setEchipa(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubServicii = onSnapshot(doc(db, "planificare", "servicii"), (d) => {
      if (d.exists()) setServiciiPlan(d.data());
    });
    const unsubInd = onSnapshot(doc(db, "setari", "indicatii"), (d) => {
      if (d.exists()) { setIndicatii(d.data().text); setMesajNou(true); setTimeout(() => setMesajNou(false), 8000); }
    });
    return () => { unsubEchipa(); unsubServicii(); unsubInd(); };
  }, []);

  // --- LOGICA STATUS & MASĂ ---
  const getStatusReal = (mId) => {
    const m = echipa.find(e => e.id === mId);
    if (!m) return "Nespecificat";
    const manual = m[`status_${ziKey}`];
    const plan = serviciiPlan[ziKey] || {};
    const esteInPlan = plan.responsabil === mId || (plan.interventie && plan.interventie.includes(mId));

    if (manual === "Concediu" || manual === "Foaie de boala") return manual;
    if (esteInPlan) return "În serviciu";
    return manual || "Nespecificat";
  };

  const poateMancaLaCantina = (mId) => {
    const st = getStatusReal(mId);
    // DOAR: Prezent la serviciu, Responsabil (În serviciu) sau Intervenție (În serviciu)
    return st === "Prezent la serviciu" || st === "În serviciu";
  };

  const login = (cod) => {
    if (cod === "0000") {
      const a = { rol: 'admin', nume: 'Administrator' }; setUserLogat(a);
      localStorage.setItem('userEfectiv', JSON.stringify(a)); setPaginaCurenta('categorii'); return;
    }
    const g = echipa.find(m => String(m.cod) === String(cod));
    if (g) {
      const u = { ...g, rol: 'user' }; setUserLogat(u);
      localStorage.setItem('userEfectiv', JSON.stringify(u)); setPaginaCurenta('personal');
    }
  };

  const logout = () => { localStorage.removeItem('userEfectiv'); setUserLogat(null); setPaginaCurenta('login'); };

  const formatIdentitate = (m) => (
    <div className="flex flex-col text-left">
      <span className="text-[10px] font-medium text-white/70 uppercase mb-1">{m?.grad || ""}</span>
      <span className="text-sm font-black text-white uppercase">{m?.prenume || ""} {m?.nume || ""}</span>
    </div>
  );

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white text-center">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm shadow-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
          <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl mb-4" placeholder="****" />
          <button onClick={() => login(inputCod)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase">Intră</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>{userLogat?.rol === 'admin' ? <h1 className="text-lg font-black uppercase tracking-tighter">Panou Admin</h1> : formatIdentitate(userLogat)}</div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"><LogOut size={24}/></button>
        </div>

        {/* Calendar Zile */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => setZiSelectata(index)} 
              className={`flex-1 min-w-[100px] py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 mb-1">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-6">
            {/* MENIU ADMIN REPARAT */}
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-4 overflow-x-auto gap-1">
              {[
                { id: 'categorii', label: 'SUMAR' },
                { id: 'cantina', label: 'MASĂ' },
                { id: 'lista', label: 'LISTA' },
                { id: 'servicii', label: 'PLANIFICARE' },
                { id: 'config_servicii', label: 'CONFIGURARE' }
              ].map((p) => (
                <button key={p.id} onClick={() => setPaginaCurenta(p.id)} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase whitespace-nowrap transition-all ${paginaCurenta === p.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 gap-4">
                {Object.keys(statusConfig).map(st => {
                  const oameni = echipa.filter(m => getStatusReal(m.id) === st);
                  return (
                    <div key={st} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-md">
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2"><div className={`p-2 rounded-lg ${statusConfig[st].color}`}>{statusConfig[st].icon}</div><span className="font-black uppercase text-xs">{st}</span></div>
                        <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-black">{oameni.length}</span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {oameni.map(o => (
                          <div key={o.id} className="bg-slate-950 p-3 rounded-xl border border-white/5 flex justify-between items-center text-[10px] font-black uppercase">
                            <span>{o.grad} {o.prenume} {o.nume}</span>
                            {o[`cantina_${ziKey}`] && <Utensils size={14} className="text-orange-500" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                <h2 className="text-center font-black uppercase text-orange-500 mb-6 tracking-widest">Administrare Masă Cantină</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {echipa.map(m => {
                    const ok = poateMancaLaCantina(m.id);
                    const mananca = m[`cantina_${ziKey}`];
                    return (
                      <button key={m.id} disabled={!ok} onClick={() => updateDoc(doc(db, "echipa", m.id), { [`cantina_${ziKey}`]: !mananca })} 
                        className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all ${!ok ? 'opacity-20 bg-slate-950 grayscale cursor-not-allowed' : mananca ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800'}`}>
                        {formatIdentitate(m)}
                        {ok && (mananca ? <Check size={18} strokeWidth={4}/> : <div className="w-5 h-5 border-2 border-slate-800 rounded-full"/>)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {paginaCurenta === 'lista' && (
              <div className="grid grid-cols-1 gap-3">
                {echipa.map(m => (
                  <div key={m.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center shadow-md">
                    {formatIdentitate(m)}
                    <span className={`text-[9px] font-black px-3 py-2 rounded-lg text-white ${statusConfig[getStatusReal(m.id)]?.color || 'bg-slate-800'}`}>{getStatusReal(m.id)}</span>
                  </div>
                ))}
              </div>
            )}
            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} />}
            {paginaCurenta === 'config_servicii' && <ConfigurareEfectiv />}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status User */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
              <h2 className="text-center text-[10px] font-black uppercase text-blue-400 mb-6 tracking-widest">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
              <div className="grid grid-cols-1 gap-3">
                {Object.keys(statusConfig).map(st => {
                  const currentSt = getStatusReal(userLogat.id);
                  const activ = currentSt === st;
                  const esteBlocatInServiciu = (currentSt === "În serviciu" || currentSt === "După serviciu") && st !== currentSt;
                  return (
                    <button key={st} disabled={esteBlocatInServiciu} onClick={() => updateDoc(doc(db, "echipa", userLogat.id), { [`status_${ziKey}`]: st })} 
                      className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-lg' : 'bg-slate-950 border-slate-800 text-white opacity-70'} ${esteBlocatInServiciu ? 'opacity-30' : ''}`}>
                      <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                      <span className="text-sm uppercase font-black">{st}</span>
                      {activ && (esteBlocatInServiciu ? <Lock size={20} className="ml-auto" /> : <Check size={24} className="ml-auto" strokeWidth={4} />)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buton Masă User */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
              <h2 className="text-center text-[10px] font-black uppercase text-orange-500 mb-6 tracking-widest">Masă la Cantină</h2>
              {(() => {
                const me = echipa.find(e => e.id === userLogat.id);
                const ok = poateMancaLaCantina(userLogat.id);
                const mananca = me?.[`cantina_${ziKey}`];
                return (
                  <button onClick={() => updateDoc(doc(db, "echipa", userLogat.id), { [`cantina_${ziKey}`]: !mananca })} disabled={!ok}
                    className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all ${!ok ? 'bg-red-950/10 opacity-30 cursor-not-allowed border-transparent' : mananca ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800'}`}>
                    <div className="flex items-center gap-4"><Utensils size={24} /><span className="text-sm uppercase font-black">{mananca ? "LA CANTINĂ" : "ACASĂ"}</span></div>
                    {mananca ? <Check size={24} strokeWidth={4}/> : <X size={24} className="text-red-500" strokeWidth={4}/>}
                  </button>
                );
              })()}
            </div>
            
            <button onClick={() => setPaginaCurenta(paginaCurenta === 'servicii' ? 'personal' : 'servicii')} className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-4"><div className="bg-blue-600 p-3 rounded-2xl text-white"><Shield size={22} /></div><span className="font-black text-xs uppercase tracking-widest">Vezi Planificarea</span></div>
              <ExternalLink size={20} className="text-blue-500 opacity-50" />
            </button>
            {paginaCurenta === 'servicii' && <div className="mt-4"><ServiciiPage editabil={false} /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
export default App;