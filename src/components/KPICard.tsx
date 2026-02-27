import React from 'react';
import { cn, formatCurrency } from '@/src/lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  count: number;
  trend?: string;
  type: 'possible' | 'checking' | 'impossible' | 'default';
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, count, trend, type }) => {
  const colors = {
    possible: 'border-emerald-500 text-emerald-700 bg-emerald-50',
    checking: 'border-amber-500 text-amber-700 bg-amber-50',
    impossible: 'border-red-500 text-red-700 bg-red-50',
    default: 'border-slate-200 text-slate-700 bg-white'
  };

  const icons = {
    possible: '✅',
    checking: '❓',
    impossible: '❌',
    default: ''
  };

  return (
    <div className={cn("p-6 rounded-2xl border-2 shadow-sm transition-all hover:shadow-md", colors[type])}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-sm font-medium opacity-80">{icons[type]} {title}</span>
        {trend && <span className="text-xs font-bold">{trend}</span>}
      </div>
      <div className="text-3xl font-bold mb-1">{formatCurrency(value)}</div>
      <div className="text-sm opacity-70">{count.toLocaleString()}건</div>
    </div>
  );
};
