import React from 'react';
import { DashboardItem } from '../types';
import { formatCurrency, cn } from '../lib/utils';

interface DataTableProps {
  items: DashboardItem[];
}

export const DataTable: React.FC<DataTableProps> = ({ items }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1800px]">
        <thead className="bg-slate-50/50 border-b border-slate-200/60">
          <tr>
            <th className="px-6 py-5 sticky left-0 bg-slate-50/50 z-10 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</span>
            </th>
            <th className="px-6 py-5 text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Qty</span>
            </th>
            <th className="px-6 py-5 text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Order Qty</span>
            </th>
            <th className="px-6 py-5 text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delivered</span>
            </th>
            <th className="px-6 py-5 text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Remaining</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">CIS Mgr</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sales Mgr</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date</span>
            </th>
            <th className="px-6 py-5 text-right">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Revenue</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mat 1st</span>
            </th>
            <th className="px-6 py-5 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Delay</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Production</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lead Time</span>
            </th>
            <th className="px-6 py-5 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</span>
            </th>
            <th className="px-6 py-5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</span>
            </th>
          </tr>
        </thead>
        <tbody className="text-sm divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
              <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50/50 z-10 border-r border-slate-100/60">
                <span className="font-black text-slate-900 tracking-tighter">{item.customerCode}</span>
              </td>
              <td className="px-6 py-4">
                <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{item.materialCode}</span>
              </td>
              <td className="px-6 py-4">
                <div className="max-w-[250px] truncate font-semibold text-slate-700" title={item.itemName}>{item.itemName}</div>
              </td>
              <td className="px-6 py-4 text-right font-medium text-slate-400">{item.totalQuantity.toLocaleString()}</td>
              <td className="px-6 py-4 text-right font-medium text-slate-400">{item.orderQuantity.toLocaleString()}</td>
              <td className="px-6 py-4 text-right font-medium text-slate-400">{item.deliveredQuantity.toLocaleString()}</td>
              <td className="px-6 py-4 text-right">
                <span className="font-black text-slate-900 tracking-tight">{item.remainingQuantity.toLocaleString()}</span>
              </td>
              <td className="px-6 py-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.teamName}</span>
              </td>
              <td className="px-6 py-4 text-xs font-bold text-slate-600">{item.cisManager}</td>
              <td className="px-6 py-4 text-xs font-bold text-slate-600">{item.salesManager}</td>
              <td className="px-6 py-4 text-xs font-bold text-slate-400">{item.changedDueDate}</td>
              <td className="px-6 py-4 text-right">
                <span className="font-black text-slate-900">{formatCurrency(item.revenue)}</span>
              </td>
              <td className="px-6 py-4">
                <span className={cn(
                  "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                  item.materialStatus === '세팅완료' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                )}>
                  {item.materialStatus || 'Pending'}
                </span>
              </td>
              <td className="px-6 py-4 text-center">
                <span className={cn(
                  "text-xs font-black tracking-tighter",
                  item.delayDays > 0 ? "text-rose-500" : "text-slate-300"
                )}>
                  {item.delayDays > 0 ? `+${item.delayDays}d` : '-'}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.productionSite || 'Unassigned'}</span>
              </td>
              <td className="px-6 py-4 text-xs font-bold text-slate-400">
                {item.leadTime ? `${item.leadTime} Days` : '-'}
              </td>
              <td className="px-6 py-4 text-center">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.1em]",
                  item.status === '가능' ? "bg-emerald-500 text-white" :
                  item.status === '확인중' ? "bg-amber-500 text-white" :
                  "bg-rose-500 text-white"
                )}>
                  {item.status}
                </span>
              </td>
              <td className="px-6 py-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 italic">
                  {item.delayReason || '-'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
