import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  count: number;
  trend?: string;
  type: 'target' | 'possible' | 'checking' | 'impossible';
  subText?: string;
  delay?: number;
}

function useCountUp(end: number, duration = 1200, startDelay = 0) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const animate = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const val = eased * end;
        setCurrent(val);
        if (progress < 1) {
          ref.current = requestAnimationFrame(animate);
        }
      };
      ref.current = requestAnimationFrame(animate);
    }, startDelay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(ref.current);
    };
  }, [end, duration, startDelay]);

  return current;
}

const colorMap = {
  target: { bar: 'bg-gray-400', trendBg: '', trendText: '' },
  possible: { bar: 'bg-[#22C55E]', trendBg: 'bg-green-50 text-green-600 border-green-200', trendText: '' },
  checking: { bar: 'bg-[#EAB308]', trendBg: 'bg-yellow-50 text-yellow-600 border-yellow-200', trendText: '' },
  impossible: { bar: 'bg-[#EF4444]', trendBg: 'bg-red-50 text-red-600 border-red-200', trendText: '' },
};

export const KPICard: React.FC<KPICardProps> = ({ title, value, count, trend, type, subText, delay = 0 }) => {
  const colors = colorMap[type];
  const animatedValue = useCountUp(value, 1200, delay);

  return (
    <div
      className="relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden opacity-0 animate-[fadeInUp_0.5s_ease_forwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top color bar */}
      <div className={`h-[3px] ${colors.bar}`} />

      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[15px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
          {trend && (
            <span className={`text-[14px] font-bold px-2.5 py-0.5 rounded-full border ${colors.trendBg}`}>
              {trend}
            </span>
          )}
        </div>

        <div className="text-[28px] font-bold text-gray-900 tracking-tight">
          {formatCurrency(animatedValue)}
        </div>

        <div className="mt-2 text-[13px] text-gray-500">
          {subText || `${count.toLocaleString()}건 · 전체 대비 ${((count / 805) * 100).toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
};
