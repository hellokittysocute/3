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
  target: { accent: '#64748b', trendBg: '' },
  possible: { accent: '#22c55e', trendBg: 'bg-emerald-50 text-emerald-600' },
  checking: { accent: '#f59e0b', trendBg: 'bg-amber-50 text-amber-600' },
  impossible: { accent: '#ef4444', trendBg: 'bg-red-50 text-red-500' },
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
        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
        borderTop: `3px solid ${colors.accent}`,
      }}
    >
      <div style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest">{title}</span>
          {trend && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${colors.trendBg}`}>
              {trend}
            </span>
          )}
        </div>

        <div className="text-[30px] font-extrabold text-gray-900 tracking-tight leading-none mt-1">
          {formatCurrency(animatedValue)}
        </div>

        <div className="mt-2 text-[12px] text-gray-400 font-medium">
          {subText || `${count.toLocaleString()}건${totalCount ? ` / ${totalCount.toLocaleString()}건` : ''}`}
        </div>
      </div>
    </div>
  );
};
