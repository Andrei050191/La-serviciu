import React, { useEffect, useState } from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { Plus, Save, X, Pencil, UserCheck, UserX, Trash2, GripVertical } from 'lucide-react';

const formularGol = {
  grad: '',
  prenume: '',
  nume: '',
  cod: '',
  ordine: 1,
  activ: true
};

const EfectivPage = ({ onLog }) => {
  const [personal, setPersonal] = useState([]);
  const [formular, setFormular] = useState(formularGol);
  const [idEditare, setIdEditare] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [salvareOrdine, setSalvareOrdine] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));

    const unsub = onSnapshot(q, (snap) => {
      setPersonal(snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })));
    });

    return () => unsub();
  }, []);

  const numePentruIstoric = (p) => `${p?.grad || ''} ${p?.prenume || ''} ${p?.nume || ''}`.trim();

  const logLocal = async (actiune, detalii, persoana) => {
    if (onLog) {
      await onLog(actiune, detalii, persoana);
    }
  };

  const schimbaCamp = (camp, valoare) => {
    setFormular(prev => ({
      ...prev,
      [camp]: valoare
    }));
  };

  const reseteazaFormular = () => {
    setFormular(formularGol);
    setIdEditare(null);
    setShowForm(false);
  };

  const editeazaPersoana = (p) => {
    setIdEditare(p.id);
    setFormular({
      grad: p.grad || '',
      prenume: p.prenume || '',
      nume: p.nume || '',
      cod: p.cod || '',
      ordine: p.ordine || 1,
      activ: p.activ !== false
    });
    setShowForm(true);
  };

  const parolaValida = (parola) => {
    return String(parola || '').trim().length > 0;
  };

  const salveazaPersoana = async () => {
    if (!formular.grad.trim() || !formular.prenume.trim() || !formular.nume.trim() || !String(formular.cod).trim()) {
      alert("Completează gradul, prenumele, numele și parola.");
      return;
    }

    if (!parolaValida(formular.cod)) {
      alert("Parola nu poate fi goală.");
      return;
    }

    const codNou = String(formular.cod).trim();
    const parolaExista = personal.some(p => p.id !== idEditare && String(p.cod || '').trim() === codNou);
    if (parolaExista) {
      alert("Această parolă este deja folosită de altă persoană.");
      return;
    }

    const dateSalvare = {
      grad: formular.grad.trim(),
      prenume: formular.prenume.trim(),
      nume: formular.nume.trim(),
      cod: codNou,
      ordine: Number(formular.ordine) || 1,
      activ: formular.activ !== false
    };

    if (idEditare) {
      const vechi = personal.find(p => p.id === idEditare);
      await updateDoc(doc(db, "echipa", idEditare), dateSalvare);
      await logLocal("Modificare persoană", {
        inainte: vechi ? numePentruIstoric(vechi) : null,
        dupa: numePentruIstoric(dateSalvare),
        ordine: dateSalvare.ordine,
        activ: dateSalvare.activ
      }, { id: idEditare, ...dateSalvare });
    } else {
      const ref = await addDoc(collection(db, "echipa"), dateSalvare);
      await logLocal("Adăugare persoană", {
        persoana: numePentruIstoric(dateSalvare),
        ordine: dateSalvare.ordine
      }, { id: ref.id, ...dateSalvare });
    }

    reseteazaFormular();
  };

  const toggleActiv = async (p) => {
    const stareNoua = p.activ === false ? true : false;
    await updateDoc(doc(db, "echipa", p.id), {
      activ: stareNoua
    });
    await logLocal(stareNoua ? "Activare persoană" : "Dezactivare persoană", {
      stareNoua: stareNoua ? "Activ" : "Inactiv"
    }, p);
  };

  const stergePersoana = async (p) => {
    const confirmare = window.confirm(
      `Sigur vrei să ștergi definitiv persoana ${numePentruIstoric(p)}?\n\nPentru persoane eliberate este mai sigur să folosești butonul Inactiv. Ștergerea definitivă nu se poate anula.`
    );

    if (!confirmare) return;

    await logLocal("Ștergere persoană", {
      persoana: numePentruIstoric(p),
      cod: p.cod || null,
      ordine: p.ordine || null
    }, p);

    await deleteDoc(doc(db, "echipa", p.id));
  };


  const reordoneazaEfectiv = async (idMutat, idTinta) => {
    if (!idMutat || !idTinta || idMutat === idTinta || salvareOrdine) return;

    const fromIndex = personal.findIndex(p => p.id === idMutat);
    const toIndex = personal.findIndex(p => p.id === idTinta);
    if (fromIndex === -1 || toIndex === -1) return;

    const listaNoua = [...personal];
    const [mutat] = listaNoua.splice(fromIndex, 1);
    listaNoua.splice(toIndex, 0, mutat);

    const listaCuOrdine = listaNoua.map((p, index) => ({
      ...p,
      ordine: index + 1
    }));

    setPersonal(listaCuOrdine);
    setDragId(null);
    setSalvareOrdine(true);

    try {
      await Promise.all(listaCuOrdine.map(p =>
        updateDoc(doc(db, "echipa", p.id), { ordine: p.ordine })
      ));

      await logLocal("Reordonare efectiv", {
        ordine: listaCuOrdine.map(p => numePentruIstoric(p)).join(' > ')
      }, null);
    } catch (e) {
      console.error(e);
      alert("Nu am putut salva ordinea efectivului.");
    } finally {
      setSalvareOrdine(false);
    }
  };

  const formatGrad = (grad) => {
    if (!grad) return "";

    return grad.split(' ').map(cuvant => {
      if (/^[IVXLC]+$/i.test(cuvant)) return cuvant.toUpperCase();
      return cuvant.toLowerCase();
    }).join(' ');
  };

  const formatPrenume = (prenume) => {
    if (!prenume) return "";
    return prenume.charAt(0).toUpperCase() + prenume.slice(1).toLowerCase();
  };

  const formatNume = (nume) => {
    if (!nume) return "";
    return nume.toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800">
        <div className="flex justify-between items-center mb-6 gap-3">
          <div>
            <h2 className="text-sm font-black uppercase text-blue-400 tracking-widest">
              Efectiv subunitate
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
              Adaugă, modifică, dezactivează, șterge și schimbă ordinea
            </p>
          </div>

          <button
            onClick={() => {
              setShowForm(true);
              setIdEditare(null);
              setFormular({
                ...formularGol,
                ordine: personal.length + 1
              });
            }}
            className="bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all px-4 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2"
          >
            <Plus size={16} />
            Adaugă
          </button>
        </div>

        {showForm && (
          <div className="bg-slate-950 border-2 border-blue-600/40 p-5 rounded-[2rem] mb-6 space-y-3">
            <h3 className="text-xs font-black uppercase text-blue-400 mb-3">
              {idEditare ? "Modifică persoana" : "Adaugă persoană nouă"}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">
                  Grad
                </label>
                <input
                  value={formular.grad}
                  onChange={(e) => schimbaCamp("grad", e.target.value)}
                  placeholder="ex: caporal"
                  className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">
                  Prenume
                </label>
                <input
                  value={formular.prenume}
                  onChange={(e) => schimbaCamp("prenume", e.target.value)}
                  placeholder="ex: Vladimir"
                  className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">
                  Nume
                </label>
                <input
                  value={formular.nume}
                  onChange={(e) => schimbaCamp("nume", e.target.value)}
                  placeholder="ex: Pînzari"
                  className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">
                  Parolă login
                </label>
                <input
                  type="text"
                  value={formular.cod}
                  onChange={(e) => schimbaCamp("cod", e.target.value)}
                  placeholder="ex: 1234, Andrei, parolaMea"
                  className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white text-sm font-bold outline-none focus:border-blue-500"
                />
                <p className="text-[9px] text-slate-500 font-bold mt-1 ml-2">
                  Poate fi cum vrei: cifre, litere sau combinat. Important să nu fie goală.
                </p>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">
                  Ordine în listă
                </label>
                <input
                  type="number"
                  value={formular.ordine}
                  onChange={(e) => schimbaCamp("ordine", e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 p-4 rounded-2xl text-white text-sm font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[9px] font-black uppercase text-slate-500 ml-2">
                  Stare
                </label>
                <button
                  onClick={() => schimbaCamp("activ", !formular.activ)}
                  className={`w-full p-4 rounded-2xl text-sm font-black uppercase border ${
                    formular.activ
                      ? 'bg-green-600/20 border-green-500 text-green-400'
                      : 'bg-red-600/20 border-red-500 text-red-400'
                  }`}
                >
                  {formular.activ ? "Activ" : "Inactiv"}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={salveazaPersoana}
                className="flex-1 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all py-4 rounded-2xl font-black uppercase text-xs flex justify-center items-center gap-2"
              >
                <Save size={16} />
                Salvează
              </button>

              <button
                onClick={reseteazaFormular}
                className="bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all px-5 py-4 rounded-2xl font-black uppercase text-xs flex justify-center items-center gap-2"
              >
                <X size={16} />
                Anulează
              </button>
            </div>
          </div>
        )}

        <div className="mb-3 bg-slate-950/70 border border-slate-800 rounded-2xl p-3 text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
          Ține apăsat pe mânerul din stânga și trage persoana mai sus sau mai jos. Ordinea se salvează automat.
        </div>

        <div className="grid grid-cols-1 gap-3">
          {personal.map(p => {
            const activ = p.activ !== false;

            return (
              <div
                key={p.id}
                draggable={!salvareOrdine}
                onDragStart={() => setDragId(p.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => reordoneazaEfectiv(dragId, p.id)}
                onDragEnd={() => setDragId(null)}
                className={`p-4 rounded-2xl border-2 flex justify-between items-center gap-3 transition-all ${
                  dragId === p.id
                    ? 'border-blue-500 opacity-60 scale-[0.99]'
                    : activ
                      ? 'bg-slate-950 border-slate-800'
                      : 'bg-red-950/20 border-red-900/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="text-slate-500 cursor-grab active:cursor-grabbing p-1 shrink-0" title="Trage pentru a schimba ordinea">
                    <GripVertical size={18} />
                  </div>

                  <div className="text-left min-w-0">
                  <p className="text-[9px] font-black text-blue-400 leading-none mb-1">
                    {formatGrad(p.grad)}
                  </p>

                  <p className="text-sm sm:text-base font-black text-white truncate">
                    {formatPrenume(p.prenume)} {formatNume(p.nume)}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 uppercase">
                      Parolă: {p.cod || "—"}
                    </span>

                    <span className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-black text-slate-400 uppercase">
                      Ordine: {p.ordine || "—"}
                    </span>

                    <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${
                      activ
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-red-600/20 text-red-400'
                    }`}>
                      {activ ? "Activ" : "Inactiv"}
                    </span>
                  </div>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => editeazaPersoana(p)}
                    className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-400 active:scale-95 transition-all"
                    title="Modifică"
                  >
                    <Pencil size={18} />
                  </button>

                  <button
                    onClick={() => toggleActiv(p)}
                    className={`p-3 rounded-xl active:scale-95 transition-all ${
                      activ
                        ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                        : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                    }`}
                    title={activ ? "Dezactivează" : "Activează"}
                  >
                    {activ ? <UserX size={18} /> : <UserCheck size={18} />}
                  </button>

                  <button
                    onClick={() => stergePersoana(p)}
                    className="p-3 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600/30 active:scale-95 transition-all"
                    title="Șterge definitiv"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default EfectivPage;
