import React, { useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ro } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const ZILE_SAPTAMANA = ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'];

// Calendar afișat direct în pagină: prima apăsare = data de început, a doua = data de sfârșit.
// deLa / panaLa sunt șiruri yyyy-MM-dd.
const CalendarInterval = ({ deLa, panaLa, onChange }) => {
  const [luna, setLuna] = useState(() => startOfMonth(deLa ? parseISO(deLa) : new Date()));
  const [alegeSfarsit, setAlegeSfarsit] = useState(false);

  const zile = eachDayOfInterval({
    start: startOfWeek(startOfMonth(luna), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(luna), { weekStartsOn: 1 })
  });

  const apasa = (data) => {
    if (navigator.vibrate) navigator.vibrate(15);
    const zi = format(data, 'yyyy-MM-dd');
    if (!alegeSfarsit || zi < deLa) {
      onChange(zi, zi);
      setAlegeSfarsit(true);
    } else {
      onChange(deLa, zi);
      setAlegeSfarsit(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className={`text-center text-[11px] font-black ${alegeSfarsit ? 'text-amber-300' : 'text-sky-300'}`}>
        {alegeSfarsit ? '2. Apasă pe data de sfârșit' : '1. Apasă pe data de început'}
      </p>

      <div className="flex items-center justify-between">
        <button onClick={() => setLuna(subMonths(luna, 1))} className="bg-slate-900 border border-slate-800 p-2 rounded-xl active:scale-95"><ChevronLeft size={18} /></button>
        <p className="text-sm font-black uppercase">{format(luna, 'MMMM yyyy', { locale: ro })}</p>
        <button onClick={() => setLuna(addMonths(luna, 1))} className="bg-slate-900 border border-slate-800 p-2 rounded-xl active:scale-95"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {ZILE_SAPTAMANA.map(z => (
          <div key={z} className="text-[9px] font-black uppercase text-slate-500 py-1">{z}</div>
        ))}
        {zile.map(data => {
          const zi = format(data, 'yyyy-MM-dd');
          const eStart = zi === deLa;
          const eSfarsit = zi === panaLa;
          const inInterval = deLa && panaLa && zi > deLa && zi < panaLa;
          const dinLuna = isSameMonth(data, luna);
          return (
            <button
              key={zi}
              onClick={() => apasa(data)}
              className={`h-10 rounded-xl text-sm font-black transition-all active:scale-90
                ${eStart || eSfarsit ? 'bg-blue-600 text-white' : inInterval ? 'bg-blue-600/30 text-white' : 'bg-slate-900 text-slate-200'}
                ${!dinLuna ? 'opacity-30' : ''}
                ${isToday(data) && !eStart && !eSfarsit ? 'ring-1 ring-green-500' : ''}`}
            >
              {format(data, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarInterval;
