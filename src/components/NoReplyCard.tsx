import React, { useMemo } from 'react';

export interface NoReplyDeptItem {
  dept: string;
  count: number;
}

interface NoReplyCardProps {
  data: NoReplyDeptItem[];
}

const DEPT_STYLE: Record<string, { bar: string; countColor: string; pctColor: string }> = {
  '생산': { bar: '#f97316', countColor: '#c2410c', pctColor: '#f97316' },
  '구매': { bar: '#22c55e', countColor: '#15803d', pctColor: '#22c55e' },
};

export const NoReplyCard: React.FC<NoReplyCardProps> = ({ data }) => {
  const totalCount = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);
  const sorted = useMemo(() => [...data].sort((a, b) => b.count - a.count), [data]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '0.5px solid #e5e7eb',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0, marginBottom: 14 }}>미회신 건수</h3>

      {totalCount === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>미회신 없음</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, justifyContent: 'center' }}>
          {sorted.map(d => {
            const pct = (d.count / totalCount) * 100;
            const colors = DEPT_STYLE[d.dept] || { bar: '#94a3b8', countColor: '#64748b', pctColor: '#94a3b8' };
            return (
              <div key={d.dept} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6b7280', width: 28, flexShrink: 0 }}>{d.dept}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: colors.bar, width: `${pct}%`, transition: 'width 0.4s' }} />
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: colors.countColor }}>{d.count.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: '#d1d5db' }}>&middot;</span>
                  <span style={{ fontSize: 11, color: colors.pctColor }}>{pct.toFixed(1)}%</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
