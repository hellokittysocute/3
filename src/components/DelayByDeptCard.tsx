import React, { useMemo } from 'react';

export interface DelayDeptItem {
  name: string;
  count: number;
  revenue: number;
}

interface DeptDelay {
  deptName: string;
  count: number;
}

interface DelayByDeptCardProps {
  data: DelayDeptItem[];
  onDeptClick?: (deptName: string) => void;
}

const ALL_DEPTS = ['영업', '고객', '구매(원)', '구매(부)', '생산', '품질', '물류', '연구'];

// 부서명 매핑: 데이터의 name → 칩에 표시할 부서명
function mapDeptName(name: string): string {
  const map: Record<string, string> = {
    '구매': '구매(원)',
    '연구소': '연구',
  };
  return map[name] || name;
}

function getChipStyle(count: number) {
  if (count === 0) {
    return {
      bg: '#f5f6fa',
      border: '#f5f6fa',
      color: '#9ca3af',
      badgeBg: '#e5e7eb',
      badgeColor: '#9ca3af',
    };
  }
  if (count <= 5) {
    return {
      bg: '#EEEDFE',
      border: '#AFA9EC',
      color: '#3C3489',
      badgeBg: '#AFA9EC',
      badgeColor: '#26215C',
    };
  }
  if (count <= 12) {
    return {
      bg: '#AFA9EC',
      border: '#7F77DD',
      color: '#26215C',
      badgeBg: '#534AB7',
      badgeColor: '#fff',
    };
  }
  return {
    bg: '#534AB7',
    border: '#3C3489',
    color: '#fff',
    badgeBg: 'rgba(0,0,0,0.18)',
    badgeColor: '#fff',
  };
}

export const DelayByDeptCard: React.FC<DelayByDeptCardProps> = ({ data, onDeptClick }) => {
  const chips: DeptDelay[] = useMemo(() => {
    // 데이터를 부서명 기준으로 매핑
    const countMap: Record<string, number> = {};
    data.forEach(d => {
      const mapped = mapDeptName(d.name);
      countMap[mapped] = (countMap[mapped] || 0) + d.count;
    });

    // 8개 부서 기준으로 생성
    const allChips = ALL_DEPTS.map(dept => ({
      deptName: dept,
      count: countMap[dept] || 0,
    }));

    // count > 0 내림차순 먼저, count === 0 뒤에
    const active = allChips.filter(c => c.count > 0).sort((a, b) => b.count - a.count);
    const inactive = allChips.filter(c => c.count === 0);
    return [...active, ...inactive];
  }, [data]);

  const activeDeptCount = useMemo(() => chips.filter(c => c.count > 0).length, [chips]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '0.5px solid #e5e7eb',
        padding: 20,
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>귀책부서별 지연현황</h3>
        <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>
          {activeDeptCount > 0 ? `지연 발생 ${activeDeptCount}개 부서` : '지연 없음'}
        </span>
      </div>

      {/* 칩 그리드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 7,
        }}
      >
        {chips.map(chip => {
          const s = getChipStyle(chip.count);
          return (
            <div
              key={chip.deptName}
              onClick={() => chip.count > 0 && onDeptClick?.(chip.deptName)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderRadius: 20,
                padding: '8px 14px',
                background: s.bg,
                border: `0.5px solid ${s.border}`,
                color: s.color,
                fontSize: 13,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                cursor: chip.count > 0 ? 'pointer' : 'default',
                transition: 'filter 0.15s',
              }}
              onMouseEnter={(e) => { if (chip.count > 0) (e.currentTarget.style.filter = 'brightness(0.95)'); }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = ''; }}
            >
              <span>{chip.deptName}</span>
              <span
                style={{
                  background: s.badgeBg,
                  color: s.badgeColor,
                  borderRadius: 10,
                  padding: '1px 8px',
                  fontSize: 12,
                  fontWeight: 700,
                  minWidth: 24,
                  textAlign: 'center',
                }}
              >
                {chip.count > 0 ? chip.count : '\u2014'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
