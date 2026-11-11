import { addDays, format } from 'date-fns';
import { ro } from 'date-fns/locale';

// Serviciile ca evenimente pe toată ziua, cu alarmă în seara dinainte (ora 18:00).

const escapeIcs = (text = '') => String(text)
  .replace(/\\/g, '\\\\')
  .replace(/\n/g, '\\n')
  .replace(/,/g, '\\,')
  .replace(/;/g, '\\;');

const fara = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

// evenimente: [{ data: Date, servicii: ['Patrulă', ...] }]
export const genereazaIcs = (evenimente, persoanaId = 'eu') => {
  const acum = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const linii = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prezenta la Serviciu//RO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Serviciile mele'
  ];

  evenimente.forEach(({ data, servicii }) => {
    const zi = format(data, 'yyyyMMdd');
    const titlu = `Serviciu: ${servicii.join(', ')}`;
    linii.push(
      'BEGIN:VEVENT',
      // UID stabil: la o nouă importare calendarul recunoaște același serviciu.
      `UID:${zi}-${fara(servicii.join('-'))}-${persoanaId}@prezenta-la-serviciu`,
      `DTSTAMP:${acum}`,
      `DTSTART;VALUE=DATE:${zi}`,
      `DTEND;VALUE=DATE:${format(addDays(data, 1), 'yyyyMMdd')}`,
      `SUMMARY:${escapeIcs(titlu)}`,
      `DESCRIPTION:${escapeIcs(`${format(data, 'EEEE, dd.MM.yyyy', { locale: ro })} — ${servicii.join(', ')}`)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcs(`Mâine ai serviciu: ${servicii.join(', ')}`)}`,
      'TRIGGER:-PT6H',
      'END:VALARM',
      'END:VEVENT'
    );
  });

  linii.push('END:VCALENDAR');
  return linii.join('\r\n') + '\r\n';
};

export const descarcaIcs = (evenimente, persoanaId) => {
  const blob = new Blob([genereazaIcs(evenimente, persoanaId)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'serviciile-mele.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

// Link „Adaugă în Google Calendar” pentru o singură zi (merge bine pe Android).
export const linkGoogleCalendar = (data, servicii) => {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Serviciu: ${servicii.join(', ')}`,
    dates: `${format(data, 'yyyyMMdd')}/${format(addDays(data, 1), 'yyyyMMdd')}`,
    details: `${format(data, 'EEEE, dd.MM.yyyy', { locale: ro })} — ${servicii.join(', ')}`
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
