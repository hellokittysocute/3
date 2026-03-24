import React, { useMemo } from 'react';

export interface NoReplyDeptItem {
  dept: string;
  count: number;
  managers: { name: string; count: number; avgDays?: number }[];
}

export interface CisNoReplyItem {
  name: string;
  count: number;        // 미회신 건수
  totalCount: number;   // 전체 대상 건수
  avgDays?: number;     // 평균 입력일 (기한 대비 편차)
}

export interface SagupManagerItem {
  name: string;
  count: number;        // 전체 사급 건수
  noReplyCount: number; // 미회신 건수
  avgDays?: number;     // 부자재 평균 입력일 (기한 대비 편차)
}

interface NoReplyCardProps {
  data: NoReplyDeptItem[];
  /** 각 부서의 기한 (기본: 구매3, 제조2, 충포장2) */
  limits?: Record<string, number>;
  /** CIS 담당자별 미회신 건수 */
  cisNoReply?: CisNoReplyItem[];
  /** 사급 건 CIS 담당자별 부자재 평균 입력일 */
  sagupManagers?: SagupManagerItem[];
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
const CIS_STYLE: GroupStyle = { dot: '#6366f1', label: '#4338ca', badgeBg: '#EEF2FF', badgeColor: '#4338ca', border: '#6366f1' };
const SAGUP_STYLE: GroupStyle = { dot: '#ec4899', label: '#be185d', badgeBg: '#FDF2F8', badgeColor: '#be185d', border: '#ec4899' };

const MGR_CATEGORY: Record<string, string> = {
  '이정훈': '기초', '홍경의': '기초_색조', '정진숙': '파우더', '김영찬': 'PB담당',
  '장건수': '립', '송하림': '기초', '원대한': '파우더', '오승연': '립',
  '장철환': '선밤', '황아름': '쿠션', '박수진': '튜브',
  '정진영': '겔마스크, 아이패치', '장재호': '기초 외주', '송수빈': '기초 외주',
  '오정훈': '마스크시트, 캔', '송진우': '튜브 외주', '장승상': '기초', '조선혜': '견본',
  '양정빈': '파우더', '유민지': '튜브, 에어쿠션',
};

const ManagerList: React.FC<{ managers: { name: string; count: number; avgDays?: number }[]; limit: number; showCategory?: boolean }> = ({ managers, limit, showCategory }) => {
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
              <span style={{ fontSize: 12, color: '#374151' }}><b>{m.name}</b>{showCategory && MGR_CATEGORY[m.name] && <span style={{ color: '#374151', fontWeight: 400, marginLeft: 2 }}>({MGR_CATEGORY[m.name]})</span>}</span>
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

const SubCard: React.FC<{ title: string; count: number; style: GroupStyle; managers: { name: string; count: number; avgDays?: number }[]; limit: number; showCategory?: boolean }> = ({ title, count, style: s, managers, limit, showCategory }) => (
  <div style={{ background: '#f8f9fb', borderRadius: 8, padding: '10px 12px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', letterSpacing: '0.04em' }}>{title}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: s.badgeColor, background: s.badgeBg, borderRadius: 6, padding: '1px 6px', opacity: 0.85 }}>
        {count.toLocaleString()}건
      </span>
    </div>
    <ManagerList managers={managers} limit={limit} showCategory={showCategory} />
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
        <span style={{ fontSize: 11, fontWeight: 600, color: s.badgeColor }}>{manager}</span>
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
  if (v == null) return '-일';
  return v <= 0 ? `${v}일` : `+${v}일`;
};

const CisRevenueChart: React.FC<{ data: CisNoReplyItem[]; style: GroupStyle }> = ({ data, style: s }) => {
  const totalNoReply = data.reduce((sum, d) => sum + d.count, 0);
  const groupAvg = (() => {
    let tw = 0, tc = 0;
    data.forEach(m => { if (m.avgDays != null) { tw += m.avgDays * m.totalCount; tc += m.totalCount; } });
    return tc > 0 ? +(tw / tc).toFixed(1) : undefined;
  })();
  const managers = data.map(m => ({
    name: m.name,
    count: m.count,
    avgDays: m.avgDays,
  }));
  return (
    <div style={{ ...cardBase, borderLeft: `3px solid ${s.border}`, borderRadius: '0 12px 12px 0' }}>
      <GroupHeader name="CIS(매출 가능여부)" count={totalNoReply} style={s} avgLabel={`평균 ${formatAvgDays(groupAvg)}`} manager="김형석" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SubCard title="CIS담당" count={totalNoReply} style={s} managers={managers} limit={2} />
      </div>
    </div>
  );
};

const SagupAvgChart: React.FC<{ data: SagupManagerItem[]; style: GroupStyle }> = ({ data, style: s }) => {
  const totalNoReply = data.reduce((sum, d) => sum + d.noReplyCount, 0);
  const groupAvg = (() => {
    let tw = 0, tc = 0;
    data.forEach(m => { if (m.avgDays != null) { tw += m.avgDays * m.count; tc += m.count; } });
    return tc > 0 ? +(tw / tc).toFixed(1) : undefined;
  })();
  const managers = data.map(m => ({
    name: m.name,
    count: m.noReplyCount,
    avgDays: m.avgDays,
  }));
  return (
    <div style={{ ...cardBase, borderLeft: `3px solid ${s.border}`, borderRadius: '0 12px 12px 0' }}>
      <GroupHeader name="CIS(사급 부자재)" count={totalNoReply} style={s} avgLabel={`평균 ${formatAvgDays(groupAvg)}`} manager="김형석" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <SubCard title="CIS담당" count={totalNoReply} style={s} managers={managers} limit={3} />
      </div>
    </div>
  );
};

export const NoReplyCard: React.FC<NoReplyCardProps> = ({ data, cisNoReply, sagupManagers }) => {
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
              {mfg && mfg.count > 0 && <SubCard title="제조담당" count={mfg.count} style={PROD_STYLE} managers={mfg.managers} limit={2} showCategory />}
              {pkg && pkg.count > 0 && <SubCard title="충포장담당" count={pkg.count} style={PROD_STYLE} managers={pkg.managers} limit={2} showCategory />}
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

      {/* CIS 담당자 차트 */}
      {(cisNoReply && cisNoReply.length > 0) || (sagupManagers && sagupManagers.length > 0) ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          {cisNoReply && cisNoReply.length > 0 && (
            <CisRevenueChart data={cisNoReply} style={SAGUP_STYLE} />
          )}
          {sagupManagers && sagupManagers.length > 0 && (
            <SagupAvgChart data={sagupManagers} style={SAGUP_STYLE} />
          )}
        </div>
      ) : null}
    </div>
  );
};
