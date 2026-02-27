import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ProgressGaugeProps {
  rate: number;
  label: string;
  subLabel: string;
}

export const ProgressGauge: React.FC<ProgressGaugeProps> = ({ rate, label, subLabel }) => {
  const data = [
    { name: 'Progress', value: rate },
    { name: 'Remaining', value: 100 - rate },
  ];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-8">{label}</div>
      <div className="relative w-72 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={90}
              outerRadius={110}
              startAngle={225}
              endAngle={-45}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
              cornerRadius={10}
            >
              <Cell fill="#10B981" />
              <Cell fill="#F1F5F9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-6xl font-black text-slate-900 tracking-tighter">{rate.toFixed(1)}<span className="text-2xl text-slate-300 ml-1">%</span></div>
          <div className="mt-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">정상 진행</span>
          </div>
        </div>
      </div>
      <div className="mt-10 text-center">
        <div className="text-xs font-bold text-slate-500 mb-1">현재 상태</div>
        <div className="text-sm font-black text-slate-900 tracking-tight">{subLabel}</div>
      </div>
    </div>
  );
};
