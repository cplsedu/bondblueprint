const PDFDocument = require('pdfkit');

const C = {
  green:    '#2C4A35',
  greenDk:  '#1E3526',
  accent:   '#E07A3A',
  gold:     '#D4A843',
  textDk:   '#1A1714',
  textMd:   '#5A5450',
  textLt:   '#9A908A',
  border:   '#EAE3D9',
  bgLight:  '#FAF7F3',
  bgGreen:  '#E6F0E9',
  bgOrange: '#FDF0E6',
  bgBlue:   '#E6EEF5',
  white:    '#FFFFFF',
  red:      '#DC2626'
};

function generateBlueprintPdf(blueprint, { name = '', attachmentStyle = '', partnerStyle = '' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW  = doc.page.width;
    const PH  = doc.page.height;
    const ML  = 50;
    const MR  = 50;
    const TW  = PW - ML - MR;
    const firstName = name?.split(' ')[0] || 'Your';

    function newPage() {
      doc.addPage({ size: 'A4', margin: 0 });
    }

    function colorRect(x, y, w, h, color) {
      doc.save().rect(x, y, w, h).fill(color).restore();
    }

    function hRule(y, color = C.border, lx = ML, width = TW) {
      doc.save().moveTo(lx, y).lineTo(lx + width, y).strokeColor(color).lineWidth(0.75).stroke().restore();
    }

    function sectionLabel(text, color = C.green, yOffset = 6) {
      doc.moveDown(yOffset / 12);
      doc.save()
        .fillColor(color)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(text.toUpperCase(), ML, doc.y, { characterSpacing: 1.2 })
        .restore();
      hRule(doc.y + 2, color);
      doc.moveDown(0.5);
    }

    // ─── COVER PAGE ──────────────────────────────────────────────────
    colorRect(0, 0, PW, 220, C.greenDk);

    // Tagline
    doc.save().fillColor(C.gold).font('Helvetica-Bold').fontSize(8)
      .text('BONDBLUEPRINT™', ML, 28, { characterSpacing: 2 }).restore();

    // Title
    const title = blueprint.title || 'Your Personal Relationship Reading';
    doc.save().fillColor(C.white).font('Helvetica-Bold').fontSize(22)
      .text(title, ML, 48, { width: TW, lineGap: 5 }).restore();

    // Prepared for line
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    doc.save().fillColor('rgba(255,255,255,0.6)').font('Helvetica').fontSize(9.5)
      .text(`Prepared for ${firstName}  ·  ${dateStr}`, ML, doc.y + 10, { width: TW }).restore();

    // Style chips
    if (attachmentStyle || partnerStyle) {
      const chipY = 175;
      const chipW = 110;
      colorRect(ML, chipY, chipW, 34, 'rgba(255,255,255,0.10)');
      colorRect(ML + chipW + 14, chipY, chipW, 34, 'rgba(255,255,255,0.10)');

      doc.save().fillColor('rgba(255,255,255,0.5)').font('Helvetica').fontSize(7)
        .text('YOUR STYLE', ML + 8, chipY + 6, { characterSpacing: 1 }).restore();
      doc.save().fillColor(C.white).font('Helvetica-Bold').fontSize(11)
        .text(attachmentStyle || '—', ML + 8, chipY + 17).restore();

      doc.save().fillColor('rgba(255,255,255,0.5)').font('Helvetica').fontSize(7)
        .text('THEIR STYLE', ML + chipW + 22, chipY + 6, { characterSpacing: 1 }).restore();
      doc.save().fillColor(C.white).font('Helvetica-Bold').fontSize(11)
        .text(partnerStyle || '—', ML + chipW + 22, chipY + 17).restore();
    }

    // Disclaimer strip at bottom of cover
    colorRect(0, PH - 32, PW, 32, C.bgLight);
    doc.save().fillColor(C.textLt).font('Helvetica').fontSize(7.5)
      .text('Psychoeducational content only — not therapy or clinical advice. Based on peer-reviewed attachment research.', 0, PH - 22, { width: PW, align: 'center' })
      .restore();

    // ─── PAGE 2: SITUATION BREAKDOWN + WHAT'S HAPPENING ─────────────
    newPage();
    colorRect(0, 0, PW, 8, C.green);
    doc.y = 28;

    if (blueprint.situationBreakdown?.length) {
      sectionLabel('What You Described — And What It Reveals', C.green, 0);

      blueprint.situationBreakdown.forEach((item, i) => {
        if (doc.y > PH - 140) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }

        const boxY = doc.y;
        colorRect(ML, boxY, 3, 52, C.accent);
        colorRect(ML + 3, boxY, TW - 3, 52, C.bgOrange);

        doc.save().fillColor(C.accent).font('Helvetica-BoldOblique').fontSize(10)
          .text(`"${item.theyWrote}"`, ML + 12, boxY + 6, { width: TW - 20, lineGap: 2 }).restore();
        const quoteH = doc.y - boxY;
        const finalBoxH = Math.max(52, quoteH + 8);
        colorRect(ML, boxY, 3, finalBoxH, C.accent);
        colorRect(ML + 3, boxY, TW - 3, finalBoxH, C.bgOrange);

        doc.save().fillColor(C.accent).font('Helvetica-BoldOblique').fontSize(10)
          .text(`"${item.theyWrote}"`, ML + 12, boxY + 6, { width: TW - 20, lineGap: 2 }).restore();
        doc.save().fillColor(C.textMd).font('Helvetica').fontSize(9.5)
          .text(item.whatItMeans, ML + 12, doc.y + 4, { width: TW - 20, lineGap: 2 }).restore();

        doc.y = boxY + finalBoxH + 12;
      });
    }

    if (blueprint.whatHappening?.length) {
      if (doc.y > PH - 200) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
      sectionLabel("What's Actually Happening", C.green);

      blueprint.whatHappening.forEach(para => {
        if (doc.y > PH - 80) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
        doc.save().fillColor(C.textDk).font('Helvetica').fontSize(10)
          .text(para, ML, doc.y, { width: TW, lineGap: 3, paragraphGap: 6 }).restore();
        doc.moveDown(0.6);
      });
    }

    // Key insight callout
    if (blueprint.keyInsight) {
      if (doc.y > PH - 100) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
      doc.moveDown(0.5);
      const insY = doc.y;
      colorRect(ML, insY, TW, 2, C.gold);

      doc.save().fillColor(C.green).font('Helvetica-Bold').fontSize(8)
        .text('THE INSIGHT', ML, insY + 10, { characterSpacing: 1.2 }).restore();
      doc.save().fillColor(C.textDk).font('Helvetica-BoldOblique').fontSize(12)
        .text(blueprint.keyInsight, ML, doc.y + 6, { width: TW, lineGap: 4 }).restore();

      colorRect(ML, doc.y + 8, TW, 2, C.gold);
      doc.y = doc.y + 18;
    }

    // ─── PAGE 3: CYCLE + SCRIPTS ─────────────────────────────────────
    newPage();
    colorRect(0, 0, PW, 8, C.accent);
    doc.y = 28;

    if (blueprint.cycleLeft && blueprint.cycleRight) {
      sectionLabel('The Cycle Between You', C.accent, 0);

      const cycY   = doc.y;
      const halfW  = (TW - 20) / 2;
      const cycH   = 70;

      colorRect(ML, cycY, halfW, cycH, C.bgOrange);
      colorRect(ML + halfW + 20, cycY, halfW, cycH, C.bgBlue);

      doc.save().fillColor(C.accent).font('Helvetica-Bold').fontSize(8)
        .text('PURSUING / CHASING', ML + 8, cycY + 8, { characterSpacing: 0.8 }).restore();
      doc.save().fillColor(C.textDk).font('Helvetica').fontSize(9.5)
        .text(blueprint.cycleLeft, ML + 8, cycY + 22, { width: halfW - 16, lineGap: 2 }).restore();

      doc.save().fillColor(C.textLt).font('Helvetica-Bold').fontSize(18)
        .text('⇄', ML + halfW + 2, cycY + 24, { width: 18, align: 'center' }).restore();

      doc.save().fillColor('#3A5878').font('Helvetica-Bold').fontSize(8)
        .text('WITHDRAWING / PULLING AWAY', ML + halfW + 28, cycY + 8, { characterSpacing: 0.8 }).restore();
      doc.save().fillColor(C.textDk).font('Helvetica').fontSize(9.5)
        .text(blueprint.cycleRight, ML + halfW + 28, cycY + 22, { width: halfW - 16, lineGap: 2 }).restore();

      doc.y = cycY + cycH + 20;
    }

    if (blueprint.scripts?.length) {
      sectionLabel('Exact Scripts to Use', C.green);

      blueprint.scripts.forEach(s => {
        if (doc.y > PH - 90) { newPage(); colorRect(0, 0, PW, 8, C.accent); doc.y = 28; }
        doc.save().fillColor(C.textLt).font('Helvetica-Oblique').fontSize(8.5)
          .text(s.context, ML, doc.y).restore();

        const scriptY = doc.y + 4;
        colorRect(ML, scriptY, 3, 34, C.green);
        doc.save().fillColor(C.green).font('Helvetica-Bold').fontSize(10.5)
          .text(`"${s.say}"`, ML + 10, scriptY + 5, { width: TW - 14, lineGap: 3 }).restore();

        const endY = doc.y;
        const barH  = Math.max(34, endY - scriptY + 8);
        colorRect(ML, scriptY, 3, barH, C.green);

        doc.y = scriptY + barH + 10;
      });
    }

    // ─── PAGE 4: ACTIONS + AVOID + 7-DAY PLAN ────────────────────────
    newPage();
    colorRect(0, 0, PW, 8, C.green);
    doc.y = 28;

    if (blueprint.actions?.length) {
      sectionLabel('Actions Worth Taking', C.green, 0);

      blueprint.actions.forEach((action, i) => {
        if (doc.y > PH - 60) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
        const numW = 22;
        colorRect(ML, doc.y, numW, 22, C.bgGreen);
        doc.save().fillColor(C.green).font('Helvetica-Bold').fontSize(10)
          .text(`${i + 1}`, ML, doc.y + 4, { width: numW, align: 'center' }).restore();
        doc.save().fillColor(C.textDk).font('Helvetica').fontSize(10)
          .text(action, ML + numW + 8, doc.y + 4, { width: TW - numW - 8, lineGap: 2 }).restore();
        doc.y = doc.y + 26;
      });

      doc.moveDown(0.5);
    }

    if (blueprint.avoid?.length) {
      if (doc.y > PH - 120) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
      sectionLabel('Patterns to Stop', C.accent);

      blueprint.avoid.forEach(item => {
        if (doc.y > PH - 50) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
        doc.save().fillColor(C.red).font('Helvetica-Bold').fontSize(11)
          .text('✕', ML, doc.y, { continued: false }).restore();
        doc.save().fillColor(C.textDk).font('Helvetica').fontSize(10)
          .text(item, ML + 18, doc.y - 14, { width: TW - 18, lineGap: 2 }).restore();
        doc.moveDown(0.4);
      });

      doc.moveDown(0.5);
    }

    if (blueprint.plan?.length) {
      if (doc.y > PH - 200) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
      sectionLabel('Your 7-Day Plan', C.green);

      blueprint.plan.forEach((day, i) => {
        if (doc.y > PH - 55) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
        const match = day.match(/^(Day \d+):?\s*(.*)/i);
        const dayLabel = match ? match[1] : `Day ${i + 1}`;
        const dayText  = match ? match[2] : day;

        const rowY = doc.y;
        const labelW = 52;
        colorRect(ML, rowY, labelW, 24, C.green);
        doc.save().fillColor(C.white).font('Helvetica-Bold').fontSize(8.5)
          .text(dayLabel.toUpperCase(), ML, rowY + 6, { width: labelW, align: 'center', characterSpacing: 0.5 }).restore();
        doc.save().fillColor(C.textDk).font('Helvetica').fontSize(10)
          .text(dayText, ML + labelW + 10, rowY + 5, { width: TW - labelW - 10, lineGap: 2 }).restore();
        doc.y = rowY + 28;
      });

      doc.moveDown(0.5);
    }

    // ─── PAGE 5: CITATIONS + FOOTER ──────────────────────────────────
    if (blueprint.citations?.length) {
      if (doc.y > PH - 160) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
      sectionLabel('Research Behind This Reading', C.textLt);

      blueprint.citations.forEach(cite => {
        if (doc.y > PH - 50) { newPage(); colorRect(0, 0, PW, 8, C.green); doc.y = 28; }
        doc.save().fillColor(C.textMd).font('Helvetica').fontSize(9)
          .text('• ' + cite, ML, doc.y, { width: TW, lineGap: 2 }).restore();
        doc.moveDown(0.35);
      });
    }

    // Footer
    doc.moveDown(1.5);
    hRule(doc.y, C.border);
    doc.moveDown(0.4);
    doc.save().fillColor(C.textLt).font('Helvetica').fontSize(8)
      .text(
        'BondBlueprint™ by CouplesEducator.com  ·  This is psychoeducational content only, not therapy or clinical advice.  ·  For mental health support, consult a licensed professional.',
        ML, doc.y, { width: TW, align: 'center', lineGap: 2 }
      ).restore();

    doc.end();
  });
}

module.exports = { generateBlueprintPdf };
