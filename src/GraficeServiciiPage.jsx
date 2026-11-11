import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { addMonths, eachDayOfInterval, endOfMonth, format, isToday, isWeekend, startOfMonth, subMonths } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { literaServiciu, normalizeServiciiConfigurate, numarInterventieDin, numeCompletDin, numeFrumos, pozitieMaximaServicii } from './serviciiConfig';
import { ALTA_SUBUNITATE, listaEligibilitate, motivIndisponibil, numarInterventiiDinZi, seteazaNumarInterventii, seteazaServiciu } from './planificare';

const prescurtareStatus = {
  'Zi liberă': 'ZL',
  'Concediu': 'CONC',
  'Deplasare': 'DEPL',
  'Foaie de boala': 'BOALĂ',
  'Spitalul militar': 'SPIT',
  'Studii': 'STUD',
  'După serviciu': 'DUPĂ'
};

const ID_INTERVENTIE = 'interventia_comuna';
const MAX_INTERVENTII = 10;

// Grafic lunar pentru UN serviciu: rânduri = persoanele eligibile, coloane = zilele lunii.
// O bifă = persoana e pusă la acest serviciu în ziua respectivă (exact ca din Planificarea serviciilor).
// Intervenția are un singur tabel comun; numărul de oameni pe zi se alege din capul coloanei.
const GraficeServiciiPage = ({ onLog }) => {
  const [personal, setPersonal] = useState([]);
  const [calendar, setCalendar] = useState({});
  const [reguli, setReguli] = useState({});
  const [serviciiZilnic, setServiciiZilnic] = useState({});
  const [serviciiConfigurate, setServiciiConfigurate] = useState(normalizeServiciiConfigurate([]));
  const [tabId, setTabId] = useState(null);
  const [luna, setLuna] = useState(startOfMonth(new Date()));
  const [ocupat, setOcupat] = useState(null); // celula care se salvează
  const [mesaj, setMesaj] = useState('');

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, 'echipa'), orderBy('ordine', 'asc')), (snap) => {
      setPersonal(snap.docs
        .map(d => ({ id: d.id, ...d.data(), numeComplet: numeCompletDin(d.data()) }))
        .filter(p => p.activ !== false));
    });
    const unsubC = onSnapshot(doc(db, 'servicii', 'calendar'), (snap) => {
      setCalendar(snap.exists() ? (snap.data().data || {}) : {});
    });
    const unsubR = onSnapshot(doc(db, 'setari', 'reguli_servicii'), (snap) => {
      setReguli(snap.exists() ? snap.data() : {});
    });
    const unsubS = onSnapshot(doc(db, 'setari', 'servicii'), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const zilnic = { ...(data.serviciiZilnic || {}) };
      if (data.operatorRadioZilnic === true) zilnic['Operator radio'] = true;
      setServiciiZilnic(zilnic);
      setServiciiConfigurate(normalizeServiciiConfigurate(data.serviciiConfigurate));
    });
    return () => { unsubP(); unsubC(); unsubR(); unsubS(); };
  }, []);

  const serviciiActive = useMemo(() => serviciiConfigurate.filter(s => s.activ !== false), [serviciiConfigurate]);
  const interventii = useMemo(() => serviciiActive
    .filter(s => numarInterventieDin(s.nume))
    .sort((a, b) => numarInterventieDin(a.nume) - numarInterventieDin(b.nume)), [serviciiActive]);
  const totalPozitii = useMemo(() => pozitieMaximaServicii(serviciiConfigurate), [serviciiConfigurate]);

  // Tab-uri: fiecare serviciu separat, iar toate intervențiile într-un singur tab „Intervenția”.
  const taburi = useMemo(() => {
    const rezultat = [];
    let interventieAdaugata = false;
    serviciiActive.forEach(s => {
      if (numarInterventieDin(s.nume)) {
        if (!interventieAdaugata) {
          rezultat.push({ id: ID_INTERVENTIE, nume: 'Intervenția' });
          interventieAdaugata = true;
        }
        return;
      }
      rezultat.push(s);
    });
    return rezultat;
  }, [serviciiActive]);

  const zile = useMemo(() => eachDayOfInterval({ start: startOfMonth(luna), end: endOfMonth(luna) }), [luna]);

  const tab = taburi.find(t => t.id === tabId) || taburi[0];
  if (!tab) {
    return <div className="p-10 text-center text-white opacity-50 font-black tracking-[0.2em]">SE ÎNCARCĂ...</div>;
  }
  const esteInterventie = tab.id === ID_INTERVENTIE;

  const eligibili = (() => {
    const lista = listaEligibilitate(reguli, esteInterventie ? (interventii[0]?.nume || 'Intervenția 1') : tab.nume);
    return lista.length ? personal.filter(p => lista.includes(p.numeComplet)) : personal;
  })();

  const numeDupaComplet = (nc) => {
    if (!nc || nc === ALTA_SUBUNITATE) return nc;
    const p = personal.find(x => x.numeComplet === nc);
    return p ? numeFrumos(p) : nc;
  };

  const ziCal = (data) => calendar[format(data, 'dd.MM.yyyy')] || {};

  // Pozițiile acestui tab care contează în ziua respectivă.
  const pozitiiInZi = (data) => {
    if (!esteInterventie) return [tab];
    const nr = numarInterventiiDinZi(ziCal(data));
    return interventii.filter(s => numarInterventieDin(s.nume) <= nr);
  };

  // Serviciul (din acest tab) la care e persoana în ziua respectivă.
  const serviciulPersoanei = (persoana, data) => {
    const oameni = ziCal(data).oameni || [];
    return pozitiiInZi(data).find(s => oameni[s.pozitie] === persoana.numeComplet) || null;
  };

  // Orice alt serviciu (din alt tab) la care e persoana în ziua respectivă.
  const altServiciu = (persoana, data) => {
    const oameni = ziCal(data).oameni || [];
    const aleTabului = new Set(pozitiiInZi(data).map(s => s.pozitie));
    const nrInterv = numarInterventiiDinZi(ziCal(data));
    return serviciiActive.find(s =>
      !aleTabului.has(s.pozitie)
      && !(numarInterventieDin(s.nume) > nrInterv)
      && oameni[s.pozitie] === persoana.numeComplet
    ) || null;
  };

  const salveaza = async (cheie, functie) => {
    if (navigator.vibrate) navigator.vibrate(20);
    setOcupat(cheie);
    setMesaj('');
    try {
      await functie();
    } catch (e) {
      console.error(e);
      setMesaj('Nu am putut salva. Verifică internetul și încearcă din nou.');
    } finally {
      setOcupat(null);
    }
  };

  const apasaCelula = async (persoana, data) => {
    if (ocupat) return;
    const ziKey = format(data, 'dd.MM.yyyy');
    const oameni = ziCal(data).oameni || [];
    const pusAici = serviciulPersoanei(persoana, data);

    // Scoatere
    if (pusAici) {
      await salveaza(`${persoana.id}|${ziKey}`, () => seteazaServiciu({
        ziKey, functie: pusAici.nume, pozitie: pusAici.pozitie, valoare: ALTA_SUBUNITATE,
        personal, calendar, totalPozitii, onLog, numeFrumos: numeDupaComplet
      }));
      return;
    }

    // Punere: la serviciu simplu = poziția lui; la intervenție = primul loc liber.
    let tinta = tab;
    if (esteInterventie) {
      tinta = pozitiiInZi(data).find(s => !oameni[s.pozitie] || oameni[s.pozitie] === ALTA_SUBUNITATE);
      if (!tinta) {
        const nr = numarInterventiiDinZi(ziCal(data));
        setMesaj(`La intervenție pe ${format(data, 'dd.MM')} toate cele ${nr} locuri sunt ocupate. Mărește numărul din capul coloanei.`);
        return;
      }
    }

    const motiv = motivIndisponibil({
      persoana, ziKey, pozitie: tinta.pozitie, functie: tinta.nume,
      omPlanificat: oameni[tinta.pozitie], calendar, serviciiZilnic
    });
    if (motiv) {
      setMesaj(`${numeFrumos(persoana)} nu poate fi pus pe ${format(data, 'dd.MM')}: ${motiv}.`);
      return;
    }

    await salveaza(`${persoana.id}|${ziKey}`, () => seteazaServiciu({
      ziKey, functie: tinta.nume, pozitie: tinta.pozitie, valoare: persoana.numeComplet,
      personal, calendar, totalPozitii, onLog, numeFrumos: numeDupaComplet
    }));
  };

  const schimbaNumarInterventii = async (data, numarNou) => {
    if (ocupat) return;
    const ziKey = format(data, 'dd.MM.yyyy');
    await salveaza(`nr|${ziKey}`, () => seteazaNumarInterventii({
      ziKey,
      numarCurent: numarInterventiiDinZi(ziCal(data)),
      numarNou,
      serviciiConfigurate,
      totalPozitii,
      personal,
      onLog,
      numeFrumos: numeDupaComplet
    }));
  };

  const totalPersoana = (persoana) => zile.filter(d => serviciulPersoanei(persoana, d)).length;

  // Ultimul rând: câte locuri sunt ocupate în ziua respectivă.
  const ocupareZi = (data) => {
    const oameni = ziCal(data).oameni || [];
    const pozitii = pozitiiInZi(data);
    const ocupate = pozitii.filter(s => oameni[s.pozitie] && oameni[s.pozitie] !== ALTA_SUBUNITATE);
    const dinAfara = ocupate.filter(s => !eligibili.some(p => p.numeComplet === oameni[s.pozitie]));
    return { total: pozitii.length, ocupate: ocupate.length, dinAfara: dinAfara.map(s => numeDupaComplet(oameni[s.pozitie])) };
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-3 rounded-2xl"><CalendarRange size={24} /></div>
          <div>
            <h2 className="text-lg font-black uppercase">Grafice servicii</h2>
            <p className="text-xs text-slate-400 font-bold">Bifează cine intră în serviciu, pe fiecare zi a lunii</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {taburi.map(t => (
            <button
              key={t.id}
              onClick={() => { setTabId(t.id); setMesaj(''); }}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap border ${t.id === tab.id ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
            >
              {t.nume}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button onClick={() => setLuna(subMonths(luna, 1))} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl active:scale-95"><ChevronLeft size={18} /></button>
          <p className="text-sm font-black uppercase">{format(luna, 'MMMM yyyy', { locale: ro })}</p>
          <button onClick={() => setLuna(addMonths(luna, 1))} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl active:scale-95"><ChevronRight size={18} /></button>
        </div>

        {mesaj && (
          <div className="bg-red-950/50 border border-red-700 rounded-2xl p-3 text-xs font-black text-red-200">⚠️ {mesaj}</div>
        )}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-950/80">
                <th className="sticky left-0 z-20 bg-slate-950 p-3 text-left text-[10px] font-black uppercase text-slate-400 border-r border-slate-800 min-w-[170px]">
                  {tab.nume}
                </th>
                {zile.map(d => (
                  <th key={d.toISOString()} className={`p-1 text-center text-[10px] font-black border-r border-slate-800 min-w-[38px] ${isToday(d) ? 'bg-green-600/30 text-green-200' : isWeekend(d) ? 'text-amber-300' : 'text-slate-400'}`}>
                    <div>{format(d, 'dd')}</div>
                    <div className="text-[8px] opacity-70 uppercase">{format(d, 'EEEEEE', { locale: ro })}</div>
                  </th>
                ))}
                <th className="p-2 text-center text-[10px] font-black uppercase text-slate-400 min-w-[50px]">Total</th>
              </tr>
              {esteInterventie && (
                <tr className="bg-slate-950/60 border-t border-slate-800">
                  <th className="sticky left-0 z-20 bg-slate-950 p-2 text-left text-[9px] font-black uppercase text-amber-300 border-r border-slate-800">
                    Câte persoane pe zi
                  </th>
                  {zile.map(d => {
                    const nr = numarInterventiiDinZi(ziCal(d));
                    const seSalveaza = ocupat === `nr|${format(d, 'dd.MM.yyyy')}`;
                    return (
                      <th key={d.toISOString()} className="p-0.5 border-r border-slate-800">
                        <select
                          value={nr}
                          disabled={!!ocupat}
                          onChange={(e) => schimbaNumarInterventii(d, Number(e.target.value))}
                          style={{ fontSize: '13px' }}
                          className={`w-9 h-8 bg-amber-600/20 border border-amber-600/40 rounded-lg text-amber-200 font-black text-center appearance-none outline-none ${seSalveaza ? 'animate-pulse' : ''}`}
                        >
                          {Array.from({ length: Math.max(MAX_INTERVENTII, nr) }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                      </th>
                    );
                  })}
                  <th />
                </tr>
              )}
            </thead>
            <tbody>
              {eligibili.map(p => (
                <tr key={p.id} className="border-t border-slate-800">
                  <td className="sticky left-0 z-10 bg-slate-900 p-2 border-r border-slate-800">
                    <span className="text-[11px] font-black text-white leading-tight">{numeFrumos(p)}</span>
                  </td>
                  {zile.map(d => {
                    const ziKey = format(d, 'dd.MM.yyyy');
                    const pusAici = serviciulPersoanei(p, d);
                    const alt = pusAici ? null : altServiciu(p, d);
                    const status = p[`status_${format(d, 'yyyyMMdd')}`];
                    const statusScurt = !pusAici && !alt ? (prescurtareStatus[status] || '') : '';
                    const seSalveaza = ocupat === `${p.id}|${ziKey}`;
                    return (
                      <td key={ziKey} className={`p-0.5 border-r border-slate-800 text-center ${isToday(d) ? 'bg-green-600/10' : ''}`}>
                        <button
                          onClick={() => apasaCelula(p, d)}
                          disabled={!!ocupat}
                          title={pusAici ? `${pusAici.nume} — apasă ca să-l scoți` : alt ? `În serviciu: ${alt.nume}` : (status || '')}
                          className={`w-9 h-9 rounded-lg text-[10px] font-black transition-all active:scale-90
                            ${pusAici ? 'bg-blue-600 text-white'
                              : alt ? 'bg-slate-700 text-slate-300'
                                : statusScurt ? 'bg-slate-800/60 text-slate-500'
                                  : 'bg-slate-950 text-slate-700 hover:bg-slate-800'}
                            ${seSalveaza ? 'animate-pulse' : ''}`}
                        >
                          {pusAici ? literaServiciu(pusAici.nume) : alt ? literaServiciu(alt.nume) : statusScurt || '·'}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-2 text-center font-black text-white">{totalPersoana(p)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-700 bg-slate-950/60">
                <td className="sticky left-0 z-10 bg-slate-950 p-2 border-r border-slate-800 text-[10px] font-black uppercase text-slate-400">
                  {esteInterventie ? 'Ocupat / locuri' : 'Pus în ziua asta'}
                </td>
                {zile.map(d => {
                  const o = ocupareZi(d);
                  const complet = o.ocupate >= o.total;
                  return (
                    <td key={d.toISOString()} title={o.dinAfara.join(', ')} className="p-1 border-r border-slate-800 text-center text-[9px] font-black">
                      {esteInterventie
                        ? <span className={complet ? 'text-green-400' : 'text-amber-400'}>{o.ocupate}/{o.total}</span>
                        : complet ? <span className="text-green-400">✓</span> : <span className="text-amber-500">—</span>}
                      {o.dinAfara.length > 0 && <span className="text-slate-300">✱</span>}
                    </td>
                  );
                })}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-400 font-bold leading-relaxed space-y-1">
        <p>Apasă pe o pătrățică: apare litera serviciului <span className="text-blue-300">pe albastru</span> și omul e pus automat la acest serviciu (cu „În serviciu” și „După serviciu” a doua zi, ca la planificare). Apasă din nou ca să-l scoți.</p>
        <p>Literă <span className="text-slate-300">pe gri</span> = omul e deja în serviciu în ziua aceea, la alt serviciu. ZL, CONC, DEPL, DUPĂ... = statusul omului.</p>
        <p>Litere: {serviciiActive.filter((s, i, arr) => arr.findIndex(x => literaServiciu(x.nume) === literaServiciu(s.nume)) === i).map(s => `${literaServiciu(s.nume)} = ${numarInterventieDin(s.nume) ? 'Intervenția' : s.nume}`).join(', ')}.</p>
        {esteInterventie
          ? <p>Intervenția: alege sus, la fiecare zi, câte persoane trebuie. Bifele ocupă pe rând Intervenția 1, 2, 3... Ultimul rând arată ocupat/locuri.</p>
          : <p>Într-o zi poate fi un singur om la un serviciu: dacă bifezi pe altcineva, primul e înlocuit. Ultimul rând: ✓ = pus cineva, — = nimeni.</p>}
        <p>✱ = pus cineva care nu e în lista de Eligibilitate. Regulile de planificare se aplică la fel ca în Planificare.</p>
      </div>
    </div>
  );
};

export default GraficeServiciiPage;
