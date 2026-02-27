import React, { useState, useMemo } from 'react';
import { LayoutDashboard, Package, AlertTriangle, List, Search, Filter, RefreshCw, ChevronRight } from 'lucide-react';
import { DashboardItem, SummaryStats } from './types';
import { parseDashboardData, calculateStats } from './services/dataService';
import { KPICard } from './components/KPICard';
import { ProgressGauge } from './components/ProgressGauge';
import { DataTable } from './components/DataTable';
import { StackedBarChart } from './components/StackedBarChart';
import { cn, formatCurrency } from './lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { get805Items } from './data/mockData';

export default function App() {
  const [activeTab, setActiveTab] = useState<'summary' | 'priority' | 'material' | 'details'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  
  const items = useMemo(() => get805Items(), []);
  const stats = useMemo(() => calculateStats(items), [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.cisManager.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [items, searchTerm]);

  // Chart data preparation
  const customerChartData = useMemo(() => {
    const customers = [...new Set(items.map(i => i.customerCode))].slice(0, 10);
    return customers.map(code => {
      const cItems = items.filter(i => i.customerCode === code);
      return {
        name: code,
        가능: cItems.filter(i => i.status === '가능').reduce((s, i) => s + i.revenue, 0),
        확인중: cItems.filter(i => i.status === '확인중').reduce((s, i) => s + i.revenue, 0),
        불가능: cItems.filter(i => i.status === '불가능').reduce((s, i) => s + i.revenue, 0),
      };
    }).sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
  }, [items]);

  const teamChartData = useMemo(() => {
    const teams = [...new Set(items.map(i => i.teamName))].sort();
    return teams.map(team => {
      const tItems = items.filter(i => i.teamName === team);
      return {
        name: team,
        가능: tItems.filter(i => i.status === '가능').reduce((s, i) => s + i.revenue, 0),
        확인중: tItems.filter(i => i.status === '확인중').reduce((s, i) => s + i.revenue, 0),
        불가능: tItems.filter(i => i.status === '불가능').reduce((s, i) => s + i.revenue, 0),
      };
    }).sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
  }, [items]);

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
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-emerald-600 p-2 rounded-xl">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">3월 중점관리 품목 대시보드</h1>
              <p className="text-xs text-slate-500 font-medium">매출목표 1,250억 달성 프로젝트</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Last Update</div>
              <div className="text-sm font-bold text-slate-700">2026.02.27 09:36</div>
            </div>
            <button className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition-all flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              데이터 갱신
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-6 flex gap-8">
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
                "flex items-center gap-2 py-4 text-sm font-bold transition-all border-b-2 relative",
                activeTab === tab.id 
                  ? "text-emerald-600 border-emerald-600" 
                  : "text-slate-400 border-transparent hover:text-slate-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-8">
        {activeTab === 'summary' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <ProgressGauge 
                  rate={stats.overall.progressRate} 
                  label="3월 중점관리 진도율" 
                  subLabel={`가능: ${formatCurrency(stats.overall.possibleRevenue)} / 관리대상: ${formatCurrency(stats.overall.totalRevenue)}`}
                />
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard title="가능" value={stats.overall.possibleRevenue} count={stats.overall.possibleCount} type="possible" trend="+12억" />
                <KPICard title="확인중" value={stats.overall.checkingRevenue} count={stats.overall.checkingCount} type="checking" trend="-8억" />
                <KPICard title="불가능" value={stats.overall.impossibleRevenue} count={stats.overall.impossibleCount} type="impossible" trend="-4억" />
                
                <div className="md:col-span-3 p-8 bg-white rounded-3xl border border-slate-100 shadow-sm">
                  <div className="text-lg font-bold text-slate-800 mb-6">버킷별 진도율</div>
                  <div className="space-y-8">
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <span className="font-bold text-slate-700">중점관리품목 (350억)</span>
                        <span className="text-emerald-600 font-bold text-xl">{stats.priority.progressRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-emerald-500" style={{ width: `${stats.priority.progressRate}%` }}></div>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs font-medium text-slate-500">
                        <span>가능 {formatCurrency(stats.priority.possibleRevenue)}</span>
                        <span>확인중 {formatCurrency(stats.priority.checkingRevenue)}</span>
                        <span>불가 {formatCurrency(stats.priority.impossibleRevenue)}</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <span className="font-bold text-slate-700">자재조정필요 (130억)</span>
                        <span className="text-amber-600 font-bold text-xl">{stats.material.progressRate.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-amber-500" style={{ width: `${stats.material.progressRate}%` }}></div>
                      </div>
                      <div className="flex gap-4 mt-3 text-xs font-medium text-slate-500">
                        <span>가능 {formatCurrency(stats.material.possibleRevenue)}</span>
                        <span>확인중 {formatCurrency(stats.material.checkingRevenue)}</span>
                        <span>불가 {formatCurrency(stats.material.impossibleRevenue)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm h-96">
              <div className="text-lg font-bold text-slate-800 mb-6">진도율 추이 (Daily Trend)</div>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="rate" stroke="#10B981" strokeWidth={4} dot={{ r: 6, fill: '#10B981', strokeWidth: 3, stroke: '#fff' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'priority' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="p-6 bg-slate-900 rounded-2xl text-white">
                  <div className="text-xs font-medium opacity-60 mb-1">전체 관리대상</div>
                  <div className="text-3xl font-bold">{formatCurrency(stats.priority.totalRevenue)}</div>
                  <div className="text-sm opacity-60 mt-1">{stats.priority.totalCount}건</div>
                </div>
                <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                  <div className="text-xs font-bold text-emerald-600 mb-1">✅ 가능</div>
                  <div className="text-3xl font-bold">{formatCurrency(stats.priority.possibleRevenue)}</div>
                  <div className="text-sm text-slate-500 mt-1">{stats.priority.progressRate.toFixed(1)}%</div>
                </div>
                <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                  <div className="text-xs font-bold text-amber-600 mb-1">❓ 확인중</div>
                  <div className="text-3xl font-bold">{formatCurrency(stats.priority.checkingRevenue)}</div>
                  <div className="text-sm text-slate-500 mt-1">{stats.priority.checkingCount}건</div>
                </div>
                <div className="p-6 bg-white border border-slate-200 rounded-2xl">
                  <div className="text-xs font-bold text-red-600 mb-1">❌ 불가능</div>
                  <div className="text-3xl font-bold">{formatCurrency(stats.priority.impossibleRevenue)}</div>
                  <div className="text-sm text-slate-500 mt-1">{stats.priority.impossibleCount}건</div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <StackedBarChart title="고객사별 진도율 (TOP 10)" data={customerChartData} />
                <StackedBarChart title="마케팅팀별 진도율" data={teamChartData} />
             </div>
          </div>
        )}

        {activeTab === 'material' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-amber-50 border-l-8 border-amber-500 p-8 rounded-2xl flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-8 h-8" />
                  자재조정필요 130억 — 긴급 대응 현황
                </h2>
                <p className="text-amber-700 font-medium">3월 매출 목표 달성을 위해 부자재 수급 일정이 타이트한 품목들입니다.</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-amber-600 font-bold uppercase tracking-wider">부자재 최종 셋팅 마감</div>
                <div className="text-4xl font-black text-amber-900">3/20 (D-21)</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <div className="text-lg font-bold text-slate-800">고객사별 집중 관리 (자재조정)</div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                      <span className="text-xs font-bold text-slate-500">가능</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-xs font-bold text-slate-500">확인중</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-xs font-bold text-slate-500">불가능</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  {customerChartData.slice(0, 5).map((c, idx) => (
                    <div key={idx} className="flex items-center gap-6">
                      <div className="w-20 font-bold text-slate-600">{c.name}</div>
                      <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden flex">
                         <div className="h-full bg-emerald-500" style={{ width: `${(c.가능 / (c.가능 + c.확인중 + c.불가능)) * 100}%` }}></div>
                         <div className="h-full bg-amber-500" style={{ width: `${(c.확인중 / (c.가능 + c.확인중 + c.불가능)) * 100}%` }}></div>
                         <div className="h-full bg-red-500" style={{ width: `${(c.불가능 / (c.가능 + c.확인중 + c.불가능)) * 100}%` }}></div>
                      </div>
                      <div className="w-24 text-right font-bold text-slate-700">{formatCurrency(c.가능 + c.확인중 + c.불가능)}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="text-lg font-bold text-slate-800 mb-6">사급 품목 리스크 (외부 조달)</div>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <div className="text-sm font-bold text-red-700">전체 사급 품목</div>
                    <div className="text-2xl font-black text-red-900">20건 / 2.4억</div>
                  </div>
                  <div className="text-sm text-slate-500 leading-relaxed">
                    외부 조달 부자재는 리드타임 통제가 어려워 3월 매출 전환 리스크가 매우 높습니다. 별도 집중 관리가 필요합니다.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="품명, 고객사, 담당자 검색..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">
                  <Filter className="w-4 h-4" />
                  필터
                </button>
                <div className="h-8 w-px bg-slate-200 mx-2 hidden md:block"></div>
                <span className="text-sm text-slate-500 font-medium">검색 결과: <span className="text-slate-900 font-bold">{filteredItems.length}</span>건</span>
              </div>
            </div>
            <DataTable items={filteredItems} />
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
