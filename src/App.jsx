import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc, getDoc 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { 
  Activity, Briefcase, Umbrella, Coffee, Home, MapPin, 
  Stethoscope, CalendarDays, Utensils, Check, Lock, LogOut, 
  Shield, X, ExternalLink, AlertTriangle
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
  const [paginaCurenta, setPaginaCurenta] = useState('login');
  const [ziSelectata, setZiSelectata] = useState(0); 
  const [userLogat, setUserLogat] = useState(null);
  const [inputCod, setInputCod] = useState("");
  const [eroareLogin, setEroareLogin] = useState(false);
  const [membruEditat, setMembruEditat] = useState(null);
  const [indicatii, setIndicatii] = useState("");
  const [editIndicatii, setEditIndicatii] = useState(false);
  const [mesajNou, setMesajNou] = useState(false);

  const vibreaza = (ms = 40) => { if (navigator.vibrate) navigator.vibrate(ms); };

  // 1. GENERARE 4 ZILE (Azi, Mâine + 2 zile)
  const optiuniZile = [0, 1, 2, 3].map(i => {
    const d = addDays(new Date(), i);
    let label = i === 0 ? "Azi" : i === 1 ? "Mâine" : format(d, 'eeee', { locale: ro });
    return { label, data: d, key: format(d, 'yyyyMMdd') };
  });

  const ziKey = optiuniZile[ziSelectata].key;

  useEffect(() => {
    const sesiuneSalvata = localStorage.getItem('userEfectiv');
    if (sesiuneSalvata) {
      const user = JSON.parse(sesiuneSalvata);
      setUserLogat(user);
      setPaginaCurenta(user.rol === 'admin' ? 'categorii' : 'personal');
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEchipa(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "indicatii"), (docSnap) => {
      if (docSnap.exists()) { 
        setIndicatii(docSnap.data().text); 
        setMesajNou(true); 
        setTimeout(() => setMesajNou(false), 8000); 
      }
    });
    return () => unsub();
  }, []);

  const login = (cod) => {
    vibreaza(60);
    if (cod === "0000") {
      const admin = { rol: 'admin', nume: 'Administrator', id: 'admin' };
      setUserLogat(admin);
      localStorage.setItem('userEfectiv', JSON.stringify(admin));
      setPaginaCurenta('categorii');
      return;
    }
    const gasit = echipa.find(m => String(m.cod) === String(cod));
    if (gasit) {
      const u = { ...gasit, rol: 'user' };
      setUserLogat(u);
      localStorage.setItem('userEfectiv', JSON.stringify(u));
      setPaginaCurenta('personal');
    } else { setEroareLogin(true); setInputCod(""); }
  };

  const logout = () => { vibreaza(30); localStorage.removeItem('userEfectiv'); setUserLogat(null); setPaginaCurenta('login'); };

  // 2. LOGICA SCHIMBARE STATUS + AUTOMATIZARE ZIUA URMĂTOARE
  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(50);
    const updateObj = { 
      [`status_${ziKey}`]: nouStatus,
      // Sincronizare cu ServiciiPage (care foloseste campul 'status' simplu)
      status: nouStatus 
    };

    // Dacă e restrictiv, scoatem de la masă
    if (["Zi liberă", "Concediu", "Deplasare", "Foaie de boala"].includes(nouStatus)) {
      updateObj[`cantina_${ziKey}`] = false;
    }

    // AUTOMATIZARE: Dacă pune "În serviciu", mâine se pune automat "După serviciu"
    if (nouStatus === "În serviciu" && ziSelectata < optiuniZile.length - 1) {
      const maineKey = optiuniZile[ziSelectata + 1].key;
      updateObj[`status_${maineKey}`] = "După serviciu";
      updateObj[`cantina_${maineKey}`] = false;
    }

    await updateDoc(doc(db, "echipa", id), updateObj);
    setMembruEditat(null);
  };

  const toggleCantina = async (id, stare) => {
    vibreaza(40);
    await updateDoc(doc(db, "echipa", id), { [`cantina_${ziKey}`]: !stare });
  };

  const formatIdentitate = (m) => (
    <div className="flex flex-col text-left">
      <span className="text-[10px] font-medium text-white/70 leading-none mb-1 uppercase">{m?.grad}</span>
      <span className="text-sm font-black text-white uppercase">{m?.prenume} {m?.nume}</span>
    </div>
  );

  // Calcule live pentru Sumar
  const nrLaCantina = echipa.filter(m => m[`cantina_${ziKey}`] === true).length;
  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => (m[`status_${ziKey}`] || "Nespecificat") === status);
    return acc;
  }, {});

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8">Acces Sistem</h1>
          <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl mb-4 outline-none focus:border-blue-500" placeholder="****" maxLength="4" />
          <button onClick={() => login(inputCod)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase shadow-lg">Intră</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>{userLogat?.rol === 'admin' ? <h1 className="text-lg font-black uppercase">Admin</h1> : formatIdentitate(echipa.find(e => e.id === userLogat?.id))}</div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"><LogOut size={24}/></button>
        </div>

        {/* 3. SELECTOR CELE 4 ZILE */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => { vibreaza(25); setZiSelectata(index); }} 
              className={`flex-1 min-w-[100px] py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400 shadow-lg' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 mb-1">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-6">
            {/* Navigare Admin */}
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-4 overflow-x-auto gap-1">
              {[
                { id: 'categorii', label: 'Sumar' },
                { id: 'cantina', label: 'Masă' },
                { id: 'lista', label: 'Listă' },
                { id: 'servicii', label: 'Servicii' },
                { id: 'config_servicii', label: 'Eligibili' }
              ].map((p) => (
                <button key={p.id} onClick={() => { vibreaza(30); setPaginaCurenta(p.id); }} 
                  className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase whitespace-nowrap transition-all ${paginaCurenta === p.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* SUMAR */}
            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(categorii).map(([numeCat, oameni]) => (
                  <div key={numeCat} className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-xl">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2 font-black uppercase text-xs">
                        <div className={`p-2 rounded-lg ${statusConfig[numeCat]?.color}`}>{statusConfig[numeCat]?.icon}</div>
                        {numeCat}
                      </div>
                      <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-black">{oameni.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {oameni.map(o => (
                        <div key={o.id} className="bg-black/30 p-3 rounded-xl border border-white/5">{formatIdentitate(o)}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MASĂ (Sincronizată) */}
            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                <h2 className="text-lg font-black uppercase text-orange-500 mb-6 text-center">Persoane la Masă ({nrLaCantina})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {echipa.map(m => (
                    <button key={m.id} onClick={() => toggleCantina(m.id, m[`cantina_${ziKey}`])} 
                      className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all ${m[`cantina_${ziKey}`] ? 'bg-orange-600 border-orange-400' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                      {formatIdentitate(m)}
                      {m[`cantina_${ziKey}`] ? <Check size={18} strokeWidth={4}/> : <X size={18} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* LISTĂ (Sincronizată) */}
            {paginaCurenta === 'lista' && (
              <div className="space-y-3">
                {echipa.map(m => (
                  <div key={m.id} className="flex flex-col gap-1">
                    <button onClick={() => setMembruEditat(membruEditat === m.id ? null : m.id)} className={`bg-slate-900 p-5 rounded-2xl border flex justify-between items-center transition-all ${membruEditat === m.id ? 'border-blue-500 shadow-lg' : 'border-slate-800'}`}>
                      {formatIdentitate(m)}
                      <span className={`text-[9px] font-black px-3 py-2 rounded-lg ${statusConfig[m[`status_${ziKey}`]]?.color || 'bg-slate-800'}`}>{m[`status_${ziKey}`] || 'NESPECIFICAT'}</span>
                    </button>
                    {membruEditat === m.id && (
                      <div className="grid grid-cols-2 gap-2 p-4 bg-slate-950 rounded-b-3xl border-x border-b border-slate-800 animate-in slide-in-from-top-2 duration-200">
                        {Object.keys(statusConfig).map(st => (
                          <button key={st} onClick={() => schimbaStatus(m.id, st)} className="p-3 rounded-xl bg-slate-900 text-[9px] font-black uppercase border border-slate-800 flex items-center gap-2 hover:bg-slate-800 transition-colors">{statusConfig[st].icon} {st}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} />}
            {paginaCurenta === 'config_servicii' && <ConfigurareEfectiv />}
          </div>
        ) : (
          /* USER VIEW */
          <div className="space-y-6">
            <button onClick={() => setPaginaCurenta(paginaCurenta === 'servicii_user' ? 'personal' : 'servicii_user')} className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-4"><Shield className="text-blue-500" /><span className="font-black text-xs uppercase">Planificare Servicii</span></div>
              <ExternalLink size={20} className="opacity-50" />
            </button>

            {paginaCurenta === 'servicii_user' ? <ServiciiPage editabil={true} /> : (
              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h2 className="text-center text-xs font-black uppercase text-blue-400 mb-6 tracking-widest">Alege Status {optiuniZile[ziSelectata].label}</h2>
                  <div className="grid gap-3">
                    {Object.keys(statusConfig).map(st => {
                      const m = echipa.find(e => e.id === userLogat.id);
                      const activ = m?.[`status_${ziKey}`] === st;
                      return (
                        <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 opacity-70 text-white'}`}>
                          {statusConfig[st].icon} <span className="text-sm uppercase font-black">{st}</span>
                          {activ && <Check size={24} className="ml-auto" strokeWidth={4} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. LOGICA CANTINA USER (CU RESTRICȚIE) */}
                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h2 className="text-center text-xs font-black uppercase text-orange-500 mb-6 tracking-widest">Masa la cantină</h2>
                  {(() => {
                    const m = echipa.find(e => e.id === userLogat.id);
                    const mananca = m?.[`cantina_${ziKey}`];
                    const statusAzi = m?.[`status_${ziKey}`];
                    
                    // Condiție: Mâncare doar dacă statusul este "Prezent la serviciu"
                    const poateManca = statusAzi === "Prezent la serviciu";

                    return (
                      <button 
                        onClick={() => poateManca && toggleCantina(userLogat.id, mananca)} 
                        disabled={!poateManca}
                        className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all ${!poateManca ? 'opacity-30 bg-slate-950 border-slate-800 cursor-not-allowed' : mananca ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="flex items-center gap-4">
                          <Utensils />
                          <span className="font-black uppercase text-sm">
                            {!poateManca ? `Indisponibil (${statusAzi || 'Nespecificat'})` : mananca ? "LA CANTINĂ" : "ACASĂ"}
                          </span>
                        </div>
                        {poateManca ? (mananca ? <Check size={24} strokeWidth={4}/> : <X size={24} />) : <AlertTriangle size={20}/>}
                      </button>
                    );
                  })()}
                  <p className="text-[9px] text-center mt-4 uppercase font-bold opacity-40">Poți lua masa doar dacă statusul tău este "Prezent la serviciu"</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default App;