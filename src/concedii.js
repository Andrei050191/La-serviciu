import { db } from './firebase';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { serviciiPlanificateInZile } from './verificareServicii';

// Concediul anual: fiecare persoană are în documentul ei din `echipa` câmpul
//   concedii: { "2027": { total: 35, perioade: [{ id, deLa: "2027-07-01", panaLa: "2027-07-14" }] } }
// Se numără toate zilele calendaristice. Zilele din perioade primesc statusul „Concediu”.

export const TOTAL_IMPLICIT = 35;
export const ZILE_OBLIGATORII = 14;

const ABSENTE_ALTELE = ['Zi liberă', 'Deplasare', 'Foaie de boala', 'Spitalul militar', 'Studii'];

export const zileDinPerioada = (deLa, panaLa) => {
  const n = differenceInCalendarDays(parseISO(panaLa), parseISO(deLa)) + 1;
  if (!(n > 0)) return [];
  return Array.from({ length: n }, (_, i) => addDays(parseISO(deLa), i));
};

export const nrZile = (p) => zileDinPerioada(p.deLa, p.panaLa).length;

export const dateAn = (persoana, an) => {
  const d = persoana?.concedii?.[String(an)] || {};
  return {
    total: Number.isFinite(Number(d.total)) && d.total !== undefined ? Number(d.total) : TOTAL_IMPLICIT,
    perioade: [...(d.perioade || [])].sort((a, b) => a.deLa.localeCompare(b.deLa))
  };
};

export const sumarAn = (persoana, an) => {
  const { total, perioade } = dateAn(persoana, an);
  const azi = format(new Date(), 'yyyy-MM-dd');
  let planificate = 0;
  let folosite = 0;
  perioade.forEach(p => {
    zileDinPerioada(p.deLa, p.panaLa).forEach(d => {
      planificate += 1;
      if (format(d, 'yyyy-MM-dd') <= azi) folosite += 1;
    });
  });
  return {
    total,
    perioade,
    planificate,
    folosite,
    ramase: total - planificate,
    are14: perioade.some(p => nrZile(p) >= ZILE_OBLIGATORII)
  };
};

const fmt = (iso) => format(parseISO(iso), 'dd.MM.yyyy');
export const textPerioada = (p) => `${format(parseISO(p.deLa), 'dd.MM')} – ${format(parseISO(p.panaLa), 'dd.MM.yyyy')}`;

// Adaugă (perioadaVeche = null) sau modifică o perioadă. Întoarce { eroare } sau { ok: true }.
export const salveazaPerioada = async ({ persoana, an, perioadaVeche, deLa, panaLa, onLog, eu }) => {
  if (!deLa || !panaLa || deLa > panaLa) return { eroare: 'Alege data de început și data de sfârșit.' };
  if (deLa.slice(0, 4) !== String(an) || panaLa.slice(0, 4) !== String(an)) {
    return { eroare: `Perioada trebuie să fie în anul ${an}. Dacă trece în anul următor, împarte-o în două.` };
  }

  const { total, perioade } = dateAn(persoana, an);
  const altele = perioade.filter(p => p.id !== perioadaVeche?.id);

  const suprapusa = altele.find(p => !(panaLa < p.deLa || deLa > p.panaLa));
  if (suprapusa) return { eroare: `Se suprapune cu perioada ${textPerioada(suprapusa)}.` };

  const zileNoi = zileDinPerioada(deLa, panaLa);
  const folositAltele = altele.reduce((s, p) => s + nrZile(p), 0);
  if (folositAltele + zileNoi.length > total) {
    const disponibile = total - folositAltele;
    return { eroare: `Perioada are ${zileNoi.length} zile, dar ${eu ? 'mai ai' : 'mai are'} doar ${disponibile} zile disponibile din ${total}.` };
  }

  const cheiVechi = new Set(perioadaVeche ? zileDinPerioada(perioadaVeche.deLa, perioadaVeche.panaLa).map(d => format(d, 'yyyyMMdd')) : []);
  const cheiNoi = new Set(zileNoi.map(d => format(d, 'yyyyMMdd')));
  const adaugate = zileNoi.filter(d => !cheiVechi.has(format(d, 'yyyyMMdd')));
  const scoase = [...cheiVechi].filter(k => !cheiNoi.has(k));

  // Altă absență deja pusă în zilele noi?
  const altaAbsenta = adaugate.find(d => ABSENTE_ALTELE.includes(persoana[`status_${format(d, 'yyyyMMdd')}`]));
  if (altaAbsenta) {
    const st = persoana[`status_${format(altaAbsenta, 'yyyyMMdd')}`];
    return { eroare: `Pe ${format(altaAbsenta, 'dd.MM')} ${eu ? 'ai' : 'are'} deja „${st}”.` };
  }

  // Serviciu planificat în zilele noi?
  const conflicte = await serviciiPlanificateInZile(persoana, adaugate);
  if (conflicte.length) {
    const lista = conflicte.map(c => `${format(c.data, 'dd.MM')} (${c.servicii.join(', ')})`).join(', ');
    return { eroare: `${eu ? 'Ești' : 'Este'} planificat la serviciu: ${lista}. Scoate${eu ? '-te' : '-l'} întâi din planificare.` };
  }

  const perioada = { id: perioadaVeche?.id || `c${Date.now()}`, deLa, panaLa };
  const update = {
    [`concedii.${an}`]: { total, perioade: [...altele, perioada].sort((a, b) => a.deLa.localeCompare(b.deLa)) }
  };
  adaugate.forEach(d => {
    const k = format(d, 'yyyyMMdd');
    update[`status_${k}`] = 'Concediu';
    update[`cantina_${k}`] = false;
  });
  scoase.forEach(k => {
    if (persoana[`status_${k}`] === 'Concediu') update[`status_${k}`] = deleteField();
  });

  await updateDoc(doc(db, 'echipa', persoana.id), update);
  if (onLog) {
    await onLog(perioadaVeche ? 'Concediu modificat' : 'Concediu planificat', {
      an,
      ...(perioadaVeche ? { inainte: `${fmt(perioadaVeche.deLa)} – ${fmt(perioadaVeche.panaLa)}` } : {}),
      perioada: `${fmt(deLa)} – ${fmt(panaLa)}`,
      zile: zileNoi.length
    }, persoana);
  }
  return { ok: true };
};

export const stergePerioada = async ({ persoana, an, perioada, onLog }) => {
  const { total, perioade } = dateAn(persoana, an);
  const update = {
    [`concedii.${an}`]: { total, perioade: perioade.filter(p => p.id !== perioada.id) }
  };
  zileDinPerioada(perioada.deLa, perioada.panaLa).forEach(d => {
    const k = format(d, 'yyyyMMdd');
    if (persoana[`status_${k}`] === 'Concediu') update[`status_${k}`] = deleteField();
  });
  await updateDoc(doc(db, 'echipa', persoana.id), update);
  if (onLog) {
    await onLog('Concediu șters', { an, perioada: `${fmt(perioada.deLa)} – ${fmt(perioada.panaLa)}`, zile: nrZile(perioada) }, persoana);
  }
};

export const seteazaTotal = async ({ persoana, an, total, onLog }) => {
  const { total: vechi, perioade } = dateAn(persoana, an);
  await updateDoc(doc(db, 'echipa', persoana.id), { [`concedii.${an}`]: { total, perioade } });
  if (onLog) await onLog('Total concediu', { an, inainte: vechi, dupa: total }, persoana);
};
