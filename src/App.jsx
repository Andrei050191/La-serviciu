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
  Shield, X, ExternalLink, AlertTriangle, Edit3, User
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
  const [indicatii, setIndicatii] = useState("");
  const [editIndicatii, setEditIndicatii] = useState(false);
  const [membruEditat, setMembruEditat] = useState(null);

  const vibreaza = (ms = 40) => { if (navigator.vibrate) navigator.vibrate(ms); };

  const formatNumeObiect = (m) => {
    if (!m) return { grad: "", prenume: "", nume: "" };
    const cifreRomane = ['I', 'II', 'III', 'IV', 'V'];
    
    const grad = String(m.grad || "").split(' ').map(p => {
      const curat = p.toUpperCase().trim();
      return cifreRomane.includes(curat) ? curat : p.toLowerCase();
    }).join(' ');

    const prenume = m.prenume ? (m.prenume.charAt(0).toUpperCase() + m.prenume.slice(1).toLowerCase()) : "";
    const nume = (m.nume || "").toUpperCase();

    return { grad, prenume, nume };
  };

  const NumeFormatat = ({ membru, clasaGrad = "text-slate-400", clasaText = "text-white" }) => {
    const { grad, prenume, nume } = formatNumeObiect(membru);
    return (
      <div className={`flex items-baseline gap-1.5 font-sans ${clasaText}`}>
        <span className={`text-[10px] font-medium ${clasaGrad}`}>{grad}</span>
        <span className="capitalize font-bold">{prenume}</span>
        <span className="uppercase font-black">{nume}</span>
      </div>
    );
  };

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
    const unsub = onSnapshot(q, (snapshot) => {
      setEchipa(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "indicatii"), (docSnap) => {
      if (docSnap.exists()) setIndicatii(docSnap.data().text);
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
    } else {
      const gasit = echipa.find(m => String(m.cod) === String(cod));
      if (gasit) {
        const u = { ...gasit, rol: 'user' };
        setUserLogat(u);
        localStorage.setItem('userEfectiv', JSON.stringify(u));
        setPaginaCurenta('personal');
      }
    }
  };

  const logout = () => { localStorage.removeItem('userEfectiv'); setUserLogat(null); setPaginaCurenta('login'); };

  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(50);
    const membru = echipa.find(m => m.id === id);
    const dataF = format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy');

    if (nouStatus === "În serviciu" && ziSelectata > 0) {
      const ieriKey = optiuniZile[ziSelectata - 1].key;
      if (membru[`status_${ieriKey}`] === "În serviciu") {
        alert("ATENȚIE: Nu se pot efectua servicii consecutive!");
        return;
      }
    }

    const updateObj = { [`status_${ziKey}`]: nouStatus, status: nouStatus };

    if (nouStatus === "În serviciu" && ziSelectata < 3) {
      const maineKey = optiuniZile[ziSelectata + 1].key;
      updateObj[`status_${maineKey}`] = "După serviciu";
      updateObj[`cantina_${maineKey}`] = false;
    }

    if (["Zi liberă", "Concediu", "Deplasare", "Foaie de boala", "După serviciu"].includes(nouStatus)) {
      updateObj[`cantina_${ziKey}`] = false;
    }

    await updateDoc(doc(db, "echipa", id), updateObj);

    const numeC = `${membru.grad} ${membru.nume}`.toUpperCase();
    const [regSnap, calSnap] = await Promise.all([
      getDoc(doc(db, "setari", "reguli_servicii")),
      getDoc(doc(db, "servicii", "calendar"))
    ]);

    if (regSnap.exists() && calSnap.exists()) {
      const reguli = regSnap.data();
      let calendar = calSnap.data().data || {};
      const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];
      let idx = functii.findIndex(f => reguli[f]?.includes(numeC));
      if (idx !== -1) {
        if (!calendar[dataF]) calendar[dataF] = { oameni: Array(8).fill("Din altă subunitate"), mod: "2" };
        if (nouStatus === "În serviciu") calendar[dataF].oameni[idx] = numeC;
        else if (calendar[dataF].oameni[idx] === numeC) calendar[dataF].oameni[idx] = "Din altă subunitate";
        await setDoc(doc(db, "servicii", "calendar"), { data: calendar });
      }
    }
    setMembruEditat(null);
  };

  const toggleCantina = async (id, stare) => {
    vibreaza(30);
    await updateDoc(doc(db, "echipa", id), { [`cantina_${ziKey}`]: !stare });
  };

  if (paginaCurenta === 'login') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center shadow-2xl">
        <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/40"><Lock size={40} /></div>
        <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Sistem Gestiune</h1>
        <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl mb-6 text-white outline-none focus:border-blue-500 transition-all font-mono" placeholder="****" maxLength="4" />
        <button onClick={() => login(inputCod)} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase shadow-lg transition-all active:scale-95">Autentificare</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3 lg:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        
        {/* Header Utilizator - Mai scund și buton Logout în dreapta */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-700 via-blue-800 to-slate-900 p-4 rounded-[1.5rem] mb-4 shadow-2xl border border-blue-500/30">
          <div className="relative z-10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md border border-white/20">
                <User size={20} className="text-blue-100" />
              </div>
              <div>
                <p className="text-blue-200 text-[8px] font-black uppercase tracking-widest leading-none mb-1">COA</p>
                <div className="text-lg font-black tracking-tight leading-none">
                  {userLogat?.rol === 'admin' ? 'ADMINISTRATOR' : <NumeFormatat membru={userLogat} clasaGrad="text-blue-200/60" />}
                </div>
              </div>
            </div>
            <button onClick={logout} className="bg-red-500/20 hover:bg-red-500 p-3 rounded-xl border border-red-500/50 transition-all group shrink-0">
              <LogOut size={18} className="group-hover:scale-110 transition-transform text-red-100" />
            </button>
          </div>
        </div>

        {/* Indicații */}
        <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 mb-4 shadow-xl border-l-4 border-l-blue-500">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-2 tracking-widest"><Edit3 size={12}/> Indicații</span>
            {userLogat?.rol === 'admin' && (
              <button onClick={async () => { if (editIndicatii) await setDoc(doc(db, "setari", "indicatii"), { text: indicatii }); setEditIndicatii(!editIndicatii); }} className="text-[9px] bg-blue-600 px-3 py-1 rounded-full font-black uppercase">
                {editIndicatii ? 'Salvează' : 'Modifică'}
              </button>
            )}
          </div>
          {editIndicatii ? <textarea value={indicatii} onChange={(e) => setIndicatii(e.target.value)} className="w-full bg-slate-950 p-3 rounded-xl text-sm text-white h-20 border border-blue-500 outline-none" /> : <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10"><p className="text-xs font-bold italic text-blue-100 leading-snug">"{indicatii || "Nu sunt indicații noi."}"</p></div>}
        </div>

        {/* Selector Zile - Toate în rând cu scroll orizontal pe mobil */}
        <div className="flex overflow-x-auto no-scrollbar gap-2 mb-6 pb-2">
          {optiuniZile.map((zi, index) => (
            <button 
              key={zi.key} 
              onClick={() => setZiSelectata(index)} 
              className={`flex-1 min-w-[85px] py-2 px-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center ${ziSelectata === index ? 'bg-blue-600 border-blue-400 shadow-md scale-[1.02]' : 'bg-slate-900 border-slate-800 opacity-60'}`}
            >
              <span className="text-[8px] font-black uppercase opacity-60 mb-0.5">{zi.label}</span>
              <span className="text-sm font-black tracking-tight">{format(zi.data, 'dd MMM')}</span>
            </button>
          ))}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-4">
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 overflow-x-auto no-scrollbar">
              {[{id:'categorii',label:'Sumar'},{id:'cantina',label:'Masă'},{id:'lista',label:'Listă'},{id:'servicii',label:'Servicii'},{id:'config',label:'Personal'}].map(p => (
                <button key={p.id} onClick={() => setPaginaCurenta(p.id)} className={`flex-1 py-2 px-3 rounded-lg text-[9px] font-black uppercase transition-all whitespace-nowrap ${paginaCurenta === p.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-white'}`}>{p.label}</button>
              ))}
            </div>

            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-500">
                {Object.keys(statusConfig).map(st => {
                  const oameni = echipa.filter(m => (m[`status_${ziKey}`] || "Nespecificat") === st);
                  if (oameni.length === 0) return null;
                  return (
                    <div key={st} className="bg-slate-900 rounded-[1.5rem] border border-slate-800 overflow-hidden shadow-lg">
                      <div className={`p-3 flex justify-between items-center border-b border-slate-800 ${statusConfig[st].color} bg-opacity-10`}>
                        <div className="flex items-center gap-2">
                           <div className={`${statusConfig[st].color} p-1.5 rounded-lg text-white shadow-md scale-75`}>{statusConfig[st].icon}</div>
                           <span className="font-black text-[10px] uppercase tracking-widest">{st}</span>
                        </div>
                        <span className="bg-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black border border-slate-800">{oameni.length}</span>
                      </div>
                      <div className="p-3 space-y-1.5 bg-black/20 text-sm">
                        {oameni.map(o => (
                          <div key={o.id} className="bg-slate-900/50 p-2 rounded-lg border border-white/5 flex items-center gap-2">
                            <div className={`w-1 h-1 rounded-full ${statusConfig[st].color}`}></div>
                            <NumeFormatat membru={o} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {paginaCurenta === 'cantina' && (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-6 rounded-[2rem] text-center shadow-xl">
                  <Utensils size={30} className="mx-auto mb-2 text-white/50" />
                  <h2 className="text-5xl font-black mb-1">{echipa.filter(m => m[`cantina_${ziKey}`]).length}</h2>
                  <p className="text-[9px] font-black uppercase opacity-70 tracking-[0.2em]">Total Rezervat</p>
                </div>
                <div className="bg-slate-900 rounded-[2rem] border border-slate-800 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {echipa.map(m => {
                       const mananca = m[`cantina_${ziKey}`];
                       const poateManca = m[`status_${ziKey}`] === "Prezent la serviciu";
                       return (
                        <button key={m.id} 
                          onClick={() => poateManca && toggleCantina(m.id, mananca)} 
                          className={`flex justify-between items-center p-3 rounded-xl border transition-all ${!poateManca ? 'opacity-10 grayscale cursor-not-allowed' : mananca ? 'bg-orange-600/20 border-orange-500 shadow-sm' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                          <div className="text-left"><NumeFormatat membru={m} /></div>
                          {poateManca ? (mananca ? <Check size={14} className="text-orange-500"/> : <X size={14} className="text-slate-700"/>) : <AlertTriangle size={12}/>}
                        </button>
                       )
                    })}
                  </div>
                </div>
              </div>
            )}

            {paginaCurenta === 'lista' && (
              <div className="space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                {echipa.map(m => (
                  <div key={m.id} className="flex flex-col">
                    <button onClick={() => setMembruEditat(membruEditat === m.id ? null : m.id)} className={`w-full flex justify-between items-center bg-slate-900 p-4 rounded-xl border-2 transition-all ${membruEditat === m.id ? 'border-blue-500 bg-slate-800 shadow-md' : 'border-slate-800'}`}>
                      <div className="text-left"><NumeFormatat membru={m} /></div>
                      <div className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase ${statusConfig[m[`status_${ziKey}`]]?.color || 'bg-slate-700'}`}>
                        {m[`status_${ziKey}`] || '---'}
                      </div>
                    </button>
                    {membruEditat === m.id && (
                      <div className="grid grid-cols-2 gap-2 p-3 bg-black/40 rounded-b-xl border-x border-b border-slate-800 animate-in slide-in-from-top-2">
                        {Object.keys(statusConfig).map(s => <button key={s} onClick={() => schimbaStatus(m.id, s)} className="p-2 text-[8px] bg-slate-900 border border-slate-800 rounded-lg uppercase font-black hover:bg-blue-600">{s}</button>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {paginaCurenta === 'servicii' && <div className="bg-slate-900 p-1 rounded-2xl border border-slate-800 overflow-x-auto"><ServiciiPage editabil={true} /></div>}
            {paginaCurenta === 'config' && <ConfigurareEfectiv />}
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => setPaginaCurenta(paginaCurenta === 'ser' ? 'p' : 'ser')} className="w-full bg-slate-900 p-4 rounded-[1.5rem] border-2 border-slate-800 font-black uppercase text-[10px] flex justify-between items-center group shadow-lg">
              <div className="flex items-center gap-3 text-blue-400"><Shield size={18}/><span className="text-white">Planificare Servicii</span></div>
              <ExternalLink size={16} className="text-slate-600" />
            </button>

            {paginaCurenta === 'ser' ? (
              <div className="animate-in slide-in-from-right-10"><ServiciiPage editabil={true} /></div>
            ) : (
              <div className="space-y-6 animate-in fade-in">
                <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-xl text-center">
                  <h3 className="text-[9px] font-black text-blue-400 mb-5 uppercase tracking-[0.2em]">Selectează Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.keys(statusConfig).map(st => {
                      const activ = echipa.find(e => e.id === userLogat.id)?.[`status_${ziKey}`] === st;
                      return (
                        <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-md scale-[1.01]' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                          <div className={`p-2 rounded-xl scale-75 ${activ ? 'bg-black text-white' : 'bg-slate-800 text-blue-500'}`}>{statusConfig[st].icon}</div>
                          <span className="font-black text-[11px] uppercase tracking-tight">{st}</span>
                          {activ && <Check size={20} className="ml-auto" strokeWidth={4}/>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-xl text-center">
                  <h3 className="text-[9px] font-black text-orange-500 mb-5 uppercase tracking-[0.2em]">Cantină</h3>
                  {(() => {
                    const m = echipa.find(e => e.id === userLogat.id);
                    const mananca = m?.[`cantina_${ziKey}`];
                    const poate = m?.[`status_${ziKey}`] === "Prezent la serviciu";
                    return (
                      <button onClick={() => poate && toggleCantina(userLogat.id, mananca)} className={`w-full p-5 rounded-[1.5rem] border-2 flex justify-between items-center transition-all ${!poate ? 'opacity-10 cursor-not-allowed grayscale' : mananca ? 'bg-orange-600 border-orange-400 shadow-md' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="flex gap-4 font-black uppercase text-sm items-center text-white text-left">
                          <Utensils size={24} /> 
                          <div>
                            <p className="text-[8px] opacity-60 mb-0.5">{mananca ? "Rezervat" : "Acasă"}</p>
                            <NumeFormatat membru={m} clasaGrad="text-white/40" />
                          </div>
                        </div>
                        {mananca && <Check size={24} strokeWidth={4} className="text-white"/>}
                      </button>
                    );
                  })()}
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