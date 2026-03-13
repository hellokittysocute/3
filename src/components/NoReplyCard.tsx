import React, { useMemo } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

export interface NoReplyDeptItem {
  dept: string;
  count: number;
}

interface NoReplyCardProps {
  data: NoReplyDeptItem[];
}

// 매출현황과 동일한 4색
const COLOR_POOL = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b'];

export const NoReplyCard: React.FC<NoReplyCardProps> = ({ data }) => {
  const totalCount = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);

  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);

  const chartData = useMemo(() => ({
    labels: sorted.map(d => d.dept),
    datasets: [{
      data: sorted.map(d => d.count),
      backgroundColor: sorted.map((_, i) => COLOR_POOL[i % COLOR_POOL.length]),
      borderWidth: 0,
      hoverOffset: 2,
    }],
  }), [sorted]);

  const chartOptions = useMemo(() => ({
    cutout: '70%',
    responsive: true,
    maintainAspectRatio: true,
    devicePixelRatio: 3,
    plugins: {
      tooltip: { enabled: false },
      legend: { display: false },
    },
  } as const), []);

  const centerPlugin = useMemo(() => ({
    id: 'noReplyCenterText',
    afterDraw(chart: ChartJS) {
      const { ctx, width, height } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const cx = width / 2;
      const cy = height / 2;

      ctx.font = '700 18px "Noto Sans KR", sans-serif';
      ctx.fillStyle = '#111827';
      ctx.fillText(`${totalCount}`, cx, cy - 5);

      ctx.font = '500 9px "Noto Sans KR", sans-serif';
      ctx.fillStyle = '#9ca3af';
      ctx.fillText('미회신', cx, cy + 9);

      ctx.restore();
    },
  }), [totalCount]);

  const isEmpty = totalCount === 0;

  return (
    <div className="bg-white" style={{ borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)', padding: 20, height: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-bold text-gray-800">미회신 건수</h3>
        <span className="text-[11px] font-medium bg-gray-50 text-gray-400 px-2 py-0.5 rounded-md">
          총 {totalCount}건
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center" style={{ height: 240 }}>
          <span className="text-[48px] font-bold text-gray-200">0</span>
          <span className="text-[13px] text-gray-400 mt-1">미회신 없음</span>
        </div>
      ) : (
        <div className="flex items-center gap-5">
          <div className="shrink-0" style={{ width: 80, height: 80 }}>
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
                  const color = COLOR_POOL[idx % COLOR_POOL.length];
                  return (
                    <tr key={dept.dept} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="shrink-0" style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
                          <span className="text-gray-700 font-medium">{dept.dept}</span>
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
