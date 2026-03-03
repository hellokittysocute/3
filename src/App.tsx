import React, { useState, useMemo } from 'react';
import { LayoutDashboard, Package, AlertTriangle, List, Search, Filter, RefreshCw, ChevronRight } from 'lucide-react';
import { DashboardItem, SummaryStats } from './types';
import { parseDashboardData, calculateStats, getRevenue, getMaterialByCustomer } from './services/dataService';
import { KPICard } from './components/KPICard';
import { ProgressGauge } from './components/ProgressGauge';
import { DataTable } from './components/DataTable';
import { StackedBarChart } from './components/StackedBarChart';
import { cn, formatCurrency } from './lib/utils';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

import { get805Items, CATEGORIES } from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState<'summary' | 'priority' | 'material' | 'details'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  
  const items = useMemo(() => get805Items(), []);
  const stats = useMemo(() => calculateStats(items), [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customerCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // Chart data preparation
  const customerChartData = useMemo(() => {
    const customers = [...new Set(items.map(i => i.customerCode))].slice(0, 10);
    return customers.map(code => {
      const cItems = items.filter(i => i.customerCode === code);
      return {
        name: code,
        가능: cItems.filter(i => i.status === '가능').reduce((s, i) => s + getRevenue(i), 0),
        확인중: cItems.filter(i => i.status === '확인중').reduce((s, i) => s + getRevenue(i), 0),
        불가능: cItems.filter(i => i.status === '불가능').reduce((s, i) => s + getRevenue(i), 0),
      };
    }).sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
  }, [items]);

  const teamChartData = useMemo(() => {
    const teams = [...new Set(items.map(i => i.teamName))].sort();
    return teams.map(team => {
      const tItems = items.filter(i => i.teamName === team);
      return {
        name: team || '기타',
        가능: tItems.filter(i => i.status === '가능').reduce((s, i) => s + getRevenue(i), 0),
        확인중: tItems.filter(i => i.status === '확인중').reduce((s, i) => s + getRevenue(i), 0),
        불가능: tItems.filter(i => i.status === '불가능').reduce((s, i) => s + getRevenue(i), 0),
      };
    }).sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
  }, [items]);

  const materialCustomerData = useMemo(() => getMaterialByCustomer(items), [items]);

  const delayByDeptData = useMemo(() => {
    const deptMap: Record<string, { count: number; revenue: number }> = {};
    items.forEach(item => {
      const dept = item.delayReason?.trim();
      if (!dept) return;
      if (!deptMap[dept]) deptMap[dept] = { count: 0, revenue: 0 };
      deptMap[dept].count += 1;
      deptMap[dept].revenue += getRevenue(item);
    });
    return Object.entries(deptMap)
      .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  const DELAY_DEPT_COLORS = ['#10b981', '#f59e0b', '#6366f1', '#f43f5e', '#3b82f6', '#8b5cf6'];

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
            <button className="group bg-slate-900 text-white pl-4 pr-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-emerald-600 transition-all duration-300 flex items-center gap-2 shadow-xl shadow-slate-200">
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
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
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Main Progress Section */}
              <div className="lg:col-span-4 bg-white p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <LayoutDashboard size={120} />
                </div>
                <ProgressGauge 
                  rate={stats.overall.progressRate} 
                  label="전체 진도율" 
                  subLabel={`목표: 480억 / 현재: ${formatCurrency(stats.overall.possibleRevenue)}`}
                />
              </div>

              {/* KPI Grid */}
              <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="가능" value={stats.overall.possibleRevenue} count={stats.overall.possibleCount} type="possible" trend="+12억" />
                <KPICard title="확인중" value={stats.overall.checkingRevenue} count={stats.overall.checkingCount} type="checking" trend="-8억" />
                <KPICard title="불가능" value={stats.overall.impossibleRevenue} count={stats.overall.impossibleCount} type="impossible" trend="-4억" />
                
                {/* Secondary Progress */}
                <div className="md:col-span-3 p-10 bg-slate-900 rounded-[2.5rem] text-white shadow-2xl shadow-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -mr-32 -mt-32" />
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-8">
                      <h3 className="text-xl font-bold tracking-tight">관리구분별 진도 현황</h3>
                      <span className="text-[10px] font-bold bg-white/10 px-2 py-1 rounded uppercase tracking-widest">실시간 분석</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">중점관리품목 (350억)</span>
                          <span className="text-3xl font-black text-emerald-400">{stats.priority.progressRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]" style={{ width: `${stats.priority.progressRate}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>가능: {formatCurrency(stats.priority.possibleRevenue)}</span>
                          <span>{stats.priority.possibleCount} 품목</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-end">
                          <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">자재조정필요 (130억)</span>
                          <span className="text-3xl font-black text-amber-400">{stats.material.progressRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]" style={{ width: `${stats.material.progressRate}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <span>가능: {formatCurrency(stats.material.possibleRevenue)}</span>
                          <span>{stats.material.possibleCount} 품목</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Trend Section */}
              <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">진도율 추이</h3>
                    <p className="text-xs text-slate-400 font-medium">일별 진척도 변화</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-600">진도율</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="w-4 border-t-2 border-dashed border-rose-400" />
                      <span className="text-[10px] font-bold text-slate-600">목표 100%</span>
                    </div>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }} domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax * 1.3, 30))]} dx={-10} />
                      <Tooltip
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                      />
                      <ReferenceLine y={100} stroke="#f43f5e" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: '목표 100%', position: 'right', fill: '#f43f5e', fontSize: 10, fontWeight: 700 }} />
                      <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={4} dot={{ r: 6, fill: '#10B981', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 8 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Delay by Department Donut */}
              <div className="p-8 bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">귀책부서별 지연 현황</h3>
                    <p className="text-xs text-slate-400 font-medium">귀책부서별 품목 수 및 매출 비중</p>
                  </div>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded uppercase tracking-widest">
                    총 {delayByDeptData.reduce((s, d) => s + d.count, 0)}건
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="w-52 h-52 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={delayByDeptData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="count"
                          stroke="none"
                        >
                          {delayByDeptData.map((_, idx) => (
                            <Cell key={idx} fill={DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px 16px' }}
                          formatter={(value: number, name: string, props: any) => [`${value}건 (${formatCurrency(props.payload.revenue)})`, props.payload.name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">지연</span>
                      <span className="text-2xl font-black text-slate-900">{delayByDeptData.reduce((s, d) => s + d.count, 0)}</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2.5">
                    {delayByDeptData.map((dept, idx) => {
                      const total = delayByDeptData.reduce((s, d) => s + d.count, 0);
                      const pct = total > 0 ? ((dept.count / total) * 100).toFixed(1) : '0';
                      return (
                        <div key={dept.name} className="flex items-center gap-3">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length] }} />
                          <span className="text-xs font-bold text-slate-700 w-12">{dept.name}</span>
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length] }} />
                          </div>
                          <span className="text-xs font-black w-12 text-right" style={{ color: DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length] }}>{pct}%</span>
                          <span className="text-[10px] font-bold text-slate-400 w-14 text-right">{dept.count}건</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'priority' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-8 bg-slate-900 rounded-[2rem] text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">전체 관리대상</div>
                  <div className="text-3xl font-black tracking-tight">{formatCurrency(stats.priority.totalRevenue)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded">{stats.priority.totalCount}건</span>
                  </div>
                </div>
                <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">가능</div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.priority.possibleRevenue)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${stats.priority.progressRate}%` }} />
                    </div>
                    <span className="text-xs font-black text-emerald-600">{stats.priority.progressRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-2">확인중</div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.priority.checkingRevenue)}</div>
                  <div className="mt-4 text-xs font-bold text-slate-400">{stats.priority.checkingCount} 품목 대기 중</div>
                </div>
                <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-2">불가능</div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.priority.impossibleRevenue)}</div>
                  <div className="mt-4 text-xs font-bold text-slate-400">{stats.priority.impossibleCount} 품목 불가</div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <StackedBarChart title="고객사별 진도율 (TOP 10)" data={customerChartData} />
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
                  <StackedBarChart title="마케팅팀별 진도율" data={teamChartData} />
                </div>
             </div>
          </div>
        )}

        {activeTab === 'material' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-700">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-8 bg-slate-900 rounded-[2rem] text-white shadow-xl shadow-slate-200 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-2">전체 관리대상</div>
                  <div className="text-3xl font-black tracking-tight">{formatCurrency(stats.material.totalRevenue)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="text-xs font-bold bg-white/10 px-2 py-0.5 rounded">{stats.material.totalCount}건</span>
                  </div>
                </div>
                <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500 mb-2">가능</div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.material.possibleRevenue)}</div>
                  <div className="mt-4 flex items-center gap-2">
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${stats.material.progressRate}%` }} />
                    </div>
                    <span className="text-xs font-black text-emerald-600">{stats.material.progressRate.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 mb-2">확인중</div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.material.checkingRevenue)}</div>
                  <div className="mt-4 text-xs font-bold text-slate-400">{stats.material.checkingCount} 품목 대기 중</div>
                </div>
                <div className="p-8 bg-white border border-slate-200/60 rounded-[2rem] shadow-sm">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500 mb-2">불가능</div>
                  <div className="text-3xl font-black tracking-tight text-slate-900">{formatCurrency(stats.material.impossibleRevenue)}</div>
                  <div className="mt-4 text-xs font-bold text-slate-400">{stats.material.impossibleCount} 품목 불가</div>
                </div>
             </div>
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200/60 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">고객사별 자재조정 현황</h3>
                  <p className="text-sm text-slate-400 font-medium">호버 시 대표 품목 확인 가능</p>
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
                      revenue: allItems.reduce((s, i) => s + getRevenue(i), 0),
                      가능: allItems.filter(i => i.status === '가능').length,
                      확인중: allItems.filter(i => i.status === '확인중').length,
                      불가능: allItems.filter(i => i.status === '불가능').length,
                      products: (() => {
                        const sorted = c.products
                          .map(p => ({
                            name: p.name,
                            count: p.count,
                            qty: p.items.reduce((s, i) => s + i.remainingQuantity, 0),
                          }))
                          .sort((a, b) => b.qty - a.qty);
                        return { top5: sorted.slice(0, 5), restCount: Math.max(0, sorted.length - 5) };
                      })(),
                    };
                  })
                  .sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능))
                  .slice(0, 10);
                const chartHeight = Math.max(300, chartData.length * 40 + 60);

                const CustomTooltip = ({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 max-w-[520px] w-max">
                      <div className="text-sm font-black text-slate-900 mb-2">{data.name}</div>
                      <div className="flex gap-4 text-xs font-bold mb-3 pb-3 border-b border-slate-100">
                        {data.가능 > 0 && <span className="text-emerald-600">가능 {data.가능}건</span>}
                        {data.확인중 > 0 && <span className="text-amber-600">확인중 {data.확인중}건</span>}
                        {data.불가능 > 0 && <span className="text-rose-600">불가능 {data.불가능}건</span>}
                      </div>
                      <div className="space-y-1">
                        {data.products.top5.map((p: any, i: number) => (
                          <div key={i} className="text-[11px] text-slate-600 flex justify-between gap-3">
                            <span className="whitespace-nowrap">{p.name}</span>
                            <span className="whitespace-nowrap text-slate-400">{p.count}건 / {p.qty >= 10000 ? (p.qty / 10000).toFixed(1).replace(/\.0$/, '') + '만' : p.qty.toLocaleString()}개</span>
                          </div>
                        ))}
                        {data.products.restCount > 0 && (
                          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                            외 {data.products.restCount}개 품목
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

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
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
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
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm">
              <div className="space-y-2">
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">납기일</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none">
                  <option>전체</option>
                  <option>2026-03</option>
                  <option>2026-04</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">중분류</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none">
                  <option>전체</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
              <DataTable items={filteredItems} />
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-[1600px] mx-auto px-8 py-12 border-t border-slate-200 text-slate-400 text-xs font-medium flex justify-between items-center">
        <div>© 2026 Cosmetic OEM/ODM Marketing Dashboard. All rights reserved.</div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-slate-600 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-600 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-slate-600 transition-colors">Contact Support</a>
        </div>
      </footer>
    </div>
  );
}
