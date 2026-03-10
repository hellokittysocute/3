import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LayoutDashboard, Package, AlertTriangle, List, Search, Filter, RefreshCw, ChevronRight, Shield, Upload, LogOut, Users } from 'lucide-react';
import { DashboardItem, SummaryStats, EditableData } from './types';
import { calculateStats, getRevenue, getMaterialByCustomer } from './services/dataService';
import { fetchDashboardItems, fetchAllEditData, saveAllEditData, updateEditData } from './services/supabaseDataService';
import { KPICard } from './components/KPICard';
import { DataTable } from './components/DataTable';
import { StackedBarChart } from './components/StackedBarChart';
import { PriorityKanban } from './components/PriorityKanban';
import { LoginPage } from './components/LoginPage';
import { InactivePage } from './components/InactivePage';
import { AdminUserManagement } from './components/AdminUserManagement';
import { AdminDataUpload } from './components/AdminDataUpload';
import { useAuth } from './contexts/AuthContext';
import { cn, formatCurrency } from './lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

type TabId = 'summary' | 'details' | 'admin-users' | 'admin-upload';

export default function App() {
  const { user, profile, loading: authLoading, isAdmin, isActive, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [detailView, setDetailView] = useState<'kanban' | 'table'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [delayReasonFilter, setDelayReasonFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [revenuePossibleFilter, setRevenuePossibleFilter] = useState('');
  const [cisManagerFilter, setCisManagerFilter] = useState('');
  const [purchaseManagerFilter, setPurchaseManagerFilter] = useState('');

  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const stats = useMemo(() => calculateStats(items), [items]);

  // Supabase에서 데이터 로드
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [dashboardItems, editDataFromDb] = await Promise.all([
          fetchDashboardItems(),
          fetchAllEditData(),
        ]);
        setItems(dashboardItems);
        // DB에서 가져온 편집 데이터가 있으면 병합
        if (Object.keys(editDataFromDb).length > 0) {
          setEditData(prev => {
            const merged: Record<string, EditableData> = {};
            dashboardItems.forEach(item => {
              merged[item.id] = editDataFromDb[item.id] || {
                productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '',
                revenuePossible: '확인중', revenuePossibleQuantity: item.remainingQuantity, delayReason: '', importance: '', productionSite: '',
                purchaseManager: '', note: '',
              };
            });
            return merged;
          });
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);



  const buildInitialEditData = useCallback(() => {
    const initial: Record<string, EditableData> = {};
    items.forEach(item => {
      initial[item.id] = {
        productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '',
        revenuePossible: '확인중', revenuePossibleQuantity: item.remainingQuantity, delayReason: '', importance: '', productionSite: '',
        purchaseManager: '', note: '',
      };
    });
    return initial;
  }, [items]);

  const [editData, setEditData] = useState<Record<string, EditableData>>(buildInitialEditData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'loading'>('idle');

  const CIS_MANAGERS = useMemo(() => [...new Set(items.map(i => i.cisManager).filter(Boolean))].sort(), [items]);
  const PURCHASE_MANAGERS = useMemo(() => {
    const managers = new Set<string>();
    Object.values(editData).forEach(ed => { if (ed?.purchaseManager) managers.add(ed.purchaseManager); });
    return [...managers].sort();
  }, [editData]);

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

  const refreshEditData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardItems, editDataFromDb] = await Promise.all([
        fetchDashboardItems(),
        fetchAllEditData(),
      ]);
      setItems(dashboardItems);
      const merged: Record<string, EditableData> = {};
      dashboardItems.forEach(item => {
        merged[item.id] = editDataFromDb[item.id] || {
          productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '',
          revenuePossible: '확인중', revenuePossibleQuantity: item.remainingQuantity, delayReason: '', importance: '',
          productionSite: '', purchaseManager: '', note: '',
        };
      });
      setEditData(merged);
      setSaveStatus('idle');
    } catch (err) {
      console.error('데이터 갱신 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpdateField = useCallback((id: string, field: keyof EditableData, value: string | number) => {
    setSaveStatus('idle');
    setEditData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('loading');
    try {
      await saveAllEditData(editData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('저장 실패:', err);
      setSaveStatus('idle');
    }
  }, [editData]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.salesDocument?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.managementType === categoryFilter;
      const row = editData[item.id];
      const matchesRevenuePossible = !revenuePossibleFilter || (row?.revenuePossible === revenuePossibleFilter);
      const matchesDelay = !delayReasonFilter || (row?.delayReason === delayReasonFilter);
      const matchesCisManager = !cisManagerFilter || item.cisManager.toLowerCase().includes(cisManagerFilter.toLowerCase());
      const matchesPurchaseManager = !purchaseManagerFilter || (row?.purchaseManager ?? '').toLowerCase().includes(purchaseManagerFilter.toLowerCase());
      return matchesSearch && matchesCategory && matchesRevenuePossible && matchesDelay && matchesCisManager && matchesPurchaseManager;
    });
  }, [items, searchTerm, categoryFilter, revenuePossibleFilter, delayReasonFilter, cisManagerFilter, purchaseManagerFilter, editData]);

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

  // 인증 가드
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">인증 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (!isActive) return <InactivePage />;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

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
              <h1 className="text-[30px] font-black tracking-tighter text-slate-900">
                📊 3월 중점관리 품목 <span className="text-emerald-600">대시보드</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-widest">Project 480억</span>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <p className="text-[13px] text-slate-400 font-medium italic">3월 중점관리 품목 실시간 현황</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">시스템 상태</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[15px] font-bold text-slate-700">실시간 동기화 중</span>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200" />
            <button
              onClick={() => { setSaveStatus('loading'); refreshEditData(); }}
              className="group bg-slate-900 text-white pl-4 pr-5 py-2.5 rounded-2xl text-sm font-bold hover:bg-emerald-600 transition-all duration-300 flex items-center gap-2 shadow-xl shadow-slate-200"
            >
              <RefreshCw className={cn("w-4 h-4 transition-transform duration-500", saveStatus === 'loading' ? "animate-spin" : "group-hover:rotate-180")} />
              데이터 갱신
            </button>
            <div className="h-10 w-px bg-slate-200" />
            {/* 사용자 정보 + 로그아웃 */}
            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full border-2 border-slate-200" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
              )}
              <div className="flex flex-col items-start">
                <span className="text-[13px] font-bold text-slate-700">{profile?.name || profile?.email}</span>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  {isAdmin && <Shield className="w-3 h-3 text-indigo-500" />}
                  {isAdmin ? '관리자' : '일반'}
                </span>
              </div>
              <button
                onClick={signOut}
                className="ml-1 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-8 flex gap-10">
          {[
            { id: 'summary', label: '종합현황', icon: LayoutDashboard },
            { id: 'details', label: '상세데이터', icon: List },
            ...(isAdmin ? [
              { id: 'admin-users', label: '회원관리', icon: Users },
              { id: 'admin-upload', label: '데이터 업로드', icon: Upload },
            ] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 py-5 text-[15px] font-black uppercase tracking-widest transition-all relative group",
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
                <h3 className="text-[18px] font-bold text-gray-900 mb-5">Top 10 고객사</h3>
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
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${idx < 3 ? 'bg-[#22C55E] text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {idx + 1}
                        </div>
                        <span className="text-[14px] font-semibold text-gray-700 w-16 shrink-0 truncate">{c.name}</span>
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className="text-[14px] font-bold text-gray-700 w-20 text-right shrink-0">{formatCurrency(total)}</span>
                        <span className={`text-[14px] font-bold px-2.5 py-1 rounded-full shrink-0 ${overallRate >= 100 ? 'bg-green-50 text-[#22C55E] border border-green-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>
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
                  <h3 className="text-[18px] font-bold text-gray-900">관리구분별 진도 현황</h3>
                  <span className="text-[13px] font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">실시간 분석</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-[15px] font-semibold text-gray-600">전체 진도 ({stats.overall.totalCount}건 / 480억)</span>
                    <span className={`text-[28px] font-bold ${editProgressRates.overall >= 100 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {editProgressRates.overall.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 bg-[#22C55E]"
                      style={{ width: `${Math.min(editProgressRates.overall, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[13px] text-gray-500">
                    <span>가능: {formatCurrency(stats.overall.possibleRevenue)}</span>
                    <span>{stats.overall.possibleCount} 품목</span>
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t border-gray-100 my-6" />

                {/* 진도율 추이 */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 style={{ fontSize: 18 }} className="font-bold text-gray-900">진도율 추이</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                        <span className="text-[13px] font-semibold text-gray-500">진도율</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 border-t-2 border-dashed border-gray-400" />
                        <span className="text-[13px] font-semibold text-gray-500">목표 100%</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 180 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 13, fontWeight: 500 }} dy={6} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 13, fontWeight: 500 }} domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax * 1.3, 30))]} dx={-6} />
                        <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', fontSize: 12 }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#9ca3af', fontSize: 10 }} />
                        <ReferenceLine y={100} stroke="#9ca3af" strokeDasharray="6 4" strokeWidth={1} />
                        <Line type="monotone" dataKey="rate" stroke="#22C55E" strokeWidth={2.5} dot={{ r: 4, fill: '#22C55E', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* 미니 카드 3개 */}
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center rounded-[10px] py-2.5 px-3.5" style={{ backgroundColor: '#F0FDF4' }}>
                      <div className="text-[13px] font-semibold text-gray-500 mb-1">현재 진도율</div>
                      <div className="text-[24px] font-bold text-[#22C55E]">{editProgressRates.overall.toFixed(0)}%</div>
                    </div>
                    <div className="text-center rounded-[10px] py-2.5 px-3.5" style={{ backgroundColor: '#F9FAFB' }}>
                      <div className="text-[13px] font-semibold text-gray-500 mb-1">목표</div>
                      <div className="text-[24px] font-bold text-gray-900">480억</div>
                    </div>
                    <div className="text-center rounded-[10px] py-2.5 px-3.5" style={{ backgroundColor: '#F9FAFB' }}>
                      <div className="text-[13px] font-semibold text-gray-500 mb-1">현재 매출</div>
                      <div className="text-[24px] font-bold text-gray-900">{formatCurrency(stats.overall.possibleRevenue)}</div>
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
                    <h3 className="text-[18px] font-bold text-gray-900">귀책부서별 지연 현황</h3>
                    <p className="text-[13px] text-gray-400 mt-0.5">귀책부서별 품목 수 및 매출 비중</p>
                  </div>
                  <span className="text-[13px] font-semibold bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
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
                          <span className="text-[14px] font-semibold text-gray-600 w-14 shrink-0">{dept.name}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${barWidth}%`, backgroundColor: DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length] }}
                            />
                          </div>
                          <span className="text-[14px] font-bold text-gray-700 w-12 text-right">{dept.count}건</span>
                          <span className="text-[13px] text-gray-400 w-20 text-right">{formatCurrency(dept.revenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'details' && (
          <div className="-mx-10 space-y-8 animate-in fade-in duration-700">
            {/* Hero Header */}
            {(() => {
              const getRate = (item: DashboardItem) => item.totalQuantity > 0 ? (item.orderQuantity / item.totalQuantity) * 100 : 0;
              const sangItems = filteredItems.filter(i => getRate(i) < 50);
              const jungItems = filteredItems.filter(i => getRate(i) >= 50 && getRate(i) < 80);
              const haItems = filteredItems.filter(i => getRate(i) >= 80);
              const avgRate = (arr: DashboardItem[]) => arr.length > 0 ? arr.reduce((s, i) => s + getRate(i), 0) / arr.length : 0;
              const totalRate = filteredItems.length > 0
                ? (filteredItems.reduce((s, i) => s + i.orderQuantity, 0) / filteredItems.reduce((s, i) => s + i.totalQuantity, 0)) * 100
                : 0;
              const totalRevenue = filteredItems.reduce((s, i) => s + getRevenue(i), 0);

              const cards = [
                { label: '상', count: sangItems.length, color: '#f87171' },
                { label: '중', count: jungItems.length, color: '#fbbf24' },
                { label: '하', count: haItems.length, color: '#4ade80' },
              ];

              return (
                <div className="bg-[#4B49AC] text-white relative overflow-hidden rounded-2xl mx-8">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />

                  {/* 상단: 제목 + 카드 */}
                  <div className="relative z-10 px-8 pt-8 pb-6 flex items-center justify-between">
                    <div>
                      <h2 className="text-[30px] font-black tracking-tight mb-1">중점 관리 품목 현황</h2>
                      <span className="text-white/70 font-semibold text-[15px]">총 {filteredItems.length}건</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {cards.map(c => (
                        <div key={c.label} className="px-5 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <div className="text-white/50 text-[13px] font-bold uppercase tracking-wider mb-1">{c.label}</div>
                          <div className="text-[24px] font-black" style={{ color: c.color }}>{c.count}<span className="text-[14px] font-semibold text-white/40 ml-0.5">건</span></div>
                        </div>
                      ))}
                      <div className="px-5 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <div className="text-white/50 text-[13px] font-bold uppercase tracking-wider mb-1">총 매출</div>
                        <div className="text-[24px] font-black" style={{ color: '#a5b4fc' }}>{formatCurrency(totalRevenue)}</div>
                      </div>
                    </div>
                  </div>

                  {/* 하단: 전체진도율(좌) + 상중하 달성률(우) */}
                  <div className="relative z-10 px-8 pb-8 pt-0">
                    <div className="border-t border-white/10 pt-6" />
                    <div className="grid grid-cols-5 gap-4">
                      {/* 전체 진도율 - 크게 */}
                      <div className="col-span-3 rounded-xl px-6 py-6 flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <div>
                            <div className="text-[18px] font-bold text-white/90">전체 진도율</div>
                            <div className="text-[14px] font-semibold text-white/40">{filteredItems.length}건 전체</div>
                          </div>
                          <span className="text-[48px] font-black" style={{ color: '#a5b4fc' }}>{totalRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(totalRate, 100)}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }}
                          />
                        </div>
                        <div className="flex justify-between mt-3 text-[13px] text-white/40 font-semibold">
                          <span>총 매출: {formatCurrency(totalRevenue)}</span>
                          <span>목표 대비 {(totalRevenue / 48000000000 * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      {/* 상/중/하 달성률 */}
                      <div className="col-span-2 flex flex-col gap-3">
                        {[
                          { label: '상 달성률', sub: `${sangItems.length}건 긴급`, rate: avgRate(sangItems), gradient: 'linear-gradient(90deg, #e8354a, #f87171)', color: '#f87171', dot: '🔴' },
                          { label: '중 달성률', sub: `${jungItems.length}건 주의`, rate: avgRate(jungItems), gradient: 'linear-gradient(90deg, #d4880a, #fbbf24)', color: '#fbbf24', dot: '🟡' },
                          { label: '하 달성률', sub: `${haItems.length}건 양호`, rate: avgRate(haItems), gradient: 'linear-gradient(90deg, #16a34a, #4ade80)', color: '#4ade80', dot: '🟢' },
                        ].map((bar, idx) => (
                          <div key={idx} className="rounded-xl px-5 py-3 flex-1 flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="text-[14px] font-bold text-white/90">{bar.dot} {bar.label}</div>
                                <div className="text-[12px] font-semibold text-white/40">{bar.sub}</div>
                              </div>
                              <span className="text-[22px] font-black" style={{ color: bar.color }}>{bar.rate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(bar.rate, 100)}%`, background: bar.gradient }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Image-style Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-8 gap-6 bg-white p-8 border-y border-slate-200/60">
              <div className="space-y-2 md:col-span-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">검색 (자재/내역/고객약호)</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="검색어 입력..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">매출 가능여부</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  value={revenuePossibleFilter}
                  onChange={(e) => setRevenuePossibleFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  <option value="O">O (가능)</option>
                  <option value="X">X (불가능)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">지연사유</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
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
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">납기일</label>
                <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none">
                  <option>전체</option>
                  <option>2026-03</option>
                  <option>2026-04</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">CIS담당</label>
                <input
                  type="text"
                  placeholder="이름 검색..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={cisManagerFilter}
                  onChange={(e) => setCisManagerFilter(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">구매담당</label>
                <input
                  type="text"
                  placeholder="이름 검색..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={purchaseManagerFilter}
                  onChange={(e) => setPurchaseManagerFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white overflow-hidden">
              <DataTable items={filteredItems} editData={editData} onUpdateField={handleUpdateField} onSave={handleSave} saveStatus={saveStatus} isAdmin={isAdmin} />
            </div>
          </div>
        )}

        {activeTab === 'admin-users' && isAdmin && (
          <AdminUserManagement />
        )}

        {activeTab === 'admin-upload' && isAdmin && (
          <AdminDataUpload />
        )}
      </main>

      <footer className="max-w-[1600px] mx-auto px-8 py-12 border-t border-slate-200 text-slate-400 text-[13px] font-medium flex justify-between items-center">
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
