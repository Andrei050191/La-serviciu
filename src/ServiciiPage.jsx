import React, { useState, useEffect, useMemo } from 'react';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, setDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { Shield, User, Users } from 'lucide-react';
import { format, addDays, parse } from 'date-fns';
import { ro } from 'date-fns/locale';
import { normalizeServiciiConfigurate, pozitieMaximaServicii } from './serviciiConfig';

const ServiciiPage = ({ editabil }) => {
  const [calendar, setCalendar] = useState({});
  const [personal, setPersonal] = useState([]);
  const [reguli, setReguli] = useState({});
  const [setariServicii, setSetariServicii] = useState({ serviciiZilnic: {}, operatorRadioZilnic: false });
  const [serviciiConfigurate, setServiciiConfigurate] = useState(normalizeServiciiConfigurate([]));
  const [loading, setLoading] = useState(true);

  const serviciiActive = useMemo(() => normalizeServiciiConfigurate(serviciiConfigurate).filter(s => s.activ !== false), [serviciiConfigurate]);
  const functii = useMemo(() => serviciiActive.map(s => s.nume), [serviciiActive]);
  const totalPozitiiServicii = useMemo(() => pozitieMaximaServicii(serviciiConfigurate), [serviciiConfigurate]);
  const pozitieCalendar = (indexAfisat) => serviciiActive[indexAfisat]?.pozitie ?? indexAfisat;

  // AUTO-CURĂȚARE ZILE VECHI - REPARAT SINTAXĂ
  useEffect(() => {
    if (editabil && Object.keys(calendar).length > 0) {
      const curataZileVechi = async () => {
        const azi = new Date();
        azi.setHours(0, 0, 0, 0);
        const ieri = addDays(azi, -1);
        
        let dateNoi = { ...calendar };
        let saSchimbat = false;

        Object.keys(calendar).forEach(key => {
          try {
            const dataDoc = parse(key, 'dd.MM.yyyy', new Date());
            if (dataDoc < ieri) {
              delete dateNoi[key];
              saSchimbat = true;
            }
          } catch (e) { console.error("Eroare cheie data:", key); }
        });

        if (saSchimbat) {
          await setDoc(doc(db, "servicii", "calendar"), { data: dateNoi });
        }
      };
      curataZileVechi();
    }
  }, [calendar, editabil]);

  const afiseazaNumeFrumos = (numeComplet) => {
    if (!numeComplet || numeComplet === "Din altă subunitate") return numeComplet;
    const p = personal.find(pers => pers.numeComplet === numeComplet);
    if (!p) return numeComplet;

    const grad = (p.grad || "").split(' ').map(c => 
      /^[IVXLC]+$/i.test(c) ? c.toUpperCase() : c.toLowerCase()
    ).join(' ');

    const prenume = p.prenume 
      ? p.prenume.charAt(0).toUpperCase() + p.prenume.slice(1).toLowerCase() 
      : "";

    const nume = (p.nume || "").toUpperCase();
    return `${grad} ${prenume} ${nume}`.trim();
  };

  const zileAfisate = [ 0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
    const d = addDays(new Date(), offset);
    return {
      key: format(d, 'dd.MM.yyyy'),
      display: format(d, 'EEEE, dd.MM.yyyy', { locale: ro }),
      ziFiltru: format(d, 'yyyyMMdd'),
      ziUrmatoareFiltru: format(addDays(d, 1), 'yyyyMMdd')
    };
  });

  useEffect(() => {
    const q = query(collection(db, "echipa"), orderBy("ordine", "asc"));
    const unsubPers = onSnapshot(q, (snap) => {
      setPersonal(snap.docs.map(d => ({
        id: d.id,
        numeComplet: `${d.data().grad || ''} ${d.data().prenume || ''} ${d.data().nume || ''}`.trim().toUpperCase(),
        ...d.data()
      })));
    });

    const unsubCal = onSnapshot(doc(db, "servicii", "calendar"), (snap) => {
      if (snap.exists()) setCalendar(snap.data().data || {});
      setLoading(false);
    });

    const unsubReg = onSnapshot(doc(db, "setari", "reguli_servicii"), (snap) => {
      if (snap.exists()) setReguli(snap.data());
    });

    const unsubSetari = onSnapshot(doc(db, "setari", "servicii"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const serviciiZilnic = { ...(data.serviciiZilnic || {}) };

        // compatibilitate cu setarea veche pentru Operator radio
        if (data.operatorRadioZilnic === true) {
          serviciiZilnic["Operator radio"] = true;
        }

        setSetariServicii({
          serviciiZilnic,
          operatorRadioZilnic: serviciiZilnic["Operator radio"] === true
        });
        setServiciiConfigurate(normalizeServiciiConfigurate(data.serviciiConfigurate));
      } else {
        setServiciiConfigurate(normalizeServiciiConfigurate([]));
      }
    });

    return () => { unsubPers(); unsubCal(); unsubReg(); unsubSetari(); };
  }, []);

  const serviciuZilnicActivPentru = (functie) => {
    if (numarInterventieDinNume(functie)) {
      return setariServicii.serviciiZilnic?.['Intervenția'] === true
        || setariServicii.serviciiZilnic?.[functie] === true
        || setariServicii.serviciiZilnic?.['Intervenția 1'] === true
        || setariServicii.serviciiZilnic?.['Intervenția 2'] === true;
    }

    return setariServicii.serviciiZilnic?.[functie] === true;
  };

  const formatMotivStatus = (status) => {
    if (!status) return "";
    if (status === "Prezent la serviciu") return "";
    if (status === "Foaie de boala") return "foaie de boală";
    return status.toLowerCase();
  };

  const getMotivIndisponibil = (persoana, zi, indexFunctie, omPlanificat) => {
    const indexCalendar = pozitieCalendar(indexFunctie);
    if (!persoana) return "persoană indisponibilă";
    if (persoana.numeComplet === omPlanificat) return "";
    if (persoana.activ === false) return "inactiv";

    const dataCurenta = parse(zi.key, 'dd.MM.yyyy', new Date());
    const ieriKey = format(addDays(dataCurenta, -1), 'dd.MM.yyyy');
    const maineKey = format(addDays(dataCurenta, 1), 'dd.MM.yyyy');

    const oameniAzi = calendar[zi.key]?.oameni || [];
    const oameniIeri = calendar[ieriKey]?.oameni || [];
    const oameniMaine = calendar[maineKey]?.oameni || [];
    const functieCurenta = functii[indexFunctie];
    const zilnicActiv = serviciuZilnicActivPentru(functieCurenta);

    const esteDejaAzi = oameniAzi.some((om, i) => i !== indexCalendar && om === persoana.numeComplet);
    if (esteDejaAzi) return "în serviciu azi";

    // Dacă nu are status setat pentru ziua aleasă, îl tratăm ca „Prezent la serviciu”.
    // Când switch-ul este ACTIV pentru funcția curentă, permitem aceeași persoană în zile consecutive,
    // chiar dacă statusul de azi este automat „După serviciu” sau „În serviciu”.
    const statusAzi = persoana[`status_${zi.ziFiltru}`] || "Prezent la serviciu";
    const statusBlocatManual = ["Concediu", "Zi liberă", "Deplasare", "Foaie de boala"];

    if (statusBlocatManual.includes(statusAzi)) {
      return formatMotivStatus(statusAzi);
    }

    if (!zilnicActiv) {
      const motivStatus = formatMotivStatus(statusAzi);
      if (motivStatus) return motivStatus;

      if (oameniIeri.includes(persoana.numeComplet)) return "în serviciu ieri";
      if (oameniMaine.includes(persoana.numeComplet)) return "în serviciu mâine";
    }

    return "";
  };


  const trimiteNotificareServiciu = async ({ userNumeComplet, mesaj, tip, functie, dataServiciu }) => {
    if (!userNumeComplet || userNumeComplet === "Din altă subunitate") return;

    try {
      await addDoc(collection(db, "notificari"), {
        userNumeComplet,
        mesaj,
        tip,
        functie,
        dataServiciu,
        citit: false,
        dataClient: new Date().toISOString(),
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Nu am putut trimite notificarea:", e);
    }
  };

  const numarInterventieDinNume = (nume = '') => {
    const match = String(nume).match(/^Intervenția\s+(\d+)$/i);
    return match ? Number(match[1]) : null;
  };

  const cheieEligibilitate = (functie = '') => {
    return numarInterventieDinNume(functie) ? 'Intervenția' : functie;
  };

  const listaEligibilitatePentru = (functie) => {
    const cheie = cheieEligibilitate(functie);
    if (cheie === 'Intervenția') {
      return reguli['Intervenția'] || reguli[functie] || reguli['Intervenția 1'] || reguli['Intervenția 2'] || [];
    }
    return reguli[functie] || [];
  };

  const numarInterventiiDinZi = (dateZi = {}) => {
    const nr = Number(dateZi.interventii || dateZi.mod || 2);
    if (!Number.isFinite(nr)) return 2;
    return Math.max(1, nr);
  };

  const asiguraInterventiiConfigurate = async (numarDoriti) => {
    const lista = normalizeServiciiConfigurate(serviciiConfigurate);
    const existente = lista
      .map(s => numarInterventieDinNume(s.nume))
      .filter(n => Number.isInteger(n));

    const maxExistent = existente.length ? Math.max(...existente) : 0;
    if (numarDoriti <= maxExistent) return lista;

    let pozitieUrmatoare = pozitieMaximaServicii(lista);
    const serviciiNoi = [];

    for (let nr = maxExistent + 1; nr <= numarDoriti; nr++) {
      serviciiNoi.push({
        id: `interventia_${nr}`,
        nume: `Intervenția ${nr}`,
        pozitie: pozitieUrmatoare,
        ordineAfisare: lista.length + serviciiNoi.length,
        activ: true
      });
      pozitieUrmatoare += 1;
    }

    const listaNoua = normalizeServiciiConfigurate([...lista, ...serviciiNoi]);
    await setDoc(doc(db, "setari", "servicii"), { serviciiConfigurate: listaNoua }, { merge: true });
    return listaNoua;
  };

  const schimbaNumarInterventii = async (zi, dateZi, directie) => {
    const numarCurent = numarInterventiiDinZi(dateZi);
    const numarNou = Math.max(1, numarCurent + directie);
    if (numarNou === numarCurent) return;

    const listaActualizata = await asiguraInterventiiConfigurate(numarNou);
    const serviciiInterventie = listaActualizata
      .filter(s => s.activ !== false && numarInterventieDinNume(s.nume))
      .sort((a, b) => numarInterventieDinNume(a.nume) - numarInterventieDinNume(b.nume));

    const totalPozitiiNou = Math.max(
      pozitieMaximaServicii(listaActualizata),
      totalPozitiiServicii,
      dateZi.oameni?.length || 0
    );

    const oameniNoi = Array(totalPozitiiNou).fill("Din altă subunitate");
    (dateZi.oameni || []).forEach((om, i) => {
      oameniNoi[i] = om || "Din altă subunitate";
    });

    if (numarNou < numarCurent) {
      for (const serviciu of serviciiInterventie) {
        const nr = numarInterventieDinNume(serviciu.nume);
        if (nr > numarNou) {
          const omScos = oameniNoi[serviciu.pozitie];
          if (omScos && omScos !== "Din altă subunitate") {
            await trimiteNotificareServiciu({
              userNumeComplet: omScos,
              mesaj: `Ai fost scos din serviciu: ${serviciu.nume}, ${zi.key}.`,
              tip: "serviciu_scos",
              functie: serviciu.nume,
              dataServiciu: zi.key
            });
          }
          oameniNoi[serviciu.pozitie] = "Din altă subunitate";
        }
      }
    }

    const nC = { ...calendar };
    nC[zi.key] = {
      ...(nC[zi.key] || {}),
      oameni: oameniNoi,
      interventii: numarNou,
      mod: String(Math.min(numarNou, 2)) // compatibilitate cu varianta veche 1/2
    };

    await setDoc(doc(db, "servicii", "calendar"), { data: nC });
  };

  const handleSchimbare = async (zi, index, valoare) => {
    const indexCalendar = pozitieCalendar(index);
    const nouCalendar = JSON.parse(JSON.stringify(calendar || {}));
    
    // REPARAȚIE: Verificăm dacă ziua are array-ul de oameni, dacă nu, îl creăm
    if (!nouCalendar[zi.key] || !nouCalendar[zi.key].oameni) {
        nouCalendar[zi.key] = { 
            oameni: Array(totalPozitiiServicii).fill("Din altă subunitate"), 
            mod: nouCalendar[zi.key]?.mod || "2" 
        };
    }

    const vechiulOmNume = nouCalendar[zi.key].oameni[indexCalendar];
    const dataCurenta = parse(zi.key, 'dd.MM.yyyy', new Date());
    
    const ieriKey = format(addDays(dataCurenta, -1), 'dd.MM.yyyy');
    const maineKey = format(addDays(dataCurenta, 1), 'dd.MM.yyyy');
    
    const oameniMaine = calendar[maineKey]?.oameni || [];

    const functiaCurenta = functii[index];
    const esteInterventie = functiaCurenta.includes("Intervenția");
    if (valoare !== "Din altă subunitate") {
      const omSelectat = personal.find(p => p.numeComplet === valoare);
      const motiv = getMotivIndisponibil(omSelectat, zi, index, vechiulOmNume);

      if (motiv) {
        alert(`⚠️ ${afiseazaNumeFrumos(valoare)} nu poate fi planificat: ${motiv}.`);
        return;
      }
    }

    if (vechiulOmNume && vechiulOmNume !== "Din altă subunitate" && !esteInterventie) {
      const omV = personal.find(p => p.numeComplet === vechiulOmNume);
      if (omV) {
        const updateVechi = {
          [`status_${zi.ziFiltru}`]: "Prezent la serviciu"
        };

        const vechiulOmEstePlanificatMaine = oameniMaine.includes(vechiulOmNume);
        if (!vechiulOmEstePlanificatMaine) {
          updateVechi[`status_${zi.ziUrmatoareFiltru}`] = "Prezent la serviciu";
        }

        await updateDoc(doc(db, "echipa", omV.id), updateVechi);
      }
    }

    if (valoare !== "Din altă subunitate" && !esteInterventie) {
      const omN = personal.find(p => p.numeComplet === valoare);
      if (omN) {
        await updateDoc(doc(db, "echipa", omN.id), { 
          [`status_${zi.ziFiltru}`]: "În serviciu",
          [`status_${zi.ziUrmatoareFiltru}`]: "După serviciu"
        });
      }
    }

    nouCalendar[zi.key].oameni[indexCalendar] = valoare;
    await setDoc(doc(db, "servicii", "calendar"), { data: nouCalendar });

    if (valoare !== vechiulOmNume) {
      if (valoare && valoare !== "Din altă subunitate") {
        await trimiteNotificareServiciu({
          userNumeComplet: valoare,
          mesaj: `Ai fost pus la serviciu: ${functiaCurenta}, ${zi.key}.`,
          tip: "serviciu_adaugat",
          functie: functiaCurenta,
          dataServiciu: zi.key
        });
      }

      if (vechiulOmNume && vechiulOmNume !== "Din altă subunitate") {
        await trimiteNotificareServiciu({
          userNumeComplet: vechiulOmNume,
          mesaj: `Ai fost scos din serviciu: ${functiaCurenta}, ${zi.key}.`,
          tip: "serviciu_scos",
          functie: functiaCurenta,
          dataServiciu: zi.key
        });
      }
    }
  };

  if (loading) return <div className="p-10 text-center text-white opacity-50 font-black tracking-[0.2em]">SE ÎNCARCĂ...</div>;

  return (
    <div className="space-y-6">
      {zileAfisate.map((zi) => {
        // REPARAȚIE VIZUALĂ: Ne asigurăm că dateZi are mereu structura corectă pentru mapare
        const dateZiIncompleta = calendar[zi.key] || {};
        const dateZi = {
          mod: dateZiIncompleta.mod || "2",
          interventii: numarInterventiiDinZi(dateZiIncompleta),
          oameni: dateZiIncompleta.oameni || Array(totalPozitiiServicii).fill("Din altă subunitate")
        };
        
        const esteAzi = zi.key === format(new Date(), 'dd.MM.yyyy');

        return (
          <div key={zi.key} className={`bg-slate-900 rounded-[2rem] border-2 transition-all ${esteAzi ? 'border-green-500 shadow-2xl' : 'border-slate-800'}`}>
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-black/20 rounded-t-[2rem]">
              <h3 className="text-[17px] font-black uppercase text-white tracking-widest">{zi.display}</h3>
              {editabil && (
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-700 gap-1">
                  <button
                    onClick={() => schimbaNumarInterventii(zi, dateZi, -1)}
                    className="w-8 h-8 rounded-lg text-sm font-black text-slate-300 bg-slate-900 active:scale-95 disabled:opacity-30"
                    disabled={dateZi.interventii <= 1}
                    title="Scoate o persoană din intervenție"
                  >
                    -
                  </button>
                  <div className="min-w-[44px] h-8 px-2 rounded-lg bg-blue-600 flex items-center justify-center text-[11px] font-black text-white">
                    {dateZi.interventii}
                  </div>
                  <button
                    onClick={() => schimbaNumarInterventii(zi, dateZi, 1)}
                    className="w-8 h-8 rounded-lg text-sm font-black text-slate-300 bg-slate-900 active:scale-95"
                    title="Adaugă o persoană la intervenție"
                  >
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 space-y-4">
              {serviciiActive.map((serviciu, idx) => {
                const f = serviciu.nume;
                const indexCalendar = serviciu.pozitie;
                const nrInterventie = numarInterventieDinNume(f);
                if (nrInterventie && nrInterventie > dateZi.interventii) return null;
                const omPlanificat = dateZi.oameni[indexCalendar] || "Din altă subunitate";
                const listaE = listaEligibilitatePentru(f);
                const filtrati = (listaE.length > 0) ? personal.filter(p => listaE.includes(p.numeComplet)) : personal;
                const zilnicActiv = serviciuZilnicActivPentru(f);

                return (
                  <div key={f} className="flex flex-col gap-1">
                    <label className="text-[12px] font-black text-slate-200 uppercase ml-2 tracking-tighter flex items-center gap-2">
                      {f}
                      {zilnicActiv && (
                        <span className="text-[9px] bg-green-600/20 text-green-300 border border-green-600/30 px-2 py-0.5 rounded-full">zilnic permis</span>
                      )}
                    </label>
                    {editabil ? (
                      <>
                      <select 
                        value={omPlanificat} 
                        onChange={(e) => handleSchimbare(zi, idx, e.target.value)}
                        style={{ fontSize: '16px' }}
                        className="w-full bg-slate-950 border border-slate-800 p-3 py-2 rounded-xl text-xs font-black text-white outline-none focus:border-blue-500 appearance-none shadow-inner"
                      >
                        <option value="Din altă subunitate">Din altă subunitate</option>
                        {filtrati.map(p => {
                          const motiv = getMotivIndisponibil(p, zi, idx, omPlanificat);
                          return (
                            <option key={p.id} value={p.numeComplet} disabled={!!motiv}>
                              {afiseazaNumeFrumos(p.numeComplet)}{motiv ? ` — ${motiv}` : ''}
                            </option>
                          );
                        })}
                      </select>
                     
                      </>
                    ) : (
                      <div className="bg-slate-950 px-4 rounded-2xl border border-slate-800/50 flex justify-between items-center">
                        <span style={{ fontSize: '18px' }} className="font-black text-white/90">
                          {afiseazaNumeFrumos(omPlanificat)}
                        </span>
                        <Shield size={14} className="text-blue-500/20" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ServiciiPage;