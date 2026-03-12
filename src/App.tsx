import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LayoutDashboard, Package, AlertTriangle, List, Search, Filter, RefreshCw, ChevronRight, Shield, Upload, LogOut, Users } from 'lucide-react';
import { DashboardItem, SummaryStats, EditableData } from './types';
import { calculateStats, getRevenue, getMaterialByCustomer } from './services/dataService';
import { fetchDashboardItems, fetchAllEditData, saveAllEditData, updateEditData, fetchAvailableMonths } from './services/supabaseDataService';
import { KPICard } from './components/KPICard';
import { DataTable } from './components/DataTable';
import { StackedBarChart } from './components/StackedBarChart';
import { DonutChart } from './components/DonutChart';
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
  const [midCategoryFilter, setMidCategoryFilter] = useState('');

  const [items, setItems] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 월 관리
  const [availableMonths, setAvailableMonths] = useState<string[]>(['2026-03']);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-03');
  const currentMonth = new Date().toISOString().slice(0, 7); // e.g. '2026-03'
  const isReadOnly = selectedMonth < currentMonth;

  // 월 목록 로드
  useEffect(() => {
    fetchAvailableMonths().then(months => {
      setAvailableMonths(months);
      // 현재 월이 목록에 있으면 선택, 아니면 최신 월
      if (months.includes(currentMonth)) {
        setSelectedMonth(currentMonth);
      } else {
        setSelectedMonth(months[months.length - 1]);
      }
    });
  }, []);

  // Supabase에서 월별 데이터 로드
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [dashboardItems, editDataFromDb] = await Promise.all([
          fetchDashboardItems(selectedMonth),
          fetchAllEditData(selectedMonth),
        ]);
        setItems(dashboardItems);
        // DB에서 가져온 편집 데이터가 있으면 병합
        if (Object.keys(editDataFromDb).length > 0) {
          const merged: Record<string, EditableData> = {};
          dashboardItems.forEach(item => {
            merged[item.id] = editDataFromDb[item.id] || {
              productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '',
              revenuePossible: '확인중', revenuePossibleQuantity: item.remainingQuantity, delayReason: '', importance: '', productionSite: '',
              purchaseManager: '', note: '',
            };
          });
          setEditData(merged);
          setSavedEditData(merged);
        }
      } catch (err) {
        console.error('데이터 로드 실패:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedMonth]);



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
  const [savedEditData, setSavedEditData] = useState<Record<string, EditableData>>(buildInitialEditData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'loading'>('idle');
  const stats = useMemo(() => calculateStats(items, editData), [items, editData]);

  const MID_CATEGORIES = useMemo(() => [...new Set(items.map(i => i.category).filter(Boolean))].sort(), [items]);
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
        fetchDashboardItems(selectedMonth),
        fetchAllEditData(selectedMonth),
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
      setSavedEditData(merged);
      setSaveStatus('idle');
      // 월 목록도 갱신
      const months = await fetchAvailableMonths();
      setAvailableMonths(months);
    } catch (err) {
      console.error('데이터 갱신 실패:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  const handleUpdateField = useCallback((id: string, field: keyof EditableData, value: string | number) => {
    setSaveStatus('idle');
    setEditData(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('loading');
    try {
      await saveAllEditData(editData, selectedMonth);
      setSavedEditData(editData);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      alert(`저장 실패: ${err.message}`);
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
      const matchesMidCategory = !midCategoryFilter || item.category === midCategoryFilter;
      const row = editData[item.id];
      const actualRevenuePossible = row?.revenuePossible || '확인중';
      const matchesRevenuePossible = !revenuePossibleFilter || (actualRevenuePossible === revenuePossibleFilter);
      const matchesDelay = !delayReasonFilter || (row?.delayReason === delayReasonFilter);
      const matchesCisManager = !cisManagerFilter || item.cisManager.toLowerCase().includes(cisManagerFilter.toLowerCase());
      const matchesPurchaseManager = !purchaseManagerFilter || (row?.purchaseManager ?? '').toLowerCase().includes(purchaseManagerFilter.toLowerCase());
      return matchesSearch && matchesCategory && matchesMidCategory && matchesRevenuePossible && matchesDelay && matchesCisManager && matchesPurchaseManager;
    }).sort((a, b) => {
      const order: Record<string, number> = { '불가능': 0, '확인중': 1, '가능': 2 };
      const aStatus = savedEditData[a.id]?.revenuePossible || '확인중';
      const bStatus = savedEditData[b.id]?.revenuePossible || '확인중';
      return (order[aStatus] ?? 1) - (order[bStatus] ?? 1);
    });
  }, [items, searchTerm, categoryFilter, midCategoryFilter, revenuePossibleFilter, delayReasonFilter, cisManagerFilter, purchaseManagerFilter, editData, savedEditData]);

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
      const totalRevenue = filtered.reduce((s, i) => s + getRevenue(i), 0);
      const possibleItems = filtered.filter(i => {
        const v = (editData[i.id]?.revenuePossible || '').trim().toLowerCase();
        return v === '가능' || v === 'o';
      });
      const possibleRevenue = possibleItems.reduce((s, i) => s + (editData[i.id]?.revenuePossibleQuantity ?? i.remainingQuantity) * i.unitPrice, 0);
      return totalRevenue > 0 ? (possibleRevenue / totalRevenue) * 100 : 0;
    };
    const customerCodes = customerChartData.map(c => c.name);
    return customerCodes.map(code => {
      const cItems = items.filter(i => i.customerCode === code);
      return {
        name: code,
        rate: calcRate(cItems),
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
    <div className="min-h-screen bg-[#f5f6fa] font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-[30px] font-black tracking-tighter text-slate-900">
                📊 {parseInt(selectedMonth.split('-')[1])}월 중점관리 품목 <span className="text-emerald-600">대시보드</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[13px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-widest">Project {(stats.overall.totalRevenue / 100000000).toFixed(0)}억</span>
                <div className="w-1 h-1 rounded-full bg-slate-300" />
                <p className="text-[13px] text-slate-400 font-medium italic">{parseInt(selectedMonth.split('-')[1])}월 중점관리 품목 실시간 현황</p>
                {isReadOnly && <span className="text-[11px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">읽기전용</span>}
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

        {/* 월별 시트 탭 (엑셀 스타일) */}
        <div className="max-w-[1600px] mx-auto px-8 flex items-center gap-1 pt-2 pb-0">
          {availableMonths.map(month => {
            const m = parseInt(month.split('-')[1]);
            const isActive = month === selectedMonth;
            const isPast = month < currentMonth;
            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={cn(
                  "px-4 py-2 text-[13px] font-bold rounded-t-lg border border-b-0 transition-all relative",
                  isActive
                    ? "bg-white text-slate-900 border-slate-200 z-10 -mb-px"
                    : isPast
                      ? "bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100"
                      : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-white"
                )}
              >
                {m}월 중점관리품목
                {isPast && <span className="ml-1 text-[10px] text-amber-500">📋</span>}
              </button>
            );
          })}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-10">
        {activeTab === 'summary' && (() => {
          const goalRate = stats.overall.totalRevenue > 0 ? (stats.overall.possibleRevenue / stats.overall.totalRevenue) * 100 : 0;
          // 매출구성: 고정값
          const normalRevenue = 116000000000;   // 1,160억
          const additionalRevenue = 4000000000; // 40억 (중점관리품목)
          const totalComposition = normalRevenue + additionalRevenue;
          const normalPct = (normalRevenue / totalComposition) * 100;     // 96.7%
          const additionalPct = (additionalRevenue / totalComposition) * 100; // 3.3%

          const cardStyle: React.CSSProperties = { borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.03)' };

          return (
          <div style={{ gap: 20, display: 'flex', flexDirection: 'column' as const }}>
            {/* 1행 — 매출현황(도넛) + 진도현황 (1:1) */}
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 20 }}>
              {/* 매출현황 도넛 차트 */}
              <DonutChart
                totalRevenue={stats.overall.totalRevenue}
                totalCount={stats.overall.totalCount}
                checkingRevenue={stats.overall.checkingRevenue}
                checkingCount={stats.overall.checkingCount}
                possibleRevenue={stats.overall.possibleRevenue}
                possibleCount={stats.overall.possibleCount}
                impossibleRevenue={stats.overall.impossibleRevenue}
                impossibleCount={stats.overall.impossibleCount}
              />

              {/* 진도현황 */}
              <div className="bg-white flex flex-col" style={{ ...cardStyle, padding: 20 }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold text-gray-800">진도현황</h3>
                  <span className="text-[11px] font-medium bg-gray-50 text-gray-400 px-2 py-0.5 rounded-md">실시간</span>
                </div>
                {/* 목표 대비 가능금액 */}
                <div className="mb-3">
                  <div className="flex justify-between items-end mb-1.5">
                    <span className="text-[12px] font-medium text-gray-400">목표 대비 가능금액 ({formatCurrency(stats.overall.possibleRevenue)} / {formatCurrency(stats.overall.totalRevenue)})</span>
                    <span className={`text-[24px] font-extrabold ${goalRate >= 100 ? 'text-indigo-500' : 'text-red-400'}`}>
                      {goalRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(goalRate, 100)}%`, backgroundColor: '#6366f1' }} />
                  </div>
                </div>

                {/* 진도율 추이 라인 차트 */}
                <div className="border-t border-gray-50 pt-3 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] font-semibold text-gray-700">진도율 추이</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#6366f1' }} />
                        <span className="text-[11px] text-gray-400">진도율</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 border-t border-dashed border-gray-300" />
                        <span className="text-[11px] text-gray-400">목표</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 130 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#b0b0b0', fontSize: 11 }} dy={4} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#b0b0b0', fontSize: 11 }} domain={[0, (dataMax: number) => Math.ceil(Math.max(dataMax * 1.3, 30))]} dx={-4} />
                        <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8, color: '#fff', padding: '5px 10px', fontSize: 11 }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#9ca3af', fontSize: 10 }} />
                        <ReferenceLine y={100} stroke="#d1d5db" strokeDasharray="6 4" strokeWidth={1} />
                        <Line type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 하단 3개 스탯 박스 */}
                <div className="grid grid-cols-3 mt-3" style={{ gap: 8 }}>
                  <div className="text-center py-2.5 px-2" style={{ backgroundColor: '#eef2ff', borderRadius: 8 }}>
                    <div className="text-[11px] font-medium text-gray-400 mb-0.5">현재 진도율</div>
                    <div className="text-[18px] font-extrabold text-indigo-500">{editProgressRates.overall.toFixed(0)}%</div>
                  </div>
                  <div className="text-center py-2.5 px-2" style={{ backgroundColor: '#f8f9fb', borderRadius: 8 }}>
                    <div className="text-[11px] font-medium text-gray-400 mb-0.5">매출금액</div>
                    <div className="text-[18px] font-extrabold text-gray-800">{(stats.overall.totalRevenue / 100000000).toFixed(0)}억</div>
                  </div>
                  <div className="text-center py-2.5 px-2" style={{ backgroundColor: '#f8f9fb', borderRadius: 8 }}>
                    <div className="text-[11px] font-medium text-gray-400 mb-0.5">현재 매출</div>
                    <div className="text-[18px] font-extrabold text-gray-800">{formatCurrency(stats.overall.possibleRevenue)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3행 — Top10 고객사 + 귀책부서별 지연현황 (1:1) */}
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 20 }}>
              {/* Top10 고객사 */}
              <div className="bg-white" style={{ ...cardStyle, padding: 20 }}>
                <h3 className="text-[14px] font-bold text-gray-800 mb-4">Top 10 고객사</h3>
                <div className="space-y-0.5">
                  {customerChartData.slice(0, 10).map((c, idx) => {
                    const total = c.가능 + c.확인중 + c.불가능;
                    const maxTotal = customerChartData[0] ? customerChartData[0].가능 + customerChartData[0].확인중 + customerChartData[0].불가능 : 1;
                    const barWidth = (total / maxTotal) * 100;
                    return (
                      <div key={c.name} className="flex items-center gap-2.5" style={{ height: 36 }}>
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            backgroundColor: idx < 3 ? '#6366f1' : '#f1f3f5',
                            color: idx < 3 ? '#fff' : '#9ca3af',
                          }}
                        >
                          {idx + 1}
                        </div>
                        <span className="text-[12px] font-medium text-gray-600 w-12 shrink-0 truncate">{c.name}</span>
                        <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                          <div
                            className="h-full rounded transition-all duration-500"
                            style={{ width: `${barWidth}%`, backgroundColor: idx < 3 ? '#818cf8' : '#cbd5e1' }}
                          />
                        </div>
                        <span className="text-[13px] font-bold text-gray-700 w-16 text-right shrink-0">{formatCurrency(total)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 귀책부서별 지연현황 */}
              <div className="bg-white" style={{ ...cardStyle, padding: 20 }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold text-gray-800">귀책부서별 지연현황</h3>
                  <span className="text-[11px] font-medium bg-gray-50 text-gray-400 px-2 py-0.5 rounded-md">
                    총 {delayByDeptData.reduce((s, d) => s + d.count, 0)}건
                  </span>
                </div>
                {delayByDeptData.length === 0 || delayByDeptData.reduce((s, d) => s + d.count, 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center" style={{ height: 240 }}>
                    <span className="text-[48px] font-bold text-gray-200">0</span>
                    <span className="text-[13px] text-gray-400 mt-1">지연 없음</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {delayByDeptData.map((dept, idx) => {
                      const maxCount = delayByDeptData[0]?.count || 1;
                      const barWidth = (dept.count / maxCount) * 100;
                      return (
                        <div key={dept.name} className="flex items-center gap-2.5">
                          <span className="text-[12px] font-medium text-gray-500 w-10 shrink-0">{dept.name}</span>
                          <div className="flex-1 h-4 bg-gray-50 rounded overflow-hidden">
                            <div
                              className="h-full rounded transition-all duration-500"
                              style={{ width: `${barWidth}%`, backgroundColor: DELAY_DEPT_COLORS[idx % DELAY_DEPT_COLORS.length], opacity: 0.75 }}
                            />
                          </div>
                          <span className="text-[13px] font-bold text-gray-600 w-8 text-right">{dept.count}건</span>
                          <span className="text-[11px] text-gray-400 w-16 text-right">{formatCurrency(dept.revenue)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
          );
        })()}

        {activeTab === 'details' && (
          <div className="-mx-10 space-y-8 animate-in fade-in duration-700">
            {/* Hero Header */}
            {(() => {
              const getRate = (item: DashboardItem) => item.totalQuantity > 0 ? (item.orderQuantity / item.totalQuantity) * 100 : 0;
              const getImportance = (item: DashboardItem) => editData[item.id]?.importance || '';
              const isRevenuePossible = (item: DashboardItem) => {
                const v = (editData[item.id]?.revenuePossible ?? '').trim().toLowerCase();
                return v === 'o' || v === '가능';
              };
              const sangItems = filteredItems.filter(i => getImportance(i) === '상');
              const jungItems = filteredItems.filter(i => getImportance(i) === '중');
              const haItems = filteredItems.filter(i => getImportance(i) === '하');
              const avgRate = (arr: DashboardItem[]) => {
                if (arr.length === 0) return 0;
                const possibleCount = arr.filter(isRevenuePossible).length;
                return (possibleCount / arr.length) * 100;
              };
              const totalRemaining = filteredItems.reduce((s, i) => s + i.remainingQuantity, 0);
              const possibleRemaining = filteredItems.filter(isRevenuePossible).reduce((s, i) => s + i.remainingQuantity, 0);
              const totalRate = totalRemaining > 0 ? (possibleRemaining / totalRemaining) * 100 : 0;
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
                          <span>{filteredItems.length}건 중 매출가능 {filteredItems.filter(i => { const v = (editData[i.id]?.revenuePossible ?? '').trim().toLowerCase(); return v === 'o' || v === '가능'; }).length}건</span>
                        </div>
                      </div>
                      {/* 상/중/하 달성률 */}
                      <div className="col-span-2 flex flex-col gap-3">
                        {[
                          { label: '상 달성률', sub: `${sangItems.length}건 긴급`, rate: avgRate(sangItems), revenue: sangItems.reduce((s, i) => s + getRevenue(i), 0), gradient: 'linear-gradient(90deg, #e8354a, #f87171)', color: '#f87171', dot: '🔴' },
                          { label: '중 달성률', sub: `${jungItems.length}건 주의`, rate: avgRate(jungItems), revenue: jungItems.reduce((s, i) => s + getRevenue(i), 0), gradient: 'linear-gradient(90deg, #d4880a, #fbbf24)', color: '#fbbf24', dot: '🟡' },
                          { label: '하 달성률', sub: `${haItems.length}건 양호`, rate: avgRate(haItems), revenue: haItems.reduce((s, i) => s + getRevenue(i), 0), gradient: 'linear-gradient(90deg, #16a34a, #4ade80)', color: '#4ade80', dot: '🟢' },
                        ].map((bar, idx) => (
                          <div key={idx} className="rounded-xl px-5 py-3 flex-1 flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="text-[14px] font-bold text-white/90">{bar.dot} {bar.label}</div>
                                <div className="text-[12px] font-semibold text-white/40">{bar.sub}</div>
                              </div>
                              <div className="text-right">
                                <span className="text-[22px] font-black" style={{ color: bar.color }}>{bar.rate.toFixed(1)}%</span>
                                <div className="text-[12px] font-semibold text-white/50">{formatCurrency(bar.revenue)}</div>
                              </div>
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
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-9 gap-6 bg-white p-8 border-y border-slate-200/60">
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
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">중분류</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  value={midCategoryFilter}
                  onChange={(e) => setMidCategoryFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  {MID_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
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
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">매출 가능여부</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all appearance-none"
                  value={revenuePossibleFilter}
                  onChange={(e) => setRevenuePossibleFilter(e.target.value)}
                >
                  <option value="">전체</option>
                  <option value="가능">가능</option>
                  <option value="불가능">불가능</option>
                  <option value="확인중">확인중</option>
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
            </div>

            <div className="bg-white overflow-hidden">
              <DataTable items={filteredItems} editData={editData} onUpdateField={handleUpdateField} onSave={handleSave} saveStatus={saveStatus} isAdmin={isAdmin} readOnly={isReadOnly} />
            </div>
          </div>
        )}

        {activeTab === 'admin-users' && isAdmin && (
          <AdminUserManagement />
        )}

        {activeTab === 'admin-upload' && isAdmin && (
          <AdminDataUpload selectedMonth={selectedMonth} onMonthUploaded={(month) => {
            if (!availableMonths.includes(month)) {
              setAvailableMonths(prev => [...prev, month].sort());
            }
            setSelectedMonth(month);
          }} />
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
