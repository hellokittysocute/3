import React, { useEffect, useRef } from 'react';

interface ReflectedData {
  totalRevenue: number;
  possibleRevenue: number;
  count: number;
}

interface DonutChartProps {
  totalRevenue: number;
  totalCount: number;
  checkingRevenue: number;
  checkingCount: number;
  possibleRevenue: number;
  possibleCount: number;
  impossibleRevenue: number;
  impossibleCount: number;
  reflectedO?: ReflectedData;
  reflectedX?: ReflectedData;
}

const COLORS = {
  sales: '#6366f1',
  checking: '#f59e0b',
  possible: '#10b981',
  impossible: '#f43f5e',
};

const BADGE_BG = {
  sales: '#eef2ff',
  checking: '#fefce8',
  possible: '#ecfdf5',
  impossible: '#fff1f2',
};

function formatShort(v: number): string {
  if (v === 0) return '0';
  const eok = v / 100000000;
  if (eok >= 1) return Math.round(eok) + '억';
  const man = v / 10000;
  return man.toLocaleString() + '만';
}

/** 작은 도넛: 가능 금액 vs 나머지 금액 */
const MiniDonut: React.FC<{ possible: number; total: number; color: string }> = ({ possible, total, color }) => {
  const R = 34, C = 2 * Math.PI * R;
  const rate = total > 0 ? possible / total : 0;
  const seg = rate * C;
  return (
    <svg viewBox="0 0 80 80" style={{ width: 70, height: 70, transform: 'rotate(-90deg)' }}>
      <circle cx="40" cy="40" r={R} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle cx="40" cy="40" r={R} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${seg} ${C - seg}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }} />
    </svg>
  );
};

export const DonutChart: React.FC<DonutChartProps> = ({
  totalRevenue, totalCount,
  checkingRevenue, checkingCount,
  possibleRevenue, possibleCount,
  impossibleRevenue, impossibleCount,
  reflectedO, reflectedX,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const animatedRef = useRef(false);

  const statusItems = [
    { label: '확인중', value: checkingRevenue, count: checkingCount, colorKey: 'checking' as const },
    { label: '가능', value: possibleRevenue, count: possibleCount, colorKey: 'possible' as const },
    { label: '불가능', value: impossibleRevenue, count: impossibleCount, colorKey: 'impossible' as const },
  ];

  const statusTotal = checkingRevenue + possibleRevenue + impossibleRevenue;

  const legendItems = [
    { label: '매출금액', value: totalRevenue, badge: `${totalCount}건`, color: COLORS.sales, badgeBg: BADGE_BG.sales },
    ...statusItems.map(s => ({
      label: s.label,
      value: s.value,
      badge: statusTotal > 0 ? Math.round((s.value / statusTotal) * 100) + '%' : '0%',
      color: COLORS[s.colorKey],
      badgeBg: BADGE_BG[s.colorKey],
    })),
  ];

  // SVG donut - viewBox 기준 R=68, stroke=22, center=90
  const R = 68;
  const C = 2 * Math.PI * R;

  useEffect(() => {
    if (!svgRef.current || animatedRef.current) return;
    animatedRef.current = true;

    const svg = svgRef.current;
    const NS = 'http://www.w3.org/2000/svg';
    const GAP = 6;

    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // background circle
    const bg = document.createElementNS(NS, 'circle');
    bg.setAttribute('cx', '90');
    bg.setAttribute('cy', '90');
    bg.setAttribute('r', String(R));
    bg.setAttribute('fill', 'none');
    bg.setAttribute('stroke', '#f1f5f9');
    bg.setAttribute('stroke-width', '22');
    svg.appendChild(bg);

    const active = statusItems.filter(d => d.value > 0);
    if (active.length === 0) return;

    if (active.length === 1) {
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', '90');
      circle.setAttribute('cy', '90');
      circle.setAttribute('r', String(R));
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', COLORS[active[0].colorKey]);
      circle.setAttribute('stroke-width', '22');
      circle.setAttribute('stroke-linecap', 'round');
      circle.setAttribute('stroke-dasharray', `${C} 0`);
      circle.style.animation = 'donut-draw 1.2s cubic-bezier(0.33,1,0.68,1) forwards';
      circle.style.setProperty('--circumference', String(C));
      circle.style.setProperty('--final-offset', '0');
      svg.appendChild(circle);
    } else {
      let offset = GAP / 2;
      active.forEach((d, i) => {
        const pct = d.value / statusTotal;
        const segLen = pct * C - GAP;
        const circle = document.createElementNS(NS, 'circle');
        circle.setAttribute('cx', '90');
        circle.setAttribute('cy', '90');
        circle.setAttribute('r', String(R));
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', COLORS[d.colorKey]);
        circle.setAttribute('stroke-width', '22');
        circle.setAttribute('stroke-linecap', 'butt');
        circle.setAttribute('stroke-dasharray', `${segLen} ${C - segLen}`);
        circle.setAttribute('stroke-dashoffset', String(-offset));
        circle.style.animation = 'donut-draw 1.2s cubic-bezier(0.33,1,0.68,1) forwards';
        circle.style.animationDelay = `${i * 0.15}s`;
        circle.style.setProperty('--circumference', String(C));
        circle.style.setProperty('--final-offset', String(-offset));
        svg.appendChild(circle);
        offset += segLen + GAP;
      });
    }
  }, [totalRevenue, checkingRevenue, possibleRevenue, impossibleRevenue]);

  const oRate = reflectedO && reflectedO.totalRevenue > 0 ? (reflectedO.possibleRevenue / reflectedO.totalRevenue) * 100 : 0;
  const xRate = reflectedX && reflectedX.totalRevenue > 0 ? (reflectedX.possibleRevenue / reflectedX.totalRevenue) * 100 : 0;

  return (
    <>
      <style>{`
        @keyframes donut-draw {
          from { stroke-dashoffset: var(--circumference); }
          to   { stroke-dashoffset: var(--final-offset); }
        }
        .legend-row {
          transition: background 0.2s, transform 0.2s;
        }
        .legend-row:hover {
          background: #f1f5f9 !important;
          transform: translateX(3px);
        }
      `}</style>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px 10px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', margin: 0 }}>매출 현황</h3>
        </div>
        <div style={{ height: 1, background: '#f1f5f9', margin: '0 18px' }} />

        {/* Body - 기존 도넛 + 범례 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '14px 18px 16px', flex: 1, minWidth: 0 }}>
          {/* Donut */}
          <div style={{ position: 'relative', flexShrink: 0, width: 'min(150px, 32%)', aspectRatio: '1' }}>
            <svg ref={svgRef} viewBox="0 0 180 180" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }} />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#9ca3af' }}>총 매출</span>
              <span style={{ fontSize: 24, fontWeight: 800, color: '#111827', letterSpacing: '-0.03em', lineHeight: 1.2, marginTop: 2 }}>
                {formatShort(totalRevenue)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#9ca3af', marginTop: 2 }}>
                {totalCount}건
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center', minWidth: 0, overflow: 'hidden' }}>
            {legendItems.map((item) => (
              <div
                key={item.label}
                className="legend-row"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  background: '#f9fafb',
                  cursor: 'default',
                }}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: '#4b5563', whiteSpace: 'nowrap' }}>{item.label}</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                  {formatShort(item.value)}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  background: item.badgeBg, color: item.color,
                  padding: '3px 12px', borderRadius: 999,
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 매출반영 O/X 달성율 */}
        {reflectedO && reflectedX && (
          <>
            <div style={{ height: 1, background: '#f1f5f9', margin: '0 18px' }} />
            <div style={{ padding: '14px 18px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 12 }}>매출반영 달성율</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {/* 매출반영 O */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: '#f0fdf4', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <MiniDonut possible={reflectedO.possibleRevenue} total={reflectedO.totalRevenue} color="#22c55e" />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#22c55e' }}>{oRate.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#22c55e', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>O</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>반영</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{reflectedO.count}건</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      가능 <strong style={{ color: '#111827' }}>{formatShort(reflectedO.possibleRevenue)}</strong> / {formatShort(reflectedO.totalRevenue)}
                    </div>
                  </div>
                </div>

                {/* 매출반영 X */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, background: '#fef2f2', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <MiniDonut possible={reflectedX.possibleRevenue} total={reflectedX.totalRevenue} color="#ef4444" />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{xRate.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>X</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>미반영</span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{reflectedX.count}건</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      가능 <strong style={{ color: '#111827' }}>{formatShort(reflectedX.possibleRevenue)}</strong> / {formatShort(reflectedX.totalRevenue)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};
