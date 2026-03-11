import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency } from '../lib/utils';

interface KPICardProps {
  title: string;
  value: number;
  count: number;
  totalCount?: number;
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
  target: { border: '#64748b', trendBg: '' },
  possible: { border: '#22c55e', trendBg: 'bg-emerald-50/80 text-emerald-600' },
  checking: { border: '#f59e0b', trendBg: 'bg-amber-50/80 text-amber-600' },
  impossible: { border: '#ef4444', trendBg: 'bg-red-50/80 text-red-500' },
};

export const KPICard: React.FC<KPICardProps> = ({ title, value, count, totalCount, trend, type, subText, delay = 0 }) => {
  const colors = colorMap[type];
  const animatedValue = useCountUp(value, 1200, delay);

  return (
    <div
      className="relative bg-white overflow-hidden opacity-0 animate-[fadeInUp_0.5s_ease_forwards]"
      style={{
        animationDelay: `${delay}ms`,
        borderRadius: 14,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        borderTop: `3px solid ${colors.border}`,
      }}
    >
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[13px] font-medium text-gray-400 tracking-wide">{title}</span>
          {trend && (
            <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-md ${colors.trendBg}`}>
              {trend}
            </span>
          )}
        </div>

        <div className="text-[26px] font-bold text-gray-900 tracking-tight leading-tight">
          {formatCurrency(animatedValue)}
        </div>

        <div className="mt-1.5 text-[12px] text-gray-400">
          {subText || `${count.toLocaleString()}건${totalCount ? ` / ${totalCount.toLocaleString()}건` : ''}`}
        </div>
      </div>
    </div>
  );
};
