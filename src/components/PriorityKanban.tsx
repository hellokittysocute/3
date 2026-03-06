import React, { useMemo, useState } from 'react';
import { DashboardItem } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency } from '../lib/utils';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  items: DashboardItem[];
}

type Tier = '상' | '중' | '하';

interface TierConfig {
  label: string;
  sub: string;
  bg: string;
  border: string;
  badge: string;
  badgeText: string;
  headerBg: string;
  dot: string;
}

const TIER_CONFIG: Record<Tier, TierConfig> = {
  '상': {
    label: '상',
    sub: '핵심 관리',
    bg: 'bg-red-50/60',
    border: 'border-red-200',
    badge: 'bg-red-500',
    badgeText: 'text-white',
    headerBg: 'bg-gradient-to-r from-red-500 to-rose-500',
    dot: 'bg-red-500',
  },
  '중': {
    label: '중',
    sub: '주의 관리',
    bg: 'bg-amber-50/60',
    border: 'border-amber-200',
    badge: 'bg-amber-500',
    badgeText: 'text-white',
    headerBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    dot: 'bg-amber-500',
  },
  '하': {
    label: '하',
    sub: '모니터링',
    bg: 'bg-emerald-50/60',
    border: 'border-emerald-200',
    badge: 'bg-emerald-500',
    badgeText: 'text-white',
    headerBg: 'bg-gradient-to-r from-emerald-500 to-green-500',
    dot: 'bg-emerald-500',
  },
};

const STATUS_STYLE: Record<string, string> = {
  '가능': 'bg-emerald-100 text-emerald-700',
  '확인중': 'bg-amber-100 text-amber-700',
  '불가능': 'bg-red-100 text-red-700',
};

function classifyItems(items: DashboardItem[]): Record<Tier, DashboardItem[]> {
  const sorted = [...items].sort((a, b) => getRevenue(b) - getRevenue(a));
  const top30 = Math.ceil(sorted.length * 0.3);
  const top70 = Math.ceil(sorted.length * 0.7);

  return {
    '상': sorted.slice(0, top30),
    '중': sorted.slice(top30, top70),
    '하': sorted.slice(top70),
  };
}

const ITEMS_PER_PAGE = 8;

function TierColumn({ tier, items }: { tier: Tier; items: DashboardItem[] }) {
  const config = TIER_CONFIG[tier];
  const [expanded, setExpanded] = useState(false);
  const totalRevenue = items.reduce((s, i) => s + getRevenue(i), 0);
  const possibleCount = items.filter(i => i.status === '가능').length;
  const checkingCount = items.filter(i => i.status === '확인중').length;
  const impossibleCount = items.filter(i => i.status === '불가능').length;

  const visibleItems = expanded ? items : items.slice(0, ITEMS_PER_PAGE);
  const hasMore = items.length > ITEMS_PER_PAGE;

  return (
    <div className={`rounded-2xl border ${config.border} ${config.bg} flex flex-col overflow-hidden`}>
      {/* Header */}
      <div className={`${config.headerBg} text-white px-5 py-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black">{config.label}</span>
            <span className="text-white/80 text-xs font-semibold">{config.sub}</span>
          </div>
          <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {items.length}건
          </span>
        </div>
        <div className="text-xl font-bold">{formatCurrency(totalRevenue)}</div>
        <div className="flex gap-3 mt-2 text-[11px] font-semibold text-white/80">
          <span>가능 {possibleCount}</span>
          <span>확인중 {checkingCount}</span>
          <span>불가능 {impossibleCount}</span>
        </div>
      </div>

      {/* Cards */}
      <div className="p-3 space-y-2 flex-1 overflow-y-auto" style={{ maxHeight: expanded ? 600 : 420 }}>
        {visibleItems.map((item, idx) => {
          const revenue = getRevenue(item);
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-gray-100 p-3.5 hover:shadow-md transition-all hover:border-gray-200 group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-gray-400 font-medium mb-0.5">{item.customerCode}</div>
                  <div className="text-sm font-bold text-gray-900 truncate" title={item.itemName}>
                    {item.itemName}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLE[item.status] || 'bg-gray-100 text-gray-500'}`}>
                  {item.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-extrabold text-gray-800">{formatCurrency(revenue)}</span>
                <div className="flex items-center gap-2 text-[10px] text-gray-400">
                  <span>{item.managementType === '중점관리품목' ? '중점' : '자재'}</span>
                  {item.delayDays > 0 && (
                    <span className="text-red-500 font-semibold">D+{item.delayDays}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                <span>{item.teamName}</span>
                <span className="text-gray-300">|</span>
                <span>{item.salesManager}</span>
                {item.remainingQuantity > 0 && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>잔량 {item.remainingQuantity.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Show more / less */}
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2.5 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-white/50 transition-colors flex items-center justify-center gap-1 border-t border-gray-100"
        >
          {expanded ? (
            <><ChevronUp className="w-3.5 h-3.5" /> 접기</>
          ) : (
            <><ChevronDown className="w-3.5 h-3.5" /> {items.length - ITEMS_PER_PAGE}건 더 보기</>
          )}
        </button>
      )}
    </div>
  );
}

export function PriorityKanban({ items }: Props) {
  const classified = useMemo(() => classifyItems(items), [items]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-gray-900">품목 중요도 분류</h3>
          <p className="text-xs text-gray-400 mt-0.5">매출액 기준 상위 30% / 중간 40% / 하위 30%</p>
        </div>
        <div className="flex items-center gap-4">
          {(['상', '중', '하'] as Tier[]).map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${TIER_CONFIG[t].dot}`} />
              <span className="text-[11px] font-semibold text-gray-500">
                {TIER_CONFIG[t].label} {classified[t].length}건
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TierColumn tier="상" items={classified['상']} />
        <TierColumn tier="중" items={classified['중']} />
        <TierColumn tier="하" items={classified['하']} />
      </div>
    </div>
  );
}
