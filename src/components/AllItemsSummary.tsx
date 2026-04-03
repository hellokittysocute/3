import React, { useMemo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { DashboardItem, EditableData } from '../types';
import { getRevenue } from '../services/dataService';
import { formatCurrency } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, PieChart, Pie } from 'recharts';

interface AllItemsSummaryProps {
  items: DashboardItem[];
  editData: Record<string, EditableData>;
}

function parseShortDate(s: string): Date | null {
  if (!s) return null;
  const v = s.trim().replace(/^~/, '');
  const m = v.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) return new Date(2026, Number(m[1]) - 1, Number(m[2]));
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function getWeekNumber(d: Date): number {
  const month = d.getMonth();
  const day = d.getDate();
  return Math.ceil(day / 7);
}

function getWeekLabel(d: Date): string {
  return `${d.getMonth() + 1}월 ${getWeekNumber(d)}주차`;
}

function bizDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const d = new Date(from);
  const dir = to >= from ? 1 : -1;
  if (dir === 1) {
    while (d < to) {
      d.setDate(d.getDate() + 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
  } else {
    while (d > to) {
      d.setDate(d.getDate() - 1);
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count--;
    }
  }
  return count;
}

const cardStyle: React.CSSProperties = {
  borderRadius: 14,
  boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)',
  background: '#fff',
  padding: 20,
};

const COLORS_WEEK = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];

export const AllItemsSummary: React.FC<AllItemsSummaryProps> = ({ items, editData }) => {
  // 1. 주차별 자재입고 진도율
  const weeklyArrivalData = useMemo(() => {
    const weekMap: Record<string, { expected: number; arrived: number; onTime: number; late: number; total: number; items: { materialCode: string; itemName: string; customerCode: string; expectedDate: string; actualDate: string; status: 'onTime' | 'late' | 'pending' }[] }> = {};

    items.forEach(item => {
      const ed = editData[item.id];
      if (!ed) return;

      const expStr = ed.materialArrivalExpected || ed.materialSettingDate || '';
      const actStr = ed.materialArrivalActual || '';
      const expectedDate = parseShortDate(expStr);
      const actualDate = parseShortDate(actStr);

      if (expectedDate) {
        const label = getWeekLabel(expectedDate);
        if (!weekMap[label]) weekMap[label] = { expected: 0, arrived: 0, onTime: 0, late: 0, total: 0, items: [] };
        weekMap[label].expected += 1;
        weekMap[label].total += 1;

        let status: 'onTime' | 'late' | 'pending' = 'pending';
        if (actualDate) {
          weekMap[label].arrived += 1;
          const diff = bizDaysBetween(expectedDate, actualDate);
          if (diff <= 0) { weekMap[label].onTime += 1; status = 'onTime'; }
          else { weekMap[label].late += 1; status = 'late'; }
        }
        weekMap[label].items.push({ materialCode: item.materialCode, itemName: item.itemName, customerCode: item.customerCode, expectedDate: expStr, actualDate: actStr, status });
      }
    });

    return Object.entries(weekMap)
      .map(([week, v]) => ({
        week,
        expected: v.expected,
        arrived: v.arrived,
        pending: v.expected - v.arrived,
        onTimeRate: v.arrived > 0 ? Math.round((v.onTime / v.arrived) * 100) : 0,
        onTime: v.onTime,
        late: v.late,
        items: v.items,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));
  }, [items, editData]);

  // 주차별 입고 집중도 (예상일 기준)
  const hasArrivalData = weeklyArrivalData.some(d => d.expected > 0);

  // 2. 생산 리드타임
  const leadTimeData = useMemo(() => {
    const ltItems: { itemName: string; materialCode: string; arrivalDate: Date; completeDate: Date; days: number; category: string }[] = [];

    items.forEach(item => {
      const ed = editData[item.id];
      if (!ed) return;

      const arrivalD = parseShortDate(ed.materialArrivalActual || '');
      const completeD = parseShortDate(ed.productionCompleteActual || '');

      if (arrivalD && completeD) {
        const days = bizDaysBetween(arrivalD, completeD);
        ltItems.push({
          itemName: item.itemName,
          materialCode: item.materialCode,
          arrivalDate: arrivalD,
          completeDate: completeD,
          days,
          category: item.category || '기타',
        });
      }
    });

    // 카테고리별 평균
    const catMap: Record<string, { total: number; cnt: number; items: typeof ltItems }> = {};
    ltItems.forEach(lt => {
      if (!catMap[lt.category]) catMap[lt.category] = { total: 0, cnt: 0, items: [] };
      catMap[lt.category].total += lt.days;
      catMap[lt.category].cnt += 1;
      catMap[lt.category].items.push(lt);
    });

    const byCat = Object.entries(catMap)
      .map(([cat, v]) => ({ category: cat, avgDays: Math.round(v.total / v.cnt), count: v.cnt, items: v.items }))
      .sort((a, b) => b.avgDays - a.avgDays);

    const overallAvg = ltItems.length > 0 ? Math.round(ltItems.reduce((s, i) => s + i.days, 0) / ltItems.length) : 0;

    return { items: ltItems, byCat, overallAvg, totalCount: ltItems.length };
  }, [items, editData]);

  const hasLeadTimeData = leadTimeData.totalCount > 0;

  // 팝업 상태
  const [weekModal, setWeekModal] = useState<string | null>(null);
  const [catModal, setCatModal] = useState<string | null>(null);

  const weekModalData = weekModal ? weeklyArrivalData.find(d => d.week === weekModal) : null;
  const catModalData = catModal ? leadTimeData.byCat.find(d => d.category === catModal) : null;

  // 전체 통계
  const totalCount = items.length;
  const totalRevenue = items.reduce((s, i) => s + getRevenue(i), 0);

  // 매출 가능여부 집계
  const statusData = useMemo(() => {
    let possible = 0, checking = 0, impossible = 0;
    items.forEach(item => {
      const ed = editData[item.id];
      const s = ed?.revenuePossible || '확인중';
      if (s === '가능') possible++;
      else if (s === '불가능') impossible++;
      else checking++;
    });
    return { possible, checking, impossible };
  }, [items, editData]);

  // 자재입고 현황
  const arrivalStatus = useMemo(() => {
    let arrived = 0, pending = 0, noExpected = 0;
    items.forEach(item => {
      const ed = editData[item.id];
      const expected = ed?.materialArrivalExpected || ed?.materialSettingDate || '';
      if (!expected) { noExpected++; return; }
      if (ed?.materialArrivalActual) arrived++;
      else pending++;
    });
    return { arrived, pending, noExpected };
  }, [items, editData]);

  const DONUT_COLORS = {
    possible: '#22c55e', checking: '#f59e0b', impossible: '#ef4444',
    arrived: '#6366f1', pending: '#e5e7eb',
    fast: '#22c55e', normal: '#f59e0b', slow: '#ef4444',
  };

  // 리드타임 분포
  const ltDistribution = useMemo(() => {
    let fast = 0, normal = 0, slow = 0;
    leadTimeData.items.forEach(lt => {
      if (lt.days <= 3) fast++;
      else if (lt.days <= 7) normal++;
      else slow++;
    });
    return { fast, normal, slow };
  }, [leadTimeData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 상단 도넛 3개 */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: 20 }}>
        {/* 매출 현황 도넛 */}
        <div style={cardStyle}>
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">매출 현황</h3>
          <div className="flex items-center gap-4">
            <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
              <PieChart width={110} height={110}>
                <Pie data={[
                  { name: '가능', value: statusData.possible },
                  { name: '확인중', value: statusData.checking },
                  { name: '불가능', value: statusData.impossible },
                ].filter(d => d.value > 0)} cx={55} cy={55} innerRadius={32} outerRadius={50} dataKey="value" strokeWidth={2} stroke="#fff">
                  <Cell fill={DONUT_COLORS.possible} />
                  <Cell fill={DONUT_COLORS.checking} />
                  <Cell fill={DONUT_COLORS.impossible} />
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span className="text-[18px] font-extrabold text-gray-900">{totalCount}</span>
                <span className="text-[10px] text-gray-400">건</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.possible }} />가능</span><span className="text-[13px] font-bold text-gray-800">{statusData.possible}건</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.checking }} />확인중</span><span className="text-[13px] font-bold text-gray-800">{statusData.checking}건</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.impossible }} />불가능</span><span className="text-[13px] font-bold text-gray-800">{statusData.impossible}건</span></div>
              <div className="border-t border-gray-100 pt-1 mt-0.5">
                <div className="text-[11px] text-gray-400">총 매출 <strong className="text-gray-700">{formatCurrency(totalRevenue)}</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* 자재입고 현황 도넛 */}
        <div style={cardStyle}>
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">자재입고 현황</h3>
          <div className="flex items-center gap-4">
            <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
              <PieChart width={110} height={110}>
                <Pie data={[
                  { name: '입고완료', value: arrivalStatus.arrived },
                  { name: '미입고', value: arrivalStatus.pending },
                ].filter(d => d.value > 0)} cx={55} cy={55} innerRadius={32} outerRadius={50} dataKey="value" strokeWidth={2} stroke="#fff">
                  <Cell fill={DONUT_COLORS.arrived} />
                  <Cell fill={DONUT_COLORS.pending} />
                </Pie>
              </PieChart>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span className="text-[18px] font-extrabold" style={{ color: '#6366f1' }}>{arrivalStatus.arrived + arrivalStatus.pending > 0 ? Math.round((arrivalStatus.arrived / (arrivalStatus.arrived + arrivalStatus.pending)) * 100) : 0}%</span>
                <span className="text-[10px] text-gray-400">입고율</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.arrived }} />입고완료</span><span className="text-[13px] font-bold text-gray-800">{arrivalStatus.arrived}건</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.pending }} />미입고</span><span className="text-[13px] font-bold text-gray-800">{arrivalStatus.pending}건</span></div>
              {arrivalStatus.noExpected > 0 && <div className="text-[11px] text-gray-300 mt-0.5">예정일 미입력 {arrivalStatus.noExpected}건</div>}
            </div>
          </div>
        </div>

        {/* 생산 리드타임 도넛 */}
        <div style={cardStyle}>
          <h3 className="text-[13px] font-bold text-gray-800 mb-3">생산 리드타임</h3>
          <div className="flex items-center gap-4">
            <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
              {hasLeadTimeData ? (
                <>
                  <PieChart width={110} height={110}>
                    <Pie data={[
                      { name: '3일 이하', value: ltDistribution.fast },
                      { name: '4~7일', value: ltDistribution.normal },
                      { name: '8일 이상', value: ltDistribution.slow },
                    ].filter(d => d.value > 0)} cx={55} cy={55} innerRadius={32} outerRadius={50} dataKey="value" strokeWidth={2} stroke="#fff">
                      <Cell fill={DONUT_COLORS.fast} />
                      <Cell fill={DONUT_COLORS.normal} />
                      <Cell fill={DONUT_COLORS.slow} />
                    </Pie>
                  </PieChart>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <span className="text-[18px] font-extrabold" style={{ color: leadTimeData.overallAvg > 7 ? '#ef4444' : '#22c55e' }}>{leadTimeData.overallAvg}일</span>
                    <span className="text-[10px] text-gray-400">평균</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-300 text-[12px]">데이터 없음</div>
              )}
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.fast }} />3일 이하</span><span className="text-[13px] font-bold text-gray-800">{ltDistribution.fast}건</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.normal }} />4~7일</span><span className="text-[13px] font-bold text-gray-800">{ltDistribution.normal}건</span></div>
              <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[12px]"><span className="w-2.5 h-2.5 rounded-full" style={{ background: DONUT_COLORS.slow }} />8일 이상</span><span className="text-[13px] font-bold text-gray-800">{ltDistribution.slow}건</span></div>
              <div className="text-[11px] text-gray-300 mt-0.5">{leadTimeData.totalCount}건 기준</div>
            </div>
          </div>
        </div>
      </div>

      {/* 1. 주차별 자재입고 진도율 */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-bold text-gray-800">주차별 자재입고 진도율</h3>
          </div>
          {hasArrivalData && (
            <span className="text-[11px] font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md">
              {weeklyArrivalData.reduce((s, d) => s + d.expected, 0)}건 추적 중
            </span>
          )}
        </div>

        {!hasArrivalData ? (
          <div className="text-center py-12">
            <div className="text-[40px] mb-3">📦</div>
            <div className="text-[14px] font-medium text-gray-400 mb-1">자재입고 데이터 대기 중</div>
            <div className="text-[12px] text-gray-300">상세 데이터에서 '부자재 입고 예상일'과 '실 입고일'을 입력하면<br/>주차별 진도율이 자동으로 집계됩니다.</div>
          </div>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyArrivalData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number, name: string) => [
                    `${value}건`,
                    name === 'expected' ? '예상 입고' : name === 'onTime' ? '정시 입고' : '지연 입고',
                  ]}
                />
                <Legend
                  formatter={(value: string) => value === 'expected' ? '예상 입고' : value === 'onTime' ? '정시 입고' : '지연 입고'}
                  wrapperStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="expected" fill="#94a3b8" radius={[4, 4, 0, 0]} name="expected" cursor="pointer" onClick={(data: any) => setWeekModal(data?.week)} />
                <Bar dataKey="onTime" fill="#22c55e" radius={[4, 4, 0, 0]} name="onTime" cursor="pointer" onClick={(data: any) => setWeekModal(data?.week)} />
                <Bar dataKey="late" fill="#ef4444" radius={[4, 4, 0, 0]} name="late" cursor="pointer" onClick={(data: any) => setWeekModal(data?.week)} />
              </BarChart>
            </ResponsiveContainer>

            {/* 입고 정확도 */}
            <div className="text-[12px] font-bold text-gray-500 mb-2 mt-4">입고 정확도</div>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {weeklyArrivalData.map((d) => (
                <div key={d.week} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-gray-400 font-medium">{d.week}</div>
                  <div className="text-[18px] font-bold mt-1" style={{ color: d.onTimeRate >= 80 ? '#22c55e' : d.onTimeRate >= 50 ? '#f59e0b' : '#ef4444' }}>
                    {d.arrived > 0 ? `${d.onTimeRate}%` : '-'}
                  </div>
                  <div className="text-[10px] text-gray-300">{d.arrived}/{d.expected}건 입고</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. 생산 리드타임 */}
      <div style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[14px] font-bold text-gray-800">생산 리드타임</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">자재 입고 후 생산 완료까지 소요 영업일 · 중분류별 평균</p>
          </div>
          {hasLeadTimeData && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md">
                평균 {leadTimeData.overallAvg}일
              </span>
              <span className="text-[11px] font-medium bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md">
                {leadTimeData.totalCount}건
              </span>
            </div>
          )}
        </div>

        {!hasLeadTimeData ? (
          <div className="text-center py-12">
            <div className="text-[40px] mb-3">🏭</div>
            <div className="text-[14px] font-medium text-gray-400 mb-1">생산 리드타임 데이터 대기 중</div>
            <div className="text-[12px] text-gray-300">상세 데이터에서 '실 입고일'과 '실 생산완료일'을 입력하면<br/>중분류별 리드타임이 자동으로 집계됩니다.</div>
          </div>
        ) : (
          <div>
            <ResponsiveContainer width="100%" height={Math.max(200, leadTimeData.byCat.length * 40 + 40)}>
              <BarChart data={leadTimeData.byCat} layout="vertical" barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} unit="일" />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} width={80} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  formatter={(value: number) => [`${value}일`, '평균 리드타임']}
                />
                <Bar dataKey="avgDays" radius={[0, 6, 6, 0]} cursor="pointer" onClick={(data: any) => setCatModal(data?.category)}>
                  {leadTimeData.byCat.map((entry, i) => (
                    <Cell key={i} fill={entry.avgDays > 10 ? '#ef4444' : entry.avgDays > 5 ? '#f59e0b' : '#22c55e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      {/* 주차별 상세 팝업 */}
      {weekModal && weekModalData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setWeekModal(null)}>
          <div className="bg-white rounded-2xl max-w-[600px] w-full max-h-[500px] flex flex-col" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-gray-900">{weekModal}</span>
                <span className="text-[12px] font-semibold text-white px-2 py-0.5 rounded-md" style={{ background: '#6366f1' }}>{weekModalData.expected}건</span>
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md" style={{ background: '#ecfdf5', color: '#22c55e' }}>정시 {weekModalData.onTime}</span>
                <span className="text-[12px] font-semibold px-2 py-0.5 rounded-md" style={{ background: '#fef2f2', color: '#ef4444' }}>지연 {weekModalData.late}</span>
              </div>
              <button onClick={() => setWeekModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><X size={14} color="#64748b" /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품번</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품명</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>고객</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500 }}>예상일</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500 }}>자재 실입고</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {weekModalData.items.map((it, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 4px', color: '#6b7280', whiteSpace: 'nowrap' }}>{it.materialCode}</td>
                      <td style={{ padding: '6px 4px', color: '#374151' }}>{it.itemName}</td>
                      <td style={{ padding: '6px 4px', color: '#6b7280' }}>{it.customerCode}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', color: '#6b7280' }}>{it.expectedDate}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 600, color: it.actualDate ? '#374151' : '#d1d5db' }}>{it.actualDate || '-'}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                          color: it.status === 'onTime' ? '#22c55e' : it.status === 'late' ? '#ef4444' : '#9ca3af',
                          background: it.status === 'onTime' ? '#ecfdf5' : it.status === 'late' ? '#fef2f2' : '#f9fafb',
                        }}>
                          {it.status === 'onTime' ? '정시' : it.status === 'late' ? '지연' : '대기'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 리드타임 카테고리 상세 팝업 */}
      {catModal && catModalData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.3)' }} onClick={() => setCatModal(null)}>
          <div className="bg-white rounded-2xl max-w-[600px] w-full max-h-[500px] flex flex-col" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-bold text-gray-900">{catModal}</span>
                <span className="text-[12px] font-semibold text-white px-2 py-0.5 rounded-md" style={{ background: catModalData.avgDays > 7 ? '#ef4444' : '#22c55e' }}>평균 {catModalData.avgDays}일</span>
                <span className="text-[12px] text-gray-400">{catModalData.count}건</span>
              </div>
              <button onClick={() => setCatModal(null)} className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center"><X size={14} color="#64748b" /></button>
            </div>
            <div className="overflow-y-auto p-5">
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품번</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품명</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500 }}>자재 실입고일</th>
                    <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500 }}>생산완료일</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500 }}>리드타임</th>
                  </tr>
                </thead>
                <tbody>
                  {catModalData.items.map((lt, i) => {
                    const arrLabel = `${lt.arrivalDate.getMonth() + 1}/${lt.arrivalDate.getDate()}`;
                    const compLabel = `${lt.completeDate.getMonth() + 1}/${lt.completeDate.getDate()}`;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '6px 4px', color: '#6b7280', whiteSpace: 'nowrap' }}>{lt.materialCode}</td>
                        <td style={{ padding: '6px 4px', color: '#374151' }}>{lt.itemName}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#6b7280' }}>{arrLabel}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'center', color: '#6b7280' }}>{compLabel}</td>
                        <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: lt.days > 7 ? '#ef4444' : lt.days > 5 ? '#f59e0b' : '#22c55e' }}>{lt.days}일</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
