import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DashboardItem } from '../types';
import { formatCurrency } from '../lib/utils';

interface StackedBarChartProps {
  data: any[];
  title: string;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({ data, title }) => {
  return (
    <div className="p-6 bg-white rounded-2xl border border-slate-100 shadow-sm h-96">
      <div className="text-lg font-bold text-slate-800 mb-6">{title}</div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={80} 
            tick={{ fontSize: 12, fontWeight: 500 }}
          />
          <Tooltip 
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Legend iconType="circle" />
          <Bar dataKey="가능" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
          <Bar dataKey="확인중" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
          <Bar dataKey="불가능" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
