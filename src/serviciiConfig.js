export const serviciiDefault = [
  { id: 'ajutor_osu', nume: 'Ajutor OSU', pozitie: 0, activ: true },
  { id: 'sergent_pct', nume: 'Sergent de serviciu PCT', pozitie: 1, activ: true },
  { id: 'planton', nume: 'Planton', pozitie: 2, activ: true },
  { id: 'patrula', nume: 'Patrulă', pozitie: 3, activ: true },
  { id: 'operator_radio', nume: 'Operator radio', pozitie: 4, activ: true },
  { id: 'interventia_1', nume: 'Intervenția 1', pozitie: 5, activ: true },
  { id: 'interventia_2', nume: 'Intervenția 2', pozitie: 6, activ: true },
  { id: 'responsabil', nume: 'Responsabil', pozitie: 7, activ: true }
];

export const normalizeServiciiConfigurate = (lista) => {
  if (!Array.isArray(lista) || lista.length === 0) {
    return serviciiDefault;
  }

  return lista
    .map((s, index) => {
      if (typeof s === 'string') {
        return {
          id: s.toLowerCase().replace(/[^a-z0-9]+/gi, '_'),
          nume: s,
          pozitie: index,
          activ: true
        };
      }

      return {
        id: s.id || `serviciu_${index}`,
        nume: s.nume || s.name || `Serviciu ${index + 1}`,
        pozitie: Number.isInteger(s.pozitie) ? s.pozitie : index,
        activ: s.activ !== false
      };
    })
    .sort((a, b) => a.pozitie - b.pozitie);
};

export const serviciiActiveDinLista = (lista) => {
  return normalizeServiciiConfigurate(lista).filter(s => s.activ !== false);
};

export const pozitieMaximaServicii = (lista) => {
  const servicii = normalizeServiciiConfigurate(lista);
  return servicii.reduce((max, s) => Math.max(max, s.pozitie), servicii.length - 1) + 1;
};
