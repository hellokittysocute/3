import React from 'react';
import { DashboardItem } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DataTableProps {
  items: DashboardItem[];
}

export const DataTable: React.FC<DataTableProps> = ({ items }) => {
  const totals = React.useMemo(() => {
    return items.reduce((acc, item) => ({
      totalQuantity: acc.totalQuantity + item.totalQuantity,
      orderQuantity: acc.orderQuantity + item.orderQuantity,
      originalOrderQuantity: acc.originalOrderQuantity + item.originalOrderQuantity,
      remainingQuantity: acc.remainingQuantity + item.remainingQuantity,
      revenue: acc.revenue + item.revenue,
    }), { totalQuantity: 0, orderQuantity: 0, originalOrderQuantity: 0, remainingQuantity: 0, revenue: 0 });
  }, [items]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1800px]">
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
            <th className="px-4 py-3 border-r border-slate-200 text-right">단가</th>
            <th className="px-4 py-3 text-right">매출(변...)</th>
          </tr>
        </thead>
        <tbody className="text-[12px] divide-y divide-slate-100">
          {/* Summary Row */}
          <tr className="bg-blue-50/50 font-bold text-slate-700">
            <td colSpan={7} className="px-4 py-2 text-right border-r border-slate-200">전체 합계</td>
            <td className="px-4 py-2 text-right border-r border-slate-200">{totals.totalQuantity.toLocaleString()}</td>
            <td className="px-4 py-2 text-right border-r border-slate-200">{totals.orderQuantity.toLocaleString()}</td>
            <td className="px-4 py-2 text-right border-r border-slate-200">{totals.originalOrderQuantity.toLocaleString()}</td>
            <td className="px-4 py-2 text-right border-r border-slate-200">{totals.remainingQuantity.toLocaleString()}</td>
            <td className="px-4 py-2 border-r border-slate-200"></td>
            <td className="px-4 py-2 text-right">{formatCurrency(totals.revenue)}</td>
          </tr>
          {/* Sub-summary Row (Mocked like image) */}
          <tr className="bg-slate-50/30 font-bold text-slate-500 text-[11px]">
            <td colSpan={10} className="px-4 py-1 text-right border-r border-slate-200">팩 소계</td>
            <td className="px-4 py-1 text-right border-r border-slate-200">53.5%</td>
            <td className="px-4 py-1 border-r border-slate-200"></td>
            <td className="px-4 py-1"></td>
          </tr>
          
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
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
              <td className="px-4 py-3 border-r border-slate-100/60 text-right text-slate-500">{item.unitPrice.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(item.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
