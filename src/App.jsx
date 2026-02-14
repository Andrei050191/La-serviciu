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
    const gasit = echipa.find(m => m.cod === String(cod));
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

  // ECRAN LOGIN
  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase mb-2 tracking-tighter">Acces Sistem</h1>
          <p className="text-slate-400 text-xs font-bold uppercase mb-8">Introdu codul de 4 cifre</p>
          
          <div className="space-y-4">
            <input 
              type="password" 
              maxLength="4"
              value={inputCod}
              onChange={(e) => setInputCod(e.target.value)}
              className={`w-full bg-slate-950 border-2 p-5 rounded-2xl text-center text-4xl tracking-[0.5em] focus:border-blue-500 outline-none transition-all ${eroareLogin ? 'border-red-500' : 'border-slate-800'}`}
              autoFocus
            />
            {eroareLogin && <p className="text-red-500 text-xs font-black uppercase flex items-center justify-center gap-2"><AlertCircle size={14}/> Cod incorect</p>}
            
            <button 
              onClick={() => login(inputCod)}
              className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase tracking-widest text-lg shadow-lg active:scale-95 transition-all"
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
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>
              <p className="text-xs font-black text-blue-400 uppercase leading-none mb-1">{userLogat?.rol === 'admin' ? 'ADMINISTRATOR' : userLogat?.grad}</p>
              <h1 className="text-lg font-black uppercase tracking-tight">{userLogat?.nume}</h1>
            </div>
          </div>
          <button onClick={() => { setUserLogat(null); setPaginaCurenta('login'); setInputCod(""); }} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all">
            <LogOut size={24}/>
          </button>
        </div>

        {/* NAVIGARE ZILE - TEXT ALB SI MARE */}
        <div className="flex justify-center gap-2 mb-8">
          {optiuniZile.map((zi, index) => (
            <button 
              key={zi.key} 
              onClick={() => setZiSelectata(index)} 
              className={`flex-1 py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400' : 'bg-slate-900 border-slate-800'}`}
            >
              <p className={`text-xs font-black uppercase ${ziSelectata === index ? 'text-white' : 'text-slate-400'}`}>{zi.label}</p>
              <p className="text-sm font-bold text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {/* --- VEDERE PERSONALĂ (USER) --- */}
        {userLogat?.rol === 'user' && (
          <div className="space-y-6">
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
              <h2 className="text-center text-xs font-black uppercase tracking-widest text-blue-400 mb-6 italic">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
              <div className="grid grid-cols-1 gap-3">
                {Object.keys(statusConfig).map(st => {
                  const activ = getStatusMembru(userLogat) === st;
                  return (
                    <button 
                      key={st} 
                      onClick={() => schimbaStatus(userLogat.id, st)} 
                      className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white scale-[1.02]' : 'bg-slate-950 border-slate-700'}`}
                    >
                      <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800 text-white'}`}>{statusConfig[st].icon}</div>
                      <span className={`text-sm font-black uppercase tracking-tight ${activ ? 'text-black' : 'text-white'}`}>{st}</span>
                      {activ && <Check size={24} className="ml-auto" strokeWidth={4} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SECȚIUNEA CANTINĂ - ACTIVĂ PE TOATE ZILELE */}
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

        {/* --- VEDERE ADMIN: TOATĂ LISTA --- */}
        {userLogat?.rol === 'admin' && (
          <div className="space-y-4 animate-in fade-in">
             <div className="flex bg-slate-900 p-2 rounded-2xl border border-slate-800 mb-6">
                <button onClick={() => setPaginaCurenta('lista')} className={`flex-1 py-3 rounded-xl font-black text-xs ${paginaCurenta === 'lista' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>LISTĂ</button>
                <button onClick={() => setPaginaCurenta('categorii')} className={`flex-1 py-3 rounded-xl font-black text-xs ${paginaCurenta === 'categorii' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>SUMAR</button>
             </div>
             
             {paginaCurenta === 'lista' && echipa.map(m => (
              <div key={m.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 flex justify-between items-center shadow-lg">
                <div>
                  <p className="text-[10px] text-blue-400 font-black uppercase mb-1">{m.grad}</p>
                  <p className="font-black text-base text-white uppercase">{m.nume}</p>
                </div>
                <div className="flex items-center gap-4">
                   <span className={`text-[10px] font-black px-3 py-2 rounded-lg border border-white/10 ${statusConfig[getStatusMembru(m)]?.color || 'bg-slate-800 text-white'}`}>
                      {getStatusMembru(m)}
                   </span>
                   {esteLaCantina(m) && <div className="p-2 bg-orange-600 rounded-lg text-white shadow-md"><Utensils size={16} /></div>}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;