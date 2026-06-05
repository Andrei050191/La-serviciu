import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, addDoc, serverTimestamp, where 
} from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ro } from 'date-fns/locale';
import { 
  Activity, Briefcase, Umbrella, Coffee, Home, MapPin, 
  Stethoscope, CalendarDays, Utensils, Check, Lock, LogOut, 
  Shield, X, ExternalLink, ChevronDown, ChevronUp, Search, FileText, Copy, Bell, CheckCheck
} from 'lucide-react';

import ServiciiPage from './ServiciiPage';
import ConfigurareEfectiv from './ConfigurareEfectiv';
import EfectivPage from './EfectivPage';
import IstoricPage from './IstoricPage';
import SetariServiciiPage from './SetariServiciiPage';
import EfectivLunaPage from './EfectivLunaPage';

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
  const [serviciiPlan, setServiciiPlan] = useState({});
  const [paginaCurenta, setPaginaCurenta] = useState('login');
  const [ziSelectata, setZiSelectata] = useState(0); 
  const [userLogat, setUserLogat] = useState(null);
  const [inputCod, setInputCod] = useState("");
  const [eroareLogin, setEroareLogin] = useState(false);
  const [membruEditat, setMembruEditat] = useState(null);
  const [cautareLista, setCautareLista] = useState('');
  const [cautareCantina, setCautareCantina] = useState('');
  const [raportDeschis, setRaportDeschis] = useState(false);
  const [tentativeGresite, setTentativeGresite] = useState(0);
  const [blocatPana, setBlocatPana] = useState(null);
  
  const [showConcediuSelect, setShowConcediuSelect] = useState(false);
  const [numarZileConcediu, setNumarZileConcediu] = useState(1);
  const [notificari, setNotificari] = useState([]);

  // Funcție utilitară pentru vibrație
  const vibreaza = (ms = 40) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const optiuniZile = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
    const d = addDays(new Date(), i);
    let label = i === 0 ? "Azi" : i === 1 ? "Mâine" : format(d, 'eeee', { locale: ro });
    return { label, data: d, key: format(d, 'yyyyMMdd') };
  }), []);

  const ziKey = optiuniZile[ziSelectata].key;

  const formatIdentitate = (m) => {
    if (!m) return null;
    const formatGrad = (grad) => {
      if (!grad) return "";
      return grad.split(' ').map(cuvant => {
        if (/^[IVXLC]+$/i.test(cuvant)) return cuvant.toUpperCase();
        return cuvant.toLowerCase();
      }).join(' ');
    };
    const formatPrenume = (p) => {
      if (!p) return "";
      return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
    };
    const formatNume = (n) => n ? n.toUpperCase() : "";

    return (
      <div className="flex flex-col text-left">
        <span className="text-xs font-medium text-white/70 leading-none mb-1">
          {formatGrad(m.grad)}
        </span>
        <span className="text-lg font-black text-white">
          {formatPrenume(m.prenume)} {formatNume(m.nume)}
        </span>
      </div>
    );
  };


  const numeCompletPentruNotificari = (m) => {
    if (!m) return '';
    return `${m.grad || ''} ${m.prenume || ''} ${m.nume || ''}`.trim().toUpperCase();
  };

  useEffect(() => {
    if (userLogat?.rol !== 'user') {
      setNotificari([]);
      return;
    }

    const numeComplet = numeCompletPentruNotificari(userLogat);
    if (!numeComplet) return;

    const q = query(
      collection(db, "notificari"),
      where("userNumeComplet", "==", numeComplet),
      where("citit", "==", false)
    );

    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lista.sort((a, b) => {
        const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.dataClient || 0).getTime();
        const dbb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.dataClient || 0).getTime();
        return dbb - da;
      });
      setNotificari(lista);
    });

    return () => unsub();
  }, [userLogat?.id, userLogat?.rol]);

  const marcheazaNotificareCitita = async (id) => {
    await updateDoc(doc(db, "notificari", id), {
      citit: true,
      cititLa: serverTimestamp()
    });
  };

  const marcheazaToateNotificarileCitite = async () => {
    await Promise.all(notificari.map(n => marcheazaNotificareCitita(n.id)));
  };

  useEffect(() => {
    const unsubServicii = onSnapshot(doc(db, "planificare", "servicii"), (d) => {
      if (d.exists()) setServiciiPlan(d.data());
    });
    return () => unsubServicii();
  }, []);

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
      setEchipa(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(m => m.activ !== false));
    });
    return () => unsubscribe();
  }, []);

  const login = (cod) => {
    if (blocatPana && Date.now() < blocatPana) {
      vibreaza([80, 60, 80]);
      return;
    }

    if (cod === "0000") {
      vibreaza(100);
      const admin = { rol: 'admin', nume: 'Administrator' };
      setUserLogat(admin);
      setTentativeGresite(0);
      setEroareLogin(false);
      localStorage.setItem('userEfectiv', JSON.stringify(admin));
      setPaginaCurenta('categorii');
      return;
    }

    const gasit = echipa.find(m => String(m.cod) === String(cod) && m.activ !== false);

    if (gasit) {
      vibreaza(60);
      const u = { ...gasit, rol: 'user' };
      setUserLogat(u);
      setTentativeGresite(0);
      setEroareLogin(false);
      localStorage.setItem('userEfectiv', JSON.stringify(u));
      setPaginaCurenta('personal');
    } else {
      vibreaza([50, 50, 50]);
      const nrNou = tentativeGresite + 1;
      setTentativeGresite(nrNou);
      setEroareLogin(true);
      setInputCod("");

      if (nrNou >= 5) {
        setBlocatPana(Date.now() + 10000);
        setTimeout(() => {
          setTentativeGresite(0);
          setBlocatPana(null);
        }, 10000);
      }
    }
  };

  const logout = () => { vibreaza(30); localStorage.removeItem('userEfectiv'); setUserLogat(null); setPaginaCurenta('login'); };

  const numePentruIstoric = (m) => {
    if (!m) return "Necunoscut";
    return `${m.grad || ''} ${m.prenume || ''} ${m.nume || ''}`.trim();
  };

  const scrieIstoric = async (actiune, detalii = {}, persoanaVizata = null) => {
    try {
      await addDoc(collection(db, "istoric_modificari"), {
        actiune,
        detalii,
        persoanaVizataId: persoanaVizata?.id || null,
        persoanaVizataNume: persoanaVizata ? numePentruIstoric(persoanaVizata) : null,
        facutDeId: userLogat?.id || null,
        facutDeNume: userLogat?.rol === 'admin' ? 'Administrator' : numePentruIstoric(userLogat),
        facutDeRol: userLogat?.rol || 'necunoscut',
        dataClient: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Nu am putut salva istoricul:', e);
    }
  };

  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(40);
    const ziKeyFiltru = optiuniZile[ziSelectata].key;
    const membru = echipa.find(m => m.id === id);
    const statusCurent = getStatusMembru(membru);
    if (statusCurent === "În serviciu" || statusCurent === "După serviciu") return;
    const updateObj = { [`status_${ziKeyFiltru}`]: nouStatus };
    if (nouStatus !== "Prezent la serviciu") {
      updateObj[`cantina_${ziKeyFiltru}`] = false;
    }
    await updateDoc(doc(db, "echipa", id), updateObj);
    await scrieIstoric("Schimbare status", {
      data: format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy'),
      statusVechi: statusCurent,
      statusNou: nouStatus
    }, membru);
    setMembruEditat(null);
  };

  const aplicaConcediuLung = async () => {
    vibreaza(80);
    const updates = {};
    const dataStart = optiuniZile[ziSelectata].data; // Folosim data selectată de user
    
    for (let i = 0; i < numarZileConcediu; i++) {
      const dataViitoare = addDays(dataStart, i);
      const key = format(dataViitoare, 'yyyyMMdd');
      updates[`status_${key}`] = "Concediu";
      updates[`cantina_${key}`] = false;
    }
    await updateDoc(doc(db, "echipa", userLogat.id), updates);
    await scrieIstoric("Concediu aplicat", {
      dataStart: format(dataStart, 'dd.MM.yyyy'),
      numarZile: numarZileConcediu
    }, userLogat);
    setShowConcediuSelect(false);
  };

  const toggleCantina = async (id, stare) => {
    vibreaza(50);
    const membru = echipa.find(m => m.id === id);
    await updateDoc(doc(db, "echipa", id), { [`cantina_${ziKey}`]: !stare });
    await scrieIstoric("Modificare cantină", {
      data: format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy'),
      stareNoua: !stare ? 'La cantină' : 'Acasă'
    }, membru);
  };

  const getStatusMembru = (m) => {
    const realTimeMembru = echipa.find(e => e.id === m.id);
    if (!realTimeMembru) return "Prezent la serviciu";
    const manual = realTimeMembru[`status_${ziKey}`];
    const plan = serviciiPlan[ziKey] || {};
    const esteInPlan = plan.responsabil === m.id || (plan.interventie && plan.interventie.includes(m.id));
    if (manual === "Concediu" || manual === "Foaie de boala") return manual;
    if (esteInPlan) return "În serviciu";
    return manual || "Prezent la serviciu";
  };

  const poateMancaLaCantina = (mId) => {
    const m = echipa.find(e => e.id === mId);
    if (!m) return false;
    const status = getStatusMembru(m);
    const plan = serviciiPlan[ziKey] || {};
    const esteInPlan = plan.responsabil === mId || (plan.interventie && plan.interventie.includes(mId));
    return status === "Prezent la serviciu" || esteInPlan;
  };

  const nrLaCantina = echipa.filter(m => m[`cantina_${ziKey}`] === true).length;

  const categorii = Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m) === status);
    return acc;
  }, {});

  const normalizeText = (txt = '') => txt.toString().toLowerCase().trim();

  const echipaFiltrataLista = echipa.filter(m => {
    const q = normalizeText(cautareLista);
    if (!q) return true;
    return normalizeText(`${m.grad || ''} ${m.prenume || ''} ${m.nume || ''} ${m.cod || ''}`).includes(q);
  });

  const echipaFiltrataCantina = echipa.filter(m => {
    const q = normalizeText(cautareCantina);
    if (!q) return true;
    return normalizeText(`${m.grad || ''} ${m.prenume || ''} ${m.nume || ''} ${m.cod || ''}`).includes(q);
  });

  const statisticiSumar = {
    prezenti: categorii["Prezent la serviciu"]?.length || 0,
    inServiciu: categorii["În serviciu"]?.length || 0,
    dupaServiciu: categorii["După serviciu"]?.length || 0,
    cantina: nrLaCantina
  };

  const numePentruRaport = (m) => {
    const grad = m.grad || "";
    const prenume = m.prenume
      ? m.prenume.charAt(0).toUpperCase() + m.prenume.slice(1).toLowerCase()
      : "";
    const nume = m.nume ? m.nume.toUpperCase() : "";

    return `${grad} ${prenume} ${nume}`.trim();
  };

  const textRaport = () => {
    const dataRaport = format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy');
    const linii = [`RAPORT EFECTIV`, `Data: ${dataRaport}`, ``];

    Object.keys(statusConfig).forEach(status => {
      const oameni = categorii[status] || [];

      linii.push(`${status}: ${oameni.length}`);

      if (oameni.length > 0) {
        oameni.forEach(m => {
          linii.push(`- ${numePentruRaport(m)}`);
        });
      } else {
        linii.push(`- Nu sunt`);
      }

      linii.push(``);
    });

    const oameniCantina = echipa.filter(m => m[`cantina_${ziKey}`] === true);

    linii.push(`Masa la cantină: ${oameniCantina.length}`);

    if (oameniCantina.length > 0) {
      oameniCantina.forEach(m => {
        linii.push(`- ${numePentruRaport(m)}`);
      });
    } else {
      linii.push(`- Nu sunt`);
    }

    return linii.join('\n');
  };

  const copiazaRaport = async () => {
    try {
      await navigator.clipboard.writeText(textRaport());
      alert('Raportul a fost copiat.');
    } catch (e) {
      alert('Nu am putut copia automat. Selectează textul și copiază manual.');
    }
  };

  const adminPages = ['categorii', 'cantina', 'lista', 'servicii', 'setari'];

  const adminLabel = (p) => p
    .replace('categorii', 'sumar')
    .replace('cantina', 'masă')
    .replace('setari', 'setări')
    .replace('luna', 'luna');

  const paginiDinSetari = ['luna', 'reguli', 'efectiv', 'istoric'];
  const arataInapoiSetari = userLogat?.rol === 'admin' && paginiDinSetari.includes(paginaCurenta);

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
          <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)}
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-2xl focus:border-blue-500 outline-none mb-4 text-white" placeholder="Parolă" autoComplete="current-password" />
          {eroareLogin && (
            <div className="mb-4 p-3 rounded-2xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-black uppercase">
              {blocatPana && Date.now() < blocatPana ? 'Prea multe încercări. Așteaptă 10 secunde.' : 'Cod incorect sau utilizator inactiv.'}
            </div>
          )}
          <button onClick={() => login(inputCod)} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase active:scale-95 transition-transform">Intră</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-28">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>{userLogat?.rol === 'admin' ? <h1 className="text-lg font-black uppercase">Administrator</h1> : formatIdentitate(userLogat)}</div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"><LogOut size={24}/></button>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => { vibreaza(20); setZiSelectata(index); }} 
              className={`flex-1 min-w-[100px] py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 mb-1">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>


        {userLogat?.rol === 'user' && notificari.length > 0 && (
          <div className="mb-4 bg-blue-950/30 border border-blue-700/50 rounded-[2rem] p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-2xl text-white">
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-blue-200 tracking-widest">Notificări noi</p>
                  <p className="text-[10px] text-slate-400 font-bold">Modificări la servicii</p>
                </div>
              </div>
              <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-black text-white">{notificari.length}</span>
            </div>

            <div className="space-y-2">
              {notificari.slice(0, 3).map((n) => (
                <div key={n.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3">
                  <p className="text-sm font-black text-white leading-snug">{n.mesaj}</p>
                  {(n.functie || n.dataServiciu) && (
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                      {[n.functie, n.dataServiciu].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={marcheazaToateNotificarileCitite}
              className="mt-3 w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl p-3 font-black uppercase text-xs flex items-center justify-center gap-2"
            >
              <CheckCheck size={16} />
              Am înțeles
            </button>
          </div>
        )}

        <div className="space-y-3 mb-8">
          {userLogat?.rol === 'user' && (
            <button onClick={() => { vibreaza(40); setPaginaCurenta(paginaCurenta === 'servicii' ? 'personal' : 'servicii'); }} 
              className="w-full bg-slate-900 border-2 border-slate-800 p-5 rounded-[2rem] flex items-center justify-between shadow-xl active:scale-[0.98] transition-all">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white"><Shield size={22} /></div>
                <div className="text-left"><p className="font-black text-xs uppercase tracking-widest">Planificarea Serviciilor</p></div>
              </div>
              <ExternalLink size={20} className="text-blue-500 opacity-50" />
            </button>
          )}
        </div>

        {userLogat?.rol === 'admin' ? (
          <div className="space-y-6">
            <div className="hidden md:flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mb-4 overflow-x-auto gap-1">
              {adminPages.map((p) => (
                <button key={p} onClick={() => { vibreaza(25); setPaginaCurenta(p); }} className={`flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase whitespace-nowrap ${paginaCurenta === p ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>
                  {adminLabel(p)}
                </button>
              ))}
            </div>

            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} />}

            {arataInapoiSetari && (
              <button
                onClick={() => { vibreaza(25); setPaginaCurenta('setari'); }}
                className="mb-4 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-[10px] font-black uppercase text-slate-300 active:scale-95"
              >
                Înapoi la setări
              </button>
            )}

            {paginaCurenta === 'luna' && <EfectivLunaPage />}
            {paginaCurenta === 'reguli' && <ConfigurareEfectiv />}
            {paginaCurenta === 'efectiv' && <EfectivPage userLogat={userLogat} onLog={scrieIstoric} />}
            {paginaCurenta === 'setari' && (
              <SetariServiciiPage
                onLog={scrieIstoric}
                onOpenIstoric={() => setPaginaCurenta('istoric')}
                onOpenLuna={() => setPaginaCurenta('luna')}
                onOpenReguli={() => setPaginaCurenta('reguli')}
                onOpenEfectiv={() => setPaginaCurenta('efectiv')}
              />
            )}
            {paginaCurenta === 'istoric' && <IstoricPage />}
            
            {paginaCurenta === 'lista' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                  <Search size={18} className="text-slate-500" />
                  <input
                    value={cautareLista}
                    onChange={(e) => setCautareLista(e.target.value)}
                    placeholder="Caută după nume, grad sau cod..."
                    className="w-full bg-transparent outline-none text-sm font-bold text-white placeholder:text-slate-600"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3">
                {echipaFiltrataLista.map(m => {
                  const status = getStatusMembru(m);
                  const isEditing = membruEditat === m.id;
                  const esteBlocat = status === "În serviciu" || status === "După serviciu";
                  return (
                    <div key={m.id} className="flex flex-col gap-1">
                      <button disabled={esteBlocat} onClick={() => { vibreaza(30); setMembruEditat(isEditing ? null : m.id); }}
                        className={`bg-slate-900 p-5 rounded-2xl border flex justify-between items-center ${isEditing ? 'border-blue-500' : 'border-slate-800'} ${esteBlocat ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {formatIdentitate(m)}
                        <div className="flex items-center gap-2">
                           {esteBlocat && <Lock size={12} className="text-slate-400" />}
                           <span className={`text-[9px] font-black px-3 py-2 rounded-lg text-white ${statusConfig[status]?.color || 'bg-slate-800'}`}>{status}</span>
                        </div>
                      </button>
                      {isEditing && (
                        <div className="grid grid-cols-2 gap-2 p-4 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl">
                          {Object.keys(statusConfig).map(st => (
                            <button key={st} onClick={() => schimbaStatus(m.id, st)} className="flex items-center gap-2 p-3 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase border border-slate-800 active:bg-slate-800">{statusConfig[st].icon} {st}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
            )}
            
            {paginaCurenta === 'cantina' && (
              <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
                 <h2 className="text-lg font-black uppercase text-orange-500 mb-6 text-center">Masa la cantină ({nrLaCantina})</h2>
                 <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center gap-3 mb-4">
                   <Search size={18} className="text-slate-500" />
                   <input
                     value={cautareCantina}
                     onChange={(e) => setCautareCantina(e.target.value)}
                     placeholder="Caută persoana..."
                     className="w-full bg-transparent outline-none text-sm font-bold text-white placeholder:text-slate-600"
                   />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                   {echipaFiltrataCantina.map(m => {
                     const poateManca = poateMancaLaCantina(m.id);
                     return (
                       <button key={m.id} disabled={!poateManca} onClick={() => toggleCantina(m.id, m[`cantina_${ziKey}`])} 
                         className={`flex justify-between items-center p-4 rounded-xl border-2 transition-all 
                           ${!poateManca ? 'opacity-20 bg-slate-950 border-transparent cursor-not-allowed grayscale' : 
                             m[`cantina_${ziKey}`] ? 'bg-orange-600 border-orange-400' : 'bg-slate-950 border-slate-800'}`}>
                         <div className="text-left">{formatIdentitate(m)}</div>
                         {poateManca && (m[`cantina_${ziKey}`] ? <Check size={18} strokeWidth={4}/> : <div className="w-5 h-5 border-2 border-slate-800 rounded-full"/>)}
                       </button>
                     );
                   })}
                 </div>
              </div>
            )}

            {paginaCurenta === 'categorii' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-4">
                  <button
                    onClick={() => setRaportDeschis(!raportDeschis)}
                    className="w-full bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-xs flex items-center justify-center gap-2"
                  >
                    <FileText size={18} />
                    Generează raport
                  </button>

                  {raportDeschis && (
                    <div className="mt-4 bg-slate-950 border border-slate-800 rounded-2xl p-4">
                      <textarea
                        readOnly
                        value={textRaport()}
                        className="w-full min-h-[230px] bg-black/30 border border-slate-800 rounded-2xl p-4 text-sm text-white font-mono outline-none"
                      />
                      <button
                        onClick={copiazaRaport}
                        className="mt-3 w-full bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-xs flex items-center justify-center gap-2"
                      >
                        <Copy size={16} />
                        Copiază raportul
                      </button>
                    </div>
                  )}
                </div>

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
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {paginaCurenta === 'servicii' ? (
              <div className="space-y-4">
                 <div className="flex justify-between items-center bg-slate-900 border border-slate-800 rounded-[2rem] px-4 py-3 shadow-xl">
                    <h2 className="text-xs font-black uppercase text-blue-400 tracking-widest">Editare Servicii</h2>
                    <button onClick={() => { vibreaza(30); setPaginaCurenta('personal'); }} className="text-[10px] font-black bg-slate-800 px-4 py-2 rounded-xl italic">Înapoi</button>
                 </div>
                 <ServiciiPage editabil={true} />
              </div>
            ) : (
              <>
                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                  <h2 className="text-center text-xs font-black uppercase text-blue-400 mb-6 tracking-widest">Unde te afli {optiuniZile[ziSelectata].label}?</h2>
                  <div className="grid grid-cols-1 gap-3">
                    {Object.keys(statusConfig).map(st => {
                      const statusCurent = getStatusMembru(userLogat);
                      const activ = statusCurent === st;
                      const esteStatusDeServiciu = st === "În serviciu" || st === "După serviciu";
                      const esteBlocat = statusCurent === "În serviciu" || statusCurent === "După serviciu" || esteStatusDeServiciu;
                      
                      if (st === "Concediu") {
                        return (
                          <div key={st} className="flex flex-col gap-2">
                            <button disabled={esteBlocat} onClick={() => { vibreaza(40); setShowConcediuSelect(!showConcediuSelect); }} 
                              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all 
                                ${activ ? 'bg-purple-600 text-white border-purple-400 shadow-lg' : 'bg-slate-950 border-slate-800 text-white opacity-70'}
                                ${esteBlocat ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}>
                              <div className={`p-2 rounded-lg ${activ ? 'bg-white text-purple-600' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                              <span className="text-sm uppercase font-black text-left">{st}</span>
                              <div className="ml-auto flex items-center gap-2">
                                {activ && !esteBlocat && <Check size={20} strokeWidth={4} />}
                                {esteBlocat && <Lock size={20} />}
                                {!esteBlocat && (showConcediuSelect ? <ChevronUp size={20}/> : <ChevronDown size={20}/>)}
                              </div>
                            </button>
                            {showConcediuSelect && !esteBlocat && (
                              <div className="bg-slate-950 border-2 border-purple-500/50 p-6 rounded-[2rem] animate-in slide-in-from-top-4 duration-300">
                                 <p className="text-center text-[10px] font-black uppercase text-purple-400 mb-4">Câte zile pleci în concediu?</p>
                                 <div className="flex items-center justify-between mb-6">
                                   <button onClick={() => { vibreaza(20); setNumarZileConcediu(Math.max(1, numarZileConcediu - 1)); }} className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center font-black">-</button>
                                   <span className="text-4xl font-black">{numarZileConcediu}</span>
                                   <button onClick={() => { vibreaza(20); setNumarZileConcediu(Math.min(45, numarZileConcediu + 1)); }} className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center font-black">+</button>
                                 </div>
                                 <button onClick={aplicaConcediuLung} className="w-full bg-purple-600 py-4 rounded-xl font-black uppercase text-sm active:scale-95 transition-transform">Aplică Concediul</button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      return (
                        <button key={st} disabled={esteBlocat} onClick={() => schimbaStatus(userLogat.id, st)} 
                          className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all 
                            ${activ ? 'bg-white text-black border-white shadow-lg' : 'bg-slate-950 border-slate-800 text-white opacity-70'}
                            ${esteBlocat ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}>
                          <div className={`p-2 rounded-lg ${activ ? 'bg-black text-white' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                          <div className="flex flex-col text-left">
                            <span className="text-sm uppercase font-black">{st}</span>
                            {esteBlocat && activ && <span className="text-[9px] font-bold text-red-600 uppercase">Status Automat</span>}
                          </div>
                          {activ && (esteBlocat ? <Lock size={20} className="ml-auto" /> : <Check size={24} className="ml-auto" strokeWidth={4} />)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                  <h2 className="text-center text-xs font-black uppercase text-orange-500 mb-6 tracking-widest">Masa la cantină ({nrLaCantina})</h2>
                  {(() => {
                    const realTimeSelf = echipa.find(e => e.id === userLogat.id);
                    const poateManca = poateMancaLaCantina(userLogat.id);
                    const mananca = realTimeSelf ? realTimeSelf[`cantina_${ziKey}`] : false;
                    
                    return (
                      <button onClick={() => poateManca && toggleCantina(userLogat.id, mananca)} disabled={!poateManca}
                        className={`w-full flex justify-between items-center p-6 rounded-2xl border-2 transition-all 
                          ${!poateManca ? 'bg-red-950/20 border-red-900/50 opacity-50 cursor-not-allowed' : 
                            mananca ? 'bg-orange-600 border-orange-400 shadow-lg' : 'bg-slate-950 border-slate-800'}`}>
                        <div className="flex items-center gap-4">
                          <Utensils size={24} />
                          <span className="text-sm uppercase font-black">{mananca ? "LA CANTINĂ" : "ACASĂ"}</span>
                        </div>
                        {mananca ? <Check size={24} strokeWidth={4}/> : <X size={24} className="text-red-500" strokeWidth={4}/>}
                      </button>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {userLogat?.rol === 'admin' && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur border-t border-slate-800 px-2 py-1 md:hidden">
          <div className="grid grid-cols-5 gap-1 max-w-4xl mx-auto">
            {adminPages.map((p) => (
              <button
                key={p}
                onClick={() => { vibreaza(25); setPaginaCurenta(p); }}
                className={`py-4 px-1 rounded-xl font-black text-[13px] uppercase ${paginaCurenta === p ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-500'}`}
              >
                {adminLabel(p)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
export default App;