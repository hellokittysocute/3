import React from 'react';
import { DashboardItem } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency, cn } from '../lib/utils';

interface DataTableProps {
  items: DashboardItem[];
}

export const DataTable: React.FC<DataTableProps> = ({ items }) => {
  const totals = React.useMemo(() => {
    return items.reduce((acc, item) => ({
      totalQuantity: acc.totalQuantity + item.totalQuantity,
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      deliveredQuantity: acc.deliveredQuantity + item.deliveredQuantity,
      remainingQuantity: acc.remainingQuantity + item.remainingQuantity,
      revenue: acc.revenue + getRevenue(item),
    }), { totalQuantity: 0, orderQuantity: 0, deliveredQuantity: 0, remainingQuantity: 0, revenue: 0 });
  }, [items]);

  return (
    <div className="overflow-auto max-h-[75vh]">
      <table className="w-full text-left border-collapse min-w-[3400px]">
        <thead className="sticky top-0 z-20 backdrop-blur-md">
          {/* 전체 합계 행 */}
          <tr className="bg-blue-50 font-bold text-slate-700 text-[12px]">
            <th colSpan={5} className="px-3 py-2 text-right border-r border-slate-200 font-bold">전체 합계</th>
            <th className="px-3 py-2 text-right border-r border-slate-200 font-bold">{totals.totalQuantity.toLocaleString()}</th>
            <th className="px-3 py-2 text-right border-r border-slate-200 font-bold">{totals.orderQuantity.toLocaleString()}</th>
            <th className="px-3 py-2 text-right border-r border-slate-200 font-bold">{totals.deliveredQuantity.toLocaleString()}</th>
            <th className="px-3 py-2 text-right border-r border-slate-200 font-bold">{totals.remainingQuantity.toLocaleString()}</th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2 text-right border-r border-slate-200 font-bold">{formatCurrency(totals.revenue)}</th>
            <th className="px-3 py-2 border-r border-slate-200"></th>
            <th className="px-3 py-2"></th>
          </tr>
          {/* 컬럼 헤더 행 */}
          <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-tight bg-slate-50/80 border-b border-slate-200">
            <th className="px-3 py-3 border-r border-slate-200">고객약호</th>
            <th className="px-3 py-3 border-r border-slate-200">판매처</th>
            <th className="px-3 py-3 border-r border-slate-200">자재</th>
            <th className="px-3 py-3 border-r border-slate-200">내역</th>
            <th className="px-3 py-3 border-r border-slate-200">변경납기일</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">총본품수량</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">총오더수량</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">납품수량</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">미납잔량</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">단가</th>
            <th className="px-3 py-3 border-r border-slate-200">자재1차</th>
            <th className="px-3 py-3 border-r border-slate-200">1주차</th>
            <th className="px-3 py-3 border-r border-slate-200">2주차</th>
            <th className="px-3 py-3 border-r border-slate-200">3주차</th>
            <th className="px-3 py-3 border-r border-slate-200">제조1차</th>
            <th className="px-3 py-3 border-r border-slate-200">제조최종</th>
            <th className="px-3 py-3 border-r border-slate-200">충포장1차</th>
            <th className="px-3 py-3 border-r border-slate-200">충포장최종</th>
            <th className="px-3 py-3 border-r border-slate-200">생산처</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">생산리드타임</th>
            <th className="px-3 py-3 border-r border-slate-200 text-center">가능여부</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">지연일수</th>
            <th className="px-3 py-3 border-r border-slate-200">지연사유</th>
            <th className="px-3 py-3 border-r border-slate-200 text-right">매출(단가x잔량)</th>
            <th className="px-3 py-3 border-r border-slate-200">CIS담당</th>
            <th className="px-3 py-3">영업팀</th>
          </tr>
        </thead>
        <tbody className="text-[12px] divide-y divide-slate-100">
          {items.map((item) => {
            const statusColor = item.status === '가능'
              ? 'text-emerald-600 bg-emerald-50'
              : item.status === '불가능'
              ? 'text-rose-600 bg-rose-50'
              : 'text-amber-600 bg-amber-50';

            return (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-3 py-3 border-r border-slate-100/60 font-bold text-slate-700">{item.customerCode}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-600">
                  <div className="max-w-[140px] truncate" title={item.customerName}>{item.customerName}</div>
                </td>
                <td className="px-3 py-3 border-r border-slate-100/60 font-mono text-slate-700 text-[11px]">{item.materialCode}</td>
                <td className="px-3 py-3 border-r border-slate-100/60">
                  <div className="max-w-[250px] truncate font-medium text-slate-800" title={item.itemName}>{item.itemName}</div>
                </td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.changedDueDate}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.totalQuantity.toLocaleString()}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.orderQuantity.toLocaleString()}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.deliveredQuantity.toLocaleString()}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right font-bold text-slate-900">{item.remainingQuantity.toLocaleString()}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right text-slate-500">{item.unitPrice.toLocaleString()}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.materialStatus}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.week1}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.week2}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.week3}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.mfg1}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.mfgFinal}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.pkg1}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.pkgFinal}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-600">{item.productionSite}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.leadTime}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-center">
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', statusColor)}>
                    {item.status}
                  </span>
                </td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right text-slate-600">{item.delayDays || ''}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-500">{item.delayReason}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-right font-bold text-slate-900">{formatCurrency(getRevenue(item))}</td>
                <td className="px-3 py-3 border-r border-slate-100/60 text-slate-600">{item.cisManager}</td>
                <td className="px-3 py-3 text-slate-600">{item.teamName}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
