import React, { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export interface DelayDeptItem {
  name: string;
  count: number;
  revenue: number;
}

interface DelayByDeptCardProps {
  data: DelayDeptItem[];
}

const DEPT_COLORS: Record<string, string> = {
  '구매': '#6366f1',
  '생산': '#3b82f6',
  '품질': '#f43f5e',
  '연구소': '#8b5cf6',
  '물류': '#f59e0b',
  '영업': '#10b981',
};

const COLOR_POOL = ['#6366f1', '#3b82f6', '#f43f5e', '#8b5cf6', '#f59e0b', '#10b981'];

function getDeptColor(name: string, idx: number): string {
  return DEPT_COLORS[name] || COLOR_POOL[idx % COLOR_POOL.length];
}

export const DelayByDeptCard: React.FC<DelayByDeptCardProps> = ({ data }) => {
  const totalCount = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);

  // 건수 내림차순 정렬
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);

  const chartData = useMemo(() => ({
    labels: sorted.map(d => d.name),
    datasets: [{
      data: sorted.map(d => d.count),
      backgroundColor: sorted.map((d, i) => getDeptColor(d.name, i)),
      borderWidth: 0,
      hoverOffset: 2,
    }],
  }), [sorted]);

  const chartOptions = useMemo(() => ({
    cutout: '68%',
    responsive: true,
    maintainAspectRatio: true,
    devicePixelRatio: 3,
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  } as const), []);

  const centerPlugin = useMemo(() => ({
    id: 'centerText',
    afterDraw(chart: ChartJS) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = width / 2;
      const cy = height / 2;

      ctx.font = '700 18px "Noto Sans KR", sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(`${totalCount}`, cx, cy - 6);

      ctx.font = '500 9px "Noto Sans KR", sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('총 지연', cx, cy + 10);

      ctx.restore();
    },
  }), [totalCount]);

  const isEmpty = totalCount === 0;

  return (
    <div className="bg-white" style={{ borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)', padding: 20, height: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-gray-800">귀책부서별 지연현황</h3>
        <span className="text-[11px] font-medium bg-gray-50 text-gray-400 px-2 py-0.5 rounded-md">
          총 {totalCount}건
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center" style={{ height: 240 }}>
          <span className="text-[48px] font-bold text-gray-200">0</span>
          <span className="text-[13px] text-gray-400 mt-1">지연 없음</span>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="shrink-0" style={{ width: 90, height: 90 }}>
            <Doughnut
              data={chartData}
              options={chartOptions}
              plugins={[centerPlugin]}
            />
          </div>

          <div className="flex-1 min-w-0">
            <table className="w-full" style={{ fontSize: 12 }}>
              <thead>
                <tr className="text-gray-400" style={{ borderBottom: '0.5px solid #e5e7eb' }}>
                  <th className="text-left font-medium pb-1.5">부서</th>
                  <th className="text-right font-medium pb-1.5">건수</th>
                  <th className="text-right font-medium pb-1.5 w-[50px]">비율</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((dept, idx) => {
                  const pct = totalCount > 0 ? (dept.count / totalCount) * 100 : 0;
                  const color = getDeptColor(dept.name, idx);
                  return (
                    <tr key={dept.name} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                          <span className="text-gray-700 font-medium">{dept.name}</span>
                        </div>
                      </td>
                      <td className="text-right text-gray-700 font-semibold">{dept.count}건</td>
                      <td className="text-right font-bold" style={{ color }}>{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
