import React from 'react';
import { DashboardItem } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DataTableProps {
  items: DashboardItem[];
}

export const DataTable: React.FC<DataTableProps> = ({ items }) => {
  return (
    <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
      <table className="w-full text-left border-collapse min-w-[1500px]">
        <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3 border-b sticky left-0 bg-slate-50 z-10">고객사</th>
            <th className="px-4 py-3 border-b">자재</th>
            <th className="px-4 py-3 border-b">내역</th>
            <th className="px-4 py-3 border-b text-right">총본품수량</th>
            <th className="px-4 py-3 border-b text-right">총오더수량</th>
            <th className="px-4 py-3 border-b text-right">납품수량</th>
            <th className="px-4 py-3 border-b text-right">미납잔량</th>
            <th className="px-4 py-3 border-b">팀</th>
            <th className="px-4 py-3 border-b">CIS담당</th>
            <th className="px-4 py-3 border-b">영업담당</th>
            <th className="px-4 py-3 border-b">납기일</th>
            <th className="px-4 py-3 border-b text-right">매출(억)</th>
            <th className="px-4 py-3 border-b">자재 1차</th>
            <th className="px-4 py-3 border-b">1주차</th>
            <th className="px-4 py-3 border-b">2주차</th>
            <th className="px-4 py-3 border-b">3주차</th>
            <th className="px-4 py-3 border-b text-center">지연일수</th>
            <th className="px-4 py-3 border-b">제조 1차</th>
            <th className="px-4 py-3 border-b">제조 최종</th>
            <th className="px-4 py-3 border-b">충포장 1차</th>
            <th className="px-4 py-3 border-b">충포장 최종</th>
            <th className="px-4 py-3 border-b">생산처</th>
            <th className="px-4 py-3 border-b">리드타임</th>
            <th className="px-4 py-3 border-b text-center">3월매출가능여부</th>
            <th className="px-4 py-3 border-b">지연사유</th>
          </tr>
        </thead>
        <tbody className="text-sm text-slate-700 divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium sticky left-0 bg-white z-10 border-r border-slate-100">{item.customerCode}</td>
              <td className="px-4 py-3 font-mono text-xs">{item.materialCode}</td>
              <td className="px-4 py-3 truncate max-w-[200px]" title={item.itemName}>{item.itemName}</td>
              <td className="px-4 py-3 text-right">{item.totalQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">{item.orderQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right">{item.deliveredQuantity.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-medium text-slate-900">{item.remainingQuantity.toLocaleString()}</td>
              <td className="px-4 py-3">{item.teamName}</td>
              <td className="px-4 py-3">{item.cisManager}</td>
              <td className="px-4 py-3">{item.salesManager}</td>
              <td className="px-4 py-3">{item.changedDueDate}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.revenue)}</td>
              <td className="px-4 py-3">
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-medium",
                  item.materialStatus === '세팅완료' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-500 border border-slate-100"
                )}>
                  {item.materialStatus || '미정'}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">{item.week1 || '-'}</td>
              <td className="px-4 py-3 text-xs">{item.week2 || '-'}</td>
              <td className="px-4 py-3 text-xs">{item.week3 || '-'}</td>
              <td className="px-4 py-3 text-center text-xs font-mono">
                <span className={item.delayDays > 0 ? "text-red-500 font-bold" : "text-slate-400"}>
                  {item.delayDays}
                </span>
              </td>
              <td className="px-4 py-3 text-xs">{item.mfg1 || '-'}</td>
              <td className="px-4 py-3 text-xs">{item.mfgFinal || '-'}</td>
              <td className="px-4 py-3 text-xs">{item.pkg1 || '-'}</td>
              <td className="px-4 py-3 text-xs">{item.pkgFinal || '-'}</td>
              <td className="px-4 py-3 text-xs font-medium">{item.productionSite || '미지정'}</td>
              <td className="px-4 py-3 text-xs">{item.leadTime ? `${item.leadTime}일` : '-'}</td>
              <td className="px-4 py-3 text-center">
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-bold",
                  item.status === '가능' ? "bg-emerald-100 text-emerald-700" :
                  item.status === '확인중' ? "bg-amber-100 text-amber-700" :
                  "bg-red-100 text-red-700"
                )}>
                  {item.status}
                </span>
              </td>
              <td className="px-4 py-3 text-xs font-bold text-slate-600">
                {item.delayReason || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
