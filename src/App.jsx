import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Activity, Briefcase, Coffee, Home, MapPin, Stethoscope, List, LayoutDashboard, CalendarDays, Utensils, Check, Lock, LogOut } from 'lucide-react';

const statusConfig = {
  "Prezent la serviciu": { color: "bg-green-600", icon: <Activity size={18} /> },
  "În serviciu": { color: "bg-blue-600", icon: <Briefcase size={18} /> },
  "După serviciu": { color: "bg-slate-500", icon: <Coffee size={18} /> },
  "Zi liberă": { color: "bg-yellow-600", icon: <Home size={18} /> },
  "Concediu": { color: "bg-purple-600", icon: <MapPin size={18} /> },
  "Deplasare": { color: "bg-orange-600", icon: <MapPin size={18} /> },
  "Foaie de boala": { color: "bg-red-600", icon: <Stethoscope size={18} /> },
};

function App() {
  const [echipa, setEchipa] = useState([]);
  const [paginaCurenta, setPaginaCurenta] = useState('login');
  const [ziSelectata, setZiSelectata] = useState(0); 
  const [userLogat, setUserLogat] = useState(null);

  const optiuniZile = [
    { label: 'Azi', data: new Date(), key: format(new Date(), 'yyyyMMdd') },
    { label: 'Mâine', data: addDays(new Date(), 1), key: format(addDays(new Date(), 1), 'yyyyMMdd') },
    { label: 'Poimâine', data: addDays(new Date(), 2), key: format(addDays(new Date(), 2), 'yyyyMMdd') }
  ];

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dateEchipa = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEchipa(dateEchipa);
      
      // Actualizăm datele userului logat dacă se schimbă în baza de date
      if (userLogat && userLogat.rol !== 'admin') {
        const dateNoi = dateEchipa.find(m => m.id === userLogat.id);
        if (dateNoi) setUserLogat({ ...dateNoi, rol: 'user' });
      }
    });
    return () => unsubscribe();
  }, [userLogat?.id]);

  const login = (cod) => {
    if (cod === "0000") { // COD PENTRU ADMIN
      setUserLogat({ rol: 'admin', nume: 'Administrator' });
      setPaginaCurenta('lista');
      return;
    }
    const gasit = echipa.find(m => m.cod === cod);
    if (gasit) {
      setUserLogat({ ...gasit, rol: 'user' });
      setPaginaCurenta('personal');
    }
  };

  const schimbaStatus = async (id, nouStatus) => {
    const userRef = doc(db, "echipa", id);
    const ziKey = optiuniZile[ziSelectata].key;
    await updateDoc(userRef, { [`status_${ziKey}`]: nouStatus });
  };

  const toggleCantina = async (id, stareActuala) => {
    const userRef = doc(db, "echipa", id);
    const ziKey = optiuniZile[ziSelectata].key;
    await updateDoc(userRef, { [`cantina_${ziKey}`]: !stareActuala });
  };

  const getStatusMembru = (membru) => {
    const ziKey = optiuniZile[ziSelectata].key;
    return membru[`status_${ziKey}`] || "Nespecificat";
  };

  const esteLaCantina = (membru) => {
    const ziKey = optiuniZile[ziSelectata].key;
    return membru[`cantina_${ziKey}`] || false;
  };

  // ECRAN LOGIN
  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center animate-in fade-in zoom-in">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-xl font-black uppercase mb-8 tracking-tighter">Acces Personal</h1>
          <input 
            type="password" 
            placeholder="****"
            maxLength="4"
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-3xl tracking-[0.5em] focus:border-blue-500 outline-none"
            onChange={(e) => { if(e.target.value.length === 4) login(e.target.value); }}
            autoFocus
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl"><CalendarDays size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase">{userLogat?.rol === 'admin' ? 'Panou Control' : userLogat?.grad}</p>
              <h1 className="text-sm font-black uppercase">{userLogat?.nume}</h1>
            </div>
          </div>
          <button onClick={() => { setUserLogat(null); setPaginaCurenta('login'); }} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><LogOut size={20}/></button>
        </div>

        {/* NAVIGARE ZILE */}
        <div className="flex justify-center gap-2 mb-8">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => setZiSelectata(index)} className={`flex-1 py-3 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
              <p className="text-[9px] font-black uppercase">{zi.label}</p>
              <p className="text-xs font-bold">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {/* --- VEDERE ADMIN: TOATĂ LISTA --- */}
        {userLogat?.rol === 'admin' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-6">
              <button onClick={() => setPaginaCurenta('lista')} className={`flex-1 py-3 rounded-xl font-black text-[10px] ${paginaCurenta === 'lista' ? 'bg-blue-600' : 'bg-slate-900'}`}>LISTĂ PREZENȚĂ</button>
              <button onClick={() => setPaginaCurenta('categorii')} className={`flex-1 py-3 rounded-xl font-black text-[10px] ${paginaCurenta === 'categorii' ? 'bg-blue-600' : 'bg-slate-900'}`}>SUMAR CATEGORII</button>
            </div>
            
            {paginaCurenta === 'lista' && echipa.map(m => (
              <div key={m.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase">{m.grad}</p>
                  <p className="font-black text-sm uppercase">{m.nume}</p>
                </div>
                <div className="flex items-center gap-3">
                   <span className="text-[10px] font-bold px-3 py-1 bg-slate-800 rounded-lg">{getStatusMembru(m)}</span>
                   {esteLaCantina(m) && <Utensils size={14} className="text-orange-500" />}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- VEDERE PERSONALĂ: DOAR PENTRU USERUL LOGAT --- */}
        {userLogat?.rol === 'user' && (
          <div className="animate-in slide-in-from-bottom duration-500">
            {/* 1. SECȚIUNEA UNDE EȘTI (STATUS) */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 mb-6 shadow-xl">
              <h2 className="text-center text-[10px] font-black uppercase tracking-widest text-blue-400 mb-6 italic">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
              <div className="grid grid-cols-1 gap-2">
                {Object.keys(statusConfig).map(st => {
                  const activ = getStatusMembru(userLogat) === st;
                  return (
                    <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-lg scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                      <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-900'}`}>{statusConfig[st].icon}</div>
                      <span className="text-xs font-black uppercase tracking-tight">{st}</span>
                      {activ && <Check size={18} className="ml-auto" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. SECȚIUNEA CANTINĂ (DOAR PENTRU MÂINE) */}
            {ziSelectata === 1 && (
              <div className="bg-orange-600/10 border-2 border-orange-500/20 p-6 rounded-[2.5rem] shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-600/20"><Utensils size={24} /></div>
                  <div>
                    <h2 className="text-sm font-black uppercase text-white">Masa la Cantină</h2>
                    <p className="text-[10px] text-orange-500/70 font-bold uppercase">Pentru ziua de mâine</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleCantina(userLogat.id, esteLaCantina(userLogat))}
                  className={`w-full py-6 rounded-2xl border-2 font-black uppercase transition-all flex items-center justify-center gap-3 ${esteLaCantina(userLogat) ? 'bg-orange-600 border-orange-400 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                >
                  {esteLaCantina(userLogat) ? <Check size={20} strokeWidth={4}/> : null}
                  {esteLaCantina(userLogat) ? 'SUNT ÎNSCRIS LA MASĂ' : 'NU IAU MASA MÂINE'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;