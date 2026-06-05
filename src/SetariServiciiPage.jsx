import React, { useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Settings, ToggleLeft, ToggleRight, Save, Plus, Pencil, Trash2, History, X, GripVertical, CalendarDays, ShieldAlert, Users } from 'lucide-react';
import { normalizeServiciiConfigurate, pozitieMaximaServicii } from './serviciiConfig';

const SetariServiciiPage = ({ onLog, onOpenIstoric, onOpenLuna, onOpenReguli, onOpenEfectiv }) => {
  const [serviciiZilnic, setServiciiZilnic] = useState({});
  const [serviciiConfigurate, setServiciiConfigurate] = useState([]);
  const [loading, setLoading] = useState(true);
  const [salvare, setSalvare] = useState(false);
  const [serviciuNou, setServiciuNou] = useState('');
  const [editId, setEditId] = useState(null);
  const [editNume, setEditNume] = useState('');
  const [dragId, setDragId] = useState(null);
  const [sectiune, setSectiune] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "setari", "servicii"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const valori = { ...(data.serviciiZilnic || {}) };

        if (data.operatorRadioZilnic === true) {
          valori["Operator radio"] = true;
        }

        setServiciiZilnic(valori);
        setServiciiConfigurate(normalizeServiciiConfigurate(data.serviciiConfigurate));
      } else {
        setServiciiConfigurate(normalizeServiciiConfigurate([]));
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const serviciiActive = useMemo(() => {
    return normalizeServiciiConfigurate(serviciiConfigurate).filter(s => s.activ !== false);
  }, [serviciiConfigurate]);

  const salveazaConfig = async (listaNoua, serviciiZilnicNou = serviciiZilnic) => {
    const listaNormalizata = normalizeServiciiConfigurate(listaNoua);
    await setDoc(doc(db, "setari", "servicii"), {
      serviciiConfigurate: listaNormalizata,
      serviciiZilnic: serviciiZilnicNou,
      operatorRadioZilnic: serviciiZilnicNou["Operator radio"] === true
    }, { merge: true });
  };

  const schimbaServiciu = async (functie) => {
    const valoareNoua = !(serviciiZilnic[functie] === true);
    const serviciiNoi = { ...serviciiZilnic, [functie]: valoareNoua };

    setServiciiZilnic(serviciiNoi);
    setSalvare(true);

    try {
      await salveazaConfig(serviciiConfigurate, serviciiNoi);

      if (onLog) {
        await onLog("Setare servicii", {
          camp: `${functie} zilnic`,
          valoare: valoareNoua ? "activat" : "dezactivat"
        }, null);
      }
    } catch (e) {
      console.error(e);
      alert("Nu am putut salva setarea.");
      setServiciiZilnic(serviciiZilnic);
    } finally {
      setSalvare(false);
    }
  };

  const adaugaServiciu = async () => {
    const nume = serviciuNou.trim();
    if (!nume) return;

    const exista = normalizeServiciiConfigurate(serviciiConfigurate)
      .some(s => s.nume.toLowerCase() === nume.toLowerCase() && s.activ !== false);

    if (exista) {
      alert('Serviciul acesta există deja.');
      return;
    }

    const lista = normalizeServiciiConfigurate(serviciiConfigurate);
    const pozitie = pozitieMaximaServicii(lista);
    const serviciu = {
      id: `serviciu_${Date.now()}`,
      nume,
      pozitie,
      ordineAfisare: serviciiActive.length,
      activ: true
    };

    const listaNoua = [...lista, serviciu];
    setServiciiConfigurate(listaNoua);
    setServiciuNou('');
    await salveazaConfig(listaNoua);

    if (onLog) {
      await onLog('Adăugare serviciu', { serviciu: nume }, null);
    }
  };

  const incepeEditare = (serviciu) => {
    setEditId(serviciu.id);
    setEditNume(serviciu.nume);
  };

  const salveazaEditare = async () => {
    const nume = editNume.trim();
    if (!nume || !editId) return;

    const lista = normalizeServiciiConfigurate(serviciiConfigurate);
    const vechi = lista.find(s => s.id === editId);

    const listaNoua = lista.map(s => s.id === editId ? { ...s, nume } : s);

    const serviciiZilnicNou = { ...serviciiZilnic };
    if (vechi && vechi.nume !== nume && serviciiZilnicNou[vechi.nume] !== undefined) {
      serviciiZilnicNou[nume] = serviciiZilnicNou[vechi.nume];
      delete serviciiZilnicNou[vechi.nume];
    }

    setServiciiConfigurate(listaNoua);
    setServiciiZilnic(serviciiZilnicNou);
    setEditId(null);
    setEditNume('');
    await salveazaConfig(listaNoua, serviciiZilnicNou);

    if (onLog) {
      await onLog('Modificare serviciu', { inainte: vechi?.nume || '', dupa: nume }, null);
    }
  };

  const stergeServiciu = async (serviciu) => {
    const ok = window.confirm(`Sigur vrei să ștergi serviciul „${serviciu.nume}”?\n\nPlanificările vechi rămân în baza de date, dar serviciul nu se mai afișează în aplicație.`);
    if (!ok) return;

    const lista = normalizeServiciiConfigurate(serviciiConfigurate);
    const listaNoua = lista.map(s => s.id === serviciu.id ? { ...s, activ: false } : s);
    const serviciiZilnicNou = { ...serviciiZilnic };
    delete serviciiZilnicNou[serviciu.nume];

    setServiciiConfigurate(listaNoua);
    setServiciiZilnic(serviciiZilnicNou);
    await salveazaConfig(listaNoua, serviciiZilnicNou);

    if (onLog) {
      await onLog('Ștergere serviciu', { serviciu: serviciu.nume }, null);
    }
  };


  const reordoneazaServicii = async (idMutat, idTinta) => {
    if (!idMutat || !idTinta || idMutat === idTinta) return;

    const lista = normalizeServiciiConfigurate(serviciiConfigurate);
    const active = lista.filter(s => s.activ !== false);
    const inactive = lista.filter(s => s.activ === false);

    const fromIndex = active.findIndex(s => s.id === idMutat);
    const toIndex = active.findIndex(s => s.id === idTinta);

    if (fromIndex === -1 || toIndex === -1) return;

    const activeNoi = [...active];
    const [mutat] = activeNoi.splice(fromIndex, 1);
    activeNoi.splice(toIndex, 0, mutat);

    const activeCuOrdine = activeNoi.map((s, index) => ({
      ...s,
      ordineAfisare: index
    }));

    const inactiveCuOrdine = inactive.map((s, index) => ({
      ...s,
      ordineAfisare: activeCuOrdine.length + index
    }));

    const listaNoua = [...activeCuOrdine, ...inactiveCuOrdine];
    setServiciiConfigurate(listaNoua);
    setDragId(null);
    await salveazaConfig(listaNoua);

    if (onLog) {
      await onLog('Reordonare servicii', {
        ordine: activeCuOrdine.map(s => s.nume).join(' > ')
      }, null);
    }
  };


  if (loading) {
    return <div className="p-10 text-center text-white opacity-50 font-black tracking-[0.2em]">SE ÎNCARCĂ...</div>;
  }

  const butonMeniu = (titlu, descriere, icon, onClick) => (
    <button
      onClick={onClick}
      className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-800 active:scale-[0.98] transition-all rounded-[2rem] p-5 flex items-center justify-between gap-4 text-left"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="bg-blue-600 p-3 rounded-2xl text-white shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black uppercase text-white truncate">{titlu}</p>
          <p className="text-[10px] text-slate-500 font-bold uppercase mt-1 leading-relaxed">{descriere}</p>
        </div>
      </div>
      <span className="text-slate-600 font-black text-lg">›</span>
    </button>
  );

  const butonInapoi = (
    <button
      onClick={() => setSectiune(null)}
      className="mb-4 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-[10px] font-black uppercase text-slate-300 active:scale-95"
    >
      Înapoi la setări
    </button>
  );

  if (!sectiune) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl">
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase">Setări</h2>
              <p className="text-xs text-slate-400 font-bold">Alege ce dorești să modifici</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {onOpenLuna && butonMeniu('Răspândirea lunară a efectivului', 'Tabel lunar cu servicii și statusuri', <CalendarDays size={22} />, onOpenLuna)}
            {onOpenReguli && butonMeniu('Eligibilitate', 'Cine are voie pe fiecare serviciu', <ShieldAlert size={22} />, onOpenReguli)}
            {onOpenEfectiv && butonMeniu('Efectiv', 'Adaugă, modifică, dezactivează și schimbă ordinea persoanelor', <Users size={22} />, onOpenEfectiv)}
            {butonMeniu('Gestionare servicii', 'Adaugă, modifică, șterge și schimbă ordinea', <GripVertical size={22} />, () => setSectiune('gestionare_servicii'))}
            {butonMeniu('Setări servicii', 'Permite sau oprește serviciu în zile consecutive', <Settings size={22} />, () => setSectiune('setari_servicii'))}
            {onOpenIstoric && butonMeniu('Istoric modificări', 'Vezi ultimele modificări făcute în aplicație', <History size={22} />, onOpenIstoric)}
          </div>
        </div>
      </div>
    );
  }

  if (sectiune === 'gestionare_servicii') {
    return (
      <div className="space-y-4">
        {butonInapoi}
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl">
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <GripVertical size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase">Gestionare servicii</h2>
              <p className="text-xs text-slate-400 font-bold">Ține apăsat pe mâner și trage serviciul unde vrei</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              value={serviciuNou}
              onChange={(e) => setServiciuNou(e.target.value)}
              placeholder="Adaugă serviciu nou..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-blue-500"
            />
            <button
              onClick={adaugaServiciu}
              className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all rounded-2xl px-4 font-black text-xs uppercase flex items-center gap-2"
            >
              <Plus size={16} /> Adaugă
            </button>
          </div>

          <div className="space-y-2">
            {serviciiActive.map((serviciu) => (
              <div
                key={serviciu.id}
                draggable={editId !== serviciu.id}
                onDragStart={() => setDragId(serviciu.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => reordoneazaServicii(dragId, serviciu.id)}
                onDragEnd={() => setDragId(null)}
                className={`bg-slate-950 border rounded-2xl p-3 flex items-center justify-between gap-2 transition-all ${dragId === serviciu.id ? 'border-blue-500 opacity-60 scale-[0.99]' : 'border-slate-800'}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {editId !== serviciu.id && (
                    <div className="text-slate-500 cursor-grab active:cursor-grabbing p-1" title="Trage pentru a schimba ordinea">
                      <GripVertical size={18} />
                    </div>
                  )}

                  {editId === serviciu.id ? (
                    <input
                      value={editNume}
                      onChange={(e) => setEditNume(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500"
                      autoFocus
                    />
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-black text-white uppercase truncate">{serviciu.nume}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Afișare {serviciiActive.findIndex(s => s.id === serviciu.id) + 1} · Poziția internă {serviciu.pozitie + 1}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  {editId === serviciu.id ? (
                    <>
                      <button onClick={salveazaEditare} className="bg-green-600 p-3 rounded-xl active:scale-95"><Save size={15} /></button>
                      <button onClick={() => { setEditId(null); setEditNume(''); }} className="bg-slate-800 p-3 rounded-xl active:scale-95"><X size={15} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => incepeEditare(serviciu)} className="bg-slate-800 p-3 rounded-xl active:scale-95"><Pencil size={15} /></button>
                      <button onClick={() => stergeServiciu(serviciu)} className="bg-red-600/20 text-red-300 border border-red-700 p-3 rounded-xl active:scale-95"><Trash2 size={15} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (sectiune === 'setari_servicii') {
    return (
      <div className="space-y-4">
        {butonInapoi}
        <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-5 shadow-xl">
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase">Setări servicii</h2>
              <p className="text-xs text-slate-400 font-bold">Activezi separat ce funcții permit aceeași persoană în zile consecutive</p>
            </div>
          </div>

          <div className="space-y-3">
            {serviciiActive.map((serviciu) => {
              const functie = serviciu.nume;
              const activ = serviciiZilnic[functie] === true;

              return (
                <div key={serviciu.id} className="bg-slate-950 border border-slate-800 rounded-[2rem] p-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-black uppercase text-white">{functie}</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      {activ
                        ? 'Aceeași persoană poate fi pusă la acest serviciu în zile consecutive.'
                        : 'Se aplică regula normală: persoana nu poate fi pusă în ziua precedentă sau următoare.'}
                    </p>
                  </div>

                  <button
                    onClick={() => schimbaServiciu(functie)}
                    disabled={salvare}
                    className={`shrink-0 px-4 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 active:scale-95 transition-all ${activ ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                  >
                    {activ ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    {activ ? 'Activ' : 'Oprit'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-4 bg-blue-950/20 border border-blue-900/40 rounded-2xl p-4 flex gap-3 text-xs text-blue-200 leading-relaxed">
            <Save size={18} className="shrink-0 mt-0.5" />
            <p>
              Setările se salvează în Firebase. Pentru funcțiile activate, aceeași persoană poate fi planificată în zile consecutive doar la funcția respectivă.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default SetariServiciiPage;
