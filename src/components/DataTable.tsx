import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Save, Check, Download, Camera } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as XLSX from 'xlsx';
import { DashboardItem, EditableData } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency, cn } from '../lib/utils';

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  // "m/d", "mm/dd", "mm/d", "m/dd" 형식 → 앞의 0 제거
  const slashMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (slashMatch) return `${Number(slashMatch[1])}/${Number(slashMatch[2])}`;
  // "mm.dd", "m.dd" 형식
  const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (dotMatch) return `${Number(dotMatch[1])}/${Number(dotMatch[2])}`;
  // "03월18일", "3월18일" 형식
  const korMatch = dateStr.match(/(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) return `${Number(korMatch[1])}/${Number(korMatch[2])}`;
  // ISO or standard date → Date 파싱
  const d = new Date(dateStr);
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
  const qty = editData[item.id]?.revenuePossibleQuantity ?? item.remainingQuantity;
  return item.remainingQuantity > 0 ? (qty / item.remainingQuantity) * 100 : 0;
}

const TIER_COLORS = {
  '상': { dot: '#e8354a', bg: 'rgba(232,53,74,0.08)', text: '#e8354a', border: '#e8354a' },
  '중': { dot: '#d4880a', bg: 'rgba(212,136,10,0.08)', text: '#d4880a', border: '#d4880a' },
  '하': { dot: '#16a34a', bg: 'rgba(22,163,74,0.08)', text: '#16a34a', border: '#16a34a' },
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
  onUpdateField: (id: string, field: keyof EditableData, value: string | number) => void;
}

const TableRow = React.memo<TableRowProps>(({ item, row, tier, color, rate, isAdmin, readOnly, onUpdateField }) => {
  return (
    <>
      {/* 중요도 컬럼 - 드롭다운 (고정) */}
      <td className="px-1 py-1 border-r border-slate-100/60 text-center sticky left-0 z-20 bg-white" style={{ backgroundColor: color.bg }}>
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
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sticky left-[44px] z-20 whitespace-nowrap bg-white">{item.cisManager}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sticky left-[102px] z-20 whitespace-nowrap bg-white">{row?.purchaseManager ?? ''}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sticky left-[160px] z-20 whitespace-nowrap bg-white">{item.category}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sticky left-[230px] z-20 whitespace-nowrap bg-white">{item.customerCode}</td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] sticky left-[292px] z-20 bg-white">{item.materialCode}</td>
      <td className="px-2 py-1 border-r-2 border-slate-300 sticky left-[402px] z-20 bg-white" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>
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
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.materialSettingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'materialSettingDate', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-2 py-1 border-r border-slate-100/60 text-slate-500 text-[13px] whitespace-nowrap">{formatDateShort(item.mfg1)}</td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.manufacturingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'manufacturingDate', e.target.value)} disabled={readOnly} />
      </td>
      <td className="px-1 py-1 border-r border-slate-100/60 bg-indigo-50/20">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.packagingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'packagingDate', e.target.value)} disabled={readOnly} />
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
        <input type="text" className={cn(INPUT_CLASS, "text-right text-[13px]")} value={(row?.revenuePossibleQuantity ?? item.remainingQuantity).toLocaleString()} onChange={(e) => { const num = Number(e.target.value.replace(/,/g, '')); if (!isNaN(num)) onUpdateField(item.id, 'revenuePossibleQuantity', num); }} disabled={readOnly} />
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
      {isAdmin && <td className="px-2 py-1 border-r border-slate-100/60 text-right font-bold text-slate-900 text-[13px]">{formatCurrency(getRevenue(item))}</td>}
      <td className="px-1 py-1">
        <input type="text" placeholder="입력" className={cn(INPUT_CLASS, "text-[13px]")} value={row?.note ?? ''} onChange={(e) => onUpdateField(item.id, 'note', e.target.value)} disabled={readOnly} />
      </td>
    </>
  );
});

const ROW_HEIGHT = 40;

export const DataTable: React.FC<DataTableProps> = ({ items, editData, onUpdateField, onSave, onSnapshot, snapshotStatus = 'idle', saveStatus, isAdmin, readOnly, children }) => {
  const [activeTier, setActiveTier] = useState<Tier>('전체');

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
        ? ((row?.revenuePossibleQuantity ?? item.remainingQuantity) / item.remainingQuantity) * 100
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
        '현재제조': item.mfg1,
        '부자재(일정)': row?.materialSettingDate ?? '',
        '제조': row?.manufacturingDate ?? '',
        '충포장': row?.packagingDate ?? '',
        '생산처': row?.productionSite ?? '',
        '매출 가능여부': row?.revenuePossible ?? '',
        '매출 가능 수량': row?.revenuePossibleQuantity ?? item.remainingQuantity,
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

  const filteredItems = useMemo(() => {
    if (activeTier === '전체') return items;
    return items.filter(item => getTier(item) === activeTier);
  }, [items, getTier, activeTier]);

  const totals = useMemo(() => {
    return filteredItems.reduce((acc, item) => ({
      totalQuantity: acc.totalQuantity + item.totalQuantity,
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      deliveredQuantity: acc.deliveredQuantity + item.deliveredQuantity,
      remainingQuantity: acc.remainingQuantity + item.remainingQuantity,
      revenue: acc.revenue + getRevenue(item),
      originalOrderQuantity: acc.originalOrderQuantity + (item.orderQuantity || 0),
    }), { totalQuantity: 0, orderQuantity: 0, deliveredQuantity: 0, remainingQuantity: 0, revenue: 0, originalOrderQuantity: 0 });
  }, [filteredItems]);

  const totalRevenuePossibleQty = useMemo(() => {
    return filteredItems.reduce((sum, item) => sum + (editData[item.id]?.revenuePossibleQuantity ?? item.remainingQuantity), 0);
  }, [filteredItems, editData]);

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

  // 가상화 설정
  const rowVirtualizer = useVirtualizer({
    count: filteredItems.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div>
      {/* 필터 탭 + 저장 버튼 */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          {tabs.map(tab => {
            const isActive = activeTier === tab.key;
            const count = tab.key === '전체' ? items.length : tierCounts[tab.key as '상' | '중' | '하'];
            const color = tab.key !== '전체' ? TIER_COLORS[tab.key as '상' | '중' | '하'] : null;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTier(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[15px] font-bold transition-all border",
                  isActive && tab.key === '전체' && "bg-slate-900 text-white border-slate-900 shadow-lg",
                  isActive && tab.key !== '전체' && "text-white shadow-lg",
                  !isActive && "bg-white text-slate-500 border-slate-200 hover:bg-slate-50",
                )}
                style={isActive && color ? { backgroundColor: color.border, borderColor: color.border } : undefined}
              >
                {tab.emoji && <span className="text-[14px]">{tab.emoji}</span>}
                {tab.label}
                <span
                  className={cn(
                    "text-[14px] font-bold px-2 py-0.5 rounded-full min-w-[26px] text-center",
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

        <div className="flex items-center gap-3">
          <button
            onClick={handleExcelDownload}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 shadow-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200"
          >
            <Download className="w-4 h-4" /> 다운로드
          </button>
          {onSnapshot && (
            <button
              onClick={onSnapshot}
              disabled={snapshotStatus === 'saving'}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 shadow-lg",
                snapshotStatus === 'saved'
                  ? "bg-indigo-500 text-white shadow-indigo-200"
                  : snapshotStatus === 'saving'
                  ? "bg-indigo-300 text-white shadow-indigo-100 cursor-wait"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
              )}
            >
              <Camera className="w-4 h-4" />
              {snapshotStatus === 'saved' ? '저장 완료' : snapshotStatus === 'saving' ? '저장 중...' : '스냅샷'}
            </button>
          )}
          {!readOnly && (
            <button
              onClick={onSave}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-[15px] font-bold transition-all duration-300 shadow-lg",
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
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-30">
            <tr className="text-[13px] font-bold text-slate-500 uppercase tracking-tight whitespace-nowrap">
              <th className="px-1 py-2 border-r border-slate-200 text-center w-[44px] sticky left-0 z-40 bg-slate-50">중요도</th>
              <th className="px-2 py-2 border-r border-slate-200 sticky left-[44px] z-40 bg-slate-50">CIS담당</th>
              <th className="px-1 py-2 border-r border-slate-200 sticky left-[102px] z-40 bg-slate-50 text-center bg-indigo-50/50 text-indigo-600">구매담당</th>
              <th className="px-2 py-2 border-r border-slate-200 sticky left-[160px] z-40 bg-slate-50">중분류</th>
              <th className="px-2 py-2 border-r border-slate-200 sticky left-[230px] z-40 bg-slate-50">고객약호</th>
              <th className="px-2 py-2 border-r border-slate-200 sticky left-[292px] z-40 bg-slate-50">자재</th>
              <th className="px-2 py-2 border-r-2 border-slate-300 sticky left-[402px] z-40 bg-slate-50" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>내역</th>

              <th className="px-2 py-2 border-r border-slate-200 w-[62px] text-center">생성일</th>
              <th className="px-2 py-2 border-r border-slate-200 w-[62px] text-center">원납기일</th>
              <th className="px-2 py-2 border-r border-slate-200 w-[62px] text-center">변경납기일</th>
              <th className="px-2 py-2 border-r border-slate-200 text-right w-[78px]">총오더수량</th>
              <th className="px-2 py-2 border-r border-slate-200 text-right w-[72px]">환산수량</th>
              <th className="px-2 py-2 border-r border-slate-200 text-right w-[72px]">미납잔량</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600 w-[76px]">생산완료<br/>요청일</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600 w-[68px]">부자재</th>
              <th className="px-2 py-2 border-r border-slate-200 text-center w-[62px]">현재제조</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600 w-[68px]">제조</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600 w-[200px]">충포장</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600 w-[82px]">생산처</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-emerald-50/50 text-emerald-600">매출<br/>가능여부</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-emerald-50/50 text-emerald-600 w-[100px]">매출<br/>가능수량</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-amber-50/50 text-amber-600">진도율</th>
              <th className="px-1 py-2 border-r border-slate-200 text-center bg-amber-50/50 text-amber-600">지연<br/>사유</th>
              {isAdmin && <th className="px-2 py-2 border-r border-slate-200 text-right">단가</th>}
              {isAdmin && <th className="px-2 py-2 border-r border-slate-200 text-right">매출<br/>(단가x잔량)</th>}
              <th className="px-1 py-2 text-center">비고</th>
            </tr>
          </thead>
          <tbody className="text-[15px]">
            {/* 가상화: 전체 높이를 확보하는 빈 행 (상단 패딩) */}
            {rowVirtualizer.getVirtualItems().length > 0 && (
              <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }}>
                <td colSpan={isAdmin ? 25 : 23} />
              </tr>
            )}
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const item = filteredItems[virtualRow.index];
              const row = editData[item.id];
              const rate = getProgressRate(item, editData);
              const tier = getTier(item);
              const color = TIER_COLORS[tier];

              return (
                <tr
                  key={item.id}
                  data-index={virtualRow.index}
                  className="hover:bg-slate-50 transition-colors border-b border-slate-100"
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
                <td colSpan={isAdmin ? 25 : 23} />
              </tr>
            )}
          </tbody>
          <tfoot className="sticky bottom-0 z-25 border-t-2 border-slate-300">
            <tr className="bg-slate-100 font-extrabold text-slate-800 text-[15px]">
              <td className="px-3 py-3 border-r border-slate-200 text-center text-[14px] text-slate-500 sticky left-0 z-20 bg-slate-100">합계</td>
              <td className="px-4 py-3 border-r border-slate-200 sticky left-[44px] z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sticky left-[102px] z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sticky left-[160px] z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sticky left-[230px] z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r border-slate-200 sticky left-[292px] z-20 bg-slate-100"></td>
              <td className="px-4 py-3 border-r-2 border-slate-300 sticky left-[402px] z-20 bg-slate-100 text-right" style={{ boxShadow: '4px 0 8px -2px rgba(0,0,0,0.08)' }}>전체 합계</td>
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
              {isAdmin && <td className="px-4 py-3 border-r border-slate-200 text-right">{formatCurrency(totals.revenue)}</td>}
              <td className="px-4 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
