import React from 'react';
import { cn, formatCurrency } from '../lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  count: number;
  trend?: string;
  type: 'possible' | 'checking' | 'impossible' | 'default';
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, count, trend, type }) => {
  const typeStyles = {
    possible: {
      bg: 'bg-emerald-50/50',
      border: 'border-emerald-100',
      text: 'text-emerald-600',
      accent: 'bg-emerald-500',
      icon: '✓'
    },
    checking: {
      bg: 'bg-amber-50/50',
      border: 'border-amber-100',
      text: 'text-amber-600',
      accent: 'bg-amber-500',
      icon: '?'
    },
    impossible: {
      bg: 'bg-rose-50/50',
      border: 'border-rose-100',
      text: 'text-rose-600',
      accent: 'bg-rose-500',
      icon: '×'
    },
    default: {
      bg: 'bg-white',
      border: 'border-slate-200',
      text: 'text-slate-600',
      accent: 'bg-slate-400',
      icon: ''
    }
  };

  const style = typeStyles[type];

  return (
    <div className={cn(
      "relative overflow-hidden p-6 rounded-3xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-1",
      style.bg,
      style.border
    )}>
      {/* Accent Line */}
      <div className={cn("absolute top-0 left-0 w-full h-1", style.accent)} />
      
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white", style.accent)}>
            {style.icon}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</span>
        </div>
        {trend && (
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border", style.border, style.text)}>
            {trend}
          </span>
        )}
      </div>
      
      <div className="space-y-1">
        <div className="text-3xl font-bold tracking-tight text-slate-900">
          {formatCurrency(value)}
        </div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
          <span>{count.toLocaleString()}건</span>
          <div className="w-1 h-1 rounded-full bg-slate-200" />
          <span>전체 대비 {((count / 805) * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
};
