const PDFDocument = require('pdfkit');

// ── Brand palette (matches Pull-Away Antidote / Stop the Rollercoaster) ──
const C = {
  navy:      '#1E2D4E',
  rose:      '#C4516A',
  violet:    '#7C5CBF',
  teal:      '#2E8B8B',
  amber:     '#C4860A',
  cream:     '#F7F3EE',
  white:     '#FFFFFF',
  border:    '#DDD7CE',
  text:      '#1E1E1E',
  muted:     '#6B6560',
  ltRose:    '#FCEEF1',
  ltViolet:  '#F2EEFB',
  ltTeal:    '#EAF6F6',
  ltAmber:   '#FBF5E6',
  ltNavy:    '#EBF0F8',
  // Cover palette (dark gradient)
  cvDark:    '#1A1030',
  cvMid:     '#2E1A5A',
  cvNav:     '#1E2D4E',
  cvBox:     '#1E1838',
  // Rose text on dark bg approximations
  cvRose:    '#E8758A',
  cvSub:     '#A898C0',
  cvMuted:   '#7868A0',
  cvDim:     '#5A4A78',
  cvFaint:   '#2E2040',
};

function generateBlueprintPdf(blueprint, { name = '', attachmentStyle = '', partnerStyle = '' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const PW = doc.page.width;   // 595.28
    const PH = doc.page.height;  // 841.89
    const ML = 48;
    const TW = PW - ML * 2;
    const firstName = (name || '').split(' ')[0] || 'Your';

    // ─────────────────────────────────────────────────────────────────────
    // DRAWING HELPERS
    // ─────────────────────────────────────────────────────────────────────

    /** Fill a rectangle with an optional opacity. */
    function fillRect(x, y, w, h, color, opacity = 1) {
      doc.save();
      if (opacity < 1) doc.opacity(opacity);
      doc.rect(x, y, w, h).fill(color);
      doc.restore();
    }

    /** Rounded rectangle with optional stroke. */
    function rrect(x, y, w, h, r, fill, stroke, lw = 1) {
      doc.save();
      doc.roundedRect(x, y, w, h, r);
      if (stroke) {
        doc.fillColor(fill).strokeColor(stroke).lineWidth(lw).fillAndStroke();
      } else {
        doc.fill(fill);
      }
      doc.restore();
    }

    /** Horizontal rule. */
    function hRule(y, color = C.border, x = ML, w = TW) {
      doc.save().moveTo(x, y).lineTo(x + w, y)
        .strokeColor(color).lineWidth(0.75).stroke().restore();
    }

    /**
     * Draw text with full style control.
     * doc.y advances; all other style is sandboxed via save/restore.
     */
    function txt(text, x, y, {
      color = C.text, font = 'Helvetica', size = 10.5,
      opacity = 1, width, align = 'left',
      lineGap = 0, paragraphGap = 0, characterSpacing = 0,
      lineBreak = true, continued = false
    } = {}) {
      doc.save();
      if (opacity < 1) doc.opacity(opacity);
      doc.fillColor(color).font(font).fontSize(size);
      const opts = { align, lineGap, paragraphGap, lineBreak, continued, characterSpacing };
      if (width != null) opts.width = width;
      doc.text(text, x, y, opts);
      doc.restore();
    }

    /** Calculate text height without drawing. */
    function textH(text, { font = 'Helvetica', size = 10.5, width = TW, lineGap = 0 } = {}) {
      doc.font(font).fontSize(size);
      return doc.heightOfString(text, { width, lineGap });
    }

    /** Start a new content page with a 6px top accent bar. */
    function newPage(accent = C.violet) {
      doc.addPage({ size: 'A4', margin: 0 });
      fillRect(0, 0, PW, 6, accent);
      doc.y = 28;
    }

    /** Ensure at least `needed` pts remain; otherwise start a new page. */
    function guard(needed, accent = C.violet) {
      if (doc.y + needed > PH - 56) newPage(accent);
    }

    /**
     * Section page header: faded large numeral + label + title + optional sub.
     */
    function pageHeader(numStr, label, title, sub, accent) {
      const y0 = doc.y;

      // Large faded numeral behind content
      doc.save().opacity(0.06).fillColor(C.text).font('Helvetica-Bold').fontSize(72)
        .text(numStr, ML - 4, y0 - 8, { lineBreak: false }).restore();

      const tX = ML + 70, tW = TW - 70;
      txt(label, tX, y0 + 2, { color: accent, font: 'Helvetica-Bold', size: 8.5, characterSpacing: 2, lineBreak: false });
      txt(title, tX, y0 + 16, { color: C.text, font: 'Helvetica-Bold', size: 19, width: tW });
      if (sub) txt(sub, tX, doc.y + 2, { color: C.muted, size: 10, width: tW });

      hRule(doc.y + 8);
      doc.y += 18;
    }

    /** Small all-caps label with a trailing horizontal rule. */
    function sectionRule(label, color = C.muted) {
      guard(30);
      const y0 = doc.y + 8;
      doc.save().fillColor(color).font('Helvetica-Bold').fontSize(8)
        .text(label.toUpperCase(), ML, y0, { characterSpacing: 2, lineBreak: false }).restore();
      const lw = doc.widthOfString(label.toUpperCase(), { characterSpacing: 2 });
      hRule(y0 + 5, C.border, ML + lw + 10, TW - lw - 10);
      doc.y = y0 + 17;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 1 · COVER
    // ─────────────────────────────────────────────────────────────────────

    // Dark gradient background
    const cg = doc.linearGradient(0, 0, PW * 0.55, PH * 1.05);
    cg.stop(0, C.cvDark).stop(0.52, C.cvMid).stop(1, C.cvNav);
    doc.rect(0, 0, PW, PH).fill(cg);

    // Orbs (translucent glow circles)
    doc.save().opacity(0.14); doc.circle(PW + 55, -55, 280).fill(C.rose);   doc.restore();
    doc.save().opacity(0.11); doc.circle(-55, PH + 55, 230).fill(C.violet); doc.restore();
    doc.save().opacity(0.07); doc.circle(PW - 90, PH - 260, 150).fill(C.teal); doc.restore();

    // Brand label
    txt('BONDBLUEPRINT™  ·  COUPLES EDUCATOR', ML, 52, {
      color: C.cvRose, font: 'Helvetica-Bold', size: 9, characterSpacing: 2, lineBreak: false,
    });

    // Badge pill
    const bdgW = 222, bdgH = 22, bdgY = 76;
    rrect(ML, bdgY, bdgW, bdgH, 11, C.cvBox);
    txt('Attachment-Informed  ·  Science-Backed', ML, bdgY + 5, {
      color: C.cvSub, font: 'Helvetica-Bold', size: 8.5, width: bdgW, align: 'center',
    });

    // Main title
    const coverTitle = blueprint.title || `${firstName}'s Bond Blueprint`;
    txt(coverTitle, ML, 112, {
      color: C.white, font: 'Helvetica-Bold', size: 34, width: TW * 0.82, lineGap: 5,
    });

    // Subtitle
    const coverSub = blueprint.subtitle || 'Your personalized guide, built from everything you shared.';
    txt(coverSub, ML, doc.y + 8, {
      color: C.cvSub, font: 'Helvetica', size: 13, width: TW * 0.8, lineGap: 4,
    });

    // Rose divider
    const divY = doc.y + 18;
    fillRect(ML, divY, 44, 3, C.rose);

    // Stat chips
    const asy = blueprint.attachmentStyle || attachmentStyle;
    const psy = blueprint.partnerStyle   || partnerStyle;
    const planLen = blueprint.plan?.length || 7;
    const statChips = [
      { num: asy || 'Your Style',     lbl: 'Attachment Type'  },
      { num: psy || 'Their Pattern',  lbl: 'Partner Style'    },
      { num: `${planLen}-Day`,        lbl: 'Action Plan'      },
    ];
    const sW = (TW - 24) / 3;
    const sY = divY + 20;
    statChips.forEach((s, i) => {
      const sx = ML + i * (sW + 12);
      rrect(sx, sY, sW, 52, 8, C.cvBox);
      doc.save().roundedRect(sx, sY, sW, 52, 8)
        .strokeColor(C.cvFaint).lineWidth(1).stroke().restore();
      txt(s.num, sx + 12, sY + 9,  { color: C.white, font: 'Helvetica-Bold', size: 12, width: sW - 24 });
      txt(s.lbl.toUpperCase(), sx + 12, sY + 28, { color: C.cvMuted, font: 'Helvetica-Bold', size: 7.5, width: sW - 24, characterSpacing: 1 });
    });

    // Cover intro box (left rose border)
    const introText = blueprint.coverIntro ||
      `You are not too much. Your nervous system is doing exactly what it was built to do. This guide will show you how to respond from a place of security instead of panic. What follows is built specifically from what you shared.`;
    const introY = sY + 66;
    const introTH = textH(introText, { size: 10.5, width: TW - 32, lineGap: 3 });
    const introH  = introTH + 24;
    rrect(ML, introY, TW, introH, 10, C.cvBox);
    fillRect(ML, introY, 3, introH, C.rose);
    txt(introText, ML + 16, introY + 12, { color: C.cvSub, font: 'Helvetica', size: 10.5, width: TW - 32, lineGap: 3 });

    // "Prepared for" line
    const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    txt(`Prepared for ${firstName}  ·  ${dateStr}`, ML, introY + introH + 14, {
      color: C.cvDim, font: 'Helvetica', size: 9,
    });

    // Table of contents grid
    const tocY = introY + introH + 36;
    const tocItems = [
      'Your Situation Decoded',
      "What's Really Happening",
      'The Cycle Between You',
      'Scripts That Actually Work',
      'Actions to Take This Week',
      'Your 7-Day Plan',
    ];
    const tcW = (TW - 10) / 2;
    tocItems.forEach((t, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const tx = ML + col * (tcW + 10);
      const ty = tocY + row * 27;
      doc.save().opacity(0.05).roundedRect(tx, ty, tcW, 21, 6).fill(C.white).restore();
      txt(`${i + 1}`, tx + 10, ty + 3,  { color: C.cvDim,  font: 'Helvetica-Bold', size: 13 });
      txt(t,         tx + 30, ty + 5,  { color: C.cvSub,  font: 'Helvetica-Bold', size: 9.5 });
    });

    // Footer
    txt(
      'For educational purposes only  ·  Rooted in attachment science  ·  Not therapy or clinical advice',
      0, PH - 26, { color: C.cvDim, font: 'Helvetica', size: 8, width: PW, align: 'center' },
    );

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 2 · SITUATION BREAKDOWN + WHAT'S HAPPENING + KEY INSIGHT
    // ─────────────────────────────────────────────────────────────────────
    newPage(C.violet);
    pageHeader('01', 'YOUR SITUATION', 'What You Described and What It Reveals',
      'Each detail you shared has been decoded through the lens of attachment science.', C.violet);

    // situationBreakdown cards
    if (blueprint.situationBreakdown?.length) {
      blueprint.situationBreakdown.forEach(item => {
        const quoteStr = `"${item.theyWrote}"`;
        const qH = textH(quoteStr,        { font: 'Helvetica-BoldOblique', size: 10.5, width: TW - 28, lineGap: 2 });
        const mH = textH(item.whatItMeans, { size: 10, width: TW - 28, lineGap: 3 });
        const cardH = qH + mH + 30;

        guard(cardH + 14, C.violet);
        const cY = doc.y;
        rrect(ML, cY, TW, cardH, 10, C.ltAmber);
        fillRect(ML, cY, 4, cardH, C.amber);

        txt(quoteStr, ML + 16, cY + 10, {
          color: C.amber, font: 'Helvetica-BoldOblique', size: 10.5, width: TW - 28, lineGap: 2,
        });
        txt(item.whatItMeans, ML + 16, cY + 10 + qH + 6, {
          color: C.muted, size: 10, width: TW - 28, lineGap: 3,
        });
        doc.y = cY + cardH + 12;
      });
    }

    // What's Actually Happening
    if (blueprint.whatHappening?.length) {
      guard(60, C.violet);
      sectionRule("What's Actually Happening", C.navy);
      blueprint.whatHappening.forEach(para => {
        const ph = textH(para, { size: 10.5, lineGap: 3, width: TW });
        guard(ph + 14, C.violet);
        txt(para, ML, doc.y, { size: 10.5, lineGap: 3, width: TW });
        doc.y += 12;
      });
    }

    // Key insight — science block
    if (blueprint.keyInsight) {
      const insText = blueprint.keyInsight;
      const insH1 = textH(insText, { font: 'Helvetica-Bold', size: 11.5, width: TW - 40, lineGap: 4 });
      const citeH  = blueprint.scienceCite
        ? textH(blueprint.scienceCite, { font: 'Helvetica-Oblique', size: 9, width: TW - 40 }) + 10
        : 0;
      const insH = insH1 + citeH + 44;

      guard(insH + 16, C.violet);
      const insY = doc.y + 10;
      rrect(ML, insY, TW, insH, 10, C.navy);

      txt('THE KEY INSIGHT', ML + 16, insY + 13, {
        color: C.cvMuted, font: 'Helvetica-Bold', size: 8, characterSpacing: 2,
      });
      txt(insText, ML + 16, insY + 30, {
        color: C.white, font: 'Helvetica-Bold', size: 11.5, width: TW - 40, lineGap: 4, opacity: 0.92,
      });
      if (blueprint.scienceCite) {
        txt(blueprint.scienceCite, ML + 16, insY + 30 + insH1 + 8, {
          color: C.cvMuted, font: 'Helvetica-Oblique', size: 9, width: TW - 40,
        });
      }
      doc.y = insY + insH + 16;
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 3 · THE CYCLE + SCRIPTS
    // ─────────────────────────────────────────────────────────────────────
    newPage(C.rose);
    pageHeader('02', 'YOUR DYNAMIC', 'The Cycle Between You',
      'Understanding this loop is the first step to breaking it.', C.rose);

    // Cycle diagram
    if (blueprint.cycleLeft || blueprint.cycleRight) {
      const halfW = (TW - 22) / 2;
      const lTxt  = blueprint.cycleLeft  || '';
      const rTxt  = blueprint.cycleRight || '';
      const lH = lTxt ? textH(lTxt, { size: 10, width: halfW - 22, lineGap: 3 }) + 36 : 66;
      const rH = rTxt ? textH(rTxt, { size: 10, width: halfW - 22, lineGap: 3 }) + 36 : 66;
      const cycH = Math.max(lH, rH, 66);

      const cycY = doc.y;

      // Left — pursuer
      rrect(ML, cycY, halfW, cycH, 8, C.ltRose);
      fillRect(ML, cycY, 4, cycH, C.rose);
      txt('PURSUING / CHASING', ML + 12, cycY + 10, {
        color: C.rose, font: 'Helvetica-Bold', size: 8, characterSpacing: 1,
      });
      if (lTxt) txt(lTxt, ML + 12, cycY + 26, { size: 10, width: halfW - 22, lineGap: 3 });

      // Arrow
      txt('⇄', ML + halfW + 2, cycY + cycH / 2 - 12, {
        color: C.muted, font: 'Helvetica-Bold', size: 20, width: 18, align: 'center',
      });

      // Right — avoidant
      const rxS = ML + halfW + 22;
      rrect(rxS, cycY, halfW, cycH, 8, C.ltNavy);
      fillRect(rxS, cycY, 4, cycH, C.navy);
      txt('WITHDRAWING / PULLING AWAY', rxS + 12, cycY + 10, {
        color: C.navy, font: 'Helvetica-Bold', size: 8, characterSpacing: 0.8, width: halfW - 22,
      });
      if (rTxt) txt(rTxt, rxS + 12, cycY + 26, { size: 10, width: halfW - 22, lineGap: 3 });

      doc.y = cycY + cycH + 20;
    }

    // Scripts
    if (blueprint.scripts?.length) {
      guard(60, C.rose);
      sectionRule('Scripts That Actually Work', C.violet);

      blueprint.scripts.forEach(s => {
        const sayStr  = `"${s.say}"`;
        const sayH    = textH(sayStr, { font: 'Helvetica-Bold', size: 11, width: TW - 56, lineGap: 3 });
        const whyH    = s.why
          ? textH(`Why this works: ${s.why}`, { font: 'Helvetica-Oblique', size: 9.5, width: TW - 40 }) + 10
          : 0;
        const lineH   = sayH + 20;
        const boxH    = lineH + whyH + 38;

        guard(boxH + 12, C.rose);
        const sY = doc.y;

        // Dark gradient box
        const sg = doc.linearGradient(ML, sY, ML + TW, sY + boxH);
        sg.stop(0, '#1A1030').stop(1, '#2E1A5A');
        doc.save().roundedRect(ML, sY, TW, boxH, 10).fill(sg).restore();

        // Context label
        txt((s.context || 'When to use').toUpperCase(), ML + 16, sY + 13, {
          color: C.cvMuted, font: 'Helvetica-Bold', size: 8, characterSpacing: 2,
        });

        // Script line inside box
        const lineY = sY + 30;
        doc.save().roundedRect(ML + 16, lineY, TW - 32, lineH, 6).fillColor('#2A1848').fill().restore();
        fillRect(ML + 16, lineY, 3, lineH, C.rose);
        txt(sayStr, ML + 24, lineY + 8, {
          color: C.white, font: 'Helvetica-Bold', size: 11, width: TW - 52, lineGap: 3, opacity: 0.92,
        });

        if (s.why) {
          txt(`Why this works: ${s.why}`, ML + 16, lineY + lineH + 8, {
            color: C.cvMuted, font: 'Helvetica-Oblique', size: 9.5, width: TW - 40,
          });
        }

        doc.y = sY + boxH + 10;
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 4 · ACTIONS + AVOID + 7-DAY PLAN
    // ─────────────────────────────────────────────────────────────────────
    newPage(C.teal);
    pageHeader('03', 'YOUR ACTION PLAN', 'What to Do Starting Now',
      'Concrete steps rooted in attachment science, ordered by impact.', C.teal);

    // Actions (numbered circles)
    if (blueprint.actions?.length) {
      blueprint.actions.forEach((action, i) => {
        const aH  = textH(action, { size: 10.5, width: TW - 46, lineGap: 3 });
        const rowH = Math.max(aH, 24) + 16;
        guard(rowH + 6, C.teal);

        const aY   = doc.y;
        const numR = 13;

        doc.save().circle(ML + numR, aY + numR, numR).fill(C.teal).restore();
        txt(`${i + 1}`, ML, aY + 5, {
          color: C.white, font: 'Helvetica-Bold', size: 11, width: numR * 2, align: 'center',
        });
        txt(action, ML + numR * 2 + 10, aY + 5, { size: 10.5, width: TW - numR * 2 - 10, lineGap: 3 });

        const rowBot = Math.max(doc.y, aY + numR * 2) + 5;
        hRule(rowBot);
        doc.y = rowBot + 10;
      });
      doc.y += 6;
    }

    // Patterns to avoid
    if (blueprint.avoid?.length) {
      guard(70, C.teal);
      sectionRule('Patterns to Stop', C.rose);

      blueprint.avoid.forEach(item => {
        const itH  = textH(item, { size: 10, width: TW - 48, lineGap: 3 });
        const cardH = Math.max(itH + 20, 36);
        guard(cardH + 8, C.teal);

        const aY = doc.y;
        rrect(ML, aY, TW, cardH, 8, C.ltRose);
        fillRect(ML, aY, 4, cardH, C.rose);
        txt('✕', ML + 13, aY + (cardH - 14) / 2, { color: C.rose, font: 'Helvetica-Bold', size: 13 });
        txt(item, ML + 34, aY + (cardH - itH) / 2, { size: 10, width: TW - 46, lineGap: 3 });

        doc.y = aY + cardH + 7;
      });
      doc.y += 4;
    }

    // 7-day plan
    if (blueprint.plan?.length) {
      guard(160, C.teal);
      sectionRule(`Your ${blueprint.plan.length}-Day Plan`, C.navy);

      blueprint.plan.forEach((day, i) => {
        const match    = day.match(/^(Day \d+):?\s*(.*)/i);
        const dayLabel = match ? match[1] : `Day ${i + 1}`;
        const dayText  = match ? match[2] : day;

        const dH   = textH(dayText, { size: 10, width: TW - 88, lineGap: 3 });
        const rowH = Math.max(dH + 14, 28);
        guard(rowH + 8, C.teal);

        const rY = doc.y;
        rrect(ML, rY, 62, rowH, 6, C.navy);
        txt(dayLabel.toUpperCase(), ML, rY + (rowH - 10) / 2, {
          color: C.white, font: 'Helvetica-Bold', size: 7.5, width: 62, align: 'center', characterSpacing: 0.5,
        });
        txt(dayText, ML + 74, rY + (rowH - dH) / 2, { size: 10, width: TW - 88, lineGap: 3 });

        hRule(rY + rowH + 4);
        doc.y = rY + rowH + 13;
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // PAGE 5 · RESEARCH + CLOSING AFFIRMATION
    // ─────────────────────────────────────────────────────────────────────
    if (blueprint.citations?.length) {
      if (doc.y > PH - 200) newPage(C.navy);
      doc.y += 6;
      sectionRule('Research Behind This Guide', C.muted);

      blueprint.citations.forEach(cite => {
        const cH = textH('• ' + cite, { size: 9, width: TW, lineGap: 2 });
        guard(cH + 8, C.navy);
        txt('• ' + cite, ML, doc.y, { color: C.muted, size: 9, width: TW, lineGap: 2 });
        doc.y += 8;
      });
    }

    // Closing affirmation block
    guard(120);
    const closingMsg = blueprint.closingMessage ||
      `You are not too much. You are not broken. You have an attachment history, and now you have a map. What you do next matters more than what happened before.`;
    const clMsgH  = textH(closingMsg, { font: 'Helvetica-BoldOblique', size: 12, width: TW - 44, lineGap: 4 });
    const closingH = clMsgH + 56;

    const clY = doc.y + 12;
    const clg = doc.linearGradient(ML, clY, ML + TW, clY + closingH);
    clg.stop(0, '#1A1030').stop(1, '#2E1A5A');
    doc.save().roundedRect(ML, clY, TW, closingH, 12).fill(clg).restore();
    fillRect(ML, clY, 4, closingH, C.violet);

    txt(closingMsg, ML + 20, clY + 16, {
      color: C.white, font: 'Helvetica-BoldOblique', size: 12, width: TW - 44, lineGap: 4, opacity: 0.88,
    });
    txt('Ash | Couples Educator', ML + 20, clY + closingH - 22, {
      color: C.cvMuted, font: 'Helvetica', size: 9,
    });

    doc.y = clY + closingH + 24;

    // Footer
    hRule(doc.y);
    doc.y += 8;
    txt(
      'BondBlueprint™ by CouplesEducator.com  ·  Psychoeducational content only, not therapy or clinical advice.  ·  For mental health support, consult a licensed professional.',
      ML, doc.y, { color: C.muted, size: 8, width: TW, align: 'center', lineGap: 2 },
    );

    doc.end();
  });
}

module.exports = { generateBlueprintPdf };
