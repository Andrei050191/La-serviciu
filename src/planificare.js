import { db } from './firebase';
import { addDoc, collection, doc, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { addDays, format, parse } from 'date-fns';
import { trimiteTelegram } from './telegram';
import { normalizeServiciiConfigurate, numarInterventieDin, pozitieMaximaServicii } from './serviciiConfig';

// Logica de planificare comună pentru „Planificarea serviciilor” și „Grafice servicii”.
// Regulile sunt exact cele din pagina de planificare (mutate aici, nu schimbate).

export const ALTA_SUBUNITATE = 'Din altă subunitate';

export const serviciuZilnicActiv = (serviciiZilnic = {}, functie) => {
  if (numarInterventieDin(functie)) {
    return serviciiZilnic['Intervenția'] === true
      || serviciiZilnic[functie] === true
      || serviciiZilnic['Intervenția 1'] === true
      || serviciiZilnic['Intervenția 2'] === true;
  }
  return serviciiZilnic[functie] === true;
};

export const listaEligibilitate = (reguli = {}, functie) => {
  if (numarInterventieDin(functie)) {
    return reguli['Intervenția'] || reguli[functie] || reguli['Intervenția 1'] || reguli['Intervenția 2'] || [];
  }
  return reguli[functie] || [];
};

export const numarInterventiiDinZi = (dateZi = {}) => {
  const nr = Number(dateZi.interventii || dateZi.mod || 2);
  if (!Number.isFinite(nr)) return 2;
  return Math.max(1, nr);
};

const formatMotivStatus = (status) => {
  if (!status) return "";
  if (status === "Prezent la serviciu") return "";
  if (status === "Foaie de boala") return "foaie de boală";
  return status.toLowerCase();
};

// persoana: din echipa, cu câmpul numeComplet. ziKey: dd.MM.yyyy.
export const motivIndisponibil = ({ persoana, ziKey, pozitie, functie, omPlanificat, calendar, serviciiZilnic }) => {
  if (!persoana) return "persoană indisponibilă";
  if (persoana.numeComplet === omPlanificat) return "";
  if (persoana.activ === false) return "inactiv";

  const dataCurenta = parse(ziKey, 'dd.MM.yyyy', new Date());
  const ieriKey = format(addDays(dataCurenta, -1), 'dd.MM.yyyy');
  const maineKey = format(addDays(dataCurenta, 1), 'dd.MM.yyyy');
  const ziFiltru = format(dataCurenta, 'yyyyMMdd');

  const oameniAzi = calendar[ziKey]?.oameni || [];
  const oameniIeri = calendar[ieriKey]?.oameni || [];
  const oameniMaine = calendar[maineKey]?.oameni || [];
  const zilnicActiv = serviciuZilnicActiv(serviciiZilnic, functie);

  const esteDejaAzi = oameniAzi.some((om, i) => i !== pozitie && om === persoana.numeComplet);
  if (esteDejaAzi) return "în serviciu azi";

  // Dacă nu are status setat pentru ziua aleasă, îl tratăm ca „Prezent la serviciu”.
  // Când switch-ul este ACTIV pentru funcția curentă, permitem aceeași persoană în zile consecutive,
  // chiar dacă statusul de azi este automat „După serviciu” sau „În serviciu”.
  const statusAzi = persoana[`status_${ziFiltru}`] || "Prezent la serviciu";
  const statusBlocatManual = ["Concediu", "Zi liberă", "Deplasare", "Foaie de boala", "Spitalul militar", "Studii"];

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

const trimiteNotificare = async (personal, { userNumeComplet, mesaj, tip, functie, dataServiciu }) => {
  if (!userNumeComplet || userNumeComplet === ALTA_SUBUNITATE) return;

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

  const persoana = personal.find(p => p.numeComplet === userNumeComplet);
  if (persoana?.telegramChatId) {
    trimiteTelegram(persoana.telegramChatId, `🔔 ${mesaj}`);
  }
};

// Pune `valoare` (numele complet sau ALTA_SUBUNITATE) la serviciul `functie` (poziția `pozitie`) în ziua `ziKey`.
// Fără verificarea regulilor (o face cine apelează). Aruncă eroare dacă salvarea în calendar eșuează.
export const seteazaServiciu = async ({ ziKey, functie, pozitie, valoare, personal, calendar, totalPozitii, onLog, numeFrumos }) => {
  const dataCurenta = parse(ziKey, 'dd.MM.yyyy', new Date());
  const ziFiltru = format(dataCurenta, 'yyyyMMdd');
  const ziUrmatoareFiltru = format(addDays(dataCurenta, 1), 'yyyyMMdd');
  const oameniMaine = calendar[format(addDays(dataCurenta, 1), 'dd.MM.yyyy')]?.oameni || [];
  const esteInterventie = functie.includes("Intervenția");
  const nrInterventie = numarInterventieDin(functie);

  // Tranzacție: schimbăm doar poziția aleasă din ziua respectivă, pornind de la datele
  // proaspete din baza de date (nu se pierd modificările altcuiva făcute în paralel).
  let vechiulOmNume;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "servicii", "calendar");
    const snap = await tx.get(ref);
    const ziDb = snap.exists() ? (snap.data().data?.[ziKey] || {}) : {};
    const oameni = Array.isArray(ziDb.oameni)
      ? [...ziDb.oameni]
      : Array(totalPozitii).fill(ALTA_SUBUNITATE);
    while (oameni.length <= pozitie) oameni.push(ALTA_SUBUNITATE);

    vechiulOmNume = oameni[pozitie];
    oameni[pozitie] = valoare;

    const ziNoua = { ...ziDb, oameni, mod: ziDb.mod || "2" };
    // Dacă se pune cineva la Intervenția N, iar ziua are mai puține intervenții, o mărim (altfel nu s-ar vedea).
    if (nrInterventie && valoare !== ALTA_SUBUNITATE && nrInterventie > numarInterventiiDinZi(ziDb)) {
      ziNoua.interventii = nrInterventie;
    }

    tx.set(ref, { data: { [ziKey]: ziNoua } }, { merge: true });
  });

  if (vechiulOmNume && vechiulOmNume !== ALTA_SUBUNITATE && !esteInterventie) {
    const omV = personal.find(p => p.numeComplet === vechiulOmNume);
    if (omV) {
      const updateVechi = { [`status_${ziFiltru}`]: "Prezent la serviciu" };
      if (!oameniMaine.includes(vechiulOmNume)) {
        updateVechi[`status_${ziUrmatoareFiltru}`] = "Prezent la serviciu";
      }
      await updateDoc(doc(db, "echipa", omV.id), updateVechi);
    }
  }

  if (valoare !== ALTA_SUBUNITATE && !esteInterventie) {
    const omN = personal.find(p => p.numeComplet === valoare);
    if (omN) {
      await updateDoc(doc(db, "echipa", omN.id), {
        [`status_${ziFiltru}`]: "În serviciu",
        [`status_${ziUrmatoareFiltru}`]: "După serviciu"
      });
    }
  }

  if (valoare !== vechiulOmNume && onLog) {
    const persoanaNoua = personal.find(p => p.numeComplet === valoare);
    const persoanaVeche = personal.find(p => p.numeComplet === vechiulOmNume);
    await onLog("Planificare serviciu", {
      data: ziKey,
      serviciu: functie,
      inainte: numeFrumos(vechiulOmNume) || ALTA_SUBUNITATE,
      dupa: numeFrumos(valoare)
    }, persoanaNoua || persoanaVeche || null);
  }

  if (valoare !== vechiulOmNume) {
    if (valoare && valoare !== ALTA_SUBUNITATE) {
      await trimiteNotificare(personal, {
        userNumeComplet: valoare,
        mesaj: `Ai fost pus la serviciu: ${functie}, ${ziKey}.`,
        tip: "serviciu_adaugat",
        functie,
        dataServiciu: ziKey
      });
    }
    if (vechiulOmNume && vechiulOmNume !== ALTA_SUBUNITATE) {
      await trimiteNotificare(personal, {
        userNumeComplet: vechiulOmNume,
        mesaj: `Ai fost scos din serviciu: ${functie}, ${ziKey}.`,
        tip: "serviciu_scos",
        functie,
        dataServiciu: ziKey
      });
    }
  }

  return { vechiulOmNume };
};

// Creează în setări pozițiile „Intervenția N” care lipsesc (până la numarDoriti).
const asiguraInterventiiConfigurate = async (serviciiConfigurate, numarDoriti) => {
  const lista = normalizeServiciiConfigurate(serviciiConfigurate);
  const existente = lista
    .map(s => numarInterventieDin(s.nume))
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

// Schimbă câte persoane sunt la intervenție într-o zi. La micșorare, cei de pe pozițiile scoase
// sunt scoși din serviciu (cu notificare).
export const seteazaNumarInterventii = async ({ ziKey, numarCurent, numarNou, serviciiConfigurate, totalPozitii, personal, onLog, numeFrumos }) => {
  if (numarNou === numarCurent) return;

  const listaActualizata = await asiguraInterventiiConfigurate(serviciiConfigurate, numarNou);
  const serviciiInterventie = listaActualizata
    .filter(s => s.activ !== false && numarInterventieDin(s.nume))
    .sort((a, b) => numarInterventieDin(a.nume) - numarInterventieDin(b.nume));

  // Tranzacție: citim ziua proaspăt din baza de date și scriem doar ziua respectivă,
  // ca să nu suprascriem modificările făcute în același timp de altcineva.
  const scosi = [];
  await runTransaction(db, async (tx) => {
    scosi.length = 0;
    const ref = doc(db, "servicii", "calendar");
    const snap = await tx.get(ref);
    const ziDb = snap.exists() ? (snap.data().data?.[ziKey] || {}) : {};

    const totalPozitiiNou = Math.max(
      pozitieMaximaServicii(listaActualizata),
      totalPozitii,
      ziDb.oameni?.length || 0
    );

    const oameniNoi = Array(totalPozitiiNou).fill(ALTA_SUBUNITATE);
    (ziDb.oameni || []).forEach((om, i) => {
      oameniNoi[i] = om || ALTA_SUBUNITATE;
    });

    if (numarNou < numarCurent) {
      for (const serviciu of serviciiInterventie) {
        const nr = numarInterventieDin(serviciu.nume);
        if (nr > numarNou) {
          const omScos = oameniNoi[serviciu.pozitie];
          if (omScos && omScos !== ALTA_SUBUNITATE) {
            scosi.push({ om: omScos, functie: serviciu.nume });
          }
          oameniNoi[serviciu.pozitie] = ALTA_SUBUNITATE;
        }
      }
    }

    tx.set(ref, {
      data: {
        [ziKey]: {
          ...ziDb,
          oameni: oameniNoi,
          interventii: numarNou,
          mod: String(Math.min(numarNou, 2)) // compatibilitate cu varianta veche 1/2
        }
      }
    }, { merge: true });
  });

  if (onLog) {
    await onLog("Număr intervenții", {
      data: ziKey,
      inainte: numarCurent,
      dupa: numarNou,
      ...(scosi.length ? { scosi: scosi.map(s => `${numeFrumos(s.om)} (${s.functie})`).join(', ') } : {})
    }, null);
  }

  for (const { om, functie } of scosi) {
    await trimiteNotificare(personal, {
      userNumeComplet: om,
      mesaj: `Ai fost scos din serviciu: ${functie}, ${ziKey}.`,
      tip: "serviciu_scos",
      functie,
      dataServiciu: ziKey
    });
  }
};
