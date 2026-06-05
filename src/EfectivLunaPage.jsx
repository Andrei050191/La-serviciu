import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { addMonths, eachDayOfInterval, endOfMonth, format, isToday, startOfMonth, subMonths } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, UserCheck } from 'lucide-react';

const functii = [
  'Ajutor OSU',
  'Sergent de serviciu PCT',
  'Planton',
  'Patrulă',
  'Operator radio',
  'Intervenția 1',
  'Intervenția 2',
  'Responsabil'
];

const prescurtari = {
  'Ajutor OSU': 'A.OSU',
  'Sergent de serviciu PCT': 'PCT',
  'Planton': 'PL',
  'Patrulă': 'PAT',
  'Operator radio': 'RAD',
  'Intervenția 1': 'INT1',
  'Intervenția 2': 'INT2',
  'Responsabil': 'RESP'
};


const statusPrescurtari = {
  'În serviciu': 'SERV',
  'După serviciu': 'DUPĂ',
  'Zi liberă': 'ZL',
  'Concediu': 'CONC',
  'Deplasare': 'DEPL',
  'Foaie de boala': 'BOALĂ',
  'Foaie de boală': 'BOALĂ',
  'Nespecificat': '',
  'Prezent la serviciu': ''
};

const statusCulori = {
  'În serviciu': 'bg-blue-700 text-white',
  'După serviciu': 'bg-slate-600 text-white',
  'Zi liberă': 'bg-yellow-700 text-white',
  'Concediu': 'bg-purple-700 text-white',
  'Deplasare': 'bg-orange-700 text-white',
  'Foaie de boala': 'bg-red-700 text-white',
  'Foaie de boală': 'bg-red-700 text-white'
};

const EfectivLunaPage = () => {
  const [personal, setPersonal] = useState([]);
  const [calendar, setCalendar] = useState({});
  const [lunaCurenta, setLunaCurenta] = useState(startOfMonth(new Date()));

  useEffect(() => {
    const q = query(collection(db, 'echipa'), orderBy('ordine', 'asc'));
    const unsubPers = onSnapshot(q, (snap) => {
      setPersonal(snap.docs.map(d => ({
        id: d.id,
        numeComplet: `${d.data().grad || ''} ${d.data().prenume || ''} ${d.data().nume || ''}`.trim().toUpperCase(),
        ...d.data()
      })).filter(p => p.activ !== false));
    });

    const unsubCal = onSnapshot(doc(db, 'servicii', 'calendar'), (snap) => {
      setCalendar(snap.exists() ? (snap.data().data || {}) : {});
    });

    return () => {
      unsubPers();
      unsubCal();
    };
  }, []);

  const zileLuna = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(lunaCurenta), end: endOfMonth(lunaCurenta) });
  }, [lunaCurenta]);

  const afiseazaNumeFrumos = (p) => {
    if (!p) return '';

    const grad = (p.grad || '').split(' ').map(cuvant => {
      if (/^[IVXLC]+$/i.test(cuvant)) return cuvant.toUpperCase();
      return cuvant.toLowerCase();
    }).join(' ');

    const prenume = p.prenume
      ? p.prenume.charAt(0).toUpperCase() + p.prenume.slice(1).toLowerCase()
      : '';

    const nume = p.nume ? p.nume.toUpperCase() : '';
    return `${grad} ${prenume} ${nume}`.trim();
  };

  const serviciiPentruPersoanaInZi = (persoana, data) => {
    const key = format(data, 'dd.MM.yyyy');
    const oameni = calendar[key]?.oameni || [];

    return oameni
      .map((om, index) => om === persoana.numeComplet ? functii[index] : null)
      .filter(Boolean);
  };


  const statusPentruPersoanaInZi = (persoana, data) => {
    const key = format(data, 'yyyyMMdd');
    const status = persoana[`status_${key}`];
    if (!status || status === 'Prezent la serviciu' || status === 'Nespecificat') return '';
    return status;
  };

  const continutCelula = (persoana, data) => {
    const serv = serviciiPentruPersoanaInZi(persoana, data).map(s => prescurtari[s] || s);
    const status = statusPentruPersoanaInZi(persoana, data);
    const statusScurt = status ? (statusPrescurtari[status] || status) : '';
    return [...serv, ...(statusScurt ? [statusScurt] : [])];
  };

  const totalServicii = (persoana) => {
    return zileLuna.reduce((total, data) => total + serviciiPentruPersoanaInZi(persoana, data).length, 0);
  };

  const totalZi = (data) => {
    const key = format(data, 'dd.MM.yyyy');
    const oameni = calendar[key]?.oameni || [];
    return oameni.filter(om => om && om !== 'Din altă subunitate').length;
  };

  const copiazaTabel = async () => {
    const antet = ['Persoana', ...zileLuna.map(d => format(d, 'dd.MM')), 'Total'];
    const randuri = personal.map(p => {
      const celule = zileLuna.map(d => continutCelula(p, d).join('+'));
      return [afiseazaNumeFrumos(p), ...celule, String(totalServicii(p))].join('\t');
    });

    const text = [
      `TABEL SERVICII LUNA ${format(lunaCurenta, 'MMMM yyyy', { locale: ro }).toUpperCase()}`,
      antet.join('\t'),
      ...randuri
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      alert('Tabelul lunar a fost copiat.');
    } catch (e) {
      alert('Nu am putut copia automat.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <CalendarDays size={22} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tabel lunar servicii</p>
              <h2 className="text-xl font-black uppercase text-white">
                {format(lunaCurenta, 'MMMM yyyy', { locale: ro })}
              </h2>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setLunaCurenta(subMonths(lunaCurenta, 1))}
              className="bg-slate-950 border border-slate-800 p-3 rounded-2xl active:scale-95"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => setLunaCurenta(startOfMonth(new Date()))}
              className="bg-slate-950 border border-slate-800 px-4 rounded-2xl text-[10px] font-black uppercase active:scale-95"
            >
              Luna curentă
            </button>
            <button
              onClick={() => setLunaCurenta(addMonths(lunaCurenta, 1))}
              className="bg-slate-950 border border-slate-800 p-3 rounded-2xl active:scale-95"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-5">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-[9px] font-black uppercase text-slate-500">Efectiv</p>
            <p className="text-2xl font-black text-white">{personal.length}</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-center">
            <p className="text-[9px] font-black uppercase text-slate-500">Zile lună</p>
            <p className="text-2xl font-black text-white">{zileLuna.length}</p>
          </div>
          <button
            onClick={copiazaTabel}
            className="col-span-2 sm:col-span-1 bg-blue-600 rounded-2xl p-4 font-black uppercase text-xs flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <Copy size={16} /> Copiază tabel
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-[2rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-slate-950/80">
                <th className="sticky left-0 z-20 bg-slate-950 p-3 text-left text-[10px] font-black uppercase text-slate-400 border-r border-slate-800 min-w-[230px]">
                  Efectiv
                </th>
                {zileLuna.map(data => (
                  <th
                    key={data.toISOString()}
                    className={`p-2 text-center text-[10px] font-black border-r border-slate-800 min-w-[48px] ${isToday(data) ? 'bg-green-600/30 text-green-200' : 'text-slate-400'}`}
                  >
                    <div>{format(data, 'dd')}</div>
                    <div className="text-[8px] opacity-70 uppercase">{format(data, 'EEE', { locale: ro })}</div>
                  </th>
                ))}
                <th className="p-3 text-center text-[10px] font-black uppercase text-slate-400 min-w-[70px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {personal.map(p => {
                const total = totalServicii(p);
                return (
                  <tr key={p.id} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="sticky left-0 z-10 bg-slate-900 p-3 border-r border-slate-800">
                      <div className="flex items-center gap-2">
                        <UserCheck size={14} className="text-blue-400 shrink-0" />
                        <span className="text-[12px] font-black text-white leading-tight">{afiseazaNumeFrumos(p)}</span>
                      </div>
                    </td>
                    {zileLuna.map(data => {
                      const serv = serviciiPentruPersoanaInZi(p, data);
                      const status = statusPentruPersoanaInZi(p, data);
                      const celula = continutCelula(p, data);
                      return (
                        <td
                          key={data.toISOString()}
                          title={[...serv, status].filter(Boolean).join(', ')}
                          className={`p-1 text-center border-r border-slate-800 align-middle ${isToday(data) ? 'bg-green-600/10' : ''}`}
                        >
                          {celula.length > 0 ? (
                            <div className="inline-flex flex-col gap-1">
                              {serv.map(s => (
                                <span key={s} className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-1 rounded-lg leading-none">
                                  {prescurtari[s] || s}
                                </span>
                              ))}
                              {status && (
                                <span className={`${statusCulori[status] || 'bg-slate-700 text-white'} text-[9px] font-black px-1.5 py-1 rounded-lg leading-none`}>
                                  {statusPrescurtari[status] || status}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-700">·</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-black text-white">{total}</td>
                  </tr>
                );
              })}
              <tr className="border-t border-slate-700 bg-slate-950/60">
                <td className="sticky left-0 z-10 bg-slate-950 p-3 border-r border-slate-800 text-[10px] font-black uppercase text-slate-400">
                  Total pe zi
                </td>
                {zileLuna.map(data => (
                  <td key={data.toISOString()} className="p-2 text-center border-r border-slate-800 text-[11px] font-black text-slate-300">
                    {totalZi(data)}
                  </td>
                ))}
                <td className="p-3 text-center font-black text-blue-300">
                  {personal.reduce((suma, p) => suma + totalServicii(p), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-[11px] text-slate-400 font-bold leading-relaxed">
        Prescurtări: A.OSU = Ajutor OSU, SGT = Sergent de serviciu PCT, PL = Planton, PAT = Patrulă, RAD = Operator radio, INT1/INT2 = Intervenția, RESP = Responsabil. Statusuri afișate: CONC = Concediu, LIB = Zi liberă, DEPL = Deplasare, BOALĂ = Foaie de boală, DUPĂ = După serviciu. Statusul Prezent la serviciu nu se afișează.
      </div>
    </div>
  );
};

export default EfectivLunaPage;
