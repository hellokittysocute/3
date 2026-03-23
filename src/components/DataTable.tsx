import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Save, Check, Download, Camera, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as XLSX from 'xlsx';
import { DashboardItem, EditableData } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency, cn } from '../lib/utils';

type SortKey =
  | 'importance' | 'cisManager' | 'purchaseManager' | 'category' | 'customerCode'
  | 'materialCode' | 'itemName' | 'createdDate' | 'originalDueDate' | 'changedDueDate'
  | 'orderQuantity' | 'totalQuantity' | 'remainingQuantity'
  | 'productionCompleteDate' | 'materialSettingDate' | 'productionRequestYn' | 'mfg1'
  | 'manufacturingDate' | 'packagingDate' | 'productionSite'
  | 'revenuePossible' | 'revenuePossibleQuantity' | 'progressRate' | 'delayReason'
  | 'unitPrice' | 'revenue' | 'note';

type SortDirection = 'asc' | 'desc';
type SortConfig = { key: SortKey; direction: SortDirection } | null;

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
  hasFilter?: boolean;
  delayedIds?: Set<string>;
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
  '상': { dot: '#e8354a', bg: '#fef1f2', text: '#e8354a', border: '#e8354a' },
  '중': { dot: '#d4880a', bg: '#fdf6ed', text: '#d4880a', border: '#d4880a' },
  '하': { dot: '#16a34a', bg: '#edf8f1', text: '#16a34a', border: '#16a34a' },
};

const INPUT_CLASS = "w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

// 메모이즈된 행 컴포넌트
interface TableRowProps {
  item: DashboardItem;
  row: EditableData | undefined;
  tier: '상' | '중' | '하';
  color: typeof TIER_COLORS['상'];
  rate: number;
  isAdmin?: boolean;
  readOnly?: boolean;
  isDelayed?: boolean;
  onUpdateField: (id: string, field: keyof EditableData, value: string | number) => void;
}

const DELAY_INPUT_CLASS = "!border-red-400 !bg-red-50/50";

const TableRow = React.memo<TableRowProps>(({ item, row, tier, color, rate, isAdmin, readOnly, isDelayed, onUpdateField }) => {
  const stickyBg = isDelayed ? 'bg-red-50' : 'bg-white';
  return (
    <>
      {/* 중요도 컬럼 - 드롭다운 (고정) */}
      <td className={cn("px-1 py-1 border-r border-slate-100/60 text-center sm:sticky sm:left-0 sm:z-20 overflow-hidden min-w-[44px] w-[44px]", stickyBg)} style={{ backgroundColor: isDelayed ? undefined : color.bg }}>
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
      <td className={cn("px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[44px] sm:z-20 whitespace-nowrap overflow-hidden min-w-[58px] w-[58px]", stickyBg)}>{item.cisManager}</td>
      <td className={cn("px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[102px] sm:z-20 whitespace-nowrap overflow-hidden min-w-[58px] w-[58px]", stickyBg)}>{row?.purchaseManager ?? ''}</td>
      <td className={cn("px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[160px] sm:z-20 whitespace-nowrap overflow-hidden min-w-[70px] w-[70px]", stickyBg)}>{item.category}</td>
      <td className={cn("px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[230px] sm:z-20 whitespace-nowrap overflow-hidden min-w-[62px] w-[62px]", stickyBg)}>{item.customerCode}</td>
      <td className={cn("px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sm:sticky sm:left-[292px] sm:z-20 overflow-hidden min-w-[110px] w-[110px]", stickyBg)}>{item.materialCode}</td>
      <td className={cn("px-2 py-1 border-r-2 border-slate-300 sm:sticky sm:left-[402px] sm:z-20 overflow-hidden", stickyBg)} style={{ boxShadow: '6px 0 12px -2px rgba(0,0,0,0.12)' }}>
        <div className="min-w-[150px] text-slate-500 text-[13px]">{item.itemName}</div>
      </td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center">{formatDateShort(item.createdDate)}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center">{formatDateShort(item.originalDueDate)}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center">{formatDateShort(item.changedDueDate)}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-right text-slate-600 text-[13px]">{item.orderQuantity.toLocaleString()}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-right text-slate-600 text-[13px]">{item.totalQuantity.toLocaleString()}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-right font-bold text-slate-900 text-[13px]">{item.remainingQuantity.toLocaleString()}</td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.productionCompleteDate ?? ''} onChange={(e) => onUpdateField(item.id, 'productionCompleteDate', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]", isDelayed && !(row?.materialSettingDate ?? '').trim() && DELAY_INPUT_CLASS)} value={row?.materialSettingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'materialSettingDate', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] text-center whitespace-nowrap">{item.productionRequestYn}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] whitespace-nowrap">{formatDateShort(item.mfg1)}</td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]", isDelayed && !(row?.manufacturingDate ?? '').trim() && DELAY_INPUT_CLASS)} value={row?.manufacturingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'manufacturingDate', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]", isDelayed && !(row?.packagingDate ?? '').trim() && DELAY_INPUT_CLASS)} value={row?.packagingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'packagingDate', e.target.value)} disabled={readOnly} />
      </td>
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
        <input type="text" className={cn(INPUT_CLASS, "text-right text-[13px]", (row?.revenuePossible || '확인중') === '확인중' && "bg-slate-50 text-slate-300")} value={(row?.revenuePossible || '확인중') === '확인중' ? '' : (row?.revenuePossibleQuantity ? row.revenuePossibleQuantity.toLocaleString() : '')} placeholder={(row?.revenuePossible || '확인중') === '확인중' ? '' : '입력'} onChange={(e) => { const num = Number(e.target.value.replace(/,/g, '')); if (!isNaN(num)) onUpdateField(item.id, 'revenuePossibleQuantity', num); }} disabled={readOnly || (row?.revenuePossible || '확인중') === '확인중'} />
      </td>
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
      {isAdmin && <td className="px-2 py-1 border-r border-slate-100/60 text-right text-slate-500 text-[13px]">{item.unitPrice.toLocaleString()}</td>}
      <td className="px-2 py-1 border-r border-slate-100/60 text-right font-bold text-slate-900 text-[13px]">{formatCurrency(getRevenue(item))}</td>
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
  resizable?: boolean;
  resizeTarget?: SortKey;
  onResizeStart?: (e: React.MouseEvent, key: SortKey) => void;
  children: React.ReactNode;
}

const SortableTh: React.FC<SortableThProps> = ({ sortKey, sortConfig, onSort, className, style, resizable, resizeTarget, onResizeStart, children }) => {
  const isActive = sortConfig?.key === sortKey;
  return (
    <th
      data-sort-key={sortKey}
      className={cn(className, "cursor-pointer select-none hover:bg-slate-100/80 transition-colors relative")}
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
      {resizable && (
        <div
          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/40 z-10"
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart?.(e, resizeTarget ?? sortKey); }}
        />
      )}
    </th>
  );
};

// 스크롤 영역 열 기본 너비
const DEFAULT_COL_WIDTHS: Record<string, number> = {
  createdDate: 62, originalDueDate: 62, changedDueDate: 62,
  orderQuantity: 78, totalQuantity: 72, remainingQuantity: 72,
  productionCompleteDate: 76, materialSettingDate: 68,
  productionRequestYn: 62, mfg1: 72,
  manufacturingDate: 68, packagingDate: 200, productionSite: 82,
  revenuePossible: 68, revenuePossibleQuantity: 100,
  progressRate: 58, delayReason: 62,
  unitPrice: 68, revenue: 80, note: 80,
};

export const DataTable: React.FC<DataTableProps> = ({ items, editData, onUpdateField, onSave, onSnapshot, snapshotStatus = 'idle', saveStatus, isAdmin, readOnly, hasFilter, delayedIds, children }) => {
  const [showDelayOnly, setShowDelayOnly] = useState(false);
  const [activeTier, setActiveTier] = useState<Tier>('전체');
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; key: SortKey } | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({ ...DEFAULT_COL_WIDTHS });

  const handleResizeStart = useCallback((e: React.MouseEvent, key: SortKey) => {
    const startX = e.clientX;
    const startW = colWidths[key] || DEFAULT_COL_WIDTHS[key] || 60;
    const onMove = (me: MouseEvent) => {
      const newW = Math.max(36, startW + me.clientX - startX);
      setColWidths(prev => ({ ...prev, [key]: newW }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [colWidths]);

  // editData ref: 정렬/필터 내부에서 참조하되, 변경 시 재정렬을 트리거하지 않음
  const editDataRef = useRef(editData);
  editDataRef.current = editData;

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' ? { key, direction: 'desc' } : { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const autoTierMap = useMemo(() => buildTierMap(items), [items]);

  // importance 값만 추적하여, 다른 필드 편집 시 불필요한 필터/정렬 재실행 방지
  const importanceKey = useMemo(() => {
    const parts: string[] = [];
    for (const [id, d] of Object.entries(editData)) {
      if (d?.importance) parts.push(`${id}:${d.importance}`);
    }
    return parts.join(',');
  }, [editData]);

  // 수동 importance 우선, 없으면 자동 계산값
  const getTier = useCallback((item: DashboardItem): '상' | '중' | '하' => {
    const manual = editDataRef.current[item.id]?.importance;
    if (manual === '상' || manual === '중' || manual === '하') return manual;
    return autoTierMap[item.id];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importanceKey, autoTierMap]);

  const handleExcelDownload = useCallback(() => {
    const rows = items.map((item) => {
      const row = editData[item.id];
      const tier = getTier(item);
      const rate = item.remainingQuantity > 0
        ? ((row?.revenuePossibleQuantity || 0) / item.remainingQuantity) * 100
        : 0;

      return {
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

  const delayCount = useMemo(() => {
    if (!delayedIds) return 0;
    return items.filter(item => delayedIds.has(item.id)).length;
  }, [items, delayedIds]);

  const filteredItems = useMemo(() => {
    let result = activeTier === '전체' ? items : items.filter(item => getTier(item) === activeTier);
    if (showDelayOnly && delayedIds) {
      result = result.filter(item => delayedIds.has(item.id));
    }
    return result;
  }, [items, getTier, activeTier, showDelayOnly, delayedIds]);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return filteredItems;
    const { key, direction } = sortConfig;
    const snapEditData = editDataRef.current;
    return [...filteredItems].sort((a, b) => {
      const aVal = getSortValue(a, snapEditData, key);
      const bVal = getSortValue(b, snapEditData, key);
      let cmp: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'ko');
      }
      return direction === 'asc' ? cmp : -cmp;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredItems, sortConfig]);

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
          {delayedIds && delayCount > 0 && (
            <button
              onClick={() => setShowDelayOnly(prev => !prev)}
              className={cn(
                "flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-[13px] sm:text-[15px] font-bold transition-all border shrink-0",
                showDelayOnly
                  ? "bg-red-600 text-white border-red-600 shadow-lg"
                  : "bg-white text-red-500 border-red-300 hover:bg-red-50",
              )}
            >
              ⚠️ 미회신
              <span className={cn(
                "text-[12px] sm:text-[14px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full min-w-[22px] sm:min-w-[26px] text-center",
                showDelayOnly ? "bg-white/25 text-white" : "bg-red-100 text-red-500",
              )}>
                {delayCount}
              </span>
            </button>
          )}
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
        <table className="text-left border-collapse min-w-[2900px]" style={{ tableLayout: 'fixed' }}>
          <thead className="bg-slate-50 border-b border-slate-200 sm:sticky sm:top-0 sm:z-30">
            <tr className="text-[13px] font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap" onContextMenu={handleHeaderContext}>
              <SortableTh sortKey="importance" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 text-center w-[44px] sm:sticky sm:left-0 sm:z-40 bg-slate-50 overflow-hidden">중요도</SortableTh>
              <SortableTh sortKey="cisManager" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[44px] sm:z-40 bg-slate-50 overflow-hidden">CIS담당</SortableTh>
              <SortableTh sortKey="purchaseManager" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 border-r border-slate-200 sm:sticky sm:left-[102px] sm:z-40 bg-indigo-50 text-indigo-600 overflow-hidden">구매담당</SortableTh>
              <SortableTh sortKey="category" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[160px] sm:z-40 bg-slate-50 overflow-hidden">중분류</SortableTh>
              <SortableTh sortKey="customerCode" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[230px] sm:z-40 bg-slate-50 overflow-hidden">고객약호</SortableTh>
              <SortableTh sortKey="materialCode" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r border-slate-200 sm:sticky sm:left-[292px] sm:z-40 bg-slate-50 overflow-hidden">자재</SortableTh>
              <SortableTh sortKey="itemName" sortConfig={sortConfig} onSort={handleSort} className="px-2 py-2 border-r-2 border-slate-300 sm:sticky sm:left-[402px] sm:z-40 bg-slate-50 overflow-hidden" style={{ boxShadow: '6px 0 12px -2px rgba(0,0,0,0.12)' }}>내역</SortableTh>

              <SortableTh sortKey="createdDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="originalDueDate" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-center" style={{ width: colWidths.createdDate }}>생성일</SortableTh>
              <SortableTh sortKey="originalDueDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="changedDueDate" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-center" style={{ width: colWidths.originalDueDate }}>원납기일</SortableTh>
              <SortableTh sortKey="changedDueDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="orderQuantity" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-center" style={{ width: colWidths.changedDueDate }}>변경납기일</SortableTh>
              <SortableTh sortKey="orderQuantity" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="totalQuantity" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-right" style={{ width: colWidths.orderQuantity }}>총오더수량</SortableTh>
              <SortableTh sortKey="totalQuantity" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="remainingQuantity" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-right" style={{ width: colWidths.totalQuantity }}>환산수량</SortableTh>
              <SortableTh sortKey="remainingQuantity" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="productionCompleteDate" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-right" style={{ width: colWidths.remainingQuantity }}>미납잔량</SortableTh>
              <SortableTh sortKey="productionCompleteDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="materialSettingDate" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600" style={{ width: colWidths.productionCompleteDate }}>생산완료<br/>요청일</SortableTh>
              <SortableTh sortKey="materialSettingDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="productionRequestYn" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600" style={{ width: colWidths.materialSettingDate }}>부자재</SortableTh>
              <SortableTh sortKey="productionRequestYn" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="mfg1" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-center" style={{ width: colWidths.productionRequestYn }}>제조<br/>요청여부</SortableTh>
              <SortableTh sortKey="mfg1" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="manufacturingDate" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-center" style={{ width: colWidths.mfg1 }}>현재<br/>제조계획</SortableTh>
              <SortableTh sortKey="manufacturingDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="packagingDate" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600" style={{ width: colWidths.manufacturingDate }}>제조</SortableTh>
              <SortableTh sortKey="packagingDate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="productionSite" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600" style={{ width: colWidths.packagingDate }}>충포장</SortableTh>
              <SortableTh sortKey="productionSite" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="revenuePossible" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600" style={{ width: colWidths.productionSite }}>생산처</SortableTh>
              <SortableTh sortKey="revenuePossible" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="revenuePossibleQuantity" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-emerald-50/50 text-emerald-600" style={{ width: colWidths.revenuePossible }}>매출<br/>가능여부</SortableTh>
              <SortableTh sortKey="revenuePossibleQuantity" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="progressRate" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-emerald-50/50 text-emerald-600" style={{ width: colWidths.revenuePossibleQuantity }}>매출<br/>가능수량</SortableTh>
              <SortableTh sortKey="progressRate" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="delayReason" onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-amber-50/50 text-amber-600" style={{ width: colWidths.progressRate }}>진도율</SortableTh>
              <SortableTh sortKey="delayReason" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget={isAdmin ? "unitPrice" : "revenue"} onResizeStart={handleResizeStart} className="px-1 py-2 border-r border-slate-200 text-center bg-amber-50/50 text-amber-600" style={{ width: colWidths.delayReason }}>지연<br/>사유</SortableTh>
              {isAdmin && <SortableTh sortKey="unitPrice" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="revenue" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-right" style={{ width: colWidths.unitPrice }}>단가</SortableTh>}
              <SortableTh sortKey="revenue" sortConfig={sortConfig} onSort={handleSort} resizable resizeTarget="note" onResizeStart={handleResizeStart} className="px-2 py-2 border-r border-slate-200 text-right" style={{ width: colWidths.revenue }}>매출<br/>(단가x잔량)</SortableTh>
              <SortableTh sortKey="note" sortConfig={sortConfig} onSort={handleSort} className="px-1 py-2 text-center" style={{ width: colWidths.note }}>비고</SortableTh>
            </tr>
          </thead>
          {hasFilter && (
            <tbody>
              <tr className="bg-indigo-50/80 font-extrabold text-slate-800 text-[15px] border-b-2 border-indigo-200">
                <td className="px-3 py-3 border-r border-indigo-100 text-center text-[14px] text-indigo-500 sm:sticky sm:left-0 sm:z-20 bg-indigo-50/80">합계</td>
                <td className="px-4 py-3 border-r border-indigo-100 sm:sticky sm:left-[44px] sm:z-20 bg-indigo-50/80"></td>
                <td className="px-4 py-3 border-r border-indigo-100 sm:sticky sm:left-[102px] sm:z-20 bg-indigo-50/80"></td>
                <td className="px-4 py-3 border-r border-indigo-100 sm:sticky sm:left-[160px] sm:z-20 bg-indigo-50/80"></td>
                <td className="px-4 py-3 border-r border-indigo-100 sm:sticky sm:left-[230px] sm:z-20 bg-indigo-50/80"></td>
                <td className="px-4 py-3 border-r border-indigo-100 sm:sticky sm:left-[292px] sm:z-20 bg-indigo-50/80"></td>
                <td className="px-4 py-3 border-r-2 border-indigo-200 sm:sticky sm:left-[402px] sm:z-20 bg-indigo-50/80 text-right" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>검색 합계 ({sortedItems.length}건)</td>
                <td colSpan={3} className="px-4 py-3 text-right border-r border-indigo-100"></td>
                <td className="px-4 py-3 text-right border-r border-indigo-100">{totals.orderQuantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right border-r border-indigo-100">{totals.totalQuantity.toLocaleString()}</td>
                <td className="px-4 py-3 text-right border-r border-indigo-100">{totals.remainingQuantity.toLocaleString()}</td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 text-right border-r border-indigo-100">{totalRevenuePossibleQty.toLocaleString()}</td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                <td className="px-4 py-3 border-r border-indigo-100"></td>
                {isAdmin && <td className="px-4 py-3 border-r border-indigo-100"></td>}
                <td className="px-4 py-3 border-r border-indigo-100 text-right">{formatCurrency(totals.revenue)}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tbody>
          )}
          <tbody className="text-[15px]">
            {/* 가상화: 전체 높이를 확보하는 빈 행 (상단 패딩) */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
                <td colSpan={isAdmin ? 26 : 25} />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = sortedItems[virtualRow.index];
              const row = editData[item.id];
              const rate = getProgressRate(item, editData);
              const tier = getTier(item);
              const color = TIER_COLORS[tier];
              const delayed = delayedIds?.has(item.id) ?? false;

              return (
                <tr
                  key={item.id}
                  data-index={virtualRow.index}
                  className={cn("hover:bg-slate-50 transition-colors border-b border-slate-100", delayed && "!bg-red-50/60 hover:!bg-red-100/60")}
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
                    isDelayed={delayed}
                    onUpdateField={onUpdateField}
                  />
                </tr>
              );
            })}
            {/* 가상화: 하단 패딩 */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end) }}>
                <td colSpan={isAdmin ? 26 : 25} />
              </tr>
            )}
          </tbody>
          <tfoot className={cn("sm:sticky sm:bottom-0 sm:z-25 border-t-2 border-slate-300", hasFilter && "hidden")}>
            <tr className="bg-slate-100 font-extrabold text-slate-800 text-[15px]">
              <td className="px-3 py-3 border-r border-slate-200 text-center text-[14px] text-slate-500 sm:sticky sm:left-0 sm:z-20 bg-slate-100">합계</td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[44px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[102px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[160px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[230px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sm:sticky sm:left-[292px] sm:z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r-2 border-slate-300 sm:sticky sm:left-[402px] sm:z-20 bg-slate-100 text-right" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>전체 합계 ({sortedItems.length}건)</td>
              <td colSpan={3} className="px-4 py-3 text-right border-r border-slate-200"></td>
              <td className="px-4 py-3 text-right border-r border-slate-200">{totals.orderQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right border-r border-slate-200">{totals.totalQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right border-r border-slate-200">{totals.remainingQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 text-right border-r border-slate-200">{totalRevenuePossibleQty.toLocaleString()}</td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              <td className="px-4 py-3 border-r border-slate-200"></td>
              {isAdmin && <td className="px-4 py-3 border-r border-slate-200"></td>}
              <td className="px-4 py-3 border-r border-slate-200 text-right">{formatCurrency(totals.revenue)}</td>
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
