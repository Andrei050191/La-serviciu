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
  Shield, X, ExternalLink, AlertTriangle, Edit3
} from 'lucide-react';

import ServiciiPage from './ServiciiPage';
import ConfigurareEfectiv from './ConfigurareEfectiv';

const statusConfig = {
  "Prezent la serviciu": { color: "bg-green-600", icon: <Activity size={18} /> },
  "În serviciu": { color: "bg-blue-600", icon: <Briefcase size={18} /> },
  "După serviciu": { color: "bg-slate-500", icon: <Coffee size={18} /> },
  "Zi liberă": { color: "bg-yellow-600", icon: <Home size={18} /> },
  "Concediu": { color: "bg-purple-600", icon: <Umbrella size={18} /> },
  "Deplasare": { color: "bg-orange-600", icon: <MapPin size={18} /> },
  "Foaie de boala": { color: "bg-red-600", icon: <Stethoscope size={18} /> },
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
      const admin = { rol: 'admin', nume: 'Admin', id: 'admin' };
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
        alert("Eroare: Servicii consecutive interzise!");
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

    // Sincronizare Calendar Servicii
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
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-slate-900 p-8 rounded-3xl w-full max-w-xs text-center border border-slate-800">
        <Lock size={40} className="mx-auto mb-4 text-blue-500" />
        <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)} className="w-full bg-black border border-slate-700 p-4 rounded-xl text-center text-3xl mb-4 text-white" placeholder="****" />
        <button onClick={() => login(inputCod)} className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold uppercase">Login</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-2 pb-10">
      <div className="max-w-md mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl mb-4 border border-slate-800">
          <div className="flex items-center gap-2">
            <CalendarDays size={20} className="text-blue-500" />
            <span className="font-bold text-sm uppercase">{userLogat?.nume}</span>
          </div>
          <button onClick={logout} className="text-red-500"><LogOut size={20}/></button>
        </div>

        {/* Indicatii */}
        <div className="bg-slate-900 p-4 rounded-2xl mb-4 border border-slate-800">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Indicații Comandant</span>
            {userLogat?.rol === 'admin' && (
              <button onClick={async () => { if (editIndicatii) await setDoc(doc(db, "setari", "indicatii"), { text: indicatii }); setEditIndicatii(!editIndicatii); }} className="text-[10px] bg-blue-600 px-2 py-1 rounded">
                {editIndicatii ? 'SALVEAZĂ' : 'EDIT'}
              </button>
            )}
          </div>
          {editIndicatii ? <textarea value={indicatii} onChange={(e) => setIndicatii(e.target.value)} className="w-full bg-black p-2 rounded text-sm text-white h-20 border border-blue-900" /> : <p className="text-sm italic text-blue-100">{indicatii || "Nu sunt indicații."}</p>}
        </div>

        {/* Selector Zile */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-2">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => setZiSelectata(index)} className={`flex-1 min-w-[80px] py-3 rounded-xl border ${ziSelectata === index ? 'bg-blue-600 border-blue-400' : 'bg-slate-900 border-slate-800'}`}>
              <p className="text-[8px] uppercase font-bold opacity-60">{zi.label}</p>
              <p className="text-[10px] font-bold">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-4">
            <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 gap-1 overflow-x-auto">
              {['categorii','cantina','lista','servicii','config'].map(p => (
                <button key={p} onClick={() => setPaginaCurenta(p)} className={`flex-1 py-2 px-2 rounded-lg text-[9px] font-bold uppercase ${paginaCurenta === p ? 'bg-blue-600' : 'text-slate-500'}`}>{p}</button>
              ))}
            </div>

            {paginaCurenta === 'categorii' && (
              <div className="space-y-2">
                {Object.keys(statusConfig).map(st => {
                  const oameni = echipa.filter(m => (m[`status_${ziKey}`] || "Nespecificat") === st);
                  if (oameni.length === 0) return null;
                  return (
                    <div key={st} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                      <div className="bg-slate-800 p-2 flex justify-between px-4"><span className="text-[10px] font-bold uppercase">{st}</span><span className="text-[10px]">{oameni.length}</span></div>
                      <div className="p-2">{oameni.map(o => <div key={o.id} className="text-[10px] py-1 border-b border-white/5 uppercase font-bold text-slate-300">{o.grad} {o.nume}</div>)}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {paginaCurenta === 'cantina' && (
              <div className="space-y-3">
                <div className="bg-orange-600 p-4 rounded-xl text-center font-bold">
                  <p className="text-2xl">{echipa.filter(m => m[`cantina_${ziKey}`]).length}</p>
                  <p className="text-[10px] uppercase">La Masă</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {echipa.map(m => (
                    <button key={m.id} onClick={() => toggleCantina(m.id, m[`cantina_${ziKey}`])} className={`flex justify-between p-3 rounded-xl border ${m[`cantina_${ziKey}`] ? 'bg-orange-900/40 border-orange-500' : 'bg-slate-900 border-slate-800'}`}>
                      <span className="text-[10px] font-bold uppercase">{m.grad} {m.nume}</span>
                      {m[`cantina_${ziKey}`] ? <Check size={14} className="text-orange-500" /> : <X size={14} className="text-slate-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {paginaCurenta === 'lista' && (
              <div className="space-y-2">
                {echipa.map(m => (
                  <div key={m.id}>
                    <button onClick={() => setMembruEditat(membruEditat === m.id ? null : m.id)} className="w-full flex justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 text-[10px] font-bold uppercase">
                      <span>{m.grad} {m.nume}</span>
                      <span className="text-blue-400">{m[`status_${ziKey}`] || '---'}</span>
                    </button>
                    {membruEditat === m.id && (
                      <div className="grid grid-cols-2 gap-1 p-2 bg-black">
                        {Object.keys(statusConfig).map(s => <button key={s} onClick={() => schimbaStatus(m.id, s)} className="p-2 text-[8px] bg-slate-800 rounded uppercase font-bold">{s}</button>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} />}
            {paginaCurenta === 'config' && <ConfigurareEfectiv />}
          </div>
        ) : (
          /* USER VIEW */
          <div className="space-y-4">
            <button onClick={() => setPaginaCurenta(paginaCurenta === 'ser' ? 'p' : 'ser')} className="w-full bg-slate-900 p-4 rounded-xl border border-slate-800 font-bold uppercase text-[10px] flex justify-between">
              <span>Servicii Unitate</span><ExternalLink size={16}/>
            </button>
            {paginaCurenta === 'ser' ? <ServiciiPage editabil={true} /> : (
              <div className="space-y-4">
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  <p className="text-center text-[10px] font-bold text-blue-400 mb-4 uppercase">Status {optiuniZile[ziSelectata].label}</p>
                  <div className="grid gap-2">
                    {Object.keys(statusConfig).map(st => {
                      const activ = echipa.find(e => e.id === userLogat.id)?.[`status_${ziKey}`] === st;
                      return (
                        <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-3 p-4 rounded-xl border ${activ ? 'bg-white text-black' : 'bg-black border-slate-800 text-white'}`}>
                          {statusConfig[st].icon} <span className="text-[10px] font-bold uppercase">{st}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800">
                  {(() => {
                    const m = echipa.find(e => e.id === userLogat.id);
                    const mananca = m?.[`cantina_${ziKey}`];
                    const poate = m?.[`status_${ziKey}`] === "Prezent la serviciu";
                    return (
                      <button onClick={() => poate && toggleCantina(userLogat.id, mananca)} className={`w-full p-4 rounded-xl border flex justify-between items-center ${!poate ? 'opacity-20' : mananca ? 'bg-orange-600' : 'bg-black'}`}>
                        <span className="text-[10px] font-bold uppercase"><Utensils size={14} className="inline mr-2"/> {mananca ? "LA MASĂ" : "ACASĂ"}</span>
                        {mananca && <Check size={16}/>}
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