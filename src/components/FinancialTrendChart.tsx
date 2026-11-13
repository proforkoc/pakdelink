import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { DigitalTransaction, StoreExpense, Sale, ServiceSoftwareOrder } from '../types/index.ts';
import { getStoredSales, getStoredServiceOrders } from '../utils/transactionSync.ts';

export type GranularityType = 'daily' | 'weekly' | 'monthly';

interface FinancialTrendChartProps {
  allDigitalTransactions: DigitalTransaction[];
  allExpensesList?: StoreExpense[];
  periodType: 'all' | 'daily' | 'monthly' | 'yearly';
  selectedMonth: number;
  selectedYear: number;
  selectedDate: string;
  formatRupiah: (val: number) => string;
}

interface DataPoint {
  id: string;
  label: string;
  shortLabel: string;
  fullDateLabel: string;
  fee: number;
  trxCount: number;
}

// Deteksi mutasi internal (TF Card & Card Tagihan) agar tidak ikut terhitung di jumlah transaksi pelanggan
function isInternalTransferTx(tx: DigitalTransaction): boolean {
  const typeStr = (tx.type || '').toLowerCase();
  const notesStr = (tx.notes || '').toLowerCase();
  const providerStr = (tx.provider || '').toLowerCase();
  const customerStr = (tx.customerName || '').toLowerCase();
  const targetStr = (tx.targetAccount || '').toLowerCase();
  const fundStr = (tx.fundSource || '').toLowerCase();

  return (
    typeStr.includes('transfer_saldo') ||
    typeStr.includes('pindah_dana') ||
    typeStr.includes('mutasi') ||
    typeStr === 'transfer_card' ||
    typeStr === 'tf_card' ||
    notesStr.includes('transfer saldo') ||
    notesStr.includes('pindah dana') ||
    notesStr.includes('ambil saldo') ||
    notesStr.includes('tf card') ||
    notesStr.includes('antar card') ||
    providerStr.includes('➔') ||
    providerStr.includes('->') ||
    customerStr.includes('mutasi internal') ||
    customerStr.includes('transfer antar card') ||
    targetStr.includes('card tagihan') ||
    fundStr.includes('tagihan')
  );
}

// Generate smooth Bezier curve path string for SVG
function getBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 5;
    const cp1y = p1.y + (p2.y - p0.y) / 5;
    const cp2x = p2.x - (p3.x - p1.x) / 5;
    const cp2y = p2.y - (p3.y - p1.y) / 5;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

// Generate closed area path for SVG gradients
function getAreaPath(points: { x: number; y: number }[], baselineY: number): string {
  if (points.length < 2) return '';
  const lineD = getBezierPath(points);
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  return `${lineD} L ${lastPoint.x.toFixed(1)} ${baselineY.toFixed(1)} L ${firstPoint.x.toFixed(1)} ${baselineY.toFixed(1)} Z`;
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export const FinancialTrendChart: React.FC<FinancialTrendChartProps> = ({
  allDigitalTransactions,
  periodType,
  selectedMonth,
  selectedYear,
  selectedDate,
  formatRupiah,
}) => {
  // Granularity state initialized sensibly based on active period
  const [granularity, setGranularity] = useState<GranularityType>(() => {
    if (periodType === 'yearly' || periodType === 'all') return 'monthly';
    return 'daily';
  });

  // Keep granularity in sync when periodType changes
  useEffect(() => {
    if (periodType === 'yearly' || periodType === 'all') {
      setGranularity('monthly');
    } else {
      setGranularity('daily');
    }
  }, [periodType]);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Load legacy POS Sales & Service Orders if present
  const storedSales = useMemo(() => getStoredSales(), [allDigitalTransactions]);
  const storedServices = useMemo(() => getStoredServiceOrders(), [allDigitalTransactions]);

  // Construct Time Series Buckets (Fee only)
  const seriesData: DataPoint[] = useMemo(() => {
    const buckets: DataPoint[] = [];

    const parseYMD = (dateStr?: string) => {
      if (!dateStr) return null;
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return null;
        return {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          isoDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        };
      } catch {
        return null;
      }
    };

    const addDigitalTx = (b: DataPoint, tx: DigitalTransaction) => {
      const isInternal = isInternalTransferTx(tx);
      const adminFee = Number(tx.adminStoreFee) || 0;
      const bankCost = Number(tx.adminBankCost) || 0;
      const rawFee =
        tx.profit != null && !Number.isNaN(Number(tx.profit))
          ? Number(tx.profit)
          : adminFee - bankCost;
      const fee =
        isInternal && rawFee === 0 && adminFee === 0 && bankCost > 0
          ? -bankCost
          : rawFee;
      b.fee += fee;
      if (!isInternal) {
        b.trxCount += 1;
      }
    };

    const addSale = (b: DataPoint, s: Sale) => {
      b.fee += Number(s.totalProfit || 0);
      b.trxCount += 1;
    };

    const addService = (b: DataPoint, s: ServiceSoftwareOrder) => {
      const rev = Number(s.finalCost || s.estimatedCost || 0);
      const cost = Number(s.toolCost || 0);
      b.fee += Math.max(0, rev - cost);
      b.trxCount += 1;
    };

    if (granularity === 'monthly') {
      for (let m = 1; m <= 12; m++) {
        buckets.push({
          id: `month-${m}`,
          label: MONTH_NAMES_ID[m - 1],
          shortLabel: MONTH_SHORT_ID[m - 1],
          fullDateLabel: `${MONTH_NAMES_ID[m - 1]} ${selectedYear}`,
          fee: 0,
          trxCount: 0,
        });
      }

      for (const tx of allDigitalTransactions) {
        const p = parseYMD(tx.createdAt);
        if (!p || p.year !== selectedYear) continue;
        const b = buckets[p.month - 1];
        if (b) addDigitalTx(b, tx);
      }

      for (const s of storedSales) {
        const p = parseYMD(s.createdAt);
        if (!p || p.year !== selectedYear) continue;
        const b = buckets[p.month - 1];
        if (b) addSale(b, s);
      }

      for (const s of storedServices) {
        const p = parseYMD(s.completedAt || s.receivedAt);
        if (!p || p.year !== selectedYear) continue;
        const b = buckets[p.month - 1];
        if (b) addService(b, s);
      }
    } else if (granularity === 'weekly') {
      const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
      const weekCount = Math.ceil(daysInMonth / 7);

      for (let w = 1; w <= weekCount; w++) {
        const startDay = (w - 1) * 7 + 1;
        const endDay = Math.min(w * 7, daysInMonth);
        buckets.push({
          id: `week-${w}`,
          label: `Minggu ${w}`,
          shortLabel: `M${w}`,
          fullDateLabel: `Minggu ke-${w} (${startDay}-${endDay} ${MONTH_SHORT_ID[selectedMonth - 1]} ${selectedYear})`,
          fee: 0,
          trxCount: 0,
        });
      }

      const getWeekIdx = (day: number) => Math.min(Math.floor((day - 1) / 7), weekCount - 1);

      for (const tx of allDigitalTransactions) {
        const p = parseYMD(tx.createdAt);
        if (!p || p.year !== selectedYear || p.month !== selectedMonth) continue;
        const b = buckets[getWeekIdx(p.day)];
        if (b) addDigitalTx(b, tx);
      }

      for (const s of storedSales) {
        const p = parseYMD(s.createdAt);
        if (!p || p.year !== selectedYear || p.month !== selectedMonth) continue;
        const b = buckets[getWeekIdx(p.day)];
        if (b) addSale(b, s);
      }

      for (const s of storedServices) {
        const p = parseYMD(s.completedAt || s.receivedAt);
        if (!p || p.year !== selectedYear || p.month !== selectedMonth) continue;
        const b = buckets[getWeekIdx(p.day)];
        if (b) addService(b, s);
      }
    } else {
      if (periodType === 'daily') {
        const base = new Date(selectedDate);
        if (isNaN(base.getTime())) {
          base.setTime(Date.now());
        }

        for (let i = 6; i >= 0; i--) {
          const target = new Date(base);
          target.setDate(target.getDate() - i);
          const y = target.getFullYear();
          const m = target.getMonth() + 1;
          const d = target.getDate();
          const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isToday = i === 0;

          buckets.push({
            id: iso,
            label: isToday ? 'Hari Ini' : `${d} ${MONTH_SHORT_ID[m - 1]}`,
            shortLabel: `${d}/${m}`,
            fullDateLabel: target.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
            fee: 0,
            trxCount: 0,
          });
        }

        const bucketMap = new Map(buckets.map((b) => [b.id, b]));

        for (const tx of allDigitalTransactions) {
          const p = parseYMD(tx.createdAt);
          if (!p) continue;
          const b = bucketMap.get(p.isoDate);
          if (b) addDigitalTx(b, tx);
        }

        for (const s of storedSales) {
          const p = parseYMD(s.createdAt);
          if (!p) continue;
          const b = bucketMap.get(p.isoDate);
          if (b) addSale(b, s);
        }

        for (const s of storedServices) {
          const p = parseYMD(s.completedAt || s.receivedAt);
          if (!p) continue;
          const b = bucketMap.get(p.isoDate);
          if (b) addService(b, s);
        }
      } else {
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        for (let d = 1; d <= daysInMonth; d++) {
          const iso = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          buckets.push({
            id: iso,
            label: `Tgl ${d}`,
            shortLabel: `${d}`,
            fullDateLabel: `${d} ${MONTH_NAMES_ID[selectedMonth - 1]} ${selectedYear}`,
            fee: 0,
            trxCount: 0,
          });
        }

        for (const tx of allDigitalTransactions) {
          const p = parseYMD(tx.createdAt);
          if (!p || p.year !== selectedYear || p.month !== selectedMonth) continue;
          const b = buckets[p.day - 1];
          if (b) addDigitalTx(b, tx);
        }

        for (const s of storedSales) {
          const p = parseYMD(s.createdAt);
          if (!p || p.year !== selectedYear || p.month !== selectedMonth) continue;
          const b = buckets[p.day - 1];
          if (b) addSale(b, s);
        }

        for (const s of storedServices) {
          const p = parseYMD(s.completedAt || s.receivedAt);
          if (!p || p.year !== selectedYear || p.month !== selectedMonth) continue;
          const b = buckets[p.day - 1];
          if (b) addService(b, s);
        }
      }
    }

    return buckets;
  }, [
    allDigitalTransactions,
    storedSales,
    storedServices,
    granularity,
    periodType,
    selectedMonth,
    selectedYear,
    selectedDate,
  ]);

  // Aggregate Fee stats across the displayed series
  const stats = useMemo(() => {
    let totalFee = 0;
    let totalTrx = 0;
    let peakFee = 0;
    let peakDay = '';

    for (const d of seriesData) {
      totalFee += d.fee;
      totalTrx += d.trxCount;
      if (d.fee > peakFee) {
        peakFee = d.fee;
        peakDay = d.label;
      }
    }

    const avgFee = seriesData.length > 0 ? Math.round(totalFee / seriesData.length) : 0;
    const avgFeePerTrx = totalTrx > 0 ? Math.round(totalFee / totalTrx) : 0;

    return {
      totalFee,
      totalTrx,
      peakFee,
      peakDay: peakDay || '-',
      avgFee,
      avgFeePerTrx,
    };
  }, [seriesData]);

  // SVG Chart Dimensions & Coordinates
  const width = 900;
  const height = 260;
  const padding = { top: 25, right: 30, bottom: 40, left: 65 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Scale Y-axis purely to Fee
  const maxVal = useMemo(() => {
    let high = 0;
    for (const d of seriesData) {
      if (d.fee > high) high = d.fee;
    }
    if (high <= 0) return 100000;
    const headroom = high * 1.15;
    const magnitude = Math.pow(10, Math.floor(Math.log10(headroom)));
    return Math.ceil(headroom / magnitude) * magnitude;
  }, [seriesData]);

  // Map data to SVG points
  const points = useMemo(() => {
    if (seriesData.length === 0) return [];
    const count = seriesData.length;
    const stepX = count > 1 ? innerWidth / (count - 1) : innerWidth / 2;

    return seriesData.map((d, i) => {
      const x = padding.left + i * stepX;
      const rawFeeY = padding.top + innerHeight - (Math.max(0, d.fee) / maxVal) * innerHeight;
      return {
        x,
        feeY: Math.max(padding.top, Math.min(padding.top + innerHeight, rawFeeY)),
        data: d,
      };
    });
  }, [seriesData, maxVal, innerWidth, innerHeight, padding]);

  const baselineY = padding.top + innerHeight;

  const feePath = useMemo(() => getBezierPath(points.map((p) => ({ x: p.x, y: p.feeY }))), [points]);
  const feeArea = useMemo(() => getAreaPath(points.map((p) => ({ x: p.x, y: p.feeY })), baselineY), [points, baselineY]);

  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  const updateHoveredFromClientX = (clientX: number) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const normalizedX = (mouseX / rect.width) * width;

    let closestIdx = 0;
    let minDist = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - normalizedX);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    setHoveredIndex(closestIdx);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    updateHoveredFromClientX(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      updateHoveredFromClientX(e.touches[0].clientX);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  const activeHoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  const formatSignedFee = (val: number) => {
    const n = Math.round(Number(val) || 0);
    if (n > 0) return `+${formatRupiah(n)}`;
    if (n < 0) return `-${formatRupiah(Math.abs(n))}`;
    return formatRupiah(0);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
      {/* Header Card: Title & Granularity Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Grafik Tren Fee Admin Toko
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualisasi pergerakan pendapatan fee admin toko secara periodik
          </p>
        </div>

        {/* Granularity Switcher */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 text-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => setGranularity('daily')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              granularity === 'daily'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Harian
          </button>
          <button
            type="button"
            onClick={() => setGranularity('weekly')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              granularity === 'weekly'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mingguan
          </button>
          <button
            type="button"
            onClick={() => setGranularity('monthly')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              granularity === 'monthly'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bulanan
          </button>
        </div>
      </div>

      {/* Summary Micro-Cards Bar (Fee Focused) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className={`p-3 rounded-xl border space-y-0.5 ${
            stats.totalFee < 0
              ? 'bg-rose-50/70 border-rose-200/80'
              : 'bg-emerald-50/70 border-emerald-200/80'
          }`}
        >
          <div
            className={`text-[11px] font-semibold flex items-center gap-1.5 ${
              stats.totalFee < 0 ? 'text-rose-800' : 'text-emerald-800'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                stats.totalFee < 0 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
            />
            <span>Total Fee Admin</span>
          </div>
          <div
            className={`text-sm sm:text-base font-extrabold font-mono ${
              stats.totalFee < 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}
          >
            {formatSignedFee(stats.totalFee)}
          </div>
          <div
            className={`text-[10px] ${
              stats.totalFee < 0 ? 'text-rose-700/70' : 'text-emerald-700/70'
            }`}
          >
            Akumulasi pada rentang grafik
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-0.5">
          <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <span>Rata-rata Fee</span>
          </div>
          <div
            className={`text-sm sm:text-base font-extrabold font-mono ${
              stats.avgFee < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatSignedFee(stats.avgFee)}
          </div>
          <div className="text-[10px] text-slate-400">
            Per {granularity === 'daily' ? 'hari' : granularity === 'weekly' ? 'minggu' : 'bulan'}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200/80 space-y-0.5">
          <div className="text-[11px] font-semibold text-teal-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Fee Tertinggi</span>
          </div>
          <div className="text-sm sm:text-base font-extrabold text-teal-700 font-mono">
            {formatSignedFee(stats.peakFee)}
          </div>
          <div className="text-[10px] text-teal-800/70">
            Puncak: {stats.peakDay}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 space-y-0.5">
          <div className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span>Total Transaksi</span>
          </div>
          <div className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">
            {stats.totalTrx} Trx
          </div>
          <div className="text-[10px] text-slate-400">
            Rata-rata {formatSignedFee(stats.avgFeePerTrx)}/trx
          </div>
        </div>
      </div>

      {/* Interactive SVG Chart Container */}
      <div className="relative w-full overflow-hidden bg-slate-50/50 rounded-xl border border-slate-100 p-2 sm:p-4 select-none">
        {/* Tooltip Float Overlay */}
        {activeHoveredPoint && (
          <div
            className="absolute top-4 pointer-events-none z-20 bg-slate-900/95 text-white p-3 rounded-xl shadow-xl backdrop-blur-md border border-slate-700/80 text-xs space-y-1.5 transition-all duration-75 max-w-[240px]"
            style={{
              left: `${Math.min(
                Math.max(16, (activeHoveredPoint.x / width) * 100),
                78
              )}%`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="font-bold text-slate-200 border-b border-slate-700/80 pb-1 flex items-center justify-between gap-3">
              <span>{activeHoveredPoint.data.fullDateLabel}</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/25 text-emerald-300 font-mono text-[10px]">
                {activeHoveredPoint.data.trxCount} Trx
              </span>
            </div>
            <div className="flex justify-between items-center gap-4 pt-0.5 text-[11px]">
              <span className="text-slate-400 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    activeHoveredPoint.data.fee < 0 ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                />
                Fee Admin Toko:
              </span>
              <span
                className={`font-bold font-mono ${
                  activeHoveredPoint.data.fee < 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {formatSignedFee(activeHoveredPoint.data.fee)}
              </span>
            </div>
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-56 sm:h-64 cursor-crosshair overflow-visible"
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="feeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines and Reference Labels */}
          {gridSteps.map((fraction, idx) => {
            const y = padding.top + innerHeight * (1 - fraction);
            const val = maxVal * fraction;
            return (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                  strokeDasharray={idx === 0 ? 'none' : '3 3'}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {val >= 1000000
                    ? `${(val / 1000000).toFixed(val % 1000000 === 0 ? 0 : 1)}jt`
                    : val >= 1000
                    ? `${Math.round(val / 1000)}rb`
                    : `${Math.round(val)}`}
                </text>
              </g>
            );
          })}

          {/* Fee Area Fill */}
          {feeArea && <path d={feeArea} fill="url(#feeGradient)" />}

          {/* Fee Spline Line */}
          {feePath && (
            <path
              d={feePath}
              fill="none"
              stroke="#059669"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Subtle Data Nodes when series is compact */}
          {points.length <= 15 &&
            points.map((p, idx) => (
              <circle
                key={p.data.id}
                cx={p.x}
                cy={p.feeY}
                r={hoveredIndex === idx ? 5.5 : 3}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            ))}

          {/* X-Axis Labels */}
          {points.map((p, idx) => {
            const total = points.length;
            const showLabel =
              total <= 12 ||
              idx === 0 ||
              idx === total - 1 ||
              idx % Math.ceil(total / 8) === 0;

            if (!showLabel) return null;

            return (
              <text
                key={idx}
                x={p.x}
                y={height - 12}
                textAnchor="middle"
                fill={hoveredIndex === idx ? '#1e293b' : '#64748b'}
                fontSize="10"
                fontWeight={hoveredIndex === idx ? 'bold' : 'normal'}
              >
                {p.data.shortLabel}
              </text>
            );
          })}

          {/* Active Hover Crosshair Line and Glowing Dot */}
          {activeHoveredPoint && (
            <g>
              <line
                x1={activeHoveredPoint.x}
                y1={padding.top}
                x2={activeHoveredPoint.x}
                y2={baselineY}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={activeHoveredPoint.x}
                cy={activeHoveredPoint.feeY}
                r="5.5"
                fill="#059669"
                stroke="#ffffff"
                strokeWidth="2"
                className="filter drop-shadow"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Chart Legend Footer */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 rounded-full bg-emerald-600 inline-block" />
          <span className="font-medium text-slate-700">Fee Admin Toko (Margin)</span>
        </div>

        <div className="text-[11px] text-slate-400 mt-2 sm:mt-0">
          Arahkan kursor / sentuh titik diagram untuk melihat detail fee
        </div>
      </div>
    </div>
  );
};
