import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DigitalTransaction } from '../types/index.ts';
import {
  AccountBalances,
  FUND_SOURCES_CONFIG,
  calculateAllBalancesTotal,
} from '../services/accountBalanceService.ts';

export interface FinancialReportExportParams {
  format: 'pdf' | 'csv';
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  transactions: DigitalTransaction[];
  balances: AccountBalances;
  recipientName: string;
  recipientRoleLabel: string;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
}

type DigitalCategoryKey =
  | 'transfer'
  | 'tarik_tunai'
  | 'ewallet'
  | 'ppob'
  | 'transfer_card'
  | 'tagihan';

interface ReportTxRow {
  id: number;
  refNumber: string;
  dateFormatted: string;
  category: DigitalCategoryKey;
  categoryLabel: string;
  provider: string;
  fundSource: string;
  targetAccount: string;
  customerName: string;
  nominal: number;
  adminStoreFee: number;
  adminBankCost: number;
  totalBayar: number;
  marginFee: number;
  operator: string;
  isInternal: boolean;
}

const DEFAULT_STORE_NAME = 'Agen BRI Pakde Link';
const DEFAULT_STORE_ADDRESS = 'Jl Raya Pasar Gunungsari, Ulubelu';
const DEFAULT_STORE_PHONE = 'WA: 082281185001';

function formatRupiah(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  const absFormatted = new Intl.NumberFormat('id-ID').format(Math.abs(rounded));
  return rounded < 0 ? `-Rp ${absFormatted}` : `Rp ${absFormatted}`;
}

function formatSignedRupiah(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded > 0) return `+${formatRupiah(rounded)}`;
  if (rounded < 0) return `-${formatRupiah(Math.abs(rounded))}`;
  return formatRupiah(0);
}

function toLocalYMD(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatIndoDateShort(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  const dateObj = new Date(y, m - 1, d);
  return dateObj.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatHistoryDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function classifyTransaction(tx: DigitalTransaction): {
  category: DigitalCategoryKey;
  categoryLabel: string;
  isInternal: boolean;
} {
  const rawType = (tx.type || '').toLowerCase();
  const notes = (tx.notes || '').toLowerCase();
  const provider = (tx.provider || '').toLowerCase();
  const targetAcc = (tx.targetAccount || '').toLowerCase();

  const isCardTagihan =
    notes.includes('[tagihan]') ||
    targetAcc === 'card tagihan' ||
    (targetAcc.includes('tagihan') && (rawType.includes('transfer_saldo') || rawType === 'tagihan')) ||
    rawType === 'card_tagihan' ||
    rawType === 'tagihan';

  const isTransferCard =
    !isCardTagihan &&
    (rawType.includes('transfer_saldo') ||
      rawType.includes('pindah_dana') ||
      rawType === 'transfer_card' ||
      rawType.includes('antar_card') ||
      notes.includes('[pindah dana]') ||
      notes.includes('mutasi internal') ||
      provider.includes('➔') ||
      provider.includes('->'));

  if (isCardTagihan) {
    return { category: 'tagihan', categoryLabel: 'Tagihan', isInternal: true };
  }
  if (isTransferCard) {
    return { category: 'transfer_card', categoryLabel: 'Transfer Antar Card', isInternal: true };
  }
  if (rawType.includes('tarik') || rawType.includes('cashout')) {
    return { category: 'tarik_tunai', categoryLabel: 'Tarik Tunai', isInternal: false };
  }
  if (
    rawType.includes('ewallet') ||
    rawType.includes('topup') ||
    rawType.includes('dana') ||
    rawType.includes('gopay') ||
    rawType.includes('ovo') ||
    rawType.includes('shopee') ||
    rawType.includes('wallet')
  ) {
    return { category: 'ewallet', categoryLabel: 'E-Wallet', isInternal: false };
  }
  if (
    rawType.includes('ppob') ||
    rawType.includes('pulsa') ||
    rawType.includes('pln') ||
    rawType.includes('bpjs') ||
    rawType.includes('pdam')
  ) {
    return { category: 'ppob', categoryLabel: 'PPOB dan Lainnya', isInternal: false };
  }
  return { category: 'transfer', categoryLabel: 'Transfer Bank', isInternal: false };
}

function buildReportRows(
  transactions: DigitalTransaction[],
  startDate: string,
  endDate: string
): {
  rows: ReportTxRow[];
  totalNominal: number;
  totalBayar: number;
  totalMarginFee: number;
} {
  const effectiveStart = startDate <= endDate ? startDate : endDate;
  const effectiveEnd = startDate <= endDate ? endDate : startDate;

  // Match Riwayat Transaksi ordering: newest first
  const inRange = [...transactions]
    .filter((tx) => {
      const ymd = toLocalYMD(tx.createdAt);
      if (!ymd) return false;
      return ymd >= effectiveStart && ymd <= effectiveEnd;
    })
    .sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime() || 0;
      const tb = new Date(b.createdAt || 0).getTime() || 0;
      if (tb !== ta) return tb - ta;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

  let totalNominal = 0;
  let totalBayar = 0;
  let totalMarginFee = 0;

  const rows: ReportTxRow[] = inRange.map((tx) => {
    const { category, categoryLabel, isInternal } = classifyTransaction(tx);
    const nominal = Math.max(0, Number(tx.nominal) || 0);
    const adminStoreFee = Math.max(0, Number(tx.adminStoreFee) || 0);
    const adminBankCost = Math.max(0, Number(tx.adminBankCost) || 0);
    const totalPaid = Math.max(0, Number(tx.totalCustomerPaid) || nominal + adminStoreFee);
    const rawMarginFee =
      tx.profit != null && !Number.isNaN(Number(tx.profit))
        ? Number(tx.profit)
        : adminStoreFee - adminBankCost;
    const marginFee =
      isInternal && rawMarginFee === 0 && adminStoreFee === 0 && adminBankCost > 0
        ? -adminBankCost
        : rawMarginFee;

    const rawCust = (tx.customerName || '').trim();
    const hasCust =
      Boolean(rawCust) &&
      rawCust.toLowerCase() !== 'pelanggan agen' &&
      !rawCust.toLowerCase().includes('mutasi internal');

    const resolvedFundSource =
      (tx.fundSource || '').trim() ||
      tx.notes?.match(/\[Sumber(?:\s*Dana)?:\s*([^\]]+)\]/i)?.[1]?.trim() ||
      '';

    const resolvedOperator =
      (tx.operatorName || '').trim() ||
      tx.notes?.match(/\[Operator:\s*([^\]]+)\]/i)?.[1]?.trim() ||
      '-';

    if (!isInternal) {
      totalNominal += nominal;
      totalBayar += totalPaid;
    }
    totalMarginFee += marginFee;

    return {
      id: tx.id,
      refNumber: (tx.referenceNumber || `TRX-${tx.id}`).trim(),
      dateFormatted: formatHistoryDateTime(tx.createdAt),
      category,
      categoryLabel,
      provider: (tx.provider || 'Bank/Provider').replace(/➔/g, '->').trim(),
      fundSource: resolvedFundSource,
      targetAccount: (tx.targetAccount || '-').trim(),
      customerName: hasCust ? rawCust : '',
      nominal,
      adminStoreFee,
      adminBankCost,
      totalBayar: isInternal ? 0 : totalPaid,
      marginFee,
      operator: resolvedOperator,
      isInternal,
    };
  });

  return { rows, totalNominal, totalBayar, totalMarginFee };
}

function getCardAccentRgb(color: string): [number, number, number] {
  switch (color) {
    case 'emerald':
      return [5, 150, 105];
    case 'blue':
      return [37, 99, 235];
    case 'sky':
      return [2, 132, 199];
    case 'indigo':
      return [79, 70, 229];
    case 'purple':
      return [147, 51, 234];
    case 'orange':
      return [234, 88, 12];
    case 'amber':
      return [217, 119, 6];
    default:
      return [30, 58, 138];
  }
}

function getCategoryBadgeColors(category: DigitalCategoryKey): {
  fill: [number, number, number];
  border: [number, number, number];
  text: [number, number, number];
} {
  switch (category) {
    case 'transfer':
      return { fill: [239, 246, 255], border: [191, 219, 254], text: [29, 78, 216] };
    case 'tarik_tunai':
      return { fill: [236, 253, 245], border: [167, 243, 208], text: [4, 120, 87] };
    case 'ewallet':
      return { fill: [250, 245, 255], border: [233, 213, 255], text: [126, 34, 206] };
    case 'ppob':
      return { fill: [255, 251, 235], border: [253, 230, 138], text: [180, 83, 9] };
    case 'transfer_card':
      return { fill: [236, 254, 255], border: [165, 243, 252], text: [21, 94, 117] };
    case 'tagihan':
      return { fill: [255, 241, 242], border: [254, 205, 211], text: [190, 18, 60] };
  }
}

function drawPill(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  height: number,
  fontSize: number,
  fill: [number, number, number],
  border: [number, number, number],
  textColor: [number, number, number],
  maxWidth?: number
): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize);
  let label = text;
  const padX = 1.6;
  let textW = doc.getTextWidth(label);
  if (maxWidth && textW + padX * 2 > maxWidth) {
    while (label.length > 3 && doc.getTextWidth(label + '...') + padX * 2 > maxWidth) {
      label = label.slice(0, -1);
    }
    label = label + '...';
    textW = doc.getTextWidth(label);
  }
  const pillW = textW + padX * 2;
  doc.setFillColor(fill[0], fill[1], fill[2]);
  doc.setDrawColor(border[0], border[1], border[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(x, y, pillW, height, 0.9, 0.9, 'FD');

  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(label, x + padX, y + height - 1.15);
  return pillW;
}

function exportFinancialPdf(params: FinancialReportExportParams) {
  const {
    startDate,
    endDate,
    transactions,
    balances,
    recipientName,
    recipientRoleLabel,
    storeName = DEFAULT_STORE_NAME,
    storeAddress = DEFAULT_STORE_ADDRESS,
    storePhone = DEFAULT_STORE_PHONE,
  } = params;

  const effectiveStart = startDate <= endDate ? startDate : endDate;
  const effectiveEnd = startDate <= endDate ? endDate : startDate;

  const { rows, totalNominal, totalBayar, totalMarginFee } = buildReportRows(
    transactions,
    effectiveStart,
    effectiveEnd
  );

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2; // 186mm

  const printTimestamp =
    new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';

  const periodLabel =
    effectiveStart === effectiveEnd
      ? formatIndoDateShort(effectiveStart)
      : `${formatIndoDateShort(effectiveStart)} s/d ${formatIndoDateShort(effectiveEnd)}`;

  // --- Page 1 Top Body: Formal Metadata Box (y = 32..58) ---
  const metaY = 32;
  const metaH = 26;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, metaY, contentWidth, metaH, 1.5, 1.5, 'FD');

  const splitX = marginX + 112;
  doc.setDrawColor(226, 232, 240);
  doc.line(splitX, metaY + 3, splitX, metaY + metaH - 3);

  const labelX = marginX + 4;
  const colonX = marginX + 34;
  const valX = marginX + 36.5;

  const metaItems: [string, string][] = [
    ['Judul Laporan', 'Laporan Transaksi Finansial & Mutasi Agen'],
    ['Kepada Yth', `${recipientName} (${recipientRoleLabel})`],
    ['Tanggal Laporan', printTimestamp],
    ['Periode Transaksi', periodLabel],
  ];

  metaItems.forEach(([lbl, val], idx) => {
    const rowY = metaY + 6 + idx * 5.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(lbl, labelX, rowY);
    doc.text(':', colonX, rowY);

    doc.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(val, valX, rowY, { maxWidth: splitX - valX - 3 });
  });

  const sumLabelX = splitX + 4;
  const sumValX = marginX + contentWidth - 4;
  const summaryStats: [string, string, [number, number, number]][] = [
    ['Total Transaksi', `${rows.length} Transaksi`, [15, 23, 42]],
    ['Total Nominal Trx', formatRupiah(totalNominal), [30, 41, 59]],
    ['Total Bayar', formatRupiah(totalBayar), [30, 58, 138]],
    ['Total Margin Fee', formatSignedRupiah(totalMarginFee), totalMarginFee < 0 ? [190, 18, 60] : [4, 120, 87]],
  ];

  summaryStats.forEach(([lbl, val, color], idx) => {
    const rowY = metaY + 6 + idx * 5.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    doc.text(lbl, sumLabelX, rowY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(val, sumValX, rowY, { align: 'right' });
  });

  // --- Page 1 Account Recap Cards ---
  const cardsSectionY = metaY + metaH + 5; // 63
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);
  doc.text('REKAPITULASI SALDO AKUN AGEN (POSISI TERKINI)', marginX, cardsSectionY);

  const cardsStartY = cardsSectionY + 2.5;
  const cols = 4;
  const gapX = 2.5;
  const gapY = 2.5;
  const cardW = (contentWidth - gapX * (cols - 1)) / cols;
  const cardH = 14.5;

  const accountCards = [
    ...FUND_SOURCES_CONFIG.map((cfg) => ({
      label: cfg.label,
      sub: cfg.provider,
      amount: Number(balances[cfg.key] || 0),
      accent: getCardAccentRgb(cfg.color),
      isTotal: false,
    })),
    {
      label: 'Total Saldo',
      sub: 'Gabungan Seluruh Akun',
      amount: calculateAllBalancesTotal(balances),
      accent: [30, 58, 138] as [number, number, number],
      isTotal: true,
    },
  ];

  accountCards.forEach((card, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const cx = marginX + col * (cardW + gapX);
    const cy = cardsStartY + row * (cardH + gapY);

    if (card.isTotal) {
      doc.setFillColor(238, 242, 255);
      doc.setDrawColor(129, 140, 248);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
    }
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(cx, cy, cardW, 1.3, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(card.isTotal ? 30 : 51, card.isTotal ? 58 : 65, card.isTotal ? 138 : 85);
    doc.text(card.label, cx + 2.5, cy + 5.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(100, 116, 139);
    doc.text(card.sub, cx + 2.5, cy + 8.3, { maxWidth: cardW - 5 });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.setTextColor(card.isTotal ? 30 : 15, card.isTotal ? 58 : 23, card.isTotal ? 138 : 42);
    doc.text(formatRupiah(card.amount), cx + 2.5, cy + 12.6, { maxWidth: cardW - 5 });
  });

  // --- Main Transactions Table (Exact 7 Columns Matching Riwayat Transaksi, No AKSI) ---
  const tableTitleY = cardsStartY + 2 * cardH + gapY + 5; // ~102
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(30, 41, 59);
  doc.text('RINCIAN MUTASI & RIWAYAT TRANSAKSI', marginX, tableTitleY);

  const tableBody: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][] = [];

  if (rows.length > 0) {
    rows.forEach((r) => {
      tableBody.push([
        `${r.refNumber}\n${r.dateFormatted}`,
        `${r.categoryLabel}\n${r.provider}${r.fundSource ? ` ${r.fundSource}` : ''}`,
        r.customerName ? `${r.targetAccount}\n${r.customerName}` : r.targetAccount,
        r.adminStoreFee > 0
          ? `${formatRupiah(r.nominal)}\nAdmin: ${formatRupiah(r.adminStoreFee)}`
          : formatRupiah(r.nominal),
        r.isInternal ? '-' : formatRupiah(r.totalBayar),
        r.isInternal && r.marginFee === 0
          ? '-'
          : !r.isInternal && r.adminBankCost > 0
          ? `${formatSignedRupiah(r.marginFee)}\nModal: ${formatRupiah(r.adminBankCost)}`
          : formatSignedRupiah(r.marginFee),
        r.operator || '-',
      ]);
    });

    tableBody.push([
      {
        content: `TOTAL KESELURUHAN (${rows.length} TRANSAKSI)`,
        colSpan: 3,
        styles: {
          fontStyle: 'bold',
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          minCellHeight: 8,
        },
      },
      {
        content: formatRupiah(totalNominal),
        styles: {
          fontStyle: 'bold',
          halign: 'right',
          fillColor: [241, 245, 249],
          textColor: [30, 41, 59],
          minCellHeight: 8,
        },
      },
      {
        content: formatRupiah(totalBayar),
        styles: {
          fontStyle: 'bold',
          halign: 'right',
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          minCellHeight: 8,
        },
      },
      {
        content: formatSignedRupiah(totalMarginFee),
        styles: {
          fontStyle: 'bold',
          halign: 'right',
          fillColor: totalMarginFee < 0 ? [255, 241, 242] : [236, 253, 245],
          textColor: totalMarginFee < 0 ? [190, 18, 60] : [4, 120, 87],
          minCellHeight: 8,
        },
      },
      {
        content: '',
        styles: {
          fillColor: [241, 245, 249],
          minCellHeight: 8,
        },
      },
    ]);
  } else {
    tableBody.push([
      {
        content: `Tidak ada data riwayat transaksi pada periode ${periodLabel}.`,
        colSpan: 7,
        styles: {
          halign: 'center',
          textColor: [100, 116, 139],
          fontStyle: 'italic',
          cellPadding: 6,
        },
      },
    ]);
  }

  autoTable(doc, {
    startY: tableTitleY + 2.5,
    margin: { top: 32, right: marginX, bottom: 16, left: marginX },
    head: [
      [
        'NO. REFF & WAKTU',
        'LAYANAN & SUMBER DANA',
        'NO. TUJUAN & PELANGGAN',
        'NOMINAL TRX',
        'TOTAL BAYAR',
        'MARGIN FEE',
        'OPERATOR',
      ],
    ],
    body: tableBody,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.0,
      cellPadding: { top: 2.0, right: 2.0, bottom: 2.0, left: 2.0 },
      lineColor: [226, 232, 240],
      lineWidth: 0.25,
      textColor: [30, 41, 59],
      valign: 'middle',
      overflow: 'linebreak',
      minCellHeight: 11.2,
    },
    headStyles: {
      fillColor: [248, 250, 252],
      textColor: [71, 85, 105],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'left',
      lineColor: [203, 213, 225],
      lineWidth: 0.3,
      cellPadding: { top: 2.4, right: 2.0, bottom: 2.4, left: 2.0 },
      minCellHeight: 8,
    },
    alternateRowStyles: {
      fillColor: [252, 253, 255],
    },
    columnStyles: {
      0: { cellWidth: 29, halign: 'left' },
      1: { cellWidth: 39, halign: 'left' },
      2: { cellWidth: 30, halign: 'left' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 19, halign: 'left' },
    },
    didParseCell: (hookData) => {
      if (hookData.section === 'head' && [3, 4, 5].includes(hookData.column.index)) {
        hookData.cell.styles.halign = 'right';
      }
    },
    willDrawCell: (hookData) => {
      if (
        hookData.section === 'body' &&
        hookData.row.index < rows.length &&
        [0, 1, 2, 3, 5, 6].includes(hookData.column.index)
      ) {
        hookData.cell.text = [];
      }
    },
    didDrawCell: (hookData) => {
      if (hookData.section !== 'body' || hookData.row.index >= rows.length) return;
      const r = rows[hookData.row.index];
      if (!r) return;

      const { cell, column } = hookData;
      const padL = 2.0;
      const padR = 2.0;
      const leftX = cell.x + padL;
      const rightX = cell.x + cell.width - padR;
      const maxW = cell.width - padL - padR;

      if (column.index === 0) {
        // NO. REFF & WAKTU
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.1);
        doc.setTextColor(15, 23, 42);
        doc.text(r.refNumber, leftX, cell.y + 4.4, { maxWidth: maxW });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.1);
        doc.setTextColor(100, 116, 139);
        doc.text(r.dateFormatted, leftX, cell.y + 8.6, { maxWidth: maxW });
      } else if (column.index === 1) {
        // LAYANAN & SUMBER DANA (Badges: Kategori, Provider, Sumber Dana)
        const catColors = getCategoryBadgeColors(r.category);
        drawPill(
          doc,
          r.categoryLabel,
          leftX,
          cell.y + 1.6,
          3.7,
          5.9,
          catColors.fill,
          catColors.border,
          catColors.text,
          maxW
        );

        const provW = drawPill(
          doc,
          r.provider,
          leftX,
          cell.y + 6.0,
          3.6,
          5.7,
          [241, 245, 249],
          [203, 213, 225],
          [71, 85, 105],
          r.fundSource ? maxW * 0.56 : maxW
        );

        if (r.fundSource) {
          const remainingW = maxW - provW - 1.2;
          if (remainingW >= 10) {
            drawPill(
              doc,
              r.fundSource,
              leftX + provW + 1.2,
              cell.y + 6.0,
              3.6,
              5.7,
              [238, 242, 255],
              [199, 210, 254],
              [67, 56, 202],
              remainingW
            );
          }
        }
      } else if (column.index === 2) {
        // NO. TUJUAN & PELANGGAN
        const yPrimary = r.customerName ? cell.y + 4.4 : cell.y + cell.height / 2 + 1.0;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.1);
        doc.setTextColor(15, 23, 42);
        doc.text(r.targetAccount, leftX, yPrimary, { maxWidth: maxW });

        if (r.customerName) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.2);
          doc.setTextColor(100, 116, 139);
          doc.text(r.customerName, leftX, cell.y + 8.6, { maxWidth: maxW });
        }
      } else if (column.index === 3) {
        // NOMINAL TRX
        const yPrimary = r.adminStoreFee > 0 ? cell.y + 4.4 : cell.y + cell.height / 2 + 1.0;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.1);
        doc.setTextColor(30, 41, 59);
        doc.text(formatRupiah(r.nominal), rightX, yPrimary, { align: 'right' });

        if (r.adminStoreFee > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.0);
          doc.setTextColor(100, 116, 139);
          doc.text(`Admin: ${formatRupiah(r.adminStoreFee)}`, rightX, cell.y + 8.6, { align: 'right' });
        }
      } else if (column.index === 5) {
        // MARGIN FEE (Emerald / Rose Badge + Modal Bank subtext if any)
        if (r.isInternal && r.marginFee === 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.0);
          doc.setTextColor(148, 163, 184);
          doc.text('-', rightX, cell.y + cell.height / 2 + 1.0, { align: 'right' });
        } else {
          const feeText = formatSignedRupiah(r.marginFee);
          const isNegative = r.marginFee < 0;
          const isZero = r.marginFee === 0;
          const pillFill: [number, number, number] = isNegative
            ? [255, 241, 242]
            : isZero
            ? [241, 245, 249]
            : [236, 253, 245];
          const pillBorder: [number, number, number] = isNegative
            ? [254, 205, 211]
            : isZero
            ? [203, 213, 225]
            : [167, 243, 208];
          const pillText: [number, number, number] = isNegative
            ? [190, 18, 60]
            : isZero
            ? [71, 85, 105]
            : [4, 120, 87];

          const showModalSubtext = !r.isInternal && r.adminBankCost > 0;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.6);
          const pillW = Math.min(maxW, doc.getTextWidth(feeText) + 3.2);
          const pillY = showModalSubtext ? cell.y + 1.8 : cell.y + (cell.height - 4.3) / 2;
          drawPill(
            doc,
            feeText,
            rightX - pillW,
            pillY,
            4.3,
            6.6,
            pillFill,
            pillBorder,
            pillText,
            maxW
          );

          if (showModalSubtext) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(5.8);
            doc.setTextColor(225, 29, 72);
            doc.text(`Modal: ${formatRupiah(r.adminBankCost)}`, rightX, cell.y + 9.4, {
              align: 'right',
            });
          }
        }
      } else if (column.index === 6) {
        // OPERATOR
        const opName = r.operator && r.operator !== '-' ? r.operator : '-';
        if (opName === '-') {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.0);
          doc.setTextColor(148, 163, 184);
          doc.text('-', leftX, cell.y + cell.height / 2 + 1.0);
        } else {
          drawPill(
            doc,
            opName,
            leftX,
            cell.y + (cell.height - 4.2) / 2,
            4.2,
            6.3,
            [241, 245, 249],
            [226, 232, 240],
            [51, 65, 85],
            maxW
          );
        }
      }
    },
  });

  // --- Stamp Official Header & Footer on ALL Pages ---
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);

    // Header Left: Store Name & Address/Contact Details
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 23, 42);
    doc.text(storeName, marginX, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(storeAddress, marginX, 18);
    doc.text(storePhone, marginX, 22);

    // Header Right: Document Title & Page Number
    const rightEdge = pageWidth - marginX;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 138);
    doc.text('LAPORAN TRANSAKSI FINANSIAL', rightEdge, 13.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(51, 65, 85);
    doc.text(`Halaman ${pageNum} dari ${totalPages}`, rightEdge, 18.5, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text('Dokumen Resmi Laporan Keuangan Agen', rightEdge, 22.3, { align: 'right' });

    // Double bank-style divider line
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.6);
    doc.line(marginX, 25.8, rightEdge, 25.8);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(marginX, 26.8, rightEdge, 26.8);

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.25);
    doc.line(marginX, pageHeight - 12, rightEdge, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(`Dicetak pada ${printTimestamp} • ${storeName}`, marginX, pageHeight - 8);
    doc.text(`Halaman ${pageNum} dari ${totalPages}`, rightEdge, pageHeight - 8, { align: 'right' });
  }

  const safePeriod =
    effectiveStart === effectiveEnd ? effectiveStart : `${effectiveStart}_sd_${effectiveEnd}`;
  doc.save(`Laporan_Transaksi_Finansial_${safePeriod}.pdf`);
}

function escapeCsvCell(val: string | number): string {
  const s = String(val ?? '').replace(/"/g, '""');
  return `"${s}"`;
}

function exportFinancialCsv(params: FinancialReportExportParams) {
  const {
    startDate,
    endDate,
    transactions,
    balances,
    recipientName,
    recipientRoleLabel,
    storeName = DEFAULT_STORE_NAME,
    storeAddress = DEFAULT_STORE_ADDRESS,
    storePhone = DEFAULT_STORE_PHONE,
  } = params;

  const effectiveStart = startDate <= endDate ? startDate : endDate;
  const effectiveEnd = startDate <= endDate ? endDate : startDate;

  const { rows, totalNominal, totalBayar, totalMarginFee } = buildReportRows(
    transactions,
    effectiveStart,
    effectiveEnd
  );

  const periodLabel =
    effectiveStart === effectiveEnd
      ? formatIndoDateShort(effectiveStart)
      : `${formatIndoDateShort(effectiveStart)} s/d ${formatIndoDateShort(effectiveEnd)}`;

  const printTimestamp = new Date().toLocaleString('id-ID') + ' WIB';

  const lines: string[] = [];
  lines.push([escapeCsvCell(storeName), escapeCsvCell('LAPORAN TRANSAKSI FINANSIAL')].join(','));
  lines.push([escapeCsvCell(storeAddress), escapeCsvCell('Halaman 1 dari 1')].join(','));
  lines.push([escapeCsvCell(storePhone), ''].join(','));
  lines.push('');
  lines.push([escapeCsvCell('Judul Laporan'), escapeCsvCell('Laporan Transaksi Finansial & Mutasi Agen')].join(','));
  lines.push([escapeCsvCell('Kepada Yth'), escapeCsvCell(`${recipientName} (${recipientRoleLabel})`)].join(','));
  lines.push([escapeCsvCell('Tanggal Laporan'), escapeCsvCell(printTimestamp)].join(','));
  lines.push([escapeCsvCell('Periode Transaksi'), escapeCsvCell(periodLabel)].join(','));
  lines.push([escapeCsvCell('Total Margin Fee'), totalMarginFee].join(','));
  lines.push('');
  lines.push([escapeCsvCell('REKAPITULASI SALDO AKUN (POSISI TERKINI)')].join(','));
  lines.push([escapeCsvCell('Akun'), escapeCsvCell('Keterangan'), escapeCsvCell('Saldo (Rp)')].join(','));
  FUND_SOURCES_CONFIG.forEach((cfg) => {
    lines.push([escapeCsvCell(cfg.label), escapeCsvCell(cfg.provider), Number(balances[cfg.key] || 0)].join(','));
  });
  lines.push([escapeCsvCell('Total Saldo'), escapeCsvCell('Gabungan Seluruh Akun'), calculateAllBalancesTotal(balances)].join(','));
  lines.push('');
  lines.push([escapeCsvCell('RINCIAN MUTASI & RIWAYAT TRANSAKSI')].join(','));
  lines.push(
    [
      'NO. REFF & WAKTU',
      'LAYANAN & SUMBER DANA',
      'NO. TUJUAN & PELANGGAN',
      'NOMINAL TRX',
      'TOTAL BAYAR',
      'MARGIN FEE',
      'OPERATOR',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  if (rows.length > 0) {
    rows.forEach((r) => {
      const refCol = `${r.refNumber} (${r.dateFormatted})`;
      const serviceCol = `${r.categoryLabel} | ${r.provider}${r.fundSource ? ` | ${r.fundSource}` : ''}`;
      const targetCol = r.customerName ? `${r.targetAccount} (${r.customerName})` : r.targetAccount;
      const nominalCol =
        r.adminStoreFee > 0
          ? `${formatRupiah(r.nominal)} (Admin: ${formatRupiah(r.adminStoreFee)})`
          : formatRupiah(r.nominal);
      const totalBayarCol = r.isInternal ? '-' : formatRupiah(r.totalBayar);
      const marginCol =
        r.isInternal && r.marginFee === 0
          ? '-'
          : !r.isInternal && r.adminBankCost > 0
          ? `${formatSignedRupiah(r.marginFee)} (Modal: ${formatRupiah(r.adminBankCost)})`
          : formatSignedRupiah(r.marginFee);

      lines.push(
        [
          escapeCsvCell(refCol),
          escapeCsvCell(serviceCol),
          escapeCsvCell(targetCol),
          escapeCsvCell(nominalCol),
          escapeCsvCell(totalBayarCol),
          escapeCsvCell(marginCol),
          escapeCsvCell(r.operator || '-'),
        ].join(',')
      );
    });
    lines.push(
      [
        escapeCsvCell(`TOTAL KESELURUHAN (${rows.length} TRANSAKSI)`),
        escapeCsvCell('-'),
        escapeCsvCell('-'),
        escapeCsvCell(formatRupiah(totalNominal)),
        escapeCsvCell(formatRupiah(totalBayar)),
        escapeCsvCell(formatSignedRupiah(totalMarginFee)),
        escapeCsvCell('-'),
      ].join(',')
    );
  }

  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safePeriod =
    effectiveStart === effectiveEnd ? effectiveStart : `${effectiveStart}_sd_${effectiveEnd}`;
  link.setAttribute('href', url);
  link.setAttribute('download', `Laporan_Transaksi_Finansial_${safePeriod}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportFinancialReport(params: FinancialReportExportParams): void {
  if (params.format === 'pdf') {
    exportFinancialPdf(params);
  } else {
    exportFinancialCsv(params);
  }
}
