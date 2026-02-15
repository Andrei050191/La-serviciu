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

  // Configurare 4 zile
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
    return onSnapshot(q, (snapshot) => {
      setEchipa(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  useEffect(() => {
    return onSnapshot(doc(db, "setari", "indicatii"), (docSnap) => {
      if (docSnap.exists()) setIndicatii(docSnap.data().text);
    });
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

  // FUNCȚIA PRINCIPALĂ DE LOGICĂ ȘI SINCRONIZARE
  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(50);
    const membru = echipa.find(m => m.id === id);
    const ziCurentaFormatata = format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy');

    // Regula: Nu poți pune "În serviciu" dacă ai fost "În serviciu" ieri
    if (nouStatus === "În serviciu" && ziSelectata > 0) {
      const ieriKey = optiuniZile[ziSelectata - 1].key;
      if (membru[`status_${ieriKey}`] === "În serviciu") {
        alert("Eroare: Nu se pot efectua servicii în zile consecutive!");
        return;
      }
    }

    const updateObj = { [`status_${ziKey}`]: nouStatus, status: nouStatus };

    // Regula automată: În serviciu azi -> După serviciu mâine
    if (nouStatus === "În serviciu" && ziSelectata < 3) {
      const maineKey = optiuniZile[ziSelectata + 1].key;
      updateObj[`status_${maineKey}`] = "După serviciu";
      updateObj[`cantina_${maineKey}`] = false;
    }

    // Curățare cantină pentru statusuri restrictive
    if (["Zi liberă", "Concediu", "Deplasare", "Foaie de boala", "După serviciu"].includes(nouStatus)) {
      updateObj[`cantina_${ziKey}`] = false;
    }

    await updateDoc(doc(db, "echipa", id), updateObj);

    // SINCRONIZARE TABEL SERVICII (CALENDAR)
    const numeComplet = `${membru.grad} ${membru.prenume} ${membru.nume}`.toUpperCase();
    const [regSnap, calSnap] = await Promise.all([
      getDoc(doc(db, "setari", "reguli_servicii")),
      getDoc(doc(db, "servicii", "calendar"))
    ]);

    if (regSnap.exists() && calSnap.exists()) {
      const reguli = regSnap.data();
      let calendar = calSnap.data().data || {};
      const functii = ["Ajutor OSU", "Sergent de serviciu PCT", "Planton", "Patrulă", "Operator radio", "Intervenția 1", "Intervenția 2", "Responsabil"];
      
      let indexFunctie = functii.findIndex(f => reguli[f]?.includes(numeComplet));
      
      if (indexFunctie !== -1) {
        if (!calendar[ziCurentaFormatata]) calendar[ziCurentaFormatata] = { oameni: Array(8).fill("Din altă subunitate"), mod: "2" };
        
        if (nouStatus === "În serviciu") {
          calendar[ziCurentaFormatata].oameni[indexFunctie] = numeComplet;
        } else if (calendar[ziCurentaFormatata].oameni[indexFunctie] === numeComplet) {
          calendar[ziCurentaFormatata].oameni[indexFunctie] = "Din altă subunitate";
        }
        await setDoc(doc(db, "servicii", "calendar"), { data: calendar });
      }
    }
    setMembruEditat(null);
  };

  const toggleCantina = async (id, stare) => {
    vibreaza(30);
    await updateDoc(doc(db, "echipa", id), { [`cantina_${ziKey}`]: !stare });
  };

  const formatIdentitate = (m) => (
    <div className="flex flex-col text-left">
      <span className="text-[10px] font-medium text-white/70 leading-none mb-1 uppercase">{m?.grad}</span>
      <span className="text-sm font-black text-white uppercase">{m?.prenume} {m?.nume}</span>
    </div>
  );

  if (paginaCurenta === 'login') return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white text-center font-sans">
      <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm shadow-2xl">
        <Lock size={48} className="mx-auto mb-6 text-blue-500" />
        <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
        <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)} className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-4xl mb-4 outline-none focus:border-blue-500 transition-all" placeholder="****" maxLength="4" />
        <button onClick={() => login(inputCod)} className="w-full bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black uppercase shadow-lg transition-all">Autentificare</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 font-sans">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Utilizator */}
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-4 rounded-3xl border border-slate-800 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2.5 rounded-xl"><CalendarDays size={20} /></div>
            <div>{userLogat?.rol === 'admin' ? <span className="font-black uppercase text-sm text-blue-400">Comandă Subunitate</span> : formatIdentitate(echipa.find(e => e.id === userLogat?.id))}</div>
          </div>
          <button onClick={logout} className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><LogOut size={20}/></button>
        </div>

        {/* Indicații Comandant */}
        <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 mb-6 shadow-xl relative overflow-hidden">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-2 tracking-widest"><Edit3 size={12}/> Indicații Comandant</span>
            {userLogat?.rol === 'admin' && (
              <button onClick={async () => { if (editIndicatii) await setDoc(doc(db, "setari", "indicatii"), { text: indicatii }); setEditIndicatii(!editIndicatii); }} className="text-[9px] font-black bg-blue-600 px-4 py-1.5 rounded-full hover:bg-blue-500 transition-all">
                {editIndicatii ? 'SALVEAZĂ' : 'MODIFICĂ'}
              </button>
            )}
          </div>
          {editIndicatii ? (
            <textarea value={indicatii} onChange={(e) => setIndicatii(e.target.value)} className="w-full bg-slate-950 p-4 rounded-2xl text-sm border border-blue-500 outline-none h-28 resize-none shadow-inner" />
          ) : (
            <div className="bg-black/20 p-4 rounded-2xl border border-white/5"><p className="text-sm font-bold italic text-blue-50 leading-relaxed">{indicatii || "Nu sunt indicații noi pentru astăzi."}</p></div>
          )}
        </div>

        {/* Selector 4 Zile */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => setZiSelectata(index)} 
              className={`flex-1 min-w-[100px] py-4 rounded-2xl border-2 transition-all duration-200 ${ziSelectata === index ? 'bg-blue-700 border-blue-400 shadow-lg scale-[1.02]' : 'bg-slate-900 border-slate-800 opacity-50 hover:opacity-80'}`}>
              <p className="text-[9px] font-black uppercase mb-1 tracking-tighter opacity-70">{zi.label}</p>
              <p className="text-xs font-black">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-6">
            {/* Navigare Admin */}
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 gap-1 overflow-x-auto shadow-inner">
              {[
                { id: 'categorii', label: 'Sumar' },
                { id: 'cantina', label: 'Masă' },
                { id: 'lista', label: 'Listă' },
                { id: 'servicii', label: 'Servicii' },
                { id: 'config_servicii', label: 'Eligibili' }
              ].map((p) => (
                <button key={p.id} onClick={() => setPaginaCurenta(p.id)} className={`flex-1 py-3 px-4 rounded-xl font-black text-[9px] uppercase transition-all whitespace-nowrap ${paginaCurenta === p.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {paginaCurenta === 'categorii' && (
              <div className="grid grid-cols-1 gap-4">
                {Object.keys(statusConfig).map(status => {
                  const oameni = echipa.filter(m => (m[`status_${ziKey}`] || "Nespecificat") === status);
                  if (oameni.length === 0) return null;
                  return (
                    <div key={status} className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-lg">
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-black text-xs uppercase flex items-center gap-3">{statusConfig[status].icon} {status}</span>
                        <span className="bg-blue-600 px-3 py-1 rounded-full text-[10px] font-black">{oameni.length}</span>
                      </div>
                      <div className="grid gap-2">
                        {oameni.map(o => <div key={o.id} className="text-[11px] bg-black/30 p-3 rounded-xl border border-white/5 font-bold uppercase tracking-tight">{o.grad} {o.prenume} {o.nume}</div>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-8 rounded-[2rem] border border-slate-800 text-center shadow-2xl">
                <div className="bg-orange-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-orange-500/30"><Utensils className="text-orange-500" size={32} /></div>
                <h2 className="text-3xl font-black tracking-tighter mb-2">{echipa.filter(m => m[`cantina_${ziKey}`]).length} PERSOANE</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Înscriși la masa la cantină</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {echipa.filter(m => m[`cantina_${ziKey}`]).map(m => (
                    <div key={m.id} className="text-[10px] bg-slate-950 p-3 rounded-xl border border-white/5 font-black flex items-center gap-3"><div className="w-1.5 h-1.5 bg-orange-500 rounded-full" /> {m.grad} {m.nume}</div>
                  ))}
                </div>
              </div>
            )}

            {paginaCurenta === 'lista' && (
              <div className="space-y-2">
                {echipa.map(m => (
                  <div key={m.id} className="flex flex-col gap-1">
                    <button onClick={() => setMembruEditat(membruEditat === m.id ? null : m.id)} className={`w-full bg-slate-900 p-5 rounded-2xl border transition-all flex justify-between items-center ${membruEditat === m.id ? 'border-blue-500 shadow-lg bg-slate-800' : 'border-slate-800'}`}>
                      {formatIdentitate(m)}
                      <span className={`text-[9px] font-black px-4 py-2 rounded-lg text-white shadow-sm ${statusConfig[m[`status_${ziKey}`]]?.color || 'bg-slate-700'}`}>{m[`status_${ziKey}`] || 'NESPECIFICAT'}</span>
                    </button>
                    {membruEditat === m.id && (
                      <div className="grid grid-cols-2 gap-2 p-4 bg-slate-950 rounded-b-3xl border-x border-b border-slate-800 animate-in slide-in-from-top-2">
                        {Object.keys(statusConfig).map(st => (
                          <button key={st} onClick={() => schimbaStatus(m.id, st)} className="p-3 rounded-xl bg-slate-900 text-[9px] font-black uppercase border border-slate-800 flex items-center gap-2 hover:bg-slate-800 transition-all">{statusConfig[st].icon} {st}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} />}
            {paginaCurenta === 'config_servicii' && <ConfigurareEfectiv />}
          </div>
        ) : (
          /* USER VIEW */
          <div className="space-y-4">
            <button onClick={() => { vibreaza(40); setPaginaCurenta(paginaCurenta === 'servicii_u' ? 'personal' : 'servicii_u'); }} className="w-full bg-slate-900 border-2 border-slate-800 p-6 rounded-[2rem] font-black uppercase flex justify-between items-center shadow-xl group">
              <div className="flex items-center gap-4"><Shield className="text-blue-500 group-hover:scale-110 transition-transform" /><span className="text-sm">Planificare Servicii</span></div>
              <ExternalLink size={20} className="opacity-30" />
            </button>

            {paginaCurenta === 'servicii_u' ? (
              <div className="animate-in fade-in duration-300"><ServiciiPage editabil={true} /></div>
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h2 className="text-center font-black text-[10px] text-blue-400 mb-6 uppercase tracking-[0.2em]">Selectează Status {optiuniZile[ziSelectata].label}</h2>
                  <div className="grid gap-3">
                    {Object.keys(statusConfig).map(st => {
                      const activ = echipa.find(e => e.id === userLogat.id)?.[`status_${ziKey}`] === st;
                      return (
                        <button key={st} onClick={() => schimbaStatus(userLogat.id, st)} className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all ${activ ? 'bg-white text-black border-white shadow-xl scale-[1.02]' : 'bg-slate-950 border-slate-800 opacity-60 text-white hover:opacity-100'}`}>
                          <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                          <span className="font-black text-sm uppercase">{st}</span>
                          {activ && <Check size={24} className="ml-auto" strokeWidth={4} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <h2 className="text-center font-black text-[10px] text-orange-500 mb-6 uppercase tracking-[0.2em]">Masa la Cantină</h2>
                  {(() => {
                    const m = echipa.find(e => e.id === userLogat.id);
                    const mananca = m?.[`cantina_${ziKey}`];
                    const statusAzi = m?.[`status_${ziKey}`];
                    const poateManca = statusAzi === "Prezent la serviciu";
                    return (
                      <button onClick={() => poateManca && toggleCantina(userLogat.id, mananca)} disabled={!poateManca} className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all ${!poateManca ? 'opacity-20 cursor-not-allowed bg-slate-950 border-slate-800' : mananca ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="flex gap-4 font-black uppercase text-sm items-center"><Utensils /> {mananca ? "ÎNSCRIAS LA CANTINĂ" : "MĂNÂNC ACASĂ"}</div>
                        {poateManca ? (mananca ? <Check strokeWidth={4} /> : <X strokeWidth={4} className="text-red-500" />) : <AlertTriangle className="text-orange-500" />}
                      </button>
                    );
                  })()}
                  {!echipa.find(e => e.id === userLogat.id)?.[`status_${ziKey}`] && <p className="text-center text-[9px] mt-4 text-slate-500 font-bold uppercase italic">Alege statusul pentru a debloca masa</p>}
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