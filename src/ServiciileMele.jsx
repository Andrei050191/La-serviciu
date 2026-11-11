import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { addMonths, eachDayOfInterval, endOfMonth, format, isBefore, isToday, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ClipboardList } from 'lucide-react';
import { descarcaIcs, linkGoogleCalendar } from './calendarTelefon';
import { normalizeServiciiConfigurate, numarInterventieDin, numeCompletDin, serviciiPersoanaInZi } from './serviciiConfig';

// Lista serviciilor unei persoane pe lună + următorul serviciu.
const ServiciileMele = ({ persoana }) => {
  const [calendar, setCalendar] = useState({});
  const [serviciiConfigurate, setServiciiConfigurate] = useState(normalizeServiciiConfigurate([]));
  const [luna, setLuna] = useState(startOfMonth(new Date()));
  const [deschis, setDeschis] = useState(false);

  useEffect(() => {
    const unsubCal = onSnapshot(doc(db, 'servicii', 'calendar'), (snap) => {
      setCalendar(snap.exists() ? (snap.data().data || {}) : {});
    });
    const unsubServ = onSnapshot(doc(db, 'setari', 'servicii'), (snap) => {
      setServiciiConfigurate(normalizeServiciiConfigurate(snap.exists() ? snap.data().serviciiConfigurate : []));
    });
    return () => { unsubCal(); unsubServ(); };
  }, []);

  const serviciiActive = useMemo(() => serviciiConfigurate.filter(s => s.activ !== false), [serviciiConfigurate]);
  const numeComplet = numeCompletDin(persoana);

  const serviciiInZi = (data) => serviciiPersoanaInZi(calendar[format(data, 'dd.MM.yyyy')], numeComplet, serviciiActive);

  const zileCuServiciu = eachDayOfInterval({ start: startOfMonth(luna), end: endOfMonth(luna) })
    .map(data => ({ data, servicii: serviciiInZi(data) }))
    .filter(z => z.servicii.length > 0);

  const azi = startOfDay(new Date());
  const viitoare = Object.keys(calendar)
    .map(cheie => {
      const [zi, l, an] = cheie.split('.').map(Number);
      return new Date(an, l - 1, zi);
    })
    .filter(d => !Number.isNaN(d.getTime()) && !isBefore(d, azi))
    .sort((a, b) => a - b)
    .map(data => ({ data, servicii: serviciiInZi(data) }))
    .filter(z => z.servicii.length > 0);
  const urmatorul = viitoare[0];

  return (
    <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden">
      <button onClick={() => setDeschis(!deschis)} className="w-full p-5 flex items-center justify-between gap-4 text-left active:scale-[0.99] transition-all">
        <div className="flex items-center gap-4 min-w-0">
          <div className="bg-emerald-600 p-3 rounded-2xl text-white shrink-0"><ClipboardList size={22} /></div>
          <div className="min-w-0">
            <p className="font-black text-xs uppercase tracking-widest">Serviciile mele</p>
            <p className="text-[11px] text-slate-400 font-bold mt-1 truncate">
              {urmatorul
                ? `Următorul: ${isToday(urmatorul.data) ? 'azi' : format(urmatorul.data, 'EEEE dd.MM', { locale: ro })} — ${urmatorul.servicii.join(', ')}`
                : 'Niciun serviciu planificat'}
            </p>
          </div>
        </div>
        {deschis ? <ChevronUp size={20} className="shrink-0" /> : <ChevronDown size={20} className="shrink-0" />}
      </button>

      {deschis && (
        <div className="px-5 pb-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => setLuna(subMonths(luna, 1))} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl active:scale-95"><ChevronLeft size={18} /></button>
            <div className="text-center">
              <p className="text-sm font-black uppercase">{format(luna, 'MMMM yyyy', { locale: ro })}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total: {zileCuServiciu.reduce((t, z) => t + z.servicii.filter(s => !numarInterventieDin(s)).length, 0)} servicii (fără intervenție)</p>
            </div>
            <button onClick={() => setLuna(addMonths(luna, 1))} className="bg-slate-950 border border-slate-800 p-3 rounded-2xl active:scale-95"><ChevronRight size={18} /></button>
          </div>

          {viitoare.length > 0 && (
            <button
              onClick={() => descarcaIcs(viitoare, persoana?.id)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded-2xl p-4 font-black uppercase text-xs flex items-center justify-center gap-2"
            >
              <CalendarPlus size={16} /> Adaugă în calendarul telefonului ({viitoare.length})
            </button>
          )}

          {zileCuServiciu.length === 0 ? (
            <p className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center text-[11px] text-slate-500 font-black uppercase">Nu ai servicii în această lună</p>
          ) : (
            <div className="space-y-2">
              {zileCuServiciu.map(({ data, servicii }) => {
                const trecut = isBefore(data, azi);
                return (
                  <div
                    key={data.toISOString()}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border ${isToday(data) ? 'bg-green-600/20 border-green-500' : trecut ? 'bg-slate-950 border-slate-800 opacity-50' : 'bg-slate-950 border-slate-700'}`}
                  >
                    <span className="text-xs font-black uppercase">{format(data, 'EEEE, dd.MM', { locale: ro })}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-emerald-300 text-right">{servicii.join(', ')}</span>
                      {!trecut && (
                        <a
                          href={linkGoogleCalendar(data, servicii)}
                          target="_blank"
                          rel="noreferrer"
                          title="Adaugă în Google Calendar"
                          className="shrink-0 bg-slate-800 text-emerald-300 p-2 rounded-xl active:scale-95"
                        >
                          <CalendarPlus size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ServiciileMele;
