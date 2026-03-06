import React, { useCallback, useState, useMemo, useRef, useEffect } from 'react';
import { Save, Check } from 'lucide-react';
import { DashboardItem, EditableData } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency, cn } from '../lib/utils';

interface DataTableProps {
  items: DashboardItem[];
  editData: Record<string, EditableData>;
  onUpdateField: (id: string, field: keyof EditableData, value: string | number) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saved' | 'loading';
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

export const DataTable: React.FC<DataTableProps> = ({ items, editData, onUpdateField, onSave, saveStatus }) => {
  const [activeTier, setActiveTier] = useState<Tier>('전체');

  const tierMap = useMemo(() => buildTierMap(items), [items]);

  const tierCounts = useMemo(() => {
    const counts = { '상': 0, '중': 0, '하': 0 };
    items.forEach(item => { counts[tierMap[item.id]]++; });
    return counts;
  }, [items, tierMap]);

  const filteredItems = useMemo(() => {
    if (activeTier === '전체') return items;
    return items.filter(item => tierMap[item.id] === activeTier);
  }, [items, tierMap, activeTier]);

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

  const inputClass = "w-full px-2 py-2.5 bg-white border border-slate-200 rounded-lg text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

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
      </div>

      {/* 기준 안내 */}
      <div className="px-8 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-4 text-[13px] text-slate-400 font-medium">
        <span>중요도 기준:</span>
        <span className="flex items-center gap-1"><span style={{ color: '#e8354a' }}>●</span> 상: 상위 40%</span>
        <span className="flex items-center gap-1"><span style={{ color: '#d4880a' }}>●</span> 중: 중간 30%</span>
        <span className="flex items-center gap-1"><span style={{ color: '#16a34a' }}>●</span> 하: 하위 30%</span>
      </div>

      {/* 상단 스크롤바 */}
      <div ref={topScrollRef} className="overflow-x-auto" style={{ height: '16px' }}>
        <div style={{ width: '2800px', height: '1px' }} />
      </div>

      <div ref={tableScrollRef} className="overflow-auto max-h-[75vh]">
        <table className="w-full text-left border-collapse min-w-[2800px]">
          <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
            <tr className="text-[14px] font-bold text-slate-500 uppercase tracking-tight">
              <th className="px-3 py-3 border-r border-slate-200 text-center w-[70px]">중요도</th>
              <th className="px-4 py-3 border-r border-slate-200">판매문서</th>
              <th className="px-4 py-3 border-r border-slate-200">자재</th>
              <th className="px-4 py-3 border-r border-slate-200">내역</th>
              <th className="px-4 py-3 border-r border-slate-200">중분류명</th>
              <th className="px-4 py-3 border-r border-slate-200">생성일</th>
              <th className="px-4 py-3 border-r border-slate-200">원납기일</th>
              <th className="px-4 py-3 border-r border-slate-200">변경납기일</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">환산수량</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">총오더수량</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">미납잔량</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600">생산완료<br/>요청일</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600">자재</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600">제조</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-indigo-50/50 text-indigo-600">충포장</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-emerald-50/50 text-emerald-600">매출<br/>가능여부</th>
              <th className="px-3 py-3 border-r border-slate-200 text-right bg-emerald-50/50 text-emerald-600">매출<br/>가능 수량</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-amber-50/50 text-amber-600">진도율</th>
              <th className="px-3 py-3 border-r border-slate-200 text-center bg-amber-50/50 text-amber-600">지연사유</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">단가</th>
              <th className="px-4 py-3 text-right">매출(단가x잔량)</th>
            </tr>
          </thead>
          <tbody className="text-[15px] divide-y divide-slate-100">
            {/* 전체 합계 */}
            <tr className="bg-blue-50/50 font-bold text-slate-700">
              <td className="px-3 py-3 border-r border-slate-200 text-center text-[14px] text-slate-400">합계</td>
              <td colSpan={6} className="px-4 py-2 text-right border-r border-slate-200">전체 합계</td>
              <td className="px-4 py-2 text-right border-r border-slate-200">{totals.totalQuantity.toLocaleString()}</td>
              <td className="px-4 py-2 text-right border-r border-slate-200">{totals.orderQuantity.toLocaleString()}</td>
              <td className="px-4 py-2 text-right border-r border-slate-200">{totals.remainingQuantity.toLocaleString()}</td>
              <td className="px-4 py-2 border-r border-slate-200 bg-indigo-50/30"></td>
              <td className="px-4 py-2 border-r border-slate-200 bg-indigo-50/30"></td>
              <td className="px-4 py-2 border-r border-slate-200 bg-indigo-50/30"></td>
              <td className="px-4 py-2 border-r border-slate-200 bg-indigo-50/30"></td>
              <td className="px-4 py-2 border-r border-slate-200 bg-emerald-50/30"></td>
              <td className="px-4 py-2 text-right border-r border-slate-200 bg-emerald-50/30">{totalRevenuePossibleQty.toLocaleString()}</td>
              <td className="px-4 py-2 border-r border-slate-200 bg-amber-50/30"></td>
              <td className="px-4 py-2 border-r border-slate-200 bg-amber-50/30"></td>
              <td className="px-4 py-2 border-r border-slate-200"></td>
              <td className="px-4 py-2 text-right">{formatCurrency(totals.revenue)}</td>
            </tr>

            {filteredItems.map((item) => {
              const row = editData[item.id];
              const rate = getProgressRate(item, editData);
              const tier = tierMap[item.id];
              const color = TIER_COLORS[tier];

              return (
                <tr key={item.id} className="hover:brightness-95 transition-colors" style={{ backgroundColor: color.bg }}>
                  {/* 중요도 컬럼 */}
                  <td className="px-3 py-4 border-r border-slate-100/60 text-center">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[14px] font-bold"
                      style={{ color: color.text, backgroundColor: `${color.dot}15`, border: `1px solid ${color.dot}30` }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.dot }} />
                      {tier}
                    </span>
                  </td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-slate-600">{item.salesDocument}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 font-bold text-slate-700">{item.materialCode}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60">
                    <div className="max-w-[300px] truncate font-medium text-slate-800" title={item.itemName}>{item.itemName}</div>
                  </td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-slate-600">{item.category}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-slate-500">{item.createdDate}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-slate-500">{item.originalDueDate}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-slate-500">{item.changedDueDate}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-right text-slate-600">{item.totalQuantity.toLocaleString()}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-right text-slate-600">{item.orderQuantity.toLocaleString()}</td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-right font-bold text-slate-900">{item.remainingQuantity.toLocaleString()}</td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="text" placeholder="직접입력" className={inputClass} value={row?.productionCompleteDate ?? ''} onChange={(e) => onUpdateField(item.id, 'productionCompleteDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="text" placeholder="직접입력" className={inputClass} value={row?.materialSettingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'materialSettingDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="text" placeholder="직접입력" className={inputClass} value={row?.manufacturingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'manufacturingDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="text" placeholder="직접입력" className={inputClass} value={row?.packagingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'packagingDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-emerald-50/20 text-center">
                    <select
                      className={cn(inputClass, "text-center appearance-none cursor-pointer",
                        row?.revenuePossible === '가능' && "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
                        row?.revenuePossible === '확인중' && "bg-amber-50 text-amber-700 border-amber-300 font-bold",
                        row?.revenuePossible === '불가능' && "bg-rose-50 text-rose-700 border-rose-300 font-bold",
                      )}
                      value={row?.revenuePossible ?? ''}
                      onChange={(e) => onUpdateField(item.id, 'revenuePossible', e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="가능">가능</option>
                      <option value="확인중">확인중</option>
                      <option value="불가능">불가능</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-emerald-50/20">
                    <input type="number" className={cn(inputClass, "text-right")} value={row?.revenuePossibleQuantity ?? item.remainingQuantity} min={0} onChange={(e) => onUpdateField(item.id, 'revenuePossibleQuantity', Number(e.target.value))} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-amber-50/20 text-center">
                    <span className="text-[14px] font-bold" style={{ color: color.text }}>
                      {rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-amber-50/20 text-center">
                    <select
                      className={cn(inputClass, "text-center appearance-none cursor-pointer",
                        row?.delayReason && "font-bold text-amber-700 bg-amber-50 border-amber-300",
                      )}
                      value={row?.delayReason ?? ''}
                      onChange={(e) => onUpdateField(item.id, 'delayReason', e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="구매">구매</option>
                      <option value="품질">품질</option>
                      <option value="연구소">연구소</option>
                      <option value="물류">물류</option>
                      <option value="영업">영업</option>
                    </select>
                  </td>
                  <td className="px-4 py-4 border-r border-slate-100/60 text-right text-slate-500">{item.unitPrice.toLocaleString()}</td>
                  <td className="px-4 py-4 text-right font-bold text-slate-900">{formatCurrency(getRevenue(item))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
