import React, { useCallback } from 'react';
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

export const DataTable: React.FC<DataTableProps> = ({ items, editData, onUpdateField, onSave, saveStatus }) => {
  const totals = React.useMemo(() => {
    return items.reduce((acc, item) => ({
      totalQuantity: acc.totalQuantity + item.totalQuantity,
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      deliveredQuantity: acc.deliveredQuantity + item.deliveredQuantity,
      remainingQuantity: acc.remainingQuantity + item.remainingQuantity,
      revenue: acc.revenue + getRevenue(item),
      originalOrderQuantity: acc.originalOrderQuantity + (item.orderQuantity || 0),
    }), { totalQuantity: 0, orderQuantity: 0, deliveredQuantity: 0, remainingQuantity: 0, revenue: 0, originalOrderQuantity: 0 });
  }, [items]);

  const totalRevenuePossibleQty = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (editData[item.id]?.revenuePossibleQuantity ?? item.remainingQuantity), 0);
  }, [items, editData]);

  const inputClass = "w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all";

  return (
    <div>
      {/* 저장 버튼 */}
      <div className="flex justify-end px-8 py-4 border-b border-slate-100">
        <button
          onClick={onSave}
          className={cn(
            "flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-lg",
            saveStatus === 'saved'
              ? "bg-emerald-500 text-white shadow-emerald-200"
              : "bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-200"
          )}
        >
          {saveStatus === 'saved' ? (
            <>
              <Check className="w-4 h-4" />
              저장 완료
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              저장
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[2700px]">
          <thead className="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
            <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              <th className="px-4 py-3 border-r border-slate-200">판매문서</th>
              <th className="px-4 py-3 border-r border-slate-200">자재</th>
              <th className="px-4 py-3 border-r border-slate-200">내역</th>
              <th className="px-4 py-3 border-r border-slate-200">중분류명</th>
              <th className="px-4 py-3 border-r border-slate-200">생성일</th>
              <th className="px-4 py-3 border-r border-slate-200">원납기일</th>
              <th className="px-4 py-3 border-r border-slate-200">변경납기일</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">총본품수량</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">총오더수량</th>
              <th className="px-4 py-3 border-r border-slate-200 text-right">원수주수량</th>
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
          <tbody className="text-[12px] divide-y divide-slate-100">
            {/* 전체 합계 */}
            <tr className="bg-blue-50/50 font-bold text-slate-700">
              <td colSpan={7} className="px-4 py-2 text-right border-r border-slate-200">전체 합계</td>
              <td className="px-4 py-2 text-right border-r border-slate-200">{totals.totalQuantity.toLocaleString()}</td>
              <td className="px-4 py-2 text-right border-r border-slate-200">{totals.orderQuantity.toLocaleString()}</td>
              <td className="px-4 py-2 text-right border-r border-slate-200">{totals.originalOrderQuantity.toLocaleString()}</td>
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

            {items.map((item) => {
              const row = editData[item.id];
              return (
                <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 border-r border-slate-100/60 text-slate-600">{item.salesDocument}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 font-bold text-slate-700">{item.materialCode}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60">
                    <div className="max-w-[300px] truncate font-medium text-slate-800" title={item.itemName}>{item.itemName}</div>
                  </td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-slate-600">{item.category}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-slate-500">{item.createdDate}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-slate-500">{item.originalDueDate}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-slate-500">{item.changedDueDate}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.totalQuantity.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.orderQuantity.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.originalOrderQuantity.toLocaleString()}</td>
                  <td className="px-4 py-3 border-r border-slate-100/60 text-right font-bold text-slate-900">{item.remainingQuantity.toLocaleString()}</td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="date" className={inputClass} value={row?.productionCompleteDate ?? ''} onChange={(e) => onUpdateField(item.id, 'productionCompleteDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="date" className={inputClass} value={row?.materialSettingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'materialSettingDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="date" className={inputClass} value={row?.manufacturingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'manufacturingDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-indigo-50/20">
                    <input type="date" className={inputClass} value={row?.packagingDate ?? ''} onChange={(e) => onUpdateField(item.id, 'packagingDate', e.target.value)} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-emerald-50/20 text-center">
                    <select
                      className={cn(inputClass, "text-center appearance-none cursor-pointer",
                        row?.revenuePossible === 'O' && "bg-emerald-50 text-emerald-700 border-emerald-300 font-bold",
                        row?.revenuePossible === 'X' && "bg-rose-50 text-rose-700 border-rose-300 font-bold",
                      )}
                      value={row?.revenuePossible ?? ''}
                      onChange={(e) => onUpdateField(item.id, 'revenuePossible', e.target.value)}
                    >
                      <option value="">선택</option>
                      <option value="O">O</option>
                      <option value="X">X</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-emerald-50/20">
                    <input type="number" className={cn(inputClass, "text-right")} value={row?.revenuePossibleQuantity ?? item.remainingQuantity} min={0} onChange={(e) => onUpdateField(item.id, 'revenuePossibleQuantity', Number(e.target.value))} />
                  </td>
                  <td className="px-2 py-2 border-r border-slate-100/60 bg-amber-50/20 text-center">
                    {(() => {
                      const qty = row?.revenuePossibleQuantity ?? item.remainingQuantity;
                      const rate = item.remainingQuantity > 0 ? (qty / item.remainingQuantity) * 100 : 0;
                      return (
                        <span className={cn("text-[11px] font-bold", rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-rose-600")}>
                          {rate.toFixed(1)}%
                        </span>
                      );
                    })()}
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
                  <td className="px-4 py-3 border-r border-slate-100/60 text-right text-slate-500">{item.unitPrice.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(getRevenue(item))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
