import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';

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
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
      <div className="text-lg font-semibold text-slate-600 mb-4">{label}</div>
      <div className="relative w-64 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={100}
              startAngle={90}
              endAngle={-270}
              paddingAngle={0}
              dataKey="value"
            >
              <Cell fill="#10B981" />
              <Cell fill="#F1F5F9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold text-slate-900">{rate.toFixed(1)}%</span>
        </div>
      </div>
      <div className="mt-6 text-slate-500 text-sm">{subLabel}</div>
    </div>
  );
};
