import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc, getDoc 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { 
  Activity, Briefcase, Umbrella, Coffee, Home, MapPin, 
  Stethoscope, List, LayoutDashboard, CalendarDays, 
  Utensils, Check, Lock, LogOut, ChevronDown, Shield, User, Users
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

  const vibreaza = (ms = 50) => { if (navigator.vibrate) navigator.vibrate(ms); };

  const optiuniZile = [
    { label: 'Azi', data: new Date(), key: format(new Date(), 'yyyyMMdd') },
    { label: 'Mâine', data: addDays(new Date(), 1), key: format(addDays(new Date(), 1), 'yyyyMMdd') }
  ];

  const formatIdentitate = (m) => {
    if (!m) return null;
    const gradMicuț = m.grad ? m.grad.toLowerCase() : "";
    const prenumeFormatat = m.prenume ? (m.prenume.charAt(0).toUpperCase() + m.prenume.slice(1).toLowerCase()) : "";
    const numeFormatat = m.nume ? m.nume.toUpperCase() : "";
    return (
      <div className="flex flex-col text-left">
        <span className="text-[10px] font-medium text-white/70 leading-none mb-1">{gradMicuț}</span>
        <span className="text-sm font-black text-white">{prenumeFormatat} {numeFormatat}</span>
      </div>
    );
  };

  useEffect(() => {
    const sesiuneSalvata = localStorage.getItem('userEfectiv');
    if (sesiuneSalvata) {
      const user = JSON.parse(sesiuneSalvata);
      setUserLogat(user);
      setPaginaCurenta(user.rol === 'admin' ? 'categorii' : 'personal');
    }
  }, []);

  // ASCULTĂTOR REAL-TIME PENTRU ECHIPĂ (Asigură actualizarea Sumarului)
  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEchipa(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "indicatii"), (docSnap) => {
      if (docSnap.exists()) { setIndicatii(docSnap.data().text); setMesajNou(true); setTimeout(() => setMesajNou(false), 8000); }
    });
    return () => unsub();
  }, []);

  const login = (cod) => {
    if (cod === "0000") {
      const admin = { rol: 'admin', nume: 'Administrator' }; setUserLogat(admin);
      localStorage.setItem('userEfectiv', JSON.stringify(admin)); setPaginaCurenta('categorii'); return;
    }
    const gasit = echipa.find(m => String(m.cod) === String(cod));
    if (gasit) {
      const u = { ...gasit, rol: 'user' }; setUserLogat(u);
      localStorage.setItem('userEfectiv', JSON.stringify(u)); setPaginaCurenta('personal');
    } else { setEroareLogin(true); setInputCod(""); }
  };

  const logout = () => { localStorage.removeItem('userEfectiv'); setUserLogat(null); setPaginaCurenta('login'); };

  // FUNCȚIA DE SCHIMBARE STATUS CU SINCRONIZARE TOTALĂ
  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(70);
    const ziKeyData = optiuniZile[ziSelectata].data;
    const ziKeyFiltru = optiuniZile[ziSelectata].key;
    const ziCurentaFormatata = format(ziKeyData, 'dd.MM.yyyy');
    const ziIeriFormatata = format(addDays(ziKeyData, -1), 'dd.MM.yyyy');
    const ziUrmatoareFiltru = format(addDays(ziKeyData, 1), 'yyyyMMdd');

    // 1. Update status în profil (pentru Sumar și Listă)
    await updateDoc(doc(db, "echipa", id), { [`status_${ziKeyFiltru}`]: nouStatus });

    // 2. Sincronizare cu pagina de Serviciu
    const membru = echipa.find(m => m.id === id);
    const numeComplet = `${membru.grad || ''} ${membru.prenume || ''} ${membru.nume || ''}`.trim().toUpperCase();

    if (nouStatus === "În serviciu" || nouStatus === "După serviciu") {
      const [regSnap, calSnap] = await Promise.all([
        getDoc(doc(db, "setari", "reguli_servicii")),
        getDoc(doc(db, "servicii", "calendar"))
      ]);

      const reguli = regSnap.exists() ? regSnap.data() : {};
      let calendarData = calSnap.exists() ? calSnap.data().data : {};
      const functiiOrdonate = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];

      let indexFunctie = functiiOrdonate.findIndex(f => reguli[f]?.includes(numeComplet));

      if (indexFunctie !== -1) {
        if (nouStatus === "În serviciu") {
          if (!calendarData[ziCurentaFormatata]) calendarData[ziCurentaFormatata] = { oameni: Array(8).fill("Din altă subunitate"), mod: "2" };
          calendarData[ziCurentaFormatata].oameni[indexFunctie] = numeComplet;
          if (!functiiOrdonate[indexFunctie].includes("Intervenția")) {
            await updateDoc(doc(db, "echipa", id), { [`status_${ziUrmatoareFiltru}`]: "După serviciu" });
          }
        } else { // "După serviciu"
          if (!calendarData[ziIeriFormatata]) calendarData[ziIeriFormatata] = { oameni: Array(8).fill("Din altă subunitate"), mod: "2" };
          calendarData[ziIeriFormatata].oameni[indexFunctie] = numeComplet;
        }
        await setDoc(doc(db, "servicii", "calendar"), { data: calendarData });
      }
    }
    setMembruEditat(null);
  };

  const toggleCantina = async (id, stare) => {
    await updateDoc(doc(db, "echipa", id), { [`cantina_${optiuniZile[ziSelectata].key}`]: !stare });
  };

  const getStatusMembru = (m) => m[`status_${optiuniZile[ziSelectata].key}`] || "Nespecificat";

  // ACEASTA PARTE CALCULEAZĂ SUMARUL DIN REZULTATELE REALE ALE ECHIPEI
  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m) === status);
    return acc;
  }, {});

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-xl shadow-blue-600/30"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
          <input type="password" maxLength="4" value={inputCod} onChange={(e) => setInputCod(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl tracking-[0.5em] focus:border-blue-500 outline-none mb-4 text-white" placeholder="****" />
          {eroareLogin && <p className="text-red-500 text-xs font-bold mb-4 uppercase">Cod incorect!</p>}
          <button onClick={() => login(inputCod)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase text-white shadow-xl">Intră</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>{userLogat?.rol === 'admin' ? <h1 className="text-lg font-black uppercase tracking-widest text-white">Administrator</h1> : formatIdentitate(userLogat)}</div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"><LogOut size={24}/></button>
        </div>

        <div className="flex gap-2 mb-4">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => setZiSelectata(index)} 
              className={`flex-1 py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400 shadow-lg' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        <div className={`mb-8 p-5 rounded-[2rem] border-2 transition-all ${mesajNou ? 'border-red-500 bg-red-950/30 animate-pulse' : 'border-slate-800 bg-slate-900 shadow-xl'}`}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Indicații Comandant</span>
            {userLogat?.rol === 'admin' && (
              <button onClick={() => setEditIndicatii(!editIndicatii)} className="text-[9px] font-black uppercase px-4 py-1.5 rounded-full bg-blue-600 text-white">
                {editIndicatii ? 'Gata' : 'Modifică'}
              </button>
            )}
          </div>
          {editIndicatii ? (
            <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500 min-h-[120px]"
              value={indicatii} onChange={(e) => setIndicatii(e.target.value)} onBlur={async () => await setDoc(doc(db, "setari", "indicatii"), { text: indicatii })} />
          ) : (
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5"><p className="text-sm font-bold text-white leading-relaxed italic whitespace-pre-wrap">{indicatii || "Nu sunt indicații noi."}</p></div>
          )}
        </div>

        {userLogat?.rol === 'admin' && (
          <div className="space-y-6">
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-4 overflow-x-auto gap-1 shadow-inner scrollbar-hide">
              <button onClick={() => setPaginaCurenta('categorii')} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] ${paginaCurenta === 'categorii' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>SUMAR</button>
              <button onClick={() => setPaginaCurenta('cantina')} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] ${paginaCurenta === 'cantina' ? 'bg-orange-600 text-white' : 'text-slate-500'}`}>MASĂ</button>
              <button onClick={() => setPaginaCurenta('lista')} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] ${paginaCurenta === 'lista' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>LISTĂ</button>
              <button onClick={() => setPaginaCurenta('servicii')} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] ${paginaCurenta === 'servicii' ? 'bg-red-600 text-white' : 'text-slate-500'}`}>SERVICIU</button>
              <button onClick={() => setPaginaCurenta('config_servicii')} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] ${paginaCurenta === 'config_servicii' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>EFECTIV</button>
            </div>
            
            {paginaCurenta === 'lista' && (
              <div className="grid grid-cols-1 gap-3">
                {echipa.map(m => {
                  const status = getStatusMembru(m); const isEditing = membruEditat === m.id;
                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      <button onClick={() => setMembruEditat(isEditing ? null : m.id)}
                        className={`bg-slate-900 p-5 rounded-2xl border flex justify-between items-center ${isEditing ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-xl' : 'border-slate-800'}`}>
                        {formatIdentitate(m)}
                        <span className={`text-[9px] font-black px-3 py-2 rounded-lg text-white ${statusConfig[status]?.color || 'bg-slate-800'}`}>{status}</span>
                      </button>
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl">
                          {Object.keys(statusConfig).map(st => (
                            <button key={st} onClick={() => schimbaStatus(m.id, st)} className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase border border-slate-800">
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
            {paginaCurenta === 'config_servicii' && <ConfigurareEfectiv />}
            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
                 <h2 className="text-lg font-black uppercase text-orange-500 mb-6 tracking-widest text-center">Masa la cantină</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {echipa.map(m => (
                     <button key={m.id} onClick={() => toggleCantina(m.id, m[`cantina_${optiuniZile[ziSelectata].key}`])} 
                       className={`flex justify-between items-center p-4 rounded-xl border-2 ${m[`cantina_${optiuniZile[ziSelectata].key}`] ? 'bg-orange-600 border-orange-400' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                       {formatIdentitate(m)}
                       {m[`cantina_${optiuniZile[ziSelectata].key}`] ? <Check size={18} strokeWidth={4}/> : <div className="w-5 h-5 border-2 border-slate-800 rounded-full"/>}
                     </button>
                   ))}
                 </div>
              </div>
            )}
            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(categorii).map(([numeCat, oameni]) => (
                  <div key={numeCat} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3 uppercase font-black text-white text-sm">
                         <div className={`p-2 rounded-lg ${statusConfig[numeCat]?.color}`}>{statusConfig[numeCat]?.icon}</div> {numeCat}
                      </div>
                      <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-black text-white">{oameni.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {oameni.map(o => <div key={o.id} className="bg-slate-950 p-3 rounded-xl border border-slate-700/50">{formatIdentitate(o)}</div>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {userLogat?.rol === 'user' && (
          <div className="space-y-6">
            <button onClick={() => setPaginaCurenta(paginaCurenta === 'servicii_vizualizare' ? 'personal' : 'servicii_vizualizare')} className="w-full bg-red-600/10 border-2 border-red-500/30 p-5 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-4"><div className="bg-red-600 p-3 rounded-2xl text-white"><Shield size={22} /></div><span className="font-black text-xs uppercase text-white tracking-widest">Vezi Serviciul de Zi</span></div>
              <ChevronDown size={18} className={`text-red-500 transition-all ${paginaCurenta === 'servicii_vizualizare' ? 'rotate-180' : ''}`} />
            </button>
            {paginaCurenta === 'servicii_vizualizare' ? <ServiciiPage editabil={false} /> : (
              <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800">
                <h2 className="text-center text-xs font-black uppercase text-blue-400 mb-6 italic tracking-tighter tracking-widest">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
                <div className="grid grid-cols-1 gap-3">
                  {Object.keys(statusConfig).map(st => {
                    const activ = getStatusMembru(userLogat) === st;
                    return (
                      <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-5 rounded-2xl border-2 ${activ ? 'bg-white text-black border-white' : 'bg-slate-950 border-slate-800 text-white opacity-60'}`}>
                        <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                        <span className="text-sm uppercase font-black">{st}</span>
                        {activ && <Check size={24} className="ml-auto" strokeWidth={4} />}
                      </button>
                    );
                  })}
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