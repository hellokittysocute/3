import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { LayoutDashboard, Package, AlertTriangle, List, Search, Filter, RefreshCw, ChevronRight, Shield, Upload, LogOut, Users, Camera, Clock } from 'lucide-react';
import { DashboardItem, SummaryStats, EditableData } from './types';
import { calculateStats, getRevenue, getMaterialByCustomer } from './services/dataService';
import { fetchDashboardItems, fetchAllEditData, saveAllEditData, updateEditData, fetchAvailableMonths, createSnapshot, hasSnapshotForMonth } from './services/supabaseDataService';
import { KPICard } from './components/KPICard';
import { DataTable } from './components/DataTable';
import { StackedBarChart } from './components/StackedBarChart';
import { DonutChart } from './components/DonutChart';
import { PriorityKanban } from './components/PriorityKanban';
import { LoginPage } from './components/LoginPage';
import { InactivePage } from './components/InactivePage';
import { AdminUserManagement } from './components/AdminUserManagement';
import { AdminDataUpload } from './components/AdminDataUpload';
import { DelayByDeptCard } from './components/DelayByDeptCard';
import { NoReplyCard } from './components/NoReplyCard';
import { Top10CustomerCard } from './components/Top10CustomerCard';
import { DrilldownModal } from './components/DrilldownModal';
import { SnapshotHistory } from './components/SnapshotHistory';
import { useAuth } from './contexts/AuthContext';
import { cn, formatCurrency, addWorkingDays } from './lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

type TabId = 'summary' | 'details' | 'delay' | 'snapshots' | 'admin-users' | 'admin-upload';

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
  const [dueDateFilter, setDueDateFilter] = useState('');

  // 드릴다운 모달 상태
  const [customerModal, setCustomerModal] = useState<string | null>(null); // customerCode
  const [delayDeptModal, setDelayDeptModal] = useState<string | null>(null); // deptName

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
        const merged: Record<string, EditableData> = {};
        dashboardItems.forEach(item => {
          merged[item.id] = editDataFromDb[item.id] || {
            writeDate: '', productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '', materialSettingFilledAt: '', manufacturingFilledAt: '', packagingFilledAt: '',
            revenuePossible: '확인중', revenuePossibleQuantity: 0, delayReason: '', importance: '', productionSite: '',
            purchaseManager: '', note: '',
          };
        });
        setEditData(merged);
        setSavedEditData(merged);
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
        writeDate: '', productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '', materialSettingFilledAt: '', manufacturingFilledAt: '', packagingFilledAt: '',
        revenuePossible: '확인중', revenuePossibleQuantity: 0, delayReason: '', importance: '', productionSite: '',
        purchaseManager: '', note: '',
      };
    });
    return initial;
  }, [items]);

  const [editData, setEditData] = useState<Record<string, EditableData>>(buildInitialEditData);
  const [savedEditData, setSavedEditData] = useState<Record<string, EditableData>>(buildInitialEditData);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'loading'>('idle');
  const [snapshotStatus, setSnapshotStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // stats는 filteredItems 정의 후 계산 (검색 결과 반영)

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
      const totalPossibleQty = filtered.reduce((s, i) => s + (editData[i.id]?.revenuePossibleQuantity || 0), 0);
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
          writeDate: '', productionCompleteDate: '', materialSettingDate: '', manufacturingDate: '', packagingDate: '', materialSettingFilledAt: '', manufacturingFilledAt: '', packagingFilledAt: '',
          revenuePossible: '확인중', revenuePossibleQuantity: 0, delayReason: '', importance: '',
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
    const today = `${new Date().getMonth() + 1}/${new Date().getDate()}`;
    setEditData(prev => {
      const old = prev[id] || {} as EditableData;
      const updated = { ...old, [field]: value };
      // 매출가능여부를 '가능' 외로 바꾸면 매출가능수량 삭제
      if (field === 'revenuePossible' && value !== '가능') {
        updated.revenuePossibleQuantity = 0;
      }
      // 빈 값 → 입력 시 filledAt 타임스탬프 자동 기록
      if (field === 'materialSettingDate' && !old.materialSettingDate && value) {
        updated.materialSettingFilledAt = today;
      }
      if (field === 'manufacturingDate' && !old.manufacturingDate && value) {
        updated.manufacturingFilledAt = today;
      }
      if (field === 'packagingDate' && !old.packagingDate && value) {
        updated.packagingFilledAt = today;
      }
      // 값 삭제 시 filledAt도 초기화
      if (field === 'materialSettingDate' && !value) updated.materialSettingFilledAt = '';
      if (field === 'manufacturingDate' && !value) updated.manufacturingFilledAt = '';
      if (field === 'packagingDate' && !value) updated.packagingFilledAt = '';
      return { ...prev, [id]: updated };
    });
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

  const handleSnapshot = useCallback(async () => {
    const [y, m] = selectedMonth.split('-');
    const defaultLabel = `${y}년 ${parseInt(m)}월 마감`;
    const label = prompt('스냅샷 이름을 입력하세요:', defaultLabel);
    if (!label) return;
    setSnapshotStatus('saving');
    try {
      const result = await createSnapshot(
        selectedMonth,
        label,
        items,
        editData,
        profile?.name || profile?.email || 'unknown',
      );
      if (result) {
        setSnapshotStatus('saved');
        setTimeout(() => setSnapshotStatus('idle'), 2000);
      }
    } catch (err: any) {
      alert(`스냅샷 저장 실패: ${err.message}`);
      setSnapshotStatus('idle');
    }
  }, [selectedMonth, items, editData, profile]);

  // 월 변경 시 이전 월 자동 스냅샷
  const prevMonthRef = React.useRef(selectedMonth);
  useEffect(() => {
    const prev = prevMonthRef.current;
    prevMonthRef.current = selectedMonth;
    if (prev && prev !== selectedMonth && prev < currentMonth) {
      hasSnapshotForMonth(prev).then(exists => {
        if (!exists && items.length > 0) {
          createSnapshot(prev, `${prev} 자동 마감`, items, savedEditData, '시스템(자동)');
        }
      });
    }
  }, [selectedMonth]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.salesDocument?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerCode.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !categoryFilter || item.managementType === categoryFilter;
      const matchesMidCategory = !midCategoryFilter || item.category.toLowerCase().includes(midCategoryFilter.toLowerCase());
      const row = editData[item.id];
      const actualRevenuePossible = row?.revenuePossible || '확인중';
      const matchesRevenuePossible = !revenuePossibleFilter || actualRevenuePossible.toLowerCase().includes(revenuePossibleFilter.toLowerCase());
      const matchesDelay = !delayReasonFilter || (row?.delayReason ?? '').toLowerCase().includes(delayReasonFilter.toLowerCase());
      const matchesCisManager = !cisManagerFilter || item.cisManager.toLowerCase().includes(cisManagerFilter.toLowerCase());
      const matchesPurchaseManager = !purchaseManagerFilter || (row?.purchaseManager ?? '').toLowerCase().includes(purchaseManagerFilter.toLowerCase());
      const matchesDueDate = !dueDateFilter || item.changedDueDate.toLowerCase().includes(dueDateFilter.toLowerCase());
      return matchesSearch && matchesCategory && matchesMidCategory && matchesRevenuePossible && matchesDelay && matchesCisManager && matchesPurchaseManager && matchesDueDate;
    }).sort((a, b) => {
      const order: Record<string, number> = { '불가능': 0, '확인중': 1, '가능': 2 };
      const aStatus = savedEditData[a.id]?.revenuePossible || '확인중';
      const bStatus = savedEditData[b.id]?.revenuePossible || '확인중';
      return (order[aStatus] ?? 1) - (order[bStatus] ?? 1);
    });
  }, [items, searchTerm, categoryFilter, midCategoryFilter, revenuePossibleFilter, delayReasonFilter, cisManagerFilter, purchaseManagerFilter, dueDateFilter, editData, savedEditData]);

  const stats = useMemo(() => calculateStats(filteredItems, editData), [filteredItems, editData]);

  const hasActiveFilter = !!(searchTerm || categoryFilter || midCategoryFilter || revenuePossibleFilter || delayReasonFilter || cisManagerFilter || purchaseManagerFilter || dueDateFilter);

  // 미회신 판단: 작성일자 + 워킹데이 3일 후 마감일 기준
  const CREATION_DATE = new Date(2026, 2, 20); // 2026-03-20 (고정값, 추후 동적 변경 가능)
  const DELAY_DEADLINE = addWorkingDays(CREATION_DATE, 3); // 2026-03-25

  const delayedIds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < DELAY_DEADLINE) return new Set<string>();
    const ids = new Set<string>();
    items.forEach(item => {
      if (item.materialSource?.trim() === '사급') return;
      const ed = editData[item.id];
      if ((ed?.purchaseManager ?? '').trim() === '사급') return;
      const mat = (ed?.materialSettingDate ?? '').trim();
      const mfg = (ed?.manufacturingDate ?? '').trim();
      const pkg = (ed?.packagingDate ?? '').trim();
      if (!mat || !mfg || !pkg) ids.add(item.id);
    });
    return ids;
  }, [items, editData]);

  // Chart data preparation
  const customerChartData = useMemo(() => {
    const customerMap: Record<string, { 가능: number; 확인중: number; 불가능: number }> = {};
    items.forEach(i => {
      if (!customerMap[i.customerCode]) customerMap[i.customerCode] = { 가능: 0, 확인중: 0, 불가능: 0 };
      const rev = getRevenue(i);
      if (i.status === '가능') customerMap[i.customerCode].가능 += rev;
      else if (i.status === '불가능') customerMap[i.customerCode].불가능 += rev;
      else customerMap[i.customerCode].확인중 += rev;
    });
    const all = Object.entries(customerMap)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.가능 + b.확인중 + b.불가능) - (a.가능 + a.확인중 + a.불가능));
    const top5 = all.slice(0, 10);
    const rest = all.slice(10);
    if (rest.length > 0) {
      top5.push({
        name: '기타',
        가능: rest.reduce((s, c) => s + c.가능, 0),
        확인중: rest.reduce((s, c) => s + c.확인중, 0),
        불가능: rest.reduce((s, c) => s + c.불가능, 0),
      });
    }
    return top5;
  }, [items]);

  // 고객사별 관리구분 달성률 (매출가능수량 / 미납잔량)
  const customerRateData = useMemo(() => {
    const calcRate = (filtered: DashboardItem[]) => {
      const totalRevenue = filtered.reduce((s, i) => s + getRevenue(i), 0);
      const possibleItems = filtered.filter(i => {
        const v = (editData[i.id]?.revenuePossible || '').trim().toLowerCase();
        return v === '가능' || v === 'o';
      });
      const possibleRevenue = possibleItems.reduce((s, i) => s + (editData[i.id]?.revenuePossibleQuantity || 0) * i.unitPrice, 0);
      return totalRevenue > 0 ? (possibleRevenue / totalRevenue) * 100 : 0;
    };
    const top10Codes = customerChartData.filter(c => c.name !== '기타').map(c => c.name);
    const result = top10Codes.map(code => ({
      name: code,
      rate: calcRate(items.filter(i => i.customerCode === code)),
    }));
    if (customerChartData.some(c => c.name === '기타')) {
      const restItems = items.filter(i => !top10Codes.includes(i.customerCode));
      result.push({ name: '기타', rate: calcRate(restItems) });
    }
    return result;
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

  const EXCLUDE_DEPTS = ['물류', '연구소'];
  const delayByDeptData = useMemo(() => {
    const deptMap: Record<string, { count: number; revenue: number }> = {};
    items.forEach(item => {
      const dept = (editData[item.id]?.delayReason || '').trim();
      if (!dept || EXCLUDE_DEPTS.includes(dept)) return;
      if (!deptMap[dept]) deptMap[dept] = { count: 0, revenue: 0 };
      deptMap[dept].count += 1;
      deptMap[dept].revenue += getRevenue(item);
    });
    return Object.entries(deptMap)
      .map(([name, v]) => ({ name, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count);
  }, [items, editData]);

  const noReplyData = useMemo(() => {
    // 제조 담당자 매핑 (정확히 일치)
    const MFG_EXACT: Record<string, string[]> = {
      '겔마스크': ['정진영'], '기초': ['이정훈', '홍경의'],
      '립글로즈': ['장건수'], '마스카라': ['장건수'],
      '마스크시트': ['이정훈'], '붓펜': ['장건수'], '아이패치': ['정진영'],
      '에어쿠션': ['홍경의'], '캔': ['이정훈'], '튜브': ['이정훈', '홍경의'],
      '틴트/컨실러': ['장건수'],
    };
    // 제조 담당자 매핑 (부분 일치 — 순서대로 검사)
    const MFG_INCLUDES: [string, string[]][] = [
      ['스틱밤', ['이정훈', '홍경의']], // 스틱밤+립 예외는 getMfgManagers에서 처리
      ['견본', ['이정훈', '홍경의']],
      ['립스틱', ['장건수']],
      ['파우더', ['정진숙']],
    ];
    // 충포장 담당자 매핑 (정확히 일치)
    const PKG_EXACT: Record<string, string[]> = {
      '겔마스크': ['정진영'], '견본': ['조선혜', '오정훈'],
      '기초': ['송하림', '장재호', '송수빈'],
      '립글로즈': ['오승연'], '립스틱': ['장철환'], '마스카라': ['장철환'],
      '마스크시트': ['오정훈'], '붓펜': ['장철환'], '아이패치': ['정진영'],
      '에어쿠션': ['장승상'], '캔': ['오정훈'], '튜브': ['박수진', '송진우'],
      '틴트/컨실러': ['오승연'], '스틱밤': ['장철환'],
    };
    // 충포장 담당자 매핑 (부분 일치)
    const PKG_INCLUDES: [string, string[]][] = [
      ['견본', ['조선혜', '오정훈']],
      ['립스틱', ['장철환']],
      ['파우더', ['원대한']],
      ['스틱밤', ['장철환']],
    ];

    const getMfgManagers = (cat: string, itemName: string): string[] => {
      if (cat.includes('스틱밤') && itemName.includes('립')) return ['장건수'];
      if (MFG_EXACT[cat]) return MFG_EXACT[cat];
      for (const [keyword, managers] of MFG_INCLUDES) {
        if (cat.includes(keyword)) return managers;
      }
      return ['미지정'];
    };
    const getPkgManagers = (cat: string): string[] => {
      if (PKG_EXACT[cat]) return PKG_EXACT[cat];
      for (const [keyword, managers] of PKG_INCLUDES) {
        if (cat.includes(keyword)) return managers;
      }
      return ['미지정'];
    };

    const purchaseByMgr: Record<string, number> = {};
    const mfgByMgr: Record<string, number> = {};
    const pkgByMgr: Record<string, number> = {};
    let purchaseCount = 0;
    let mfgCount = 0;
    let pkgCount = 0;

    // 평균 회신일 계산용
    const parseDate = (s: string): Date | null => {
      if (!s) return null;
      const v = s.trim().replace(/^~/, '');
      const mt = v.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (mt) return new Date(new Date().getFullYear(), Number(mt[1]) - 1, Number(mt[2]));
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const bizDays = (from: Date, to: Date): number => {
      let c = 0; const d = new Date(from);
      while (d < to) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) c++; }
      return c;
    };
    // 담당자별 D-day 기준 평균 (소요일 - 기한 = 차이, 음수=빠름, 양수=초과)
    const LIMIT_PURCHASE = 3, LIMIT_MFG = 2, LIMIT_PKG = 2;
    const purchaseAvg: Record<string, { total: number; cnt: number }> = {};
    const mfgAvg: Record<string, { total: number; cnt: number }> = {};
    const pkgAvg: Record<string, { total: number; cnt: number }> = {};
    const today = new Date(); today.setHours(0, 0, 0, 0);

    // 완료건: 소요일 - 기한
    items.forEach(item => {
      if (item.materialSource?.trim() === '사급') return;
      const ed = editData[item.id];
      if (!ed) return;
      if ((ed.purchaseManager ?? '').trim() === '사급') return;

      // 업로드일과 동일한 건(기존 데이터) 제외: writeDate == filledAt이면 스킵
      const writeD = parseDate(ed.writeDate ?? '');
      const matFilled = parseDate(ed.materialSettingFilledAt ?? '');
      if (writeD && matFilled && ed.writeDate !== ed.materialSettingFilledAt) {
        const mgr = (ed.purchaseManager ?? '').trim() || '미지정';
        if (!purchaseAvg[mgr]) purchaseAvg[mgr] = { total: 0, cnt: 0 };
        purchaseAvg[mgr].total += bizDays(writeD, matFilled) - LIMIT_PURCHASE;
        purchaseAvg[mgr].cnt += 1;
      }
      const matFilled2 = parseDate(ed.materialSettingFilledAt ?? '');
      const mfgFilled = parseDate(ed.manufacturingFilledAt ?? '');
      if (matFilled2 && mfgFilled && ed.materialSettingFilledAt !== ed.manufacturingFilledAt) {
        const mgr = (item.cisManager ?? '').trim() || '미지정';
        if (!mfgAvg[mgr]) mfgAvg[mgr] = { total: 0, cnt: 0 };
        mfgAvg[mgr].total += bizDays(matFilled2, mfgFilled) - LIMIT_MFG;
        mfgAvg[mgr].cnt += 1;
      }
      const mfgFilled2 = parseDate(ed.manufacturingFilledAt ?? '');
      const pkgFilled = parseDate(ed.packagingFilledAt ?? '');
      if (mfgFilled2 && pkgFilled && ed.manufacturingFilledAt !== ed.packagingFilledAt) {
        const mgr = (item.cisManager ?? '').trim() || '미지정';
        if (!pkgAvg[mgr]) pkgAvg[mgr] = { total: 0, cnt: 0 };
        pkgAvg[mgr].total += bizDays(mfgFilled2, pkgFilled) - LIMIT_PKG;
        pkgAvg[mgr].cnt += 1;
      }
    });

    // 미회신 건수 집계 + 미회신 건의 현재 경과일도 평균에 포함
    items.forEach(item => {
      if (item.materialSource?.trim() === '사급') return;
      const ed = editData[item.id];
      if ((ed?.purchaseManager ?? '').trim() === '사급') return;
      const cat = item.category?.trim() || '';

      if (!(ed?.materialSettingDate ?? '').trim()) {
        purchaseCount++;
        const mgr = (ed?.purchaseManager ?? '').trim() || '미지정';
        purchaseByMgr[mgr] = (purchaseByMgr[mgr] || 0) + 1;
        const writeD = parseDate(ed?.writeDate ?? '');
        if (writeD) {
          if (!purchaseAvg[mgr]) purchaseAvg[mgr] = { total: 0, cnt: 0 };
          purchaseAvg[mgr].total += bizDays(writeD, today) - LIMIT_PURCHASE;
          purchaseAvg[mgr].cnt += 1;
        }
      }
      if (!(ed?.manufacturingDate ?? '').trim()) {
        mfgCount++;
        const managers = getMfgManagers(cat, item.itemName || '');
        const share = 1 / managers.length;
        managers.forEach(m => { mfgByMgr[m] = (mfgByMgr[m] || 0) + share; });
        // 제조/충포장 미회신 건은 평균에서 제외 (완료 건만 집계)
      }
      if (!(ed?.packagingDate ?? '').trim()) {
        pkgCount++;
        const managers = getPkgManagers(cat);
        const share = 1 / managers.length;
        managers.forEach(m => { pkgByMgr[m] = (pkgByMgr[m] || 0) + share; });
      }
    });

    const toManagerList = (map: Record<string, number>, avgMap: Record<string, { total: number; cnt: number }>) =>
      Object.entries(map).map(([name, count]) => {
        const a = avgMap[name];
        return { name, count: Math.round(count), avgDays: a && a.cnt > 0 ? a.total / a.cnt : undefined };
      }).filter(m => m.count > 0).sort((a, b) => b.count - a.count);
    return [
      { dept: '제조', count: mfgCount, managers: toManagerList(mfgByMgr, mfgAvg) },
      { dept: '충포장', count: pkgCount, managers: toManagerList(pkgByMgr, pkgAvg) },
      { dept: '구매', count: purchaseCount, managers: toManagerList(purchaseByMgr, purchaseAvg) },
    ].filter(d => d.count > 0);
  }, [items, editData]);

  // 담당자별 평균 회신일 계산


  // 고객사 드릴다운 데이터
  const customerModalData = useMemo(() => {
    if (!customerModal) return null;
    const isEtc = customerModal === '기타';
    const top10Codes = customerChartData.filter(c => c.name !== '기타').map(c => c.name);
    const cItems = isEtc
      ? items.filter(i => !top10Codes.includes(i.customerCode))
      : items.filter(i => i.customerCode === customerModal);
    const customerName = cItems[0]?.customerName || customerModal;
    const totalAmount = cItems.reduce((s, i) => s + getRevenue(i), 0);

    const itemList = cItems.map(i => {
      const ed = editData[i.id];
      const status = ed?.revenuePossible || i.status || '확인중';
      return {
        itemCode: i.materialCode,
        itemName: i.itemName,
        amount: getRevenue(i),
        count: i.remainingQuantity,
        status: status as '가능' | '확인중' | '불가능',
      };
    }).sort((a, b) => b.amount - a.amount);

    return { customerCode: customerModal, customerName, totalAmount, items: itemList };
  }, [customerModal, items, editData, customerChartData]);

  // 귀책부서 드릴다운 데이터
  const delayDeptModalData = useMemo(() => {
    if (!delayDeptModal) return null;
    // 부서명 역매핑
    const reverseMap: Record<string, string[]> = {
      '구매(원)': ['구매'],
      '연구': ['연구소'],
    };
    const matchNames = reverseMap[delayDeptModal] || [delayDeptModal];

    const deptItems = items.filter(i => {
      const reason = (editData[i.id]?.delayReason || '').trim();
      return matchNames.includes(reason);
    });

    const itemList = deptItems.map(i => {
      const ed = editData[i.id];
      // 지연일수: 변경납기일 - 오늘
      let delayDays = 0;
      if (i.changedDueDate) {
        const due = new Date(i.changedDueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        if (diff > 0) delayDays = diff;
      }
      return {
        itemCode: i.materialCode,
        itemName: i.itemName,
        delayDays,
        manager: ed?.purchaseManager || i.cisManager,
        reason: ed?.delayReason || '',
      };
    }).sort((a, b) => b.delayDays - a.delayDays);

    return { deptName: delayDeptModal, totalCount: deptItems.length, items: itemList };
  }, [delayDeptModal, items, editData]);

  const trendData = [
    { date: '3/20', rate: 0 },
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
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-3 sm:py-0 sm:h-24 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-slate-900 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 shrink-0">
              <LayoutDashboard className="text-white w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[18px] sm:text-[30px] font-black tracking-tighter text-slate-900 truncate">
                📊 {parseInt(selectedMonth.split('-')[1])}월 중점관리 품목 <span className="text-emerald-600">대시보드</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] sm:text-[13px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase tracking-widest">Project {formatCurrency(stats.overall.totalRevenue)}</span>
                <div className="w-1 h-1 rounded-full bg-slate-300 hidden sm:block" />
                <p className="text-[13px] text-slate-400 font-medium italic hidden sm:block">{parseInt(selectedMonth.split('-')[1])}월 중점관리 품목 실시간 현황</p>
                {isReadOnly && <span className="text-[11px] font-bold bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">읽기전용</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-6 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <div className="hidden lg:flex flex-col items-end">
              <span className="text-[13px] font-bold text-slate-400 uppercase tracking-widest mb-1">시스템 상태</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[15px] font-bold text-slate-700">실시간 동기화 중</span>
                <span className="text-slate-300 mx-1">|</span>
                <span className="text-[15px] font-bold text-slate-700">작성일자: 2026-03-20</span>
              </div>
            </div>
            <div className="h-10 w-px bg-slate-200 hidden lg:block" />
            <button
              onClick={() => { setSaveStatus('loading'); refreshEditData(); }}
              className="group bg-slate-900 text-white px-3 sm:pl-4 sm:pr-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold hover:bg-emerald-600 transition-all duration-300 flex items-center gap-1.5 sm:gap-2 shadow-xl shadow-slate-200 shrink-0"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-500", saveStatus === 'loading' ? "animate-spin" : "group-hover:rotate-180")} />
              <span className="hidden sm:inline">데이터 갱신</span><span className="sm:hidden">갱신</span>
            </button>
            <button
              onClick={handleSnapshot}
              disabled={snapshotStatus === 'saving'}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:pl-4 sm:pr-5 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold transition-all duration-300 shadow-xl shrink-0",
                snapshotStatus === 'saved'
                  ? "bg-indigo-500 text-white shadow-indigo-200"
                  : snapshotStatus === 'saving'
                  ? "bg-indigo-300 text-white shadow-indigo-100 cursor-wait"
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
              )}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {snapshotStatus === 'saved' ? '완료' : snapshotStatus === 'saving' ? '저장중' : '스냅샷'}
            </button>
            <div className="h-10 w-px bg-slate-200 hidden sm:block" />
            {/* 사용자 정보 + 로그아웃 */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 border-slate-200" />
              ) : (
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-slate-100 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                </div>
              )}
              <div className="hidden sm:flex flex-col items-start">
                <span className="text-[13px] font-bold text-slate-700">{profile?.name || profile?.email}</span>
                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                  {isAdmin && <Shield className="w-3 h-3 text-indigo-500" />}
                  {isAdmin ? '관리자' : '일반'}
                </span>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                title="로그아웃"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 flex gap-4 sm:gap-10 overflow-x-auto">
          {[
            { id: 'summary', label: '종합현황', icon: LayoutDashboard },
            { id: 'details', label: '상세데이터', icon: List },
            { id: 'snapshots', label: '월별 이력', icon: Camera },
            ...(isAdmin ? [
              { id: 'admin-users', label: '회원관리', icon: Users },
              { id: 'admin-upload', label: '데이터 업로드', icon: Upload },
            ] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 py-3 sm:py-5 text-[12px] sm:text-[15px] font-black uppercase tracking-widest transition-all relative group whitespace-nowrap",
                activeTab === tab.id
                  ? "text-slate-900"
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <tab.icon className={cn("w-4 h-4", activeTab === tab.id ? (tab.id === 'delay' ? "text-red-500" : "text-emerald-500") : "text-slate-300 group-hover:text-slate-400")} />
              {tab.label}
              {activeTab === tab.id && (
                <div className={cn("absolute bottom-0 left-0 w-full h-1 rounded-t-full", tab.id === 'delay' ? "bg-red-500" : "bg-emerald-500")} />
              )}
            </button>
          ))}
        </div>

        {/* 월별 시트 탭 제거 — 스냅샷으로 이력 관리 */}
      </header>

      <main className="max-w-[1600px] mx-auto p-4 sm:p-10">
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
                    <div className="text-[18px] font-extrabold text-gray-800">{formatCurrency(stats.overall.totalRevenue)}</div>
                  </div>
                  <div className="text-center py-2.5 px-2" style={{ backgroundColor: '#f8f9fb', borderRadius: 8 }}>
                    <div className="text-[11px] font-medium text-gray-400 mb-0.5">현재 매출</div>
                    <div className="text-[18px] font-extrabold text-gray-800">{formatCurrency(stats.overall.possibleRevenue)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3행 — 미회신 건수 + 귀책부서별 지연현황 & Top10 고객사 (1:1) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 items-stretch" style={{ gap: 20 }}>
              <NoReplyCard data={noReplyData} />

              <div className="flex flex-col" style={{ gap: 20 }}>
                <DelayByDeptCard data={delayByDeptData} onDeptClick={(dept) => setDelayDeptModal(dept)} />
                <Top10CustomerCard
                  data={customerChartData.map((c) => ({
                    name: c.name,
                    amount: c.가능 + c.확인중 + c.불가능,
                    isEtc: c.name === '기타',
                  }))}
                  onCustomerClick={(name) => setCustomerModal(name)}
                />
              </div>
            </div>
          </div>
          );
        })()}

        {/* 고객사 드릴다운 모달 */}
        <DrilldownModal
          isOpen={!!customerModal}
          onClose={() => setCustomerModal(null)}
          title={
            <>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{customerModalData?.customerName || customerModal}</span>
              <span style={{ fontSize: 12, color: '#6366f1', fontWeight: 600, background: '#eef2ff', padding: '2px 8px', borderRadius: 6 }}>
                {customerModalData ? formatCurrency(customerModalData.totalAmount) : ''}
              </span>
            </>
          }
        >
          {customerModalData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* 품목별 매출 리스트 */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                  품목별 매출 ({customerModalData.items.length}건)
                </div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af' }}>
                      <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품번</th>
                      <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품명</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500 }}>매출</th>
                      <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500 }}>잔량</th>
                      <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 500 }}>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerModalData.items.map((item, i) => {
                      const statusColor = item.status === '가능' ? '#10b981' : item.status === '불가능' ? '#f43f5e' : '#f59e0b';
                      const statusBg = item.status === '가능' ? '#ecfdf5' : item.status === '불가능' ? '#fef2f2' : '#fffbeb';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '6px 4px', color: '#6b7280', whiteSpace: 'nowrap' }}>{item.itemCode}</td>
                          <td style={{ padding: '6px 4px', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' as const }}>{item.itemName}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, color: '#1f2937' }}>{formatCurrency(item.amount)}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', color: '#6b7280' }}>{item.count.toLocaleString()}</td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                              color: statusColor, background: statusBg,
                            }}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DrilldownModal>

        {/* 귀책부서 드릴다운 모달 */}
        <DrilldownModal
          isOpen={!!delayDeptModal}
          onClose={() => setDelayDeptModal(null)}
          title={
            <>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1f2937' }}>{delayDeptModal}</span>
              {delayDeptModalData && (
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600, background: '#534AB7', padding: '2px 8px', borderRadius: 6 }}>
                  지연 {delayDeptModalData.totalCount}건
                </span>
              )}
            </>
          }
        >
          {delayDeptModalData && (
            <div>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb', color: '#9ca3af' }}>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품번</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>품명</th>
                    <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 500 }}>지연일</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>담당자</th>
                    <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 500 }}>사유</th>
                  </tr>
                </thead>
                <tbody>
                  {delayDeptModalData.items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                      <td style={{ padding: '6px 4px', color: '#6b7280', whiteSpace: 'nowrap' }}>{item.itemCode}</td>
                      <td style={{ padding: '6px 4px', color: '#374151', whiteSpace: 'normal', wordBreak: 'break-word' as const }}>{item.itemName}</td>
                      <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 700, color: item.delayDays >= 7 ? '#ef4444' : '#374151' }}>
                        {item.delayDays > 0 ? `${item.delayDays}일` : '-'}
                      </td>
                      <td style={{ padding: '6px 4px', color: '#6b7280' }}>{item.manager}</td>
                      <td style={{ padding: '6px 4px', color: '#6b7280' }}>{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {delayDeptModalData.items.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: '#9ca3af', fontSize: 13 }}>
                  해당 부서의 지연 항목이 없습니다.
                </div>
              )}
            </div>
          )}
        </DrilldownModal>

        {activeTab === 'details' && (
          <div className="-mx-4 sm:-mx-10 space-y-8 animate-in fade-in duration-700">
            <div className="bg-white overflow-hidden">
              <DataTable items={filteredItems} editData={editData} onUpdateField={handleUpdateField} onSave={handleSave} onSnapshot={handleSnapshot} snapshotStatus={snapshotStatus} saveStatus={saveStatus} isAdmin={isAdmin} readOnly={isReadOnly} hasFilter={hasActiveFilter} delayedIds={delayedIds}>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3 sm:gap-6 bg-white px-4 sm:px-8 py-4 border-b border-slate-200/60">
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
                    <input
                      type="text"
                      placeholder="중분류 검색..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={midCategoryFilter}
                      onChange={(e) => setMidCategoryFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">매출 가능여부</label>
                    <input
                      type="text"
                      placeholder="가능/불가능/확인중"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={revenuePossibleFilter}
                      onChange={(e) => setRevenuePossibleFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">지연사유</label>
                    <input
                      type="text"
                      placeholder="부서명 검색..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={delayReasonFilter}
                      onChange={(e) => setDelayReasonFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[13px] font-black text-slate-400 uppercase tracking-widest ml-1">납기일</label>
                    <input
                      type="text"
                      placeholder="날짜 검색..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={dueDateFilter}
                      onChange={(e) => setDueDateFilter(e.target.value)}
                    />
                  </div>
                </div>
              </DataTable>
            </div>
          </div>
        )}

        {activeTab === 'snapshots' && (
          <SnapshotHistory isAdmin={isAdmin} />
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
