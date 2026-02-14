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
  "Prezent la serviciu": { color: "bg-green-600", icon: <Activity size={20} /> },
  "În serviciu": { color: "bg-blue-600", icon: <Briefcase size={20} /> },
  "După serviciu": { color: "bg-slate-500", icon: <Coffee size={20} /> },
  "Zi liberă": { color: "bg-yellow-600", icon: <Home size={20} /> },
  "Concediu": { color: "bg-purple-600", icon: <MapPin size={20} /> },
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

  const optiuniZile = [
    { label: 'Azi', data: new Date(), key: format(new Date(), 'yyyyMMdd') },
    { label: 'Mâine', data: addDays(new Date(), 1), key: format(addDays(new Date(), 1), 'yyyyMMdd') },
    { label: 'Poimâine', data: addDays(new Date(), 2), key: format(addDays(new Date(), 2), 'yyyyMMdd') }
  ];

  // 1. EFECT PENTRU VERIFICARE SESIUNE LA PORNIRE (REȚINERE LOGARE)
  useEffect(() => {
    const sesiuneSalvata = localStorage.getItem('userEfectiv');
    if (sesiuneSalvata) {
      const user = JSON.parse(sesiuneSalvata);
      setUserLogat(user);
      setPaginaCurenta(user.rol === 'admin' ? 'lista' : 'personal');
    }
  }, []);

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dateEchipa = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEchipa(dateEchipa);
      
      // Actualizăm datele userului logat dacă se schimbă în baza de date (ex: numele sau gradul)
      if (userLogat && userLogat.rol !== 'admin') {
        const dateNoi = dateEchipa.find(m => m.id === userLogat.id);
        if (dateNoi) {
          const userActualizat = { ...dateNoi, rol: 'user' };
          setUserLogat(userActualizat);
          localStorage.setItem('userEfectiv', JSON.stringify(userActualizat));
        }
      }
    });
    return () => unsubscribe();
  }, [userLogat?.id]);

  const login = (cod) => {
    setEroareLogin(false);
    if (cod === "0000") {
      const adminUser = { rol: 'admin', nume: 'Administrator' };
      setUserLogat(adminUser);
      localStorage.setItem('userEfectiv', JSON.stringify(adminUser));
      setPaginaCurenta('lista');
      return;
    }
    const gasit = echipa.find(m => String(m.cod) === String(cod));
    if (gasit) {
      const userNormal = { ...gasit, rol: 'user' };
      setUserLogat(userNormal);
      localStorage.setItem('userEfectiv', JSON.stringify(userNormal));
      setPaginaCurenta('personal');
    } else {
      setEroareLogin(true);
      setInputCod("");
    }
  };

  const logout = () => {
    localStorage.removeItem('userEfectiv');
    setUserLogat(null);
    setPaginaCurenta('login');
    setInputCod("");
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
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase mb-2 tracking-tighter text-white">Acces Sistem</h1>
          <p className="text-slate-400 text-xs font-bold uppercase mb-8">Introdu codul de 4 cifre</p>
          
          <div className="space-y-4">
            <input 
              type="password" 
              maxLength="4"
              value={inputCod}
              onChange={(e) => setInputCod(e.target.value)}
              className={`w-full bg-slate-950 border-2 p-5 rounded-2xl text-center text-4xl tracking-[0.5em] focus:border-blue-500 outline-none transition-all text-white ${eroareLogin ? 'border-red-500 animate-shake' : 'border-slate-800'}`}
              autoFocus
            />
            {eroareLogin && <p className="text-red-500 text-xs font-black uppercase flex items-center justify-center gap-2"><AlertCircle size={14}/> Cod incorect</p>}
            
            <button 
              onClick={() => login(inputCod)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase tracking-widest text-lg shadow-lg active:scale-95 transition-all text-white"
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
          <div className="flex items-center gap-4 text-white">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>
              <p className="text-xs font-black text-blue-400 uppercase leading-none mb-1">{userLogat?.rol === 'admin' ? 'ADMINISTRATOR' : userLogat?.grad}</p>
              <h1 className="text-lg font-black uppercase tracking-tight text-white">{userLogat?.nume}</h1>
            </div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={24}/>
          </button>
        </div>

        {/* NAVIGARE ZILE */}
        <div className="flex justify-center gap-2 mb-8">
          {optiuniZile.map((zi, index) => (
            <button 
              key={zi.key} 
              onClick={() => setZiSelectata(index)} 
              className={`flex-1 py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-400'}`}
            >
              <p className="text-xs font-black uppercase mb-0.5">{zi.label}</p>
              <p className="text-sm font-bold uppercase text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {/* --- INTERFAȚA ADMINISTRATOR --- */}
        {userLogat?.rol === 'admin' && (
          <div className="space-y-6">
            <div className="flex bg-slate-900 p-2 rounded-2xl border border-slate-800 shadow-md">
              <button onClick={() => setPaginaCurenta('lista')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${paginaCurenta === 'lista' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><List size={14}/> LISTĂ</button>
              <button onClick={() => setPaginaCurenta('cantina')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${paginaCurenta === 'cantina' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}><Utensils size={14}/> MASĂ</button>
              <button onClick={() => setPaginaCurenta('categorii')} className={`flex-1 py-3 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${paginaCurenta === 'categorii' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><LayoutDashboard size={14}/> SUMAR</button>
            </div>
            
            {paginaCurenta === 'lista' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in">
                {echipa.map(m => {
                  const status = getStatusMembru(m);
                  return (
                    <div key={m.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center shadow-lg">
                      <div className="text-white">
                        <p className="text-[10px] text-blue-400 font-black uppercase mb-1">{m.grad}</p>
                        <p className="font-black text-base uppercase text-white">{m.nume}</p>
                      </div>
                      <span className={`text-[10px] font-black px-3 py-2 rounded-lg border border-white/10 text-white ${statusConfig[status]?.color || 'bg-slate-800'}`}>
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl animate-in zoom-in">
                 <div className="flex justify-between items-center mb-8 pb-4 border-b border-slate-800 text-white">
                    <div>
                      <h2 className="text-lg font-black uppercase text-orange-500">Comandă Cantină</h2>
                      <p className="text-xs text-slate-400 font-bold uppercase">{optiuniZile[ziSelectata].label}</p>
                    </div>
                    <div className="bg-orange-600 px-6 py-2 rounded-full text-sm font-black text-white shadow-lg">{totalLaCantina} PERSOANE</div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                   {echipa.map(m => {
                     const bifat = esteLaCantina(m);
                     return (
                       <button key={m.id} onClick={() => toggleCantina(m.id, bifat)} className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all ${bifat ? 'bg-orange-600 border-orange-400 text-white' : 'bg-slate-950 border-slate-800 text-white'}`}>
                         <div className="text-left">
                           <p className="text-[9px] font-black uppercase opacity-70 text-white">{m.grad}</p>
                           <p className="text-xs font-black uppercase text-white">{m.nume}</p>
                         </div>
                         {bifat ? <Check size={18} strokeWidth={4}/> : <div className="w-5 h-5 border-2 border-slate-800 rounded-full"/>}
                       </button>
                     );
                   })}
                 </div>
              </div>
            )}

            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in">
                {Object.entries(categorii).map(([nume, oameni]) => (
                  <div key={nume} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-md">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                      <span className="text-xs font-black uppercase text-white">{nume}</span>
                      <span className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black text-white">{oameni.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {oameni.map(o => <span key={o.id} className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-[10px] font-bold text-white uppercase">{o.nume}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- INTERFAȚA PERSONALĂ (USER) --- */}
        {userLogat?.rol === 'user' && (
          <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-center text-xs font-black uppercase tracking-widest text-blue-400 mb-6 italic">Status Prezență {optiuniZile[ziSelectata].label}</h2>
              <div className="grid grid-cols-1 gap-3">
                {Object.keys(statusConfig).map(st => {
                  const activ = getStatusMembru(userLogat) === st;
                  return (
                    <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white scale-[1.02] shadow-lg font-black' : 'bg-slate-950 border-slate-700 text-white'}`}>
                      <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800 text-white'}`}>{statusConfig[st].icon}</div>
                      <span className="text-sm uppercase tracking-tight">{st}</span>
                      {activ && <Check size={24} className="ml-auto" strokeWidth={4} />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-orange-600/10 border-2 border-orange-500/30 p-6 rounded-[2.5rem] shadow-2xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-orange-600 p-3 rounded-2xl text-white shadow-lg shadow-orange-600/20"><Utensils size={28} /></div>
                <div>
                  <h2 className="text-lg font-black uppercase text-white">Masa la Cantină</h2>
                  <p className="text-xs text-orange-400 font-bold uppercase tracking-widest">{optiuniZile[ziSelectata].label}</p>
                </div>
              </div>
              <button 
                onClick={() => toggleCantina(userLogat.id, esteLaCantina(userLogat))}
                className={`w-full py-8 rounded-2xl border-4 font-black uppercase text-lg transition-all flex items-center justify-center gap-4 ${esteLaCantina(userLogat) ? 'bg-orange-600 border-orange-400 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-white'}`}
              >
                {esteLaCantina(userLogat) ? <Check size={28} strokeWidth={4}/> : <div className="w-7 h-7 border-2 border-slate-700 rounded-full"/>}
                {esteLaCantina(userLogat) ? 'ÎNSCRIS LA MASĂ' : 'NU IAU MASA'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;