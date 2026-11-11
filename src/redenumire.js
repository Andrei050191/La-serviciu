import { db } from './firebase';
import { collection, doc, getDocs, query, runTransaction, where, writeBatch } from 'firebase/firestore';

// Calendarul, eligibilitatea și notificările țin oamenii după numele complet.
// Când admin-ul schimbă gradul/prenumele/numele cuiva, actualizăm numele peste tot,
// ca persoana să nu-și piardă serviciile, eligibilitatea și notificările.
export const propagaRedenumire = async (numeVechi, numeNou) => {
  if (!numeVechi || !numeNou || numeVechi === numeNou) return;

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'servicii', 'calendar');
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const zile = snap.data().data || {};
    const actualizari = {};
    Object.entries(zile).forEach(([cheie, zi]) => {
      if (Array.isArray(zi?.oameni) && zi.oameni.includes(numeVechi)) {
        actualizari[cheie] = { ...zi, oameni: zi.oameni.map(o => (o === numeVechi ? numeNou : o)) };
      }
    });

    if (Object.keys(actualizari).length) {
      tx.set(ref, { data: actualizari }, { merge: true });
    }
  });

  await runTransaction(db, async (tx) => {
    const ref = doc(db, 'setari', 'reguli_servicii');
    const snap = await tx.get(ref);
    if (!snap.exists()) return;

    const actualizari = {};
    Object.entries(snap.data()).forEach(([functie, lista]) => {
      if (Array.isArray(lista) && lista.includes(numeVechi)) {
        actualizari[functie] = lista.map(n => (n === numeVechi ? numeNou : n));
      }
    });

    if (Object.keys(actualizari).length) {
      tx.set(ref, actualizari, { merge: true });
    }
  });

  const notificari = await getDocs(query(collection(db, 'notificari'), where('userNumeComplet', '==', numeVechi)));
  for (let i = 0; i < notificari.docs.length; i += 400) {
    const batch = writeBatch(db);
    notificari.docs.slice(i, i + 400).forEach(d => batch.update(d.ref, { userNumeComplet: numeNou }));
    await batch.commit();
  }
};
