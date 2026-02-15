import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { 
  Activity, Briefcase, Umbrella, Coffee, Home, MapPin, 
  Stethoscope, List, LayoutDashboard, CalendarDays, 
  Utensils, Check, Lock, LogOut, AlertCircle, ChevronDown, ChevronUp, Shield, Send
} from 'lucide-react';

import ServiciiPage from './ServiciiPage';

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

  // STATE-URI PENTRU INDICATII
  const [indicatii, setIndicatii] = useState("");
  const [editIndicatii, setEditIndicatii] = useState(false);
  const [mesajNou, setMesajNou] = useState(false);

  const vibreaza = (ms = 50) => {
    if (navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const optiuniZile = [
    { label: 'Azi', data: new Date(), key: format(new Date(), 'yyyyMMdd') },
    { label: 'Mâine', data: addDays(new Date(), 1), key: format(addDays(new Date(), 1), 'yyyyMMdd') }
  ];

  const formatGrad = (grad) => {
    if (!grad) return "";
    let text = grad.toLowerCase();
    return text.replace(/\b(iii|ii|i|iv|v|vi)\b/g, (match) => match.toUpperCase());
  };

  const renderIdentitate = (m) => {
    if (!m) return null;
    const prenumeEditat = m.prenume ? (m.prenume.charAt(0).toUpperCase() + m.prenume.slice(1).toLowerCase()) : "";
    const numeEditat = m.nume ? m.nume.toUpperCase() : "";
    return (
      <div className="flex flex-col text-left">
        <span className="text-[10px] font-medium text-white/70 leading-none mb-1">{formatGrad(m.grad)}</span>
        <span className="text-sm font-black text-white">
          {prenumeEditat} <span className="uppercase">{numeEditat}</span>
        </span>
      </div>
    );
  };

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
      if (userLogat && userLogat.rol !== 'admin') {
        const actualizat = dateEchipa.find(u => u.id === userLogat.id);
        if (actualizat) setUserLogat({...actualizat, rol: 'user'});
      }
    });
    return () => unsubscribe();
  }, [userLogat?.id]);

  // ASCULTARE INDICATII IN TIMP REAL
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "indicatii"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIndicatii(data.text);
        // Alertă vizuală la schimbare text
        setMesajNou(true);
        setTimeout(() => setMesajNou(false), 8000); 
      }
    });
    return () => unsub();
  }, []);

  const login = (cod) => {
    vibreaza(60);
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
      vibreaza([50, 50, 50]);
      setEroareLogin(true);
      setInputCod("");
    }
  };

  const logout = () => {
    vibreaza(40);
    localStorage.removeItem('userEfectiv');
    setUserLogat(null);
    setPaginaCurenta('login');
    setInputCod("");
  };

  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(70);
    const userRef = doc(db, "echipa", id);
    const ziKey = optiuniZile[ziSelectata].key;
    await updateDoc(userRef, { [`status_${ziKey}`]: nouStatus });
    setMembruEditat(null);
  };

  const toggleCantina = async (id, stareActuala) => {
    vibreaza(100);
    const userRef = doc(db, "echipa", id);
    const ziKey = optiuniZile[ziSelectata].key;
    await updateDoc(userRef, { [`cantina_${ziKey}`]: !stareActuala });
  };

  const salveazaIndicatii = async () => {
    vibreaza(120);
    await setDoc(doc(db, "setari", "indicatii"), { 
      text: indicatii,
      ultimaActualizare: new Date().toISOString()
    });
    setEditIndicatii(false);
  };

  const getStatusMembru = (membru) => {
    if (!membru) return "Nespecificat";
    const ziKey = optiuniZile[ziSelectata].key;
    return membru[`status_${ziKey}`] || "Nespecificat";
  };

  const esteLaCantina = (membru) => {
    if (!membru) return false;
    const ziKey = optiuniZile[ziSelectata].key;
    return membru[`cantina_${ziKey}`] || false;
  };

  const totalLaCantina = echipa.filter(m => esteLaCantina(m)).length;

  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m) === status);
    return acc;
  }, {});

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-blue-600/30"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
          <input 
            type="password" maxLength="4" value={inputCod} onChange={(e) => setInputCod(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl tracking-[0.5em] focus:border-blue-500 outline-none mb-4 text-white"
            placeholder="****"
          />
          {eroareLogin && <p className="text-red-500 text-xs font-bold mb-4 uppercase">Cod incorect!</p>}
          <button onClick={() => login(inputCod)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-white shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Intră</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl text-white shadow-lg"><CalendarDays size={24} /></div>
            <div>
              {userLogat?.rol === 'admin' ? (
                <h1 className="text-lg font-black text-white uppercase tracking-widest">Administrator</h1>
              ) : renderIdentitate(userLogat)}
            </div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all active:scale-90"><LogOut size={24}/></button>
        </div>

        {/* NAVIGARE ZILE */}
        <div className="flex gap-2 mb-4">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => { vibreaza(30); setZiSelectata(index); }} 
              className={`flex-1 py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400 shadow-lg scale-[1.02]' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 text-white mb-1 tracking-widest">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {/* FEREASTRA INDICATII COMANDANT */}
        <div className={`mb-8 p-5 rounded-[2rem] border-2 transition-all duration-500 ${
          mesajNou ? 'border-red-500 bg-red-950/30 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'border-slate-800 bg-slate-900 shadow-xl'
        }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${mesajNou ? 'bg-red-500 animate-ping' : 'bg-blue-500'}`}></div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Indicații Comandant</span>
            </div>
            {userLogat?.rol === 'admin' && (
              <button 
                onClick={() => { vibreaza(20); setEditIndicatii(!editIndicatii); }}
                className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full transition-all ${editIndicatii ? 'bg-slate-800 text-white' : 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'}`}
              >
                {editIndicatii ? 'Anulează' : 'Modifică'}
              </button>
            )}
          </div>

          {editIndicatii ? (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
              <textarea 
                className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500 min-h-[100px] transition-all"
                value={indicatii}
                onChange={(e) => setIndicatii(e.target.value)}
                placeholder="Scrie aici ordinele pentru unitate..."
              />
              <button 
                onClick={salveazaIndicatii}
                className="w-full bg-blue-600 py-4 rounded-2xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-xl shadow-blue-600/20 active:scale-95 transition-all"
              >
                <Send size={16} /> Trimite la tot efectivul
              </button>
            </div>
          ) : (
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 min-h-[60px] flex items-center">
              <p className="text-sm font-bold text-white leading-relaxed italic w-full">
                {indicatii || "Nu sunt indicații noi pentru moment."}
              </p>
            </div>
          )}
        </div>

        {/* --- INTERFAȚA ADMINISTRATOR --- */}
        {userLogat?.rol === 'admin' && (
          <div className="space-y-6">
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-4 overflow-x-auto gap-1 shadow-inner">
              <button onClick={() => { vibreaza(20); setPaginaCurenta('lista'); }} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] whitespace-nowrap transition-all ${paginaCurenta === 'lista' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>LISTĂ</button>
              <button onClick={() => { vibreaza(20); setPaginaCurenta('servicii'); }} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] whitespace-nowrap transition-all ${paginaCurenta === 'servicii' ? 'bg-red-600 text-white shadow-md' : 'text-slate-500'}`}>SERVICIU</button>
              <button onClick={() => { vibreaza(20); setPaginaCurenta('cantina'); }} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] whitespace-nowrap transition-all ${paginaCurenta === 'cantina' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-500'}`}>MASĂ</button>
              <button onClick={() => { vibreaza(20); setPaginaCurenta('categorii'); }} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] whitespace-nowrap transition-all ${paginaCurenta === 'categorii' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500'}`}>SUMAR</button>
            </div>
            
            {paginaCurenta === 'lista' && (
              <div className="grid grid-cols-1 gap-3 animate-in fade-in duration-300">
                {echipa.map(m => {
                  const status = getStatusMembru(m);
                  const isEditing = membruEditat === m.id;
                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      <button onClick={() => { vibreaza(40); setMembruEditat(isEditing ? null : m.id); }}
                        className={`bg-slate-900 p-5 rounded-2xl border flex justify-between items-center transition-all ${isEditing ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xl' : 'border-slate-800'}`}>
                        {renderIdentitate(m)}
                        <div className="flex items-center gap-3">
                          <span className={`text-[9px] font-black px-3 py-2 rounded-lg text-white ${statusConfig[status]?.color || 'bg-slate-800'}`}>{status}</span>
                          {isEditing ? <ChevronUp size={20} className="text-blue-500" /> : <ChevronDown size={20} className="text-slate-600" />}
                        </div>
                      </button>
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl animate-in slide-in-from-top-2 shadow-inner">
                          {Object.keys(statusConfig).map(st => (
                            <button key={st} onClick={() => schimbaStatus(m.id, st)} className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase border border-slate-800 italic hover:bg-slate-800 transition-all">
                              {statusConfig[st].icon} {st}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} />}

            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl animate-in fade-in">
                 <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800 text-white">
                    <h2 className="text-lg font-black uppercase text-orange-500">Masa la cantină</h2>
                    <div className="bg-orange-600 px-5 py-2 rounded-full text-xs font-black text-white shadow-lg">{totalLaCantina} PERS.</div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {echipa.map(m => {
                     const bifat = esteLaCantina(m);
                     return (
                       <button key={m.id} onClick={() => toggleCantina(m.id, bifat)} 
                         className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all ${bifat ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                         {renderIdentitate(m)}
                         {bifat ? <Check size={18} strokeWidth={4}/> : <div className="w-5 h-5 border-2 border-slate-800 rounded-full"/>}
                       </button>
                     );
                   })}
                 </div>
              </div>
            )}

            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 gap-4 animate-in fade-in">
                {Object.entries(categorii).map(([numeCat, oameni]) => (
                  <div key={numeCat} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                    <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-800">
                      <div className="flex items-center gap-3 uppercase font-black text-white text-sm">
                         <div className={`p-2 rounded-lg ${statusConfig[numeCat]?.color}`}>{statusConfig[numeCat]?.icon}</div>
                         {numeCat}
                      </div>
                      <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-black text-white shadow-md">{oameni.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {oameni.map(o => (
                        <div key={o.id} className="bg-slate-950 p-3 rounded-xl border border-slate-700/50">
                          {renderIdentitate(o)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- INTERFAȚA PERSONALĂ (USER) --- */}
        {userLogat?.rol === 'user' && (
          <div className="space-y-6">
            
            {paginaCurenta === 'servicii_vizualizare' ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                <button 
                  onClick={() => { vibreaza(30); setPaginaCurenta('personal'); }}
                  className="mb-4 text-blue-400 font-black text-[10px] uppercase flex items-center gap-2 py-2 px-1"
                >
                  ← Înapoi la Statusul meu
                </button>
                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h2 className="text-center text-xs font-black uppercase text-red-500 mb-6 italic tracking-widest">
                    Registru Servicii (6 Zile)
                  </h2>
                  <ServiciiPage 
                    editabil={true} 
                    ziSelectata={null} 
                  />
                </div>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => { vibreaza(40); setPaginaCurenta('servicii_vizualizare'); }}
                  className="w-full bg-red-600/10 border-2 border-red-500/30 p-5 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all shadow-xl shadow-red-900/5"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-red-600 p-3 rounded-2xl text-white shadow-xl shadow-red-600/20"><Shield size={22} /></div>
                    <div className="text-left">
                      <span className="block font-black text-xs uppercase text-white tracking-tight">Vezi Serviciul de Zi</span>
                      <span className="text-[9px] text-red-400 font-black uppercase tracking-widest opacity-80">Registru Complet</span>
                    </div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-full">
                    <ChevronDown size={18} className="text-red-500 -rotate-90" />
                  </div>
                </button>

                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h2 className="text-center text-xs font-black uppercase text-blue-400 mb-6 italic tracking-tighter">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(statusConfig).map(st => {
                      const activ = getStatusMembru(userLogat) === st;
                      return (
                        <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all active:scale-95 ${activ ? 'bg-white text-black border-white scale-[1.02] font-black shadow-xl' : 'bg-slate-950 border-slate-800 text-white hover:border-slate-600'}`}>
                          <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                          <span className="text-sm uppercase font-black tracking-tight">{st}</span>
                          {activ && <Check size={24} className="ml-auto text-black" strokeWidth={4} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-orange-600/10 border-2 border-orange-500/30 p-6 rounded-[2.5rem] shadow-xl">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="bg-orange-600 p-3 rounded-2xl text-white shadow-xl shadow-orange-600/20"><Utensils size={28} /></div>
                    <div>
                      <h2 className="text-lg font-black uppercase text-white tracking-tighter leading-none">Masa la Cantină</h2>
                      <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest mt-1 opacity-80">{optiuniZile[ziSelectata].label}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleCantina(userLogat.id, esteLaCantina(userLogat))}
                    className={`w-full py-8 rounded-2xl border-4 font-black text-lg flex items-center justify-center gap-4 transition-all active:scale-95 ${esteLaCantina(userLogat) ? 'bg-orange-600 border-orange-400 text-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 text-white opacity-40'}`}>
                    {esteLaCantina(userLogat) ? <Check size={28} strokeWidth={4}/> : <div className="w-7 h-7 border-2 border-slate-800 rounded-full"/>}
                    {esteLaCantina(userLogat) ? 'ÎNSCRIS LA MASĂ' : 'NU IAU MASA'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default App;