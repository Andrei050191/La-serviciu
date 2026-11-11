import { db } from './firebase';
import { collection, doc, getDoc, getDocs, runTransaction } from 'firebase/firestore';
import { addDays, format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { trimiteTelegram } from './telegram';
import { numarInterventieDin, numeCompletDin, serviciiActiveDinLista, serviciiPersoanaInZi } from './serviciiConfig';

// Setările stau în documentul setari/telegram.
export const SETARI_TELEGRAM_IMPLICITE = {
  adminChatIds: [],
  mementoActiv: true,
  oraMemento: 18,
  raportActiv: true,
  oraRaport: 7
};

export const setariTelegramComplete = (date = {}) => ({ ...SETARI_TELEGRAM_IMPLICITE, ...date });

// Nu avem server: sarcinile pornesc din aplicația oricui o are deschisă după ora setată.
// Tranzacția garantează că doar primul telefon trimite (o singură dată pe zi).
const revendica = (camp, valoare) => runTransaction(db, async (tx) => {
  const ref = doc(db, 'setari', 'telegram');
  const snap = await tx.get(ref);
  if (snap.exists() && snap.data()[camp] === valoare) return false;
  tx.set(ref, { [camp]: valoare }, { merge: true });
  return true;
});

// Trimite fiecărui om conectat la Telegram serviciile lui din ziua `data`.
export const trimiteMementoPentru = async (data) => {
  const [calSnap, setSnap, echipaSnap] = await Promise.all([
    getDoc(doc(db, 'servicii', 'calendar')),
    getDoc(doc(db, 'setari', 'servicii')),
    getDocs(collection(db, 'echipa'))
  ]);

  const ziCalendar = calSnap.exists() ? calSnap.data().data?.[format(data, 'dd.MM.yyyy')] : null;
  if (!ziCalendar) return 0;

  const nrInterventii = Math.max(1, Number(ziCalendar.interventii || ziCalendar.mod || 2) || 2);
  const servicii = serviciiActiveDinLista(setSnap.exists() ? setSnap.data().serviciiConfigurate : [])
    .filter(s => !(numarInterventieDin(s.nume) > nrInterventii));
  const ziText = format(data, 'EEEE, dd.MM.yyyy', { locale: ro });

  let trimise = 0;
  for (const d of echipaSnap.docs) {
    const p = d.data();
    if (p.activ === false || !p.telegramChatId) continue;
    const functii = serviciiPersoanaInZi(ziCalendar, numeCompletDin(p), servicii);
    if (!functii.length) continue;
    const ok = await trimiteTelegram(p.telegramChatId, `📅 Mâine, ${ziText}, ești la serviciu: ${functii.join(', ')}.`);
    if (ok) trimise += 1;
  }
  return trimise;
};

export const trimiteRaportAdminilor = async (setari, text) => {
  const { adminChatIds } = setariTelegramComplete(setari);
  let trimise = 0;
  for (const id of adminChatIds) {
    if (await trimiteTelegram(id, text)) trimise += 1;
  }
  return trimise;
};

// Rulează periodic din App: raportul de dimineață și memento-ul de seară.
export const ruleazaSarciniTelegram = async ({ setari, textRaportAzi }) => {
  const s = setariTelegramComplete(setari);
  const acum = new Date();
  const ora = acum.getHours();

  if (s.raportActiv && s.adminChatIds.length && ora >= Number(s.oraRaport)) {
    const azi = format(acum, 'yyyyMMdd');
    if (await revendica('ultimRaport', azi)) {
      await trimiteRaportAdminilor(s, textRaportAzi());
    }
  }

  if (s.mementoActiv && ora >= Number(s.oraMemento)) {
    const maine = addDays(acum, 1);
    if (await revendica('ultimMemento', format(maine, 'yyyyMMdd'))) {
      await trimiteMementoPentru(maine);
    }
  }
};
