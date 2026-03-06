import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LayoutDashboard, Package, AlertTriangle, List, Search, Filter, RefreshCw, ChevronRight } from 'lucide-react';
import { DashboardItem, SummaryStats, EditableData } from './types';
import { calculateStats, getRevenue, getMaterialByCustomer } from './services/dataService';
import { get805Items } from './data/mockData';
import { KPICard } from './components/KPICard';
import { DataTable } from './components/DataTable';
import { StackedBarChart } from './components/StackedBarChart';
import { PriorityKanban } from './components/PriorityKanban';
import { cn, formatCurrency } from './lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState<'summary' | 'priority' | 'material' | 'details'>('summary');
  const [detailView, setDetailView] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [delayReasonFilter, setDelayReasonFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [revenuePossibleFilter, setRevenuePossibleFilter] = useState('');

  const items = useMemo(() => get805Items(), []);

  // CATEGORIES를 items에서 동적으로 추출
  const CATEGORIES = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean))].sort(), [items]);

  const buildInitialEditData = useCallback(() => {
    const initial: Record<string, EditableData> = {};
    items.forEach(item => {
      initial[item.id] = {
        productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '',
        revenuePossible: item.status,
        revenuePossibleQuantity: item.status === '가능' ? item.remainingQuantity : 0,
        delayReason: '',
      };
    });
    return initial;
  }, [items]);

  const [editData, setEditData] = useState<Record<string, EditableData>>(buildInitialEditData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'loading'>('idle');

  const stats = useMemo(() => calculateStats(items, editData), [items, editData]);

  // 진도율: 매출 가능 수량 합계 / 미납잔량 합계 (editData 기준)
  const editProgressRates = useMemo(() => {
    const calc = (filtered: DashboardItem[]) => {
      const totalRemaining = filtered.reduce((s, i) => s + i.remainingQuantity, 0);
      const totalPossibleQty = filtered.reduce((s, i) => s + (editData[i.id]?.revenuePossibleQuantity ?? i.remainingQuantity), 0);
      return totalRemaining > 0 ? (totalPossibleQty / totalRemaining) * 100 : 0;
    };
    return {
      overall: calc(items),
      priority: calc(items.filter(i => i.managementType === '중점관리품목')),
      material: calc(items.filter(i => i.managementType === '자재조정필요')),
    };
  }, [items, editData]);

  // Fetch latest edit data from server
  const fetchEditData = useCallback(() => {
    return fetch('/api/edit-data')
      .then(res => res.json())
      .then((serverData: Record<string, EditableData>) => {
        const initial = buildInitialEditData();
        const merged: Record<string, EditableData> = {};
        items.forEach(item => {
          const server = serverData[item.id];
          if (server) {
            // 기존 O/X 값을 가능/불가능으로 마이그레이션
            if ((server.revenuePossible as string) === 'O') server.revenuePossible = '가능';
            else if ((server.revenuePossible as string) === 'X') server.revenuePossible = '불가능';
            // 빈 값이면 CSV 원본 status를 기본값으로
            if (!server.revenuePossible) {
              server.revenuePossible = item.status;
              server.revenuePossibleQuantity = item.status === '가능' ? item.remainingQuantity : 0;
            }
            merged[item.id] = server;
          } else {
            merged[item.id] = initial[item.id];
          }
        });
        setEditData(merged);
        setSaveStatus('idle');
      })
      .catch(() => {
        setSaveStatus('idle');
      });
  }, [items, buildInitialEditData]);

  // Load edit data from server on mount
  useEffect(() => {
    fetchEditData();
  }, [fetchEditData]);

  // Auto-sync: poll server every 10 seconds for other users' changes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchEditData();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchEditData]);

  const handleUpdateField = useCallback((id: string, field: keyof EditableData, value: string | number) => {
    setSaveStatus('idle');
    setEditData(prev => {
      const entry = { ...prev[id], [field]: value };
      // 매출가능여부 변경 시 수량 자동 조정
      if (field === 'revenuePossible') {
        const item = items.find(i => i.id === id);
        entry.revenuePossibleQuantity = value === '가능' ? (item?.remainingQuantity ?? 0) : 0;
      }
      const updated = { ...prev, [id]: entry };
      // Send individual field update to server
      fetch(`/api/edit-data/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated[id]),
      }).catch(() => { /* silent fail */ });
      return updated;
    });
  }, [items]);

  const handleSave = useCallback(() => {
    setSaveStatus('loading');
    fetch('/api/edit-data/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    })
      .then(() => {
        setSaveStatus('saved');
        // 저장 시점의 매출가능여부로 정렬 기준 갱신
        const snap: Record<string, string> = {};
        items.forEach(item => { snap[item.id] = editData[item.id]?.revenuePossible || item.status; });
        setSortSnapshot(snap);
        fetchEditData();
        setTimeout(() => setSaveStatus('idle'), 2000);
      })
      .catch(() => {
        setSaveStatus('idle');
      });
  }, [editData, fetchEditData]);

  // 저장 시점의 정렬 기준 스냅샷
  const [sortSnapshot, setSortSnapshot] = useState<Record<string, string>>(() => {
    const snap: Record<string, string> = {};
    items.forEach(item => { snap[item.id] = item.status; });
    return snap;
  });

  const filteredItems = useMemo(() => {
    const statusOrder: Record<string, number> = { '불가능': 0, '확인중': 1, '가능': 2 };
    return items.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.salesDocument?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const row = editData[item.id];
      const matchesRevenuePossible = !revenuePossibleFilter || (row?.revenuePossible === revenuePossibleFilter);
      const matchesDelay = !delayReasonFilter || (row?.delayReason === delayReasonFilter);
      return matchesSearch && matchesCategory && matchesRevenuePossible && matchesDelay;
    }).sort((a, b) => {
      return (statusOrder[sortSnapshot[a.id]] ?? 3) - (statusOrder[sortSnapshot[b.id]] ?? 3);
    });
  }, [items, searchTerm, categoryFilter, revenuePossibleFilter, delayReasonFilter, editData, sortSnapshot]);

  // Chart data preparation
  const getItemStatus = useCallback((item: DashboardItem) => {
    const edited = editData[item.id]?.revenuePossible;
    if (edited === '가능' || edited === '확인중' || edited === '불가능') return edited;
    return item.status;
  }, [editData]);

  const customerChartData = useMemo(() => {
    const customers = [...new Set(items.map(i => i.customerCode))].slice(0, 10);
    return customers.map(code => {
      const cItems = items.filter(i => i.customerCode === code);
      return {
        name: code,
        가능: cItems.filter(i => getItemStatus(i) === '가능').reduce((s, i) => s + getRevenue(i), 0),
        확인중: cItems.filter(i => getItemStatus(i) === '확인중').reduce((s, i) => s + getRevenue(i), 0),
        불가능: cItems.filter(i => getItemStatus(i) === '불가능').reduce((s, i) => s + getRevenue(i), 0),
      };
    }).sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
  }, [items, getItemStatus]);

  // 고객사별 관리구분 달성률 (매출가능수량 / 미납잔량)
  const customerRateData = useMemo(() => {
    const calcRate = (filtered: DashboardItem[]) => {
      const totalRemaining = filtered.reduce((s, i) => s + i.remainingQuantity, 0);
      const totalPossibleQty = filtered.reduce((s, i) => s + (editData[i.id]?.revenuePossibleQuantity ?? i.remainingQuantity), 0);
      return totalRemaining > 0 ? (totalPossibleQty / totalRemaining) * 100 : 0;
    };
    const customerCodes = customerChartData.map(c => c.name);
    return customerCodes.map(code => {
      const cItems = items.filter(i => i.customerCode === code);
      const priorityItems = cItems.filter(i => i.managementType === '중점관리품목');
      const materialItems = cItems.filter(i => i.managementType === '자재조정필요');
      return {
        name: code,
        priorityRate: calcRate(priorityItems),
        materialRate: calcRate(materialItems),
        priorityCount: priorityItems.length,
        materialCount: materialItems.length,
      };
    });
  }, [items, editData, customerChartData]);

  const teamChartData = useMemo(() => {
    const teams = [...new Set(items.map(i => i.teamName))].sort();
    return teams.map(team => {
      const tItems = items.filter(i => i.teamName === team);
      return {
        name: team || '기타',
        가능: tItems.filter(i => getItemStatus(i) === '가능').reduce((s, i) => s + getRevenue(i), 0),
        확인중: tItems.filter(i => getItemStatus(i) === '확인중').reduce((s, i) => s + getRevenue(i), 0),
        불가능: tItems.filter(i => getItemStatus(i) === '불가능').reduce((s, i) => s + getRevenue(i), 0),
      };
    }).sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
  }, [items, getItemStatus]);

  const materialCustomerData = useMemo(() => getMaterialByCustomer(items), [items]);

  const delayByDeptData = useMemo(() => {
    const deptMap: Record<string, { count: number; revenue: number }> = {};
    items.forEach(item => {
      const dept = (editData[item.id]?.delayReason || '').trim();
      if (!dept) return;
      if (!deptMap[dept]) deptMap[dept] = { count: 0, revenue: 0 };
      deptMap[dept].count += 1;
      deptMap[dept].revenue += getRevenue(item);
    });
    return Object.entries(deptMap)
      .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count);
  }, [items, editData]);

  // 구매, 품질, 연구소, 물류, 영업 순서
  const DELAY_DEPT_COLORS = ['#10b981', '#f43f5e', '#6366f1', '#f59e0b', '#8b5cf6'];

  const trendData = [
    { date: '02/27', rate: 0 },
    { date: '02/28', rate: 5.2 },
    { date: '03/01', rate: 12.8 },
    { date: '03/02', rate: 18.5 },
    { date: '03/03', rate: 24.1 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900">
                📊 3월 중점관리 품목 <span className="text-emerald-600">대시보드</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-widest">Project 480억</span>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <p className="text-xs text-slate-400 font-medium italic">3월 중점관리 품목 실시간 현황</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">시스템 상태</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-slate-700">실시간 동기화 중</span>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <button
              onClick={() => { setSaveStatus('loading'); fetchEditData(); }}
              className="group bg-slate-900 text-white pl-4 pr-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-emerald-600 transition-all duration-300 flex items-center gap-2 shadow-xl shadow-slate-200"
            >
              <RefreshCw className={cn("w-4 h-4 transition-transform duration-500", saveStatus === 'loading' ? "animate-spin" : "group-hover:rotate-180")} />
              데이터 갱신
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-8 flex gap-10">
          {[
            { id: 'summary', label: '종합현황', icon: LayoutDashboard },
            { id: 'priority', label: '중점관리품목', icon: Package },
            { id: 'material', label: '자재조정필요', icon: AlertTriangle },
            { id: 'details', label: '상세데이터', icon: List },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 py-5 text-xs font-black uppercase tracking-widest transition-all relative group",
                activeTab === tab.id
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? "text-emerald-500" : "text-slate-300 group-hover:text-slate-400")} />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-10">
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* 1. KPI Cards - 4개 일렬 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard title="목표" value={48000000000} count={stats.overall.totalCount} type="target" subText="PROJECT 480억" delay={0} />
              <KPICard title="가능" value={stats.overall.possibleRevenue} count={stats.overall.possibleCount} type="possible" trend="+12억" delay={100} />
              <KPICard title="확인중" value={stats.overall.checkingRevenue} count={stats.overall.checkingCount} type="checking" trend="-8억" delay={200} />
              <KPICard title="불가능" value={stats.overall.impossibleRevenue} count={stats.overall.impossibleCount} type="impossible" trend="-4억" delay={300} />
            </div>

            {/* 2. 중단 좌우 2분할: Top10 랭킹 + 관리구분별 진도 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top 10 고객사 랭킹 */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <h3 className="text-base font-bold text-gray-900 mb-5">Top 10 고객사</h3>
                <div className="space-y-1">
                  {customerChartData.slice(0, 10).map((c, idx) => {
                    const total = c.가능 + c.확인중 + c.불가능;
                    const maxTotal = customerChartData[0] ? customerChartData[0].가능 + customerChartData[0].확인중 + customerChartData[0].불가능 : 1;
                    const barWidth = (total / maxTotal) * 100;
                    const rateInfo = customerRateData[idx];
                    const overallRate = rateInfo ? (
                      (rateInfo.priorityCount + rateInfo.materialCount) > 0
                        ? ((rateInfo.priorityRate * rateInfo.priorityCount + rateInfo.materialRate * rateInfo.materialCount) / (rateInfo.priorityCount + rateInfo.materialCount))
                        : 0
                    ) : 0;
                    return (
                      <div key={c.name} className="flex items-center gap-3" style={{ height: 52 }}>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${idx < 3 ? 'bg-[#22C55E] text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {idx + 1}
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-14 shrink-0 truncate">{c.name}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-16 text-right shrink-0">{formatCurrency(total)}</span>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0 ${overallRate >= 100 ? 'bg-green-50 text-[#22C55E] border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
                          {overallRate.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 관리구분별 진도 현황 */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-gray-900">관리구분별 진도 현황</h3>
                  <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">실시간 분석</span>
                </div>
                <div className="space-y-8">
                  {/* 중점관리품목 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-gray-600">중점관리품목 (350억)</span>
                      <span className={`text-3xl font-bold ${editProgressRates.priority >= 100 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {editProgressRates.priority.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${editProgressRates.priority >= 100 ? 'bg-[#22C55E]' : 'bg-[#22C55E]'}`}
                        style={{ width: `${Math.min(editProgressRates.priority, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>가능: {formatCurrency(stats.priority.possibleRevenue)}</span>
                      <span>{stats.priority.possibleCount} 품목</span>
                    </div>
                  </div>
                  {/* 자재조정필요 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-semibold text-gray-600">자재조정필요 (130억)</span>
                      <span className={`text-3xl font-bold ${editProgressRates.material >= 100 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                        {editProgressRates.material.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${editProgressRates.material >= 100 ? 'bg-[#22C55E]' : 'bg-[#22C55E]'}`}
                        style={{ width: `${Math.min(editProgressRates.material, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>가능: {formatCurrency(stats.material.possibleRevenue)}</span>
                      <span>{stats.material.possibleCount} 품목</span>
                    </div>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t border-gray-100 my-6" />

                {/* 진도율 추이 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 style={{ fontSize: 15 }} className="font-bold text-gray-900">진도율 추이</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                        <span className="text-[10px] font-semibold text-gray-500">진도율</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 border-t-2 border-dashed border-gray-400" />
                        <span className="text-[10px] font-semibold text-gray-500">목표 100%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }} dy={6} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }} domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax * 1.3, 30))]} dx={-6} />
                        <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', fontSize: 12 }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#9ca3af', fontSize: 10 }} />
                        <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1} />
                        <Line type="monotone" dataKey="rate" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 4, fill: '#22C55E', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* 미니 카드 3개 */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center rounded-[10px] py-2.5 px-3.5" style={{ backgroundColor: '#F0FDF4' }}>
                      <div className="text-[10px] font-semibold text-gray-500 mb-1">현재 진도율</div>
                      <div className="text-xl font-bold text-[#22C55E]">{editProgressRates.overall.toFixed(0)}%</div>
                    </div>
                    <div className="text-center rounded-[10px] py-2.5 px-3.5" style={{ backgroundColor: '#F9FAFB' }}>
                      <div className="text-[10px] font-semibold text-gray-500 mb-1">목표</div>
                      <div className="text-xl font-bold text-gray-900">480억</div>
                    </div>
                    <div className="text-center rounded-[10px] py-2.5 px-3.5" style={{ backgroundColor: '#F9FAFB' }}>
                      <div className="text-[10px] font-semibold text-gray-500 mb-1">현재 매출</div>
                      <div className="text-xl font-bold text-gray-900">{formatCurrency(stats.overall.possibleRevenue)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. 하단 풀 가로: 귀책부서별 지연 */}
            <div>
              {/* 귀책부서별 지연 현황 */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">귀책부서별 지연 현황</h3>
                    <p className="text-xs text-gray-400 mt-0.5">귀책부서별 품목 수 및 매출 비중</p>
                  </div>
                  <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                    총 {delayByDeptData.reduce((s, d) => s + d.count, 0)}건
                  </span>
                </div>
                {delayByDeptData.length === 0 || delayByDeptData.reduce((s, d) => s + d.count, 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center h-52">
                    <span className="text-6xl font-bold text-gray-200">0</span>
                    <span className="text-sm text-gray-400 mt-2">지연 없음</span>
                  </div>
                ) : (
                  <div className="space-y-3 mt-2">
                    {delayByDeptData.map((dept, idx) => {
                      const maxCount = delayByDeptData[0]?.count || 1;
                      const barWidth = (dept.count / maxCount) * 100;
                      return (
                        <div key={dept.name} className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-gray-600 w-12 shrink-0">{dept.name}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${barWidth}%`, backgroundColor: DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length] }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-10 text-right">{dept.count}건</span>
                          <span className="text-[11px] text-gray-400 w-16 text-right">{formatCurrency(dept.revenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'priority' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="전체 관리대상" value={stats.priority.totalRevenue} count={stats.priority.totalCount} type="target" subText={`${stats.priority.totalCount}건`} delay={0} />
                <KPICard title="가능" value={stats.priority.possibleRevenue} count={stats.priority.possibleCount} type="possible" delay={100} />
                <KPICard title="확인중" value={stats.priority.checkingRevenue} count={stats.priority.checkingCount} type="checking" delay={200} />
                <KPICard title="불가능" value={stats.priority.impossibleRevenue} count={stats.priority.impossibleCount} type="impossible" delay={300} />
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white p-6 pb-20 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <StackedBarChart title="고객사별 진도율 (TOP 10)" data={customerChartData} />
                </div>
                <div className="bg-white p-6 pb-20 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                  <StackedBarChart title="마케팅팀별 진도율" data={teamChartData} />
                </div>
             </div>
          </div>
        )}

        {activeTab === 'material' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="전체 관리대상" value={stats.material.totalRevenue} count={stats.material.totalCount} type="target" subText={`${stats.material.totalCount}건`} delay={0} />
                <KPICard title="가능" value={stats.material.possibleRevenue} count={stats.material.possibleCount} type="possible" delay={100} />
                <KPICard title="확인중" value={stats.material.checkingRevenue} count={stats.material.checkingCount} type="checking" delay={200} />
                <KPICard title="불가능" value={stats.material.impossibleRevenue} count={stats.material.impossibleCount} type="impossible" delay={300} />
             </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-gray-900">고객사별 자재조정 현황</h3>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">가능</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">확인중</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">불가능</span>
                  </div>
                </div>
              </div>
              {(() => {
                const chartData = materialCustomerData
                  .map(c => {
                    const allItems = c.products.flatMap(p => p.items);
                    return {
                      name: c.customerCode,
                      가능: allItems.filter(i => getItemStatus(i) === '가능').reduce((s, i) => s + getRevenue(i), 0),
                      확인중: allItems.filter(i => getItemStatus(i) === '확인중').reduce((s, i) => s + getRevenue(i), 0),
                      불가능: allItems.filter(i => getItemStatus(i) === '불가능').reduce((s, i) => s + getRevenue(i), 0),
                    };
                  })
                  .sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능))
                  .slice(0, 10);
                const chartHeight = Math.max(300, chartData.length * 40 + 60);

                return (
                  <div style={{ height: chartHeight }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                        barSize={16}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          width={60}
                          tick={{ fontSize: 12, fontWeight: 800, fill: '#334155' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip cursor={{ fill: '#f8fafc' }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)', padding: '8px 12px' }} itemStyle={{ fontSize: '11px', fontWeight: 700 }} />
                        <Bar dataKey="가능" stackId="a" fill="#10B981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="확인중" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="불가능" stackId="a" fill="#F43F5E" radius={[0, 10, 10, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-8 animate-in fade-in duration-700">
            {/* Image-style Header */}
            <div className="bg-[#4B49AC] text-white p-8 rounded-[2rem] flex items-center justify-between shadow-xl shadow-indigo-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              <div className="relative z-10">
                <h2 className="text-3xl font-black tracking-tight mb-2">중점 관리 품목 현황</h2>
                <span className="text-white font-bold">총 {filteredItems.length}건</span>
              </div>
              <button
                onClick={() => setActiveTab('summary')}
                className="relative z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all"
              >
                <RefreshCw className="w-6 h-6 rotate-45" />
              </button>
            </div>

            {/* Image-style Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">검색 (자재/내역/고객약호)</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="검색어 입력..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">중분류</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">매출 가능여부</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  value={revenuePossibleFilter}
                  onChange={(e) => setRevenuePossibleFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  <option value="가능">가능</option>
                  <option value="확인중">확인중</option>
                  <option value="불가능">불가능</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">지연사유</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  value={delayReasonFilter}
                  onChange={(e) => setDelayReasonFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  <option value="구매">구매</option>
                  <option value="품질">품질</option>
                  <option value="연구소">연구소</option>
                  <option value="물류">물류</option>
                  <option value="영업">영업</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">납기일</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none">
                  <option>전체</option>
                  <option>2026-03</option>
                  <option>2026-04</option>
                </select>
              </div>
            </div>

            {/* 보기 전환 */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDetailView('kanban')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  detailView === 'kanban'
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                )}
              >
                중요도 보기
              </button>
              <button
                onClick={() => setDetailView('table')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  detailView === 'table'
                    ? "bg-slate-900 text-white shadow-lg"
                    : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
                )}
              >
                테이블 보기
              </button>
            </div>

            {detailView === 'kanban' ? (
              <PriorityKanban items={filteredItems} />
            ) : (
              <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
                <DataTable items={filteredItems} editData={editData} onUpdateField={handleUpdateField} onSave={handleSave} saveStatus={saveStatus} />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="max-w-[1600px] mx-auto px-8 py-12 border-t border-slate-200 text-slate-400 text-xs font-medium flex justify-between items-center">
        <div>© 2026 화장품 OEM/ODM 마케팅 대시보드. 모든 권리 보유.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-600 transition-colors">개인정보처리방침</a>
          <a href="#" className="hover:text-slate-600 transition-colors">이용약관</a>
          <a href="#" className="hover:text-slate-600 transition-colors">고객지원</a>
        </div>
      </footer>
    </div>
  );
}
