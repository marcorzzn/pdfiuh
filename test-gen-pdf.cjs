/**
 * Script per generare un PDF di test per pdfiuh.
 * Usa pdf-lib per creare un PDF multi-pagina con testo, colori e form.
 */
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');

async function createTestPDF() {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  // --- Pagina 1: Copertina ---
  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.15, 0.15, 0.22) });
  page1.drawText('pdfiuh', { x: 180, y: 520, size: 60, font: helveticaBold, color: rgb(0.3, 0.76, 1) });
  page1.drawText('Test Document', { x: 190, y: 470, size: 24, font: helvetica, color: rgb(0.85, 0.85, 0.85) });
  page1.drawText('Generato automaticamente per il test completo del rendering.', {
    x: 100, y: 420, size: 14, font: helvetica, color: rgb(0.6, 0.6, 0.65)
  });
  page1.drawText('Data: ' + new Date().toLocaleDateString('it-IT'), {
    x: 220, y: 380, size: 12, font: helvetica, color: rgb(0.5, 0.5, 0.55)
  });

  // Decorazione
  page1.drawRectangle({ x: 50, y: 300, width: 495, height: 2, color: rgb(0.3, 0.76, 1) });
  page1.drawText('Funzionalità testate:', { x: 50, y: 260, size: 16, font: helveticaBold, color: rgb(0.9, 0.9, 0.9) });
  
  const features = [
    '> Rendering testo multi-font',
    '> Rendering colori e rettangoli',
    '> Pagine multiple (3 pagine)',
    '> Ricerca testo (Ctrl+F)',
    '> Annotazioni (evidenzia, inchiostro, note)',
    '> Esportazione PDF con annotazioni',
    '> Zoom e navigazione',
    '> Miniature nella sidebar',
  ];
  
  features.forEach((f, i) => {
    page1.drawText(f, { x: 70, y: 225 - i * 22, size: 13, font: helvetica, color: rgb(0.7, 0.9, 0.7) });
  });

  // --- Pagina 2: Contenuto testuale ---
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('Pagina 2 — Contenuto Testuale', { x: 50, y: 780, size: 22, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page2.drawRectangle({ x: 50, y: 770, width: 400, height: 2, color: rgb(0.3, 0.5, 0.8) });

  const loremParagraphs = [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt',
    'ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco',
    'laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in',
    'voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat',
    'non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    '',
    'Questo paragrafo serve per testare la funzione di ricerca. Prova a cercare la parola',
    '"pdfiuh" oppure "Lorem" usando Ctrl+F per verificare che il find-bar funzioni correttamente.',
    '',
    'pdfiuh è un lettore PDF web-native progettato per essere veloce, leggero e rispettoso della',
    'privacy. Tutti i file vengono elaborati localmente nel browser, senza inviare dati ai server.',
  ];

  loremParagraphs.forEach((line, i) => {
    page2.drawText(line, { x: 50, y: 740 - i * 20, size: 12, font: timesRoman, color: rgb(0.15, 0.15, 0.15) });
  });

  // Sezione con colori
  page2.drawText('Test Colori:', { x: 50, y: 480, size: 16, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  const colors = [
    { name: 'Rosso', color: rgb(0.9, 0.2, 0.2) },
    { name: 'Verde', color: rgb(0.2, 0.7, 0.3) },
    { name: 'Blu', color: rgb(0.2, 0.4, 0.9) },
    { name: 'Arancione', color: rgb(0.95, 0.6, 0.1) },
    { name: 'Viola', color: rgb(0.6, 0.2, 0.8) },
  ];
  colors.forEach((c, i) => {
    page2.drawRectangle({ x: 50 + i * 100, y: 440, width: 80, height: 30, color: c.color });
    page2.drawText(c.name, { x: 60 + i * 100, y: 425, size: 10, font: helvetica, color: rgb(0.3, 0.3, 0.3) });
  });

  // Tabella
  page2.drawText('Test Tabella:', { x: 50, y: 390, size: 16, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  const tableData = [
    ['Funzione', 'Stato', 'Note'],
    ['Rendering', 'OK', 'Bitmap via OffscreenCanvas'],
    ['Annotazioni', 'OK', 'SVG overlay nativo'],
    ['Ricerca', 'OK', 'Text layer indexing'],
    ['Export', 'OK', 'pdf-lib + XFDF'],
  ];
  tableData.forEach((row, ri) => {
    const y = 360 - ri * 22;
    // Sfondo alternato
    if (ri > 0 && ri % 2 === 0) {
      page2.drawRectangle({ x: 50, y: y - 5, width: 495, height: 20, color: rgb(0.95, 0.95, 0.97) });
    }
    row.forEach((cell, ci) => {
      const x = 55 + ci * 170;
      const font = ri === 0 ? helveticaBold : helvetica;
      page2.drawText(cell, { x, y, size: 11, font, color: rgb(0.15, 0.15, 0.15) });
    });
    // Linea sotto header
    if (ri === 0) {
      page2.drawRectangle({ x: 50, y: y - 7, width: 495, height: 1, color: rgb(0.7, 0.7, 0.7) });
    }
  });

  // --- Pagina 3: Annotazione area ---
  const page3 = pdfDoc.addPage([595, 842]);
  page3.drawText('Pagina 3 — Area Annotazioni', { x: 50, y: 780, size: 22, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });
  page3.drawRectangle({ x: 50, y: 770, width: 400, height: 2, color: rgb(0.8, 0.3, 0.5) });

  page3.drawText('Usa gli strumenti nella toolbar per annotare questa pagina:', {
    x: 50, y: 740, size: 14, font: helvetica, color: rgb(0.3, 0.3, 0.3)
  });

  const instructions = [
    '1. Seleziona lo strumento "Evidenzia" (highlight) e traccia un rettangolo',
    '2. Seleziona lo strumento "Disegno" (ink) e disegna a mano libera',
    '3. Seleziona lo strumento "Nota" e clicca per aggiungere una nota testuale',
    '4. Seleziona la "Gomma" per cancellare un\'annotazione',
    '5. Prova a cambiare colore dalla barra dei colori nella toolbar',
    '6. Premi Ctrl+S per esportare il PDF con le annotazioni integrate',
  ];

  instructions.forEach((text, i) => {
    page3.drawText(text, { x: 70, y: 700 - i * 24, size: 12, font: helvetica, color: rgb(0.2, 0.2, 0.2) });
  });

  // Area vuota per disegnare
  page3.drawRectangle({ x: 50, y: 200, width: 495, height: 350, color: rgb(0.97, 0.97, 0.99) });
  page3.drawRectangle({ x: 50, y: 200, width: 495, height: 350, borderColor: rgb(0.7, 0.7, 0.8), borderWidth: 1 });
  page3.drawText('Area di disegno — Usa gli strumenti di annotazione qui', {
    x: 130, y: 370, size: 14, font: helvetica, color: rgb(0.6, 0.6, 0.7)
  });

  // Footer
  page3.drawText('pdfiuh v1.0.0 — Test Document — Generato automaticamente', {
    x: 130, y: 50, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5)
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test-document.pdf', pdfBytes);
  console.log('✅ PDF di test generato: test-document.pdf (' + pdfBytes.length + ' bytes, 3 pagine)');
}

createTestPDF().catch(console.error);
