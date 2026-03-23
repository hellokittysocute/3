import React, { useMemo } from 'react';

export interface NoReplyDeptItem {
  dept: string;
  count: number;
  managers: { name: string; count: number; avgDays?: number }[];
}

interface NoReplyCardProps {
  data: NoReplyDeptItem[];
  /** 각 부서의 기한 (기본: 구매3, 제조2, 충포장2) */
  limits?: Record<string, number>;
}

interface GroupStyle {
  dot: string;
  label: string;
  badgeBg: string;
  badgeColor: string;
  border: string;
}

const PROD_STYLE: GroupStyle = { dot: '#f59e0b', label: '#b45309', badgeBg: '#FFF8EB', badgeColor: '#b45309', border: '#f59e0b' };
const PURCHASE_STYLE: GroupStyle = { dot: '#10b981', label: '#047857', badgeBg: '#ECFDF5', badgeColor: '#047857', border: '#10b981' };

const ManagerList: React.FC<{ managers: { name: string; count: number; avgDays?: number }[]; limit: number }> = ({ managers, limit }) => {
  if (managers.length === 0) return <span style={{ fontSize: 11, color: '#9ca3af' }}>담당자 없음</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {managers.map(m => {
        const over = m.avgDays != null && m.avgDays > 0;
        const label = m.avgDays != null
          ? (m.avgDays <= 0 ? `${m.avgDays.toFixed(1)}일` : `+${m.avgDays.toFixed(1)}일`)
          : null;
        return (
          <div
            key={m.name}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '4px 8px', background: over ? '#fef2f2' : '#fff', borderRadius: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#374151' }}>{m.name}</span>
              {label && (
                <span style={{
                  fontSize: 10, fontWeight: 600, borderRadius: 4, padding: '1px 5px',
                  color: m.avgDays! <= -1 ? '#059669' : m.avgDays! <= 0 ? '#ca8a04' : '#dc2626',
                  background: m.avgDays! <= -1 ? '#ecfdf5' : m.avgDays! <= 0 ? '#fefce8' : '#fef2f2',
                }}>
                  {label}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: '#374151' }}>{m.count.toLocaleString()}건</span>
          </div>
        );
      })}
    </div>
  );
};

const SubCard: React.FC<{ title: string; count: number; style: GroupStyle; managers: { name: string; count: number; avgDays?: number }[]; limit: number }> = ({ title, count, style: s, managers, limit }) => (
  <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: '0.04em' }}>{title}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: s.badgeColor, background: s.badgeBg, borderRadius: 6, padding: '1px 6px', opacity: 0.85 }}>
        {count.toLocaleString()}건
      </span>
    </div>
    <ManagerList managers={managers} limit={limit} />
  </div>
);

const GroupHeader: React.FC<{ name: string; count: number; style: GroupStyle; avgLabel?: string; manager?: string }> = ({ name, count, style: s, avgLabel, manager }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 500, color: s.label }}>{name}</span>
      {avgLabel && (
        <span style={{ fontSize: 11, fontWeight: 600, color: s.badgeColor, background: s.badgeBg, borderRadius: 6, padding: '2px 8px' }}>{avgLabel}</span>
      )}
      {manager && (
        <span style={{ fontSize: 11, fontWeight: 600, color: s.badgeColor }}>- {manager}</span>
      )}
    </div>
    <span style={{ fontSize: 11, fontWeight: 700, color: s.badgeColor, background: s.badgeBg, borderRadius: 8, padding: '2px 8px', flexShrink: 0 }}>
      {count.toLocaleString()}건
    </span>
  </div>
);

const cardBase: React.CSSProperties = {
  background: '#fff',
  border: '0.5px solid #e5e7eb',
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
};

const computeGroupAvgDays = (depts: (NoReplyDeptItem | undefined)[]): number | undefined => {
  let totalWeighted = 0, totalCount = 0;
  depts.forEach(dept => {
    if (!dept) return;
    dept.managers.forEach(m => {
      if (m.avgDays != null) {
        totalWeighted += m.avgDays * m.count;
        totalCount += m.count;
      }
    });
  });
  return totalCount > 0 ? +(totalWeighted / totalCount).toFixed(1) : undefined;
};

const formatAvgDays = (v: number | undefined): string => {
  if (v == null) return '0일';
  return v <= 0 ? `${v}일` : `+${v}일`;
};

export const NoReplyCard: React.FC<NoReplyCardProps> = ({ data }) => {
  const totalCount = useMemo(() => data.reduce((s, d) => s + d.count, 0), [data]);
  const dataMap = useMemo(() => Object.fromEntries(data.map(d => [d.dept, d])), [data]);

  const mfg = dataMap['제조'];
  const pkg = dataMap['충포장'];
  const purchase = dataMap['구매'];
  const prodCount = (mfg?.count || 0) + (pkg?.count || 0);

  const prodAvgDays = useMemo(() => computeGroupAvgDays([mfg, pkg]), [mfg, pkg]);
  const purchaseAvgDays = useMemo(() => computeGroupAvgDays([purchase]), [purchase]);

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e5e7eb', padding: 20, display: 'flex', flexDirection: 'column' }}>
      {/* 위젯 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>미회신 건수</h3>
        {totalCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#A32D2D', background: '#FCEBEB', borderRadius: 8, padding: '2px 10px' }}>
            총 {totalCount.toLocaleString()}건
          </span>
        )}
      </div>

      {totalCount === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>미회신 없음</span>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'start' }}>
          {/* 생산 카드 */}
          <div style={{ ...cardBase, borderLeft: `3px solid ${PROD_STYLE.border}`, borderRadius: '0 12px 12px 0' }}>
            <GroupHeader name="생산(제조 + 충포장)" count={prodCount} style={PROD_STYLE} avgLabel={`평균 ${formatAvgDays(prodAvgDays)}`} manager="최우정" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {mfg && mfg.count > 0 && <SubCard title="제조담당" count={mfg.count} style={PROD_STYLE} managers={mfg.managers} limit={2} />}
              {pkg && pkg.count > 0 && <SubCard title="충포장담당" count={pkg.count} style={PROD_STYLE} managers={pkg.managers} limit={2} />}
            </div>
          </div>

          {/* 구매 카드 */}
          <div style={{ ...cardBase, borderLeft: `3px solid ${PURCHASE_STYLE.border}`, borderRadius: '0 12px 12px 0' }}>
            <GroupHeader name="구매" count={purchase?.count || 0} style={PURCHASE_STYLE} avgLabel={`평균 ${formatAvgDays(purchaseAvgDays)}`} manager="김태문" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {purchase && purchase.count > 0 && <SubCard title="구매담당" count={purchase.count} style={PURCHASE_STYLE} managers={purchase.managers} limit={3} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
