import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { numarInterventieDin, numeCompletDin, serviciiActiveDinLista, serviciiPersoanaInZi } from './serviciiConfig';

// Statusurile care nu pot exista în aceeași zi cu un serviciu planificat.
export const STATUSURI_ABSENTA = ['Concediu', 'Zi liberă', 'Deplasare', 'Foaie de boala', 'Spitalul militar', 'Studii'];

// Întoarce zilele (din lista dată) în care persoana este planificată la vreun serviciu,
// inclusiv intervenția. Citește direct din baza de date, ca să fie la zi.
export const serviciiPlanificateInZile = async (persoana, zile) => {
  const [calSnap, setSnap] = await Promise.all([
    getDoc(doc(db, 'servicii', 'calendar')),
    getDoc(doc(db, 'setari', 'servicii'))
  ]);
  const calendar = calSnap.exists() ? (calSnap.data().data || {}) : {};
  const servicii = serviciiActiveDinLista(setSnap.exists() ? setSnap.data().serviciiConfigurate : []);
  const nume = numeCompletDin(persoana);

  return zile
    .map(data => {
      const ziCalendar = calendar[format(data, 'dd.MM.yyyy')];
      const nrInterventii = Math.max(1, Number(ziCalendar?.interventii || ziCalendar?.mod || 2) || 2);
      const vizibile = servicii.filter(s => !(numarInterventieDin(s.nume) > nrInterventii));
      return { data, servicii: serviciiPersoanaInZi(ziCalendar, nume, vizibile) };
    })
    .filter(z => z.servicii.length > 0);
};

// `numeAfisat` = null când e vorba de utilizatorul logat (mesaj la persoana a II-a).
export const textConflict = (numeAfisat, status, conflicte) => {
  const lista = conflicte
    .map(c => `${format(c.data, 'dd.MM')} (${c.servicii.join(', ')})`)
    .join(', ');
  return numeAfisat
    ? `${numeAfisat} nu poate fi în „${status}” — este planificat la serviciu: ${lista}. Scoate-l întâi din Planificarea Serviciilor.`
    : `Nu poți fi în „${status}” — ești planificat la serviciu: ${lista}. Scoate-te întâi din Planificarea Serviciilor.`;
};
