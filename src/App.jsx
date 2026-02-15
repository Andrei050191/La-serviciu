import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, setDoc, getDoc 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
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

  const optiuniZile = [
    { label: 'Azi', data: new Date(), key: format(new Date(), 'yyyyMMdd') },
    { label: 'Mâine', data: addDays(new Date(), 1), key: format(addDays(new Date(), 1), 'yyyyMMdd') }
  ];

  const ziKey = optiuniZile[ziSelectata].key;

  const formatIdentitate = (m) => {
    if (!m) return null;
    return (
      <div className="flex flex-col text-left">
        <span className="text-[10px] font-medium text-white/70 leading-none mb-1 uppercase">{m.grad || ""}</span>
        <span className="text-sm font-black text-white uppercase">{m.prenume || ""} {m.nume || ""}</span>
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

  const schimbaStatus = async (id, nouStatus) => {
    const ziKeyFiltru = optiuniZile[ziSelectata].key;
    const ziCurentaFormatata = format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy');
    const ziIeriFormatata = format(addDays(optiuniZile[ziSelectata].data, -1), 'dd.MM.yyyy');

    // Dacă statusul devine unul restrictiv, scoatem automat bifa de cantină
    const restrictiv = ["Zi liberă", "Concediu", "Deplasare", "Foaie de boala"].includes(nouStatus);
    const updateObj = { [`status_${ziKeyFiltru}`]: nouStatus };
    if (restrictiv) updateObj[`cantina_${ziKeyFiltru}`] = false;

    await updateDoc(doc(db, "echipa", id), updateObj);

    const membru = echipa.find(m => m.id === id);
    const numeComplet = `${membru.grad || ''} ${membru.prenume || ''} ${membru.nume || ''}`.trim().toUpperCase();

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
      } else if (nouStatus === "După serviciu") {
        if (!calendarData[ziIeriFormatata]) calendarData[ziIeriFormatata] = { oameni: Array(8).fill("Din altă subunitate"), mod: "2" };
        calendarData[ziIeriFormatata].oameni[indexFunctie] = numeComplet;
      } else {
        if (calendarData[ziCurentaFormatata] && calendarData[ziCurentaFormatata].oameni[indexFunctie] === numeComplet) {
          calendarData[ziCurentaFormatata].oameni[indexFunctie] = "Din altă subunitate";
        }
      }
      await setDoc(doc(db, "servicii", "calendar"), { data: calendarData });
    }
    setMembruEditat(null);
  };

  const toggleCantina = async (id, stare) => {
    await updateDoc(doc(db, "echipa", id), { [`cantina_${ziKey}`]: !stare });
  };

  const getStatusMembru = (m) => {
    const realTimeMembru = echipa.find(e => e.id === m.id);
    return realTimeMembru ? (realTimeMembru[`status_${ziKey}`] || "Nespecificat") : "Nespecificat";
  };

  const nrLaCantina = echipa.filter(m => m[`cantina_${ziKey}`] === true).length;

  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m) === status);
    return acc;
  }, {});

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
          <input type="password" maxLength="4" value={inputCod} onChange={(e) => setInputCod(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl tracking-[0.5em] focus:border-blue-500 outline-none mb-4 text-white" placeholder="****" />
          <button onClick={() => login(inputCod)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase">Intră</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-4xl mx-auto">
        
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>{userLogat?.rol === 'admin' ? <h1 className="text-lg font-black uppercase">Admin</h1> : formatIdentitate(userLogat)}</div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"><LogOut size={24}/></button>
        </div>

        <div className="flex gap-2 mb-4">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => setZiSelectata(index)} 
              className={`flex-1 py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 mb-1">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-8">
          <div className={`p-5 rounded-[2rem] border-2 transition-all ${mesajNou ? 'border-red-500 bg-red-950/30' : 'border-slate-800 bg-slate-900'}`}>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">Indicații Comandant</span>
              {userLogat?.rol === 'admin' && (
                <button onClick={async () => { if (editIndicatii) { await setDoc(doc(db, "setari", "indicatii"), { text: indicatii }); } setEditIndicatii(!editIndicatii); }} 
                  className="text-[9px] font-black uppercase px-4 py-1.5 rounded-full bg-blue-600 text-white">{editIndicatii ? 'Gata' : 'Modifică'}</button>
              )}
            </div>
            {editIndicatii ? (
              <textarea className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl p-4 text-sm text-white outline-none focus:border-blue-500 min-h-[120px]"
                value={indicatii} onChange={(e) => setIndicatii(e.target.value)} autoFocus />
            ) : (
              <div className="bg-black/40 p-4 rounded-2xl border border-white/5"><p className="text-sm font-bold text-white whitespace-pre-wrap">{indicatii || "Nu sunt indicații noi."}</p></div>
            )}
          </div>

          {userLogat?.rol === 'user' && (
            <button onClick={() => setPaginaCurenta(paginaCurenta === 'servicii_vizualizare' ? 'personal' : 'servicii_vizualizare')} 
              className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-[2rem] flex items-center justify-between shadow-xl">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white"><Shield size={22} /></div>
                <div className="text-left"><p className="font-black text-xs uppercase tracking-widest">Planificare Servicii</p><p className="text-[10px] text-slate-400 font-bold">Apasă pentru a vedea sau modifica</p></div>
              </div>
              <ExternalLink size={20} className="text-blue-500 opacity-50" />
            </button>
          )}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-6">
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-4 overflow-x-auto gap-1">
              {['categorii', 'cantina', 'lista', 'servicii', 'config_servicii'].map((p) => (
                <button key={p} onClick={() => setPaginaCurenta(p)} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase ${paginaCurenta === p ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                  {p.replace('config_', '').replace('categorii', 'sumar').replace('cantina', 'masă')}
                </button>
              ))}
            </div>

            {paginaCurenta === 'lista' && (
              <div className="grid grid-cols-1 gap-3">
                {echipa.map(m => {
                  const status = getStatusMembru(m);
                  const isEditing = membruEditat === m.id;
                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      <button onClick={() => setMembruEditat(isEditing ? null : m.id)}
                        className={`bg-slate-900 p-5 rounded-2xl border flex justify-between items-center ${isEditing ? 'border-blue-500' : 'border-slate-800'}`}>
                        {formatIdentitate(m)}
                        <span className={`text-[9px] font-black px-3 py-2 rounded-lg text-white ${statusConfig[status]?.color || 'bg-slate-800'}`}>{status}</span>
                      </button>
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl">
                          {Object.keys(statusConfig).map(st => (
                            <button key={st} onClick={() => schimbaStatus(m.id, st)} className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase border border-slate-800">{statusConfig[st].icon} {st}</button>
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
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                 <h2 className="text-lg font-black uppercase text-orange-500 mb-6 text-center">Masa la cantină ({nrLaCantina})</h2>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {echipa.map(m => (
                     <button key={m.id} onClick={() => toggleCantina(m.id, m[`cantina_${ziKey}`])} 
                       className={`flex justify-between items-center p-4 rounded-xl border-2 ${m[`cantina_${ziKey}`] ? 'bg-orange-600 border-orange-400' : 'bg-slate-950 border-slate-800 opacity-60'}`}>
                       {formatIdentitate(m)}
                       {m[`cantina_${ziKey}`] ? <Check size={18} strokeWidth={4}/> : <div className="w-5 h-5 border-2 border-slate-800 rounded-full"/>}
                     </button>
                   ))}
                 </div>
              </div>
            )}
            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 gap-4">
                {Object.entries(categorii).map(([numeCat, oameni]) => (
                  <div key={numeCat} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800">
                    <div className="flex justify-between items-center mb-4 font-black uppercase text-sm">
                      <div className="flex items-center gap-2"><div className={`p-2 rounded-lg ${statusConfig[numeCat]?.color}`}>{statusConfig[numeCat]?.icon}</div>{numeCat}</div>
                      <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-black">{oameni.length}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">{oameni.map(o => <div key={o.id} className="bg-slate-950 p-3 rounded-xl border border-white/5">{formatIdentitate(o)}</div>)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* INTERFATA USER */
          <div className="space-y-6">
            {paginaCurenta === 'servicii_vizualizare' ? (
              <div className="space-y-4">
                <button onClick={() => setPaginaCurenta('personal')} className="text-blue-500 text-xs font-black uppercase flex items-center gap-2 mb-2">← Înapoi</button>
                <ServiciiPage editabil={true} />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                  <h2 className="text-center text-xs font-black uppercase text-blue-400 mb-6 tracking-widest">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(statusConfig).map(st => {
                      const activ = getStatusMembru(userLogat) === st;
                      return (
                        <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-lg' : 'bg-slate-950 border-slate-800 text-white opacity-70'}`}>
                          <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                          <span className="text-sm uppercase font-black">{st}</span>
                          {activ && <Check size={24} className="ml-auto" strokeWidth={4} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                  <h2 className="text-center text-xs font-black uppercase text-orange-500 mb-6 tracking-widest">Masa la cantină ({nrLaCantina})</h2>
                  {(() => {
                    const realTimeSelf = echipa.find(e => e.id === userLogat.id);
                    const status = getStatusMembru(userLogat);
                    const mananca = realTimeSelf ? realTimeSelf[`cantina_${ziKey}`] : false;
                    const esteRestrictiv = ["Zi liberă", "Concediu", "Deplasare", "Foaie de boala"].includes(status);
                    
                    return (
                      <button 
                        onClick={() => !esteRestrictiv && toggleCantina(userLogat.id, mananca)} 
                        disabled={esteRestrictiv}
                        className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all 
                          ${esteRestrictiv ? 'bg-red-950/20 border-red-900/50 opacity-50 cursor-not-allowed' : 
                            mananca ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="flex items-center gap-4">
                          <Utensils size={24} />
                          <span className="text-sm uppercase font-black">
                            {esteRestrictiv ? `Nu poți lua masa că ești în ${status}` : mananca ? "LA CANTINĂ" : "ACASĂ"}
                          </span>
                        </div>
                        {esteRestrictiv ? <AlertTriangle size={24} className="text-red-500" /> : mananca ? <Check size={24} strokeWidth={4}/> : <X size={24} className="text-red-500" strokeWidth={4}/>}
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