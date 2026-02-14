import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { 
  Clock, Briefcase, Activity, Coffee, Home, MapPin, 
  Stethoscope, List, LayoutDashboard, CalendarDays, 
  Utensils, Check 
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
  const [paginaCurenta, setPaginaCurenta] = useState('lista');
  const [ziSelectata, setZiSelectata] = useState(0); 

  const optiuniZile = [
    { label: 'Azi', data: new Date(), key: format(new Date(), 'yyyyMMdd') },
    { label: 'Mâine', data: addDays(new Date(), 1), key: format(addDays(new Date(), 1), 'yyyyMMdd') },
    { label: 'Poimâine', data: addDays(new Date(), 2), key: format(addDays(new Date(), 2), 'yyyyMMdd') }
  ];

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dateEchipa = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEchipa(dateEchipa);
    });
    return () => unsubscribe();
  }, []);

  const schimbaStatus = async (id, nouStatus) => {
    try {
      const userRef = doc(db, "echipa", id);
      const ziKey = optiuniZile[ziSelectata].key;
      await updateDoc(userRef, { [`status_${ziKey}`]: nouStatus });
    } catch (error) {
      console.error("Eroare status:", error);
    }
  };

  const toggleCantina = async (membru) => {
    try {
      const userRef = doc(db, "echipa", membru.id);
      const ziKey = optiuniZile[ziSelectata].key;
      const campCantina = `cantina_${ziKey}`;
      await updateDoc(userRef, { [campCantina]: !membru[campCantina] });
    } catch (error) {
      console.error("Eroare cantină:", error);
    }
  };

  const getStatusMembru = (membru) => {
    const ziKey = optiuniZile[ziSelectata].key;
    return membru[`status_${ziKey}`] || "Nespecificat";
  };

  const esteLaCantina = (membru) => {
    const ziKey = optiuniZile[ziSelectata].key;
    return membru[`cantina_${ziKey}`] || false;
  };

  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m) === status);
    return acc;
  }, {});

  const totalLaCantina = echipa.filter(m => esteLaCantina(m)).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* NAVIGARE ZILE */}
        <div className="flex justify-center gap-3 mb-8">
          {optiuniZile.map((zi, index) => (
            <button 
              key={zi.key} 
              onClick={() => {
                setZiSelectata(index);
                if (index !== 1 && paginaCurenta === 'cantina') setPaginaCurenta('lista');
              }} 
              className={`flex flex-col items-center px-6 py-3 rounded-2xl transition-all border-2 ${
                ziSelectata === index 
                ? 'bg-blue-700 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.2)] scale-105' 
                : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-widest">{zi.label}</span>
              <span className="text-sm font-bold">{format(zi.data, 'dd MMM', { locale: ro })}</span>
            </button>
          ))}
        </div>

        {/* HEADER CU BUTOANE NAVIGARE PAGINI */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <CalendarDays size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">
                {format(optiuniZile[ziSelectata].data, 'EEEE, dd MMMM', { locale: ro })}
              </h1>
              <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.2em]">Sistem Monitorizare Efectiv</p>
            </div>
          </div>
          
          <div className="flex bg-slate-950 p-1.5 rounded-xl mt-4 md:mt-0 border border-slate-800">
            <button onClick={() => setPaginaCurenta('lista')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black transition-all ${paginaCurenta === 'lista' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-400'}`}><List size={14}/> LISTĂ</button>
            
            {/* Butonul MASĂ apare doar dacă e selectat tab-ul de MÂINE (index 1) */}
            {ziSelectata === 1 && (
              <button onClick={() => setPaginaCurenta('cantina')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black transition-all ${paginaCurenta === 'cantina' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400'}`}><Utensils size={14}/> MASĂ</button>
            )}

            <button onClick={() => setPaginaCurenta('categorii')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-[10px] font-black transition-all ${paginaCurenta === 'categorii' ? 'bg-blue-700 text-white shadow-md' : 'text-slate-400'}`}><LayoutDashboard size={14}/> SUMAR</button>
          </div>
        </div>

        {/* --- PAGINA 1: LISTĂ --- */}
        {paginaCurenta === 'lista' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
            {echipa.map((m) => {
              const statusActual = getStatusMembru(m);
              return (
                <div key={m.id} className="bg-slate-900 rounded-[2.5rem] p-7 border border-slate-800 hover:border-blue-500/50 transition-all shadow-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-blue-900/40 rounded-2xl flex items-center justify-center font-black text-blue-400 border border-blue-500/30 text-lg shadow-inner">{m.ordine}</div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none mb-1">{m.grad}</span>
                      <h3 className="font-black text-lg text-white tracking-tight leading-tight uppercase">{m.nume}</h3>
                    </div>
                  </div>

                  <div className={`py-4 rounded-2xl mb-6 text-center font-black uppercase text-xs flex items-center justify-center gap-3 shadow-lg border border-white/10 ${statusConfig[statusActual]?.color || 'bg-slate-800 text-slate-300'}`}>
                    <span className="drop-shadow-md">{statusConfig[statusActual]?.icon}</span>
                    <span className="text-white drop-shadow-md">{statusActual}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {Object.keys(statusConfig).map(st => (
                      <button 
                        key={st} 
                        onClick={() => schimbaStatus(m.id, st)}
                        className={`text-[9px] py-3 rounded-xl border-2 font-black uppercase transition-all active:scale-95 ${statusActual === st ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700 hover:border-slate-500'}`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* --- PAGINA 2: CANTINĂ (Grad + Nume Complet) --- */}
        {paginaCurenta === 'cantina' && ziSelectata === 1 && (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl animate-in zoom-in duration-300">
            <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-600/20 rounded-2xl flex items-center justify-center text-orange-500 border border-orange-500/30">
                  <Utensils size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-widest text-white">Comandă Cantină Mâine</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase italic">Bifați personalul care servește masa</p>
                </div>
              </div>
              <div className="bg-orange-600 px-6 py-2 rounded-full border border-orange-400 shadow-lg flex items-center gap-3">
                <span className="text-xl font-black text-white">{totalLaCantina}</span>
                <span className="text-xs font-black text-orange-100 uppercase tracking-tighter">Persoane</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {echipa.map((m) => {
                const bifat = esteLaCantina(m);
                return (
                  <button 
                    key={`c-${m.id}`} 
                    onClick={() => toggleCantina(m)} 
                    className={`flex items-center justify-between px-6 py-5 rounded-2xl border-2 transition-all active:scale-95 ${
                      bifat 
                      ? 'bg-orange-600 border-orange-400 text-white shadow-lg shadow-orange-900/40' 
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-600 shadow-inner'
                    }`}
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className={`text-[10px] font-black uppercase tracking-wider mb-1 ${bifat ? 'text-orange-200' : 'text-slate-500'}`}>
                        {m.grad || ""}
                      </span>
                      <span className="text-sm font-black uppercase tracking-tight">
                        {m.nume}
                      </span>
                    </div>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                      bifat ? 'bg-white border-white text-orange-600 shadow-md' : 'border-slate-700'
                    }`}>
                      {bifat && <Check size={18} strokeWidth={4} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* --- PAGINA 3: SUMAR --- */}
        {paginaCurenta === 'categorii' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            {Object.entries(categorii).map(([nume, oameni]) => (
              <div key={nume} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl">
                <div className="flex justify-between items-center mb-5 border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shadow-lg border border-white/10 ${statusConfig[nume].color}`}>
                      {statusConfig[nume].icon}
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-white">{nume}</span>
                  </div>
                  <span className="text-xs font-black text-white bg-blue-700 px-4 py-1 rounded-full border border-blue-400">{oameni.length}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {oameni.map(o => (
                    <span key={o.id} className="bg-slate-950 px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-800 text-white shadow-sm">
                      {o.nume}
                    </span>
                  ))}
                  {oameni.length === 0 && <span className="text-xs text-slate-500 italic px-2">Nicio persoană înregistrată</span>}
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