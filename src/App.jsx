import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, onSnapshot, doc, updateDoc, query, orderBy, addDoc, serverTimestamp, deleteField
} from 'firebase/firestore';
import { telegramActiv, trimiteTelegram } from './telegram';
import { useConectareTelegram } from './useConectareTelegram';
import { ruleazaSarciniTelegram, setariTelegramComplete, trimiteRaportAdminilor } from './telegramAutomat';
import ConectareTelegram from './ConectareTelegram';
import TelegramAdminPage from './TelegramAdminPage';
import ServiciileMele from './ServiciileMele';
import CalendarInterval from './CalendarInterval';
import GraficeServiciiPage from './GraficeServiciiPage';
import AnunturiAdminPage from './AnunturiAdminPage';
import { STATUSURI_ABSENTA, serviciiPlanificateInZile, textConflict } from './verificareServicii';

// Statusurile care se pot pune pe mai multe zile odată.
const STATUSURI_MULTI_ZILE = ['Concediu', 'Deplasare', 'Foaie de boala', 'Spitalul militar', 'Studii'];
import { numeFrumos as formatNumeSimplu } from './serviciiConfig';
import { format, addDays, parse, parseISO, differenceInCalendarDays } from 'date-fns';
import { useZiCurenta } from './useZiCurenta';
import { ro } from 'date-fns/locale';
import { 
  Activity, Briefcase, Umbrella, Coffee, Home, MapPin, 
  Stethoscope, Hospital, GraduationCap, CalendarDays, Utensils, Check, Lock, LogOut, 
  Shield, X, ExternalLink, ChevronDown, ChevronUp, Search, FileText, Copy, Send
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
  "Spitalul militar": { color: "bg-rose-800", icon: <Hospital size={20} /> },
  "Studii": { color: "bg-teal-700", icon: <GraduationCap size={20} /> },
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
  
  // Selectorul „câte zile” deschis: cheie `${persoanaId}|${status}` (un singur selector deschis odată).
  const [multiDeschis, setMultiDeschis] = useState(null);
  const [deLa, setDeLa] = useState('');   // yyyy-MM-dd
  const [panaLa, setPanaLa] = useState('');
  const [setariTelegram, setSetariTelegram] = useState({});
  const [echipaIncarcata, setEchipaIncarcata] = useState(false);

  // Funcție utilitară pentru vibrație
  const vibreaza = (ms = 40) => {
    if (navigator.vibrate) navigator.vibrate(ms);
  };

  const ziCurenta = useZiCurenta();
  const optiuniZile = useMemo(() => {
    const azi = parse(ziCurenta, 'yyyyMMdd', new Date());
    return [0, 1, 2, 3, 4, 5, 6, 7].map(i => {
      const d = addDays(azi, i);
      let label = i === 0 ? "Azi" : i === 1 ? "Mâine" : format(d, 'eeee', { locale: ro });
      return { label, data: d, key: format(d, 'yyyyMMdd') };
    });
  }, [ziCurenta]);

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


  // Datele „vii” ale utilizatorului logat (nu cele salvate la login în localStorage),
  // ca după o redenumire să se vadă numele nou și să vină notificările corecte.
  // Pentru admin-ul general (parola 0000) nu există persoană în efectiv (fără id).
  const userLive = userLogat?.id
    ? (echipa.find(e => e.id === userLogat.id) || userLogat)
    : userLogat;
  const esteAdminPersonal = userLogat?.rol === 'admin' && Boolean(userLogat?.id);

  // --- TELEGRAM ---
  const userId = userLogat?.rol === 'user' ? userLogat.id : null;

  const conectareTelegram = useConectareTelegram(async (chatId) => {
    await updateDoc(doc(db, "echipa", userId), { telegramChatId: chatId });
    await trimiteTelegram(chatId, '✅ Te-ai conectat. Aici vei primi notificările despre servicii.');
  });

  const deconecteazaTelegram = async () => {
    vibreaza(40);
    await updateDoc(doc(db, "echipa", userId), { telegramChatId: deleteField() });
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "telegram"), (snap) => {
      setSetariTelegram(snap.exists() ? snap.data() : {});
    });
    return () => unsub();
  }, []);

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
      setEchipaIncarcata(true);
    });
    return () => unsubscribe();
  }, []);

  // Dacă admin-ul dezactivează/șterge persoana sau îi schimbă parola, sesiunea se închide.
  useEffect(() => {
    if (!userLogat?.id || !echipaIncarcata) return;
    const eu = echipa.find(e => e.id === userLogat.id);
    // Se închide și când admin-ului i se dă sau i se ia dreptul de administrator.
    const dreptSchimbat = (userLogat.rol === 'admin') !== (eu?.esteAdmin === true);
    if (!eu || String(eu.cod) !== String(userLogat.cod) || dreptSchimbat) {
      localStorage.removeItem('userEfectiv');
      setUserLogat(null);
      setPaginaCurenta('login');
    }
  }, [echipa, echipaIncarcata, userLogat]);

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

    if (!echipaIncarcata) return; // lista încă se încarcă — nu numărăm ca încercare greșită

    const gasit = echipa.find(m => String(m.cod) === String(cod) && m.activ !== false);

    if (gasit) {
      vibreaza(60);
      const u = { ...gasit, rol: gasit.esteAdmin === true ? 'admin' : 'user' };
      setUserLogat(u);
      setTentativeGresite(0);
      setEroareLogin(false);
      localStorage.setItem('userEfectiv', JSON.stringify(u));
      setPaginaCurenta(u.rol === 'admin' ? 'categorii' : 'personal');
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
        facutDeNume: !userLogat?.id
          ? 'Administrator'
          : `${numePentruIstoric(userLive)}${userLogat.rol === 'admin' ? ' (admin)' : ''}`,
        facutDeRol: userLogat?.rol || 'necunoscut',
        dataClient: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('Nu am putut salva istoricul:', e);
    }
  };

  // Nu se poate pune concediu / zi liberă / deplasare / boală peste un serviciu planificat.
  const [avertizare, setAvertizare] = useState('');
  const esteBlocatDeServiciu = async (persoana, status, zile) => {
    if (!persoana || !STATUSURI_ABSENTA.includes(status)) return false;
    try {
      const conflicte = await serviciiPlanificateInZile(persoana, zile);
      if (!conflicte.length) {
        setAvertizare('');
        return false;
      }
      const eu = userLogat?.id && persoana.id === userLogat.id;
      setAvertizare(textConflict(eu ? null : formatNumeSimplu(persoana), status, conflicte));
      vibreaza([80, 60, 80]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return true;
    } catch (e) {
      console.warn('Verificare servicii:', e);
      return false;
    }
  };

  const schimbaStatus = async (id, nouStatus) => {
    vibreaza(40);
    const ziKeyFiltru = optiuniZile[ziSelectata].key;
    const membru = echipa.find(m => m.id === id);
    const statusCurent = getStatusMembru(membru);
    if (statusCurent === "În serviciu" || statusCurent === "După serviciu") return;
    if (await esteBlocatDeServiciu(membru, nouStatus, [optiuniZile[ziSelectata].data])) return;
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

  // Concediu, deplasare, studii, spital, foaie de boală: pe o perioadă „De la – Până la”.
  const zileInterval = (() => {
    if (!deLa || !panaLa) return 0;
    const n = differenceInCalendarDays(parseISO(panaLa), parseISO(deLa)) + 1;
    return n > 0 ? n : 0;
  })();

  const aplicaStatusPeZile = async (persoana, status) => {
    if (!persoana || !zileInterval) return;
    if (zileInterval > 366) {
      setAvertizare('Perioada este prea lungă (maxim 366 de zile).');
      return;
    }
    vibreaza(80);
    const dataStart = parseISO(deLa);
    const zile = Array.from({ length: zileInterval }, (_, i) => addDays(dataStart, i));
    if (await esteBlocatDeServiciu(persoana, status, zile)) return;

    const updates = {};
    zile.forEach(d => {
      const key = format(d, 'yyyyMMdd');
      updates[`status_${key}`] = status;
      updates[`cantina_${key}`] = false;
    });

    await updateDoc(doc(db, "echipa", persoana.id), updates);
    await scrieIstoric("Status pe mai multe zile", {
      status,
      dataStart: format(dataStart, 'dd.MM.yyyy'),
      dataSfarsit: format(zile[zile.length - 1], 'dd.MM.yyyy'),
      numarZile: zileInterval
    }, persoana);
    setMultiDeschis(null);
    setMembruEditat(null);
  };

  const comutaSelectorZile = (cheie) => {
    vibreaza(40);
    const start = format(optiuniZile[ziSelectata].data, 'yyyy-MM-dd');
    setDeLa(start);
    setPanaLa(start);
    setMultiDeschis(multiDeschis === cheie ? null : cheie);
  };

  const selectorZile = (persoana, status) => (
    <div className="bg-slate-950 border-2 border-slate-700 p-5 rounded-[2rem] space-y-4 animate-in slide-in-from-top-4 duration-300">
      <p className="text-center text-[10px] font-black uppercase text-slate-300">Perioada — {status}</p>
      <CalendarInterval
        deLa={deLa}
        panaLa={panaLa}
        onChange={(start, sfarsit) => { setDeLa(start); setPanaLa(sfarsit); }}
      />
      {deLa && panaLa && (
        <p className="text-center text-[11px] font-bold text-slate-400">
          De la <span className="text-white font-black">{format(parseISO(deLa), 'dd.MM.yyyy')}</span> până la <span className="text-white font-black">{format(parseISO(panaLa), 'dd.MM.yyyy')}</span>
        </p>
      )}
      <p className="text-center text-sm font-black text-white">
        {zileInterval ? `${zileInterval} ${zileInterval === 1 ? 'zi' : 'zile'}` : 'Alege datele'}
      </p>
      <button
        disabled={!zileInterval}
        onClick={() => aplicaStatusPeZile(persoana, status)}
        className={`w-full ${statusConfig[status]?.color || 'bg-blue-600'} disabled:opacity-40 py-4 rounded-xl font-black uppercase text-sm active:scale-95 transition-transform`}
      >
        Aplică {status}{zileInterval ? ` (${zileInterval} ${zileInterval === 1 ? 'zi' : 'zile'})` : ''}
      </button>
    </div>
  );

  const toggleCantina = async (id, stare) => {
    vibreaza(50);
    const membru = echipa.find(m => m.id === id);
    await updateDoc(doc(db, "echipa", id), { [`cantina_${ziKey}`]: !stare });
    await scrieIstoric("Modificare cantină", {
      data: format(optiuniZile[ziSelectata].data, 'dd.MM.yyyy'),
      stareNoua: !stare ? 'La cantină' : 'Acasă'
    }, membru);
  };

  const getStatusMembru = (m, key = ziKey) => {
    const realTimeMembru = echipa.find(e => e.id === m.id);
    if (!realTimeMembru) return "Prezent la serviciu";
    const manual = realTimeMembru[`status_${key}`];
    const plan = serviciiPlan[key] || {};
    const esteInPlan = plan.responsabil === m.id || (plan.interventie && plan.interventie.includes(m.id));
    if (manual === "Concediu" || manual === "Foaie de boala" || manual === "Spitalul militar" || manual === "Studii") return manual;
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

  const categoriiPentru = (key) => Object.keys(statusConfig).reduce((acc, status) => {
    acc[status] = echipa.filter(m => getStatusMembru(m, key) === status);
    return acc;
  }, {});

  const categorii = categoriiPentru(ziKey);

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

  const numePentruRaport = (m) => {
    const grad = m.grad || "";
    const prenume = m.prenume
      ? m.prenume.charAt(0).toUpperCase() + m.prenume.slice(1).toLowerCase()
      : "";
    const nume = m.nume ? m.nume.toUpperCase() : "";

    return `${grad} ${prenume} ${nume}`.trim();
  };

  const textRaport = (index = ziSelectata) => {
    const { key, data } = optiuniZile[index];
    const categoriiZi = categoriiPentru(key);
    const dataRaport = format(data, 'dd.MM.yyyy');
    const linii = [`RAPORT EFECTIV`, `Data: ${dataRaport}`, ``];

    Object.keys(statusConfig).forEach(status => {
      const oameni = categoriiZi[status] || [];

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

    const oameniCantina = echipa.filter(m => m[`cantina_${key}`] === true);

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
    } catch {
      alert('Nu am putut copia automat. Selectează textul și copiază manual.');
    }
  };

  const [raportSeTrimite, setRaportSeTrimite] = useState(false);
  const trimiteRaportTelegram = async () => {
    vibreaza(40);
    if (!setariTelegramComplete(setariTelegram).adminChatIds.length) {
      alert('Niciun cont de administrator conectat. Mergi la Setări → Telegram și conectează-te.');
      return;
    }
    setRaportSeTrimite(true);
    try {
      const nr = await trimiteRaportAdminilor(setariTelegram, textRaport());
      alert(nr ? 'Raportul a fost trimis pe Telegram.' : 'Nu am putut trimite raportul pe Telegram.');
    } finally {
      setRaportSeTrimite(false);
    }
  };

  // Raportul de dimineață și memento-ul de seară pornesc din aplicația oricui e logat.
  const textRaportAziRef = useRef(null);
  useEffect(() => {
    textRaportAziRef.current = () => textRaport(0);
  });

  useEffect(() => {
    if (!telegramActiv || !userLogat || !echipaIncarcata) return;
    let oprit = false;
    const ruleaza = () => {
      if (oprit || !textRaportAziRef.current) return;
      ruleazaSarciniTelegram({ setari: setariTelegram, textRaportAzi: textRaportAziRef.current })
        .catch(e => console.warn('Sarcini Telegram:', e));
    };
    const timerStart = setTimeout(ruleaza, 5000);
    const interval = setInterval(ruleaza, 5 * 60 * 1000);
    return () => { oprit = true; clearTimeout(timerStart); clearInterval(interval); };
  }, [userLogat, echipaIncarcata, setariTelegram]);

  const adminPages = ['categorii', 'cantina', 'lista', 'servicii', 'setari'];

  const adminLabel = (p) => p
    .replace('categorii', 'sumar')
    .replace('cantina', 'masă')
    .replace('setari', 'setări')
    .replace('luna', 'luna');

  const paginiDinSetari = ['luna', 'reguli', 'efectiv', 'istoric', 'telegram', 'anunturi', 'grafice'];
  const arataInapoiSetari = userLogat?.rol === 'admin' && paginiDinSetari.includes(paginaCurenta);

  if (paginaCurenta === 'login') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
        <form
          onSubmit={(e) => { e.preventDefault(); login(inputCod); }}
          className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 w-full max-w-sm text-center"
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><Lock size={32} /></div>
          <h1 className="text-2xl font-black uppercase mb-8 tracking-tighter">Acces Sistem</h1>
          <input type="password" value={inputCod} onChange={(e) => setInputCod(e.target.value)} autoFocus enterKeyHint="go"
            className="w-full bg-slate-950 border-2 border-slate-800 p-5 rounded-2xl text-center text-2xl focus:border-blue-500 outline-none mb-4 text-white" placeholder="Parolă" autoComplete="current-password" />
          {eroareLogin && (
            <div className="mb-4 p-3 rounded-2xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-black uppercase">
              {blocatPana ? 'Prea multe încercări. Așteaptă 10 secunde.' : 'Cod incorect sau utilizator inactiv.'}
            </div>
          )}
          <button type="submit" disabled={!echipaIncarcata} className="w-full bg-blue-600 py-5 rounded-2xl font-black uppercase active:scale-95 transition-transform disabled:opacity-50">
            {echipaIncarcata ? 'Intră' : 'Se încarcă...'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-28">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6 bg-slate-900 p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-3 rounded-xl"><CalendarDays size={24} /></div>
            <div>
              {userLogat?.rol === 'admin' && !esteAdminPersonal
                ? <h1 className="text-lg font-black uppercase">Administrator</h1>
                : formatIdentitate(userLive)}
              {esteAdminPersonal && (
                <span className="inline-block mt-1 bg-amber-600/20 text-amber-300 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase">Administrator</span>
              )}
            </div>
          </div>
          <button onClick={logout} className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl"><LogOut size={24}/></button>
        </div>

        {avertizare && (
          <div className="mb-4 bg-red-950/50 border-2 border-red-600 rounded-2xl p-4 flex items-start justify-between gap-3">
            <p className="text-xs font-black text-red-200 leading-relaxed">⚠️ {avertizare}</p>
            <button onClick={() => setAvertizare('')} className="shrink-0 bg-red-900/60 p-2 rounded-xl active:scale-95"><X size={14} /></button>
          </div>
        )}

        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-2">
          {optiuniZile.map((zi, index) => (
            <button key={zi.key} onClick={() => { vibreaza(20); setZiSelectata(index); }} 
              className={`flex-1 min-w-[100px] py-4 rounded-2xl border-2 transition-all ${ziSelectata === index ? 'bg-blue-700 border-blue-400' : 'bg-slate-900 border-slate-800 opacity-60'}`}>
              <p className="text-[10px] font-black uppercase opacity-60 mb-1">{zi.label}</p>
              <p className="text-sm font-black text-white">{format(zi.data, 'dd MMM')}</p>
            </button>
          ))}
        </div>

        <div className="space-y-3 mb-8">
          {((userLogat?.rol === 'user' && paginaCurenta !== 'servicii') || (esteAdminPersonal && paginaCurenta === 'categorii')) && <ServiciileMele persoana={userLive} />}
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

            {paginaCurenta === 'servicii' && <ServiciiPage editabil={true} onLog={scrieIstoric} />}

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
                onOpenTelegram={telegramActiv ? () => setPaginaCurenta('telegram') : undefined}
                onOpenAnunturi={() => setPaginaCurenta('anunturi')}
                onOpenGrafice={() => setPaginaCurenta('grafice')}
              />
            )}
            {paginaCurenta === 'istoric' && <IstoricPage />}
            {paginaCurenta === 'telegram' && <TelegramAdminPage onLog={scrieIstoric} persoanaId={esteAdminPersonal ? userLogat.id : null} />}
            {paginaCurenta === 'anunturi' && <AnunturiAdminPage onLog={scrieIstoric} />}
            {paginaCurenta === 'grafice' && <GraficeServiciiPage onLog={scrieIstoric} />}
            
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
                        <div className="p-4 bg-slate-950 border-x border-b border-slate-800 rounded-b-3xl space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            {Object.keys(statusConfig).map(st => {
                              const multi = STATUSURI_MULTI_ZILE.includes(st);
                              const deschis = multiDeschis === `${m.id}|${st}`;
                              return (
                                <button
                                  key={st}
                                  onClick={() => multi ? comutaSelectorZile(`${m.id}|${st}`) : schimbaStatus(m.id, st)}
                                  className={`flex items-center gap-2 p-3 rounded-xl text-white text-[9px] font-black uppercase border active:bg-slate-800 ${deschis ? `${statusConfig[st].color} border-white/40` : 'bg-slate-900 border-slate-800'}`}
                                >
                                  {statusConfig[st].icon} {st}
                                  {multi && <span className="ml-auto">{deschis ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>}
                                </button>
                              );
                            })}
                          </div>
                          {multiDeschis?.startsWith(`${m.id}|`) && selectorZile(m, multiDeschis.split('|')[1])}
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
                      {telegramActiv && (
                        <button
                          onClick={trimiteRaportTelegram}
                          disabled={raportSeTrimite}
                          className="mt-3 w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-xs flex items-center justify-center gap-2"
                        >
                          <Send size={16} />
                          {raportSeTrimite ? 'Se trimite...' : 'Trimite pe Telegram'}
                        </button>
                      )}
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
                 <ServiciiPage editabil={true} onLog={scrieIstoric} />
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
                      
                      if (STATUSURI_MULTI_ZILE.includes(st)) {
                        const cheie = `${userLogat.id}|${st}`;
                        const deschis = multiDeschis === cheie;
                        return (
                          <div key={st} className="flex flex-col gap-2">
                            <button disabled={esteBlocat} onClick={() => comutaSelectorZile(cheie)}
                              className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all
                                ${activ ? `${statusConfig[st].color} text-white border-white/40 shadow-lg` : 'bg-slate-950 border-slate-800 text-white opacity-70'}
                                ${esteBlocat ? 'opacity-40 cursor-not-allowed grayscale' : ''}`}>
                              <div className={`p-2 rounded-lg ${activ ? 'bg-white/90 text-black' : 'bg-slate-800'}`}>{statusConfig[st].icon}</div>
                              <span className="text-sm uppercase font-black text-left">{st}</span>
                              <div className="ml-auto flex items-center gap-2">
                                {activ && !esteBlocat && <Check size={20} strokeWidth={4} />}
                                {esteBlocat && <Lock size={20} />}
                                {!esteBlocat && (deschis ? <ChevronUp size={20}/> : <ChevronDown size={20}/>)}
                              </div>
                            </button>
                            {deschis && !esteBlocat && selectorZile(userLive, st)}
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

                {telegramActiv && (() => {
                  const eu = echipa.find(e => e.id === userLogat.id);
                  const conectat = Boolean(eu?.telegramChatId);

                  return (
                    <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-xl">
                      <h2 className="text-center text-xs font-black uppercase text-sky-400 mb-4 tracking-widest">Notificări Telegram</h2>
                      {conectat ? (
                        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl border-2 bg-sky-600/20 border-sky-500">
                          <div className="flex items-center gap-3">
                            <Send size={22} className="text-sky-300" />
                            <span className="text-sm font-black uppercase">Conectat</span>
                          </div>
                          <button onClick={deconecteazaTelegram} className="text-[10px] font-black uppercase bg-slate-800 px-4 py-2 rounded-xl active:scale-95">Deconectează</button>
                        </div>
                      ) : (
                        <ConectareTelegram
                          conectare={conectareTelegram}
                          descriere="Primești pe Telegram mesaj când ești pus sau scos din serviciu și un memento seara."
                        />
                      )}
                    </div>
                  );
                })()}
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