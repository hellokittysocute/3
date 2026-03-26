import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Save, Check, Download, Camera, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as XLSX from 'xlsx';
import { DashboardItem, EditableData } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency, formatCurrencyDetail, cn, isWorkingDay } from '../lib/utils';

type SortKey =
  | 'writeDate' | 'importance' | 'cisManager' | 'purchaseManager' | 'category' | 'customerCode'
  | 'materialCode' | 'itemName' | 'createdDate' | 'originalDueDate' | 'changedDueDate'
  | 'orderQuantity' | 'totalQuantity' | 'remainingQuantity'
  | 'productionCompleteDate' | 'materialSettingDate' | 'productionRequestYn' | 'mfg1'
  | 'manufacturingDate' | 'packagingDate' | 'productionSite'
  | 'revenuePossible' | 'revenuePossibleQuantity' | 'progressRate' | 'delayReason'
  | 'revenueReflected' | 'unitPrice' | 'revenue' | 'note';

type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection } | null;

/** "3/20" 등의 날짜 문자열을 Date 객체로 파싱 (올해 기준) */
function parseShortDate(s: string): Date | null {
  if (!s) return null;
  const v = s.trim().replace(/^~/, '');
  const m = v.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return new Date(new Date().getFullYear(), Number(m[1]) - 1, Number(m[2]));
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/** 기준일로부터 영업일(평일) N일 후 날짜 계산 */
function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isWorkingDay(d)) added++; // 주말 + 공휴일 제외
  }
  return d;
}

/** 두 날짜 사이의 영업일 수 계산 (from 다음날부터 to까지) */
function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  const target = to.getTime();
  const direction = target >= d.getTime() ? 1 : -1;
  if (direction === 1) {
    while (d.getTime() < target) {
      d.setDate(d.getDate() + 1);
      if (isWorkingDay(d)) count++;
    }
    return count;
  } else {
    while (d.getTime() > target) {
      d.setDate(d.getDate() - 1);
      if (isWorkingDay(d)) count++;
    }
    return -count;
  }
}

/** D-day 계산 (평일 기준): 기준일 + 영업일 기한 - 오늘 */
function calcDday(baseDate: string, filledDate: string, limitDays: number): { label: string; status: 'done' | 'ok' | 'today' | 'over' | 'none' } {
  const base = parseShortDate(baseDate);
  // 입력 완료 → 기한 대비 며칠 빨리/늦게 완료했는지 표시
  if (filledDate && filledDate.trim()) {
    if (!base) return { label: '0일', status: 'done' };
    const filled = parseShortDate(filledDate);
    if (!filled) return { label: '0일', status: 'done' };
    const deadline = addBusinessDays(base, limitDays);
    deadline.setHours(0, 0, 0, 0);
    filled.setHours(0, 0, 0, 0);
    if (deadline.getTime() === filled.getTime()) return { label: '0일', status: 'done' };
    if (filled < deadline) {
      const early = countBusinessDays(filled, deadline);
      return { label: `-${early}일`, status: 'done' };
    }
    const late = countBusinessDays(deadline, filled);
    return { label: `+${late}일`, status: 'doneOver' as any };
  }
  // 기준일 미입력
  if (!base) return { label: '-', status: 'none' };
  // 마감일 = 기준일 + 영업일 N일
  const deadline = addBusinessDays(base, limitDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  // 오늘과 마감일 사이의 영업일 차이
  if (deadline.getTime() === today.getTime()) return { label: '0일', status: 'today' };
  if (deadline.getTime() > today.getTime()) {
    const remaining = countBusinessDays(today, deadline);
    return { label: `-${remaining}일`, status: 'ok' };
  }
  const overdue = countBusinessDays(deadline, today);
  return { label: `+${overdue}일`, status: 'over' };
}

const DDAY_STYLE: Record<string, string> = {
  done: 'text-emerald-600 font-bold',
  doneOver: 'text-amber-600 font-bold',
  ok: 'text-slate-400',
  today: 'text-amber-600 font-bold animate-pulse',
  over: 'text-rose-600 font-bold',
  none: 'text-slate-300',
};

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const s = dateStr.trim();
  // "~4/24" 접두사 보존
  const prefixMatch = s.match(/^(~\s*)(\d{1,2})\/(\d{1,2})$/);
  if (prefixMatch) return `~${Number(prefixMatch[2])}/${Number(prefixMatch[3])}`;
  // "m/d", "mm/dd" 형식 → 앞의 0 제거
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) return `${Number(slashMatch[1])}/${Number(slashMatch[2])}`;
  // "mm.dd", "m.dd" 형식
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dotMatch) return `${Number(dotMatch[1])}/${Number(dotMatch[2])}`;
  // "03월18일", "3월18일" 형식
  const korMatch = s.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) return `${Number(korMatch[1])}/${Number(korMatch[2])}`;
  // ISO or standard date → Date 파싱
  const d = new Date(s);
  if (!isNaN(d.getTime())) return `${d.getMonth() + 1}/${d.getDate()}`;
  return dateStr;
}

interface DataTableProps {
  items: DashboardItem[];
  editData: Record<string, EditableData>;
  onUpdateField: (id: string, field: keyof EditableData, value: string | number) => void;
  onSave: () => void;
  onSnapshot?: () => void;
  snapshotStatus?: 'idle' | 'saving' | 'saved';
  saveStatus: 'idle' | 'saved' | 'loading';
  isAdmin?: boolean;
  readOnly?: boolean;
  children?: React.ReactNode;
}

type Tier = '전체' | '상' | '중' | '하';

// 매출액 기준 상위 40% → 상, 중간 30% → 중, 하위 30% → 하
function buildTierMap(items: DashboardItem[]): Record<string, '상' | '중' | '하'> {
  const sorted = [...items].sort((a, b) => getRevenue(b) - getRevenue(a));
  const top40 = Math.ceil(sorted.length * 0.4);
  const top70 = Math.ceil(sorted.length * 0.7);
  const map: Record<string, '상' | '중' | '하'> = {};
  sorted.forEach((item, idx) => {
    if (idx < top40) map[item.id] = '상';
    else if (idx < top70) map[item.id] = '중';
    else map[item.id] = '하';
  });
  return map;
}

function getProgressRate(item: DashboardItem, editData: Record<string, EditableData>): number {
  const qty = editData[item.id]?.revenuePossibleQuantity || 0;
  return item.remainingQuantity > 0 ? (qty / item.remainingQuantity) * 100 : 0;
}

const TIER_COLORS = {
  '상': { dot: '#e8354a', bg: '#fde8eb', text: '#e8354a', border: '#e8354a' },
  '중': { dot: '#d4880a', bg: '#fdf3e0', text: '#d4880a', border: '#d4880a' },
  '하': { dot: '#16a34a', bg: '#e6f5eb', text: '#16a34a', border: '#16a34a' },
};

const INPUT_CLASS = "w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

/** 행에 D-day 초과 건이 있는지 판단 */
function hasOverdueDday(row: EditableData | undefined): boolean {
  if (!row) return false;
  const checks: [string, string, number][] = [
    [row.writeDate, row.materialSettingFilledAt, 3],           // 부자재
    [row.materialSettingFilledAt, row.manufacturingFilledAt, 3], // 제조
    [row.manufacturingFilledAt, row.packagingFilledAt, 2],      // 충포장
  ];
  for (const [base, filled, limit] of checks) {
    const d = calcDday(base, filled, limit);
    if (d.status === 'over') return true;
  }
  return false;
}

// 메모이즈된 행 컴포넌트
interface TableRowProps {
  item: DashboardItem;
  row: EditableData | undefined;
  tier: '상' | '중' | '하';
  color: typeof TIER_COLORS['상'];
  rate: number;
  isAdmin?: boolean;
  readOnly?: boolean;
  onUpdateField: (id: string, field: keyof EditableData, value: string | number) => void;
}

const TableRow = React.memo<TableRowProps>(({ item, row, tier, color, rate, isAdmin, readOnly, onUpdateField }) => {
  return (
    <>
      {/* 작성일 컬럼 (고정) */}
      <td className="px-1 py-1 border-r border-slate-100/60 text-center sm:sticky sm:left-0 sm:z-20 bg-white">
        <span className="text-[13px] text-slate-500">{row?.writeDate ?? ''}</span>
      </td>
      {/* 중요도 컬럼 - 드롭다운 (고정) */}
      <td className="px-1 py-1 border-r border-slate-100/60 text-center sm:sticky sm:left-[58px] sm:z-20 bg-white" style={{ backgroundColor: color.bg }}>
        <select
          className={cn(INPUT_CLASS, "text-center appearance-none cursor-pointer font-bold text-[13px]")}
          style={{ color: color.text, backgroundColor: `${color.dot}10`, borderColor: `${color.dot}40` }}
          value={row?.importance || ''}
          onChange={(e) => onUpdateField(item.id, 'importance', e.target.value)}
          disabled={readOnly}
        >
          <option value="">선택</option>
          <option value="상">상</option>
          <option value="중">중</option>
          <option value="하">하</option>
        </select>
      </td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[102px] sm:z-20 whitespace-nowrap bg-white">{item.cisManager}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[160px] sm:z-20 whitespace-nowrap bg-white">{row?.purchaseManager ?? ''}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[218px] sm:z-20 whitespace-nowrap bg-white">{item.category}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[288px] sm:z-20 whitespace-nowrap bg-white">{item.customerCode}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[350px] sm:z-20 bg-white">{item.materialCode}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 sm:sticky sm:left-[460px] sm:z-20 bg-white" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>
        <div className="min-w-[150px] text-slate-500 text-[13px]">{item.itemName}</div>
      </td>
      <td className="px-2 py-1 border-r-2 border-slate-300 text-right font-bold text-slate-900 text-[13px]">{formatCurrencyDetail(getRevenue(item))}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center w-[76px] min-w-[76px] max-w-[76px]">{formatDateShort(item.createdDate)}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center w-[76px] min-w-[76px] max-w-[76px]">{formatDateShort(item.originalDueDate)}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center w-[76px] min-w-[76px] max-w-[76px]">{formatDateShort(item.changedDueDate)}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-right text-slate-600 text-[13px]">{item.orderQuantity.toLocaleString()}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-right text-slate-600 text-[13px]">{item.totalQuantity.toLocaleString()}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-right font-bold text-slate-900 text-[13px]">{item.remainingQuantity.toLocaleString()}</td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.productionCompleteDate ?? ''} onChange={(e) => onUpdateField(item.id, 'productionCompleteDate', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.materialSettingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'materialSettingDate', e.target.value)} disabled={readOnly} />
      </td>
      {(() => { const d = calcDday(row?.writeDate ?? '', row?.materialSettingFilledAt ?? '', 3); return (
        <td className={cn("px-1 py-1 border-r border-slate-100/60 text-center text-[12px] whitespace-nowrap", DDAY_STYLE[d.status])}>{d.label}</td>
      ); })()}
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center whitespace-nowrap">{item.productionRequestYn}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] whitespace-nowrap">{formatDateShort(item.mfg1)}</td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.manufacturingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'manufacturingDate', e.target.value)} disabled={readOnly} />
      </td>
      {(() => { const d = calcDday(row?.materialSettingFilledAt ?? '', row?.manufacturingFilledAt ?? '', 3); return (
        <td className={cn("px-1 py-1 border-r border-slate-100/60 text-center text-[12px] whitespace-nowrap", DDAY_STYLE[d.status])}>{d.label}</td>
      ); })()}
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.packagingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'packagingDate', e.target.value)} disabled={readOnly} />
      </td>
      {(() => { const d = calcDday(row?.manufacturingFilledAt ?? '', row?.packagingFilledAt ?? '', 2); return (
        <td className={cn("px-1 py-1 border-r border-slate-100/60 text-center text-[12px] whitespace-nowrap", DDAY_STYLE[d.status])}>{d.label}</td>
      ); })()}
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.productionSite ?? ''} onChange={(e) => onUpdateField(item.id, 'productionSite', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-emerald-50/20 text-center">
        <select
          className={cn(INPUT_CLASS, "text-center appearance-none cursor-pointer text-[13px]",
            row?.revenuePossible === '가능' && "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
            row?.revenuePossible === '확인중' && "bg-amber-50 text-amber-700 border-amber-300 font-bold",
            row?.revenuePossible === '불가능' && "bg-rose-50 text-rose-700 border-rose-300 font-bold",
          )}
          value={row?.revenuePossible || '확인중'}
          onChange={(e) => onUpdateField(item.id, 'revenuePossible', e.target.value)}
          disabled={readOnly}
        >
          <option value="확인중">확인중</option>
          <option value="가능">가능</option>
          <option value="불가능">불가능</option>
        </select>
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-emerald-50/20">
        <input type="text" className={cn(INPUT_CLASS, "text-right text-[13px]")} value={row?.revenuePossibleQuantity ? row.revenuePossibleQuantity.toLocaleString() : ''} placeholder="입력" onChange={(e) => { const num = Number(e.target.value.replace(/,/g, '')); if (!isNaN(num)) onUpdateField(item.id, 'revenuePossibleQuantity', num); }} disabled={readOnly} />
      </td>
      {(() => { const d = calcDday(row?.packagingFilledAt ?? '', row?.revenuePossible === '가능' || row?.revenuePossible === '불가능' ? (row?.packagingFilledAt ?? '') : '', 2);
        // 충포장 미입력이면 none, 매출가능여부 미입력이면 경과일 표시
        const show = (row?.packagingDate ?? '').trim() && (row?.packagingFilledAt ?? '').trim();
        const pending = show && (row?.revenuePossible === '확인중' || !row?.revenuePossible);
        if (pending) {
          const parseD = (s: string): Date | null => { if (!s) return null; const v = s.trim().replace(/^~/, ''); const mt = v.match(/^(\d{1,2})\/(\d{1,2})$/); if (mt) return new Date(new Date().getFullYear(), Number(mt[1]) - 1, Number(mt[2])); const dd = new Date(v); return isNaN(dd.getTime()) ? null : dd; };
          const bizD = (from: Date, to: Date): number => { let c = 0; const dd = new Date(from); while (dd < to) { dd.setDate(dd.getDate() + 1); if (isWorkingDay(dd)) c++; } return c; };
          const pkgD = parseD(row?.packagingFilledAt ?? '');
          const now = new Date(); now.setHours(0,0,0,0);
          const elapsed = pkgD ? bizD(pkgD, now) : 0;
          const diff = elapsed - 2;
          const status = diff > 0 ? 'over' : diff === 0 ? 'today' : 'ok';
          const label = diff <= 0 ? `D${diff}` : `D+${diff}`;
          return <td className={cn("px-1 py-1 border-r border-slate-100/60 text-center text-[12px] whitespace-nowrap", DDAY_STYLE[status])}>{label}</td>;
        }
        return <td className={cn("px-1 py-1 border-r border-slate-100/60 text-center text-[12px] whitespace-nowrap", show ? DDAY_STYLE['done'] : DDAY_STYLE['none'])}>{show && row?.revenuePossible && row.revenuePossible !== '확인중' ? '✓' : ''}</td>;
      })()}
      <td className="px-1 py-1 border-r border-slate-100/60 bg-amber-50/20 text-center">
        <span className="text-[13px] font-bold" style={{ color: color.text }}>
          {rate.toFixed(1)}%
        </span>
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-amber-50/20 text-center">
        <select
          className={cn(INPUT_CLASS, "text-center appearance-none cursor-pointer text-[13px]",
            row?.delayReason && "font-bold text-amber-700 bg-amber-50 border-amber-300",
          )}
          value={row?.delayReason ?? ''}
          onChange={(e) => onUpdateField(item.id, 'delayReason', e.target.value)}
          disabled={readOnly}
        >
          <option value="">선택</option>
          <option value="구매">구매</option>
          <option value="생산">생산</option>
          <option value="품질">품질</option>
          <option value="연구소">연구소</option>
          <option value="물류">물류</option>
          <option value="영업">영업</option>
        </select>
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 text-center">
        <select
          className={cn(INPUT_CLASS, "text-center appearance-none cursor-pointer text-[13px]")}
          value={row?.revenueReflected ?? ''}
          onChange={(e) => onUpdateField(item.id, 'revenueReflected', e.target.value)}
          disabled={readOnly}
        >
          <option value="">-</option>
          <option value="O">O</option>
          <option value="X">X</option>
        </select>
      </td>
      {isAdmin && <td className="px-2 py-1 border-r border-slate-100/60 text-right text-slate-500 text-[13px]">{item.unitPrice.toLocaleString()}</td>}
      <td className="px-1 py-1">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.note ?? ''} onChange={(e) => onUpdateField(item.id, 'note', e.target.value)} disabled={readOnly} />
      </td>
    </>
  );
});

const ROW_HEIGHT = 40;

function getSortValue(item: DashboardItem, editData: Record<string, EditableData>, key: SortKey): string | number {
  const row = editData[item.id];
  switch (key) {
    case 'writeDate': return row?.writeDate || '';
    case 'importance': return row?.importance || '';
    case 'cisManager': return item.cisManager || '';
    case 'purchaseManager': return row?.purchaseManager || '';
    case 'category': return item.category || '';
    case 'customerCode': return item.customerCode || '';
    case 'materialCode': return item.materialCode || '';
    case 'itemName': return item.itemName || '';
    case 'createdDate': return item.createdDate || '';
    case 'originalDueDate': return item.originalDueDate || '';
    case 'changedDueDate': return item.changedDueDate || '';
    case 'orderQuantity': return item.orderQuantity;
    case 'totalQuantity': return item.totalQuantity;
    case 'remainingQuantity': return item.remainingQuantity;
    case 'productionCompleteDate': return row?.productionCompleteDate || '';
    case 'materialSettingDate': return row?.materialSettingDate || '';
    case 'productionRequestYn': return item.productionRequestYn || '';
    case 'mfg1': return item.mfg1 || '';
    case 'manufacturingDate': return row?.manufacturingDate || '';
    case 'packagingDate': return row?.packagingDate || '';
    case 'productionSite': return row?.productionSite || '';
    case 'revenuePossible': return row?.revenuePossible || '';
    case 'revenuePossibleQuantity': return row?.revenuePossibleQuantity || 0;
    case 'progressRate': return item.remainingQuantity > 0 ? ((row?.revenuePossibleQuantity || 0) / item.remainingQuantity) * 100 : 0;
    case 'delayReason': return row?.delayReason || '';
    case 'revenueReflected': return row?.revenueReflected || '';
    case 'unitPrice': return item.unitPrice;
    case 'revenue': return getRevenue(item);
    case 'note': return row?.note || '';
    default: return '';
  }
}

interface SortableThProps {
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const SortableTh: React.FC<SortableThProps> = ({ sortKey, sortConfig, onSort, className, style, children }) => {
  const isActive = sortConfig?.key === sortKey;
  return (
    <th
      data-sort-key={sortKey}
      className={cn(className, "cursor-pointer select-none hover:bg-slate-100/80 transition-colors")}
      style={style}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center justify-center gap-0.5">
        <span>{children}</span>
        <span className="inline-flex flex-col ml-0.5">
          {isActive ? (
            sortConfig.direction === 'asc'
              ? <ChevronUp className="w-3 h-3 text-indigo-600" />
              : <ChevronDown className="w-3 h-3 text-indigo-600" />
          ) : (
            <ChevronsUpDown className="w-3 h-3 text-slate-300" />
          )}
        </span>
      </div>
    </th>
  );
};

export const DataTable: React.FC<DataTableProps> = ({ items, editData, onUpdateField, onSave, onSnapshot, snapshotStatus = 'idle', saveStatus, isAdmin, readOnly, children }) => {
  const [activeTier, setActiveTier] = useState<Tier>('전체');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: SortKey } | null>(null);

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const autoTierMap = useMemo(() => buildTierMap(items), [items]);

  // 수동 importance 우선, 없으면 자동 계산값
  const getTier = useCallback((item: DashboardItem): '상' | '중' | '하' => {
    const manual = editData[item.id]?.importance;
    if (manual === '상' || manual === '중' || manual === '하') return manual;
    return autoTierMap[item.id];
  }, [editData, autoTierMap]);

  const handleExcelDownload = useCallback(() => {
    const rows = items.map((item) => {
      const row = editData[item.id];
      const tier = getTier(item);
      const rate = item.remainingQuantity > 0
        ? ((row?.revenuePossibleQuantity || 0) / item.remainingQuantity) * 100
        : 0;

      return {
        '작성일': row?.writeDate ?? '',
        '중요도': tier,
        '자재코드': item.materialCode,
        '내역': item.itemName,
        'CIS담당': item.cisManager,
        '구매담당': row?.purchaseManager ?? '',
        '중분류명': item.category,
        '고객약호': item.customerCode,
        '판매처이름': item.customerName,
        '영업팀명': item.teamName,
        '영업담당자명': item.salesManager,
        '생성일': item.createdDate,
        '원납기일': item.originalDueDate,
        '변경납기일': item.changedDueDate,
        '변경납기월': item.dueMonth,
        '총오더수량': item.orderQuantity,
        '환산수량': item.totalQuantity,
        '납품수량': item.deliveredQuantity,
        '미납잔량': item.remainingQuantity,
        '생산완료 요청일': row?.productionCompleteDate ?? '',
        '부자재(일정)': row?.materialSettingDate ?? '',
        '제조요청여부': item.productionRequestYn,
        '현재 제조계획': item.mfg1,
        '제조': row?.manufacturingDate ?? '',
        '충포장': row?.packagingDate ?? '',
        '생산처': row?.productionSite ?? '',
        '매출 가능여부': row?.revenuePossible ?? '',
        '매출 가능 수량': row?.revenuePossibleQuantity || 0,
        '진도율(%)': Number(rate.toFixed(1)),
        '지연사유': row?.delayReason ?? '',
        '매출반영여부': row?.revenueReflected ?? '',
        '단가': item.unitPrice,
        '매출(단가x잔량)': getRevenue(item),
        '관리구분': item.managementType,
        '생산리드타임': item.leadTime,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '상세데이터');
    XLSX.writeFile(wb, `상세데이터_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [items, editData, getTier]);

  const tierCounts = useMemo(() => {
    const counts = { '상': 0, '중': 0, '하': 0 };
    items.forEach(item => { counts[getTier(item)]++; });
    return counts;
  }, [items, getTier]);

  const filteredItems = useMemo(() => {
    if (activeTier === '전체') return items;
    return items.filter(item => getTier(item) === activeTier);
  }, [items, getTier, activeTier]);

  const sortedItems = useMemo(() => {
    if (!sortConfig) {
      // 기본 정렬: 매출 내림차순
      return [...filteredItems].sort((a, b) => getRevenue(b) - getRevenue(a));
    }
    const { key, direction } = sortConfig;
    return [...filteredItems].sort((a, b) => {
      const aVal = getSortValue(a, editData, key);
      const bVal = getSortValue(b, editData, key);
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'ko');
      }
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredItems, editData, sortConfig]);

  const totals = useMemo(() => {
    return sortedItems.reduce((acc, item) => ({
      totalQuantity: acc.totalQuantity + item.totalQuantity,
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      deliveredQuantity: acc.deliveredQuantity + item.deliveredQuantity,
      remainingQuantity: acc.remainingQuantity + item.remainingQuantity,
      revenue: acc.revenue + getRevenue(item),
      originalOrderQuantity: acc.originalOrderQuantity + (item.orderQuantity || 0),
    }), { totalQuantity: 0, orderQuantity: 0, deliveredQuantity: 0, remainingQuantity: 0, revenue: 0, originalOrderQuantity: 0 });
  }, [sortedItems]);

  const totalRevenuePossibleQty = useMemo(() => {
    return sortedItems.reduce((sum, item) => sum + (editData[item.id]?.revenuePossibleQuantity || 0), 0);
  }, [sortedItems, editData]);

  const tabs: { key: Tier; label: string; emoji?: string }[] = [
    { key: '전체', label: '전체' },
    { key: '상', label: '상', emoji: '🔴' },
    { key: '중', label: '중', emoji: '🟡' },
    { key: '하', label: '하', emoji: '🟢' },
  ];

  // 상단/하단 스크롤 동기화
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const topEl = topScrollRef.current;
    const tableEl = tableScrollRef.current;
    if (!topEl || !tableEl) return;
    let syncing = false;
    const onTopScroll = () => { if (!syncing) { syncing = true; tableEl.scrollLeft = topEl.scrollLeft; syncing = false; } };
    const onTableScroll = () => { if (!syncing) { syncing = true; topEl.scrollLeft = tableEl.scrollLeft; syncing = false; } };
    topEl.addEventListener('scroll', onTopScroll);
    tableEl.addEventListener('scroll', onTableScroll);
    return () => { topEl.removeEventListener('scroll', onTopScroll); tableEl.removeEventListener('scroll', onTableScroll); };
  }, []);

  // 우클릭 컨텍스트 메뉴 닫기
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  const handleHeaderContext = (e: React.MouseEvent) => {
    const th = (e.target as HTMLElement).closest('th');
    if (!th?.dataset.sortKey) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, key: th.dataset.sortKey as SortKey });
  };

  // 가상화 설정
  const rowVirtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div>
      {/* 필터 탭 + 저장 버튼 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto">
          {tabs.map(tab => {
            const isActive = activeTier === tab.key;
            const count = tab.key === '전체' ? items.length : tierCounts[tab.key as '상' | '중' | '하'];
            const color = tab.key !== '전체' ? TIER_COLORS[tab.key as '상' | '중' | '하'] : null;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTier(tab.key)}
                className={cn(
                  "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[13px] sm:text-[15px] font-bold transition-all border shrink-0",
                  isActive && tab.key === '전체' && "bg-slate-900 text-white border-slate-900 shadow-lg",
                  isActive && tab.key !== '전체' && "text-white shadow-lg",
                  !isActive && "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                )}
                style={isActive && color ? { backgroundColor: color.border, borderColor: color.border } : undefined}
              >
                {tab.emoji && <span className="text-[12px] sm:text-[14px]">{tab.emoji}</span>}
                {tab.label}
                <span
                  className={cn(
                    "text-[12px] sm:text-[14px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full min-w-[22px] sm:min-w-[26px] text-center",
                    isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500",
                  )}
                  style={isActive && color ? { backgroundColor: 'rgba(255,255,255,0.25)' } : undefined}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleExcelDownload}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[13px] sm:text-[15px] font-bold transition-all duration-300 shadow-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> 다운로드
          </button>
          {!readOnly && (
            <button
              onClick={onSave}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-[13px] sm:text-[15px] font-bold transition-all duration-300 shadow-lg",
                saveStatus === 'saved'
                  ? "bg-emerald-500 text-white shadow-emerald-200"
                  : "bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-200"
              )}
            >
              {saveStatus === 'saved' ? (
                <><Check className="w-4 h-4" /> 저장 완료</>
              ) : (
                <><Save className="w-4 h-4" /> 저장</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 탭과 테이블 사이 슬롯 (검색 필터 등) */}
      {children}

      {/* 상단 스크롤바 */}
      <div ref={topScrollRef} className="overflow-x-auto" style={{ height: '16px' }}>
        <div style={{ width: '2900px', height: '1px' }} />
      </div>

      <div ref={tableScrollRef} className="overflow-auto max-h-[85vh]">
        <table className="w-full text-left border-collapse min-w-[2900px]">
          <thead className="bg-slate-50 border-b border-slate-200 sm:sticky sm:top-0 sm:z-30">
            <tr className="text-[13px] font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap" onContextMenu={handleHeaderContext}>
              <SortableTh sortKey="writeDate" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center w-[58px] sm:sticky sm:left-0 sm:z-40 bg-indigo-100 text-indigo-600">작성일</SortableTh>
              <SortableTh sortKey="importance" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center w-[44px] sm:sticky sm:left-[58px] sm:z-40 bg-slate-100">중요도</SortableTh>
              <SortableTh sortKey="cisManager" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[102px] sm:z-40 bg-slate-100">CIS담당</SortableTh>
              <SortableTh sortKey="purchaseManager" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 sm:sticky sm:left-[160px] sm:z-40 bg-indigo-100 text-indigo-600">구매담당</SortableTh>
              <SortableTh sortKey="category" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[218px] sm:z-40 bg-slate-100">중분류</SortableTh>
              <SortableTh sortKey="customerCode" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[288px] sm:z-40 bg-slate-100">고객약호</SortableTh>
              <SortableTh sortKey="materialCode" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[350px] sm:z-40 bg-slate-100">자재</SortableTh>
              <SortableTh sortKey="itemName" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[460px] sm:z-40 bg-slate-100" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>내역</SortableTh>
              <SortableTh sortKey="revenue" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r-2 border-slate-300 text-right bg-slate-100">매출<br/>(단가x잔량)</SortableTh>

              <SortableTh sortKey="createdDate" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 w-[76px] min-w-[76px] max-w-[76px] text-center bg-slate-100">생성일</SortableTh>
              <SortableTh sortKey="originalDueDate" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 w-[76px] min-w-[76px] max-w-[76px] text-center bg-slate-100">원납기일</SortableTh>
              <SortableTh sortKey="changedDueDate" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 w-[76px] min-w-[76px] max-w-[76px] text-center bg-slate-100">변경납기일</SortableTh>
              <SortableTh sortKey="orderQuantity" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 text-right w-[78px] bg-slate-100">총오더수량</SortableTh>
              <SortableTh sortKey="totalQuantity" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 text-right w-[72px] bg-slate-100">환산수량</SortableTh>
              <SortableTh sortKey="remainingQuantity" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 text-right w-[72px] bg-slate-100">미납잔량</SortableTh>
              <SortableTh sortKey="productionCompleteDate" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-100 text-indigo-600 w-[76px]">생산완료<br/>요청일</SortableTh>
              <SortableTh sortKey="materialSettingDate" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-100 text-indigo-600 w-[68px]">부자재</SortableTh>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-rose-100 text-rose-500 w-[48px] text-[11px]">부자재<br/>D-day</th>
              <SortableTh sortKey="productionRequestYn" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 text-center w-[62px] bg-slate-100">제조<br/>요청여부</SortableTh>
              <SortableTh sortKey="mfg1" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 text-center w-[72px] bg-slate-100">현재<br/>제조계획</SortableTh>
              <SortableTh sortKey="manufacturingDate" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-100 text-indigo-600 w-[68px]">제조</SortableTh>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-rose-100 text-rose-500 w-[48px] text-[11px]">제조<br/>D-day</th>
              <SortableTh sortKey="packagingDate" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-100 text-indigo-600 w-[200px]">충포장</SortableTh>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-rose-100 text-rose-500 w-[48px] text-[11px]">충포장<br/>D-day</th>
              <SortableTh sortKey="productionSite" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-100 text-indigo-600 w-[82px]">생산처</SortableTh>
              <SortableTh sortKey="revenuePossible" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-emerald-100 text-emerald-600">매출<br/>가능여부</SortableTh>
              <SortableTh sortKey="revenuePossibleQuantity" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-emerald-100 text-emerald-600 w-[100px]">매출<br/>가능수량</SortableTh>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-rose-100 text-rose-500 w-[48px] text-[11px]">가능여부<br/>D-day</th>
              <SortableTh sortKey="progressRate" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-amber-100 text-amber-600">진도율</SortableTh>
              <SortableTh sortKey="delayReason" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-amber-100 text-amber-600">지연<br/>사유</SortableTh>
              <SortableTh sortKey="revenueReflected" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center bg-slate-100">매출<br/>반영여부</SortableTh>
              {isAdmin && <SortableTh sortKey="unitPrice" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 text-right bg-slate-100">단가</SortableTh>}
              <SortableTh sortKey="note" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 text-center bg-slate-100">비고</SortableTh>
            </tr>
          </thead>
          <tbody className="text-[15px]">
            {/* 가상화: 전체 높이를 확보하는 빈 행 (상단 패딩) */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
                <td colSpan={isAdmin ? 31 : 30} />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = sortedItems[virtualRow.index];
              const row = editData[item.id];
              const rate = getProgressRate(item, editData);
              const tier = getTier(item);
              const color = TIER_COLORS[tier];

              const overdue = hasOverdueDday(row);
              return (
                <tr
                  key={item.id}
                  data-index={virtualRow.index}
                  className={cn("transition-colors border-b border-slate-100", overdue ? "bg-rose-50/60 hover:bg-rose-100/60" : "hover:bg-slate-50")}
                  style={{ height: ROW_HEIGHT }}
                >
                  <TableRow
                    item={item}
                    row={row}
                    tier={tier}
                    color={color}
                    rate={rate}
                    isAdmin={isAdmin}
                    readOnly={readOnly}
                    onUpdateField={onUpdateField}
                  />
                </tr>
              );
            })}
            {/* 가상화: 하단 패딩 */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end) }}>
                <td colSpan={isAdmin ? 31 : 30} />
              </tr>
            )}
          </tbody>
          <tfoot className="sm:sticky sm:bottom-0 sm:z-25 border-t-2 border-slate-300">
            <tr className="bg-slate-100 font-extrabold text-slate-800 text-[15px]">
              {/* sticky 8열: 작성일~내역 (헤더와 동일한 left 위치) */}
              <td className="px-3 py-3 border-r border-slate-200 text-center text-[14px] text-slate-500 sm:sticky sm:left-0 sm:z-20 bg-slate-100">합계</td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[58px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[102px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[160px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[218px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[288px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[350px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[460px] sm:z-20 bg-slate-100" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}></td>
              {/* 매출 합계 */}
              <td className="px-4 py-3 text-right border-r-2 border-slate-300 bg-slate-100">{formatCurrencyDetail(totals.revenue)}</td>
              {/* 생성일, 원납기일, 변경납기일 */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* 총오더수량, 환산수량, 미납잔량 */}
              <td className="px-4 py-3 text-right border-r border-slate-200">{totals.orderQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right border-r border-slate-200">{totals.totalQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right border-r border-slate-200">{totals.remainingQuantity.toLocaleString()}</td>
              {/* 생산완료요청일, 부자재, 부자재D-day, 제조요청여부, 현재제조계획, 제조, 제조D-day, 충포장, 충포장D-day, 생산처 */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* 매출가능여부 */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* 매출가능수량 */}
              <td className="px-4 py-3 text-right border-r border-slate-200">{totalRevenuePossibleQty.toLocaleString()}</td>
              {/* 가능여부D-day */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* 진도율 */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* 지연사유 */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* 매출반영 */}
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {/* [admin] 단가 */}
              {isAdmin && <td className="px-4 py-3 border-r border-slate-200"></td>}
              {/* 비고 */}
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 우클릭 정렬 컨텍스트 메뉴 */}
      {contextMenu && (
        <div
          className="fixed z-[9999] bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => { setSortConfig({ key: contextMenu.key as SortKey, direction: 'asc' }); setContextMenu(null); }}
          >
            <span className="text-indigo-500">▲</span> 오름차순 정렬
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            onClick={() => { setSortConfig({ key: contextMenu.key as SortKey, direction: 'desc' }); setContextMenu(null); }}
          >
            <span className="text-indigo-500">▼</span> 내림차순 정렬
          </button>
          {sortConfig && sortConfig.key === contextMenu.key && (
            <>
              <div className="border-t border-slate-100 my-1" />
              <button
                className="w-full px-4 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 flex items-center gap-2"
                onClick={() => { setSortConfig(null); setContextMenu(null); }}
              >
                <span>✕</span> 정렬 해제
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
