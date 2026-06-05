export const serviciiDefault = [
  { id: 'ajutor_osu', nume: 'Ajutor OSU', pozitie: 0, ordineAfisare: 0, activ: true },
  { id: 'sergent_pct', nume: 'Sergent de serviciu PCT', pozitie: 1, ordineAfisare: 1, activ: true },
  { id: 'planton', nume: 'Planton', pozitie: 2, ordineAfisare: 2, activ: true },
  { id: 'patrula', nume: 'Patrulă', pozitie: 3, ordineAfisare: 3, activ: true },
  { id: 'operator_radio', nume: 'Operator radio', pozitie: 4, ordineAfisare: 4, activ: true },
  { id: 'interventia_1', nume: 'Intervenția 1', pozitie: 5, ordineAfisare: 5, activ: true },
  { id: 'interventia_2', nume: 'Intervenția 2', pozitie: 6, ordineAfisare: 6, activ: true },
  { id: 'responsabil', nume: 'Responsabil', pozitie: 7, ordineAfisare: 7, activ: true }
];

export const normalizeServiciiConfigurate = (lista) => {
  const sursa = (!Array.isArray(lista) || lista.length === 0) ? serviciiDefault : lista;

  return sursa
    .map((s, index) => {
      if (typeof s === 'string') {
        return {
          id: s.toLowerCase().replace(/[^a-z0-9]+/gi, '_'),
          nume: s,
          pozitie: index,
          ordineAfisare: index,
          activ: true
        };
      }

      const pozitie = Number.isInteger(s.pozitie) ? s.pozitie : index;

      return {
        id: s.id || `serviciu_${index}`,
        nume: s.nume || s.name || `Serviciu ${index + 1}`,
        pozitie,
        ordineAfisare: Number.isInteger(s.ordineAfisare) ? s.ordineAfisare : pozitie,
        activ: s.activ !== false
      };
    })
    .sort((a, b) => {
      const ordineA = Number.isInteger(a.ordineAfisare) ? a.ordineAfisare : a.pozitie;
      const ordineB = Number.isInteger(b.ordineAfisare) ? b.ordineAfisare : b.pozitie;
      if (ordineA !== ordineB) return ordineA - ordineB;
      return a.pozitie - b.pozitie;
    });
};

export const serviciiActiveDinLista = (lista) => {
  return normalizeServiciiConfigurate(lista).filter(s => s.activ !== false);
};

export const pozitieMaximaServicii = (lista) => {
  const servicii = normalizeServiciiConfigurate(lista);
  return servicii.reduce((max, s) => Math.max(max, s.pozitie), servicii.length - 1) + 1;
};
