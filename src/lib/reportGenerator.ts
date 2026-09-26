import type { Project, ProjectActivity } from '@/types';

type ReportLabels = {
  isRtl: boolean;
  title: string;
  subtitle: (certId: string) => string;
  projectName: string;
  reportDate: string;
  contractor: string;
  consultant: string;
  contractNo: string;
  paymentCertNo: string;
  section1Kpi: string;
  kpiBudget: string;
  kpiChangeOrderBudget: string;
  kpiExecutedToDate: string;
  kpiFinancialProgress: string;
  kpiRemainingValue: string;
  section2Charts: string;
  chartFinancialPosition: string;
  chartExecutedVsRemaining: string;
  barBudget: string;
  barExecutedToDate: string;
  barRemainingValue: string;
  donutExecuted: string;
  donutRemaining: string;
  donutCaption: (remaining: string) => string;
  sectionStagePosition: string;
  stageDelivered: string;
  stagePending: string;
  stageCaptionLeft: (delivered: number, total: number) => string;
  stageCaptionRight: (pending: number) => string;
  page2Header: string;
  page2Subheader: string;
  colTaskName: string;
  colPlannedProgress: string;
  colActualProgress: string;
  colPlannedSpent: string;
  colActualSpent: string;
  colActivityStatus: string;
  statusNotStarted: string;
  statusInProgress: string;
  statusCompleted: string;
  statusDelayed: string;
  statusRisk: string;
  footerConfidential: string;
  footerPage: (page: number, total: number) => string;
  footerReportDate: (date: string) => string;
  sar: string;
  emptyTasks: string;
};

// Characters that have direct WinAnsi byte equivalents — rendered as octal escapes
const WIN_ANSI_MAP: Record<string, number> = {
  '\u2014': 0x97, // em dash
  '\u2013': 0x96, // en dash
  '\u2018': 0x91, // left single quote
  '\u2019': 0x92, // right single quote
  '\u201A': 0x82, // single low-9 quote
  '\u201C': 0x93, // left double quote
  '\u201D': 0x94, // right double quote
  '\u201E': 0x84, // double low-9 quote
  '\u2026': 0x85, // ellipsis
  '\u00A0': 0xA0, // non-breaking space
  '\u00B7': 0xB7, // middle dot
  '\u00AB': 0xAB, // left angle quote
  '\u00BB': 0xBB, // right angle quote
  '\u00A9': 0xA9, // copyright
  '\u00AE': 0xAE, // registered
  '\u2122': 0x99, // trademark
  '\u00B0': 0xB0, // degree
  '\u00B1': 0xB1, // plus-minus
  '\u00D7': 0xD7, // multiplication
  '\u00F7': 0xF7, // division
  '\u20AC': 0x80, // euro
  '\u00A3': 0xA3, // pound
  '\u00A5': 0xA5, // yen
};

const COMMON_TRANSLITERATIONS: Record<string, string> = {
  '\u2012': '-', '\u2010': '-', '\u2011': '-',
  '\u201B': "'", '\u201F': '"',
  '\u202F': ' ',
  '\u060C': ',', '\u061B': ';', '\u061F': '?',
  '\u066A': '%', '\u066B': '%',
};

function transliterateChar(ch: string): string {
  if (COMMON_TRANSLITERATIONS[ch] !== undefined) return COMMON_TRANSLITERATIONS[ch];
  const code = ch.codePointAt(0)!;
  if (code < 0x80) return ch;
  return '';
}

function escapePdfText(value: string): string {
  let result = '';
  for (const ch of Array.from(value)) {
    if (ch === '\\' || ch === '(' || ch === ')') {
      result += '\\' + ch;
    } else if (WIN_ANSI_MAP[ch] !== undefined) {
      result += '\\' + WIN_ANSI_MAP[ch].toString(8).padStart(3, '0');
    } else {
      result += transliterateChar(ch);
    }
  }
  return result;
}

function fmtSar(amount: number, sarLabel: string): string {
  return `${sarLabel} ${amount.toLocaleString('en-US')}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (lines.length === 0) lines.push('');
  return lines;
}

function textOp(font: string, size: number, x: number, y: number, text: string): string {
  return `0 0 0 rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function textOpMulti(font: string, size: number, x: number, y: number, lines: string[], lineH: number): string {
  return lines.map((line, i) => textOp(font, size, x, y - i * lineH, line)).join('\n');
}

function textOpWhite(font: string, size: number, x: number, y: number, text: string): string {
  return `1 1 1 rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

function textOpColor(font: string, size: number, x: number, y: number, text: string, r: number, g: number, b: number): string {
  return `${r} ${g} ${b} rg BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(text)}) Tj ET`;
}

const PAGE_TOP = 740;
const PAGE_BOTTOM = 50;
const PAGE_MARGIN = 40;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * PAGE_MARGIN;

// Executive color palette — refined, not flashy
const NAVY: [number, number, number] = [0.13, 0.17, 0.30];
const BURGUNDY: [number, number, number] = [0.50, 0.20, 0.25];
const BURGUNDY_LIGHT: [number, number, number] = [0.68, 0.36, 0.38];
const GOLD: [number, number, number] = [0.78, 0.66, 0.40];
const GOLD_LIGHT: [number, number, number] = [0.90, 0.84, 0.66];
const BG_WARM: [number, number, number] = [1.0, 1.0, 1.0];
const CARD_BG: [number, number, number] = [1.0, 1.0, 1.0];
const CARD_BORDER: [number, number, number] = [0.86, 0.82, 0.76];
const ALT_ROW: [number, number, number] = [0.97, 0.97, 0.97];
const MUTED: [number, number, number] = [0.52, 0.47, 0.44];
const HAIRLINE: [number, number, number] = [0.82, 0.78, 0.72];

// Status badge colors: [bg, text]
const STATUS_COLORS: Record<string, [number, number, number, number, number, number]> = {
  paid:            [0.20, 0.60, 0.35, 1.0, 1.0, 1.0],
  not_paid:        [0.78, 0.52, 0.28, 0.18, 0.14, 0.10],
  approved:        [0.20, 0.60, 0.35, 1.0, 1.0, 1.0],
  pending_finance: [0.78, 0.66, 0.40, 0.18, 0.14, 0.10],
  pending_pm:      [0.78, 0.66, 0.40, 0.18, 0.14, 0.10],
  rejected:        [0.68, 0.22, 0.22, 1.0, 1.0, 1.0],
  resubmitted:     [0.78, 0.52, 0.28, 0.18, 0.14, 0.10],
  finance_rejected:[0.68, 0.22, 0.22, 1.0, 1.0, 1.0],
  not_started:     [0.68, 0.66, 0.62, 0.22, 0.20, 0.18],
  in_progress:     [0.22, 0.45, 0.70, 1.0, 1.0, 1.0],
  completed:       [0.20, 0.60, 0.35, 1.0, 1.0, 1.0],
  delayed:         [0.72, 0.32, 0.22, 1.0, 1.0, 1.0],
  risk:            [0.78, 0.52, 0.18, 0.18, 0.14, 0.10],
};

function getStatusColor(status: string): [number, number, number, number, number, number] {
  return STATUS_COLORS[status] || [0.68, 0.66, 0.62, 0.22, 0.20, 0.18];
}

function roundRectOps(x: number, y: number, w: number, h: number, r: number): string {
  const r2 = Math.min(r, w / 2, h / 2);
  return [
    `${(x + r2).toFixed(2)} ${y.toFixed(2)} m`,
    `${(x + w - r2).toFixed(2)} ${y.toFixed(2)} l`,
    `${(x + w).toFixed(2)} ${y.toFixed(2)} ${(x + w).toFixed(2)} ${(y + r2).toFixed(2)} l`,
    `${(x + w).toFixed(2)} ${(y + h - r2).toFixed(2)} l`,
    `${(x + w).toFixed(2)} ${(y + h).toFixed(2)} ${(x + w - r2).toFixed(2)} ${(y + h).toFixed(2)} l`,
    `${(x + r2).toFixed(2)} ${(y + h).toFixed(2)} l`,
    `${x.toFixed(2)} ${(y + h).toFixed(2)} ${x.toFixed(2)} ${(y + h - r2).toFixed(2)} l`,
    `${x.toFixed(2)} ${(y + r2).toFixed(2)} l`,
    `${x.toFixed(2)} ${y.toFixed(2)} ${(x + r2).toFixed(2)} ${y.toFixed(2)} l`,
  ].join('\n');
}

function roundRectFill(x: number, y: number, w: number, h: number, r: number, c: [number, number, number]): string {
  return `${c[0]} ${c[1]} ${c[2]} rg\n${roundRectOps(x, y, w, h, r)}\nh f`;
}

function roundRectStroke(x: number, y: number, w: number, h: number, r: number, c: [number, number, number], lw: number): string {
  return `${c[0]} ${c[1]} ${c[2]} RG ${lw} w\n${roundRectOps(x, y, w, h, r)}\nh S`;
}

function drawStatusBadge(x: number, y: number, text: string, status: string, centerX?: number): string {
  const padding = 5;
  const charWidth = 3.5;
  const badgeWidth = text.length * charWidth + padding * 2;
  const badgeHeight = 12;
  const [bgR, bgG, bgB, tR, tG, tB] = getStatusColor(status);
  let badgeX = x;
  if (centerX !== undefined) {
    badgeX = centerX - badgeWidth / 2;
  }
  return [
    roundRectFill(badgeX, y - badgeHeight / 2, badgeWidth, badgeHeight, 6, [bgR, bgG, bgB]),
    textOpColor('F1', 5.5, badgeX + padding, y - 3, text, tR, tG, tB),
  ].join('\n');
}

// Compact section header — navy text + thin burgundy underline
function drawSectionHeader(text: string, x: number, y: number, fontSize: number): string {
  const textWidth = text.length * fontSize * 0.52;
  return [
    textOpColor('F2', fontSize, x, y, text, NAVY[0], NAVY[1], NAVY[2]),
    `${BURGUNDY[0]} ${BURGUNDY[1]} ${BURGUNDY[2]} RG 1.2 w ${x} ${y - 3} m ${x + Math.min(textWidth, 50)} ${y - 3} l S`,
  ].join('\n');
}

type Align = 'left' | 'center';

function drawTable(
  y: number,
  headers: string[],
  rows: string[][],
  colWidths: number[],
  startX: number,
  statusColIndex?: number,
  alignments?: Align[],
  statusKeys?: string[],
  emptyMessage?: string,
): { ops: string; endY: number } {
  const ops: string[] = [];
  const headerHeight = 22;
  const minRowHeight = 26;
  const lineHeight = 10;
  const hPad = 8;
  const vPad = 6;
  let currentY = y;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  const containerR = 6;
  const headerR = 5;

  // Header row — solid navy with WHITE text, rounded top corners
  ops.push(roundRectFill(startX, currentY - headerHeight + 10, totalWidth, headerHeight, headerR, NAVY));

  let xPos = startX;
  headers.forEach((header, i) => {
    const colW = colWidths[i];
    const maxChars = Math.floor((colW - hPad * 2) / 4);
    const lines = wrapText(header.toUpperCase(), maxChars);
    const align = alignments?.[i] ?? 'left';
    if (align === 'center') {
      lines.forEach((line, li) => {
        const lineWidth = line.length * 3.3;
        const textX = xPos + (colW - lineWidth) / 2;
        ops.push(textOpWhite('F2', 6.5, textX, currentY - 5 - li * lineHeight, line));
      });
    } else {
      lines.forEach((line, li) => {
        ops.push(textOpWhite('F2', 6.5, xPos + hPad, currentY - 5 - li * lineHeight, line));
      });
    }
    xPos += colW;
  });
  currentY -= headerHeight;

  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx];
    const maxLinesPerCell = row.map((_, i) => {
      const maxChars = Math.floor((colWidths[i] - hPad * 2) / 4);
      return wrapText(row[i], maxChars);
    });
    const maxLines = Math.max(...maxLinesPerCell.map((l) => l.length));
    const rowHeight = Math.max(minRowHeight, maxLines * lineHeight + vPad * 2);

    // Alternating row tint — warm, very subtle
    if (rowIdx % 2 === 1) {
      ops.push(`${ALT_ROW[0]} ${ALT_ROW[1]} ${ALT_ROW[2]} rg ${startX} ${currentY - rowHeight + 10} ${totalWidth} ${rowHeight} re f`);
    }

    xPos = startX;
    row.forEach((cell, i) => {
      const colW = colWidths[i];
      const align = alignments?.[i] ?? 'left';
      if (statusColIndex !== undefined && i === statusColIndex) {
        const colCenterX = xPos + colW / 2;
        ops.push(drawStatusBadge(xPos, currentY - rowHeight / 2 + 10, cell, statusKeys?.[rowIdx] ?? cell, colCenterX));
      } else {
        const maxChars = Math.floor((colW - hPad * 2) / 4);
        const lines = wrapText(cell, maxChars);
        if (align === 'center') {
          lines.forEach((line, li) => {
            const lineWidth = line.length * 3.5;
            const textX = xPos + (colW - lineWidth) / 2;
            ops.push(textOpColor('F1', 7, textX, currentY - rowHeight / 2 + 3 - li * lineHeight, line, NAVY[0], NAVY[1], NAVY[2]));
          });
        } else {
          lines.forEach((line, li) => {
            ops.push(textOpColor('F1', 7, xPos + hPad, currentY - rowHeight / 2 + 3 - li * lineHeight, line, NAVY[0], NAVY[1], NAVY[2]));
          });
        }
      }
      xPos += colW;
    });
    currentY -= rowHeight;
  }

  // Empty-state row — styled placeholder when there are no data rows
  if (rows.length === 0 && emptyMessage) {
    const emptyRowHeight = 30;
    ops.push(`${ALT_ROW[0]} ${ALT_ROW[1]} ${ALT_ROW[2]} rg ${startX} ${currentY - emptyRowHeight + 10} ${totalWidth} ${emptyRowHeight} re f`);
    const msgLines = wrapText(emptyMessage, Math.floor((totalWidth - hPad * 2) / 4));
    msgLines.forEach((line, li) => {
      const lineWidth = line.length * 3.3;
      const textX = startX + (totalWidth - lineWidth) / 2;
      ops.push(textOpColor('F1', 7, textX, currentY - emptyRowHeight / 2 + 3 - li * lineHeight, line, MUTED[0], MUTED[1], MUTED[2]));
    });
    currentY -= emptyRowHeight;
  }

  // Container border only — drawn last, stroke only so it never covers content
  const totalHeight = y - currentY + 10;
  ops.push(roundRectStroke(startX, y + 10, totalWidth, totalHeight, containerR, CARD_BORDER, 0.5));

  return { ops: ops.join('\n'), endY: currentY - 4 };
}

function drawKpiCards(
  y: number,
  kpis: { label: string; value: string; highlight?: boolean }[],
): { ops: string; endY: number } {
  const ops: string[] = [];
  const cardHeight = 50;
  const gap = 6;
  const cardWidth = Math.floor((CONTENT_WIDTH - (kpis.length - 1) * gap) / kpis.length);
  const totalCardsWidth = kpis.length * cardWidth + (kpis.length - 1) * gap;
  const startX = PAGE_MARGIN + (CONTENT_WIDTH - totalCardsWidth) / 2;
  const cornerR = 4;

  kpis.forEach((kpi, i) => {
    const x = startX + i * (cardWidth + gap);
    const cardBottom = y - cardHeight;

    if (kpi.highlight) {
      ops.push(roundRectFill(x, cardBottom, cardWidth, cardHeight, cornerR, NAVY));
      ops.push(roundRectStroke(x, cardBottom, cardWidth, cardHeight, cornerR, NAVY, 0.5));
    } else {
      ops.push(roundRectFill(x, cardBottom, cardWidth, cardHeight, cornerR, CARD_BG));
      ops.push(roundRectStroke(x, cardBottom, cardWidth, cardHeight, cornerR, CARD_BORDER, 0.4));
    }

    const valueLines = wrapText(kpi.value, Math.floor((cardWidth - 12) / 5.5));
    const valueY = valueLines.length > 1 ? y - 17 : y - 20;

    if (kpi.highlight) {
      ops.push(textOpWhite('F2', 12, x + 8, valueY, valueLines[0] || ''));
    } else {
      ops.push(textOpColor('F2', 12, x + 8, valueY, valueLines[0] || '', NAVY[0], NAVY[1], NAVY[2]));
    }
    if (valueLines.length > 1) {
      if (kpi.highlight) {
        ops.push(textOpWhite('F1', 7, x + 8, y - 29, valueLines.slice(1).join(' ')));
      } else {
        ops.push(textOpColor('F1', 7, x + 8, y - 29, valueLines.slice(1).join(' '), NAVY[0], NAVY[1], NAVY[2]));
      }
    }

    // Label with safe wrapping — ensure enough height, never cross border
    const labelLines = wrapText(kpi.label, Math.floor((cardWidth - 12) / 3.2));
    const labelStartY = valueLines.length > 1 ? y - 38 : y - 32;
    labelLines.forEach((line, li) => {
      const ly = labelStartY - li * 7;
      if (kpi.highlight) {
        ops.push(textOpWhite('F1', 5.5, x + 8, ly, line));
      } else {
        ops.push(textOpColor('F1', 5.5, x + 8, ly, line, MUTED[0], MUTED[1], MUTED[2]));
      }
    });
  });

  // Compute actual card height needed for multi-line labels
  const maxLabelLines = Math.max(...kpis.map((kpi) => wrapText(kpi.label, Math.floor((cardWidth - 12) / 3.2)).length));
  const actualCardHeight = Math.max(cardHeight, 50 + (maxLabelLines - 1) * 7);
  return { ops: ops.join('\n'), endY: y - actualCardHeight - 6 };
}

function drawBarChart(
  y: number,
  bars: { label: string; value: number }[],
  sarLabel: string,
): { ops: string; endY: number } {
  const ops: string[] = [];
  const chartX = PAGE_MARGIN;
  const chartWidth = 260;
  const chartHeight = 110;
  const labelAreaHeight = 22;
  const plotHeight = chartHeight - labelAreaHeight;
  const barAreaWidth = chartWidth - 45;
  const barWidth = Math.floor(barAreaWidth / bars.length * 0.45);
  const gap = Math.floor((barAreaWidth - barWidth * bars.length) / (bars.length + 1));
  const maxVal = Math.max(...bars.map((b) => b.value), 1);

  // Clean axis baseline
  const axisY = y - labelAreaHeight;
  ops.push(`${HAIRLINE[0]} ${HAIRLINE[1]} ${HAIRLINE[2]} RG 0.4 w ${chartX + 35} ${axisY} m ${chartX + chartWidth} ${axisY} l S`);

  // Light gridlines
  const gridSteps = 4;
  for (let g = 1; g <= gridSteps; g++) {
    const gy = axisY - (g / gridSteps) * plotHeight;
    ops.push(`${HAIRLINE[0]} ${HAIRLINE[1]} ${HAIRLINE[2]} RG 0.2 w ${chartX + 35} ${gy} m ${chartX + chartWidth} ${gy} l S`);
    const gridVal = Math.round((g / gridSteps) * maxVal);
    const gridLabel = sarLabel + ' ' + gridVal.toLocaleString('en-US');
    ops.push(textOpColor('F1', 4.5, chartX, gy - 2, gridLabel, MUTED[0], MUTED[1], MUTED[2]));
  }

  // Solid bars with slight top-lighter accent — not flashy gradient
  const barColors: [number, number, number][] = [BURGUNDY, [0.22, 0.38, 0.58], GOLD];

  bars.forEach((bar, i) => {
    const barH = bar.value > 0 ? Math.max(2, (bar.value / maxVal) * plotHeight) : 2;
    const bx = chartX + 35 + gap + i * (barWidth + gap);
    const by = axisY - barH;
    const color = barColors[i % 3];

    ops.push(`${color[0]} ${color[1]} ${color[2]} rg ${bx} ${by} ${barWidth} ${barH} re f`);
    // Slightly lighter top band for depth
    ops.push(`${color[0] + 0.08} ${color[1] + 0.08} ${color[2] + 0.08} rg ${bx} ${by} ${barWidth} ${Math.min(3, barH)} re f`);

    // Floating value label
    const valText = sarLabel + ' ' + bar.value.toLocaleString('en-US');
    const valLines = wrapText(valText, Math.floor((barWidth + gap) / 3.8));
    ops.push(textOpMulti('F1', 4.5, bx - 2, by + barH + 2, valLines, 6));

    // Label below
    const labelLines = wrapText(bar.label, Math.floor((barWidth + gap) / 3.8));
    ops.push(textOpMulti('F1', 5, bx - 3, axisY - 7, labelLines, 6));
  });

  return { ops: ops.join('\n'), endY: y - chartHeight - 4 };
}

function drawDonutChart(
  y: number,
  executedPct: number,
  labels: { executed: string; remaining: string },
  caption: string,
): { ops: string; endY: number } {
  const ops: string[] = [];
  const cx = 460;
  const cy = y - 48;
  const r = 34;
  const innerR = 22;
  const outerSegments = 100;

  // Remaining ring — gold/tan
  ops.push(`${GOLD_LIGHT[0]} ${GOLD_LIGHT[1]} ${GOLD_LIGHT[2]} rg`);
  ops.push(`${cx} ${cy} m`);
  for (let s = 1; s <= outerSegments; s++) {
    const angle = (s / outerSegments) * 2 * Math.PI;
    ops.push(`${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)} l`);
  }
  ops.push(`h f`);

  // Executed segment — burgundy with rounded end caps (stroke path for round caps)
  if (executedPct > 0) {
    const executedAngle = (executedPct / 100) * 2 * Math.PI;
    const steps = Math.max(2, Math.ceil(executedPct / 100 * 50));
    // Fill the pie wedge
    ops.push(`${BURGUNDY[0]} ${BURGUNDY[1]} ${BURGUNDY[2]} rg`);
    ops.push(`${cx} ${cy} m ${(cx + r).toFixed(2)} ${cy.toFixed(2)} l`);
    for (let s = 1; s <= steps; s++) {
      const angle = (s / steps) * executedAngle;
      ops.push(`${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)} l`);
    }
    ops.push(`h f`);
    // Rounded end cap at the leading edge (stroke a short arc segment with round cap)
    const capR = (r - innerR) / 2;
    const capMidR = (r + innerR) / 2;
    const capAngle = executedAngle;
    const capX1 = cx + innerR * Math.cos(capAngle);
    const capY1 = cy + innerR * Math.sin(capAngle);
    const capX2 = cx + r * Math.cos(capAngle);
    const capY2 = cy + r * Math.sin(capAngle);
    ops.push(`${BURGUNDY[0]} ${BURGUNDY[1]} ${BURGUNDY[2]} RG ${capR.toFixed(2)} w 1 J ${capX1.toFixed(2)} ${capY1.toFixed(2)} m ${capX2.toFixed(2)} ${capY2.toFixed(2)} l S`);
    // Rounded end cap at the start edge (angle 0)
    const capX3 = cx + innerR;
    const capY3 = cy;
    const capX4 = cx + r;
    const capY4 = cy;
    ops.push(`${BURGUNDY[0]} ${BURGUNDY[1]} ${BURGUNDY[2]} RG ${capR.toFixed(2)} w 1 J ${capX3.toFixed(2)} ${capY3.toFixed(2)} m ${capX4.toFixed(2)} ${capY4.toFixed(2)} l S`);
  }

  // Inner circle — clean white
  ops.push(`1 1 1 rg ${cx} ${cy} m`);
  const innerSegments = 50;
  for (let s = 1; s <= innerSegments; s++) {
    const angle = (s / innerSegments) * 2 * Math.PI;
    ops.push(`${(cx + innerR * Math.cos(angle)).toFixed(2)} ${(cy + innerR * Math.sin(angle)).toFixed(2)} l`);
  }
  ops.push(`h f`);

  // Centered percentage
  ops.push(textOpColor('F2', 11, cx - 14, cy - 3, executedPct.toFixed(1) + '%', NAVY[0], NAVY[1], NAVY[2]));

  // Legend with swatches
  const legendY = cy - r - 10;
  ops.push(`${BURGUNDY[0]} ${BURGUNDY[1]} ${BURGUNDY[2]} rg ${cx - 50} ${legendY} 6 6 re f`);
  ops.push(textOpColor('F1', 5.5, cx - 40, legendY + 0.5, `${labels.executed} ${executedPct.toFixed(1)}%`, NAVY[0], NAVY[1], NAVY[2]));
  ops.push(`${GOLD_LIGHT[0]} ${GOLD_LIGHT[1]} ${GOLD_LIGHT[2]} rg ${cx + 5} ${legendY} 6 6 re f`);
  ops.push(textOpColor('F1', 5.5, cx + 15, legendY + 0.5, `${labels.remaining} ${(100 - executedPct).toFixed(1)}%`, NAVY[0], NAVY[1], NAVY[2]));

  // Caption
  const captionLines = wrapText(caption, 30);
  ops.push(textOpMulti('F1', 5.5, cx - 55, cy + r + 6, captionLines, 7));

  return { ops: ops.join('\n'), endY: y - 105 };
}

function drawStageBar(
  y: number,
  deliveredCount: number,
  totalCount: number,
  labels: ReportLabels,
): { ops: string; endY: number } {
  const ops: string[] = [];
  const barX = PAGE_MARGIN;
  const barWidth = CONTENT_WIDTH;
  const barHeight = 20;
  const deliveredPct = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;
  const pendingCount = totalCount - deliveredCount;
  const cornerR = barHeight / 2;

  // Track — warm tan
  ops.push(roundRectFill(barX, y - barHeight, barWidth, barHeight, cornerR, [0.88, 0.84, 0.76]));

  // Delivered — burgundy
  if (deliveredPct > 0) {
    const deliveredW = (barWidth * deliveredPct) / 100;
    ops.push(roundRectFill(barX, y - barHeight, deliveredW, barHeight, cornerR, BURGUNDY));
  }

  ops.push(roundRectStroke(barX, y - barHeight, barWidth, barHeight, cornerR, CARD_BORDER, 0.4));

  // Labels
  ops.push(textOpColor('F1', 6.5, barX, y - barHeight - 6, labels.stageCaptionLeft(deliveredCount, totalCount), BURGUNDY[0], BURGUNDY[1], BURGUNDY[2]));
  const rightCaption = labels.stageCaptionRight(pendingCount);
  const rightW = rightCaption.length * 3.2;
  ops.push(textOpColor('F1', 6.5, barX + barWidth - rightW, y - barHeight - 6, rightCaption, MUTED[0], MUTED[1], MUTED[2]));

  return { ops: ops.join('\n'), endY: y - barHeight - 12 };
}

function drawFooter(pageNum: number, totalPages: number, labels: ReportLabels): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    `${HAIRLINE[0]} ${HAIRLINE[1]} ${HAIRLINE[2]} RG 0.3 w ${PAGE_MARGIN} ${PAGE_BOTTOM - 18} m ${PAGE_WIDTH - PAGE_MARGIN} ${PAGE_BOTTOM - 18} l S`,
    textOpColor('F1', 5.5, PAGE_MARGIN, PAGE_BOTTOM - 26, labels.footerConfidential, MUTED[0], MUTED[1], MUTED[2]),
    textOpColor('F1', 5.5, 270, PAGE_BOTTOM - 26, labels.footerReportDate(today), MUTED[0], MUTED[1], MUTED[2]),
    textOpColor('F1', 5.5, 470, PAGE_BOTTOM - 26, labels.footerPage(pageNum, totalPages), MUTED[0], MUTED[1], MUTED[2]),
  ].join('\n');
}

export function generateExecutiveReport(
  project: Project,
  activities: ProjectActivity[],
  labels: ReportLabels,
): Uint8Array {
  const today = new Date().toISOString().slice(0, 10);
  const isRtl = labels.isRtl;
  const sarLabel = labels.sar;

  const changeOrderTotal = activities.reduce((s, a) => s + (a.changeOrderAmount ?? 0), 0);
  const totalBudget = project.budget + changeOrderTotal;

  const executedToDate = activities.reduce((s, a) => s + (a.actualCost ?? 0), 0);
  const financialProgress = totalBudget > 0 ? (executedToDate / totalBudget) * 100 : 0;
  const remainingValue = totalBudget - executedToDate;

  const consultantName = isRtl
    ? (project.consultant || 'N/A')
    : (project.consultantEn || project.consultant || 'N/A');

  const deliveredCount = activities.filter((a) => a.status === 'completed').length;
  const totalStages = activities.length;

  function activityStatusLabel(status: typeof activities[0]['status']): string {
    switch (status) {
      case 'not_started': return labels.statusNotStarted;
      case 'in_progress': return labels.statusInProgress;
      case 'completed': return labels.statusCompleted;
      case 'delayed': return labels.statusDelayed;
      case 'risk': return labels.statusRisk;
      default: return status;
    }
  }

  const taskRows: string[][] = activities.map((a) => [
    isRtl ? a.name : a.nameEn,
    `${a.percentComplete}%`,
    `${a.actualProgress ?? a.percentComplete}%`,
    fmtSar(a.plannedCost ?? 0, sarLabel),
    fmtSar(a.actualCost ?? 0, sarLabel),
    activityStatusLabel(a.status),
  ]);

  // --- Build pages ---
  const pages: string[] = [];

  // PAGE 1
  const p1: string[] = [];
  p1.push(`${BG_WARM[0]} ${BG_WARM[1]} ${BG_WARM[2]} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);

  // Header — compact, not oversized
  p1.push(textOpColor('F2', 14, PAGE_MARGIN, PAGE_TOP, isRtl ? project.name : project.nameEn, NAVY[0], NAVY[1], NAVY[2]));
  p1.push(textOpColor('F1', 7, PAGE_MARGIN, PAGE_TOP - 13, labels.subtitle(project.contractNumber || 'N/A'), MUTED[0], MUTED[1], MUTED[2]));

  // Right info block — clean, compact
  const infoX = PAGE_WIDTH - PAGE_MARGIN - 170;
  p1.push(textOpColor('F1', 5.5, infoX, PAGE_TOP, labels.contractor.toUpperCase(), MUTED[0], MUTED[1], MUTED[2]));
  p1.push(textOpColor('F2', 7, infoX, PAGE_TOP - 9, isRtl ? project.contractor : project.contractorEn, NAVY[0], NAVY[1], NAVY[2]));
  p1.push(textOpColor('F1', 5.5, infoX, PAGE_TOP - 20, labels.consultant.toUpperCase(), MUTED[0], MUTED[1], MUTED[2]));
  p1.push(textOpColor('F2', 7, infoX, PAGE_TOP - 29, consultantName, NAVY[0], NAVY[1], NAVY[2]));
  p1.push(textOpColor('F1', 5.5, infoX, PAGE_TOP - 40, labels.reportDate.toUpperCase(), MUTED[0], MUTED[1], MUTED[2]));
  p1.push(textOpColor('F2', 7, infoX, PAGE_TOP - 49, today, NAVY[0], NAVY[1], NAVY[2]));

  // Hairline divider
  p1.push(`${HAIRLINE[0]} ${HAIRLINE[1]} ${HAIRLINE[2]} RG 0.3 w ${PAGE_MARGIN} ${PAGE_TOP - 58} ${CONTENT_WIDTH} 0.5 re f`);

  // KPI cards (no section heading per spec)
  const kpis = [
    { label: labels.kpiBudget, value: fmtSar(project.budget, sarLabel) },
    { label: labels.kpiExecutedToDate, value: fmtSar(executedToDate, sarLabel) },
    { label: labels.kpiFinancialProgress, value: financialProgress.toFixed(1) + '%', highlight: true },
    { label: labels.kpiRemainingValue, value: fmtSar(remainingValue, sarLabel) },
    { label: labels.kpiChangeOrderBudget, value: fmtSar(changeOrderTotal, sarLabel) },
  ];
  const kpiResult = drawKpiCards(PAGE_TOP - 72, kpis);
  p1.push(kpiResult.ops);

  // Charts section (no section heading per spec)
  const chartsY = kpiResult.endY - 4;

  // Bar chart (left)
  const barChartY = chartsY - 12;
  p1.push(textOpColor('F1', 6.5, PAGE_MARGIN, barChartY - 4, labels.chartFinancialPosition, MUTED[0], MUTED[1], MUTED[2]));
  const barResult = drawBarChart(barChartY - 12, [
    { label: labels.barBudget, value: project.budget },
    { label: labels.barExecutedToDate, value: executedToDate },
    { label: labels.barRemainingValue, value: remainingValue },
  ], sarLabel);
  p1.push(barResult.ops);

  // Donut (right)
  const donutY = barChartY - 12;
  p1.push(textOpColor('F1', 6.5, 330, donutY - 4, labels.chartExecutedVsRemaining, MUTED[0], MUTED[1], MUTED[2]));
  const donutResult = drawDonutChart(donutY, financialProgress, {
    executed: labels.donutExecuted,
    remaining: labels.donutRemaining,
  }, labels.donutCaption(fmtSar(remainingValue, sarLabel)));
  p1.push(donutResult.ops);

  // Stage Position — exact format: 'PROJECT STAGE POSITION — [N] STAGES TRACKED'
  const stageY = Math.min(barResult.endY, donutResult.endY) - 10;
  p1.push(drawSectionHeader(labels.sectionStagePosition.replace('{n}', String(totalStages)), PAGE_MARGIN, stageY, 8));
  const stageResult = drawStageBar(stageY - 12, deliveredCount, totalStages, labels);
  p1.push(stageResult.ops);

  p1.push(drawFooter(1, 2, labels));
  pages.push(p1.join('\n'));

  // PAGE 2
  const p2: string[] = [];
  p2.push(`${BG_WARM[0]} ${BG_WARM[1]} ${BG_WARM[2]} rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);

  // Compact burgundy header bar
  p2.push(roundRectFill(PAGE_MARGIN, PAGE_TOP - 5, CONTENT_WIDTH, 28, 4, BURGUNDY));
  p2.push(textOpWhite('F2', 11, PAGE_MARGIN + 10, PAGE_TOP + 10, labels.page2Header));
  p2.push(textOpColor('F1', 7, PAGE_MARGIN, PAGE_TOP - 18, labels.page2Subheader, MUTED[0], MUTED[1], MUTED[2]));

  const taskHeaders = [labels.colTaskName, labels.colPlannedProgress, labels.colActualProgress, labels.colPlannedSpent, labels.colActualSpent, labels.colActivityStatus];
  const taskColWidths = [130, 65, 65, 85, 85, 82];
  const taskAligns: Align[] = ['left', 'center', 'center', 'center', 'center', 'center'];
  const taskStatusKeys = activities.map((a) => a.status);
  const taskResult = drawTable(PAGE_TOP - 26, taskHeaders, taskRows, taskColWidths, PAGE_MARGIN, 5, taskAligns, taskStatusKeys, labels.emptyTasks);
  p2.push(taskResult.ops);

  p2.push(drawFooter(2, 2, labels));
  pages.push(p2.join('\n'));

  // Build PDF
  const totalPages = pages.length;
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(' ')}] /Count ${totalPages} >>`);

  pages.forEach((content, i) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${3 + totalPages * 2} 0 R /F2 ${4 + totalPages * 2} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });

  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

export type { ReportLabels };
