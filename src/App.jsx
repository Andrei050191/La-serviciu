import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { 
  Activity, Briefcase, Coffee, Home, MapPin, 
  Stethoscope, List, LayoutDashboard, CalendarDays, 
  Utensils, Check, Lock, LogOut, AlertCircle 
} from 'lucide-react';

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
  const [inputCod, setInputCod] = useState("");
  const [eroareLogin, setEroareLogin] = useState(false);

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
      
      if (userLogat && userLogat.rol !== 'admin') {
        const dateNoi = dateEchipa.find(m => m.id === userLogat.id);
        if (dateNoi) setUserLogat({ ...dateNoi, rol: 'user' });
      }
    });
    return () => unsubscribe();
  }, [userLogat?.id]);

  const login = (cod) => {
    setEroareLogin(false);
    if (cod === "0000") {
      setUserLogat({ rol: 'admin', nume: 'Administrator' });
      setPaginaCurenta('lista');
      return;
    }
    const gasit = echipa.find(m => m.cod === cod);
    if (gasit) {
      setUserLogat({ ...gasit, rol: 'user' });
      setPaginaCurenta('personal');
    } else {
      setEroareLogin(true);
      setInputCod("");
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

  const totalLaCantina = echipa.filter(m => esteLaCantina(m)).length;

  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m) === status);
    return acc;
  }, {});

  // ECRAN LOGIN
  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 md:p-10 rounded-[3rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center animate-in fade-in zoom-in">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20 text-white">
            <Lock size={32} />
          </div>
          <h1 className="text-xl font-black uppercase mb-2 tracking-tighter">Acces Sistem</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase mb-8">Introdu codul tău personal</p>
          
          <div className="space-y-4">
            <input 
              type="password" 
              placeholder="****"
              maxLength="4"
              value={inputCod}
              onChange={(e) => setInputCod(e.target.value)}
              className={`w-full bg-slate-950 border-2 p-5 rounded-2xl text-center text-3xl tracking-[0.5em] focus:border-blue-500 outline-none transition-all ${eroareLogin ? 'border-red-500 animate-pulse' : 'border-slate-800'}`}
              autoFocus
            />
            {eroareLogin && <p className="text-red-500 text-[10px] font-black uppercase flex items-center justify-center gap-1"><AlertCircle size={12}/> Cod incorect</p>}
            
            <button 
              onClick={() => login(inputCod)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-blue-600/20 transition-all active:scale-95"
            >
              Autentificare
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl shadow-lg shadow-blue-500/20"><CalendarDays size={20} /></div>
            <div>
              <p className="text-[10px] font-black text-blue-400 uppercase leading-none mb-1">{userLogat?.rol === 'admin' ? 'Panou Administrator' : userLogat?.grad || 'Personal'}</p>
              <h1 className="text-sm font-black uppercase tracking-tight">{userLogat?.nume}</h1>
            </div>
          </div>
          <button 
            onClick={() => { setUserLogat(null); setPaginaCurenta('login'); setInputCod(""); }} 
            className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
          >
            <LogOut size={20}/>
          </button>
        </div>

        {/* NAVIGARE ZILE */}
        <div className="flex justify-center gap-2 mb-8">
          {optiuniZile.map((zi, index) => (
            <button 
              key={zi.key} 
              onClick={() => setZiSelectata(index)} 
              className={`flex-1 py-3 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
            >
              <p className="text-[9px] font-black uppercase mb-0.5">{zi.label}</p>
              <p className="text-xs font-bold uppercase">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {/* --- INTERFAȚA ADMIN --- */}
        {userLogat?.rol === 'admin' && (
          <div className="space-y-6">
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
              <button onClick={() => setPaginaCurenta('lista')} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${paginaCurenta === 'lista' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>LISTĂ PREZENȚĂ</button>
              <button onClick={() => setPaginaCurenta('cantina')} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${paginaCurenta === 'cantina' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>CANTINĂ</button>
              <button onClick={() => setPaginaCurenta('categorii')} className={`flex-1 py-3 rounded-xl font-black text-[10px] transition-all ${paginaCurenta === 'categorii' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>SUMAR</button>
            </div>
            
            {/* Admin: Lista Prezență */}
            {paginaCurenta === 'lista' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in">
                {echipa.map(m => {
                  const status = getStatusMembru(m);
                  return (
                    <div key={m.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center shadow-md">
                      <div>
                        <p className="text-[9px] text-blue-500 font-bold uppercase mb-1">{m.grad}</p>
                        <p className="font-black text-sm uppercase">{m.nume}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg border border-white/5 ${statusConfig[status]?.color || 'bg-slate-800 text-slate-400'}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Admin: Cantină (Toți) */}
            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 animate-in zoom-in">
                 <div className="flex justify-between items-center mb-6">
                    <h2 className="text-sm font-black uppercase text-orange-500">Masa la Cantină {optiuniZile[ziSelectata].label}</h2>
                    <div className="bg-orange-600 px-4 py-1 rounded-full text-[10px] font-black">{totalLaCantina} PERS</div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {echipa.map(m => {
                     const bifat = esteLaCantina(m);
                     return (
                       <button key={m.id} onClick={() => toggleCantina(m.id, bifat)} className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all ${bifat ? 'bg-orange-600 border-orange-400' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                         <span className="text-[10px] font-black uppercase">{m.nume}</span>
                         {bifat && <Check size={14} strokeWidth={4}/>}
                       </button>
                     );
                   })}
                 </div>
              </div>
            )}

            {/* Admin: Sumar Categorii */}
            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                {Object.entries(categorii).map(([nume, oameni]) => (
                  <div key={nume} className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                    <div className="flex justify-between mb-4">
                      <span className="text-[10px] font-black uppercase text-white">{nume}</span>
                      <span className="text-[10px] font-black text-blue-400">{oameni.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                      {oameni.map(o => <span key={o.id} className="bg-slate-950 px-2 py-1 rounded border border-slate-800">{o.nume}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- INTERFAȚA PERSONALĂ (USER) --- */}
        {userLogat?.rol === 'user' && (
          <div className="animate-in slide-in-from-bottom duration-500 space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 italic">Status Prezență {optiuniZile[ziSelectata].label}</h2>
              <div className="grid grid-cols-1 gap-3">
                {Object.keys(statusConfig).map(st => {
                  const activ = getStatusMembru(userLogat) === st;
                  return (
                    <button 
                      key={st} 
                      onClick={() => schimbaStatus(userLogat.id, st)} 
                      className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                    >
                      <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-900'}`}>{statusConfig[st].icon}</div>
                      <span className="text-xs font-black uppercase tracking-tight">{st}</span>
                      {activ && <Check size={20} className="ml-auto" strokeWidth={4} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {ziSelectata === 1 && (
              <div className="bg-orange-600/10 border-2 border-orange-500/20 p-6 rounded-[2.5rem] shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-orange-600 p-3 rounded-2xl shadow-lg shadow-orange-600/20 text-white"><Utensils size={24} /></div>
                  <div>
                    <h2 className="text-sm font-black uppercase text-white">Servirea Mesei</h2>
                    <p className="text-[10px] text-orange-500 font-bold uppercase tracking-widest">Opțiune pentru Mâine</p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleCantina(userLogat.id, esteLaCantina(userLogat))}
                  className={`w-full py-7 rounded-2xl border-2 font-black uppercase transition-all flex items-center justify-center gap-3 ${esteLaCantina(userLogat) ? 'bg-orange-600 border-orange-400 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
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