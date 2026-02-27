import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '../lib/utils';

interface StackedBarChartProps {
  data: any[];
  title: string;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({ data, title }) => {
  return (
    <div style={{ height: Math.max(320, data.length * 40 + 80) }}>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase">{title}</h3>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">가능</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">확인중</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-rose-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">불가능</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 20, left: 20, bottom: 0 }}
          barSize={12}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={100} 
            tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
            itemStyle={{ fontSize: '11px', fontWeight: 700 }}
          />
          <Bar dataKey="가능" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="확인중" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
          <Bar dataKey="불가능" stackId="a" fill="#F43F5E" radius={[0, 10, 10, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
