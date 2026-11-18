import { format } from 'date-fns';
import { numeFrumos } from './serviciiConfig';
import { sumarAn, zileDinPerioada } from './concedii';

const LUNI = ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'];

// Bucățile unei perioade, pe luni: 25.07–07.08 → iulie „25.07–31.07”, august „01.08–07.08”.
const bucatiPeLuni = (perioada) => {
  const pe = {};
  zileDinPerioada(perioada.deLa, perioada.panaLa).forEach(d => {
    const l = d.getMonth();
    if (!pe[l]) pe[l] = { start: d, sfarsit: d };
    else pe[l].sfarsit = d;
  });
  return pe;
};

// Generează „Graficul concediilor” pentru anul `an` (fișier .docx).
export const genereazaGraficConcedii = async (personal, an) => {
  // Biblioteca se încarcă doar când e nevoie (nu îngreunează aplicația).
  const {
    AlignmentType, BorderStyle, Document, Packer, PageOrientation, Paragraph, ShadingType,
    Table, TableCell, TableRow, TextRun, VerticalAlign, WidthType
  } = await import('docx');

  const FONT = 'Times New Roman';
  const text = (t, o = {}) => new TextRun({ text: t, font: FONT, size: o.size || 18, bold: o.bold });
  const bordura = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const borduri = { top: bordura, bottom: bordura, left: bordura, right: bordura };

  // A4 landscape: 16838 × 11906 twips; margini 720 → lățime utilă 15398.
  const LATIME = 15398;
  const COL_NR = 450;
  const COL_NUME = 3100;
  const COL_TOTAL = 900;
  const COL_LUNA = Math.floor((LATIME - COL_NR - COL_NUME - COL_TOTAL) / 12);
  const latimi = [COL_NR, COL_NUME, ...Array(12).fill(COL_LUNA), COL_TOTAL];

  const celula = (continut, latime, o = {}) => new TableCell({
    width: { size: latime, type: WidthType.DXA },
    borders: borduri,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    shading: o.antet ? { type: ShadingType.CLEAR, color: 'auto', fill: 'D9D9D9' } : undefined,
    children: (Array.isArray(continut) ? continut : [continut]).map(t => new Paragraph({
      alignment: o.stanga ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [text(t, { bold: o.antet || o.bold, size: o.size })]
    }))
  });

  const antet = new TableRow({
    tableHeader: true,
    children: [
      celula('Nr.', COL_NR, { antet: true }),
      celula('Gradul, prenumele, numele', COL_NUME, { antet: true }),
      ...LUNI.map(l => celula(l, COL_LUNA, { antet: true, size: 16 })),
      celula('Total zile', COL_TOTAL, { antet: true })
    ]
  });

  const randuri = personal.map((p, i) => {
    const s = sumarAn(p, an);
    const peLuna = Array.from({ length: 12 }, () => []);
    s.perioade.forEach(per => {
      Object.entries(bucatiPeLuni(per)).forEach(([l, b]) => {
        peLuna[l].push(`${format(b.start, 'dd.MM')}–${format(b.sfarsit, 'dd.MM')}`);
      });
    });
    return new TableRow({
      cantSplit: true,
      children: [
        celula(String(i + 1), COL_NR),
        celula(numeFrumos(p), COL_NUME, { stanga: true }),
        ...peLuna.map(lista => celula(lista.length ? lista : [''], COL_LUNA, { size: 16 })),
        celula(`${s.planificate}/${s.total}`, COL_TOTAL, { bold: true })
      ]
    });
  });

  const document = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, bottom: 720, left: 720, right: 720 }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [text('GRAFICUL', { bold: true, size: 28 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          children: [text(`concediilor de odihnă pentru anul ${an}`, { bold: true, size: 24 })]
        }),
        new Table({
          width: { size: LATIME, type: WidthType.DXA },
          columnWidths: latimi,
          rows: [antet, ...randuri]
        }),
        new Paragraph({
          spacing: { before: 360 },
          children: [text(`Generat la ${format(new Date(), 'dd.MM.yyyy')}. Total zile = planificate / cuvenite.`, { size: 16 })]
        })
      ]
    }]
  });

  return Packer.toBlob(document);
};

export const descarcaGraficConcedii = async (personal, an) => {
  const blob = await genereazaGraficConcedii(personal, an);
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = `grafic-concedii-${an}.docx`;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};
