import React from 'react';

interface CustomerItem {
  name: string;
  amount: number;
  isEtc?: boolean;
}

interface Top10CustomerCardProps {
  data: CustomerItem[];
  onCustomerClick?: (name: string) => void;
}

const BADGE_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: '#3C3489', color: '#fff' },
  2: { bg: '#534AB7', color: '#fff' },
  3: { bg: '#7F77DD', color: '#fff' },
};

const BAR_COLORS: Record<number, string> = {
  1: '#3C3489',
  2: '#534AB7',
  3: '#7F77DD',
  4: '#AFA9EC',
  5: '#C5C1F4',
  6: '#D5D2F8',
  7: '#DDDAF9',
  8: '#E5E3FA',
  9: '#ECEAFB',
  10: '#F2F1FC',
};

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${Math.round(amount / 100000000)}억`;
  if (amount >= 10000000) return `${Math.round(amount / 100000000)}억`;
  if (amount >= 1000000) return `${Math.round(amount / 1000000)}백만`;
  return amount.toLocaleString();
}

export const Top10CustomerCard: React.FC<Top10CustomerCardProps> = ({ data, onCustomerClick }) => {
  const maxAmount = data[0]?.amount || 1;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        border: '0.5px solid #e5e7eb',
        padding: 20,
        height: '100%',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937', marginBottom: 12 }}>Top 10 고객사</div>

      {data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>데이터 없음</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.map((item, idx) => {
            const rank = idx + 1;
            const isTop3 = rank <= 3;
            const isEtc = item.isEtc;
            const barWidth = (item.amount / maxAmount) * 100;

            const badge = isEtc
              ? { bg: '#f5f5f5', color: '#9ca3af' }
              : BADGE_COLORS[rank] || { bg: '#f0eff9', color: '#7F77DD' };

            const barColor = isEtc ? '#e5e7eb' : BAR_COLORS[rank] || '#F2F1FC';

            const textColor = isTop3 && !isEtc ? '#1f2937' : '#6b7280';
            const textWeight = isTop3 && !isEtc ? 500 : 400;

            return (
              <div
                key={item.name}
                onClick={() => onCustomerClick?.(item.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 32,
                  padding: '0 4px',
                  margin: '0 -4px',
                  borderRadius: 8,
                  cursor: onCustomerClick ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { if (onCustomerClick) e.currentTarget.style.background = '#f8fafc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
              >
                {/* 순위 뱃지 */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: badge.bg,
                    color: badge.color,
                    fontSize: 10,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isEtc ? '···' : rank}
                </div>

                {/* 고객사명 */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: textWeight,
                    color: textColor,
                    width: 36,
                    flexShrink: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.name}
                </span>

                {/* 프로그레스 바 */}
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#f1f5f9' }}>
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 3,
                      background: barColor,
                      width: `${barWidth}%`,
                      transition: 'width 0.4s',
                    }}
                  />
                </div>

                {/* 금액 */}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: textWeight,
                    color: textColor,
                    width: 40,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {formatAmount(item.amount)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
